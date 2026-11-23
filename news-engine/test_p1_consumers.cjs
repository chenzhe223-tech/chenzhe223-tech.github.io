/* P1: offline, source-and-recovery contract for existing DAVYLAB consumers. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('news-engine/p1-knowa-topic-adapter.js','utf8');
 const news={"issue_date":"2026-11-23","is_today":true,"data":[
  {title:"Verified original developer launch announcement",source:"OpenAI",source_url:"https://example.org/ai/new-model",selection_score:77,publishable:false},
  {title:"Independent chip industry technology update",source:"Publisher",source_url:"https://example.org/chip/industry",selection_score:62,publishable:false},
  {title:"Private network link excluded",source:"Fake",source_url:"http://127.0.0.1/private",selection_score:100,publishable:false},
  {title:"Published content must not enter selection pool",source:"Fake",source_url:"https://example.org/sales",selection_score:90,publishable:true}
 ]};
 let called=0;
 const context={URL,AbortSignal,fetch:async url=>{called++;assert.match(url,/davylab-news-api\.chenzhe223\.workers\.dev\/api\/v1\/topics/);return {ok:true,json:async()=>news}}};
 const adapter=vm.runInNewContext(source+';knowaTopicRadarWithNewsEngine',context);
 const before={ok:true,items:[{id:"oa:1",title:"Prior preserved academic topic",sourceUrl:"https://example.org/paper"}],sources:[{name:"OpenAlex",status:"ok",count:1}],totalPersisted:1};
 const added=await adapter(before);
 assert.equal(added.ok,true);
 assert.equal(before.items.length,1,"Must not mutate original KNOWA topic pool");
 assert.equal(before.sources.length,1,"Must not mutate original source status");
 assert.equal(added.items.length,3,"Must not emit unsafe URLs or auto-publish item");
 assert.equal(added.sources.at(-1).status,"ok");
 assert.equal(added.newsEngine.added,2);
 assert.ok(added.items.slice(1).every(x=>x.publishable===false&&x.verificationStatus==="source_not_independently_verified"));
 assert.ok(added.items.slice(1).every(x=>x.category.includes("待核验")&&x.sourceUrl.startsWith("https://")));
 context.fetch=async()=>{throw Error("network unavailable")};
 const fallback=await adapter(before);
 assert.equal(fallback.items.length,1);
 assert.equal(fallback.sources.at(-1).status,"unavailable");
 assert.equal(fallback.newsEngine.status,"unavailable");
 assert.equal(called,1);
 const worldtoon=fs.readFileSync('comic-studio/briefing.js','utf8');
 const topic=fs.readFileSync('topic-studio/xnews-discovery.js','utf8');
 assert.ok(worldtoon.includes("BRIEF_NEWS_API='https://davylab-news-api.chenzhe223.workers.dev"));
 assert.ok(worldtoon.includes("briefView==='engine'"));
 assert.ok(worldtoon.includes("briefIssue.newsEngineWarning"));
 assert.ok(topic.includes("newsApiId(")&&topic.includes('state.newsEngineOk=true'));
 assert.ok(topic.includes('item.origin')&&topic.includes('"news_engine"'));
 console.log("PASS: KNOWA source metadata, no publish, input guard, graceful failure, WorldToon and Topic Studio bridge contracts");
})().catch(e=>{console.error(e);process.exitCode=1});
