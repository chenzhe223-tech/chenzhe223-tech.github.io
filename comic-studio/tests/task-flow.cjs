'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const code=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function span(start,end){
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Expected function region missing: '+start);
 return code.slice(a,b);
}
const region=[
  span('function wfResearchPolicy(', 'function wfTaskObject('),
  span('function wfTaskObject(', 'function wfHint('),
  span('function wfInitTask(', 'const wfImgExt=')
].join('\n');
async function simulate({mode='hotspot',source='',topicSource='',facts='',fiction='',title='国际科技趋势：漫画研究'}={}){
 const project={id:'test-01',topicId:'topic-1',title,sourceTitle:'科技新闻的全球影响',
   category:'AI 科技',subtitle:'',description:'一个新闻线索，不是已核实事实',
   sourceURLs:source,factNotes:facts,fiction,characters:'',disclosure:'虚构漫画，不构成事实报道',
   tone:'黑色幽默',eventDate:'',handoff:{mode},panels:Array.from({length:9},(_,i)=>({
     title:'panel '+i,scene:'',caption:'',dialogue:'',prompt:''}))};
 const captures={saved:[],messages:[],files:[],writes:0};
 const topics=[{id:'topic-1',title:project.sourceTitle,summary:project.description,source:topicSource}];
 const ctx={
   data:{topics},WF_SCHEMA:'davylab.worldtoon.task.v1',enc:new TextEncoder(),
   now:()=>new Date('2026-11-09T00:00:00Z').toISOString(),
   uid:()=> 'testid',
   wfMode:p=>p.handoff?.mode||'hotspot',
   wfGet:p=>p.handoff||{},
   validSources:p=>String(p.sourceURLs||'').split(/[\r\n,，]+/).map(x=>x.trim()).filter(x=>/^https?:\/\/[^ ]+/.test(x)),
   safeURL:x=>/^https?:\/\/[^ ]+$/.test(x)?x:'',
   setChange:()=>{captures.writes++},
   saveFile:(data,name)=>{captures.saved.push({data,name})},
   packZip:files=>{captures.files=files;return files},
   safeName:x=>x.replace(/\s+/g,'_'),
   wtArchiveKey:async p=>crypto.createHash('sha256').update(p.sourceURLs||p.title).digest('hex'),
   wtArchivePushTask:async()=>{throw new Error('Public repository cannot accept unpublished tasks')},
   render:()=>{},
   notify:msg=>captures.messages.push(msg),
   copyText:async()=>{},
   e:x=>String(x),
   console
 };
 vm.runInNewContext(region+"\nthis.functions={wfMakeTask,wfPrepareTask,wfCanTask,wfTaskReadiness};",ctx);
 await ctx.functions.wfMakeTask(project);
 return {project,captures,task:JSON.parse(new TextDecoder().decode(captures.files.find(x=>x.name==='task.json').bytes)),
         prompt:new TextDecoder().decode(captures.files.find(x=>x.name==='ChatGPT_制作指令.md').bytes)};
}
(async()=>{
 const noSource=await simulate();
 assert.equal(noSource.captures.saved.length,1,'ZIP must be generated despite missing sources');
 assert.ok(noSource.captures.saved[0].name.endsWith('.zip'));
 assert.equal(noSource.project.factNotes.startsWith('【待核验'),true);
 assert.ok(noSource.project.fiction.includes('架空世界'));
 assert.equal(noSource.task.research_required,true);
 assert.equal(noSource.task.verification_status,'pending_research');
 assert.equal(noSource.task.source.verified_facts,'');
 assert.equal(noSource.task.source.urls.length,0);
 assert.ok(noSource.prompt.includes('verified_sources'));
 assert.ok(!noSource.captures.messages.some(x=>x.includes('请先补齐')));
 assert.equal(noSource.project.handoff.repoQueuedAt,undefined,'Local ZIP is not GitHub delivery');
 const withSource=await simulate({topicSource:'https://example.org/news'});
 assert.equal(withSource.task.source.urls[0],'https://example.org/news','Topic source must be inherited');
 assert.equal(withSource.task.research_required,true,'Unverified link is still research pending');
 const original=await simulate({mode:'original'});
 assert.equal(original.task.research_required,false);
 assert.equal(original.task.verification_status,'original_fiction');
 assert.equal(original.captures.saved.length,1);
 const manual=await simulate({facts:'人工备注：需核验两项数据',fiction:'架空城市与虚构商战'});
 assert.equal(manual.project.factNotes,'人工备注：需核验两项数据');
 assert.equal(manual.project.fiction,'架空城市与虚构商战');
 console.log('WORLD/TOON TASK FLOW: 4 test scenarios passed; source-free idea generates a research-first ChatGPT ZIP');
})().catch(err=>{console.error(err);process.exitCode=1});
