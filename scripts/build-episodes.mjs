import {writeFile} from 'node:fs/promises';
import {SERIES,buildEpisodeCatalog} from '../data/episodes-import.mjs';

const origin='https://api.tvmaze.com';
const headers={'Accept':'application/json','User-Agent':'QuantaPhi-Chiller-EpisodeCatalog/1.0 (https://github.com/www-infinity4/Chiller)'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readJson(path){
 const url=origin+path;
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
  if(response.status===429&&attempt<2){await delay(3000*(attempt+1));continue}
  if(!response.ok)throw Error('tvmaze_http_'+response.status+' '+path);
  const data=await response.json();
  if(!data)throw Error('tvmaze_empty_response '+path);
  return data;
 }
 throw Error('tvmaze_rate_limit '+path);
}
const sources=[];
for(const series of SERIES){
 // Pin the numeric show ID, never accept a fuzzy title match or another era.
 const show=await readJson('/shows/'+series.showId);
 const rows=await readJson('/shows/'+series.showId+'/episodes');
 sources.push({show,rows});
}
const catalog=buildEpisodeCatalog(sources);
if(catalog.totalStories!==190||catalog.shows.some(x=>x.scheduleEnabled!==false))
 throw Error('catalog_completeness_or_player_policy_failed');
await writeFile(new URL('../episodes.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n','utf8');
for(const s of catalog.shows)console.log(s.title+': '+s.storyCount+' TVmaze story segments · metadata only');
console.log('Chiller episodes.json: '+catalog.totalStories+' attributed stories · playback not enabled');
