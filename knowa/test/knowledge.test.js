import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {knowledgeEntries,findKnowledge,searchKnowledge,knowledgeCategories} from '../src/knowledge.js';
test('knowledge P0 has stable sourced entries with honest provenance',()=>{
 assert.equal(knowledgeEntries.length,36);assert.equal(new Set(knowledgeEntries.map(x=>x.id)).size,36);
 assert.equal(knowledgeCategories().reduce((a,c)=>a+c.count,0),36);
 for(const x of knowledgeEntries){assert.equal(x.reviewStatus,'source-review-pending');assert.equal(x.reviewedAt,null);assert.match(x.id,/^k\d{2}$/);assert.ok(x.evidence[0].url.startsWith('https://'));}
});
test('free catalog supports search, categories and upper bounds',()=>{
 assert.equal(searchKnowledge({category:'宇宙科学'}).total,6);
 assert.ok(searchKnowledge({q:'土星'}).total>=1);
 assert.equal(searchKnowledge({q:'impossible-nonsense'}).total,0);
 assert.equal(searchKnowledge({limit:1}).entries.length,1);
 assert.equal(searchKnowledge({limit:99999}).entries.length,36);
 assert.equal(findKnowledge('k99'),null);
});
test('read-only public APIs return correct records and 404',async()=>{
 const list=await worker.fetch(new Request('https://knowa.test/api/knowledge?category=%E5%AE%87%E5%AE%99%E7%A7%91%E5%AD%A6'),{});
 assert.equal(list.status,200);assert.equal((await list.json()).total,6);
 const item=await worker.fetch(new Request('https://knowa.test/api/knowledge/k01'),{});
 assert.equal((await item.json()).id,'k01');
 const invalid=await worker.fetch(new Request('https://knowa.test/api/knowledge/k99'),{});
 assert.equal(invalid.status,404);
 const cats=await worker.fetch(new Request('https://knowa.test/api/knowledge/categories'),{});
 assert.equal((await cats.json()).total,36);
});
test('encyclopedia pages include citations, semantic navigation and local-only controls',async()=>{
 const list=await worker.fetch(new Request('https://knowa.test/knowledge'),{});
 assert.equal(list.status,200);
 assert.match(list.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const l=await list.text();assert.match(l,/id="entry-search"/);assert.match(l,/href="\/knowledge\/k01"/);assert.match(l,/来源待复核/);
 const item=await worker.fetch(new Request('https://knowa.test/knowledge/k01'),{});
 assert.equal(item.status,200);
 const h=await item.text();assert.match(h,/id="entry-answer"/);assert.match(h,/id="read-entry"/);assert.match(h,/id="share-entry"/);assert.match(h,/href="#reference-1"/);assert.match(h,/noopener noreferrer/);
 assert.equal((await worker.fetch(new Request('https://knowa.test/knowledge/k99'),{})).status,404);
});
test('old homepage, free discovery and paid gate are preserved',async()=>{
 const h=await(await worker.fetch(new Request('https://knowa.test/'),{})).text();
 assert.match(h,/href="\/knowledge"/);assert.match(h,/orbit-scene/);assert.match(h,/api\/discover/);assert.match(h,/id="form"/);
 const info=await(await worker.fetch(new Request('https://knowa.test/api/health'),{})).json();
 assert.equal(info.version,'2.0.0-p1');assert.equal(info.knowledgeAssets,36);assert.equal(info.aiConfigured,false);
});
