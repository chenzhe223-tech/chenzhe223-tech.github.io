'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=x=>fs.readFileSync(path.join(root,x),'utf8');
const app=read('app.js');
const from=app.indexOf('function wtUnmadeBlockers('),to=app.indexOf('function findProject(',from);
assert.ok(from>=0&&to>from,'cleanup contract must be present');
const js=app.slice(from,to);
const script=new vm.Script(js+'\nthis.exports={eligible:wtCanDeleteUnmade,blockers:wtUnmadeBlockers,cleanup:wtDeleteUnmadeProjects,dialog:wtUnmadeCleanupDialog,mediaRefs:wtCollectMediaRefs};');
const make=(id,extra={})=>({id,title:'未制作'+id,status:'草稿',panels:[{title:'待制作',scene:'',image:''}],handoff:{},...extra});
const unmade=make('u-1',{topicId:'t1',creativeDirection:{cast:[{portraitMedia:'media:orphan'},{portraitMedia:'media:shared'}]}});
const stillUnmade=make('u-2',{topicId:'t2',creativeDirection:{approval:{author_approved:true},cast:[]}});
const remote=make('protected',{topicId:'t2',handoff:{taskId:'WT-abc',repoQueuedAt:'2026-11-20T01:00Z'},creativeDirection:{cast:[{portraitMedia:'media:shared'}]}});
const made=make('image',{panels:[{image:'media:real-panel'}]});
const pilot=make('pilot',{creativeDirection:{pilot:{panelImage:'media:pilot-image'}}});
const exported=make('export',{handoff:{directTaskExportedAt:'2026-11-20T03:00Z'}});
const approved=make('approved',{status:'已审核',reviewedAt:'2026-11-20'});
const published=make('published',{status:'已发布',publishedAt:'2026-11-20'});
const sample=make('sample-ba-zong-001');
const trash=make('trash',{deleted:true});
const projects=[unmade,stillUnmade,remote,made,pilot,exported,approved,published,sample,trash];
const topicList=[{id:'t1',title:'候选一'},{id:'t2',title:'候选二'}];
const ui={selected:'u-1',wt4LastId:'u-1'};
const data={projects:[...projects],topics:[...topicList],characters:[]};
let confirms=0,persistCount=0,mediaDeletes=[],navs=[],toast=[],closed=0,revoked=[],dialogMarkup='';
const ctx={data,ui,Map,Set,Date,console,
 confirm:()=>{confirms++;return true},
 persist:()=>{persistCount++;return true},
 findProject:id=>data.projects.find(p=>p.id===id),
 activeProjects:()=>data.projects.filter(p=>!p.deleted&&!p.archived),
 delMedia:async key=>{mediaDeletes.push(key)},
 closeModal:()=>{closed++},
 nav:route=>{navs.push(route)},
 notify:msg=>{toast.push(msg)},
 objectURLs:new Map([['media:orphan','blob:orphan']]),
 URL:{revokeObjectURL:u=>revoked.push(u)},
 e:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
 modal:html=>{dialogMarkup=html}
};
vm.createContext(ctx);script.runInContext(ctx);
const {eligible,blockers,cleanup,dialog,mediaRefs}=ctx.exports;
assert.equal(eligible(unmade),true);
assert.equal(eligible(stillUnmade),true,'an approved textual outline without image is still unproduced');
for(const item of [remote,made,pilot,exported,approved,published,sample,trash])
 assert.equal(eligible(item),false,'protected work must not be permanently deleted as draft: '+item.id);
assert.match(blockers(remote).join(''),/任务|交接/);
assert.ok(app.includes("case 'clean-unmade'")&&app.includes("case 'delete-unmade'"),'direct and batch actions wired');
dialog();
assert.match(dialogMarkup,/wtUnmadeCleanupForm/);
assert.match(dialogMarkup,/一并删除没有其他作品关联的原选题/);
assert.match(dialogMarkup,/<input type="checkbox" name="projectId"/,'items start unchecked');
assert.ok(!dialogMarkup.includes('value="protected"'),'a queued task must never be selectable');
assert.deepEqual([...mediaRefs({portrait:'media:orphan',story:'no media'})],['orphan']);
(async()=>{
 await assert.rejects(cleanup(['u-1','protected']),/不可删除/,'batch must fail atomically');
 assert.equal(data.projects.length,projects.length,'invalid batch did not modify projects');
 assert.equal(persistCount,0,'invalid batch did not write state');
 const done=await cleanup(['u-1']);
 assert.equal(done.removed,1);
 assert.equal(done.freed,1,'only orphan asset freed');
 assert.deepEqual(mediaDeletes,['orphan']);
 assert.equal(data.topics.length,2,'source topic preserved by default');
 assert.equal(data.projects.some(p=>p.id==='u-1'),false);
 assert.equal(data.projects.some(p=>p.id==='protected'),true);
 assert.equal(ui.selected,'u-2','selection moves to safe existing active project');
 assert.equal(ui.wt4LastId,'','stale workspace selection cleared');
 assert.deepEqual(revoked,['blob:orphan'],'local object URL revoked');
 assert.equal(closed,1);assert.equal(navs[0],'library');
 const another=await cleanup(['u-2'],{deleteLinkedTopics:true});
 assert.equal(another.topicsRemoved,0,'shared topic must remain while protected project exists');
 assert.equal(data.topics.length,2);
 assert.equal(data.projects.some(p=>p.id==='protected'),true);
 const fresh=make('fresh',{topicId:'t1',creativeDirection:{cast:[{portraitMedia:'media:newonly'}]}});
 data.projects.push(fresh);
 const removed=await cleanup(['fresh'],{deleteLinkedTopics:true});
 assert.equal(removed.topicsRemoved,1);
 assert.equal(data.topics.some(t=>t.id==='t1'),false,'orphaned source removed only with explicit checkbox');
 assert.deepEqual(mediaDeletes,['orphan','newonly']);
 const pending=make('storage-unsafe',{creativeDirection:{cast:[{portraitMedia:'media:should-stay'}]}});
 data.projects.push(pending);
 ctx.persist=()=>{persistCount++;return false};
 await assert.rejects(cleanup(['storage-unsafe']),/未能保存/);
 assert.equal(data.projects.some(p=>p.id==='storage-unsafe'),true,'rollback after storage write failure');
 assert.equal(mediaDeletes.includes('should-stay'),false,'do not delete assets if state was not saved');
 ctx.persist=()=>{persistCount++;return true};
 ctx.confirm=()=>false;
 const cancelled=await cleanup(['storage-unsafe']);
 assert.equal(cancelled.cancelled,true);
 assert.equal(data.projects.some(p=>p.id==='storage-unsafe'),true,'cancel leaves draft untouched');
 const v4=read('workflow-v4.js'),runtime=read('worldtoon-v3.js');
 assert.ok(runtime.trimEnd().endsWith(v4.trimEnd()),'V4 deployed bundle contains exact updated production UI');
 assert.match(v4,/delete-unmade/);
 assert.match(v4,/批量清理草稿/);
 const child=read('workflow-v4.css'),css=read('worldtoon-v3.css');
 assert.ok(css.trimEnd().endsWith(child.trimEnd()),'responsive styles bundled into Worker-allowed CSS');
 console.log('WORLD/TOON UNMADE CLEANUP PASS: guarded single/batch deletion, cancellation, safe media reclamation, topic retention, rollback and V4 UI');
})().catch(e=>{console.error(e);process.exitCode=1});
