(function () {
  "use strict";

  const catalog = Array.isArray(window.CHILLER_CATALOG) ? window.CHILLER_CATALOG.filter(Boolean) : [];
  const SLOT_SECONDS = 30 * 60;
  const SLOT_MS = SLOT_SECONDS * 1000;
  const SLOTS_PER_DAY = 48;

  const channels = [
    ["Hermit TV","Hermit-TV"], ["Star Launcher","Star-Launcher"], ["HBO","HBO"],
    ["Cinemax","Cinemax"], ["Showtime","Showtime"], ["Starz","Starz"], ["Encore","Encore"],
    ["Cartoon Network","Cartoon-Network"], ["WGN","WGN"], ["NBC","NBC"], ["FOX","FOX"],
    ["PBS","PBS"], ["TNT","TNT"], ["History Channel","History-Channel"],
    ["Disney Vintage","Disney"], ["Discovery","Discovery"], ["Chiller","Chiller"],
    ["Trump TV","Trump-TV"], ["ShopLC","ShopLC"], ["StarQuest","TV-Database"],
    ["Astraflix","Astraflix"], ["Syncord","Syncord"], ["Vintech","Vintech"],
    ["Abstractia","Abstractia-"], ["Flix Blender","Flix-Blender"], ["Animasync","Animasync"]
  ].map(([name, slug]) => ({
    name,
    slug,
    url: `https://www-infinity4.github.io/${slug}/`
  }));

  const $ = id => document.getElementById(id);
  const els = {
    clock: $("stationClock"),
    title: $("nowTitle"),
    meta: $("nowMeta"),
    time: $("programTime"),
    mode: $("modeLabel"),
    enter: $("enterButton"),
    station: $("stationCard"),
    stationTitle: $("stationCardTitle"),
    stationCountdown: $("stationCardCountdown"),
    position: $("positionLabel"),
    remaining: $("remainingLabel"),
    bar: $("progressBar"),
    next: $("nextCards"),
    guide: $("guideRows"),
    guideDate: $("guideDate"),
    share: $("shareButton"),
    shareStatus: $("shareStatus"),
    walletAmount: $("walletAmount"),
    walletButton: $("walletButton"),
    liveButton: $("liveButton"),
    startOverButton: $("startOverButton"),
    rewindButton: $("rewindButton")
  };

  let ytPlayer = null;
  let playerReady = false;
  let entered = false;
  let mode = "live";
  let manualOffset = 0;
  let lastSlotKey = "";
  let lastDayKey = "";
  let currentProgram = null;
  let currentBreakKey = "";
  let errorTries = 0;
  let pendingLoad = null;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dayStart(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fmtDur(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    return `${minutes}:${pad(value % 60)}`;
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rng(seed) {
    let x = seed || 123456789;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seedText) {
    const out = items.slice();
    const random = rng(hash(seedText));
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function safeJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function imageFor(program) {
    if (!program) return "";
    return program.posterUrl || `https://i.ytimg.com/vi/${program.videoId}/hqdefault.jpg`;
  }

  function programRuntime(program) {
    const seconds = Math.floor(Number(program && program.runtimeSeconds) || SLOT_SECONDS);
    return Math.max(60, Math.min(SLOT_SECONDS, seconds));
  }

  function renderRemote() {
    const html = channels.map(channel => {
      const current = channel.slug === "Chiller" ? ' aria-current="page"' : "";
      return `<a${current} href="${channel.url}">${channel.name}</a>`;
    }).join("");
    const top = $("channelNav");
    const bottom = $("directoryNav");
    if (top) top.innerHTML = html;
    if (bottom) bottom.innerHTML = html;
  }

  function shuffledForDay(date) {
    if (!catalog.length) return [];

    const schedule = [];
    let previousId = "";
    let cycle = 0;

    while (schedule.length < SLOTS_PER_DAY) {
      let batch = seededShuffle(catalog, `CHILLER|${dateKey(date)}|${cycle}`);

      if (batch.length > 1 && batch[0].id === previousId) {
        [batch[0], batch[1]] = [batch[1], batch[0]];
      }

      for (const item of batch) {
        if (schedule.length >= SLOTS_PER_DAY) break;
        if (item.id === previousId && batch.length > 1) continue;
        schedule.push(item);
        previousId = item.id;
      }

      cycle++;
      if (cycle > SLOTS_PER_DAY * 2) break;
    }

    return schedule;
  }

  function stateAt(now = new Date()) {
    const start = dayStart(now);
    const elapsedMs = now.getTime() - start.getTime();
    const index = Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.floor(elapsedMs / SLOT_MS)));
    const slots = shuffledForDay(now);
    const program = slots[index] || null;
    const slotStart = new Date(start.getTime() + index * SLOT_MS);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
    const elapsedSec = Math.max(0, Math.floor((now.getTime() - slotStart.getTime()) / 1000));
    const runtimeSeconds = programRuntime(program);

    return {
      start,
      index,
      slots,
      program,
      slotStart,
      slotEnd,
      elapsedSec,
      runtimeSeconds,
      inProgram: !!program && elapsedSec < runtimeSeconds,
      remainingSec: Math.max(0, Math.floor((slotEnd.getTime() - now.getTime()) / 1000)),
      programRemainingSec: Math.max(0, runtimeSeconds - elapsedSec),
      key: `${dateKey(now)}-${index}`
    };
  }

  function stateForSlotTime(time) {
    return stateAt(new Date(time));
  }

  function renderNext(state) {
    if (!els.next) return;
    els.next.innerHTML = "";

    for (let n = 1; n <= 4; n++) {
      const slotTime = state.slotStart.getTime() + n * SLOT_MS;
      const future = stateForSlotTime(slotTime + 1000);
      const program = future.program;
      if (!program) continue;

      const card = document.createElement("article");
      card.className = "program-card";
      card.style.setProperty("--art", `url('${imageFor(program)}')`);
      card.innerHTML = `
        <time>${fmtTime(future.slotStart)}</time>
        <b>${program.title}</b>
        <span>${program.series} · ${program.year} · ${program.rating}</span>
      `;
      els.next.appendChild(card);
    }
  }

  function renderGuide() {
    if (!els.guide) return;
    els.guide.innerHTML = "";

    const now = new Date();
    if (els.guideDate) els.guideDate.textContent = "Viewer-local schedule";

    for (let day = 0; day < 7; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
      const start = dayStart(d);
      const slots = shuffledForDay(d);
      const section = document.createElement("section");
      section.className = "guide-day";

      const label =
        day === 0 ? "Today" :
        day === 1 ? "Tomorrow" :
        d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

      section.innerHTML = `<h3>${label}</h3><div class="guide-slots"></div>`;
      const grid = section.querySelector(".guide-slots");

      slots.forEach((program, i) => {
        const slot = document.createElement("article");
        const isNow = day === 0 && i === stateAt(now).index;
        slot.className = `guide-slot${isNow ? " now" : ""}`;
        slot.style.setProperty("--art", `url('${imageFor(program)}')`);
        slot.innerHTML = `
          <div class="guide-slot-art"></div>
          <div class="guide-slot-copy">
            <time>${fmtTime(new Date(start.getTime() + i * SLOT_MS))}</time>
            <b>${program.title}</b>
            <span>${program.series} · ${program.year} · ${program.rating}</span>
          </div>
        `;
        grid.appendChild(slot);
      });

      els.guide.appendChild(section);
    }
  }

  function updateHeader(state) {
    currentProgram = state.program;
    if (!currentProgram) return;

    if (els.clock) els.clock.textContent = `${fmtTime(new Date())} local`;
    if (els.title) els.title.textContent = currentProgram.title;
    if (els.meta) els.meta.textContent = `${currentProgram.series} · ${currentProgram.year} · ${currentProgram.rating}`;
    if (els.time) els.time.textContent = `${fmtTime(state.slotStart)}–${fmtTime(state.slotEnd)}`;

    const shownElapsed = mode === "live" ? Math.min(state.elapsedSec, state.runtimeSeconds) : manualOffset;
    if (els.position) {
      els.position.textContent = mode === "live"
        ? (state.inProgram ? "Synced with the Chiller schedule" : "Station break · next program remains synchronized")
        : `${fmtDur(shownElapsed)} from start`;
    }

    if (els.remaining) {
      els.remaining.textContent = state.inProgram
        ? `${fmtDur(state.programRemainingSec)} left in program`
        : `${fmtDur(state.remainingSec)} until next program`;
    }

    if (els.bar) {
      els.bar.style.width = `${Math.min(100, Math.max(0, (state.elapsedSec / SLOT_SECONDS) * 100))}%`;
    }

    document.body.style.setProperty("--current-art", `url('${imageFor(currentProgram)}')`);
  }

  function showMessage(title, subtitle, key = "") {
    if (!els.station) return;
    els.station.hidden = false;
    if (els.stationTitle) els.stationTitle.textContent = title;
    if (els.stationCountdown) els.stationCountdown.textContent = subtitle;
    currentBreakKey = key;
  }

  function hideMessage() {
    if (els.station) els.station.hidden = true;
    currentBreakKey = "";
  }

  function stopVideoOnce() {
    if (ytPlayer && playerReady && typeof ytPlayer.stopVideo === "function") {
      try { ytPlayer.stopVideo(); } catch (_) {}
    }
  }

  function showBreak(state) {
    const nextTime = state.slotEnd.getTime() + 1000;
    const nextState = stateForSlotTime(nextTime);
    const nextTitle = nextState.program ? nextState.program.title : "the next Chiller program";
    const breakKey = `break:${state.key}`;

    showMessage(`Next: ${nextTitle}`, `Begins in ${fmtDur(state.remainingSec)}`, breakKey);
    stopVideoOnce();
  }

  function chooseFallback(state, attempt) {
    if (!catalog.length) return null;
    const candidates = seededShuffle(catalog, `CHILLER-FALLBACK|${state.key}|${attempt}`)
      .filter(item => item && currentProgram && item.id !== currentProgram.id);
    return candidates[0] || catalog.find(item => item && (!currentProgram || item.id !== currentProgram.id)) || catalog[0];
  }

  function handlePlayerError(event) {
    if (mode !== "live") {
      showMessage("This source is unavailable right now", "Use Join live to return to the synchronized channel.", "manual-error");
      return;
    }

    const state = stateAt();
    errorTries += 1;

    if (errorTries <= Math.min(4, Math.max(1, catalog.length - 1))) {
      const alt = chooseFallback(state, errorTries);
      if (alt && ytPlayer && playerReady) {
        if (els.title) els.title.textContent = `${alt.title} · alternate feed`;
        if (els.meta) els.meta.textContent = `${alt.series} · ${alt.year} · ${alt.rating}`;
        try {
          ytPlayer.loadVideoById({ videoId: alt.videoId, startSeconds: 0 });
          return;
        } catch (_) {}
      }
    }

    const code = event && typeof event.data !== "undefined" ? ` (YouTube ${event.data})` : "";
    showMessage("This source is unavailable right now", `Chiller stays on schedule${code}. The next program begins automatically.`, `error:${state.key}`);
  }

  function createOrLoad(videoId, startSeconds, resetErrors = true) {
    if (!videoId) return;
    const start = Math.max(0, Math.floor(Number(startSeconds) || 0));
    pendingLoad = { videoId, start };

    if (resetErrors) errorTries = 0;
    if (!window.YT || !YT.Player) return;

    if (!ytPlayer) {
      const initial = pendingLoad;
      ytPlayer = new YT.Player("player", {
        videoId: initial.videoId,
        playerVars: {
          autoplay: 1,
          start: initial.start,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          origin: location.origin
        },
        events: {
          onReady: event => {
            playerReady = true;
            const queued = pendingLoad;
            if (queued && typeof event.target.loadVideoById === "function") {
              event.target.loadVideoById({
                videoId: queued.videoId,
                startSeconds: queued.start
              });
            } else {
              event.target.playVideo();
            }
          },
          onError: handlePlayerError
        }
      });
      return;
    }

    if (playerReady && typeof ytPlayer.loadVideoById === "function") {
      hideMessage();
      ytPlayer.loadVideoById({ videoId, startSeconds: start });
    }
  }

  function playLive() {
    const state = stateAt();
    mode = "live";
    if (els.mode) els.mode.textContent = "LIVE CHILLER";

    if (!state.program) {
      showMessage("No Chiller programs loaded", "The catalog is empty.", "empty");
      return;
    }

    if (!state.inProgram) {
      showBreak(state);
      return;
    }

    hideMessage();
    currentProgram = state.program;
    createOrLoad(state.program.videoId, Math.min(state.elapsedSec, state.runtimeSeconds - 1), true);
  }

  function playAt(seconds, label) {
    const state = stateAt();
    if (!state.program) return;

    mode = "manual";
    manualOffset = Math.max(0, Math.min(Number(seconds) || 0, state.runtimeSeconds - 1));
    if (els.mode) els.mode.textContent = label;
    hideMessage();
    currentProgram = state.program;
    createOrLoad(state.program.videoId, manualOffset, true);
  }

  window.onYouTubeIframeAPIReady = function () {
    if (entered) playLive();
  };

  if (els.enter) {
    els.enter.addEventListener("click", () => {
      entered = true;
      els.enter.hidden = true;
      playLive();
    });
  }

  if (els.liveButton) els.liveButton.addEventListener("click", playLive);
  if (els.startOverButton) els.startOverButton.addEventListener("click", () => playAt(0, "STARTED OVER"));

  if (els.rewindButton) {
    els.rewindButton.addEventListener("click", () => {
      const state = stateAt();
      const base = mode === "live"
        ? Math.min(state.elapsedSec, state.runtimeSeconds - 1)
        : (ytPlayer && playerReady && typeof ytPlayer.getCurrentTime === "function"
            ? ytPlayer.getCurrentTime()
            : manualOffset);
      playAt(base - 30, "REWOUND 30 SEC");
    });
  }

  function walletProfile() {
    const session = safeJSON("starquest_session", null);
    const users = safeJSON("starquest_users", {});

    if (session && session.key && users[session.key]) {
      return {
        profile: users[session.key],
        save(profile) {
          users[session.key] = profile;
          localStorage.setItem("starquest_users", JSON.stringify(users));
        }
      };
    }

    const guest = safeJSON("starquest_guest_profile_v1", {});
    return {
      profile: guest,
      save(profile) {
        localStorage.setItem("starquest_guest_profile_v1", JSON.stringify(profile));
      }
    };
  }

  function refreshWallet() {
    if (!els.walletAmount) return;
    const wallet = walletProfile().profile;
    const tokens = Math.max(0, Number(wallet.tokens) || 0);
    const pending = Math.max(0, Number(wallet.pendingShareCredits) || 0);
    els.walletAmount.textContent = (tokens + pending / 10).toFixed(1);
  }

  function recordShare() {
    const wallet = walletProfile();
    const profile = Object.assign({}, wallet.profile);
    profile.shareCount = (Number(profile.shareCount) || 0) + 1;
    profile.pendingShareCredits = (Number(profile.pendingShareCredits) || 0) + 1;

    while (profile.pendingShareCredits >= 10) {
      profile.pendingShareCredits -= 10;
      profile.tokens = (Number(profile.tokens) || 0) + 1;
    }

    wallet.save(profile);
    refreshWallet();
    if (els.shareStatus) {
      els.shareStatus.textContent = `Share counted · ${profile.pendingShareCredits}/10 toward next ⭐`;
    }
  }

  if (els.share) {
    els.share.addEventListener("click", async () => {
      const data = {
        title: "Chiller — Classic Suspense Is Already Playing",
        text: "Vintage suspense is playing live on Chiller.",
        url: "https://www-infinity4.github.io/Chiller/?card=20260913c"
      };

      try {
        if (navigator.share) {
          await navigator.share(data);
          recordShare();
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.url);
          if (els.shareStatus) els.shareStatus.textContent = "Link copied.";
        } else {
          if (els.shareStatus) els.shareStatus.textContent = data.url;
        }
      } catch (err) {
        if (err && err.name !== "AbortError" && els.shareStatus) {
          els.shareStatus.textContent = "Share did not complete.";
        }
      }
    });
  }

  if (els.walletButton) {
    els.walletButton.addEventListener("click", () => {
      const wallet = walletProfile().profile;
      alert(
        "Chiller wallet\n\n" +
        `StarCoins: ${Number(wallet.tokens) || 0}\n` +
        `Share progress: ${Number(wallet.pendingShareCredits) || 0}/10\n` +
        `Confirmed shares: ${Number(wallet.shareCount) || 0}`
      );
    });
  }

  function tick() {
    const now = new Date();
    const state = stateAt(now);
    if (!state.program) return;

    updateHeader(state);

    const todayKey = dateKey(now);
    if (todayKey !== lastDayKey) {
      lastDayKey = todayKey;
      renderGuide();
    }

    if (state.key !== lastSlotKey) {
      lastSlotKey = state.key;
      renderNext(state);
      if (entered && mode === "live") playLive();
      return;
    }

    if (entered && mode === "live" && !state.inProgram) {
      const breakKey = `break:${state.key}`;
      if (currentBreakKey !== breakKey) {
        showBreak(state);
      } else if (els.stationCountdown) {
        els.stationCountdown.textContent = `Begins in ${fmtDur(state.remainingSec)}`;
      }
    }
  }

  if (!catalog.length) {
    if (els.title) els.title.textContent = "No Chiller programs loaded";
    if (els.meta) els.meta.textContent = "The catalog is empty.";
    return;
  }

  renderRemote();
  refreshWallet();
  lastDayKey = dateKey(new Date());
  renderGuide();
  tick();
  setInterval(tick, 1000);
})();