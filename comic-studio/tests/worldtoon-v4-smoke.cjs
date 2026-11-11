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
assert.match(html,/worldtoon-v3\.js\?v=4\.0\.2/,'new workspace is bundled into the Worker-allowlisted script');
assert.match(html,/worldtoon-v3\.css\?v=4\.0\.2/,'new workspace CSS is bundled into the Worker-allowlisted stylesheet');
assert.match(engine,/WORKFLOW_V4_EMBED/,'built script includes v4 module');
assert.ok(engine.trimEnd().endsWith(read('workflow-v4.js').trim()),'deployed script matches canonical v4 code');
assert.ok(read('worldtoon-v3.css').trimEnd().endsWith(css.trim()),'deployed stylesheet matches canonical v4 code');
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
  window:{},document:{addEventListener:(type,fn)=>{eventCallbacks[type]=fn}},
  location:{hash:''},queueMicrotask:()=>{},ui:{wt4Step:-1,stage:0},
  data:{projects:[p,p2]},dashboard:()=>'<main id="legacy-home">Existing dashboard</main>',
  selected:()=>current,activeProjects:()=>[p,p2],findProject:id=>[p,p2].find(x=>x.id===id)||null,
  e:v=>String(v??'').replace(/[&<>"']/g,''),wtArchiveSnapshot:{library:{items:[]}},
  wtDirector:{approved:()=>approved},studioStage:()=>'<section id="source-stage">Source editor</section>',
  studio:()=>'<section id="ai-stage">DeepSeek editor</section>',
  wtCreativeDirector:()=>'<section id="director-stage">Story bible editor</section>',
  wtWorkflow:()=>'<section id="production-stage">Agent handoff editor</section>',
  publish:()=>'<section id="publication-stage">Author QA editor</section>',
  nav:route=>{navResult=route;},render(){},
};
vm.runInNewContext(read('workflow-v4.js'),ctx,{filename:'workflow-v4.js'});
const {state,verifiedPublished,stageNames}=ctx.window.WT4Workflow;
assert.equal(stageNames.length,7);
assert.equal(state(p).next,0,'new unscripted work starts with establishing an idea');
p.title='海底城市';assert.equal(state(p).next,1,'named idea moves to writing');
p.panels[0].scene='这是一段完整的镜头说明，记录海底城市人物冲突与叙事视角。';
assert.equal(state(p).next,2,'story draft needs author creative sign-off');
approved=true;
assert.equal(state(p).next,3,'locked direction makes production next');
p.handoff={taskId:'WT-11111111111111111111',repoQueuedAt:'2026-11-11T00:00:00Z'};
assert.equal(state(p).next,3,'queued task is never treated as completed production');
approved=false;
p.handoff.stagedFiles=[{path:'cover.png'},{path:'panels/01.png'}];
p.handoff.stageUploaded=['cover.png','panels/01.png'];
assert.equal(state(p).next,4,'uploaded files still require QA; no automatic sign-off');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'ready_for_workbuddy'}];
assert.equal(state(p).next,5,'only verified QA can advance to publishing');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'published',receipt:{status:'published',url:'https://mp.weixin.qq.com/s/RealArticle'}}];
assert.equal(state(p).next,6,'published requires authenticated receipt');
assert.equal(verifiedPublished({status:'published',receipt:{status:'draft_uploaded',url:'https://mp.weixin.qq.com/s/RealArticle'}}),false,'unverified receipt is never published');
const before=JSON.stringify(p);
const shell=ctx.window.wt4Workspace();
assert.equal(JSON.stringify(p),before,'project overview should never mutate saved work');
assert.match(shell,/PROJECT JOURNEY/,'full project page rendered');
assert.match(ctx.window.wt4Production(),/production-stage/,'production main navigation embeds the same work area');
assert.match(shell,/已确认/,'progress is visible');
assert.equal((shell.match(/class="wt4-step(?: |")/g)||[]).length,7,'seven integrated stages');
assert.match(ctx.dashboard(),/legacy-home/,'legacy home is retained');
ctx.ui.wt4Step=4;assert.match(ctx.window.wt4Workspace(),/成品回传与 QA/,'ZIP and QA stage available');
ctx.ui.wt4Step=5;assert.match(ctx.window.wt4Workspace(),/publication-stage/,'author approval view is embedded');
ctx.ui.wt4Step=6;
p.seriesId='series1';p.seriesTitle='深海';p.seriesEpisode=1;
p2.seriesId='series1';p2.seriesEpisode=2;
assert.match(ctx.window.wt4Workspace(),/wt4-series-chapters/,'series chapters appear together');
eventCallbacks.click({target:{closest:selector=>selector==='[data-wt4-step]'?{dataset:{wt4Step:'3'}}:null},preventDefault(){},stopImmediatePropagation(){}});
assert.equal(navResult,'workspace/p1/3','stage button routes within one project');
eventCallbacks.change({target:{id:'wt4-project',value:'p2'}});
assert.equal(navResult,'workspace/p2','switching work keeps the chosen project');
console.log('WORLD/TOON 4.0 smoke PASS: preserved data model, 7 phases, SOP, ZIP, approvals, series and navigation.');
