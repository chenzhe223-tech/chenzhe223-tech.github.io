/* DAVYLAB Topic Studio · Offline-first automatic sync orchestrator.
 * Pure dependency-injected implementation; no SDK credentials and no UI.
 * When live activation is approved: login -> pull -> merge safely -> push
 * local-only/changed docs with revision CAS -> other device polls automatically.
 */
(function(root,factory){
 "use strict";
 const api=factory(root?.DAVYLABSyncCore||(typeof module==="object"?require("./sync-core.js"):null),
                   root?.DAVYLABAutoSyncModel||(typeof module==="object"?require("./auto-sync-model.js"):null));
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.DAVYLABAutoSyncEngine=api;
})(typeof window!=="undefined"?window:null,function(core,model){
 "use strict";
 if(!core||!model)throw Error("DAVYLAB_SYNC_DEPENDENCIES_MISSING");
 const VERSION="0.1.0-auto-two-way";
 const namespace="davylab-auto-sync";
 const allowedKeys=new Set(core.SOURCES.map(x=>x.key));
 const same=(a,b)=>core.stable(a)===core.stable(b);
 const k=d=>d.doc_type+"::"+d.doc_id;
 const isObject=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const clone=v=>JSON.parse(JSON.stringify(v));
 function baselineKey(uid){return namespace+":baseline:"+uid}
 function initialBackupKey(uid){return namespace+":first-backup:"+uid}
 function boundOwnerKey(){return namespace+":bound-owner"}
 function loadBaseline(storage,uid){
  let parsed;
  try{parsed=JSON.parse(storage.getItem(baselineKey(uid))||"[]")}
  catch{throw Error("SYNC_BASELINE_CORRUPT")}
  if(!Array.isArray(parsed))throw Error("SYNC_BASELINE_INVALID");
  const duplicates=new Set();
  for(const d of parsed){
   if(!d||!isObject(d.payload)||!Number.isInteger(d.revision)||d.revision<1)throw Error("SYNC_BASELINE_INVALID");
   if(duplicates.has(k(d)))throw Error("SYNC_BASELINE_DUPLICATE");
   duplicates.add(k(d));
  }
  return parsed;
 }
 function build(options){
  const storage=options?.storage,adapter=options?.adapter,uid=options?.uid;
  if(!storage||typeof storage.getItem!=="function"||typeof storage.setItem!=="function"
     ||!adapter||typeof adapter.list!=="function"||typeof adapter.productionPut!=="function"
     ||typeof uid!=="string"||!uid.trim()||uid.length>128)
   throw Error("SYNC_ENGINE_INVALID_CONFIGURATION");
  if(options.productionEnabled!==true||options.permissionsVerified!==true)
   throw Error("SYNC_LIVE_SECURITY_GATE_REQUIRED");
  const emit=typeof options.onStatus==="function"?options.onStatus:()=>{};
  const refresh=typeof options.onApplied==="function"?options.onApplied:()=>{};
  const pollMs=Math.max(30000,Number(options.pollMs)||45000);
  const epoch=typeof options.now==="function"?options.now:()=>Date.now();
  let busy=false,again=false,stopped=false,pendingLocal=false,timer=null,debounce=null,failures=0,lastSync=0;
  const win=options.win||null;
  let state={phase:"idle",owner:uid,lastSync:null,conflicts:[],pending:0,upload:0,download:0,error:null};
  function status(next){
   state={...state,...next};
   emit({...state,conflicts:state.conflicts.slice()});
  }
  function assertOwner(){
   const owner=storage.getItem(boundOwnerKey());
   if(owner!==null&&owner!==uid)throw Error("SYNC_LOCAL_DATA_BOUND_TO_DIFFERENT_ACCOUNT");
   // First owner binding occurs only after secure cloud approval.
   if(owner===null)storage.setItem(boundOwnerKey(),uid);
  }
  function ensureBackup(){
   if(storage.getItem(initialBackupKey(uid))!==null)return;
   const backup=core.backup(storage);
   if(backup.warnings.some(x=>["CORRUPT_LOCAL_JSON","UNEXPECTED_LOCAL_SHAPE","LOCAL_STORAGE_UNAVAILABLE"].includes(x.code)))
    throw Error("SYNC_LOCAL_DATA_INVALID_BACKUP_REQUIRED");
   const raw=JSON.stringify(backup);
   if(raw.length>core.MAX_BACKUP_BYTES)throw Error("SYNC_FIRST_BACKUP_EXCEEDS_LIMIT");
   storage.setItem(initialBackupKey(uid),raw);
  }
  function saveBaseline(documents){
   const raw=JSON.stringify(documents);
   if(raw.length>core.MAX_BACKUP_BYTES)throw Error("SYNC_BASELINE_EXCEEDS_LIMIT");
   storage.setItem(baselineKey(uid),raw);
  }
  function schedule(ms){
   if(stopped||options.disableTimers)return;
   if(timer)clearTimeout(timer);
   timer=setTimeout(()=>{timer=null;void sync("poll")},ms);
  }
  function debounceLocal(){
   if(stopped)return;
   pendingLocal=true;
   status({pending:1});
   if(options.disableTimers)return;
   if(debounce)clearTimeout(debounce);
   debounce=setTimeout(()=>{debounce=null;void sync("local-change")},850);
  }
  async function sync(reason="auto"){
   if(stopped)return{skipped:"stopped"};
   if(reason==="poll"&&win?.document?.visibilityState==="hidden"){
    schedule(Math.max(180000,pollMs*4));
    return{skipped:"background"};
   }
   if(busy){again=true;return{skipped:"busy"}}
   if(win?.navigator?.onLine===false){status({phase:"offline",pending:1});schedule(Math.min(120000,pollMs*2));return{skipped:"offline"}}
   busy=true;again=false;
   status({phase:"syncing",error:null});
   let summary={upload:0,download:0,conflicts:0,readOnly:false};
   try{
    assertOwner();
    ensureBackup();
    const local=model.capture(storage);
    if(local.warnings.length)throw Error("SYNC_UNSUPPORTED_OR_CORRUPT_RECORDS: "+local.warnings.map(x=>x.code).join(","));
    const base=loadBaseline(storage,uid);
    const remote=await adapter.list();
    if(stopped)return{skipped:"stopped-during-read"};
    if(!Array.isArray(remote))throw Error("SYNC_REMOTE_INVALID_RESULT");
    if(remote.some(x=>x.deleted_at))throw Error("SYNC_REMOTE_TOMBSTONE_REQUIRES_REVIEW");
    const localDocs=local.documents;
    const plan=core.compare(localDocs,remote,base);
    const index=new Map(base.map(x=>[k(x),clone(x)]));
    const remoteMap=new Map(remote.map(x=>[k(x),x]));
    const conflicts=plan.conflicts.map(c=>({key:c.key,reason:c.reason}));
    for(const key of [...plan.identical,...plan.unchanged]){
     const server=remoteMap.get(key);
     if(server)index.set(key,clone(server));
    }
    // Apply remote-only or remote-changed records, preserving unrelated local
    // records. Recheck live storage before applying to reject in-flight edits.
    if(!stopped&&plan.download.length){
     const candidate=plan.download.map(x=>x.document);
     const localAtRead=new Map(localDocs.map(x=>[k(x),x.payload]));
     const patch=model.planLocalPatch(storage,candidate,{expected:localAtRead});
     const keys=model.applyLocalPatch(storage,patch,uid);
     for(const row of candidate)index.set(k(row),clone(row));
     summary.download=candidate.length;
     if(keys.length)refresh(keys);
    }
    // Upload only records that are proved safe by a three-way comparison.
    // Stale server revision causes a hard stop for that one record. No retry
    // with revised expectedRevision or silent overwrite.
    for(const candidate of plan.upload){
     if(stopped)break;
     const document=candidate.document;
     const token=k(document);
     const current=model.capture(storage).documents.find(x=>k(x)===token);
     if(!current||!same(current.payload,document.payload)){
      conflicts.push({key:token,reason:"LOCAL_CHANGED_DURING_UPLOAD"});continue;
     }
     const server=remoteMap.get(token);
     const expected=server?server.revision:0;
     try{
      const ack=await adapter.productionPut(document,expected);
      if(ack.doc_type!==document.doc_type||ack.doc_id!==document.doc_id
        ||!Number.isInteger(ack.revision))throw Error("SYNC_CAS_ACK_INVALID");
      index.set(token,{...clone(document),revision:ack.revision});
      summary.upload++;
     }catch(e){
      const message=String(e?.message||e);
      if(/CONFLICT|TOMBSTONE|23505|40001/.test(message)){
       conflicts.push({key:token,reason:"SERVER_REVISION_CONFLICT"});
       continue;
      }
      throw e;
     }
    }
    // Each successfully merged/confirmed document forms the new baseline.
    // Conflicting records keep their previous baseline for manual resolution.
    if(stopped)return{skipped:"stopped-before-baseline"};
    saveBaseline([...index.values()]);
    summary.conflicts=conflicts.length;
    failures=0;pendingLocal=conflicts.length>0;lastSync=epoch();
    status({phase:conflicts.length?"conflict":"synced",conflicts,pending:conflicts.length,
     upload:summary.upload,download:summary.download,lastSync:new Date(lastSync).toISOString(),error:null});
    return summary;
   }catch(error){
    failures++;
    status({phase:"error",error:String(error?.message||error).slice(0,220),pending:1});
    throw error;
   }finally{
    busy=false;
    const delay=Math.min(120000,pollMs*Math.pow(1.7,Math.min(failures,3)));
    if(again&&!stopped)schedule(1200);
    else schedule(delay);
   }
  }
  function notifyLocalStorageKey(key){
   if(allowedKeys.has(key))debounceLocal();
  }
  function start(){
   if(stopped)throw Error("SYNC_ENGINE_STOPPED");
   const handlers=[];
   if(win&&!options.disableTimers){
    const onFocus=()=>{void sync("focus").catch(()=>{})};
    const onOnline=()=>{void sync("online").catch(()=>{})};
    const onStorage=e=>{if(allowedKeys.has(e?.key))debounceLocal()};
    win.addEventListener("focus",onFocus);handlers.push(["focus",onFocus]);
    win.addEventListener("online",onOnline);handlers.push(["online",onOnline]);
    win.addEventListener("storage",onStorage);handlers.push(["storage",onStorage]);
    const onVisibility=()=>{if(win.document?.visibilityState==="visible")void sync("visible").catch(()=>{})};
    win.document?.addEventListener("visibilitychange",onVisibility);
    handlers.push(["document:visibilitychange",onVisibility]);
   }
   // Caller keeps stop closure, so no stale timers/owner sessions after logout.
   void sync("login").catch(()=>{});
   return()=>{
    if(timer)clearTimeout(timer);
    if(debounce)clearTimeout(debounce);
    for(const [type,fn] of handlers){
     if(type.startsWith("document:"))win.document?.removeEventListener(type.slice(9),fn);
     else win?.removeEventListener(type,fn);
    }
    stopped=true;
   };
  }
  function stop(){
   stopped=true;
   if(timer)clearTimeout(timer);
   if(debounce)clearTimeout(debounce);
   status({phase:"stopped"});
  }
  return Object.freeze({VERSION,uid,sync,notifyLocalStorageKey,start,stop,
   state:()=>({...state,conflicts:state.conflicts.slice()}),baselineKey:baselineKey(uid)});
 }
 return Object.freeze({VERSION,build,baselineKey,initialBackupKey,boundOwnerKey});
});
