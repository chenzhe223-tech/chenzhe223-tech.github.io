'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const creative=fs.readFileSync(path.join(root,'creative-director.js'),'utf8');
const visualV3=fs.readFileSync(path.join(root,'style-v3.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const archive=fs.readFileSync(path.join(root,'archive.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/creative-director\.js\?v=4\.1\.1/,'cast-to-storyboard synchronization must bypass stale cached director script');
const source={id:'p1',title:'海洋机器人：漫画改编',sourceTitle:'机器人如何探索海洋深处',category:'机器人',description:'在虚构海底研究站，两个原创角色用亲身经历解释科研技术的边界。',
 sourceURLs:'https://example.org/research',factNotes:'【待核验】请审查原文',fiction:'原创虚构海底城市，不影射真实公众人物。',
 disclosure:'这是虚构的科普故事，不代表真实新闻报道。',tone:'科学讽刺',characters:'',
 panels:Array.from({length:9},(_,i)=>({id:'s'+i,title:'第 '+(i+1)+' 格',scene:'',caption:'',dialogue:'',prompt:''})),handoff:{},status:'草稿'};
const listeners={};let edits=0;let rendered=0;let lastMessage='';
const ctx={
 window:{},console,Math,Date,JSON,location:{hash:'#/director/p1'},
 document:{addEventListener:(k,fn)=>{(listeners[k]||(listeners[k]=[])).push(fn);}}, 
 selected:()=>source,render:()=>{rendered++},persist:()=>{},markDirty:()=>{},setChange:()=>{edits++},
 notify:x=>{lastMessage=x},confirm:()=>true,queueMicrotask:fn=>fn(),
 heroHeader:(...args)=>'<h1>'+args[1]+'</h1>',e:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
};
vm.runInNewContext(visualV3,ctx);
vm.runInNewContext(creative,ctx);
const director=ctx.window.wtDirector;
assert.ok(director,'Director API registered');
assert.equal(ctx.window.WTStyleV3.CATALOG.length,25,'Twenty-five catalog styles including four new 3D render references');
assert.equal(director.STYLES.length,31,'25 catalog styles and 6 backward-compatible production styles');
assert.equal(director.ARCS.length,6,'Six narrative structures including viral short drama');
let initial=director.readiness(source);
assert.ok(initial.length>0,'Unreviewed project cannot be queued');
const seed=director.ensure(source);
assert.ok(seed.cast.length>=2);
director.draft(source);
assert.equal(source.panels.length,9);
assert.ok(source.panels.every(x=>x.scene.length>=30&&x.title&&x.caption));
assert.ok(director.checks(source).includes('请勾选“已逐格审阅并确认创意方向”'));
// A post-generation cast edit must propagate into matching story text without
// disturbing unrelated hand-authored panel content.
seed.cast[0].name='苏见微';seed.cast[0].look='黑长发，眉眼清晰';
source.panels[0].scene='苏见微走进公寓，黑长发，眉眼清晰；暴雨仍在窗外，远处城市灯火映在玻璃上，房间里只剩钟声。';
source.panels[0].dialogue='苏见微：我会自己作出选择。';
const changeCast=(key,index,value)=>listeners.change[1]({target:{matches:()=>true,dataset:{directorCast:key,characterIndex:String(index)},value},preventDefault(){}});
changeCast('name',0,'贺庭洲');
assert.match(source.panels[0].scene,/贺庭洲走进公寓/,'renaming a character updates scene text');
assert.match(source.panels[0].dialogue,/贺庭洲：/,'renaming a character updates dialogue');
assert.match(source.panels[0].scene,/暴雨仍在窗外/,'sync preserves unrelated panel prose');
changeCast('look',0,'银灰短发、左眉有浅色疤痕');
assert.match(source.panels[0].scene,/银灰短发、左眉有浅色疤痕/,'appearance edits propagate to matching scene text');
assert.equal(source.characters.includes('贺庭洲'),true,'cast bible and panel text stay aligned');
let markup=ctx.window.wtCreativeDirector();
for(const expected of ['创意导演台','画风定调','人物设定','剧情分镜','最终定版'])assert.ok(markup.includes(expected),'Missing visual feature '+expected);
const fake=(dataset,extra={})=>({target:{closest:()=>({dataset,...extra})},preventDefault:()=>{},stopImmediatePropagation:()=>{}});
listeners.click[0](fake({directorStep:'3'}));
seed.reviewed=true;
assert.equal(director.checks(source).length,0,'All creative requirements complete before approving');
for(const listener of listeners.click)listener(fake({directorAction:'approve'}));
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
listeners.change[1]({target:{matches:()=>true,dataset:{directorField:'world'},value:'不同世界'},preventDefault:()=>{}});
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
const paletteCss=fs.readFileSync(path.join(root,'creative-director.css'),'utf8');
for(const st of director.STYLES.filter(x=>['editorial','warm','woodcut','cinematic','diagram','comic'].includes(x.id)))assert.ok(paletteCss.includes('.director-theme-'+st.id+'{'),'Legacy styles preserve original palette');
assert.ok(visualV3.includes('wt-v3-card-visual'),'V3 atlas renders style-spec cards, not fake sample art');
assert.ok(visualV3.includes('not_generated'),'Not-ready styles must be explicit');
assert.ok(!/\sstyle="/.test(creative),'Director markup must not include CSP-blocked inline styles');
assert.ok(creative.includes('WTStyleV3.cards(c)'),'Director now reads the V3 style atlas');
assert.ok(creative.includes('WTStyleV3.detail(c)'),'Director renders actual reference/sample provenance states');
assert.ok(html.includes('style-v3.js')&&html.includes('style-v3.css'),'App must load V3 assets');
assert.ok(worker.includes('style-v3\\.js')&&worker.includes('style-v3\\.css'),'Worker must allow V3 asset URLs');
console.log('WORLD/TOON creative director: 25 catalog styles + 6 legacy styles, six narrative arcs, approved storyboard and GitHub gates PASS');

