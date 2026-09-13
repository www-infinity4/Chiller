(function(){
  "use strict";
  const rows=[
    ["The Bride Possessed",1560,"P99zuiCACuI","One Step Beyond","1959","TV-PG","PizzaFlix"],
    ["The Dead Part of the House",1560,"3T6JrQRUlj8","One Step Beyond","1959","TV-PG","One-Step-Beyond"],
    ["The Aerialist",1560,"wYnPJWQaVyc","One Step Beyond","1959","TV-PG","One-Step-Beyond"],
    ["The Haunted U-Boat",1560,"5Cxna5wjK-s","One Step Beyond","1959","TV-PG","Public-domain episode source"],
    ["Image of Death",1560,"QcR0i0GRJBo","One Step Beyond","1959","TV-PG","Public-domain episode source"],
    ["The Captain's Guests",1560,"9BTxGscf1Og","One Step Beyond","1959","TV-PG","One-Step-Beyond"],
    ["The Vision",1560,"kIqf8A8QjLE","One Step Beyond","1959","TV-PG","Public-domain episode source"],
    ["The Hand",1560,"tQBuGxs6sk0","One Step Beyond","1959","TV-PG","Public-domain episode source"],
    ["Make Me Not a Witch",1560,"_JIeTyBBJ5M","One Step Beyond","1959","TV-PG","Public-domain episode source"],
    ["Dead Ernest",1620,"cewUIQsW2B4","Suspense","1949","TV-PG","PizzaFlix"],
    ["Vision of Crime",1680,"01s2RCeERDs","The Veil with Boris Karloff","1958","TV-PG","Public-domain episode source"]
  ];
  const blocked=/\b(r-rated|rated r|nc-17|explicit|uncut gore)\b/i;
  if(rows.some(r=>blocked.test(r.join(" "))))throw new Error("Chiller catalog rejected restricted programming");
  window.CHILLER_CATALOG=rows.map((r,i)=>({
    id:"CHILLER-"+String(i+1).padStart(3,"0"),title:r[0],runtimeSeconds:r[1],videoId:r[2],series:r[3],year:r[4],rating:r[5],source:r[6],
    posterUrl:"https://i.ytimg.com/vi/"+r[2]+"/hqdefault.jpg",cleared:true
  }));
  window.CHILLER_POLICY={slotSeconds:1800,dayChange:"viewer-local-midnight",ratingCeiling:"TV-PG / non-R feature material",fallbackBreakSeconds:300};
})();