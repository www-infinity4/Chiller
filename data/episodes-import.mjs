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
const validSource=(value,scope)=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(scope==='episode')return u.hostname==='www.tvmaze.com'&&/^\/episodes\/\d+\/[\w%-]+\/?$/.test(u.pathname);
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
   item.name.length>180||!validSource(item.url,'episode'))fail('invalid_episode_source_or_metadata');
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
