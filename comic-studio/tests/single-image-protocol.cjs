'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const app=read('app.js');
const a=app.indexOf('function wfSingleImageJobs('),b=app.indexOf('function wfDirectPrompt(',a);
assert.ok(a>=0&&b>a,'Scoped image generator must exist');
const ctx={};vm.runInNewContext(app.slice(a,b)+'\nthis.jobs=wfSingleImageJobs;',ctx);
const scenes=Array.from({length:9},(_,i)=>'UNIQUE_SCENE_'+i);
const project={title:'独立画格测试',panels:scenes.map((scene,i)=>({scene,title:'Panel '+i,prompt:'Camera '+i,caption:'Caption '+i,dialogue:'Dialogue '+i}))};
const task={task_id:'WT-1234567890abcdef1234',creative_direction:{style_id:'editorial',visual_rules:{palette:['#123456']},characters:[{id:'hero',name:'虚构主角'}],cover_brief:'孤独的主角与灯塔'}};
const result=ctx.jobs(project,task);
assert.equal(result.schema,'davylab.worldtoon.single-image-jobs.v2');
assert.equal(result.jobs.length,10,'nine panels plus one independent cover');
assert.equal(result.expected_files,10);
assert.deepEqual(Array.from(result.jobs,j=>j.target),[...scenes.map((_,i)=>'panels/'+String(i+1).padStart(2,'0')+'.png'),'cover.png']);
assert.ok(result.jobs.every(j=>j.image_calls===1&&j.expected_image_count===1&&j.expected_scene_count===1));
assert.ok(result.jobs.every(j=>j.prompt.includes('NO contact sheet')&&j.prompt.includes('NO collage')));
for(let i=0;i<9;i++){
 assert.ok(result.jobs[i].prompt.includes(scenes[i]),'target frame present '+i);
 for(let j=0;j<9;j++)if(j!==i)assert.ok(!result.jobs[i].prompt.includes(scenes[j]),'no adjacent scene leakage '+i+'/'+j);
}
assert.ok(!result.jobs[9].prompt.includes('UNIQUE_SCENE_'),'cover isolated from all panel scenes');
assert.ok(/NEVER send this full JSON/.test(result.protocol),'full array forbidden as model input');
assert.ok(app.includes("name:'render_jobs.json'")&&app.includes("name:'render_jobs.md'"),'ZIP includes separate per-frame job records');
assert.ok(app.includes('SINGLE_IMAGE_PER_CALL_V2')&&app.includes('INVALID_COMPOSITE'),'direct-mode prompt forbids multi-panel images');
assert.ok(app.includes("task.image_render_protocol='single_image_per_call.v2'"),'machine-readable task contract');
const engine=read('comic-engine.js'),extension=read('extension.js'),worker=read('worker.js'),importer=read('worldtoon-v3-import.js'),review=read('worldtoon-v3-review.js');
for(const [filename,source] of [['comic-engine.js',engine],['extension.js',extension]])
 assert.ok(source.includes('target_index:'),'individual image target must be passed: '+filename);
assert.ok(worker.includes('IMAGE GENERATION SCOPE LOCK'),'backend prompt must override storyboard framing');
assert.ok(importer.includes('data-wt3-frame-qa')&&importer.includes('frameScopeQA:{}'),'each import resets per-image manual QA');
assert.ok(importer.includes('frameScopeQA[path]=asset.sha256'),'QA approval tied to unchanged image bytes');
assert.ok(review.includes("images.some(x=>h.frameScopeQA?.[x.path]!==x.sha256)"),'author approval blocked if any frame has no review');
assert.ok(app.includes("missing.push('逐张单场景与非拼版视觉核验')"),'legacy approval route must enforce QA');
console.log('WORLD/TOON SINGLE-IMAGE PROTOCOL PASS: 10 independent jobs, scoped prompts, explicit target, no collage, SHA-bound per-file QA');
