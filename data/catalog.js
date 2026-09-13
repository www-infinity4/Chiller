(function(){
  "use strict";

  /*
    Chiller programming identity:
    - Core rotation = 1980s Alfred Hitchcock Presents + The Twilight Zone (1985).
    - English-language playback only in the live pool.
    - Older black-and-white material is not allowed to take over the schedule.
    - A full Hitchcock feature may be used only as an occasional feature block when
      the scheduler can keep the complete movie continuous; never chop a film into a
      random half-hour slot.
  */
  const rows=[
    {
      id:"CHILLER-AHP-1985-UNLOCKED-WINDOW",
      title:"An Unlocked Window",
      runtimeSeconds:1320,
      videoId:"YD5xBeGeX5w",
      series:"Alfred Hitchcock Presents (1985)",
      family:"hitchcock-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"Brett Peake · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-AHP-1985-NIGHT-CALLER",
      title:"The Night Caller",
      runtimeSeconds:1320,
      videoId:"pHJJY4HYYMQ",
      series:"Alfred Hitchcock Presents (1985)",
      family:"hitchcock-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"Brett Peake · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-AHP-1985-REVENGE",
      title:"Revenge",
      runtimeSeconds:1320,
      videoId:"HM_I8T3J0xE",
      series:"Alfred Hitchcock Presents (1985)",
      family:"hitchcock-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"Brett Peake · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-AHP-1985-PILOT-STORY",
      title:"Alfred Hitchcock Presents — 1985 Story",
      runtimeSeconds:1320,
      videoId:"XCbTyjkLT1w",
      series:"Alfred Hitchcock Presents (1985)",
      family:"hitchcock-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"Watercooler Films · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-TZ-1985-PEACE-QUIET",
      title:"A Little Peace and Quiet",
      runtimeSeconds:1320,
      videoId:"Or1UX7z8YBM",
      series:"The Twilight Zone (1985)",
      family:"twilight-zone-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"vson8 · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-TZ-1985-NIGHTCRAWLERS",
      title:"Nightcrawlers",
      runtimeSeconds:1440,
      videoId:"5EVR17FgTQg",
      series:"The Twilight Zone (1985)",
      family:"twilight-zone-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"Space Junk Films · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-TZ-1985-EXAMINATION-DAY",
      title:"Examination Day",
      runtimeSeconds:900,
      videoId:"lrz_bDy71h8",
      series:"The Twilight Zone (1985)",
      family:"twilight-zone-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"David Ullrich · YouTube",
      language:"English"
    },
    {
      id:"CHILLER-TZ-1985-MESSAGE-CHARITY",
      title:"A Message from Charity",
      runtimeSeconds:1440,
      videoId:"ar-p3ika3kU",
      series:"The Twilight Zone (1985)",
      family:"twilight-zone-1980s",
      year:"1985",
      rating:"TV-PG",
      source:"David Ullrich · YouTube",
      language:"English"
    }
  ];

  const blocked=/\b(r-rated|rated r|nc-17|explicit|uncut gore)\b/i;
  if(rows.some(r=>blocked.test(Object.values(r).join(" "))))throw new Error("Chiller catalog rejected restricted programming");

  window.CHILLER_CATALOG=rows.map(item=>({
    ...item,
    posterUrl:`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
  }));

  window.CHILLER_FEATURES=[
    {
      id:"CHILLER-FEATURE-BLACKMAIL-1929",
      title:"Blackmail",
      year:"1929",
      director:"Alfred Hitchcock",
      runtimeSeconds:5100,
      videoId:"k8gq-GjMEPo",
      rating:"NR / classic suspense",
      source:"Artflix - Movie Classics · licensed YouTube presentation",
      language:"English",
      blackAndWhite:true,
      scheduleRule:"rare-full-feature-only"
    }
  ];

  window.CHILLER_POLICY={
    slotSeconds:1800,
    dayChange:"viewer-local-midnight",
    coreFamilies:["hitchcock-1980s","twilight-zone-1980s"],
    language:"English",
    ratingCeiling:"TV-PG / non-R feature material",
    blackAndWhiteRule:"rare Hitchcock feature only; do not flood the daily anthology rotation",
    featureRule:"full continuous feature blocks only; never cut a movie into an arbitrary half-hour",
    fallbackBreakSeconds:300
  };
})();
