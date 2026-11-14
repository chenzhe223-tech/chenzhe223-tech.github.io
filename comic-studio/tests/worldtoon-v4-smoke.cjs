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
  wtDirector:{approved:()=>approved,ensure:p=>(p.creativeDirection ||= {version:1,cast:[]})},studioStage:()=>'<section id="source-stage">Source editor</section>',
  studio:()=>'<section id="ai-stage">DeepSeek editor</section>',
  wtCreativeDirector:()=>'<section id="director-stage">Story bible editor</section>',
  wtWorkflow:()=>'<section id="production-stage">Agent handoff editor</section>',
  publish:()=>'<section id="publication-stage">Author QA editor</section>',
  nav:route=>{navResult=route;},render(){},setChange:(p,desc)=>{p.updatedAt='2026-11-13T09:00:00Z'},notify:()=>{},newProject:(topic,prepare)=>{current={id:'new-p',title:'未命名新作',panels:Array.from({length:9},()=>({scene:''})),handoff:{}};if(prepare)prepare(current);ctx.data.projects.unshift(current);return current},
};
vm.runInNewContext(read('workflow-v4.js'),ctx,{filename:'workflow-v4.js'});
const {state,verifiedPublished,stageNames,characterSnapshot,linkCharacter,entryHub,characterStage,saveEntry,confirmAIDraft,syncCharacterBible}=ctx.window.WT4Workflow;
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
assert.equal(state(p).next,4,'local stagedFiles must not masquerade as verified remote upload');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'draft_uploaded'}];
assert.equal(state(p).next,5,'verified remote upload may enter QA, but cannot skip it');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'ready_for_workbuddy'}];
assert.equal(state(p).next,6,'remote independent QA can advance to export/publish');
const verifiedRow={task_id:p.handoff.taskId,status:'published',delivery_sha256:'a'.repeat(64),issues:[],
  receipt:{status:'published',url:'https://mp.weixin.qq.com/s/RealArticle',
    verification_source:'wechat_official_backend',
    published_at:'2026-11-12T12:00:00Z',verified_at:'2026-11-12T12:02:00Z'}};
ctx.wtArchiveSnapshot.library.items=[verifiedRow];
assert.equal(verifiedPublished(verifiedRow),true,'official catalog entry includes delivery hash, independent verification and timestamps');
assert.equal(state(p).next,6,'published is terminal');
assert.equal(verifiedPublished({...verifiedRow,delivery_sha256:''}),false,'no delivery checksum means not published');
assert.equal(verifiedPublished({...verifiedRow,issues:['QA blocked']}),false,'unresolved QA issue prevents publication');
assert.equal(verifiedPublished({...verifiedRow,receipt:{...verifiedRow.receipt,verification_source:'manual'}}),false,'manually supplied article link is not official backend proof');
assert.equal(verifiedPublished({...verifiedRow,receipt:{...verifiedRow.receipt,published_at:''}}),false,'missing publication date is blocked');
assert.equal(verifiedPublished({...verifiedRow,receipt:{...verifiedRow.receipt,verified_at:''}}),false,'missing verification date is blocked');
ctx.wtArchiveSnapshot.library.items=[{task_id:p.handoff.taskId,status:'published',receipt:{status:'published',url:'https://mp.weixin.qq.com/s/RealArticle'}}];
assert.equal(state(p).published,false,'unverified publisher row is never shown as published');
assert.equal(state(p).label,'发表回执待核验','user sees explicit receipt block');
ctx.wtArchiveSnapshot.library.items=[verifiedRow];
assert.equal(verifiedPublished({status:'published',receipt:{status:'draft_uploaded',url:'https://mp.weixin.qq.com/s/RealArticle'}}),false);
assert.equal(verifiedPublished({status:'published',receipt:{status:'published',url:'https://example.invalid/fake'}}),false);
ctx.ui.wt4Step=2;
const saved=JSON.stringify(p),shell=ctx.window.wt4Workspace();
assert.equal(JSON.stringify(p),saved,'render cannot mutate project or its character bible');
assert.match(shell,/PROJECT JOURNEY/);
assert.match(shell,/data-wt4-save-status/,'live truthful save-state control displayed');
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
assert.match(app,/async function exportFormalPackage\(p\)/,'complete package generator exists');
assert.match(app,/case 'zip-formal':await exportFormalPackage\(findProject\(id\)\)/,'real one-click export action is wired');
assert.match(app,/ready_for_qa:false,author_approved:false/,'local export never bypasses independent QA or approval');
assert.match(app,/await crypto\.subtle\.digest\('SHA-256',raw\)/,'ZIP source proof uses real SHA256');
assert.match(read('workflow-v4.js'),/data-action="zip-formal"/,'stage seven exposes complete ZIP export');

assert.match(engine,/wt4-story-compact/,'V4 uses a dedicated simplified AI-story panel');
assert.match(engine,/if\(window.WT4_STORY_PANEL_ONLY===true\)/,'compact story panel is only activated inside V4 stage');
assert.match(engine,/AI STORY DEVELOPMENT/,'compact writing stage labels real model honestly');

const aiDraft={id:'ai-need-approval',title:'等待人物确认',description:'AI 创作中的虚构角色',
 panels:Array.from({length:9},()=>({scene:''})),handoff:{},
 characterRefs:[{characterId:'ai-char-draft',role:'female_lead',comicName:'阿夏',pending_author_review:true}]};
ctx.data.projects.push(aiDraft);
ctx.data.characters.push({id:'ai-char-draft',characterId:'ai-char-draft',originProjectId:'ai-need-approval',
 origin:'ai-draft',reviewStatus:'pending_author_confirmation',version:1,name:'阿夏',originalName:'阿夏',
 description:'短棕发、绿色眼睛和左眉星点',costume:'深蓝色制服和银色背包',traits:'黄色怀表',personality:'积极但谨慎'});
assert.equal(state(aiDraft).next,1,'unapproved AI character is never considered production-ready');
assert.match(characterStage(aiDraft),/确认人物设定并建档/,'proposed role must show explicit author confirmation');
assert.equal(confirmAIDraft(aiDraft,'not-existing'),false,'unknown role cannot be signed');
assert.equal(confirmAIDraft(aiDraft,'ai-char-draft'),true,'author confirms AI role');
assert.equal(aiDraft.characterRefs[0].pending_author_review,false);
assert.equal(aiDraft.characterRefs[0].snapshot.characterId,'ai-char-draft');
assert.equal(ctx.data.characters.at(-1).origin,'author_confirmed_ai');
assert.equal(state(aiDraft).next,2,'role confirmation unlocks storyboard only');
assert.equal(syncCharacterBible(aiDraft),true,'author explicitly synchronizes fixed character to director');
assert.equal(aiDraft.creativeDirection.cast[0].name,'阿夏');
assert.equal(aiDraft.creativeDirection.cast[0].characterId,'ai-char-draft');
assert.equal(aiDraft.creativeDirection.approval,null,'role synchronization never fabricates creative approval');
aiDraft.handoff.repoQueuedAt='2026-11-13T00:00:00Z';
assert.equal(syncCharacterBible(aiDraft),false,'queued tasks cannot silently mutate cast');

assert.doesNotMatch(read('workflow-v4.js'),/AI 已生成所有图片/,'no fake AI success');
assert.match(engine,/确认本次 AI 扩写/,'existing DeepSeek expansion still demands explicit billing consent');
assert.match(read('workflow-v4.js'),/调用前需要独立确认费用/,'compact V4 story stage retains billing warning');

const n=ctx.data.projects.length;
saveEntry('idea',{seed:'机器人拒绝上班，于是全城召开仲裁大会'});
assert.equal(ctx.data.projects.length,n+1,'one-sentence form makes a real local project record');
assert.equal(current.entryType,'idea');assert.equal(current.handoff.mode,'original');
assert.match(current.description,/机器人拒绝上班/,'seed persisted in same project');
assert.equal(navResult,'workspace/new-p/0','idea path joins seven-step workspace');
saveEntry('author',{title:'月亮邮局',description:'老邮差修补月亮邮局的最后一封信',category:'童话'});
assert.equal(ctx.data.projects.length,n+2,'self-authored path makes project record');
assert.equal(current.entryType,'author');assert.equal(current.title,'月亮邮局');assert.equal(current.handoff.mode,'original');
const hotspot=eventCallbacks.click.find(fn=>String(fn).includes("data-wt4-topic"));
ctx.data.topics=[{id:'newshot-01',title:'公开新闻线索',source:'https://example.org/article'}];
hotspot({target:{closest:selector=>selector==='[data-wt4-topic]'?{dataset:{wt4Topic:'newshot-01'}}:null},preventDefault(){}});
assert.equal(ctx.data.projects.length,n+3,'hotspot path makes project record');
assert.equal(current.entryType,'hotspot');assert.equal(current.handoff.mode,'hotspot');
assert.equal(navResult,'workspace/new-p/0','all entries route to same unified stage');

console.log('WORLD/TOON V4.1 smoke PASS: three creation paths, seven stages, character snapshots, local immutability, QA gates and navigation.');
