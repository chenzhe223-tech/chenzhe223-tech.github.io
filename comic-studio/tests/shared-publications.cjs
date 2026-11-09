/* WORLD/TOON shared WeChat article evidence: never mark a comic published by title alone. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'..','worker.js'),'utf8');
const archive=fs.readFileSync(path.join(__dirname,'..','archive.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
assert.match(app,/wtSharedHandoffPanel\(p\)/);
assert.doesNotMatch(app,/WorkBuddy 微信公众号发表链接（真实发表后填写）/);
assert.match(style,/SHARED PUBLICATION ARCHIVE/);
assert.match(style,/@media\(max-width:600px\)/);
const publicData={
 schema_version:1,sync_method:'workbuddy-browser',sync_status:'synced_via_browser',
 last_synced_at:'2026-11-10T01:00:52+08:00',articles:[
 {id:'ONE',title:'原创漫画 - 灯塔',url:'https://mp.weixin.qq.com/s/one',publishedAt:'2026-11-10',source:'WeChat Official Account backend',worldtoon_task_id:'WT-1234567890abcdef1234'},
 {id:'ONE-DUP',title:'重复',url:'https://mp.weixin.qq.com/s/one',publishedAt:'2026-11-10'},
 {id:'TWO',title:'原创漫画 - 灯塔',url:'https://mp.weixin.qq.com/s/two',publishedAt:'2026-11-10'},
 {id:'BAD',title:'非法来源',url:'https://evil.example.com/s/three'},
 ]};
const wctx={URL,Response,Headers,Request,AbortSignal,TextDecoder,TextEncoder,Uint8Array,FormData,Blob,Promise,crypto:globalThis.crypto,Date,
fetch:async url=>{if(String(url).includes('published-articles.json'))return new Response(JSON.stringify(publicData),{status:200});throw Error('Unexpected fetch: '+url);}};
vm.createContext(wctx);
vm.runInContext(code.replace('export default {','globalThis.__wtWorker = {'),wctx);
const actx={URL,Date,Headers,AbortController,Promise,
 e:x=>String(x),document:{visibilityState:'hidden',addEventListener(){}},
 window:{addEventListener(){}},setInterval(){},queueMicrotask(){},
 wtWorkflow:()=>'',library:()=>'',location:{hash:'#/archive'}};
vm.createContext(actx);
vm.runInContext(archive,actx);
(async()=>{
 const shared=await vm.runInContext('wtSharedPublications()',wctx);
 assert.equal(shared.status,'synced');assert.equal(shared.total,2);
 assert.equal(shared.articles[0].task_id,'WT-1234567890abcdef1234');
 assert.equal(shared.articles[1].task_id,'');
 actx.fixture={shared_publications:shared,library:{items:[
 {task_id:'WT-1234567890abcdef1234',status:'ready_for_workbuddy',title:'原创漫画 - 灯塔',receipt:null}
 ]},queue:{items:[]}};
 vm.runInContext('wtArchiveSnapshot=fixture;wtArchiveLastSync=Date.now();wtArchiveError=""',actx);
 const task={title:'原创漫画 - 灯塔',handoff:{taskId:'WT-1234567890abcdef1234'}};
 actx.task=task;
 const panel=vm.runInContext('wtSharedHandoffPanel(task)',actx);
 assert.match(panel,/已按任务编号/);
 assert.match(panel,/等待私有仓库 WorkBuddy 回执/);
 assert.doesNotMatch(panel,/已收到独立仓库核验的正式发表回执/);
 assert.match(panel,/备用：手工补录公众号链接/);
 const another={title:'原创漫画 - 灯塔',handoff:{taskId:'WT-nonmatching12345'}};
 actx.task=another;
 const candidate=vm.runInContext('wtSharedHandoffPanel(task)',actx);
 assert.match(candidate,/标题相近的公众号文章/);
 assert.doesNotMatch(candidate,/已收到独立仓库核验的正式发表回执/);
 const desk=vm.runInContext('wtSharedDeskCard()',actx);
 assert.match(desk,/公众号发表档案/);
 assert.match(desk,/已明确关联 WORLD\/TOON 工单 1 条/);
 console.log('PASS: shared article ingestion, URL dedupe, exact ID association and title-only non-publication guard');
})().catch(err=>{console.error(err);process.exit(1)});
