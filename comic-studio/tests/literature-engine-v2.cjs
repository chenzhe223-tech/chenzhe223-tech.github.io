'use strict';
// Synthetic fixtures only: never call a paid model or mark a real work verified.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const worker=read('worker.js'),app=read('app.js'),director=read('creative-director.js'),html=read('index.html'),sw=read('sw.js');
function region(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start+1);assert.ok(start>=0&&end>start,a+' exists');return s.slice(start,end)}
const urls=['https://example.org/one','https://example.org/two'],notes=['用于测试的第一个来源的独立事实摘记','用于测试的第二个来源的独立事实摘记','用于测试的第三个独立事实摘记'];
const evidence='来源：'+urls[0]+'\n'+notes[0]+'\n'+notes[2]+'\n来源：'+urls[1]+'\n'+notes[1];
const ctx={};
vm.runInNewContext(region(worker,'function wtLiteraryEval(','async function wtLiteraryAuth')+'\nthis.evaluate=wtLiteraryEval;',ctx);
function fixture(n){
 const a=Math.min(n-2,Math.max(2,Math.round(n*4/9))),b=Math.min(n-1,a+Math.max(1,Math.round(n*3/9)));
 return {research:{status:'draft',...Object.fromEntries(['plot_summary','characters','conflict','turning_points','ending','philosophy','real_life_meaning'].map(k=>[k,'用于自动化验证的虚构研究内容'])),claims:notes.map((t,i)=>({claim:'仅为测试证据内容'+i,evidence_note:t,source_url:urls[i===1?1:0]})),self_eval:{scores:{story:30,characters:15,philosophy:25,relevance:15,specificity:10,sources:5}}},panels:Array.from({length:n},(_,i)=>({title:'测试'+i,scene:'这里是用于验证规则的虚构场景，不代表真实文学研究或实际生产内容。',caption:'用于自动化测试的独立旁白'+i,visual_prompt:'单图',dimension:i<a?'story':i<b?'philosophy':'relevance',claim_refs:[1]}))};
}
for(let n=4;n<=60;n++)assert.equal(ctx.evaluate(fixture(n),n,urls,evidence).structural_pass,true,'valid count '+n);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.evaluate(fixture(9),9,urls,evidence).panel_ranges)),[[1,4],[5,7],[8,9]]);
const faults={wrongSource:x=>x.research.claims[0].source_url=urls[1],fakeQuote:x=>x.research.claims[0].evidence_note='并不在资料中出现的虚假引用文本',badSource:x=>x.research.claims[0].source_url='https://example.org/unknown',duplicate:x=>x.panels[1].caption=x.panels[0].caption,badDimension:x=>x.panels[0].dimension='philosophy',badScore:x=>x.research.self_eval.scores.story=23,missingClaim:x=>x.panels[0].claim_refs=[],placeholder:x=>x.panels[0].caption='【待文学研究】请填写后再生成',missingField:x=>delete x.research.ending};
for(const [k,change] of Object.entries(faults)){const q=fixture(9);change(q);assert.equal(ctx.evaluate(q,9,urls,evidence).structural_pass,false,k)}
const scope={validSources:p=>p.sourceURLs.split(/\s+/).filter(Boolean),clean:x=>String(x||'').trim(),payload:p=>({})};
vm.runInNewContext(region(app,'function wfLiteraryReview(p)','function wfLiterarySelection(p)')+region(director,'function isLiteraryProject(p)','function checks(p)')+'\nthis.required=wfLiteraryResearchRequired;this.signature=literaryInputSignature;this.snapshot=literaryReviewSnapshot;this.errors=literaryReviewErrors;this.digest=digest;',scope);
const topic={id:'synthetic',sourceTitle:'测试作品',title:'测试',storySourceSelection:{adaptation:'literary_review'},literaryResearchScope:'topic_literature_v2',sourceURLs:urls.join('\n'),literaryEvidence:evidence,panels:fixture(9).panels};
assert.equal(scope.required(topic),true);
assert.equal(scope.required({...topic,literaryResearchScope:undefined}),false);
assert.equal(scope.required({...topic,storySourceSelection:{adaptation:'original'}}),false);
assert.equal(scope.required({...topic,storySourceSelection:{adaptation:'faithful'}}),false);
assert.equal(scope.required({}),false);
assert.ok(scope.errors(topic).length>=2);
const r=fixture(9);topic.literaryResearch={...r.research,input_signature:scope.signature(topic),evaluation:ctx.evaluate(r,9,urls,evidence),panel_evidence:r.panels.map((p,i)=>({index:i+1,dimension:p.dimension,claim_refs:p.claim_refs}))};
topic.literaryReviewReceipt={author_content_reviewed:true,snapshot:scope.snapshot(topic)};
assert.equal(scope.errors(topic).length,0);
const hash=scope.digest(topic);
topic.panels[0].caption+='修改';assert.ok(scope.errors(topic).length);assert.notEqual(scope.digest(topic),hash);
topic.panels[0].caption=r.panels[0].caption;assert.equal(scope.errors(topic).length,0);
topic.literaryEvidence+='\n新资料';assert.ok(scope.errors(topic).length);
assert.ok(html.includes('creative-director.js?v=5.7.0-literature-sources'));
assert.ok(sw.includes('davylab-comic-press-v5.7.0-literature-sources'));
assert.ok(app.includes("if(wfLiteraryResearchRequired(p)){const {input_signature,...research}"));
assert.ok(worker.includes("a.mode==='literary_review'?await wtLiteraryAuth(request,env):await wtArchiveAuth(request,env)"));
console.log('LITERATURE V2 PASS: 57 counts, 9 rejected cases, scoped entry, evidence/receipt drift, cache and direct-mode guards');

const staticRule=worker.split('\n').find(l=>l.includes("path.includes('..')"));
const allow=new RegExp(staticRule.slice(staticRule.indexOf('/^')+1,staticRule.indexOf('/.test(path)')));
for(const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|webmanifest|svg))(?:\?[^"]*)?"/g))assert.ok(allow.test(match[1]),'Worker must serve '+match[1]);
let modelCalls=0,authCalls=0,deny=false,modelResponse=fixture(9);
modelResponse.characters=[{name:'测试甲'},{name:'测试乙'}];
const routeCtx={URL,URLSearchParams,AbortSignal,Response,
 authenticate:async()=>{authCalls++;return deny?null:{id:'fixture-owner'}},
 wtArchiveAuth:async()=>({user:{id:'fixture-owner'}}),
 wtJson:(body,status=200)=>Response.json(body,{status}),
 fetch:async(url,opts)=>{
  const u=new URL(url);if(u.hostname.endsWith('wikipedia.org')||u.hostname==='openlibrary.org')assert.equal(opts.redirect,'manual','Cloudflare compatible redirect mode');
  if(u.hostname==='api.deepseek.com'){modelCalls++;assert.equal(opts.method,'POST');const body=JSON.parse(opts.body);assert.equal(body.model,'deepseek-flash');return Response.json({model:'synthetic-model',choices:[{message:{content:JSON.stringify(modelResponse)}}]});}
  if(u.hostname==='zh.wikipedia.org'||u.hostname==='en.wikipedia.org')return Response.json({query:{pages:[{title:'测试作品',extract:'这是一部用于自动回归测试的文学小说，内容均为合成示例，并非真实书目。',fullurl:u.origin+'/wiki/Fixture'},{title:'Unsafe',extract:'wrong host',fullurl:'https://evil.example/wiki/Fixture'}]}});
  throw Error('unexpected mock URL '+url);
 }
};
vm.runInNewContext(region(worker,'function wtLiteraryEval(',' if(p===\'/api/archive/cover\'')+'\n return null;}\nthis.route=wt3ArchiveV3;',routeCtx);
const env={WORLDTOON_ARCHIVE_OWNER_UID:'fixture-owner',WORLDTOON_DEEPSEEK_API_KEY:'not-real'};
const req=(path,body)=>{const url=new URL('https://fixture.example/api/archive/'+path);return routeCtx.route({method:'POST',json:async()=>body},env,url)};
(async()=>{
 deny=true;assert.equal((await req('literary-sources',{title:'测试作品'})).status,401);assert.equal(modelCalls,0);
 deny=false;const sources=await req('literary-sources',{title:'测试作品'});assert.equal(sources.status,200);const candidates=await sources.json();assert.equal(candidates.items.length,2);assert.ok(candidates.items.every(x=>x.verification_status==='candidate_unverified'));
 const basic={idea:'只用于测试的原创文学漫画构思',title:'测试作品',panel_count:9};
 assert.equal((await req('deepseek-expand',{...basic,mode:'literary_review'})).status,400);assert.equal(modelCalls,0);
 const reqEvidence=evidence+'\n'+('补充测试说明，不对应任何真实作品。'.repeat(6));
 const res=await req('deepseek-expand',{...basic,mode:'literary_review',source_urls:urls,research_evidence:reqEvidence});assert.equal(res.status,200);assert.equal((await res.json()).story.research.evaluation.structural_pass,true);
 modelResponse=fixture(9);modelResponse.characters=[{name:'测试甲'},{name:'测试乙'}];modelResponse.research.claims[0].source_url=urls[1];
 assert.equal((await req('deepseek-expand',{...basic,mode:'literary_review',source_urls:urls,research_evidence:reqEvidence})).status,422);
 modelResponse={characters:[{name:'测试甲'},{name:'测试乙'}],panels:fixture(9).panels.map(x=>({title:x.title,scene:x.scene,caption:x.caption}))};
 assert.equal((await req('deepseek-expand',basic)).status,200,'ordinary DeepSeek does not require literary fields');
 assert.equal(modelCalls,3,'only valid synthetic requests call mocked model');assert.ok(authCalls>=4);
 let redirectCalls=0;
 const collector=vm.runInNewContext(region(worker,'async function wtLiterarySourceCandidates(','async function wt3ArchiveV3(')+'\nwtLiterarySourceCandidates;', {URL,URLSearchParams,AbortSignal,Date});
 const blocked=await collector('测试作品','',async(url,opts)=>{redirectCalls++;assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://unsafe.invalid'}})});
 assert.equal(redirectCalls,2,'redirects cannot trigger additional outbound requests');
 assert.equal(blocked.items.length,0);
 assert.equal(blocked.warnings.filter(x=>x.includes('重定向')).length,2);assert.ok(blocked.warnings.some(x=>x.includes('未找到')));
 const sample=await collector('少年來了 | Human Acts','',async(url,opts)=>{
  const u=new URL(url);assert.ok(u.searchParams.has('titles'));assert.equal(u.searchParams.has('generator'),false);
  return Response.json({query:{pages:[{title:'偶像来了',extract:'中国电视综艺节目，和小说无关',fullurl:u.origin+'/wiki/Idol'},{title:'Han Kang',extract:'韩江是小说作家，但是这是作者介绍而不是作品介绍。',fullurl:u.origin+'/wiki/Author'},{title:'Human Acts',extract:'Human Acts is a novel by Han Kang, a work of fiction published in Korea.',fullurl:u.origin+'/wiki/Human_Acts'}]}});
 },{author:'Han Kang'});
 assert.equal(sample.schema,'literary_sources_v3');assert.ok(sample.items.length>=3);assert.ok(sample.items.every(x=>!x.title.includes('偶像')&&!x.url.endsWith('/Author')&&!x.url.endsWith('/Human_Acts')&&x.relevance_score>=70&&/[一-龥]{2}/.test(x.excerpt)));
 const nothing=await collector('不存在的作品｜Imaginary title','',async(url)=>Response.json({query:{pages:[{title:'偶像来了',extract:'这是与选题无关的电视综艺节目',fullurl:new URL(url).origin+'/wiki/Idol'}]}}));
 assert.equal(nothing.items.length,0);
 console.log('LITERATURE V3 PASS: exact work, wrong-title and author-page rejection, Chinese-only, free collection');
 console.log('LITERATURE V2 WORKER ROUTE PASS: candidate sources, auth, input gate, grounded response, ordinary DeepSeek, static module allowlist (mocked upstream)');
})().catch(e=>{console.error(e);process.exitCode=1});
