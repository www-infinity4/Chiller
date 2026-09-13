(function () {
  "use strict";

  const catalog = Array.isArray(window.CHILLER_CATALOG) ? window.CHILLER_CATALOG.slice() : [];
  const SLOT_MS = 30 * 60 * 1000;
  const SLOTS_PER_DAY = 48;

  const channels = [
    ["Hermit TV","Hermit-TV"],
    ["Star Launcher","Star-Launcher"],
    ["HBO","HBO"],
    ["Cinemax","Cinemax"],
    ["Showtime","Showtime"],
    ["Starz","Starz"],
    ["Encore","Encore"],
    ["Cartoon Network","Cartoon-Network"],
    ["WGN","WGN"],
    ["NBC","NBC"],
    ["FOX","FOX"],
    ["PBS","PBS"],
    ["TNT","TNT"],
    ["History Channel","History-Channel"],
    ["Disney Vintage","Disney"],
    ["Discovery","Discovery"],
    ["Chiller","Chiller"],
    ["Trump TV","Trump-TV"],
    ["ShopLC","ShopLC"],
    ["StarQuest","TV-Database"],
    ["Astraflix","Astraflix"],
    ["Syncord","Syncord"],
    ["Vintech","Vintech"],
    ["Abstractia","Abstractia-"],
    ["Flix Blender","Flix-Blender"],
    ["Animasync","Animasync"]
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
    player: $("player"),
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
  let currentProgram = null;

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
    seconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${pad(s)}`;
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

  function safeJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function imageFor(program) {
    return program.posterUrl || `https://i.ytimg.com/vi/${program.videoId}/hqdefault.jpg`;
  }

  function renderRemote() {
    const active = "Chiller";
    const html = channels.map(channel => {
      const current = channel.slug === active ? ' aria-current="page"' : "";
      return `<a${current} href="${channel.url}">${channel.name}</a>`;
    }).join("");
    $("channelNav").innerHTML = html;
    $("directoryNav").innerHTML = html;
  }

  function classify(program) {
    const text = `${program.series} ${program.title} ${program.year}`.toLowerCase();
    if (text.includes("alfred hitchcock")) return "hitchcock";
    if (text.includes("twilight zone") && /198|1985|1986|1987/.test(text)) return "tz80s";
    if (text.includes("twilight zone")) return "tzclassic";
    if (text.includes("ray bradbury")) return "bradbury";
    if (text.includes("amazing stories")) return "amazing";
    return "other";
  }

  function buildPools() {
    const pools = {
      hitchcock: [],
      tzclassic: [],
      tz80s: [],
      bradbury: [],
      amazing: [],
      other: []
    };
    for (const item of catalog) {
      const key = classify(item);
      (pools[key] || pools.other).push(item);
    }
    return pools;
  }

  function pickNextFromPool(pool, usedIds, previousSeries, previousId, random) {
    const filtered = pool.filter(item =>
      !usedIds.has(item.id) &&
      item.id !== previousId &&
      item.series !== previousSeries
    );

    const source = filtered.length ? filtered : pool.filter(item => item.id !== previousId);
    if (!source.length) return null;

    const index = Math.floor(random() * source.length);
    return source[index];
  }

  function shuffledForDay(date) {
    const random = rng(hash(`CHILLER|${dateKey(date)}`));
    const pools = buildPools();

    const pattern = [
      "hitchcock", "tzclassic", "tz80s", "other",
      "hitchcock", "bradbury", "tzclassic", "other",
      "tz80s", "hitchcock", "amazing", "tzclassic"
    ];

    const schedule = [];
    const usedIds = new Set();
    let previousSeries = "";
    let previousId = "";

    for (let i = 0; i < SLOTS_PER_DAY; i++) {
      const preferred = pattern[i % pattern.length];
      let chosen = pickNextFromPool(pools[preferred] || [], usedIds, previousSeries, previousId, random);

      if (!chosen) {
        const all = Object.values(pools).flat();
        chosen = pickNextFromPool(all, usedIds, previousSeries, previousId, random);
      }

      if (!chosen) {
        const all = Object.values(pools).flat();
        const fallback = all.filter(item => item.id !== previousId);
        chosen = fallback[Math.floor(random() * fallback.length)] || all[0];
      }

      if (!chosen) break;

      schedule.push(chosen);
      usedIds.add(chosen.id);
      previousSeries = chosen.series;
      previousId = chosen.id;
    }

    return schedule;
  }

  function stateAt(now = new Date()) {
    const start = dayStart(now);
    const elapsed = now - start;
    const index = Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.floor(elapsed / SLOT_MS)));
    const slots = shuffledForDay(now);
    const program = slots[index];
    const slotStart = new Date(start.getTime() + index * SLOT_MS);
    const slotEnd = new Date(slotStart.getTime() + SLOT_MS);
    const elapsedSec = Math.floor((now - slotStart) / 1000);
    return {
      start,
      index,
      slots,
      program,
      slotStart,
      slotEnd,
      elapsedSec,
      remainingSec: Math.max(0, Math.floor((slotEnd - now) / 1000)),
      key: `${dateKey(now)}-${index}`
    };
  }

  function renderNext(state) {
    els.next.innerHTML = "";
    for (let n = 1; n <= 4; n++) {
      const idx = (state.index + n) % SLOTS_PER_DAY;
      const program = state.slots[idx];
      if (!program) continue;
      const time = new Date(state.start.getTime() + idx * SLOT_MS);
      const card = document.createElement("article");
      card.className = "program-card";
      card.style.setProperty("--art", `url('${imageFor(program)}')`);
      card.innerHTML = `
        <time>${fmtTime(time)}</time>
        <b>${program.title}</b>
        <span>${program.series} · ${program.year} · ${program.rating}</span>
      `;
      els.next.appendChild(card);
    }
  }

  function renderGuide() {
    els.guide.innerHTML = "";
    const now = new Date();
    els.guideDate.textContent = "Viewer-local schedule";

    for (let day = 0; day < 7; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
      const slots = shuffledForDay(d);
      const start = dayStart(d);

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
        slot.className = "guide-slot" + (day === 0 && i === stateAt(now).index ? " now" : "");
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

    els.clock.textContent = `${fmtTime(new Date())} local`;
    els.title.textContent = currentProgram.title;
    els.meta.textContent = `${currentProgram.series} · ${currentProgram.year} · ${currentProgram.rating}`;
    els.time.textContent = `${fmtTime(state.slotStart)}–${fmtTime(state.slotEnd)}`;

    const shownElapsed = mode === "live" ? state.elapsedSec : manualOffset;
    els.position.textContent = mode === "live"
      ? "Synced with the Chiller schedule"
      : `${fmtDur(shownElapsed)} from start`;

    els.remaining.textContent = `${fmtDur(state.remainingSec)} until next program`;
    els.bar.style.width = `${Math.min(100, Math.max(0, (state.elapsedSec / (SLOT_MS / 1000)) * 100))}%`;

    document.body.style.setProperty("--current-art", `url('${imageFor(currentProgram)}')`);
  }

  function showMessage(title, subtitle) {
    els.station.hidden = false;
    els.stationTitle.textContent = title;
    els.stationCountdown.textContent = subtitle;
  }

  function hideMessage() {
    els.station.hidden = true;
  }

  function createOrLoad(videoId, startSeconds) {
    if (!window.YT || !YT.Player) return;

    if (!ytPlayer) {
      ytPlayer = new YT.Player("player", {
        videoId,
        playerVars: {
          autoplay: 1,
          start: Math.max(0, Math.floor(startSeconds)),
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          origin: location.origin
        },
        events: {
          onReady: e => {
            playerReady = true;
            e.target.playVideo();
          },
          onError: () => {
            showMessage("This source is unavailable right now", "The schedule will continue with the next program.");
          }
        }
      });
      return;
    }

    if (playerReady) {
      hideMessage();
      ytPlayer.loadVideoById({
        videoId,
        startSeconds: Math.max(0, Math.floor(startSeconds))
      });
    }
  }

  function playLive() {
    const state = stateAt();
    if (!state.program) {
      showMessage("No Chiller programs loaded", "Catalog is empty.");
      return;
    }
    mode = "live";
    els.mode.textContent = "LIVE CHILLER";
    hideMessage();
    createOrLoad(state.program.videoId, state.elapsedSec);
  }

  function playAt(seconds, label) {
    const state = stateAt();
    if (!state.program) return;
    mode = "manual";
    manualOffset = Math.max(0, Math.min(seconds, Math.max(0, state.program.runtimeSeconds - 1)));
    els.mode.textContent = label;
    hideMessage();
    createOrLoad(state.program.videoId, manualOffset);
  }

  window.onYouTubeIframeAPIReady = function () {
    if (entered) playLive();
  };

  els.enter.addEventListener("click", () => {
    entered = true;
    els.enter.hidden = true;
    playLive();
  });

  els.liveButton.addEventListener("click", playLive);

  els.startOverButton.addEventListener("click", () => {
    playAt(0, "STARTED OVER");
  });

  els.rewindButton.addEventListener("click", () => {
    const state = stateAt();
    const base = mode === "live"
      ? state.elapsedSec
      : (ytPlayer && playerReady && typeof ytPlayer.getCurrentTime === "function"
          ? ytPlayer.getCurrentTime()
          : manualOffset);
    playAt(base - 30, "REWOUND 30 SEC");
  });

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
    els.shareStatus.textContent = `Share counted · ${profile.pendingShareCredits}/10 toward next ⭐`;
  }

  els.share.addEventListener("click", async () => {
    const data = {
      title: "Chiller — Classic Suspense Is Already Playing",
      text: "Vintage suspense is playing live on Chiller.",
      url: "https://www-infinity4.github.io/Chiller/?card=20260913b"
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        recordShare();
      } else {
        await navigator.clipboard.writeText(data.url);
        els.shareStatus.textContent = "Link copied.";
      }
    } catch (err) {
      if (err && err.name !== "AbortError") {
        els.shareStatus.textContent = "Share did not complete.";
      }
    }
  });

  els.walletButton.addEventListener("click", () => {
    const wallet = walletProfile().profile;
    alert(
      "Chiller wallet\n\n" +
      `StarCoins: ${Number(wallet.tokens) || 0}\n` +
      `Share progress: ${Number(wallet.pendingShareCredits) || 0}/10\n` +
      `Confirmed shares: ${Number(wallet.shareCount) || 0}`
    );
  });

  function tick() {
    const state = stateAt();
    if (!state.program) return;

    updateHeader(state);

    if (state.key !== lastSlotKey) {
      lastSlotKey = state.key;
      renderNext(state);

      if (entered && mode === "live") {
        playLive();
      }

      if (new Date().getHours() === 0 && new Date().getMinutes() < 2) {
        renderGuide();
      }
    }
  }

  if (!catalog.length) {
    els.title.textContent = "No Chiller programs loaded";
    els.meta.textContent = "Add a larger mixed catalog.";
    return;
  }

  renderRemote();
  renderGuide();
  refreshWallet();
  tick();
  setInterval(tick, 1000);
})();
