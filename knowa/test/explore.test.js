import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{handleAsk} from '../src/index.js';
import {exploreCollection} from '../src/explore.js';
const req=q=>new Request('https://know.test/api/ask',{method:'POST',body:JSON.stringify({question:q})});
test('world records vague prompt produces specific sourced facts, without AI spending',async()=>{
  let network=0;const original=globalThis.fetch;
  globalThis.fetch=async()=>{network++;throw Error('should be offline')};
  try{
    const env={AI_ENABLED:'true',DAILY_AI_LIMIT:'5',DEEPSEEK_API_KEY:'mock-test-not-real',AI_QUOTA:{getByName:()=>{throw Error('AI quota must not be reserved')}}};
    const res=await handleAsk(req('世界之最有哪些有趣的常识？'),env);
    const d=await res.json();
    assert.equal(res.status,200);
    assert.equal(d.verified,'editorial-collection');
    assert.equal(d.ai,false);assert.equal(d.aiStatus,'not-needed');
    assert.ok(d.cards.length>=6);
    assert.ok(d.cards.some(x=>x.fact.includes('10,935')));
    assert.ok(d.cards.some(x=>x.title.includes('蓝鲸')));
    assert.ok(d.cards.every(x=>x.url.startsWith('https://')&&x.question));
    assert.equal(network,0);
  }finally{globalThis.fetch=original;}
});
test('all homepage discovery categories return relevant knowledge cards',()=>{
 for(const topic of ['自然地理','历史人文','人物与奖项','科学发现','世界之最','生活常识']){
  const d=exploreCollection(topic+'有哪些有趣的常识？');
  assert.ok(d&&d.cards.length>0,topic);
  assert.ok(d.cards.every(x=>x.fact.length>15&&x.provider),topic);
 }
});
test('targeted queries still use exact source-backed answers',async()=>{
 assert.equal(exploreCollection('哪颗行星的平均密度最低？'),null);
 const d=await(await handleAsk(req('哪颗行星的平均密度最低？'))).json();
 assert.equal(d.verified,'editorial-curated');
 assert.equal(exploreCollection('出生于现今日本境内的诺贝尔奖获得者有多少位？'),null);
});
test('page renders topical answer cards and clickable follow-up actions',async()=>{
 const html=await(await worker.fetch(new Request('https://know.test/'),{})).text();
 assert.match(html,/世界之最有哪些有趣的常识/);
 assert.match(html,/factgrid/);
 assert.match(html,/data-explore-question/);
});
