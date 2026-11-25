'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=read('app.js');
const a=app.indexOf('function wfProductionBible('),b=app.indexOf('function wfDirectPrompt(',a);
assert.ok(a>=0&&b>a,'Scoped image generator must exist');
const ctx={};vm.runInNewContext(app.slice(a,b)+'\nthis.jobs=wfSingleImageJobs;this.isolated=wfIsolatedRenderText;this.bible=wfProductionBible;this.preflight=wfProductionPreflight;',ctx);
const scenes=Array.from({length:9},(_,i)=>'UNIQUE_SCENE_'+i);
const project={title:'独立画格测试',panels:scenes.map((scene,i)=>({scene,title:'Panel '+i,prompt:'WATERCOLOR_LEGACY_STYLE_'+i,caption:'Caption '+i,dialogue:'Dialogue '+i}))};
const task={task_id:'WT-1234567890abcdef1234',creative_direction:{style_id:'cinematic-3d-character',visual_rules:{palette:['#123456']},characters:[{id:'hero',name:'虚构主角',look:'固定角色设定',clothes:'黑衣',symbol:'手表'}],storyboard:scenes.map((scene,i)=>({scene,shot:'camera_'+i,caption:'CAP_'+i,dialogue:'DLG_'+i,custom_prompt:'水彩圆润线稿旧提示'})),approval:{author_approved:true,lock_hash:'locked123'},cover_brief:'孤独的主角与灯塔'}};
const bible=ctx.bible(project,task);
assert.equal(bible.schema,'davylab.worldtoon.production-bible.v1');
assert.ok(bible.conflicts.length===9,'3D-vs-watercolor conflicts audited');
assert.equal(bible.panels[6].scene,scenes[6]);
const conflicting={...task,adaptation:{characters:'单亲妈妈：林晓、AI：小算'},source:{candidate_summary:'单亲妈妈：林晓、AI：小算'}};
assert.ok(ctx.bible(project,conflicting).conflicts.some(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED'),'legacy names require reconciliation');
const nameConflict=ctx.bible(project,conflicting).conflicts.find(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED');
// Regression: generic relationship words must NOT become "character names".
const falsePositive={...task,adaptation:{characters:'单亲妈妈好友、AI助手伙伴，双方彼此信任。'},
 source:{candidate_summary:'女主角好友、AI助手伙伴守护城市。'}};
assert.equal(ctx.bible(project,falsePositive).conflicts.filter(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED').length,0,
 'role descriptors such as 好友/伙伴 are not named characters');
const fauxProject={...project,testTask:falsePositive};
const explicitlyNamed={...task,adaptation:{characters:'女主角：林晓，AI助手：小算'},
 source:{candidate_summary:'主人公「赵明」带来新消息。'}};
const realMismatches=ctx.bible(project,explicitlyNamed).conflicts.filter(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED');
assert.ok(realMismatches.some(x=>x.name==='林晓'),'explicit Chinese role labels remain protected');
assert.ok(realMismatches.some(x=>x.name==='小算'),'explicit AI character labels remain protected');
assert.ok(realMismatches.some(x=>x.name==='赵明'),'explicit quoted names remain protected');
const approvedNames={...task,creative_direction:{...task.creative_direction,
 characters:[{...task.creative_direction.characters[0],name:'林晓'},{name:'小算'}]},
 adaptation:{characters:'女主角：林晓，AI助手：小算'}};
assert.equal(ctx.bible(project,approvedNames).conflicts.filter(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED').length,0,
 'exact approved roster names pass the identity gate');

assert.ok(['项目人物设定（旧角色文本）','项目剧情描述（候选摘要）'].includes(nameConflict.field),'message points to actual input field');
assert.equal(nameConflict.approved_cast[0],'虚构主角','error displays actual approved character roster');
ctx.wfTaskObject=p=>p.testTask;
assert.equal(ctx.preflight(fauxProject).ready,true,'fresh project with relationship nouns must be exportable');
assert.equal(ctx.preflight({...project,testTask:task}).ready,true,'approved cast and source pass preflight');
const stopped=ctx.preflight({...project,testTask:conflicting});
assert.equal(stopped.ready,false,'legacy character mismatch blocks before ZIP export');
assert.ok(stopped.reasons.some(x=>x.includes('项目人物设定')&&x.includes('正式角色名单')),'preflight gives actionable source and approved names');
assert.match(app,/生产预检待修正/,'UI must not falsely promise export when preflight fails');

const unsafe={...task,creative_direction:{...task.creative_direction,storyboard:task.creative_direction.storyboard.map((v,i)=>i===5?{...v,scene:'宝宝在浴盆里，系统建议主动提高水温'}:v)}};
assert.ok(ctx.bible(project,unsafe).conflicts.some(x=>x.code==='SAFETY_SCENE_REVISION_REQUIRED'),'unsafe bath-temperature scene requires new creative approval');
const result=ctx.jobs(project,task,bible);
assert.equal(result.schema,'davylab.worldtoon.single-image-jobs.v2');
assert.equal(result.jobs.length,10,'nine panels plus one independent cover');
assert.equal(result.expected_files,10);
assert.deepEqual(Array.from(result.jobs,j=>j.target),[...scenes.map((_,i)=>'panels/'+String(i+1).padStart(2,'0')+'.png'),'cover.png']);
assert.ok(result.jobs.every(j=>j.image_calls===1&&j.expected_image_count===1&&j.expected_scene_count===1));
assert.ok(result.jobs.every(j=>j.prompt.includes('NO contact sheet')&&j.prompt.includes('NO collage')));
assert.ok(result.jobs.every(j=>j.prompt.includes('NO lettering')||j.prompt.includes('NO lettering, glyphs')));
assert.ok(result.jobs.every(j=>j.max_retries===2),'bounded retry policy');
for(let i=0;i<9;i++){
 assert.ok(result.jobs[i].prompt.includes(scenes[i]),'target frame present '+i);
 for(let j=0;j<9;j++)if(j!==i)assert.ok(!result.jobs[i].prompt.includes(scenes[j]),'no adjacent scene leakage '+i+'/'+j);
}
assert.ok(!result.jobs[9].prompt.includes('UNIQUE_SCENE_'),'cover isolated from all panel scenes');
for(let i=0;i<9;i++){
 const isolated=ctx.isolated(result.jobs[i],bible);
 assert.ok(isolated.includes(scenes[i])&&isolated.includes('camera_'+i));
 assert.ok(isolated.includes('3:4')&&isolated.includes('1080×1440'));
 assert.ok(!isolated.includes(project.title)&&!isolated.includes('CAP_')&&!isolated.includes('DLG_')&&!isolated.includes('storyboard'));
 for(let j=0;j<9;j++)if(i!==j)assert.ok(!isolated.includes(scenes[j]));
}
assert.ok(!ctx.isolated(result.jobs[9],bible).includes('UNIQUE_SCENE_'));
assert.ok(app.includes("'render_requests/'+job.job_id+'.txt'")&&app.includes("name:'RENDER_ISOLATION.md'"));

assert.ok(result.jobs.every(j=>!j.prompt.includes('水彩圆润线稿')&&!j.prompt.includes('WATERCOLOR_LEGACY_STYLE')),'legacy style pollution excluded');
assert.ok(result.jobs[6].prompt.includes('camera_6'),'approved camera retained');
assert.equal(result.jobs[0].reference_assets.includes('pilot-01.png'),false,'pilot does not reference itself');
assert.equal(result.jobs[1].reference_assets.includes('pilot-01.png'),true,'later panels reference approved pilot');
assert.ok(/NEVER send this full JSON/.test(result.protocol),'full array forbidden as model input');
assert.ok(app.includes("name:'render_jobs.json'")&&app.includes("name:'render_jobs.md'"),'ZIP includes separate per-frame job records');
assert.ok(app.includes("name:'production-bible.json'"),'ZIP includes canonical production bible');
assert.ok(app.includes("name:'production_state.json'"),'task ZIP seeds a single working state');
assert.ok(app.includes("const blockers=bible.conflicts.filter"),'material preflight conflicts must block');
assert.ok(app.includes('package_ready:false')&&app.includes('actual_published:false'),'candidate ZIP cannot claim publish success');
const pilot=read('creative-pilot.js');
assert.ok(pilot.includes('exportApprovedBundle(')&&pilot.includes("name:'pilot-01.png'")&&pilot.includes("name:'panels/01.png'"),'post-approval handoff includes real image bytes');
assert.ok(pilot.includes('data-pilot-action="bundle"'),'approved reference bundle accessible from UI');
assert.ok(app.includes('SINGLE_IMAGE_PER_CALL_V2')&&app.includes('INVALID_COMPOSITE'),'direct-mode prompt forbids multi-panel images');
assert.ok(app.includes("task.image_render_protocol='single_image_per_call.v2'"),'machine-readable task contract');
const engine=read('comic-engine.js'),extension=read('extension.js'),worker=read('worker.js'),importer=read('worldtoon-v3-import.js'),review=read('worldtoon-v3-review.js');
for(const [filename,source] of [['comic-engine.js',engine],['extension.js',extension]])
 assert.ok(source.includes('target_index:'),'individual image target must be passed: '+filename);
assert.ok(engine.includes('approvedPilot.local_approved===true')&&engine.includes("actualHashes.get('panels/01.png')"),'local pilot and first-frame identity enforced');
assert.ok(worker.includes('IMAGE GENERATION SCOPE LOCK'),'backend prompt must override storyboard framing');
assert.ok(importer.includes('data-wt3-frame-qa')&&importer.includes('frameScopeQA:{}'),'each import resets per-image manual QA');
assert.ok(importer.includes('frameScopeQA[path]=asset.sha256'),'QA approval tied to unchanged image bytes');
assert.ok(review.includes("images.some(x=>h.frameScopeQA?.[x.path]!==x.sha256)"),'author approval blocked if any frame has no review');
assert.ok(app.includes("missing.push('逐张单场景与非拼版视觉核验')"),'legacy approval route must enforce QA');
console.log('WORLD/TOON SINGLE-IMAGE PROTOCOL PASS: canonical bible, 10 isolated jobs, real approved pilot handoff, bounded retries, verified candidate package');
