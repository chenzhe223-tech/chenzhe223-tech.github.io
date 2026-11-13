"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const child=require("node:child_process");
const here=__dirname;

const sql=fs.readFileSync(path.join(here,"schema-postgres.sql"),"utf8");
assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"));
assert.ok(sql.includes("FORCE ROW LEVEL SECURITY"));
assert.ok(sql.includes("REVOKE ALL ON TABLE"));
assert.ok(sql.includes("auth.uid()"));
for(const permission of ["SELECT","INSERT","UPDATE","DELETE"]){
 assert.ok(sql.includes("FOR "+permission+" TO authenticated"),permission+" RLS policy absent");
}
assert.ok(sql.includes("revision <> OLD.revision + 1"));
assert.ok(!sql.includes("DROP TABLE "));
const defaultDeny=JSON.parse(fs.readFileSync(path.join(here,"document-rules-deny.example.json"),"utf8"));
assert.deepEqual(defaultDeny,{read:false,write:false});
const ownership=JSON.parse(fs.readFileSync(path.join(here,"document-rules-owner.example.json"),"utf8"));
assert.ok(ownership.read.includes("auth.uid"));
assert.ok(ownership.write.includes("doc._openid"));
const p0=fs.readFileSync(path.join(here,"p0.html"),"utf8");
assert.ok(p0.includes("cloudbase.full.js"));
assert.ok(p0.includes("hasLoginState"));
assert.ok(p0.includes("ap-shanghai"));
assert.ok(!p0.includes("SecretKey"));
assert.ok(!p0.includes("app.database()"));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"davylab-p0-"));
try{
 const filename=path.join(scratch,"topics.json");
 const items=[{id:"t1",title:"Test Article",format:"文章",status:"inbox",visualPlan:{style:"doodle"}},
              {id:"t2",title:"Test Poster",format:"贴图",plannedDate:"2026-11-13",status:"ready"}];
 fs.writeFileSync(filename,JSON.stringify({topics:items}));
 const before=fs.readFileSync(filename,"utf8");
 let run=child.spawnSync(process.execPath,[path.join(here,"validate-export.cjs"),filename],{encoding:"utf8",timeout:10000});
 assert.equal(run.status,0,run.stderr);
 const result=JSON.parse(run.stdout);
 assert.equal(result.valid,2);
 assert.equal(result.visualPlans,1);
 assert.equal(result.plannedDates,1);
 assert.equal(result.mode,"OFFLINE_DRY_RUN_NO_CLOUD_WRITE");
 assert.equal(result.safeToAutoMigrate,false);
 assert.equal(fs.readFileSync(filename,"utf8"),before,"validator must not modify original export");
 items.push({id:"t1",title:"Duplicate",format:"文章"});
 fs.writeFileSync(filename,JSON.stringify({topics:items}));
 run=child.spawnSync(process.execPath,[path.join(here,"validate-export.cjs"),filename],{encoding:"utf8",timeout:10000});
 assert.equal(run.status,1,"duplicate IDs must fail");
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
console.log("PASS CloudBase P0: RLS, default-deny, owner checks, no writes, backup validation and duplicate guard");
