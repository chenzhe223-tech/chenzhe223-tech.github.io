import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const routes=['/','/knowledge','/knowledge/k01','/studio'];
const expected=['智能问答','百科知识库','创作 Studio'];

test('only the three approved top-level navigation entries appear on every core view',async()=>{
  for(const path of routes){
    const r=await worker.fetch(new Request('https://knowa.test'+path),{});
    assert.equal(r.status,200,path);
    const html=await r.text();
    const nav=html.match(/<nav(?:\s[^>]*)?>([\s\S]*?)<\/nav>/);
    assert.ok(nav,path+' missing top nav');
    const labels=[...nav[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(m=>m[1].replace(/<[^>]+>/g,'').trim());
    assert.deepEqual(labels,expected,path+' top nav must match approved labels');
    for(const removed of ['知识领域','值得了解','知识，有据可查','知识分类'])assert.ok(!nav[1].includes(removed),path+' retains removed navigation label '+removed);
  }
});
test('only the header tagline is removed; knowledge content and original core functions remain',async()=>{
 const html=await (await worker.fetch(new Request('https://knowa.test/'),{})).text();
 const header=html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/);
 assert.ok(header);
 assert.ok(!header[1].includes('知识，有据可查'));
 assert.match(html,/id="orbit-scene"/);
 assert.match(html,/id="discovery"/);
 assert.match(html,/id="form"/);
 assert.match(html,/href="\/knowledge"/);
 assert.match(html,/href="\/studio"/);
 const api=await worker.fetch(new Request('https://knowa.test/api/discover?batch=0'),{});
 assert.equal(api.status,200);
 const list=await api.json();assert.equal(list.cards.length,9);
});
