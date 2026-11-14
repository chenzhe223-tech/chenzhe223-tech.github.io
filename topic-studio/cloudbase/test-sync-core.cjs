"use strict";
const assert=require("node:assert/strict");
const core=require("./sync-core.js");
const makeStore=(entries={})=>{
 const raw=new Map(Object.entries(entries)),writes=[];
 return {getItem:key=>raw.has(key)?raw.get(key):null,
   setItem:(k,v)=>{writes.push([k,v]);raw.set(k,v)},
   get writes(){return writes},
   get entries(){return Object.fromEntries(raw.entries())}};
};
const topic=(id,title,status="inbox")=>({id,title,status,sourceUrl:"https://example.org/"+id,
 format:"文章",scores:{reader:3},visualPlan:{palette:"#142B40"},plannedDate:"2026-11-17"});
const baseTopic=topic("topic-1","AI 是什么");
const a=makeStore({
 "davylab-topic-studio-v1":JSON.stringify([baseTopic]),
 "davylab-published-articles-v1":JSON.stringify([{id:"pub-1",title:"文章已发布",url:"https://mp.weixin.qq.com/s/abc",publishedAt:"2026-11-12"}]),
 "davylab-topic-research-v1":JSON.stringify([{name:"对标账号",url:"https://example.org/benchmark"}]),
 "davylab-topic-research-briefs-v1":JSON.stringify([{id:"brief-1",topic:"Agent",body:"待核查",status:"draft"}]),
 "davylab-growth-lab-v1":JSON.stringify({
  target:{baseline:6,latest:10,start:"2026-11-15",deadline:"2027-05-15"},
  tasks:{article:true},experiments:[{id:"e-1",status:"planned",views:null}],
  posters:[{id:"p-1",status:"ready_for_workbuddy"}],
  metrics:[{id:"m-1",date:"2026-11-15",followers:10}],
  reviews:[{key:"https://example.org/a#7",checkpoint:7,reads:3}]
 }),
 "davylab-smart-editorial-schedule-v1":JSON.stringify({anchor:"2026-11-15",autoAssign:true}),
 "davylab_nianbox_session":"SECRET_TOKEN_MUST_NOT_BE_EXPORTED"
});
const backup=core.backup(a,new Date("2026-11-15T00:00:00Z"));
assert.equal(backup.format,"DAVYLAB_TOPIC_STUDIO_LOCAL_BACKUP_V1");
assert.equal(backup.createdAt,"2026-11-15T00:00:00.000Z");
assert.equal(backup.raw["davylab-topic-studio-v1"],a.entries["davylab-topic-studio-v1"]);
assert.equal(Object.keys(backup.raw).length,6);
assert.ok(!JSON.stringify(backup).includes("SECRET_TOKEN_MUST_NOT_BE_EXPORTED"));
assert.deepEqual(a.writes,[],"Backup cannot mutate localStorage");
const prepared=core.fromBackup(JSON.stringify(backup));
assert.equal(prepared.counts.topic,1);
assert.equal(prepared.counts.published_record,1);
assert.equal(prepared.counts.research,1,"Only ID-backed research briefs sync automatically");
assert.equal(prepared.counts.growth,6,"Grow target, tasks and four specific record groups");
assert.equal(prepared.counts.settings,1);
assert.equal(prepared.counts.total,10);
assert.ok(prepared.warnings.some(x=>x.code==="BENCHMARK_NEEDS_STABLE_ID"));
assert.deepEqual(a.writes,[],"Manifest generation cannot mutate localStorage");
const docs=prepared.documents;
const copy=JSON.parse(JSON.stringify(docs));
assert.equal(core.compare(docs,copy,[]).summary.identical,10);
const initialDifferent=copy.map(x=>x.doc_id==="topic-1"?{...x,payload:topic("topic-1","两端同名不同正文","approved")}:x);
let plan=core.compare(docs,initialDifferent,[]);
assert.equal(plan.summary.conflicts,1,"Initial matching IDs with changed payload conflict");
assert.equal(plan.metadata.canApplyAutomatically,false);
assert.equal(plan.metadata.remoteWritesExecuted,0);
assert.equal(plan.metadata.localWritesExecuted,0);
const base=JSON.parse(JSON.stringify(docs));
const changedLocal=docs.map(x=>x.doc_type==="topic"?{...x,payload:topic("topic-1","电脑最新稿","writing")}:x);
plan=core.compare(changedLocal,base,base);
assert.equal(plan.summary.upload,1);
assert.equal(plan.summary.download,0);
assert.equal(plan.summary.conflicts,0);
assert.equal(plan.upload[0].document.payload.status,"writing");
const changedRemote=base.map(x=>x.doc_type==="topic"?{...x,payload:topic("topic-1","手机最新稿","ready")}:x);
plan=core.compare(base,changedRemote,base);
assert.equal(plan.summary.download,1);
assert.equal(plan.summary.conflicts,0);
assert.equal(plan.download[0].document.payload.status,"ready");
plan=core.compare(changedLocal,changedRemote,base);
assert.equal(plan.summary.conflicts,1,"Concurrent edits must not be auto-merged");
assert.equal(plan.summary.upload,0);
assert.equal(plan.summary.download,0);
assert.equal(plan.conflicts[0].reason,"BOTH_EDITED");
plan=core.compare(docs.filter(x=>x.doc_type!=="topic"),base,base);
assert.equal(plan.summary.conflicts,1,"Missing legacy record is not a deletion authorization");
const extra=[{doc_type:"topic",doc_id:"topic-2",payload:topic("topic-2","另一个设备新增")}];
plan=core.compare(docs,extra,[]);
assert.equal(plan.summary.upload,10);
assert.equal(plan.summary.download,1);
assert.equal(plan.summary.conflicts,0);
const broken=makeStore({"davylab-topic-studio-v1":"{broken"});
const b=core.backup(broken);
assert.equal(b.raw["davylab-topic-studio-v1"],"{broken");
assert.ok(b.warnings.some(x=>x.code==="CORRUPT_LOCAL_JSON"));
assert.equal(core.toDocuments(b).documents.length,0);
assert.deepEqual(broken.writes,[]);
assert.throws(()=>core.parseBackup({...backup,raw:{...backup.raw,"apiKey":"ABC"}}),/unsafe/i);
assert.throws(()=>core.compare(docs,[...copy,copy[0]],[]),/Duplicate document/);
assert.ok(prepared.documents.some(x=>x.doc_type==="topic"&&x.payload.visualPlan?.palette==="#142B40"),"Visual plan must be losslessly preserved");
console.log("PASS offline-first P0: backup, token exclusion, six legacy stores, no writes, conflicts, per-record growth, no fabricated publish state");
