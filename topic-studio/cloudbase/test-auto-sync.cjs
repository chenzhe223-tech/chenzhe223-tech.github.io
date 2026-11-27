"use strict";
const assert=require("node:assert/strict");
const core=require("./sync-core.js");
const model=require("./auto-sync-model.js");
const engineLib=require("./auto-sync-engine.js");
const fs=require("node:fs"),path=require("node:path");
const copy=x=>JSON.parse(JSON.stringify(x));
class MockLocalStorage{
 constructor(obj={}){this.values=new Map(Object.entries(obj))}
 getItem(key){return this.values.has(key)?this.values.get(key):null}
 setItem(key,v){this.values.set(key,String(v))}
 removeItem(key){this.values.delete(key)}
}
function fakeServer(){
 const records=new Map(),operations=[];
 return{
  operations,records,
  async list(){operations.push("read");return [...records.values()].map(copy)},
  async productionPut(d,revision){
   operations.push("put");
   const key=d.doc_type+"::"+d.doc_id,previous=records.get(key);
   if((previous?.revision??0)!==revision)throw Error("SYNC_REVISION_CONFLICT");
   const next={...copy(d),revision:revision+1,deleted_at:null};
   records.set(key,next);
   return{doc_type:d.doc_type,doc_id:d.doc_id,revision:next.revision};
  }
 };
}
const snap={
 "davylab-topic-studio-v1":JSON.stringify([{id:"topic-1",title:"从现实工作问题中学习AI",status:"inbox",format:"文章",
  plannedDate:"2026-11-17",artDirection:{style:"minimal"}}]),
 "davylab-growth-lab-v1":JSON.stringify({target:{baseline:10},tasks:{weekly:true},
  experiments:[{id:"ex-1",status:"planned",hypothesis:"Learning AI"}]}),
 "davylab-smart-editorial-schedule-v1":JSON.stringify({anchor:"2026-11-15"}),
 "davylab-topic-research-v1":JSON.stringify([{name:"无 ID 的历史对标记录",url:"https://example.org/ref"}]),
 "davylab-topic-visual-dna-v1":JSON.stringify({theme:"modern"}),
 "davylab-visual-direction-v1":JSON.stringify({version:1,articleTheme:"Agent学习",accent:"#2D78D7"}),
 "davylab-discover-preferences-v1":JSON.stringify({lens:"AI"}),
 "davylab-published-articles-v1":JSON.stringify([{id:"published-1",title:"已发表标题",status:"published"}])
};
const modelA=model.capture(new MockLocalStorage(snap));
assert.equal(modelA.warnings.length,0,"Legacy benchmark without ID must be represented safely as a conflict-protected collection");
assert.equal(modelA.documents.length,10);
assert.ok(modelA.documents.some(d=>d.doc_type==="research"&&d.doc_id==="benchmark-set"));
const activation=JSON.parse(fs.readFileSync(path.join(__dirname,"sync-activation.json"),"utf8"));
assert.equal(activation.environmentId,"excess-tiglon-d6gjc77qr6fa193f2");
assert.equal(activation.enabled,false,"Live CloudBase write gate cannot be enabled without verified real isolation");
const ui=fs.readFileSync(path.join(__dirname,"auto-sync-ui.js"),"utf8");
assert.ok(ui.includes("signInWithPassword")&&ui.includes("signInWithOtp")&&ui.includes("getSession"));
assert.ok(ui.includes("cloudReady")===false || ui.includes("activationOK"));
assert.ok(ui.includes("Storage.prototype.setItem"));
const repoIndex=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.ok(repoIndex.includes("cloudbase/auto-sync-ui.js"));
assert.ok(repoIndex.includes("id=\"davylabSyncButton\""));
assert.throws(()=>engineLib.build({storage:new MockLocalStorage(),adapter:fakeServer(),uid:"owner",productionEnabled:false,permissionsVerified:false}),/SYNC_LIVE_SECURITY_GATE_REQUIRED/);
(async()=>{
 const server=fakeServer(),storeA=new MockLocalStorage(snap),storeB=new MockLocalStorage();
 const create=(store,uid="owner")=>engineLib.build({storage:store,adapter:server,uid,productionEnabled:true,
  permissionsVerified:true,disableTimers:true,now:()=>Date.UTC(2026,10,15)});
 const a=create(storeA),b=create(storeB);
 assert.deepEqual(await a.sync("login"),{upload:10,download:0,conflicts:0,readOnly:false});
 assert.equal(server.records.size,10);
 const firstBackup=storeA.getItem(engineLib.initialBackupKey("owner"));
 assert.ok(firstBackup&&firstBackup.includes("DAVYLAB_TOPIC_STUDIO_LOCAL_BACKUP_V1"));
 assert.equal((await b.sync("login")).download,10);
 assert.equal(JSON.parse(storeB.getItem("davylab-topic-research-v1"))[0].name,"无 ID 的历史对标记录");
 assert.equal(JSON.parse(storeB.getItem("davylab-visual-direction-v1")).articleTheme,"Agent学习");
 assert.equal(JSON.parse(storeB.getItem("davylab-topic-studio-v1"))[0].status,"inbox");

 const mobile=JSON.parse(storeB.getItem("davylab-topic-studio-v1"));
 mobile[0].title="手机自动改动";mobile[0].status="writing";
 storeB.setItem("davylab-topic-studio-v1",JSON.stringify(mobile));
 assert.equal((await b.sync("local-change")).upload,1);
 assert.equal((await a.sync("poll")).download,1);
 assert.equal(JSON.parse(storeA.getItem("davylab-topic-studio-v1"))[0].title,"手机自动改动");

 // Reverse direction, plus non-topic independent module updates.
 storeA.setItem("davylab-topic-visual-dna-v1",JSON.stringify({theme:"editorial"}));
 assert.equal((await a.sync("local-change")).upload,1);
 assert.equal((await b.sync("poll")).download,1);
 assert.equal(JSON.parse(storeB.getItem("davylab-topic-visual-dna-v1")).theme,"editorial");
 const editA=JSON.parse(storeA.getItem("davylab-topic-studio-v1"));
 const editB=JSON.parse(storeB.getItem("davylab-topic-studio-v1"));
 editA[0].title="电脑竞争修改";
 editB[0].title="手机竞争修改";
 storeA.setItem("davylab-topic-studio-v1",JSON.stringify(editA));
 storeB.setItem("davylab-topic-studio-v1",JSON.stringify(editB));
 assert.equal((await a.sync("local-change")).upload,1);
 const conflicted=await b.sync("poll");
 assert.equal(conflicted.conflicts,1);
 assert.equal(JSON.parse(storeB.getItem("davylab-topic-studio-v1"))[0].title,"手机竞争修改",
  "Concurrent conflicting edit must be preserved, not overwritten");
 assert.equal(b.state().phase,"conflict");
 assert.equal(server.records.get("topic::topic-1").payload.title,"电脑竞争修改");
 await assert.rejects(create(storeA,"another-account").sync("login"),/BOUND_TO_DIFFERENT_ACCOUNT/);

 // A disconnected phone stays editable and retries when network returns.
 const disconnected=new MockLocalStorage(),fakeWindow={navigator:{onLine:false}};
 const offline=engineLib.build({storage:disconnected,adapter:server,uid:"owner",win:fakeWindow,
  productionEnabled:true,permissionsVerified:true,disableTimers:true});
 assert.equal((await offline.sync("offline")).skipped,"offline");
 assert.equal(server.operations.at(-1),"read","Offline retry must not write to cloud");
 fakeWindow.navigator.onLine=true;
 assert.equal((await offline.sync("online")).download,10);

 // Stale server update test: the adapter must reject incorrect revision, never retry with current revision.
 await assert.rejects(server.productionPut({doc_type:"topic",doc_id:"topic-1",payload:{title:"bad"}},0),/REVISION_CONFLICT/);
 console.log("PASS two-device automatic pull/push, account boundary, visual/growth/research, offline, CAS conflict and activation gate");
})().catch(error=>{console.error(error);process.exit(1)});


/* V2 regression: complete authored records, explicit tombstones and conflict recovery. */
(async()=>{
 const A=new MockLocalStorage({
  "davylab-topic-studio-v1":JSON.stringify([{id:"qa-v2-a",title:"原始选题"},{id:"qa-v2-b",title:"第二篇"}]),
  "davylab-article-theme-topics-v2":JSON.stringify({version:2,activeTopic:"qa-v2-a",drafts:{"topic:qa-v2-a":{title:"标题",body:"完整稿件",theme:"alabaster"},"topic:qa-v2-b":{title:"另一个标题",body:"第二稿"}}}),
  "inkora-private-prompt-drafts-v1":JSON.stringify({"qa-v2-a::production::chatgpt::::":{text:"手动编辑的完整指令",sourceVersion:"v2:qa"}})
 }),B=new MockLocalStorage(),server=fakeServer();
 server.productionDelete=async(d,revision)=>{const key=d.doc_type+"::"+d.doc_id,old=server.records.get(key);if(old?.revision!==revision)throw Error("SYNC_REVISION_CONFLICT");const row={...copy(old),revision:revision+1,deleted_at:"2026-11-27T00:00:00Z"};server.records.set(key,row);return{doc_type:row.doc_type,doc_id:row.doc_id,revision:row.revision,deleted_at:row.deleted_at}};
 const setup=(storage,allow=()=>true)=>engineLib.build({storage,adapter:server,uid:"qa-v2-owner",productionEnabled:true,permissionsVerified:true,tombstonesEnabled:true,canApplyRemote:allow,disableTimers:true});
 const a=setup(A),b=setup(B);
 assert.equal((await a.sync()).upload,5);assert.equal((await b.sync()).download,5);
 const drafts=()=>JSON.parse(B.getItem("davylab-article-theme-topics-v2")).drafts;
 assert.equal(drafts()["topic:qa-v2-a"].body,"完整稿件");assert.equal(drafts()["topic:qa-v2-b"].body,"第二稿");
 assert.equal(JSON.parse(B.getItem("inkora-private-prompt-drafts-v1"))["qa-v2-a::production::chatgpt::::"].text,"手动编辑的完整指令");
 const d=JSON.parse(B.getItem("davylab-article-theme-topics-v2"));d.drafts["topic:qa-v2-a"].body="手机修改";B.setItem("davylab-article-theme-topics-v2",JSON.stringify(d));
 assert.equal((await b.sync()).upload,1);assert.equal((await a.sync()).download,1);assert.equal(JSON.parse(A.getItem("davylab-article-theme-topics-v2")).drafts["topic:qa-v2-a"].body,"手机修改");
 // Deliberate delete recorded against baseline revision; no resurrection after old device returns.
 assert.equal(engineLib.recordDeletion(A,"topic","qa-v2-a"),true);
 A.setItem("davylab-topic-studio-v1",JSON.stringify(JSON.parse(A.getItem("davylab-topic-studio-v1")).filter(x=>x.id!=="qa-v2-a")));
 assert.equal((await a.sync()).upload,1);assert.ok(server.records.get("topic::qa-v2-a").deleted_at);
 assert.equal((await b.sync()).download,1);assert.equal(JSON.parse(B.getItem("davylab-topic-studio-v1")).some(x=>x.id==="qa-v2-a"),false);
 assert.equal((await b.sync()).conflicts,0);assert.equal((await a.sync()).conflicts,0);
 const C=new MockLocalStorage({"davylab-topic-studio-v1":JSON.stringify([{id:"qa-v2-a",title:"原始选题"}])});const c=setup(C);await c.sync();assert.equal(JSON.parse(C.getItem("davylab-topic-studio-v1")).some(x=>x.id==="qa-v2-a"),false);
 // Unexpected cache loss or simultaneous edit must not masquerade as a delete.
 B.setItem("davylab-topic-studio-v1","[]");assert.equal((await b.sync()).conflicts,1);assert.equal(server.records.get("topic::qa-v2-b").deleted_at,null);
 const conflict=b.conflictCopies().find(x=>x.key==="topic::qa-v2-b");assert.equal(conflict.cloud.payload.title,"第二篇");assert.equal(conflict.local,null);
 const fresh=new MockLocalStorage(),paused=setup(fresh,()=>false);const result=await paused.sync();assert.ok(result.deferred>0);assert.equal(fresh.getItem("davylab-topic-studio-v1"),null);assert.equal(paused.state().phase,"editing");
 assert.equal(JSON.parse(A.getItem(engineLib.deleteJournalKey("qa-v2-owner")))["topic::qa-v2-a"],undefined);
 console.log("PASS INKORA V2 per-draft and prompt sync, explicit deletion, stale-device prevention, missing-cache protection, conflict backup and editing deferral");
})().catch(error=>{console.error(error);process.exitCode=1});
