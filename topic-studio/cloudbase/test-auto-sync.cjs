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
