/* Chiller 1985–1989 anthology research guide.
 * Metadata only. Never imports any catalog title into the TV/player schedule. */
import {selectEpisodePage,validateGuideCatalog} from './data/episodes-guide.mjs';

const root=document.getElementById('episodeGuide');
if(root){
 const byId=id=>document.getElementById(id);
 const series=byId('episodeSeries');
 const search=byId('episodeSearch');
 const results=byId('episodeGuideResults');
 const status=byId('episodeGuideStatus');
 const more=byId('episodeGuideMore');
 let catalog=null,offset=0,matchedCount=0;
 const make=(tag,cls,value)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(value!==undefined)el.textContent=String(value);
  return el;
 };
 function render(reset=false){
  if(!catalog)return;
  if(reset){offset=0;results.replaceChildren();}
  let page;
  try{page=selectEpisodePage(catalog,{series:series.value,search:search.value,offset})}
  catch{
   status.textContent='Episode guide data could not be verified.';
   more.hidden=true;return;
  }
  matchedCount=page.total;
  const fragment=document.createDocumentFragment();
  for(const episode of page.items){
   const card=make('article','episode-research-card');
   card.append(
    make('p','episode-research-series',episode.seriesTitle),
    make('h3','episode-research-title',episode.title),
    make('p','episode-research-meta','Season '+episode.season+' · Story '+episode.storyNumber+' · '+episode.aired),
    make('p','episode-research-policy','Research record · Not a licensed video')
   );
   const source=make('a','episode-research-source','View original TVmaze episode record');
   source.href=episode.sourceUrl;
   source.target='_blank';
   source.rel='noopener noreferrer';
   card.append(source);
   fragment.append(card);
  }
  results.append(fragment);
  offset+=page.items.length;
  more.hidden=page.nextOffset===null;
  status.textContent=matchedCount?
   'Showing '+offset+' of '+matchedCount+' verified episode records. Metadata only; these records are not playable videos.':
   'No matching episode records. Try another title or series.';
 }
 series.addEventListener('change',()=>render(true));
 search.addEventListener('input',()=>render(true));
 more.addEventListener('click',()=>render(false));
 status.textContent='Loading 1985–1989 episode research records…';
 more.hidden=true;
 try{
  const response=await fetch('./episodes.json',{cache:'no-store'});
  if(!response.ok)throw Error('catalog_http_'+response.status);
  const data=await response.json();
  validateGuideCatalog(data);
  catalog=data;
  render(true);
 }catch{
  status.textContent='Episode catalog unavailable or not verified. On-air Chiller remains separate.';
  more.hidden=true;
 }
}
