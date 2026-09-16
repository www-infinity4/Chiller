(function(){
  "use strict";

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
