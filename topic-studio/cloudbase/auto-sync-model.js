/* DAVYLAB Content Studio · P2 auto-sync document model.
 * Lossless, per-record adapters for all local business data. Cloud independent.
 * Does not auto-resolve same-record edits or cloud deletion.
 */
(function(root,factory){
 "use strict";
 const api=factory(root?.DAVYLABSyncCore||(typeof module==="object"?require("./sync-core.js"):null));
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.DAVYLABAutoSyncModel=api;
})(typeof window!=="undefined"?window:null,function(core){
 "use strict";
 if(!core)throw Error("DAVYLAB_SYNC_CORE_REQUIRED");
 const VERSION="0.2.0-model",BENCHMARK_KEY="davylab-topic-research-v1",DRAFT_KEY="davylab-article-theme-topics-v2",PROMPT_KEY="inkora-private-prompt-drafts-v1";
 const recoveryKey=uid=>"davylab-sync-recovery-"+String(uid||"anonymous");
 const arrayKey={
  topic:"davylab-topic-studio-v1",
  published_record:"davylab-published-articles-v1"
 };
 const settingKey={
  "editorial-schedule":"davylab-smart-editorial-schedule-v1",
  "visual-dna":"davylab-topic-visual-dna-v1",
  "visual-direction":"davylab-visual-direction-v1",
  "discover-preferences":"davylab-discover-preferences-v1"
 };
 const isObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const clone=v=>JSON.parse(JSON.stringify(v));
 const same=(a,b)=>core.stable(a)===core.stable(b);
 function capture(storage){
  const snapshot=core.read(storage),mapped=core.toDocuments(snapshot);
  const docs=mapped.documents.filter(d=>d.source!==BENCHMARK_KEY);
  const warnings=mapped.warnings.filter(w=>w.code!=="BENCHMARK_NEEDS_STABLE_ID");
  if(BENCHMARK_KEY in snapshot.raw){
   try{
    const items=JSON.parse(snapshot.raw[BENCHMARK_KEY]);
    if(!Array.isArray(items))throw Error("not-array");
    docs.push({doc_type:"research",doc_id:"benchmark-set",payload:{items:clone(items)},source:BENCHMARK_KEY});
   }catch{warnings.push({code:"INVALID_BENCHMARK_DATA",source:BENCHMARK_KEY})}
  }
  return{snapshot,documents:docs,warnings};
 }
 function sourceOf(doc){
  if(!doc||!isObj(doc.payload)||typeof doc.doc_id!=="string")throw Error("SYNC_REMOTE_INVALID_DOCUMENT");
  if(doc.doc_type==="topic"||doc.doc_type==="published_record")return arrayKey[doc.doc_type];
  if(doc.doc_type==="research"&&doc.doc_id==="benchmark-set")return BENCHMARK_KEY;
  if(doc.doc_type==="research"&&doc.doc_id.startsWith("brief:"))return "davylab-topic-research-briefs-v1";
  if(doc.doc_type==="growth"&&(
    ["target","tasks"].includes(doc.doc_id)||/^(experiments|posters|metrics|reviews):[^:]+/.test(doc.doc_id)))return "davylab-growth-lab-v1";
  if(doc.doc_type==="settings"&&doc.doc_id.startsWith("article-draft:"))return DRAFT_KEY;
  if(doc.doc_type==="settings"&&doc.doc_id.startsWith("prompt-draft:"))return PROMPT_KEY;
  if(doc.doc_type==="settings"&&settingKey[doc.doc_id])return settingKey[doc.doc_id];
  throw Error("SYNC_REMOTE_UNSUPPORTED_RECORD: "+doc.doc_type+":"+doc.doc_id.slice(0,50));
 }
 function defaultFor(key){
  if(key===DRAFT_KEY)return{version:2,activeTopic:"",drafts:{}};
  if(key===PROMPT_KEY||key==="davylab-growth-lab-v1")return{};
  if(Object.values(settingKey).includes(key))return{};
  return[];
 }
 function arrayUpsert(arr,item,id,identity){
  if(!Array.isArray(arr))throw Error("SYNC_LOCAL_INVALID_ARRAY");
  const index=arr.findIndex(x=>identity(x)===id);
  if(index>=0)arr[index]=clone(item);
  else arr.unshift(clone(item));
  return arr;
 }
 function patchedValue(key,current,doc){
  const p=clone(doc.payload),id=doc.doc_id;
  if(key==="davylab-topic-studio-v1"||key==="davylab-published-articles-v1"){
   if(p.id!==id)throw Error("SYNC_ID_MISMATCH");
   return arrayUpsert(current,p,id,x=>x?.id);
  }
  if(key==="davylab-topic-research-briefs-v1"){
   const original=id.slice(6);
   if(!original||p.id!==original)throw Error("SYNC_ID_MISMATCH");
   return arrayUpsert(current,p,original,x=>x?.id);
  }
  if(key===BENCHMARK_KEY){
   if(!Array.isArray(p.items))throw Error("SYNC_INVALID_BENCHMARK_PAYLOAD");
   // Entire benchmark array is a SINGLE conflict-protected document.
   return clone(p.items);
  }
  if(key==="davylab-growth-lab-v1"){
   if(!isObj(current))throw Error("SYNC_LOCAL_INVALID_GROWTH");
   if(["target","tasks"].includes(id)){current[id]=p;return current}
   const at=id.indexOf(":");
   const group=id.slice(0,at),recordId=id.slice(at+1);
   if(!["experiments","posters","metrics","reviews"].includes(group)||!recordId)throw Error("SYNC_INVALID_GROWTH_ID");
   if((group==="reviews"&&p.key!==recordId)||(group!=="reviews"&&p.id!==recordId))throw Error("SYNC_ID_MISMATCH");
   if(!Array.isArray(current[group]))current[group]=[];
   current[group]=arrayUpsert(current[group],p,recordId,x=>group==="reviews"?x?.key:x?.id);
   return current;
  }
  if(key===DRAFT_KEY){const draftId=id.slice("article-draft:".length);if(!isObj(current)||!isObj(current.drafts)||!(draftId==="free"||draftId.startsWith("topic:"))||typeof p.body!=="string"||typeof p.title!=="string")throw Error("SYNC_INVALID_ARTICLE_DRAFT");Object.defineProperty(current.drafts,draftId,{value:p,writable:true,enumerable:true,configurable:true});return current}
  if(key===PROMPT_KEY){const promptId=id.slice("prompt-draft:".length);if(!isObj(current)||!promptId||typeof p.text!=="string"||typeof p.sourceVersion!=="string")throw Error("SYNC_INVALID_PROMPT_DRAFT");Object.defineProperty(current,promptId,{value:p,writable:true,enumerable:true,configurable:true});return current}
  if(Object.values(settingKey).includes(key))return p;
  throw Error("SYNC_UNKNOWN_SOURCE");
 }
 function planLocalPatch(storage,remoteDocs,options={}){
  const expected=options.expected||null;
  const captureNow=capture(storage);
  if(captureNow.warnings.length)throw Error("SYNC_LOCAL_VALIDATION_FAILED");
  if(expected){
   const now=new Map(captureNow.documents.map(x=>[x.doc_type+"::"+x.doc_id,x.payload]));
   for(const doc of remoteDocs){
    const k=doc.doc_type+"::"+doc.doc_id;
    const old=expected.get(k);
    const current=now.get(k);
    if((old===undefined)!==(current===undefined)||old!==undefined&&!same(old,current))
     throw Error("SYNC_LOCAL_CHANGED_DURING_DOWNLOAD");
   }
  }
  const originals={},updated={},keys=[];
  for(const doc of remoteDocs){
   const key=sourceOf(doc);
   if(!(key in updated)){
    const raw=storage.getItem(key);
    originals[key]=raw;
    try{
     updated[key]=raw===null?defaultFor(key):JSON.parse(raw);
    }catch{throw Error("SYNC_CORRUPT_LOCAL_SOURCE: "+key)}
   }
   updated[key]=patchedValue(key,updated[key],doc);
   if(!keys.includes(key))keys.push(key);
  }
  return{keys,originals,updated,documents:remoteDocs};
 }
 function applyLocalPatch(storage,patch,uid){
  if(!patch.keys.length)return[];
  if(!uid||!String(uid).trim())throw Error("SYNC_OWNER_REQUIRED");
  // Recheck originals before any write; if a user edited during async fetch,
  // do not overwrite. Every local update is synchronously performed.
  for(const k of patch.keys){
   if(storage.getItem(k)!==patch.originals[k])throw Error("SYNC_LOCAL_CHANGED_BEFORE_APPLY");
  }
  const backup={format:"DAVYLAB_SYNC_RECOVERY_V1",uid:String(uid),at:new Date().toISOString(),raw:patch.originals};
  const recovery=recoveryKey(uid);
  // Recovery slot must be writable *before* touching any business data.
  storage.setItem(recovery,JSON.stringify(backup));
  const changed=[];
  try{
   for(const key of patch.keys){
    const updated=JSON.stringify(patch.updated[key]);
    if(storage.getItem(key)===updated)continue;
    storage.setItem(key,updated);
    changed.push(key);
   }
   return changed;
  }catch(e){
   // Attempt rollback in reverse order, without risking source data that was
   // modified independently after our write.
   for(const key of changed.reverse()){
    try{
     if(patch.originals[key]===null)storage.removeItem(key);
     else storage.setItem(key,patch.originals[key]);
    }catch{}
   }
   throw e;
  }
 }
 return Object.freeze({VERSION,capture,sourceOf,planLocalPatch,applyLocalPatch,recoveryKey});
});
