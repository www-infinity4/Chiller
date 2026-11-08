import test from 'node:test';
import assert from 'node:assert/strict';
import {SERIES,normalizeEpisodeRows,buildEpisodeCatalog,reuseUnchangedEpisodeCatalog} from '../data/episodes-import.mjs';

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
