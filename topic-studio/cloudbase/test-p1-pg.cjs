"use strict";
/* Static SQL assertions + isolated SDK-mock transport tests.
 * This is NOT a live CloudBase RLS/transaction test.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const core=require("./sync-core.js"),pg=require("./pg-sync-adapter.js");
const sql=fs.readFileSync(path.join(__dirname,"schema-postgres-p1-excess-tiglon.sql"),"utf8");
assert.match(sql,/TARGET ENVIRONMENT ONLY: excess-tiglon-d6gjc77qr6fa193f2/);
assert.equal(pg.ENVIRONMENT_ID,"excess-tiglon-d6gjc77qr6fa193f2");
assert.equal(pg.TABLE,"davylab_ts_v1_documents");
for(const name of ["cron_locks","dashboard_metrics","mail_board_snapshots"]){
 assert.doesNotMatch(sql,new RegExp("(?:DROP|ALTER|INSERT|DELETE|UPDATE|TRUNCATE)\\s+(?:TABLE\\s+)?(?:public\\.)?"+name+"\\b","i"),
  "Existing table "+name+" must never be modified");
}
assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.davylab_ts_v1_allowed_owners/);
assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.davylab_ts_v1_documents/);
assert.match(sql,/ALTER TABLE public\.davylab_ts_v1_documents ENABLE ROW LEVEL SECURITY/);
assert.match(sql,/REVOKE ALL ON TABLE public\.davylab_ts_v1_documents FROM PUBLIC, anon, authenticated/);
assert.match(sql,/GRANT SELECT ON TABLE public\.davylab_ts_v1_documents TO authenticated/);
assert.doesNotMatch(sql,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*davylab_ts_v1_documents\s+TO\s+authenticated/i);
assert.match(sql,/CREATE POLICY davylab_ts_v1_owner_read/);
assert.match(sql,/owner_uid = \(SELECT auth\.uid\(\)\)/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.davylab_ts_v1_is_allowed/);
assert.match(sql,/CREATE OR REPLACE FUNCTION public\.davylab_ts_v1_put/);
assert.match(sql,/SECURITY DEFINER/);
assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'authenticated'/);
assert.match(sql,/public\.davylab_ts_v1_is_allowed\(\)/);
assert.match(sql,/p_expected_revision <> 0/);
assert.match(sql,/previous_revision <> p_expected_revision/);
assert.match(sql,/FOR UPDATE/);
assert.match(sql,/DAVYLAB_REVISION_CONFLICT/);
assert.match(sql,/deleted_at IS NOT NULL/);
assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE TABLE/i);
assert.match(sql,/COMMIT;/);
const document={doc_type:"topic",doc_id:"__davylab_qa__testing-1",payload:{title:"Synthetic QA",status:"inbox"}};
const remote=[{doc_type:"topic",doc_id:document.doc_id,payload:{...document.payload},
 revision:1,updated_at:"2026-11-15T00:00:00Z",deleted_at:null}];
function dbMock({allowed=true,canWrite=true}={}){
 const calls=[];
 return {
  calls,
  rpc:async(name,args)=>{
   calls.push({kind:"rpc",name,args});
   if(name==="davylab_ts_v1_is_allowed")return{data:allowed};
   if(!canWrite)return{error:{message:"DAVYLAB_REVISION_CONFLICT"}};
   return{data:{doc_type:args.p_type,doc_id:args.p_id,revision:args.p_expected_revision+1,inserted:args.p_expected_revision===0}};
  },
  from:table=>{
   calls.push({kind:"from",table});
   return{
    select(){
     return{
      order(){return this},
      async range(from,to){
       calls.push({kind:"range",from,to});
       return{data:remote.slice(from,to+1)};
      }
     };
    }
   };
  }
 };
}
(async()=>{
 assert.throws(()=>pg.create({environmentId:"cloud1-d3guyfuxtfeef189a",rdb:dbMock()}),
  /WRONG_CLOUDBASE_ENVIRONMENT/);
 const baseDb=dbMock();
 const adapter=pg.create({environmentId:pg.ENVIRONMENT_ID,rdb:baseDb});
 assert.equal(adapter.productionWritesEnabled,false);
 assert.equal(adapter.automaticDownloadsEnabled,false);
 await assert.rejects(adapter.list(),/LIVE_RLS_PERMISSION_GATE_NOT_PASSED/);
 await assert.rejects(adapter.syntheticPut(document,0,"EXPLICIT_SYNTHETIC_TEST_ONLY"),/SYNTHETIC_WRITE_GATE_NOT_PASSED/);
 assert.equal(baseDb.calls.length,0,"No remote access without explicit verified gateway configuration");

 const restrictedDb=dbMock({allowed:false});
 const restricted=pg.create({environmentId:pg.ENVIRONMENT_ID,rdb:restrictedDb,connectionValidated:true});
 await assert.rejects(restricted.list(),/PG_OWNER_NOT_ALLOWLISTED/);
 assert.equal(restrictedDb.calls.filter(x=>x.kind==="from").length,0,"Denied principal must not read table");

 const db=dbMock(),client=pg.create({environmentId:pg.ENVIRONMENT_ID,rdb:db,connectionValidated:true});
 const docs=await client.list();
 assert.deepEqual(docs[0].payload,document.payload);
 assert.equal(db.calls[0].name,"davylab_ts_v1_is_allowed");
 assert.equal(db.calls[1].table,pg.TABLE);
 const preview=await client.preview([{...document}],[]);
 assert.equal(preview.readOnly,true);
 assert.equal(preview.cloudWrites,0);
 assert.equal(preview.localWrites,0);
 assert.equal(preview.plan.summary.identical,1);
 assert.equal(db.calls.filter(x=>x.name==="davylab_ts_v1_put").length,0,
  "Preview cannot write to cloud");
 await assert.rejects(client.syntheticPut({...document,doc_id:"real-user-article"},0,"EXPLICIT_SYNTHETIC_TEST_ONLY"),
  /ONLY_NAMESPACED_SYNTHETIC_RECORDS_ALLOWED/);
 await assert.rejects(client.syntheticPut(document,0),/SYNTHETIC_WRITE_GATE_NOT_PASSED/);
 const ack=await client.syntheticPut(document,0,"EXPLICIT_SYNTHETIC_TEST_ONLY");
 assert.equal(ack.doc_id,document.doc_id);
 assert.equal(ack.revision,1);
 assert.equal(db.calls.at(-1).name,pg.RPC);
 assert.equal(db.calls.at(-1).args.p_expected_revision,0);
 const staleDb=dbMock({canWrite:false});
 const stale=pg.create({environmentId:pg.ENVIRONMENT_ID,rdb:staleDb,connectionValidated:true});
 await assert.rejects(stale.syntheticPut(document,1,"EXPLICIT_SYNTHETIC_TEST_ONLY"),
  /PG_CAS_WRITE_REJECTED/);
 console.log("PASS P1 SQL safety contracts, exact excess-tiglon target, no cloud auto-writes, owner gate, CAS RPC test");
})().catch(err=>{console.error(err);process.exit(1)});
