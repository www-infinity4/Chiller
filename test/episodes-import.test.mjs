import test from 'node:test';
import assert from 'node:assert/strict';
import {SERIES,normalizeEpisodeRows,buildEpisodeCatalog} from '../data/episodes-import.mjs';

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
 assert.throws(()=>normalizeEpisodeRows(show,rows.map((x,i)=>i===1?{...x,id:rows[0].id}:x)),/duplicate/i);
 const partial=SERIES.map(x=>({show:{id:x.showId,name:x.title,premiered:'1985-09-29'},rows:episodeRows(x)}));
 partial[0].show.name='Alfred Hitchcock Presents (1955)';
 assert.throws(()=>buildEpisodeCatalog(partial,'2026-11-07T12:00:00.000Z'),/series_identity/i);
});
