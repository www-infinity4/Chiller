(function(){
  "use strict";

  const SLOT_SECONDS=30*60;
  const catalog=Array.isArray(window.CHILLER_CATALOG)?window.CHILLER_CATALOG:[];

  // Catalog runtimes are useful as hints, but they must never be stop commands.
  // Keep every anthology slot playable until the half-hour boundary and let the
  // media player's real ENDED event decide when the short intermission begins.
  catalog.forEach(item=>{
    if(!item||item.family==="hitchcock-feature")return;
    if(!Number.isFinite(Number(item.runtimeHintSeconds)))item.runtimeHintSeconds=Number(item.runtimeSeconds)||0;
    item.runtimeSeconds=SLOT_SECONDS;
    item.playToNaturalEnd=true;
  });

  let breakTimer=0;

  const pad=n=>String(Math.max(0,Math.floor(n))).padStart(2,"0");
  const fmtDur=seconds=>{
    const value=Math.max(0,Math.floor(Number(seconds)||0));
    return `${Math.floor(value/60)}:${pad(value%60)}`;
  };

  function slotTiming(){
    const now=new Date();
    const elapsed=(now.getMinutes()%30)*60+now.getSeconds();
    return{elapsed,remaining:Math.max(0,SLOT_SECONDS-elapsed)};
  }

  function clearBreakTimer(){
    if(breakTimer){clearInterval(breakTimer);breakTimer=0;}
  }

  function renderNaturalBreak(){
    const timing=slotTiming();
    // Ignore an ENDED signal right on a half-hour handoff; the main scheduler is
    // already loading the next program and should not be covered by an old event.
    if(timing.elapsed<5||timing.remaining<2){clearBreakTimer();return;}

    const card=document.getElementById("stationCard");
    const title=document.getElementById("stationCardTitle");
    const countdown=document.getElementById("stationCardCountdown");
    const position=document.getElementById("positionLabel");
    const remaining=document.getElementById("remainingLabel");
    const bar=document.getElementById("progressBar");

    if(card)card.hidden=false;
    if(title)title.textContent="Episode complete · next Chiller story stays on schedule";
    if(countdown)countdown.textContent=`Begins in ${fmtDur(timing.remaining)}`;
    if(position)position.textContent="Episode finished naturally · brief intermission";
    if(remaining)remaining.textContent=`${fmtDur(timing.remaining)} until next program`;
    if(bar)bar.style.width=`${Math.min(100,(timing.elapsed/SLOT_SECONDS)*100)}%`;
  }

  function beginNaturalBreak(){
    clearBreakTimer();
    renderNaturalBreak();
    breakTimer=setInterval(()=>{
      const timing=slotTiming();
      if(timing.elapsed<3||timing.remaining<=1){clearBreakTimer();return;}
      renderNaturalBreak();
    },1000);
  }

  function wrapPlayer(){
    if(!window.YT||typeof YT.Player!=="function"||YT.Player.__chillerNaturalEndWrapped)return;
    const NativePlayer=YT.Player;
    function WrappedPlayer(target,options){
      const config=options||{};
      const events={...(config.events||{})};
      const priorState=events.onStateChange;
      events.onStateChange=function(event){
        if(typeof priorState==="function"){
          try{priorState.call(this,event);}catch(_){ }
        }
        if(window.YT&&YT.PlayerState&&event&&event.data===YT.PlayerState.ENDED)beginNaturalBreak();
      };
      config.events=events;
      return new NativePlayer(target,config);
    }
    try{Object.setPrototypeOf(WrappedPlayer,NativePlayer);}catch(_){ }
    WrappedPlayer.prototype=NativePlayer.prototype;
    WrappedPlayer.__chillerNaturalEndWrapped=true;
    YT.Player=WrappedPlayer;
  }

  const previousReady=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=function(){
    wrapPlayer();
    if(typeof previousReady==="function")return previousReady.apply(this,arguments);
  };

  if(window.YT&&typeof YT.Player==="function")wrapPlayer();

  // Any explicit live/start-over action should dismiss an old natural-end timer;
  // the channel app itself controls the actual card visibility for the new action.
  ["liveButton","startOverButton","rewindButton"].forEach(id=>{
    document.getElementById(id)?.addEventListener("click",clearBreakTimer,{capture:true});
  });

  window.CHILLER_NATURAL_END_POLICY={
    version:"2026-09-16.1",
    slotSeconds:SLOT_SECONDS,
    rule:"play-until-real-media-end-then-intermission-until-slot-boundary"
  };
})();
