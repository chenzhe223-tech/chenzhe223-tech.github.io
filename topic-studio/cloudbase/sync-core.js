/* DAVYLAB · Offline-first sync planning core · P0
 * Safe in browsers and Node; NO CLOUD SDK, NO HTTP and NO LOCAL STORAGE WRITE.
 * Maps legacy localStorage sources to separate owner-scoped candidate documents.
 * A merge PLAN is not an instruction to overwrite either side.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.DAVYLABSyncCore=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const VERSION="0.3.0-inkora-private-drafts";
 const SOURCES=Object.freeze([
  {key:"davylab-topic-studio-v1",label:"选题池与配图方案",kind:"topics"},
  {key:"davylab-published-articles-v1",label:"已发表内容记录",kind:"published"},
  {key:"davylab-topic-research-v1",label:"赛道研究对标记录",kind:"benchmarks"},
  {key:"davylab-topic-research-briefs-v1",label:"赛道研究简报",kind:"briefs"},
  {key:"davylab-growth-lab-v1",label:"增长实验与复盘",kind:"growth"},
  {key:"davylab-smart-editorial-schedule-v1",label:"智能排期设置",kind:"schedule"},
  {key:"davylab-topic-visual-dna-v1",label:"视觉主题与布局",kind:"settings",docId:"visual-dna"},
  {key:"davylab-visual-direction-v1",label:"文章配图策划",kind:"settings",docId:"visual-direction"},
  {key:"davylab-discover-preferences-v1",label:"选题发现筛选偏好",kind:"settings",docId:"discover-preferences"},
  {key:"davylab-article-theme-topics-v2",label:"独立文章排版草稿",kind:"drafts"},
  {key:"inkora-private-prompt-drafts-v1",label:"AI 指令与手动编辑",kind:"prompts"}
 ]);
 const MAX_BACKUP_BYTES=10*1024*1024;
 const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const stable=value=>{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";
  return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
 };
 const same=(a,b)=>stable(a)===stable(b);
 const bad=(why,key)=>({code:why,source:key});
 function read(storage){
  const sources=[],warnings=[],raw={};
  for(const src of SOURCES){
   let str=null;
   try{str=storage.getItem(src.key)}catch{warnings.push(bad("LOCAL_STORAGE_UNAVAILABLE",src.key));continue}
   if(str===null){sources.push({...src,present:false,count:0});continue}
   raw[src.key]=str;
   try{
    const data=JSON.parse(str);
    const valid=["schedule","growth","settings","drafts","prompts"].includes(src.kind)?isObject(data):Array.isArray(data);
    if(!valid){warnings.push(bad("UNEXPECTED_LOCAL_SHAPE",src.key));sources.push({...src,present:true,count:0,invalid:true});continue}
    const count=Array.isArray(data)?data.length:src.kind==="growth"?
      (Array.isArray(data.experiments)?data.experiments.length:0)+
      (Array.isArray(data.posters)?data.posters.length:0)+
      (Array.isArray(data.metrics)?data.metrics.length:0)+
      (Array.isArray(data.reviews)?data.reviews.length:0)+1:1;
    sources.push({...src,present:true,count});
   }catch{warnings.push(bad("CORRUPT_LOCAL_JSON",src.key));sources.push({...src,present:true,count:0,invalid:true})}
  }
  return{raw,sources,warnings};
 }
 function validId(value){return typeof value==="string"&&value.length>0&&value.length<=512}
 function toDocuments(snapshot){
  if(!snapshot||!isObject(snapshot.raw))throw Error("Invalid snapshot");
  const docs=[],warnings=[...(snapshot.warnings||[])],seen=new Set();
  const put=(type,id,payload,source)=>{
   if(!validId(id)||!isObject(payload)){
    warnings.push(bad("RECORD_MISSING_STABLE_ID",source));return;
   }
   const key=type+"::"+id;
   if(seen.has(key)){warnings.push(bad("DUPLICATE_DOCUMENT_ID",source));return}
   seen.add(key);
   docs.push({doc_type:type,doc_id:id,payload:JSON.parse(JSON.stringify(payload)),source});
  };
  for(const src of SOURCES){
   if(!(src.key in snapshot.raw))continue;
   let data;
   try{data=JSON.parse(snapshot.raw[src.key])}catch{continue}
   if(src.kind==="topics"&&Array.isArray(data)){
    for(const item of data)put("topic",item?.id,item,src.key);
   }else if(src.kind==="published"&&Array.isArray(data)){
    for(const item of data)put("published_record",item?.id,item,src.key);
   }else if(src.kind==="briefs"&&Array.isArray(data)){
    for(const item of data){if(validId(item?.id))put("research","brief:"+item.id,item,src.key);else warnings.push(bad("RECORD_MISSING_STABLE_ID",src.key));}
   }else if(src.kind==="benchmarks"&&Array.isArray(data)){
    // Historical benchmark entries lack IDs; do not mistake content-derived hashes
    // for durable identities or silently turn edits into duplicate entries.
    for(const item of data){
     if(item&&validId(item.id))put("research","benchmark:"+item.id,item,src.key);
     else warnings.push(bad("BENCHMARK_NEEDS_STABLE_ID",src.key));
    }
   }else if(src.kind==="drafts"&&isObject(data)){
    if(!isObject(data.drafts)){warnings.push(bad("INVALID_ARTICLE_DRAFTS",src.key));continue}
    for(const [id,item] of Object.entries(data.drafts)){if(id==="free"||id.startsWith("topic:"))put("settings","article-draft:"+id,item,src.key);else warnings.push(bad("INVALID_ARTICLE_DRAFT_ID",src.key))}
   }else if(src.kind==="prompts"&&isObject(data)){
    for(const [id,item] of Object.entries(data)){if(isObject(item)&&typeof item.text==="string"&&typeof item.sourceVersion==="string")put("settings","prompt-draft:"+id,item,src.key);else warnings.push(bad("INVALID_PROMPT_DRAFT",src.key))}
   }else if(src.kind==="settings"&&isObject(data)){
    put("settings",src.docId,data,src.key);
   }else if(src.kind==="schedule"&&isObject(data)){
    put("settings","editorial-schedule",data,src.key);
   }else if(src.kind==="growth"&&isObject(data)){
    if(isObject(data.target))put("growth","target",data.target,src.key);
    if(isObject(data.tasks))put("growth","tasks",data.tasks,src.key);
    for(const group of ["experiments","posters","metrics","reviews"]){
     for(const item of Array.isArray(data[group])?data[group]:[]){
      const key=group==="reviews"?item?.key:item?.id;
      if(validId(key))put("growth",group+":"+key,item,src.key);
      else warnings.push(bad("RECORD_MISSING_STABLE_ID",src.key));
     }
    }
   }
  }
  return{documents:docs,warnings,counts:{
   total:docs.length,
   topic:docs.filter(x=>x.doc_type==="topic").length,
   research:docs.filter(x=>x.doc_type==="research").length,
   growth:docs.filter(x=>x.doc_type==="growth").length,
   settings:docs.filter(x=>x.doc_type==="settings").length,
   published_record:docs.filter(x=>x.doc_type==="published_record").length
  }};
 }
 function key(x){return x.doc_type+"::"+x.doc_id}
 function mapDocs(items){
  const out=new Map();
  for(const d of items||[]){
   if(!d||!validId(d.doc_type)||!validId(d.doc_id)||!isObject(d.payload))throw Error("Invalid document in merge comparison");
   const k=key(d);
   if(out.has(k))throw Error("Duplicate document in merge comparison: "+k);
   out.set(k,d);
  }
  return out;
 }
 function compare(localDocs,remoteDocs,baseDocs=[]){
  const L=mapDocs(localDocs),R=mapDocs(remoteDocs),B=mapDocs(baseDocs);
  const result={upload:[],download:[],identical:[],conflicts:[],unchanged:[],metadata:{
   requiresAuthenticatedOwner:true,requiresPrivateRules:true,requiresVersionedServerWrite:true,
   canApplyAutomatically:false,remoteWritesExecuted:0,localWritesExecuted:0
  }};
  const keys=new Set([...L.keys(),...R.keys(),...B.keys()]);
  for(const k of keys){
   const l=L.get(k),r=R.get(k),b=B.get(k);
   if(!l&&!r){result.conflicts.push({key:k,reason:"DELETION_WITHOUT_TOMBSTONE"});continue}
   if(!b){
    if(l&&r){if(same(l.payload,r.payload))result.identical.push(k);else result.conflicts.push({key:k,reason:"DIFFERENT_INITIAL_VERSIONS"})}
    else if(l)result.upload.push({key:k,document:l,reason:"LOCAL_ONLY_BACKUP_REQUIRED"});
    else result.download.push({key:k,document:r,reason:"REMOTE_ONLY_BACKUP_REQUIRED"});
    continue;
   }
   // Legacy localStorage hard deletion is not a cloud tombstone.
   if(!l||!r){result.conflicts.push({key:k,reason:"MISSING_RECORD_REQUIRES_HUMAN_REVIEW"});continue}
   const leftChanged=!same(l.payload,b.payload),rightChanged=!same(r.payload,b.payload);
   if(!leftChanged&&!rightChanged){result.unchanged.push(k);continue}
   if(same(l.payload,r.payload)){result.identical.push(k);continue}
   if(leftChanged&&rightChanged){result.conflicts.push({key:k,reason:"BOTH_EDITED"});continue}
   if(leftChanged)result.upload.push({key:k,document:l,reason:"REMOTE_EQUALS_BASE"});
   else result.download.push({key:k,document:r,reason:"LOCAL_EQUALS_BASE"});
  }
  result.summary={upload:result.upload.length,download:result.download.length,
   identical:result.identical.length,unchanged:result.unchanged.length,conflicts:result.conflicts.length};
  return result;
 }
 // Deletion-aware plan: only a recorded explicit intent with matching server revision may delete.
 function compareV2(localDocs,remoteDocs,baseDocs=[],intents={}){
  const L=mapDocs(localDocs),R=mapDocs(remoteDocs),B=mapDocs(baseDocs),plan=compare(localDocs.filter(d=>!R.get(key(d))?.deleted_at),remoteDocs.filter(d=>!d.deleted_at),baseDocs.filter(d=>!d.deleted_at));
  const special=new Set([...R].filter(([,d])=>d.deleted_at).map(([k])=>k));
  for(const k of Object.keys(intents))special.add(k);
  for(const [k,b] of B)if(b.deleted_at)special.add(k);
  for(const field of ["upload","download","conflicts"])plan[field]=plan[field].filter(x=>!special.has(x.key));
  for(const field of ["identical","unchanged"])plan[field]=plan[field].filter(k=>!special.has(k));
  plan.deletes=[];plan.completedIntents=[];
  for(const k of special){
   const l=L.get(k),r=R.get(k),b=B.get(k),intent=intents[k];
   if(r?.deleted_at){
    if(!l){plan.identical.push(k);if(intent)plan.completedIntents.push(k)}
    else if(same(l.payload,r.payload)&&!b?.deleted_at){plan.download.push({key:k,document:r,reason:"REMOTE_EXPLICIT_DELETION"});if(intent)plan.completedIntents.push(k)}
    else plan.conflicts.push({key:k,reason:"DELETED_REMOTE_LOCAL_EDIT_PRESERVED"});
    continue;
   }
   if(b?.deleted_at){plan.conflicts.push({key:k,reason:"SERVER_TOMBSTONE_MISSING_OR_RECREATED"});continue}
   if(!intent)continue;
   if(l){plan.conflicts.push({key:k,reason:"LOCAL_RECORD_RESTORED_AFTER_DELETE_INTENT"});continue}
   if(!r&&!b){plan.completedIntents.push(k);continue}
   if(r&&b&&Number.isInteger(intent.expectedRevision)&&r.revision===intent.expectedRevision&&r.revision===b.revision&&same(r.payload,b.payload)){
    plan.deletes.push({key:k,document:r,reason:"EXPLICIT_LOCAL_DELETE"});
   }else plan.conflicts.push({key:k,reason:"DELETE_CONCURRENT_OR_UNKNOWN_VERSION"});
  }
  plan.summary={upload:plan.upload.length,download:plan.download.length,identical:plan.identical.length,unchanged:plan.unchanged.length,conflicts:plan.conflicts.length,deletes:plan.deletes.length};
  return plan;
 }
 function backup(storage,now=new Date()){
  const captured=read(storage);
  const createdAt=now instanceof Date?now.toISOString():new Date(now).toISOString();
  return{format:"DAVYLAB_TOPIC_STUDIO_LOCAL_BACKUP_V1",version:1,createdAt,
   storageOrigin:"browser-local-only",containsPrivateDrafts:true,
   note:"Store offline and privately. This file is not an authorization to upload to CloudBase.",
   raw:captured.raw,inventory:captured.sources.map(x=>({key:x.key,count:x.count,present:x.present,invalid:!!x.invalid})),
   warnings:captured.warnings};
 }
 function parseBackup(value){
  const b=typeof value==="string"?JSON.parse(value):value;
  if(!isObject(b)||b.format!=="DAVYLAB_TOPIC_STUDIO_LOCAL_BACKUP_V1"||b.version!==1||!isObject(b.raw))throw Error("Not a DAVYLAB sync backup");
  const allowed=new Set(SOURCES.map(x=>x.key));
  for(const [k,v] of Object.entries(b.raw)){
   if(!allowed.has(k)||typeof v!=="string")throw Error("Unknown or unsafe data field");
  }
  if(JSON.stringify(b).length>MAX_BACKUP_BYTES)throw Error("Backup exceeds 10 MB");
  return b;
 }
 function fromBackup(value){
  const b=parseBackup(value);
  return toDocuments({raw:b.raw,warnings:[]});
 }
 return{VERSION,SOURCES,MAX_BACKUP_BYTES,read,toDocuments,compare,compareV2,backup,parseBackup,fromBackup,stable};
});
