/* WORLD/TOON Production Desk: no real tasks or external publication. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const src=read('archive.js'),css=read('styles.css');
assert.match(read('index.html'),/data-route="handoff"/,'legacy handoff remains reachable from navigation');
assert.match(read('app.js'),/archive:'生产调度中心'/);
assert.match(read('personalize.js'),/生产调度中心/);
assert.match(css,/\.wt-dash-metrics\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/@media\(max-width:1160px\)/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/overflow-wrap:anywhere/);
const ctx={Headers,AbortController,Date,JSON,Array,Set,Number,String,Promise,
 window:{addEventListener(){}},document:{addEventListener(){},visibilityState:'visible'},
 setInterval(){},queueMicrotask(){},wtWorkflow:()=>'',library:()=>'',e:v=>String(v),
 location:{hash:'#/archive'}};
vm.createContext(ctx);
vm.runInContext(src,ctx,{filename:'archive.js'});
function render(snapshot,error=''){
  ctx.snapshot=snapshot;ctx.archiveErr=error;
  vm.runInContext('wtArchiveSnapshot=snapshot;wtArchiveError=archiveErr;wtArchiveLastSync=snapshot?Date.now():0;',ctx);
  return vm.runInContext('wtArchiveDesk()',ctx);
}
const offline=render(null,'请先登录 WORLD/TOON');
assert.match(offline,/生产调度中心/);
assert.match(offline,/请先登录/);
assert.match(offline,/—<\/strong>/);
assert.doesNotMatch(offline,/>0<\/strong>/);
const live={mode:'private_authenticated',visibility:'private',library:{items:[
 {task_id:'WT-001',status:'queued',title:'苹果 Siri 智能体',category:'AI 科技',created_at:'2026-11-09',revision:0,producer:'ChatGPT'},
 {task_id:'WT-002',status:'queued',title:'能源市场',category:'商业财经',created_at:'2026-11-09',revision:0,producer:'ChatGPT'},
 {task_id:'WT-003',status:'blocked',title:'需要独立审核',category:'AI 科技',created_at:'2026-11-09',revision:1,producer:'ChatGPT',issues:['缺少作者审核']}
]},queue:{items:[]}};
const page=render(live);
assert.match(page,/私有仓库已连接/);
assert.match(page,/当前任务/);
assert.match(page,/WT-001/);
assert.match(page,/WT-002/);
assert.match(page,/WT-003/);
assert.match(page,/缺少作者审核/);
assert.match(page,/Agent 协作交付/);
assert.match(page,/data-archive="refresh"/);
assert.equal((page.match(/class="wt-dash-kpi"/g)||[]).length,4);
assert.equal((page.match(/class="wt-dash-task"/g)||[]).length,3);
assert.equal((page.match(/class="wt-dash-steps"/g)||[]).length,1);
console.log('PASS: Production Desk compact markup, truthful counters and mobile CSS contract');
