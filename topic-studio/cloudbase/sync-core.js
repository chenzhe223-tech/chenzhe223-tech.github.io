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
 const VERSION="0.1.0-p0";
 const SOURCES=Object.freeze([
  {key:"davylab-topic-studio-v1",label:"选题池与配图方案",kind:"topics"},
  {key:"davylab-published-articles-v1",label:"已发表内容记录",kind:"published"},
  {key:"davylab-topic-research-v1",label:"赛道研究对标记录",kind:"benchmarks"},
  {key:"davylab-topic-research-briefs-v1",label:"赛道研究简报",kind:"briefs"},
  {key:"davylab-growth-lab-v1",label:"增长实验与复盘",kind:"growth"},
  {key:"davylab-smart-editorial-schedule-v1",label:"智能排期设置",kind:"schedule"}
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
    const valid=src.kind==="schedule"?isObject(data):src.kind==="growth"?isObject(data):Array.isArray(data);
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
    for(const item of data)put("research","brief:"+String(item?.id||""),item,src.key);
   }else if(src.kind==="benchmarks"&&Array.isArray(data)){
    // Historical benchmark entries lack IDs; do not mistake content-derived hashes
    // for durable identities or silently turn edits into duplicate entries.
    for(const item of data){
     if(item&&validId(item.id))put("research","benchmark:"+item.id,item,src.key);
     else warnings.push(bad("BENCHMARK_NEEDS_STABLE_ID",src.key));
    }
   }else if(src.kind==="schedule"&&isObject(data)){
    put("settings","editorial-schedule",data,src.key);
   }else if(src.kind==="growth"&&isObject(data)){
    if(isObject(data.target))put("growth","target",data.target,src.key);
    if(isObject(data.tasks))put("growth","tasks",data.tasks,src.key);
    for(const group of ["experiments","posters","metrics","reviews"]){
     for(const item of Array.isArray(data[group])?data[group]:[]){
      const key=group==="reviews"?item?.key:item?.id;
      put("growth",group+":"+String(key||""),item,src.key);
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
 return{VERSION,SOURCES,MAX_BACKUP_BYTES,read,toDocuments,compare,backup,parseBackup,fromBackup,stable};
});
