(function(){
  "use strict";

  const catalog=Array.isArray(window.CHILLER_CATALOG)?window.CHILLER_CATALOG.filter(Boolean):[];
  const features=Array.isArray(window.CHILLER_FEATURES)?window.CHILLER_FEATURES.filter(Boolean):[];
  const SLOT_SECONDS=30*60;
  const SLOT_MS=SLOT_SECONDS*1000;
  const SLOTS_PER_DAY=48;
  const FEATURE_DAY=6; // Saturday
  const FEATURE_START_SLOT=44; // 10:00 PM viewer-local time

  const $=id=>document.getElementById(id);
  const els={
    clock:$("stationClock"),title:$("nowTitle"),meta:$("nowMeta"),time:$("programTime"),mode:$("modeLabel"),
    enter:$("enterButton"),station:$("stationCard"),stationTitle:$("stationCardTitle"),stationCountdown:$("stationCardCountdown"),
    position:$("positionLabel"),remaining:$("remainingLabel"),bar:$("progressBar"),next:$("nextCards"),guide:$("guideRows"),guideDate:$("guideDate"),
    live:$("liveButton"),startOver:$("startOverButton"),rewind:$("rewindButton")
  };

  let player=null;
  let playerReady=false;
  let entered=false;
  let mode="live";
  let manualOffset=0;
  let loadedKey="";
  let lastDayKey="";
  let currentProgram=null;
  let currentBreakKey="";
  let errorTries=0;
  let pendingLoad=null;

  const pad=n=>String(n).padStart(2,"0");
  const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const fmtTime=d=>d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
  const fmtDur=seconds=>{const value=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(value/60)}:${pad(value%60)}`;};

  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rng(seed){let x=seed||123456789;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
  function seededShuffle(items,seedText){const out=items.slice();const random=rng(hash(seedText));for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  function imageFor(program){return program?.posterUrl||`https://i.ytimg.com/vi/${program?.videoId||""}/hqdefault.jpg`;}
  function runtimeFor(program){return Math.max(60,Math.min(SLOT_SECONDS,Math.floor(Number(program?.runtimeSeconds)||SLOT_SECONDS)));}

  function nextFrom(pool,index,previousVideo){
    if(!pool.length)return null;
    for(let step=0;step<pool.length;step++){
      const item=pool[(index+step)%pool.length];
      if(item&&item.videoId!==previousVideo)return item;
    }
    return pool[index%pool.length]||null;
  }

  function coreSchedule(date){
    const key=dateKey(date);
    const hitchcock=seededShuffle(catalog.filter(item=>item.family==="hitchcock-1980s"),`CHILLER|HITCHCOCK|${key}`);
    const twilight=seededShuffle(catalog.filter(item=>item.family==="twilight-zone-1980s"),`CHILLER|TWILIGHT|${key}`);
    const fallback=seededShuffle(catalog,`CHILLER|CORE|${key}`);
    const schedule=[];
    let hi=0,ti=0,fi=0,previousVideo="";
    const hitchcockFirst=(hash(key)&1)===0;

    for(let slot=0;slot<SLOTS_PER_DAY;slot++){
      const wantHitchcock=(slot%2===0)===hitchcockFirst;
      let item=null;
      if(wantHitchcock&&hitchcock.length){item=nextFrom(hitchcock,hi++,previousVideo);}
      else if(!wantHitchcock&&twilight.length){item=nextFrom(twilight,ti++,previousVideo);}
      if(!item&&fallback.length)item=nextFrom(fallback,fi++,previousVideo);
      schedule.push(item||null);
      previousVideo=item?.videoId||previousVideo;
    }
    return schedule;
  }

  function injectRareFeature(schedule,date){
    if(date.getDay()!==FEATURE_DAY||!features.length)return schedule;
    const feature=features[hash(`CHILLER-FEATURE|${dateKey(date)}`)%features.length];
    if(!feature?.videoId)return schedule;

    let remaining=Math.max(60,Math.floor(Number(feature.runtimeSeconds)||0));
    let segment=0;
    while(remaining>0&&FEATURE_START_SLOT+segment<SLOTS_PER_DAY){
      const segmentRuntime=Math.min(SLOT_SECONDS,remaining);
      schedule[FEATURE_START_SLOT+segment]={
        ...feature,
        id:`${feature.id}-SEG-${segment+1}`,
        series:"Alfred Hitchcock Feature",
        family:"hitchcock-feature",
        runtimeSeconds:segmentRuntime,
        sourceOffsetSeconds:segment*SLOT_SECONDS,
        featureTotalRuntime:feature.runtimeSeconds,
        featureSegment:segment+1,
        posterUrl:feature.posterUrl||`https://i.ytimg.com/vi/${feature.videoId}/hqdefault.jpg`
      };
      remaining-=segmentRuntime;
      segment++;
    }
    return schedule;
  }

  function scheduleForDay(date){return injectRareFeature(coreSchedule(date),date);}

  function stateAt(now=new Date()){
    const start=dayStart(now);
    const elapsedMs=now.getTime()-start.getTime();
    const index=Math.max(0,Math.min(SLOTS_PER_DAY-1,Math.floor(elapsedMs/SLOT_MS)));
    const slots=scheduleForDay(now);
    const program=slots[index]||null;
    const slotStart=new Date(start.getTime()+index*SLOT_MS);
    const slotEnd=new Date(slotStart.getTime()+SLOT_MS);
    const elapsedSec=Math.max(0,Math.floor((now.getTime()-slotStart.getTime())/1000));
    const runtimeSeconds=runtimeFor(program);
    const sourceOffsetSeconds=Math.max(0,Math.floor(Number(program?.sourceOffsetSeconds)||0));
    const sourceElapsedSec=sourceOffsetSeconds+Math.min(elapsedSec,runtimeSeconds);
    const totalRuntime=Math.max(runtimeSeconds,Math.floor(Number(program?.featureTotalRuntime)||runtimeSeconds));

    return {
      start,index,slots,program,slotStart,slotEnd,elapsedSec,runtimeSeconds,sourceOffsetSeconds,sourceElapsedSec,totalRuntime,
      inProgram:!!program&&elapsedSec<runtimeSeconds,
      remainingSec:Math.max(0,Math.floor((slotEnd.getTime()-now.getTime())/1000)),
      programRemainingSec:Math.max(0,totalRuntime-sourceElapsedSec),
      key:`${dateKey(now)}-${index}`
    };
  }

  const stateForSlotTime=time=>stateAt(new Date(time));

  function programLabel(program){
    if(!program)return"";
    if(program.family==="hitchcock-feature")return `${program.series} · ${program.year} · ${program.rating}`;
    return `${program.series} · ${program.year} · ${program.rating}`;
  }

  function renderNext(state){
    if(!els.next)return;
    els.next.innerHTML="";
    for(let n=1;n<=4;n++){
      const future=stateForSlotTime(state.slotStart.getTime()+n*SLOT_MS+1000);
      const program=future.program;
      if(!program)continue;
      const card=document.createElement("article");
      card.className="program-card";
      card.style.setProperty("--art",`url('${imageFor(program)}')`);
      card.innerHTML=`<time>${fmtTime(future.slotStart)}</time><b>${program.title}</b><span>${programLabel(program)}</span>`;
      els.next.appendChild(card);
    }
  }

  function renderGuide(){
    if(!els.guide)return;
    els.guide.innerHTML="";
    const now=new Date();
    if(els.guideDate)els.guideDate.textContent="Viewer-local schedule · Saturday 10 PM rare Hitchcock feature";

    for(let day=0;day<7;day++){
      const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+day);
      const start=dayStart(d);
      const slots=scheduleForDay(d);
      const section=document.createElement("section");
      section.className="guide-day";
      const label=day===0?"Today":day===1?"Tomorrow":d.toLocaleDateString([],{weekday:"long",month:"short",day:"numeric"});
      section.innerHTML=`<h3>${label}</h3><div class="guide-slots"></div>`;
      const grid=section.querySelector(".guide-slots");

      slots.forEach((program,i)=>{
        if(!program)return;
        const slot=document.createElement("article");
        const isNow=day===0&&i===stateAt(now).index;
        slot.className=`guide-slot${isNow?" now":""}`;
        slot.style.setProperty("--art",`url('${imageFor(program)}')`);
        const featureNote=program.family==="hitchcock-feature"?` · feature ${program.featureSegment}`:"";
        slot.innerHTML=`<div class="guide-slot-art"></div><div class="guide-slot-copy"><time>${fmtTime(new Date(start.getTime()+i*SLOT_MS))}</time><b>${program.title}</b><span>${programLabel(program)}${featureNote}</span></div>`;
        grid.appendChild(slot);
      });
      els.guide.appendChild(section);
    }
  }

  function updateHeader(state){
    currentProgram=state.program;
    if(!currentProgram)return;
    if(els.clock)els.clock.textContent=`${fmtTime(new Date())} local`;
    if(els.title)els.title.textContent=currentProgram.title;
    if(els.meta)els.meta.textContent=programLabel(currentProgram);
    if(els.time)els.time.textContent=`${fmtTime(state.slotStart)}–${fmtTime(state.slotEnd)}`;

    const shownElapsed=mode==="live"?state.sourceElapsedSec:manualOffset;
    if(els.position){
      if(mode!=="live")els.position.textContent=`${fmtDur(shownElapsed)} from start`;
      else if(currentProgram.family==="hitchcock-feature")els.position.textContent=`Full Hitchcock feature · ${fmtDur(shownElapsed)} elapsed`;
      else els.position.textContent=state.inProgram?"Synced with the Chiller schedule":"Station break · next program remains synchronized";
    }
    if(els.remaining)els.remaining.textContent=state.inProgram?`${fmtDur(state.programRemainingSec)} left in program`:`${fmtDur(state.remainingSec)} until next program`;
    if(els.bar){
      const denominator=currentProgram.family==="hitchcock-feature"?state.totalRuntime:SLOT_SECONDS;
      const numerator=currentProgram.family==="hitchcock-feature"?state.sourceElapsedSec:state.elapsedSec;
      els.bar.style.width=`${Math.min(100,Math.max(0,(numerator/denominator)*100))}%`;
    }
    document.body.style.setProperty("--current-art",`url('${imageFor(currentProgram)}')`);
  }

  function showMessage(title,subtitle,key=""){
    if(!els.station)return;
    els.station.hidden=false;
    if(els.stationTitle)els.stationTitle.textContent=title;
    if(els.stationCountdown)els.stationCountdown.textContent=subtitle;
    currentBreakKey=key;
  }
  function hideMessage(){if(els.station)els.station.hidden=true;currentBreakKey="";}
  function stopVideo(){if(player&&playerReady&&typeof player.stopVideo==="function"){try{player.stopVideo();}catch(_){}}}

  function showBreak(state){
    const next=stateForSlotTime(state.slotEnd.getTime()+1000);
    showMessage(`Next: ${next.program?.title||"the next Chiller program"}`,`Begins in ${fmtDur(state.remainingSec)}`,`break:${state.key}`);
    stopVideo();
  }

  function fallbackProgram(state,attempt){
    const pool=seededShuffle(catalog,`CHILLER-FALLBACK|${state.key}|${attempt}`).filter(item=>item?.videoId&&item.videoId!==currentProgram?.videoId);
    return pool[0]||null;
  }

  function handlePlayerError(event){
    const state=stateAt();
    if(currentProgram?.family==="hitchcock-feature"){
      const code=event&&typeof event.data!=="undefined"?` (YouTube ${event.data})`:"";
      showMessage("The Hitchcock feature source is unavailable",`Chiller will return to the scheduled anthology block${code}.`, `feature-error:${state.key}`);
      return;
    }
    errorTries++;
    const alt=errorTries<=3?fallbackProgram(state,errorTries):null;
    if(alt&&player&&playerReady){
      if(els.title)els.title.textContent=`${alt.title} · alternate feed`;
      if(els.meta)els.meta.textContent=programLabel(alt);
      try{player.loadVideoById({videoId:alt.videoId,startSeconds:0});return;}catch(_){}
    }
    const code=event&&typeof event.data!=="undefined"?` (YouTube ${event.data})`:"";
    showMessage("This source is unavailable right now",`Chiller stays on schedule${code}. The next program begins automatically.`,`error:${state.key}`);
  }

  function createOrLoad(videoId,startSeconds,resetErrors=true){
    if(!videoId)return;
    const start=Math.max(0,Math.floor(Number(startSeconds)||0));
    pendingLoad={videoId,start};
    if(resetErrors)errorTries=0;
    if(!window.YT||!YT.Player)return;

    if(!player){
      const initial=pendingLoad;
      player=new YT.Player("player",{
        videoId:initial.videoId,
        playerVars:{autoplay:1,start:initial.start,playsinline:1,rel:0,modestbranding:1,origin:location.origin},
        events:{
          onReady:event=>{
            playerReady=true;
            const queued=pendingLoad;
            if(queued)event.target.loadVideoById({videoId:queued.videoId,startSeconds:queued.start});
            else event.target.playVideo();
          },
          onError:handlePlayerError
        }
      });
      return;
    }
    if(playerReady){hideMessage();player.loadVideoById({videoId,startSeconds:start});}
  }

  function playLive(){
    const state=stateAt();
    mode="live";
    if(els.mode)els.mode.textContent=state.program?.family==="hitchcock-feature"?"CHILLER FEATURE NIGHT":"LIVE CHILLER · 1980s SUSPENSE";
    if(!state.program){showMessage("No Chiller programs loaded","The catalog is empty.","empty");return;}
    if(!state.inProgram){showBreak(state);return;}
    hideMessage();
    currentProgram=state.program;
    const sourceSecond=state.sourceOffsetSeconds+Math.min(state.elapsedSec,state.runtimeSeconds-1);
    createOrLoad(state.program.videoId,sourceSecond,true);
    loadedKey=state.key;
  }

  function playAt(seconds,label){
    const state=stateAt();
    if(!state.program)return;
    mode="manual";
    const max=Math.max(60,Math.floor(Number(state.program.featureTotalRuntime)||state.runtimeSeconds));
    manualOffset=Math.max(0,Math.min(Number(seconds)||0,max-1));
    if(els.mode)els.mode.textContent=label;
    hideMessage();
    currentProgram=state.program;
    createOrLoad(state.program.videoId,manualOffset,true);
  }

  window.onYouTubeIframeAPIReady=function(){if(entered)playLive();};

  if(els.enter)els.enter.addEventListener("click",()=>{entered=true;els.enter.hidden=true;playLive();});
  if(els.live)els.live.addEventListener("click",playLive);
  if(els.startOver)els.startOver.addEventListener("click",()=>playAt(0,"STARTED OVER"));
  if(els.rewind)els.rewind.addEventListener("click",()=>{
    const state=stateAt();
    const liveSecond=state.sourceOffsetSeconds+Math.min(state.elapsedSec,state.runtimeSeconds-1);
    const base=mode==="live"?liveSecond:(player&&playerReady&&typeof player.getCurrentTime==="function"?player.getCurrentTime():manualOffset);
    playAt(base-30,"REWOUND 30 SEC");
  });

  function tick(){
    const now=new Date();
    const state=stateAt(now);
    if(!state.program)return;
    updateHeader(state);

    const today=dateKey(now);
    if(today!==lastDayKey){lastDayKey=today;renderGuide();}
    if(state.key!==loadedKey){renderNext(state);if(entered&&mode==="live")playLive();else loadedKey=state.key;return;}

    if(entered&&mode==="live"&&!state.inProgram){
      const breakKey=`break:${state.key}`;
      if(currentBreakKey!==breakKey)showBreak(state);
      else if(els.stationCountdown)els.stationCountdown.textContent=`Begins in ${fmtDur(state.remainingSec)}`;
    }
  }

  if(!catalog.length){if(els.title)els.title.textContent="No Chiller programs loaded";if(els.meta)els.meta.textContent="The catalog is empty.";return;}

  lastDayKey=dateKey(new Date());
  renderGuide();
  const initial=stateAt();
  loadedKey=initial.key;
  renderNext(initial);
  tick();
  setInterval(tick,1000);
})();
