import test from 'node:test';
import assert from 'node:assert/strict';
import {SERIES,normalizeEpisodeRows,buildEpisodeCatalog,reuseUnchangedEpisodeCatalog,verifyStoredEpisodeCatalog} from '../data/episodes-import.mjs';

function episodeRows(show,index=0){
 return Array.from({length:show.expectedStories},(_,n)=>({
  id:100000*show.showId+n+index+1,
  name:'Verified fixture episode '+(n+1),
  season:(n%show.seasonCount)+1,
  number:Math.floor(n/show.seasonCount)+1,
  airdate:'1985-10-01',
  url:'https://www.tvmaze.com/episodes/'+(100000*show.showId+n+index+1)+'/fixture',
  runtime:24,
  image:{medium:'https://static.tvmaze.com/uploads/images/medium_landscape/1/1.jpg'}
 }));
}

test('the Chiller metadata importer targets the exact 1985 revivals, never 1955 or 1959 originals',()=>{
 assert.deepEqual(SERIES.map(x=>x.showId),[18364,3289]);
 assert.deepEqual(SERIES.map(x=>x.expectedStories),[80,110]);
 assert.ok(SERIES.every(x=>x.firstYear===1985&&x.lastYear===1989));
});

test('all 190 source-backed 1980s story segments normalize without copying any alleged full video',()=>{
 const sources=SERIES.map(x=>({show:{id:x.showId,name:x.title,premiered:'1985-09-29'},
  rows:episodeRows(x)}));
 const catalog=buildEpisodeCatalog(sources,'2026-11-07T12:00:00.000Z');
 assert.equal(catalog.totalStories,190);
 assert.deepEqual(catalog.shows.map(x=>x.stories.length),[80,110]);
 assert.equal(catalog.license,'CC BY-SA 4.0');
 assert.equal(catalog.playbackRightsVerified,false);
 assert.ok(catalog.shows.every(x=>x.stories.every(y=>!('videoId'in y)&&y.playbackStatus==='metadata_only')));
 assert.equal(catalog.shows[0].stories[0].sourceUrl,'https://www.tvmaze.com/episodes/1836400001/fixture');
 assert.equal(catalog.shows[0].stories[0].imageUrl,'https://static.tvmaze.com/uploads/images/medium_landscape/1/1.jpg');
});

test('incomplete series, off-era titles, forged source URLs and duplicate story identifiers fail closed',()=>{
 const show=SERIES[0],rows=episodeRows(show);
 assert.throws(()=>normalizeEpisodeRows(show,rows.slice(1)),/incomplete/i);
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((x,i)=>i===0?{...x,airdate:'1959-10-02'}:x)),/era/i);
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((x,i)=>i===0?{...x,url:'https://tvmaze.com.attacker.example/episodes/1'}:x)),/source/i);
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((x,i)=>i===1?{...x,id:rows[0].id,url:rows[0].url}:x)),/duplicate/i);
 const partial=SERIES.map(x=>({show:{id:x.showId,name:x.title,premiered:'1985-09-29'},rows:episodeRows(x)}));
 partial[0].show.name='Alfred Hitchcock Presents (1955)';
 assert.throws(()=>buildEpisodeCatalog(partial,'2026-11-07T12:00:00.000Z'),/series_identity/i);
});

test('each TVmaze link must resolve to its own original story ID with no tracking or redirect suffix',()=>{
 const show=SERIES[0],rows=episodeRows(show);
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((r,i)=>i===0?{...r,url:rows[1].url}:r)),/source/i,
  'a valid TVmaze link for a different episode must never pass provenance validation');
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((r,i)=>i===0?{...r,url:r.url+'?url=https://example.invalid'}:r)),/source/i,
  'a source URL with arbitrary query parameters must not become a canonical trusted link');
});

test('refreshing the same 190 episodes never produces a new timestamp-only bot commit',()=>{
 const sources=SERIES.map(x=>({show:{id:x.showId,name:x.title,premiered:'1985-09-29'},rows:episodeRows(x)}));
 const first=buildEpisodeCatalog(sources,'2026-11-07T18:00:00.000Z');
 const refreshed=buildEpisodeCatalog(sources,'2026-11-08T05:00:00.000Z');
 assert.equal(reuseUnchangedEpisodeCatalog(refreshed,first),first,
  'source-identical data must preserve the previous catalog and timestamp byte-for-byte');
 assert.equal(reuseUnchangedEpisodeCatalog(refreshed,null),refreshed);
 const edited=buildEpisodeCatalog(SERIES.map((x,i)=>({
  show:{id:x.showId,name:x.title,premiered:'1985-09-29'},
  rows:episodeRows(x).map((v,j)=>i===0&&j===0?{...v,name:'Revised story metadata'}:v)
 })),'2026-11-08T05:00:00.000Z');
 assert.equal(reuseUnchangedEpisodeCatalog(edited,first),edited,'real edits must create a new catalog');
 assert.equal(reuseUnchangedEpisodeCatalog(refreshed,{...first,playbackRightsVerified:true}),refreshed,
  'cannot retain an unsafe previous catalog simply to avoid a bot commit');
});

test('an upstream outage can reuse only an independently validated 190-story, metadata-only snapshot',()=>{
 const sources=SERIES.map(x=>({show:{id:x.showId,name:x.title,premiered:'1985-09-29'},rows:episodeRows(x)}));
 const snapshot=buildEpisodeCatalog(sources,'2026-11-07T18:00:00.000Z');
 assert.equal(verifyStoredEpisodeCatalog(snapshot),true);
 const clone=()=>JSON.parse(JSON.stringify(snapshot));
 const forbidden=clone();forbidden.shows[0].stories[0].videoId='fake-stream';
 assert.throws(()=>verifyStoredEpisodeCatalog(forbidden),/cached_catalog/i);
 const wrong=clone();wrong.shows[0].stories[0].sourceUrl=wrong.shows[0].stories[1].sourceUrl;
 assert.throws(()=>verifyStoredEpisodeCatalog(wrong),/cached_catalog|source/i);
 const incomplete=clone();incomplete.shows[1].stories.pop();
 assert.throws(()=>verifyStoredEpisodeCatalog(incomplete),/cached_catalog|incomplete/i);
 const promoted=clone();promoted.playbackRightsVerified=true;
 assert.throws(()=>verifyStoredEpisodeCatalog(promoted),/cached_catalog/i);
 const wrongEra=clone();wrongEra.shows[0].stories[0].aired='1955-10-02';
 assert.throws(()=>verifyStoredEpisodeCatalog(wrongEra),/cached_catalog|era/i);
});

test('stored Chiller catalog safely powers a 20-at-a-time guide, not an autoplay list',async()=>{
 const {readFileSync}=await import('node:fs');
 const {selectEpisodePage,validateGuideCatalog}=await import('../data/episodes-guide.mjs');
 const catalog=JSON.parse(readFileSync(new URL('../episodes.json',import.meta.url),'utf8'));
 assert.equal(validateGuideCatalog(catalog),true);
 const all=selectEpisodePage(catalog,{series:'all',search:'',offset:0});
 assert.equal(all.total,190);assert.equal(all.items.length,20);assert.equal(all.nextOffset,20);
 assert.ok(all.items.every(x=>x.playbackStatus==='metadata_only'&&!Object.hasOwn(x,'videoId')));
 assert.ok(all.items.every(x=>x.sourceUrl.startsWith('https://www.tvmaze.com/episodes/')));
 const last=selectEpisodePage(catalog,{series:'all',search:'',offset:180});
 assert.equal(last.items.length,10);assert.equal(last.nextOffset,null);
 const hitch=selectEpisodePage(catalog,{series:'alfred-hitchcock-presents-1985'});
 assert.equal(hitch.total,80);assert.ok(hitch.items.every(x=>x.seriesId==='alfred-hitchcock-presents-1985'));
 const twilight=selectEpisodePage(catalog,{series:'twilight-zone-1985'});
 assert.equal(twilight.total,110);assert.ok(twilight.items.every(x=>x.seriesId==='twilight-zone-1985'));
 const lookup=selectEpisodePage(catalog,{search:'Shatterday'});
 assert.equal(lookup.total,1);assert.equal(lookup.items[0].title,'Shatterday');
 assert.equal(selectEpisodePage(catalog,{search:'thereisnoepisodebythisname'}).total,0);
 assert.equal(selectEpisodePage(catalog,{offset:-100}).items.length,20);
 assert.equal(selectEpisodePage(catalog,{offset:999999}).items.length,0);
 assert.throws(()=>selectEpisodePage(catalog,{series:'unknown-series'}),/series/i);
});

test('Chiller guide rejects a catalog if any episode claims unlicensed playback',async()=>{
 const {readFileSync}=await import('node:fs');
 const {validateGuideCatalog}=await import('../data/episodes-guide.mjs');
 const base=JSON.parse(readFileSync(new URL('../episodes.json',import.meta.url),'utf8'));
 const injected=structuredClone(base);
 injected.shows[0].stories[0].videoId='unsafe-video';
 assert.throws(()=>validateGuideCatalog(injected),/invalid|catalog/i);
 const link=structuredClone(base);
 link.shows[0].stories[0].sourceUrl='https://www.tvmaze.com/episodes/999999/imposter';
 assert.throws(()=>validateGuideCatalog(link),/invalid|catalog/i);
});

test('the Chiller channel mounts a separate source-attributed episode guide without loading the catalog into the player',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../episodes-guide.js',import.meta.url),'utf8');
 const player=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(html,/id="episodeGuide"/);
 assert.match(html,/id="episodeSeries"/);
 assert.match(html,/id="episodeSearch"/);
 assert.match(html,/id="episodeGuideResults"/);
 assert.match(html,/episodes-guide\.js\?v=/);
 assert.match(html,/Episode research guide/);
 assert.match(js,/episodes\.json/);
 assert.match(js,/textContent/);
 assert.match(js,/TVmaze/);
 assert.doesNotMatch(player,/episodes\.json|episodeGuideResults|sourceUrl/);
});

test('the Chiller episode guide is accessible and readable at 360px without changing on-air scheduling',async()=>{
 const {readFileSync}=await import('node:fs');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const script=readFileSync(new URL('../episodes-guide.js',import.meta.url),'utf8');
 assert.match(html,/aria-labelledby="episodeGuideTitle"/);
 assert.match(html,/for="episodeSeries"/);
 assert.match(html,/for="episodeSearch"/);
 assert.match(html,/id="episodeGuideStatus"[^>]*role="status"/);
 assert.match(html,/Episode records, not licensed videos|episode records, not licensed videos/i);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.episode-research-controls,\.episode-research-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.episode-research-controls select,\.episode-research-controls input\{font-size:18px\}/);
 assert.match(script,/selectEpisodePage\(catalog/);
 assert.match(script,/\.replaceChildren\(\)/);
 assert.match(script,/\.textContent=/);
 assert.doesNotMatch(script,/innerHTML|loadVideoById|YT\.Player|window\.CHILLER_CATALOG/);
});
