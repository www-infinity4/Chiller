// Metadata-only import contract for the two 1985-1989 Chiller anthologies.
// Attribution: TVmaze API, CC BY-SA. No episode listing conveys video rights.
export const SERIES=Object.freeze([
 Object.freeze({slug:'alfred-hitchcock-presents-1985',showId:18364,
  title:'The New Alfred Hitchcock Presents',firstYear:1985,lastYear:1989,
  seasonCount:4,expectedStories:80}),
 Object.freeze({slug:'twilight-zone-1985',showId:3289,
  title:'The Twilight Zone',firstYear:1985,lastYear:1989,
  seasonCount:3,expectedStories:110})
]);
const fail=code=>{throw Error(code)};
const integer=value=>Number.isSafeInteger(value)&&value>0;
const validSource=(value,scope,episodeId=null)=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(scope==='episode'){
   const matched=u.pathname.match(/^\/episodes\/([1-9]\d*)\/[\w%-]+\/?$/);
   // Exact TVmaze episode provenance: a different legitimate episode page
   // cannot be attached to this story, and query/hash redirects are not
   // canonical record URLs.
   return u.hostname==='www.tvmaze.com'&&!u.search&&!u.hash&&
    matched!==null&&Number(matched[1])===episodeId;
  }
  if(scope==='image')return u.hostname==='static.tvmaze.com'&&u.pathname.startsWith('/uploads/images/');
  return false;
 }catch{return false}
};
export function normalizeEpisodeRows(series,rows){
 if(!SERIES.some(x=>x.showId===series?.showId)||!Array.isArray(rows)||
    rows.length!==series.expectedStories)fail('incomplete_1985_series_catalog');
 const seenIds=new Set(),seenSlots=new Set();
 const normalized=rows.map(item=>{
  if(!integer(item?.id)||!integer(item?.season)||item.season>series.seasonCount||
   !integer(item?.number)||typeof item.name!=='string'||!item.name.trim()||
   item.name.length>180||!validSource(item.url,'episode',item.id))fail('invalid_episode_source_or_metadata');
  if(typeof item.airdate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.airdate)||
   Number(item.airdate.slice(0,4))<series.firstYear||
   Number(item.airdate.slice(0,4))>series.lastYear||
   Number.isNaN(Date.parse(item.airdate+'T00:00:00Z')))fail('wrong_1985_revived_series_era');
  const slot=item.season+'/'+item.number;
  if(seenIds.has(item.id)||seenSlots.has(slot))fail('duplicate_episode_story');
  seenIds.add(item.id);seenSlots.add(slot);
  const image=item.image?.medium;
  return {
   id:series.slug+'-'+item.id,
   tvmazeId:item.id,
   season:item.season,
   storyNumber:item.number,
   title:item.name.trim(),
   aired:item.airdate,
   runtimeMinutes:integer(item.runtime)&&item.runtime<=180?item.runtime:null,
   sourceUrl:item.url,
   imageUrl:validSource(image,'image')?image:null,
   imageCredit:'TVmaze · CC BY-SA',
   playbackStatus:'metadata_only'
  };
 });
 return normalized.sort((a,b)=>a.season-b.season||a.storyNumber-b.storyNumber);
}
export function buildEpisodeCatalog(sources,generatedAt=new Date().toISOString()){
 if(!Array.isArray(sources)||sources.length!==SERIES.length||
  !Number.isFinite(Date.parse(generatedAt)))fail('invalid_catalog_sources');
 const shows=SERIES.map(series=>{
  const entries=sources.filter(x=>x?.show?.id===series.showId);
  if(entries.length!==1||entries[0].show.name!==series.title||
   !String(entries[0].show.premiered||'').startsWith('1985-'))fail('series_identity_or_era_mismatch');
  const stories=normalizeEpisodeRows(series,entries[0].rows);
  return {id:series.slug,title:series.title,tvmazeShowId:series.showId,
   years:[series.firstYear,series.lastYear],storyCount:stories.length,
   sourceUrl:'https://www.tvmaze.com/shows/'+series.showId,
   scheduleEnabled:false,stories};
 });
 return {schemaVersion:1,generatedAt,source:'TVmaze',sourceApi:'https://www.tvmaze.com/api',
  license:'CC BY-SA 4.0',attribution:'TVmaze episode data used under CC BY-SA; link to TVmaze is required',
  playbackRightsVerified:false,
  usage:'Research catalog only; do not add entries to Chiller autoplay without a separately authorized full-length source',
  totalStories:shows.reduce((count,show)=>count+show.stories.length,0),shows};
}

// Retain the exact prior JSON when upstream episode metadata has not changed.
// A fresh collection timestamp alone is NOT a new source revision; producing
// a bot-authored no-op commit on every push makes human-reviewed PRs harder to
// verify and can trigger GitHub's bot-workflow approval gate.
export function reuseUnchangedEpisodeCatalog(candidate,previous){
 if(!candidate||candidate.playbackRightsVerified!==false||
    !previous||previous.playbackRightsVerified!==false||
    typeof previous.generatedAt!=='string'||
    !Number.isFinite(Date.parse(previous.generatedAt)))return candidate;
 const {generatedAt:latestAt,...latest}=candidate;
 const {generatedAt:priorAt,...old}=previous;
 return JSON.stringify(latest)===JSON.stringify(old)?previous:candidate;
}

// Offline source-outage fallback may use an already committed snapshot only
// after reconstructing it through the SAME strict 1985-series validator.
// No video IDs, invented streaming rights, mixed eras or changed provenance
// survive the canonical byte-for-byte structure check.
export function verifyStoredEpisodeCatalog(stored){
 if(!stored||!Array.isArray(stored.shows)||stored.shows.length!==SERIES.length||
    stored.playbackRightsVerified!==false||stored.totalStories!==190||
    typeof stored.generatedAt!=='string')fail('cached_catalog_invalid');
 try{
  const sources=SERIES.map(series=>{
   const show=stored.shows.find(x=>x?.tvmazeShowId===series.showId);
   if(!show||!Array.isArray(show.stories))fail('cached_catalog_invalid');
   return {
    show:{id:series.showId,name:series.title,premiered:'1985-09-29'},
    rows:show.stories.map(item=>({
     id:item.tvmazeId,season:item.season,number:item.storyNumber,
     name:item.title,airdate:item.aired,url:item.sourceUrl,
     runtime:item.runtimeMinutes,image:{medium:item.imageUrl}
    }))
   };
  });
  const generated=buildEpisodeCatalog(sources,stored.generatedAt);
  if(JSON.stringify(generated)!==JSON.stringify(stored))fail('cached_catalog_invalid');
  return true;
 }catch{fail('cached_catalog_invalid')}
}
