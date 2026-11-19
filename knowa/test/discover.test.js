import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{handleAsk} from '../src/index.js';
import {discoveryItems, orderedDiscovery, discoveryBatch, discoveryAnswer} from '../src/discover.js';
const req=q=>new Request('https://knowa.test/api/ask',{method:'POST',body:JSON.stringify({question:q})});
test('discovery bank has 36 unique, sourced common questions over six themes',()=>{
 assert.equal(discoveryItems.length,36);
 assert.equal(new Set(discoveryItems.map(x=>x.question)).size,36);
 assert.equal(new Set(discoveryItems.map(x=>x.id)).size,36);
 assert.equal(new Set(discoveryItems.map(x=>x.category)).size,6);
 for(const x of discoveryItems){assert.ok(x.question.endsWith('？'));assert.ok(x.answer.length>15);assert.ok(x.url.startsWith('https://'));assert.ok(x.provider);}
});
test('four refresh batches have nine unique questions without repeats until the full 36-question cycle ends',()=>{
 const now=new Date('2026-11-19T05:01:00Z');
 const batches=[0,1,2,3].map(i=>discoveryBatch(i,now));
 assert.ok(batches.every(x=>x.cards.length===9&&x.total===36));
 assert.equal(new Set(batches.flatMap(x=>x.cards.map(c=>c.id))).size,36);
 assert.equal(batches[3].nextBatch,0);
 assert.equal(discoveryBatch(4,now).batch,0);
 assert.equal(discoveryBatch(-5,now).batch,0);
 assert.equal(discoveryBatch('bad',now).batch,0);
});
test('daily deterministic order changes and every batch mixes knowledge themes',()=>{
 const first=orderedDiscovery('2026-11-19');
 const same=orderedDiscovery('2026-11-19');
 const next=orderedDiscovery('2026-11-20');
 assert.deepEqual(first,same);
 assert.notDeepEqual(first.map(x=>x.id),next.map(x=>x.id));
 for(let i=0;i<4;i++) assert.ok(new Set(first.slice(i*9,(i+1)*9).map(x=>x.category)).size>=5);
});
test('discovery answer bypasses paid inference and other network calls',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('network forbidden')};
 try {
  for(const item of discoveryItems){
   const env={AI_ENABLED:'true',DEEPSEEK_API_KEY:'dummy-secret',DAILY_AI_LIMIT:'5',AI_QUOTA:{getByName:()=>{throw Error('paid quota must not be reserved')}}};
   const response=await handleAsk(req(item.question),env);
   assert.equal(response.status,200,item.question);
   const data=await response.json();
   assert.equal(data.ai,false,item.question);
   assert.equal(data.verified,'editorial-curated',item.question);
   assert.ok(data.sources[0]?.url.startsWith('https://'));
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=old}
});
test('public discovery endpoint returns stable, cost-free 9 question cards',async()=>{
 const r=await worker.fetch(new Request('https://knowa.test/api/discover?batch=2'),{AI_ENABLED:'true'});
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.batch,2);assert.equal(d.cards.length,9);
 assert.equal(d.cards[0].answer,undefined,'never ship entire answer bank to homepage');
});
test('home page supports manual and timed refresh with category-labeled clickable questions',async()=>{
 const html=await(await worker.fetch(new Request('https://knowa.test/'),{})).text();
 assert.match(html,/id="refresh-tiles"/);
 assert.match(html,/id="discovery-meta"/);
 assert.match(html,/10\*60\*1000/);
 assert.match(html,/visibilitychange/);
 assert.match(html,/sessionStorage\.setItem/);
 assert.match(html,/\/api\/discover\?batch=/);
 assert.match(html,/data-question/);
});
