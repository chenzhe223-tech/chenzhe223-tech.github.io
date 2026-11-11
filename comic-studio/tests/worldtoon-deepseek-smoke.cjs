'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../worldtoon-v3.js'),'utf8').split('/* WORKFLOW_V4_EMBED')[0];
const api=fs.readFileSync(path.join(__dirname,'../archive.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../worldtoon-v3.css'),'utf8');

assert.match(api,/deepseek-expand'\)\?75000/,'DeepSeek must have a dedicated 75s timeout, not the generic 15s');
assert.match(html,/worldtoon-v3\.js\?v=4\.1\.0/,'updated story engine must bust stale service worker cache');
assert.match(html,/archive\.js\?v=4\.0\.3/,'API client timeout fix must load');
assert.match(css,/\.wt3-expand-feedback\[data-state="error"\]/,'errors must stay visible in the story editor');

function setup(apiBehavior){
  const listeners={},messages=[];
  const project={id:'test-1',title:'原创短篇',category:'幻想',handoff:{},
    panels:Array.from({length:9},()=>({title:'',scene:''}))};
  const seed={value:'古代县令穿越到人工智能时代，认识一位机器人朋友'};
  const feedback={textContent:'',dataset:{},hidden:true};
  const consent={hidden:true};
  const action={dataset:{wt3Action:'expand'},disabled:false,textContent:'DeepSeek 扩写并推荐篇幅'};
  const accept={dataset:{wt3Action:'expand-confirm'},disabled:false,textContent:'确认并开始生成'};
  const cancel={dataset:{wt3Action:'expand-cancel'},disabled:false,textContent:'取消'};
  const doc={
    addEventListener:(t,fn)=>{listeners[t]=fn},
    querySelector:q=>({
      '#wt3-seed':seed,'#wt3-expand-feedback':feedback,'#wt3-expand-consent':consent,
      '[data-wt3-action="expand"]':action
    })[q]||null,
    contains:()=>true
  };
  let calls=0,route='';
  const ctx={
    window:{addEventListener(){}},document:doc,location:{hash:'#/studio/test-1'},queueMicrotask(){},
    studio:()=>'<div class="editor-header">existing editor</div>',
    wtWorkflow:()=>'',library:()=>'',selected:()=>project,
    wtArchiveSnapshot:{library:{items:[]}},wtSharedStandalone:null,
    wtArchiveLastSync:0,wtArchiveBusy:false,wtArchiveRefresh(){},
    data:{projects:[project]},e:v=>String(v??''),ui:{filter:'已发表'},
    wtDirector:{ensure:p=>(p.creativeDirection={}),castText:()=>'角色设定'},
    uid:()=>String(Math.random()),now:()=>new Date().toISOString(),
    setChange(){},notify:v=>messages.push(v),nav:v=>{route=v},render(){},
    makePanel:i=>({id:i}),emptyProject:()=>({}),
    wtArchiveApi:async()=>{calls++;return apiBehavior(calls)}
  };
  vm.runInNewContext(source,ctx,{filename:'worldtoon-v3.js'});
  const click=button=>listeners.click({target:{closest:selector=>selector==='[data-wt3-action]'?button:null},preventDefault(){}});
  return {project,seed,feedback,consent,action,accept,cancel,click,messages,view:()=>ctx.studio(),calls:()=>calls,route:()=>route};
}
const story={method:'verified_model_response',model:'deepseek-flash',story:{
  title:'穿越县令',summary:'原创故事',fictionalization:'架空',characters:[
    {role:'县令',name:'甲'},{role:'朋友',name:'乙'}],
  panels:Array.from({length:4},(_,i)=>({title:'第'+(i+1)+'格',scene:'场景'+i,
    caption:'旁白',dialogue:'对白',visual_prompt:'分镜视觉要求'}))
}};
(async()=>{
 const good=setup(async()=>story);
 assert.match(good.view(),/id="wt3-expand-consent"/,'visible inline consent is mounted');
 await good.click(good.action);
 assert.equal(good.calls(),0,'first click must not charge model');
 assert.equal(good.consent.hidden,false,'first click opens visible confirmation');
 assert.match(good.feedback.textContent,/请在下方确认/);
 await good.click(good.cancel);
 assert.equal(good.calls(),0,'cancel never calls paid API');
 assert.equal(good.consent.hidden,true,'cancel closes confirmation');
 await good.click(good.action);
 await good.click(good.accept);
 assert.equal(good.calls(),1,'exactly one paid request after explicit confirmation');
 assert.equal(good.project.panels.length,4,'real response adjusts panel count');
 assert.equal(good.route(),'director/test-1','success continues to director');
 assert.equal(good.feedback.dataset.state,'success','success is shown');
 assert.equal(good.action.disabled,false,'button recovers');
 const failed=setup(async()=>{throw Error('DeepSeek 额度不足或登录失效')});
 await failed.click(failed.action);
 await failed.click(failed.accept);
 assert.equal(failed.calls(),1);
 assert.equal(failed.project.panels.length,9,'failed model must not destroy existing storyboard');
 assert.equal(failed.feedback.dataset.state,'error');
 assert.match(failed.feedback.textContent,/额度不足或登录失效/);
 assert.equal(failed.action.disabled,false);
 console.log('WORLD/TOON DeepSeek PASS: real API timeout configuration, explicit consent, single request, save, director handoff and visible failure');
})().catch(e=>{console.error(e);process.exitCode=1});
