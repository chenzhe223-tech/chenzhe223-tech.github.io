'use strict';
/* Curated discovery acceptance: no synthetic news, no unlicensed adaptation,
 * official source links, real storyboard evidence, 32/36/32 ranking and cache injection. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(base,'editorial-series.json'),'utf8'));
assert.equal(data.schema,'davylab.worldtoon.curated-discovery.v1');
assert.ok(data.sources.literary_series.length>=12);
assert.ok(data.sources.nobel_literature.length>=6);
assert.ok(data.sources.academic_events.length>=8);
const expectedConferenceEndDates={
 'academic-visual-plasticity':'2027-03-09',
 'academic-material-discovery':'2027-03-16',
 'academic-land-plants':'2027-03-23'
};
const events=data.sources.academic_events;
for(const [id,end] of Object.entries(expectedConferenceEndDates)){
 const row=events.find(x=>x.id===id);
 assert.ok(row,'Royal Society official event missing '+id);
 assert.equal(row.event_end_date,end,'Multi-day event end date is incorrect: '+id);
}
const han=data.sources.nobel_literature.find(x=>x.id==='nobel-2024-human-acts');
assert.equal(han.url,'https://www.nobelprize.org/prizes/literature/2024/han/interview/','Han Kang official source must discuss the actual work');
const urls=new Set(),names=new Set();
for(const [source,items] of Object.entries(data.sources)){
 for(const x of items){
  assert.equal(x.source_id,source);
  assert.ok(x.title&&x.summary&&x.why&&x.url&&x.rights_note);
  assert.ok(Array.isArray(x.story_beats)&&x.story_beats.length>=3);
  assert.ok(Array.isArray(x.series_episodes)&&x.series_episodes.length>=3);
  assert.ok(!urls.has(x.url),x.url+' duplicated URL');urls.add(x.url);
  assert.ok(!names.has(x.id),x.id+' duplicate id');names.add(x.id);
  if(source==='literary_series')assert.match(x.url,/^https:\/\/www\.gutenberg\.org\/ebooks\/\d+$/);
  if(source==='nobel_literature'){
   assert.match(x.url,/^https:\/\/www\.nobelprize\.org\//);
   assert.equal(x.rights_status,'copyright_permission_required');
  }
  if(source==='academic_events'){
   assert.match(x.eventDate,/^\d{4}-\d{2}-\d{2}$/);
   assert.ok(x.event_end_date>=x.eventDate);
  }
 }
}
const rank={};
vm.runInNewContext(fs.readFileSync(path.join(base,'ranking.js'),'utf8'),{window:rank,console,Date});
const evaluator=rank.wtEditorialRank;
assert.equal(evaluator.weights.heat,.32);assert.equal(evaluator.weights.impact,.36);assert.equal(evaluator.weights.drawability,.32);
const tested=Object.values(data.sources).flat().map(x=>({title:x.title,score:evaluator.evaluate(x,{now:Date.parse('2026-11-11T00:00:00Z')})}));
const high=tested.filter(x=>x.score.overall>=80),strong=tested.filter(x=>x.score.overall>=70);
console.log('editorial scores',JSON.stringify({total:tested.length,strong70:strong.length,high80:high.length,leaders:tested.slice().sort((a,b)=>b.score.overall-a.score.overall).slice(0,5).map(x=>[x.title,x.score.overall])}));
assert.ok(strong.length>=8,'Story evidence should produce multiple meaningful high-value candidates without fixed score injection');
assert.ok(high.length>=1,'At least one thoroughly researched book should exceed 80 rule points');
assert.ok(tested.every(x=>x.score.factChecked===false&&x.score.sourceVerified===false),'Pre-rating must not claim independent verification');
const worker=fs.readFileSync(path.join(base,'worker.js'),'utf8');
const backups=new Map();
const DB={prepare(sql){return {args:[],bind(...args){this.args=args;return this},async all(){return {results:[...backups].map(([source,v])=>({source,payload:v, item_count:JSON.parse(v).items.length,collected_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),last_error:null}))}},async first(){return null},async run(){if(sql.startsWith('INSERT INTO wt_discovery_snapshots')){backups.set(this.args[0],this.args[1]);return {success:true}};return {success:true}}}}};
const fetch=async url=>{
 if(String(url).endsWith('/editorial-series.json'))return new Response(JSON.stringify(data),{status:200});
 throw Error('Unexpected outbound request '+url);
};
const sandbox={URL,URLSearchParams,Response,Headers,AbortSignal,fetch,Date,TextEncoder,console,crypto:require('node:crypto').webcrypto};
vm.runInNewContext(worker.replace('export default {async fetch(','const workerExport={async fetch(')+'\nglobalThis.testEditorial={editorialDiscover,wtDiscoveryRead,wtRefreshOneSource};',sandbox);
(async()=>{
 for(const source of Object.keys(data.sources)){
  const res=await sandbox.testEditorial.editorialDiscover(source),doc=await res.json();
  assert.equal(res.status,200,JSON.stringify(doc));
  assert.ok(doc.items.length>=6,source);
  assert.ok(doc.items.every(x=>x.rights_cleared===false&&!x.fact_checked));
  const done=await sandbox.testEditorial.wtRefreshOneSource({DB},source);
  assert.equal(done.ok,true,JSON.stringify(done));
 }
 const catalog=await(await sandbox.testEditorial.wtDiscoveryRead({DB},new URL('https://example.org/api/comic/catalog?source=all&limit=500'))).json();
 assert.equal(catalog.ready,true);
 for(const key of Object.keys(data.sources))assert.ok(catalog.items.some(x=>x.cache_source===key),key+' missing in all view');
 assert.equal(catalog.schema,'davylab.worldtoon.catalog.v3');
 const sourceRows=catalog.items.filter(x=>x.cache_source==='nobel_literature');
 assert.ok(sourceRows.every(x=>x.rights_status==='copyright_permission_required'));
 console.log('PASS: curated 3 sources, future event expiry, copyright flags, three-source D1 snapshots and balanced all-source browse');
})().catch(err=>{console.error(err);process.exitCode=1});
