'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const app=read('app.js');
const review=read('worldtoon-v3-review.js');
const helpers=app.slice(app.indexOf('function wtNormalizeProjectTitle('),app.indexOf('function topicModal('));
let seq=0,writes=0,failed=false,form=null,submit=null;
const data={projects:[]},ui={selected:'old',stage:2},routes=[];
const dep={
 data,ui,now:()=>new Date().toISOString(),notify:()=>{},persist:()=>{writes++;return !failed},
 closeModal:()=>{},nav:v=>routes.push(v),
 emptyProject:t=>({id:'p'+(++seq),title:t?t.title+'：漫画改编':'未命名新作',topicId:t?.id||'',panels:[],handoff:{}}),
 modal:()=>{form={elements:{title:{value:'',focus(){}}},addEventListener:(type,fn)=>{submit=fn}}},
 document:{getElementById:()=>form}
};
const ks=Object.keys(dep);
const api=new Function(...ks,helpers+'\nreturn {newProject,wtRenameDraft};')(...ks.map(k=>dep[k]));
const event={preventDefault(){},stopPropagation(){}};
for(const source of ['manual','one-line','novel']){
 const n=data.projects.length,w=writes;
 api.newProject(null,{source});assert.equal(data.projects.length,n);assert.equal(writes,w);
 form.elements.title.value=' ';submit(event);assert.equal(data.projects.length,n);
 form.elements.title.value='未命名灵感作品';submit(event);assert.equal(data.projects.length,n);
 form.elements.title.value='自定义 '+source;submit(event);submit(event);assert.equal(data.projects.length,n+1);
 assert.equal(data.projects[0].title,'自定义 '+source);assert.equal(data.projects[0].creationSource,source);
 assert.equal(routes.at(-1),(source==='one-line'?'idea':source==='novel'?'novel':'workspace')+'/'+data.projects[0].id);
}
const n=data.projects.length;failed=true;api.newProject();form.elements.title.value='保存失败';submit(event);assert.equal(data.projects.length,n);failed=false;
const topic={id:'t1',title:'热点',stage:'待核验'};const first=api.newProject(topic);
assert.equal(api.newProject(topic).id,first.id);assert.equal(data.projects.length,n+1);
assert.equal(api.wtRenameDraft(first,'自定义热点'),true);first.handoff.repoQueuedAt='locked';
assert.equal(api.wtRenameDraft(first,'覆盖'),false);assert.equal(first.title,'自定义热点');
// Exercise the actual dedicated route renderers with empty and existing project lists.
// Neither renderer may create or persist a project when opened repeatedly.
const pages=review.slice(review.indexOf('/* Dedicated Novel Studio'),review.length);
const window={},listeners={},routeUi={selected:''};
const env={window,ui:routeUi,activeProjects:()=>data.projects.filter(p=>!p.deleted&&!p.archived),
 selected:()=>data.projects.find(p=>p.id===routeUi.selected)||null,
 document:{addEventListener:(t,fn)=>{(listeners[t]||(listeners[t]=[])).push(fn)}},
 location:{hash:'#/dashboard'},queueMicrotask:()=>{},wtTitleLocked:()=>false};
const keys=Object.keys(env);new Function(...keys,pages)(...keys.map(k=>env[k]));
for(let i=0;i<5;i++){window.WTIdeaPage();window.WTNovelPage();}
assert.equal(data.projects.length,n+1);
assert.ok(review.includes('href="#/idea"'));assert.ok(review.includes('href="#/novel"'));
assert.ok(!review.includes("p.title='未命名灵感作品'"));assert.ok(!review.includes("p.title='未命名小说导读'"));
assert.ok(read('worldtoon-v3.js').includes('if(p.titleUserDefined){p.aiSuggestedTitle'));
assert.ok(read('briefing.js').includes('existing=data.projects.find(p=>!p.deleted&&!p.archived&&p.topicId===t.id)'));
for(const file of ['extension.js','story-discovery-ui.js'])assert.ok(read(file).includes('prior.adaptation===adaptation'));
console.log('PASS named project creation, cancellation, invalid name, duplicate submit, persistence rollback, source deduplication, locked rename, repeated read-only routes, AI title retention');