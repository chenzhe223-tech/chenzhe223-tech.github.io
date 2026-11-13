'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
for(const file of ['app.js','archive.js','worldtoon-v3.js','worldtoon-v3-import.js','worldtoon-v3-review.js','creative-director.js','creative-pilot.js','workflow-v4.js']) {
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file+' parses');
}
const app=read('app.js'),html=read('index.html'),engine=read('worldtoon-v3.js'),
      importer=read('worldtoon-v3-import.js'),archive=read('archive.js'),css=read('workflow-v4.css');
assert.match(app,/'workspace'[,']/, 'workspace exists in legacy router');
assert.match(app,/nav\('workspace\/'\+p\.id\)/,'new project opens integrated workspace');
assert.match(app,/APP_KEY='davylab-comic-press-v1'/,'existing local storage key preserved');
assert.match(html,/worldtoon-v3\.js\?v=4\.7\.0/,'new workspace is bundled into the Worker-allowlisted script');
assert.match(html,/worldtoon-v3\.css\?v=4\.7\.0/,'new workspace CSS is bundled into the Worker-allowlisted stylesheet');
assert.match(engine,/WORKFLOW_V4_EMBED/,'built script includes v4 module');
assert.ok(engine.trimEnd().endsWith(read('workflow-v4.js').trim()),'deployed script matches canonical v4 code');
assert.ok(read('worldtoon-v3.css').trimEnd().endsWith(css.trim()),'deployed stylesheet matches canonical v4 code');
assert.ok(read('styles.css').trimEnd().endsWith(read('mobile-refine.css').trim()),'existing mobile layout is included in Worker-allowed stylesheet');
assert.match(html,/styles\.css\?v=4\.6\.1/,'mobile stylesheet uses a fresh allowed asset');
assert.doesNotMatch(html,/href="mobile-refine\.css/,'mobile stylesheet must not 404 on Worker');

assert.match(html,/经典创作编辑器/,'old editor remains reachable');
assert.match(html,/原制作交接明细/,'old handoff remains available');
for(const route of ['dashboard','live','workspace','production','library']) {
  assert.match(html,new RegExp('href="#/'+route+'"'),'primary navigation: '+route);
}
assert.match(engine,/nav\('workspace\/'\+v\.id\+'\/1'\)/,'series continuation inherits the unified workflow');
assert.match(importer,/p\.creativeDirection\?\.pilotApproval\?\.repo_commit/,'ZIP auto-next respects independent pilot approval');
assert.match(archive,/'workspace','dashboard'/,'GitHub refresh updates integrated route');
assert.match(archive,/Keep the last verified catalog/,'stale sync must not hide verified work');
assert.match(app,/wfMode\(p\)!=='original'&&!validSources\(p\)\.length/,'original fiction must not require fabricated news URLs');
assert.match(app,/task\.producer==='WorkBuddy'/,'handoff pack uses the chosen production agent');
assert.match(css,/@media\(max-width:720px\)/,'mobile workspaces collapse into readable layouts');
assert.match(read('workflow-v4.js'),/wtArchiveApi\('deepseek-status'\)/,'DeepSeek status uses authenticated read-only probe');
assert.match(css,/\.wt4-series-chapters/,'series navigation is inside the workspace');
const eventCallbacks={};
const p={id:'p1',title:'未命名新作',category:'科幻',panels:Array.from({length:9},()=>({scene:'',image:''})),handoff:{},productionAgent:'ChatGPT'};
const p2={id:'p2',title:'另一个作品',category:'奇幻',panels:Array.from({length:4},()=>({scene:'',image:''})),handoff:{}};
let current=p,approved=false,navResult='';
const ctx={
  window:{},document:{addEventListener:(type,fn)=>{(eventCallbacks[type]??=[]).push(fn)}},
  location:{hash:''},queueMicrotask:()=>{},ui:{wt4Step:-1,stage:0},
  data:{projects:[p,p2],topics:[],characters:[]},dashboard:()=>'<main id="legacy-home">Existing dashboard</main>',
  selected:()=>current,activeProjects:()=>[p,p2],findProject:id=>[p,p2].find(x=>x.id===id)||null,
  e:v=>String(v??'').replace(/[&<>"']/g,''),wtArchiveSnapshot:{library:{items:[]}},
  wtDirector:{approved:()=>approved},studioStage:()=>'<section id="source-stage">Source editor</section>',
  studio:()=>'<section id="ai-stage">DeepSeek editor</section>',
  wtCreativeDirector:()=>'<section id="director-stage">Story bible editor</section>',
  wtWorkflow:()=>'<section id="production-stage">Agent handoff editor</section>',
  publish:()=>'<section id="publication-stage">Author QA editor</section>',
  nav:route=>{navResult=route;},render(){},setChange:(p,desc)=>{p.updatedAt='2026-11-13T09:00:00Z'},notify:()=>{},newProject:()=>{current={id:'new-p',title:'未命名新作',panels:Array.from({length:9},()=>({scene:''})),handoff:{}};ctx.data.projects.unshift(current)},
};
vm.runInNewContext(read('workflow-v4.js'),ctx,{filename:'workflow-v4.js'});
const {state,verifiedPublished,stageNames,characterSnapshot,linkCharacter,entryHub,characterStage,saveEntry}=ctx.window.WT4Workflow;
assert.deepEqual(Array.from(stageNames),['故事方案','角色设定','剧情分镜','视觉风格','正式生成','审阅精修','导出发布']);
assert.equal(state(p).next,0,'empty work starts at story');
p.title='海底城市';
p.description='原创海底城市里，维修工发现城市的能源配额被神秘机构改写。';
assert.equal(state(p).next,1,'story description advances to character stage');
const original={id:'char1',characterId:'char1',version:2,originalName:'黎舟',name:'黎舟',
 gender:'非二元',age:'青年',profession:'调查员',description:'短发与圆形眼镜',
 costume:'墨绿外套',traits:'银色指南针',personality:'谨慎但勇敢',colors:'绿色',portrait:''};
ctx.data.characters.push(original);
const before=JSON.stringify(original);
assert.equal(linkCharacter(p,original),true,'confirmed character is linked with immutable snapshot');
assert.equal(linkCharacter(p,original),false,'linking same character is idempotent');
assert.equal(p.characterRefs[0].version,2,'asset version pinned');
original.description='修改后的原型';
assert.equal(p.characterRefs[0].snapshot.description,'短发与圆形眼镜','project version does not drift with catalog');
assert.equal(p.characterRefs[0].snapshot.gender,'非二元','custom gender preserved');
assert.equal(characterSnapshot(original).version,2);
assert.equal(state(p).next,2,'character asset advances to storyboard');
p.panels.forEach((panel,i)=>panel.scene='原创漫画的完整镜头画面场景与人物行动说明 '+i);
assert.equal(state(p).next,3,'all nine storyboards ready for style signoff');
p.creativeDirection={styleId:'editorial',approval:{lock_hash:'test-only-lock',author_approved:true}};
approved=true;
assert.equal(state(p).next,4,'signed style unlocks production');
p.handoff={taskId:'WT-11111111111111111111',repoQueuedAt:'2026-11-11T00:00:00Z'};
assert.equal(state(p).next,4,'queued task is not generated artwork');
p.handoff.stagedFiles=Array.from({length:10},(_,i)=>({path:i?'panels/'+i+'.png':'cover.png'}));
p.handoff.stageUploaded=p.handoff.stagedFiles.map(x=>x.path);
assert.equal(state(p).next,5,'files uploaded still require independent QA');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'ready_for_workbuddy'}];
assert.equal(state(p).next,6,'remote independent QA can advance to export/publish');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'published',receipt:{status:'published',url:'https://mp.weixin.qq.com/s/RealArticle'}}];
assert.equal(state(p).next,6,'published is terminal');
assert.equal(verifiedPublished({status:'published',receipt:{status:'draft_uploaded',url:'https://mp.weixin.qq.com/s/RealArticle'}}),false);
assert.equal(verifiedPublished({status:'published',receipt:{status:'published',url:'https://example.invalid/fake'}}),false);
const saved=JSON.stringify(p),shell=ctx.window.wt4Workspace();
assert.equal(JSON.stringify(p),saved,'render cannot mutate project or its character bible');
assert.match(shell,/PROJECT JOURNEY/);
assert.match(shell,/保存状态/,'save state displayed');
assert.equal((shell.match(/class="wt4-step(?: |")/g)||[]).length,7,'seven stages');
assert.match(shell,/下一步/);
const home=ctx.dashboard();
for(const entry of ['热点改编','一句话创作','自主创作'])assert.match(home,new RegExp(entry));
assert.match(home,/wt4-entry-grid/,'three paths have prominent first screen');
ctx.ui.wt4Step=1;
const castView=ctx.window.wt4Workspace();
assert.match(castView,/角色资产库/);
assert.match(castView,/版本 v2 已固定/);
assert.equal(JSON.stringify(original).includes('短发与圆形眼镜'),false,'catalog edit stayed isolated');
ctx.ui.wt4Step=2;assert.match(ctx.window.wt4Workspace(),/剧情分镜/);
ctx.ui.wt4Step=3;assert.match(ctx.window.wt4Workspace(),/director-stage/);
ctx.ui.wt4Step=4;assert.match(ctx.window.wt4Workspace(),/production-stage/);
assert.match(ctx.window.wt4Production(),/正式生成/,'production nav targets generation');
ctx.ui.wt4Step=5;assert.match(ctx.window.wt4Workspace(),/成品回传与 QA/);
ctx.ui.wt4Step=6;assert.match(ctx.window.wt4Workspace(),/publication-stage/);
p.seriesId='series1';p.seriesTitle='深海';p.seriesEpisode=1;
p2.seriesId='series1';p2.seriesEpisode=2;
assert.match(ctx.window.wt4Workspace(),/wt4-series-chapters/);
const stepClick=eventCallbacks.click.find(fn=>String(fn).includes("data-wt4-step"));
stepClick({target:{closest:selector=>selector==='[data-wt4-step]'?{dataset:{wt4Step:'3'}}:null},preventDefault(){},stopImmediatePropagation(){}});
assert.equal(navResult,'workspace/p1/3');
const selector=eventCallbacks.change.find(fn=>String(fn).includes("wt4-project"));
selector({target:{id:'wt4-project',value:'p2'}});
assert.equal(navResult,'workspace/p2');
assert.doesNotMatch(read('workflow-v4.js'),/AI 已生成所有图片/,'no fake AI success');
assert.match(read('workflow-v4.js'),/确认本次 AI 扩写|调用已配置的真实模型/,'paid inference requires explicit action');
console.log('WORLD/TOON V4.1 smoke PASS: three creation paths, seven stages, character snapshots, local immutability, QA gates and navigation.');
