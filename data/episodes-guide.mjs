/* Chiller episode RESEARCH guide, distinct from authorized on-air video
 * sources. Pure helpers for Node tests and Android/browser UI. */
import {verifyStoredEpisodeCatalog,SERIES} from './episodes-import.mjs';

export const EPISODE_PAGE_SIZE=20;
const idSet=new Set(SERIES.map(x=>x.slug));
const normalize=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase('en').slice(0,100);

export function validateGuideCatalog(catalog){
 try{return verifyStoredEpisodeCatalog(catalog)}
 catch{throw Error('invalid_episode_guide_catalog')}
}

export function selectEpisodePage(catalog,options={}){
 validateGuideCatalog(catalog);
 const series=options.series||'all';
 if(series!=='all'&&!idSet.has(series))throw Error('invalid_series_selection');
 const search=normalize(options.search);
 const offset=Number.isSafeInteger(options.offset)?Math.max(0,options.offset):0;
 const filtered=catalog.shows.flatMap(show=>series!=='all'&&series!==show.id?[]:
  show.stories.map(story=>({
   id:story.id,title:story.title,
   season:story.season,storyNumber:story.storyNumber,
   aired:story.aired,seriesTitle:show.title,seriesId:show.id,
   sourceUrl:story.sourceUrl,playbackStatus:'metadata_only'
  }))).filter(story=>!search||
    normalize(story.title).includes(search)||
    normalize(story.seriesTitle).includes(search)||
    normalize('season '+story.season+' episode '+story.storyNumber).includes(search));
 const items=filtered.slice(offset,offset+EPISODE_PAGE_SIZE);
 return {
  total:filtered.length,offset,items,
  nextOffset:offset+items.length<filtered.length&&items.length?offset+items.length:null
 };
}
