'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const creative=fs.readFileSync(path.join(root,'creative-director.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const archive=fs.readFileSync(path.join(root,'archive.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source={id:'p1',title:'海洋机器人：漫画改编',sourceTitle:'机器人如何探索海洋深处',category:'机器人',description:'在虚构海底研究站，两个原创角色用亲身经历解释科研技术的边界。',
 sourceURLs:'https://example.org/research',factNotes:'【待核验】请审查原文',fiction:'原创虚构海底城市，不影射真实公众人物。',
 disclosure:'这是虚构的科普故事，不代表真实新闻报道。',tone:'科学讽刺',characters:'',
 panels:Array.from({length:9},(_,i)=>({id:'s'+i,title:'第 '+(i+1)+' 格',scene:'',caption:'',dialogue:'',prompt:''})),handoff:{},status:'草稿'};
const listeners={};let edits=0;let rendered=0;let lastMessage='';
const ctx={
 window:{},console,Math,Date,JSON,location:{hash:'#/director/p1'},
 document:{addEventListener:(k,fn)=>(listeners[k]=fn)},
 selected:()=>source,render:()=>{rendered++},persist:()=>{},markDirty:()=>{},setChange:()=>{edits++},
 notify:x=>{lastMessage=x},confirm:()=>true,queueMicrotask:fn=>fn(),
 heroHeader:(...args)=>'<h1>'+args[1]+'</h1>',e:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
};
vm.runInNewContext(creative,ctx);
const director=ctx.window.wtDirector;
assert.ok(director,'Director API registered');
assert.equal(director.STYLES.length,6,'Six distinct production styles');
assert.equal(director.ARCS.length,5,'Five narrative structures');
let initial=director.readiness(source);
assert.ok(initial.length>0,'Unreviewed project cannot be queued');
const seed=director.ensure(source);
assert.ok(seed.cast.length>=2);
director.draft(source);
assert.equal(source.panels.length,9);
assert.ok(source.panels.every(x=>x.scene.length>=30&&x.title&&x.caption));
assert.ok(director.checks(source).includes('请勾选“已逐格审阅并确认创意方向”'));
let markup=ctx.window.wtCreativeDirector();
for(const expected of ['创意导演台','画风定调','人物设定','九格故事','最终定版'])assert.ok(markup.includes(expected),'Missing visual feature '+expected);
const fake=(dataset,extra={})=>({target:{closest:()=>({dataset,...extra})},preventDefault:()=>{},stopImmediatePropagation:()=>{}});
listeners.click(fake({directorStep:'3'}));
seed.reviewed=true;
assert.equal(director.checks(source).length,0,'All creative requirements complete before approving');
listeners.click(fake({directorAction:'approve'}));
assert.equal(director.approved(source),true,'Human approved locked blueprint');
assert.equal(director.readiness(source).length,0);
const payload=director.exportBrief(source);
assert.equal(payload.lock_status,'approved');
assert.equal(payload.characters.length,2);
assert.equal(payload.storyboard.length,9);
assert.equal(payload.production_gates.pilot_required,true);
assert.equal(payload.production_gates.pilot_approval_required,true);
assert.ok(payload.approval.lock_hash);
const before=payload.approval.lock_hash;
source.panels[0].scene+='修改了一处人物行为';
assert.equal(director.approved(source),false,'Any storyboard drift invalidates lock');
assert.ok(director.readiness(source).length);
source.panels[0].scene=payload.storyboard[0].scene;
assert.equal(director.approved(source),true,'Restoring approved contents revalidates fingerprint');
source.creativeDirection.styleId='woodcut';
assert.equal(director.approved(source),false,'Style changes invalidate lock');
source.creativeDirection.styleId=payload.style_id;
assert.equal(director.digest(source),before);
source.handoff.repoQueuedAt=new Date().toISOString();
listeners.change({target:{matches:()=>true,dataset:{directorField:'world'},value:'不同世界'},preventDefault:()=>{}});
assert.notEqual(source.creativeDirection.world,'不同世界','Already queued task cannot change under same version');
assert.ok(lastMessage.includes('不能直接覆盖'));
assert.ok(app.includes("missing.push(...wtDirector.readiness(p))"),'App gates task readiness');
assert.ok(app.includes('creative_direction:wtDirector.exportBrief(p)'),'Task includes locked creative brief');
assert.ok(app.includes('先输出定妆图 character-sheet.png'),'Prompt requires early visual prototype');
assert.ok(archive.includes('creative_direction:o.creative_direction||null'),'GitHub queue includes approved blueprint');
assert.ok(worker.includes('CREATIVE_APPROVAL_REQUIRED'),'Server enforces signed author creative approval');
assert.ok(worker.includes('creative-director\\.js'),'Production Worker serves director UI');
assert.ok(html.includes('creative-director.js')&&html.includes('creative-director.css'),'App loads director modules');
assert.ok(html.includes('#/director'),'Creative director has navigation');
console.log('WORLD/TOON creative director: 6 styles, 5 arcs, storyboard, cast, manual lock, drift guard, GitHub handoff, server gate PASS');
