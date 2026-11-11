'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const scripts=['app.js','archive.js','worldtoon-v3.js','worldtoon-v3-import.js','worldtoon-v3-review.js','creative-director.js','creative-pilot.js'];
for(const file of scripts)assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file+' JavaScript syntax');
const index=read('index.html');
for(const name of ['worldtoon-v3.js','worldtoon-v3-import.js','worldtoon-v3-review.js','worldtoon-v3.css'])
 assert.ok(index.includes(name),name+' must load from the platform');
const app=read('app.js'),archive=read('archive.js'),v3=read('worldtoon-v3.js'),ingest=read('worldtoon-v3-import.js'),review=read('worldtoon-v3-review.js');
assert.match(app,/panel_count:p\.panels\.length/,'SOP must use variable panel count');
assert.match(app,/i<p\.panels\.length/,'WorkBuddy manual pack must include all panels');
assert.match(archive,/producer:o\.producer/,'SOP must persist production agent');
assert.match(archive,/series:o\.series/,'series identity must persist');
assert.match(v3,/\['已发表','制作中','待制作'\]/,'shelf must have three user-facing states');
assert.match(v3,/nextEpisode/,'series must calculate unique episode');
assert.match(v3,/data-wt3-media/,'local cover must resolve media storage');
assert.match(ingest,/crypto\.subtle\.digest\('SHA-256'/,'ZIP assets must be digested');
assert.match(ingest,/stagedFiles/,'ZIP upload must have recoverable staging');
assert.match(review,/author_confirmed:true/,'final publication must require author approval');
assert.match(review,/reviewed_checks/,'final QA checklist must be explicit');
const shelfCss=read('worldtoon-v3.css');
assert.match(shelfCss,/\.wt3-book-info h3\{font-size:17px;line-height:1\.6/,'comic shelf titles need comfortable line spacing');
assert.match(shelfCss,/\.wt3-shelf \.toolbar/,'shelf filter and search alignment must be scoped');
assert.match(shelfCss,/@media\(max-width:600px\)/,'mobile shelf readability must be maintained');
assert.match(shelfCss,/\.wt3-book-info \.wt3-book-state/,'publication status must have its own separated row');
assert.match(v3,/const meta=publication\?h\(publication\.format/,'published archive metadata should avoid repeated labels');
assert.match(v3,/sharedRows\(\)/,'published shelf should reuse WeChat shared archive');

const qaEvents={};
const qaItemInputs=Array.from({length:8},(_,i)=>({dataset:{wt3Qa:String(i)},checked:false,
 closest:()=>({classList:{toggle(){}}})}));
const qaCounts=[{textContent:'0'},{textContent:'0'}];
const qaSelect={disabled:false},qaClear={disabled:true};
const qaRoot={
 querySelectorAll:selector=>selector==='[data-wt3-qa-count]'?qaCounts:selector==='[data-wt3-qa]'?qaItemInputs:[],
 querySelector:selector=>selector.includes('select-all')?qaSelect:selector.includes('clear')?qaClear:null
};
const qaProject={handoff:{finalChecklist:Array(8).fill(false),stagedFiles:[],stageUploaded:[]}};
const qaContext={
 publish:()=>'', selected:()=>qaProject,setChange(){},notify(){},
 document:{
   addEventListener:(type,fn)=>{qaEvents[type]=fn},
   querySelector:selector=>selector==='.wt3-final-review'?qaRoot:null,
   contains:()=>true
 }
};
vm.runInNewContext(review,qaContext,{filename:'worldtoon-v3-review.js'});
const qaHtml=qaContext.publish();
assert.equal((qaHtml.match(/class="wt3-qa-item/g)||[]).length,8,'8 separate review cards');
assert.equal((qaHtml.match(/data-wt3-qa-action=/g)||[]).length,2,'bulk actions');
assert.match(qaHtml,/id="wt3-author-consent"/,'author authorization checkbox remains independent');
const qaClick=operation=>qaEvents.click({
 target:{closest:selector=>selector==='[data-wt3-qa-action]'?{dataset:{wt3QaAction:operation}}:null},
 preventDefault(){},stopImmediatePropagation(){}
});
qaClick('select-all');
assert.equal(qaProject.handoff.finalChecklist.filter(Boolean).length,8,'bulk select all');
assert.equal(qaCounts[0].textContent,'8','top live count');
assert.equal(qaCounts[1].textContent,'8','footer live count');
assert.equal(qaSelect.disabled,true,'cannot select all twice');
qaItemInputs[2].checked=false;qaEvents.change({target:qaItemInputs[2]});
assert.equal(qaProject.handoff.finalChecklist.filter(Boolean).length,7,'individual uncheck after bulk select');
qaClick('clear');
assert.equal(qaProject.handoff.finalChecklist.filter(Boolean).length,0,'bulk clear');
assert.equal(qaCounts[0].textContent,'0','counter clears');
assert.equal(qaClear.disabled,true,'cannot clear twice');
assert.match(shelfCss,/\.wt3-final-review \.wt3-qa-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,'two aligned desktop columns');
assert.match(shelfCss,/\.wt3-final-review \.wt3-qa-list\{grid-template-columns:minmax\(0,1fr\)/,'one mobile column');
assert.match(index,/worldtoon-v3-review\.js\?v=3\.0\.3/,'new QA script cache revision');
console.log('WORLD/TOON 3.0 smoke PASS: '+scripts.length+' parsed JS modules + SOP, shelf, series, ZIP and QA guards');
