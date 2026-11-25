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
  span('function wfMode(', 'function wfTaskObject('),
  span('function wfTaskObject(', 'function wfHint('),
  span('function wfStartupCommand(', 'function wfPrompt('),
  span('function wfInitTask(', 'const wfImgExt=')
].join('\n');
async function simulate({mode='hotspot',source='',topicSource='',facts='',fiction='',characters='',title='国际科技趋势：漫画研究',approved=true,literary=false,scoped=false,reviewed=true,producer='Gemini',hubFail=false,expectRejected=false}={}){
 const project={id:'test-01',topicId:'topic-1',title:literary?'读懂｜撒旦探戈｜Satantango：故事、哲学与人生':title,sourceTitle:literary?'撒旦探戈 | Satantango':'科技新闻的全球影响',
   category:literary?'诺奖文学导读':'AI 科技',subtitle:'',description:literary?'主人公罗恩、主角艾琳在旧剧情摘要出现，但编辑评论使用全新原创读者。':'一个新闻线索，不是已核实事实',
   sourceURLs:source,factNotes:facts,fiction,characters:literary?'主人公罗恩、主角艾琳':characters,disclosure:'虚构漫画，不构成事实报道',
   tone:'黑色幽默',eventDate:'',handoff:{mode},storySourceSelection:literary?{adaptation:'literary_review',source:'https://example.org/book'}:null,literaryReviewGuide:literary?{schema:'davylab.worldtoon.literary-review.v1'}:null,panels:Array.from({length:9},(_,i)=>({
     title:'panel '+i,scene:'第'+(i+1)+'格：角色在科幻城市中观察变化、交换信息并推进眼前情节，确定同一镜头的动作和时间。',caption:'真实分镜候选文字',dialogue:'先核实再决定',prompt:''}))};
 project.productionAgent=producer;
 if(scoped){project.literaryResearchScope='topic_literature_v2';if(reviewed){project.literaryResearch={status:'draft',evaluation:{structural_pass:true},claims:[{claim:'synthetic test fixture'}],input_signature:'test-only'};project.literaryReviewReceipt={author_content_reviewed:true,reviewed_at:'2026-11-09T00:00:00Z'};}}
 const captures={saved:[],messages:[],files:[],writes:0,hub:[]};
 const topics=[{id:'topic-1',title:project.sourceTitle,summary:project.description,source:topicSource}];
 const ctx={
   data:{topics},WF_SCHEMA:'davylab.worldtoon.task.v1',enc:new TextEncoder(),
   wtDirector:{readiness:()=>approved?[]:['需要先确认画风与九格剧情'],exportBrief:()=>({version:1,style_id:'editorial',lock_status:'approved',characters:[{name:'阿一'},{name:'阿二'}],storyboard:project.panels,approval:{lock_hash:'a1b2c3d4',author_approved:true},production_gates:{pilot_required:true}})},
   now:()=>new Date('2026-11-09T00:00:00Z').toISOString(),
   uid:()=> 'testid',
   wfGet:p=>p.handoff||{},
   validSources:p=>String(p.sourceURLs||'').split(/[\r\n,，]+/).map(x=>x.trim()).filter(x=>/^https?:\/\/[^ ]+/.test(x)),
   safeURL:x=>/^https?:\/\/[^ ]+$/.test(x)?x:'',
   setChange:()=>{captures.writes++},
   saveFile:(data,name)=>{captures.saved.push({data,name})},
   packZip:files=>{captures.files=files;return new Blob([JSON.stringify(files.map(x=>x.name))])},
   crypto:crypto.webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),
   wtArchiveApi:async (route,opts)=>{assert.equal(route,'hub-dispatch');const payload=JSON.parse(opts.body);captures.hub.push(payload);if(hubFail)throw Error('synthetic Hub unavailable');const bytes=Buffer.from(payload.package_base64,'base64');const sha=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(sha,payload.task.package_sha256);return {verified:true,task_id:payload.task.id,sha256:sha,repo:'chenzhe223-tech/ai-task-sync',target:payload.task.target,path:'tasks/'+payload.task.id+'/task.json',commit:'synthetic-test-commit'};},
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
 if(!approved){await assert.rejects(()=>ctx.functions.wfMakeTask(project),/请先补齐：.*确认画风/);assert.equal(captures.saved.length,0);return {blocked:true,captures}}
 if(scoped&&!reviewed){await assert.rejects(()=>ctx.functions.wfMakeTask(project),/文学专项研究与内容审核/);return {blocked:true,project,captures}}
 if(expectRejected){await assert.rejects(()=>ctx.functions.wfMakeTask(project),/预检未通过/);return {blocked:true,project,captures}}
 await ctx.functions.wfMakeTask(project);
 return {project,captures,task:JSON.parse(new TextDecoder().decode(captures.files.find(x=>x.name==='task.json').bytes)),
         prompt:new TextDecoder().decode(captures.files.find(x=>x.name===producer+'_制作指令.md').bytes)};
}
(async()=>{
 const blocked=await simulate({approved:false});
 assert.equal(blocked.blocked,true,'Unapproved creative directions must not create task ZIPs');
 const noSource=await simulate();
 assert.equal(noSource.captures.saved.length,1,'ZIP must be generated despite missing sources');
 assert.ok(noSource.captures.saved[0].name.endsWith('.zip'));
 assert.equal(noSource.project.factNotes.startsWith('【待核验'),true);
 assert.ok(noSource.project.fiction.includes('架空世界'));
 assert.equal(noSource.task.research_required,true);
 assert.equal(noSource.task.verification_status,'pending_research');
 assert.equal(noSource.task.source.verified_facts,'');
 assert.equal(noSource.task.source.urls.length,0);
 assert.equal(noSource.task.production_mode,'direct_multi_ai_local_v1','manual producer is explicitly direct');
 assert.equal(noSource.task.github_sync_required,false,'GitHub sync disabled in direct mode');
 assert.equal(noSource.task.delivery_target,'local_zip');
 assert.ok(noSource.captures.files.some(x=>x.name==='production-bible.json'),'canonical bible included');
 const guide=Object.fromEntries(noSource.captures.files.map(f=>[f.name,new TextDecoder().decode(f.bytes)]));
 assert.ok(guide['00_START_HERE.md']?.includes('同一条用户消息中上传整个 ZIP'),'ZIP explains that attachment-only does not initiate work');
 assert.ok(guide['Gemini_复制粘贴开工指令.txt']?.includes('请立即执行'),'ZIP contains a direct command the user can paste with the attachment');
 assert.ok(guide['Gemini_复制粘贴开工指令.txt']?.includes(noSource.task.task_id),'startup text and task.json use the same task ID');
 assert.ok(guide['Gemini_复制粘贴开工指令.txt']?.includes('立即按 ZIP 执行'),'startup command is explicitly actionable, not just a description');
 assert.equal(noSource.task.startup_command_file,'Gemini_复制粘贴开工指令.txt');
 assert.equal(noSource.task.entrypoint_file,'00_START_HERE.md');
 assert.equal(noSource.task.requires_explicit_user_message,true);
 assert.equal(noSource.task.attachment_alone_starts_production,false);
 assert.ok(noSource.captures.files.some(x=>x.name==='production_state.json'),'checkpoint state included');
 assert.ok(JSON.parse(new TextDecoder().decode(noSource.captures.files.find(x=>x.name==='production_state.json').bytes)).package_ready===false,'new task cannot claim completion');
 assert.ok(noSource.prompt.includes('DIRECT_MULTI_AI_LOCAL_V1'));
 assert.ok(noSource.prompt.includes('定妆'));
 assert.ok(noSource.project.handoff.directDeliveryMode,'Local ZIP export must be recorded');
 assert.ok(noSource.captures.messages.some(x=>x.includes('无需 GitHub')),'Remote sync is not attempted for direct tasks');
 assert.ok(noSource.prompt.includes('verified_sources'));
 assert.ok(!noSource.captures.messages.some(x=>x.includes('请先补齐')));
 assert.equal(noSource.project.handoff.repoQueuedAt==null,true,'Local ZIP is not GitHub delivery');
 const conflicting=await simulate({characters:'单亲妈妈：林晓、AI：小算',expectRejected:true});
 assert.equal(conflicting.captures.saved.length,0,'preflight failure must not create a ZIP');
 assert.equal(conflicting.project.handoff.taskId,undefined,'failed preflight must not leave a fake task ID');
 assert.equal(conflicting.project.handoff.phase,undefined,'failed preflight must not mark task as ready');
 const literary=await simulate({literary:true,mode:'hotspot',topicSource:'https://example.org/book'});
 assert.equal(literary.task.mode,'literary_review','legacy hotspot flag cannot override literary review');
 const literaryStartup=new TextDecoder().decode(literary.captures.files.find(x=>x.name==='Gemini_复制粘贴开工指令.txt').bytes);
 assert.match(literaryStartup,/撒旦探戈/);
 assert.match(literaryStartup,/三维文学导读/);
 assert.match(literaryStartup,/01–04/);
 assert.match(literaryStartup,/不(?:得|能)逐幕(?:复刻|重绘)|禁止未经授权以任何方式逐幕搬演/);
 assert.ok(!literaryStartup.includes('全球热点虚构改编'));
 assert.equal(literary.task.adaptation.source_selection.adaptation,'literary_review');
 assert.equal(literary.task.research_required,true,'literary review requires verifiable sources');
 assert.equal(literary.task.adaptation.literary_review.mode,'editorial_criticism_not_plot_adaptation');
 assert.equal(literary.captures.saved.length,1,'false-positive novel names must not block reviewed literature ZIP');
 assert.ok(literary.prompt.includes('三维文学导读'),'ChatGPT instructions must describe the actual review');
 assert.equal(literary.task.source.urls[0],'https://example.org/book');
 const missingResearch=await simulate({literary:true,scoped:true,reviewed:false,topicSource:'https://example.org/book'});
 assert.equal(missingResearch.blocked,true);assert.equal(missingResearch.captures.saved.length,0);assert.equal(missingResearch.project.handoff.taskId,undefined);
 const reviewedLiterature=await simulate({literary:true,scoped:true,topicSource:'https://example.org/book'});
 assert.equal(reviewedLiterature.task.adaptation.literary_review.research_file,'literary-research.json');
 assert.deepEqual(reviewedLiterature.task.adaptation.literary_review.panel_ranges,[[1,4],[5,7],[8,9]]);
 assert.ok(reviewedLiterature.captures.files.some(x=>x.name==='literary-research.json'));
 assert.ok(reviewedLiterature.prompt.includes('literary-research.json'));
 assert.ok(!literary.captures.files.some(x=>x.name==='literary-research.json'),'other literary entry is not scoped');
 const hub=await simulate({producer:'ChatGPT',mode:'original'});
 assert.equal(hub.task.production_mode,'ai_task_hub_v2');assert.equal(hub.task.github_sync_required,true);assert.equal(hub.captures.hub.length,1);assert.equal(hub.project.handoff.hubVerified,true);assert.equal(hub.captures.saved.length,0);
 const hubLiterature=await simulate({producer:'ChatGPT',literary:true,scoped:true,topicSource:'https://example.org/book'});
 assert.ok(hubLiterature.prompt.includes('literary-research.json'));assert.ok(hubLiterature.prompt.includes('01–04'));assert.equal(hubLiterature.project.handoff.hubVerified,true);
 const hubFailure=await simulate({producer:'ChatGPT',hubFail:true});
 assert.equal(hubFailure.captures.saved.length,1);assert.equal(hubFailure.project.handoff.hubVerified,false);assert.equal(hubFailure.project.handoff.repoQueuedAt,null);
 assert.ok(hubFailure.captures.saved[0].name.includes('Hub未入仓'));assert.ok(hubFailure.captures.messages.some(x=>x.includes('尚未派单')));
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
 console.log('WORLD/TOON TASK FLOW PASS: explicit manual and Hub routes, scoped literature report, missing-review block and honest failed-Hub fallback');
})().catch(err=>{console.error(err);process.exitCode=1});
