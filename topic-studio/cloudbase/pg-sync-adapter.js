/* DAVYLAB Topic Studio · CloudBase PostgreSQL P1 adapter (not auto-enabled)
 * Confirmed target: excess-tiglon-d6gjc77qr6fa193f2
 * Depends on an INJECTED, authenticated CloudBase app.rdb() SDK object.
 * No credential embedded, no login UI, no automatic merge or real-draft write.
 */
(function(root,factory){
 "use strict";
 const API=factory(root?.DAVYLABSyncCore||(typeof module==="object"?require("./sync-core.js"):null));
 if(typeof module==="object"&&module.exports)module.exports=API;
 if(root)root.DAVYLABPGSyncAdapter=API;
})(typeof window!=="undefined"?window:null,function(core){
 "use strict";
 const ENVIRONMENT_ID="excess-tiglon-d6gjc77qr6fa193f2";
 const TABLE="davylab_ts_v1_documents";
 const RPC="davylab_ts_v1_put";
 const PAGE_SIZE=150,QA_PREFIX="__davylab_qa__";
 const clone=v=>JSON.parse(JSON.stringify(v));
 const rowsToDocuments=(rows)=>{
  if(!Array.isArray(rows))throw Error("PG_LIST_INVALID_RESPONSE");
  return rows.map(x=>{
   if(!x||typeof x.doc_type!=="string"||typeof x.doc_id!=="string"
      ||!x.payload||typeof x.payload!=="object"||Array.isArray(x.payload)
      ||!Number.isInteger(x.revision)||x.revision<1){
    throw Error("PG_LIST_INVALID_DOCUMENT");
   }
   return {doc_type:x.doc_type,doc_id:x.doc_id,payload:clone(x.payload),
    revision:x.revision,updated_at:x.updated_at||null,deleted_at:x.deleted_at||null};
  });
 };
 function create(options){
  if(!core||typeof core.compare!=="function")throw Error("SYNC_CORE_REQUIRED");
  if(!options||options.environmentId!==ENVIRONMENT_ID)throw Error("WRONG_CLOUDBASE_ENVIRONMENT");
  const db=options.rdb;
  if(!db||typeof db.from!=="function"||typeof db.rpc!=="function")throw Error("AUTHENTICATED_CLOUDBASE_RDB_REQUIRED");
  let verified=Boolean(options.connectionValidated);
  let principalVerified=false;
  async function verifyPrincipal(){
   if(!verified)throw Error("LIVE_RLS_PERMISSION_GATE_NOT_PASSED");
   if(principalVerified)return true;
   const result=await db.rpc("davylab_ts_v1_is_allowed",{});
   if(result?.error)throw Error("PG_IDENTITY_GATE_REJECTED");
   const status=Array.isArray(result?.data)?result.data[0]:result?.data;
   if(status!==true)throw Error("PG_OWNER_NOT_ALLOWLISTED_OR_NOT_LOGGED_IN");
   principalVerified=true;
   return true;
  }
  async function list(){
   // Query relies on CloudBase PG table GRANT+RLS, not a caller-provided owner ID.
   // We deliberately do not send owner_uid (or any secret) from the browser.
   await verifyPrincipal();
   const docs=[];
   for(let offset=0;offset<5000;offset+=PAGE_SIZE){
    let query=db.from(TABLE).select("doc_type,doc_id,payload,revision,updated_at,deleted_at");
    if(typeof query.order==="function")query=query.order("doc_type",{ascending:true}).order("doc_id",{ascending:true});
    if(typeof query.range!=="function")throw Error("PG_RDB_RANGE_API_REQUIRED");
    const result=await query.range(offset,offset+PAGE_SIZE-1);
    if(result?.error)throw Error("PG_RLS_READ_FAILED: "+String(result.error.message||result.error.code||"unknown"));
    const page=rowsToDocuments(result?.data);
    docs.push(...page);
    if(page.length<PAGE_SIZE)return docs;
   }
   throw Error("PG_LIST_PAGINATION_LIMIT_REACHED");
  }
  async function preview(localDocuments,baseDocuments=[]){
   const remote=await list();
   if(remote.some(x=>x.deleted_at))throw Error("REMOTE_TOMBSTONE_REQUIRES_HUMAN_REVIEW");
   return {plan:core.compare(localDocuments,remote,baseDocuments),
    remoteCount:remote.length,readOnly:true,cloudWrites:0,localWrites:0};
  }
  async function productionPut(document,expectedRevision){
   if(!verified||options.productionEnabled!==true||options.permissionsVerified!==true)
    throw Error("PRODUCTION_WRITE_ACTIVATION_REQUIRED");
   await verifyPrincipal();
   if(!document||!["topic","research","growth","settings","published_record"].includes(document.doc_type)
      ||typeof document.doc_id!=="string"||document.doc_id.length<1||document.doc_id.length>512
      ||!document.payload||typeof document.payload!=="object"||Array.isArray(document.payload)
      ||!Number.isInteger(expectedRevision)||expectedRevision<0)
    throw Error("INVALID_PRODUCTION_SYNC_DOCUMENT");
   const result=await db.rpc(RPC,{
    p_type:document.doc_type,p_id:document.doc_id,p_payload:clone(document.payload),
    p_expected_revision:expectedRevision
   });
   if(result?.error){
    const msg=String(result.error.message||result.error.code||"unknown");
    if(/REVISION_CONFLICT|23505|40001|TOMBSTONE/i.test(msg))
     throw Error("SYNC_REVISION_CONFLICT");
    throw Error("PG_PRODUCTION_WRITE_REJECTED: "+msg.slice(0,180));
   }
   const response=Array.isArray(result?.data)?result.data[0]:result?.data;
   if(!response||response.doc_id!==document.doc_id||response.doc_type!==document.doc_type
      ||!Number.isInteger(response.revision)||response.revision<1)
    throw Error("PG_PRODUCTION_ACK_INVALID");
   return{doc_type:response.doc_type,doc_id:response.doc_id,revision:response.revision};
  }
  async function syntheticPut(document,expectedRevision,authorization){
   if(!verified||authorization!=="EXPLICIT_SYNTHETIC_TEST_ONLY")
     throw Error("SYNTHETIC_WRITE_GATE_NOT_PASSED");
   await verifyPrincipal();
   if(!document||typeof document.doc_id!=="string"
      ||!document.doc_id.startsWith(QA_PREFIX)
      ||!["topic","research","growth","settings","published_record"].includes(document.doc_type)
      ||!document.payload||typeof document.payload!=="object"||Array.isArray(document.payload)
      ||!Number.isInteger(expectedRevision)||expectedRevision<0)
     throw Error("ONLY_NAMESPACED_SYNTHETIC_RECORDS_ALLOWED");
   const result=await db.rpc(RPC,{
    p_type:document.doc_type,p_id:document.doc_id,
    p_payload:clone(document.payload),p_expected_revision:expectedRevision
   });
   if(result?.error)throw Error("PG_CAS_WRITE_REJECTED: "+String(result.error.message||result.error.code||"unknown"));
   const payload=Array.isArray(result?.data)?result.data[0]:result?.data;
   if(!payload||payload.doc_id!==document.doc_id||payload.doc_type!==document.doc_type
       ||!Number.isInteger(payload.revision)||payload.revision<1)
     throw Error("PG_CAS_RESPONSE_NOT_VERIFIED");
   return {doc_type:payload.doc_type,doc_id:payload.doc_id,revision:payload.revision,
    inserted:payload.inserted===true,unchanged:payload.unchanged===true};
  }
  return Object.freeze({environmentId:ENVIRONMENT_ID,table:TABLE,version:"1.0-p1",
   verifyPrincipal,list,preview,syntheticPut,productionPut,
   mode:options.productionEnabled===true&&options.permissionsVerified===true?"authorized-production":"manual-synthetic-test-only",
   productionWritesEnabled:options.productionEnabled===true&&options.permissionsVerified===true,
   automaticDownloadsEnabled:options.downloadsEnabled===true&&options.permissionsVerified===true});
 }
 return Object.freeze({ENVIRONMENT_ID,TABLE,RPC,QA_PREFIX,create,rowsToDocuments});
});
