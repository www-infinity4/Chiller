import {readFile,writeFile} from 'node:fs/promises';
import {SERIES,buildEpisodeCatalog,reuseUnchangedEpisodeCatalog,verifyStoredEpisodeCatalog} from '../data/episodes-import.mjs';

const origin='https://api.tvmaze.com';
const headers={'Accept':'application/json','User-Agent':'QuantaPhi-Chiller-EpisodeCatalog/1.0 (https://github.com/www-infinity4/Chiller)'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const temporarySourceError=(code)=>Object.assign(Error(code),{sourceUnavailable:true});
async function readJson(path){
 const url=origin+path;
 for(let attempt=0;attempt<3;attempt++){
  let response;
  try{response=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});}
  catch{throw temporarySourceError('tvmaze_network_unavailable '+path);}
  if(response.status===429&&attempt<2){await delay(3000*(attempt+1));continue}
  if(response.status===429||response.status>=500)
   throw temporarySourceError('tvmaze_temporarily_unavailable_'+response.status+' '+path);
  if(!response.ok)throw Error('tvmaze_http_'+response.status+' '+path);
  const data=await response.json();
  if(!data)throw Error('tvmaze_empty_response '+path);
  return data;
 }
 throw temporarySourceError('tvmaze_rate_limit '+path);
}
const output=new URL('../episodes.json',import.meta.url);
let previous=null;
try{previous=JSON.parse(await readFile(output,'utf8'));}catch{/* Bootstrap or fail closed if no trusted snapshot exists. */}
let refreshed;
try{
 const sources=[];
 for(const series of SERIES){
  // Exact numeric TVmaze show ID only; never import a fuzzy/mismatched era.
  const show=await readJson('/shows/'+series.showId);
  const rows=await readJson('/shows/'+series.showId+'/episodes');
  sources.push({show,rows});
 }
 refreshed=buildEpisodeCatalog(sources);
}catch(error){
 // Only upstream network/429/5xx outages may use the previously verified
 // exact metadata snapshot. Invalid source identity, altered rights or a
 // partial catalog are failures, never excuses to publish stale as fresh.
 if(error?.sourceUnavailable!==true)throw error;
 verifyStoredEpisodeCatalog(previous);
 console.warn('SOURCE_REFRESH_DEFERRED: upstream TVmaze not reachable; independently revalidated the prior 190-story metadata snapshot. No new freshness claim or playback rights.');
 refreshed=previous;
}
const catalog=reuseUnchangedEpisodeCatalog(refreshed,previous);
if(catalog.totalStories!==190||catalog.shows.some(x=>x.scheduleEnabled!==false))
 throw Error('catalog_completeness_or_player_policy_failed');
await writeFile(output,JSON.stringify(catalog,null,2)+'\n','utf8');
for(const s of catalog.shows)console.log(s.title+': '+s.storyCount+' TVmaze story segments · metadata only');
console.log('Chiller episodes.json: '+catalog.totalStories+' attributed stories · playback not enabled');
