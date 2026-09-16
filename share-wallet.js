(function(){
  "use strict";

  // Chiller natural-end policy: catalog runtimes are hints, never stop commands.
  // The half-hour slot remains playable until the real video ends. Only then does
  // the leftover part of the slot become intermission.
  const SLOT_SECONDS=30*60;
  const catalog=Array.isArray(window.CHILLER_CATALOG)?window.CHILLER_CATALOG:[];
  catalog.forEach(item=>{
    if(!item||item.family==="hitchcock-feature")return;
    if(!Number.isFinite(Number(item.runtimeHintSeconds)))item.runtimeHintSeconds=Number(item.runtimeSeconds)||0;
    item.runtimeSeconds=SLOT_SECONDS;
    item.playToNaturalEnd=true;
  });

  let naturalBreakTimer=0;
  const pad=n=>String(Math.max(0,Math.floor(n))).padStart(2,"0");
  const fmtDur=seconds=>{const value=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(value/60)}:${pad(value%60)}`;};
  const slotTiming=()=>{const now=new Date();const elapsed=(now.getMinutes()%30)*60+now.getSeconds();return{elapsed,remaining:Math.max(0,SLOT_SECONDS-elapsed)};};
  const clearNaturalBreak=()=>{if(naturalBreakTimer){clearInterval(naturalBreakTimer);naturalBreakTimer=0;}};

  function renderNaturalBreak(){
    const timing=slotTiming();
    // Do not cover the next program with a stale ENDED event at the exact handoff.
    if(timing.elapsed<5||timing.remaining<2){clearNaturalBreak();return;}
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
    clearNaturalBreak();
    renderNaturalBreak();
    naturalBreakTimer=setInterval(()=>{
      const timing=slotTiming();
      if(timing.elapsed<3||timing.remaining<=1){clearNaturalBreak();return;}
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
  ["liveButton","startOverButton","rewindButton"].forEach(id=>document.getElementById(id)?.addEventListener("click",clearNaturalBreak,{capture:true}));
  window.CHILLER_NATURAL_END_POLICY={version:"2026-09-16.1",slotSeconds:SLOT_SECONDS,rule:"play-until-real-media-end-then-intermission-until-slot-boundary"};

  const button=document.getElementById("shareButton");
  const status=document.getElementById("shareStatus");
  if(!button||button.dataset.starCoinWired==="1")return;
  button.dataset.starCoinWired="1";

  const parse=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch(_){return fallback;}};

  function fallbackShareCredit(reference){
    const attemptId=`chiller-share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    const session=parse("starquest_session",null);
    const users=parse("starquest_users",{});
    const signedIn=session&&session.key&&users&&users[session.key];
    const profile=signedIn||parse("starquest_guest_profile_v1",{key:"__guest__",username:"Guest",tokens:0,shareCount:0,pendingShareCredits:0,shareEvents:[],ledger:[]});

    profile.tokens=Math.max(0,Number(profile.tokens)||0);
    profile.shareCount=Math.max(0,Number(profile.shareCount)||0)+1;
    profile.pendingShareCredits=Math.max(0,Number(profile.pendingShareCredits)||0)+1;

    let awarded=0;
    while(profile.pendingShareCredits>=10){
      profile.pendingShareCredits-=10;
      profile.tokens+=1;
      awarded+=1;
    }

    const event={id:attemptId,contentId:reference,createdAt:Date.now(),confirmed:true,verified:true,method:"web_share_api"};
    profile.shareEvents=(profile.shareEvents||[]).concat(event).slice(-250);
    profile.ledger=(profile.ledger||[]).concat({id:`tx-${attemptId}`,type:awarded?"share_reward":"share_credit",amount:awarded,balance:profile.tokens,pendingShareCredits:profile.pendingShareCredits,createdAt:Date.now()}).slice(-500);

    if(signedIn){users[session.key]=profile;localStorage.setItem("starquest_users",JSON.stringify(users));}
    else localStorage.setItem("starquest_guest_profile_v1",JSON.stringify(profile));

    return{ok:true,awarded,progressToNextCoin:profile.pendingShareCredits,balance:profile.tokens};
  }

  function creditShare(reference){
    try{
      if(window.ControlPhi&&typeof window.ControlPhi.ensureShareCredit==="function"){
        const result=window.ControlPhi.ensureShareCredit(reference,"web_share_api");
        if(result)return result;
      }
    }catch(_){ }
    return fallbackShareCredit(reference);
  }

  function report(result){
    const awarded=Math.max(0,Number(result&&result.awarded)||0);
    const progress=Math.max(0,Number(result&&result.progressToNextCoin)||0);
    if(status)status.textContent=awarded?"Shared · 1 StarCoin completed!":`Shared · StarCoin progress ${progress}/10`;
    try{window.dispatchEvent(new CustomEvent("starquest:share-progress",{detail:{source:"Chiller",awarded,progressToNextCoin:progress,balance:Number(result&&result.balance)||0}}));}catch(_){ }
    try{window.dispatchEvent(new CustomEvent("controlphi:wallet-change"));}catch(_){ }
  }

  async function shareChiller(){
    const current=document.getElementById("nowTitle")?.textContent?.trim();
    const title=current&&!current.toLowerCase().includes("loading")?`${current} · Chiller`:"Chiller — 1980s Hitchcock & Twilight Zone";
    const share={title,text:current?`Watch ${current} on Chiller.`:"Watch Chiller — synchronized 1980s suspense.",url:location.href};

    if(typeof navigator.share!=="function"){
      try{
        await navigator.clipboard.writeText(share.url);
        if(status)status.textContent="Link copied. Open Android Share to earn 1/10 StarCoin.";
      }catch(_){
        if(status)status.textContent="Sharing is unavailable in this browser.";
      }
      return;
    }

    try{
      await navigator.share(share);
      report(creditShare(share.url));
    }catch(error){
      if(!error||error.name!=="AbortError"){
        if(status)status.textContent="Share did not complete.";
      }
    }
  }

  button.addEventListener("click",shareChiller);
})();
