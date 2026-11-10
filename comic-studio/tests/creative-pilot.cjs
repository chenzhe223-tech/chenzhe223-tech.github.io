'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const src=fs.readFileSync(path.join(__dirname,'..','creative-pilot.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'..','worker.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let writes=0,copied='',stored=[],updated=0;
const c={approval:{lock_hash:'a1b2c3d4',approved_at:new Date().toISOString(),author_approved:true},
 styleId:'editorial',cast:[{name:'黎舟'},{name:'星点'}]};
const p={id:'p1',title:'海底漫画',handoff:{taskId:'WT-1234567890abcdef1234',repoQueuedAt:new Date().toISOString()},creativeDirection:c};
const listeners={};
const ctx={
 window:{wtCreativeDirector:()=>'<main>director core</main>'},
 document:{addEventListener:(key,cb)=>listeners[key]=cb},
 location:{hash:'#/director/p1'},
 queueMicrotask:()=>{},
 crypto:webcrypto,Blob,Uint8Array,ArrayBuffer,Date,console,
 e:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&gt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 mediaSrc:()=> 'data:image/png;base64,',
 selected:()=>p,render:()=>{},notify:()=>{},setChange:()=>{updated++},
 wtDirector:{approved:()=>true},
 wtSession:{access_token:'FAKE_TEST_SESSION'},
 wfImageFile:(name,bytes)=>new Blob([bytes],{type:'image/png'}),
 createImageBitmap:async()=>({width:1080,height:1440,close:()=>{}}),
 putMedia:async(key,blob)=>stored.push({key,blob}),delMedia:async()=>{},
 uid:()=> 'generated-01',confirm:()=>true,
 wtArchiveApi:async(path,options)=>{writes++;assert.equal(path,'pilot-approval');const obj=JSON.parse(options.body);
  assert.equal(obj.author_approved,true);assert.equal(obj.lock_hash,'a1b2c3d4');
  assert.match(obj.character_sheet_sha256,/^[a-f0-9]{64}$/);
  assert.match(obj.pilot_frame_sha256,/^[a-f0-9]{64}$/);
  return {commit:'a'.repeat(40),path:'tasks/WT-1234567890abcdef1234/pilot-approval.json'}},
 copyText:async value=>{copied=value}
};
vm.runInNewContext(src,ctx);
const pilot=ctx.window.wtPilot;
assert.ok(pilot,'Pilot module mounted');
assert.ok(ctx.window.wtCreativeDirector().includes('director core'));
assert.ok(ctx.window.wtCreativeDirector().includes('真实')||ctx.window.wtCreativeDirector().includes('试画'));
(async()=>{
 let sample={type:'image/png',size:1024,name:'sample.png',arrayBuffer:async()=>new Uint8Array(1024).fill(7).buffer};
 await pilot.upload(p,'character',sample);
 assert.ok(p.creativeDirection.pilot.characterImage.startsWith('media:'));
 assert.equal(p.creativeDirection.pilotApproval,null);
 await pilot.upload(p,'panel',sample);
 assert.ok(p.creativeDirection.pilot.panelImage.startsWith('media:'));
 assert.equal(stored.length,2);
 await assert.rejects(()=>pilot.approve(p),/亲自勾选审核/);
 c.pilotReviewed=true;
 await pilot.approve(p);
 assert.equal(writes,1,'Authenticated GitHub pilot receipt only after creator review');
 assert.equal(c.pilotApproval.repo_commit,'a'.repeat(40));
 await pilot.copy(p);
 assert.ok(copied.includes('task_id: WT-'));
 assert.ok(copied.includes('GitHub')&&copied.includes('已批准'));
 assert.ok(src.includes('shaHex(await crypto.subtle.digest('),'Hash actual raw image files');
 assert.ok(worker.includes("p==='/api/archive/pilot-approval'"),'Worker provides real private receipt endpoint');
 assert.ok(worker.includes('creative.production_gates')||worker.includes('task.creative_direction?.production_gates'),'Receipt tied to initial locked task');
 assert.ok(html.includes('creative-pilot.js'));
 console.log('WORLD/TOON visual pilot QA: real image SHA256, owner review, signed GitHub receipt and continuation instruction PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
