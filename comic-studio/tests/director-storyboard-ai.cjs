/* WORLD/TOON: original nine-frame screenplay model + human correction contract. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const root=require('node:path').join(__dirname,'..');
const creative=fs.readFileSync(root+'/creative-director.js','utf8');
const worker=fs.readFileSync(root+'/worker.js','utf8');
const panels=Array.from({length:9},(_,i)=>({
 title:'真正的转折第'+(i+1)+'幕',
 scene:'【'+(i+1)+'】这是原创电影级的分镜画面，在真实场景中，黎舟检查研究室的器物，星点发现关键证据，画面中包含具体的镜头景别以及可读的视觉信息，连贯推进剧情。',
 caption:'有些答案需要重新审视。',dialogue:'黎舟：我们需要换个角度。',prompt:'保持人物一致的眼镜和衣服'
}));
function makeProject(id){
 return {id,title:'时间机器：漫画改编',sourceTitle:'时间机器｜The Time Machine',
  description:'研究员偶然启动旧机器，时间穿梭后发现人类未来可能比自己想象的更复杂。',category:'世界文学',
  panels:Array.from({length:9},(_,i)=>({title:'第 '+(i+1)+' 格',scene:'',caption:'',dialogue:'',prompt:'',image:''})),
  characters:'',handoff:{},status:'草稿'};
}
let current=makeProject('p1'),calls=0,alertText='',reviewCount=0,enrolled=[];
current.creativeDirection={version:1,cast:[{role:'女主',name:'林晚',look:'短发',clothes:'米色外套',symbol:'怀表',nature:'果断'},{role:'男主',name:'顾行舟',look:'黑发',clothes:'深色风衣',symbol:'钢笔',nature:'谨慎'}]};
const handlers={};
const ctx={
 window:{WTCharacterContinuity:{upsertGenerated:(data,project,candidates)=>{enrolled.push({project,candidates});return {added:2,linked:0,unresolved:[]}}},WTStyleV3:{STYLES:[{id:'chinese-historical-epic',name:'国风史诗写实',material:'厚涂',lighting:'侧光',layout:'电影级',negative:'简笔画',palette:['#eee','#555']},
 {id:'western-cinematic',name:'欧美电影',material:'写实',lighting:'柔光',layout:'远景',negative:'粗糙',palette:['#eee','#555']},
 {id:'futuristic-sci-fi',name:'未来科幻',material:'科幻',lighting:'科幻光',layout:'精细',negative:'塑料',palette:['#eee','#555']}],
 cards(){return ''},detail(){return ''}}},
 location:{hash:'#/director/p1'},document:{addEventListener:(type,fn)=>(handlers[type]??=[]).push(fn)},
 data:{characters:[]},selected:()=>current,markDirty(){},persist(){},setChange(){},render(){},notify(s){alertText=s},confirm(){return true},
 e:s=>String(s??''),heroHeader:()=>'header',wtSession:{access_token:'test-token'},
 wtConfig:{storyboardAiEnabled:true},wtCallAI:async(route,data)=>{calls++;assert.equal(route,'/api/ai/storyboard');assert.equal(data.provider,'native');assert.equal(data.cast.length,2);return {panels,method:'verified_model_response',provider:'native',model:'gemma-4-26b-a4b-it'}},
 queueMicrotask:fn=>Promise.resolve().then(fn),Math,Date,JSON
};
vm.runInNewContext(creative,ctx,{filename:'creative-director.js'});
const director=ctx.window.wtDirector;
const click=dataset=>handlers.click.forEach(fn=>fn({target:{closest:()=>({dataset})},preventDefault(){},stopImmediatePropagation(){}}));
const change=el=>handlers.change.forEach(fn=>fn({target:el,stopImmediatePropagation(){},preventDefault(){}}));
(async()=>{
 assert.equal(director.localStoryboard(current).length,9);
 const local=director.localStoryboard(current);
 assert.ok(local.every(x=>x.scene.length>=80&&!x.scene.includes('围绕「')));
 assert.ok(local[0].scene.includes('铜制时间机器'),'Specific subject should trigger a concrete scene');
 director.ensure(current);
 ctx.window.wtCreativeDirector(); // initialize project selection before a user clicks the third tab
 click({directorStep:'2'});
 const html=ctx.window.wtCreativeDirector();
 assert.match(html,/自动编剧/);
 assert.match(html,/DeepSeek API/);
 assert.match(html,/OpenAI API/);
 for(const label of ['Claude','Gemini','Kimi','通义千问'])assert.ok(html.includes(label+' · 自带密钥'),label+' must be selectable');
 await new Promise(r=>setTimeout(r,30));
 assert.equal(calls,1,'AI-first storyboard should run once for blank nine-frame project');
 assert.equal(current.panels[0].title,panels[0].title);
 assert.equal(current.creativeDirection.storyboardProvenance.method,'verified_model_response');
 assert.equal(enrolled.length,1,'accepted screenplay should enroll explicit leads into shared profile archive');assert.equal(enrolled[0].candidates.length,2);
 assert.equal(current.creativeDirection.approval,null);
 current.panels[0].dialogue='作者亲自修改的内容';
 const update=director.applyStoryboard(current,panels,{method:'verified_model_response',provider:'native',model:'gemma'},false);
 assert.equal(update,true);
 assert.equal(current.panels[0].dialogue,'作者亲自修改的内容','Fill-blank must preserve manual data');
 current=makeProject('p2');ctx.wtSession=null;ctx.location.hash='#/director/p2';
 ctx.window.wtCreativeDirector();click({directorStep:'2'});ctx.window.wtCreativeDirector();
 await new Promise(r=>setTimeout(r,15));
 assert.equal(calls,1,'No AI inference without login');
 assert.ok(current.panels.every(x=>x.scene.length>30));
 assert.equal(current.creativeDirection.storyboardProvenance.method,'local_structure_rules');
 assert.equal(current.creativeDirection.drafted,true);
 const before=JSON.stringify(current);
 const form={matches:sel=>sel==='[data-director-provider]',value:'deepseek'};
 change(form);
 handlers.input.forEach(fn=>fn({target:{matches:sel=>sel==='[data-director-api-key]',value:'sk-secret-ephemeral'}}));
 const modelPayload=director.aiStoryPayload(current,'deepseek');
 assert.equal(modelPayload.apiKey,'sk-secret-ephemeral');
 assert.ok(!JSON.stringify(current).includes('sk-secret-ephemeral'),'API key must never enter project persistence');
 assert.equal(before,JSON.stringify(current),'Provider choice should not mutate saved comic');
 console.log('PASS: native auto-fill, model provenance, project-specific local fallback, manual edit preservation and ephemeral API keys');

 const sandbox={Response,Headers,URL,URLSearchParams,AbortSignal,TextEncoder,Date,console,crypto:require('node:crypto').webcrypto};
 let externalRequests=0;
 sandbox.fetch=async(url,opts)=>{
  if(String(url).includes('/auth/v1/user'))return Response.json({id:'test-user'});
  const story=JSON.stringify({analysis:'反转价值',panels});
  if(String(url).includes('api.deepseek.com')||String(url).includes('api.openai.com')||String(url).includes('api.moonshot.cn')||String(url).includes('dashscope.aliyuncs.com')){
   externalRequests++;assert.equal(opts.headers.authorization,'Bearer sk-temporary-secret');
   return Response.json({model:JSON.parse(opts.body).model,choices:[{message:{content:story}}]});
  }
  if(String(url).includes('api.anthropic.com')){externalRequests++;assert.equal(opts.headers['x-api-key'],'sk-temporary-secret');assert.equal(opts.headers['anthropic-version'],'2023-06-01');return Response.json({model:'claude-test',content:[{type:'text',text:story}]});}
  if(String(url).includes('generativelanguage.googleapis.com')){externalRequests++;assert.equal(opts.headers['x-goog-api-key'],'sk-temporary-secret');return Response.json({candidates:[{content:{parts:[{text:story}]}}]});}
  throw Error('Unexpected network call: '+url);
 };
 vm.runInNewContext(worker.replace('export default {async fetch(','const workerImpl={async fetch(')+'\nglobalThis.storyTest=wtStoryboardAI;',sandbox,{filename:'worker.js'});
 const env={DB:{prepare(){return {bind(){return this},async first(){return {uses:1}}}}},AI:{async run(){return {response:JSON.stringify({analysis:'科研的代价',panels})}}}};
 const good={title:'时间机器',summary:'虚构研究员在新的世界面对实验伦理抉择',cast:[{name:'黎舟',look:'眼镜',clothes:'浅色研究服'},{name:'星点',look:'圆头',clothes:'橙色机体'}]};
 const req=(body,auth=true)=>new Request('https://worldtoon.chenzhe223.workers.dev/api/ai/storyboard',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer demo'}:{})},body:JSON.stringify(body)});
 const anon=await sandbox.storyTest(req({...good,provider:'native'},false),env);
 assert.equal(anon.status,401);
 const native=await sandbox.storyTest(req({...good,provider:'native'}),env);
 assert.equal(native.status,200,await native.text().catch(()=>'')); // avoid reading later
 const byo=await sandbox.storyTest(req({...good,provider:'deepseek',apiKey:'sk-temporary-secret'}),env);
 assert.equal(byo.status,200);
 const generated=await byo.json();assert.equal(generated.panels.length,9);assert.equal(externalRequests,1);
 assert.equal(generated.factChecked,false);assert.equal(generated.rightsCleared,false);
 for(const provider of ['openai','claude','gemini','kimi','qwen']){
  const response=await sandbox.storyTest(req({...good,provider,apiKey:'sk-temporary-secret'}),env);
  assert.equal(response.status,200,provider+' should return a verified nine-panel draft');
  const output=await response.json();assert.equal(output.provider,provider);assert.equal(output.panels.length,9);
 }
 assert.equal(externalRequests,6,'each supported provider must use its fixed upstream API');
 const invalidModel=await sandbox.storyTest(req({...good,provider:'claude',model:'gemini-2.5-flash',apiKey:'sk-temporary-secret'}),env);
 assert.equal(invalidModel.status,400,'model IDs from another provider must be rejected before network access');
 const bad=await sandbox.storyTest(req({...good,provider:'untrusted',apiKey:'anything'}),env);assert.equal(bad.status,400);
 assert.equal(externalRequests,6,'Reject unsupported provider and mismatched model before network access');
 console.log('PASS: owner-auth native model; DeepSeek, OpenAI, Claude, Gemini, Kimi and Qwen proxies; provider/model validation; provenance; no publication approval');
})().catch(err=>{console.error(err);process.exitCode=1});
