'use strict';
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.host!=='local.test')return route.abort();
   const f=path.join(__dirname,'..',u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
   return fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({path:f}):route.fulfill({status:404,body:''});
  });
  await page.goto('https://local.test/');
  await page.evaluate(()=>{
   const p=emptyProject({title:'测试散文',category:'诺奖文学',source:'https://example.org/book'});
   data.projects.unshift(p);ui.selected=p.id;p.panels.length=4;nav('director/'+p.id);
  });
  await page.locator('summary').filter({hasText:'文学编辑稿与读者验收'}).first().click();
  const book=await page.evaluate(()=>WTLiterature.packet(selected()));
  const b={work:book.work,entry:'一把空椅子',discovery:'同一把椅子的位置变化让人重新理解等待。',initialReading:'等人来',turningDetail:'椅背朝门',openQuestion:'等的人还会来吗',method:book.methods[2],evidence:[{claim:'椅子出现两次',source:'虚构测试文本',locator:'第1段及末段',kind:'原作事实'}],
   panels:['把椅子拖到门边','把椅子转向门内','重新看见椅背','跨过椅子离开'].map((action,i)=>({title:'椅子'+i,carry:'门边的椅子',gain:'辨认椅子的位置'+i,action,visible:'椅背的方向',change:'椅背位置'+i,caption:'',speaker:'',dialogue:'',next:'继续观察',evidence:[1]}))};
  await page.locator('#literary-draft').fill(JSON.stringify(b));await page.locator('[data-lit-save=draft]').click();
  const state=await page.evaluate(()=>({issues:WTLiterature.checks(selected()),approved:wtDirector.checks(selected()),version:selected().literaryWorkflowVersion}));assert.deepEqual(state.issues,[]);assert.equal(state.version,2);assert.ok(state.approved.some(x=>x.includes('脚本审读')));
  await page.locator('summary').filter({hasText:'文学编辑稿与读者验收'}).first().click();
  const r=await page.evaluate(()=>WTLiterature.report('脚本','Agent自检'));
  r.dimensions={文学理解:'通过',阅读连贯性:'通过',视觉质量:'待成图'};r.answers.forEach((a,i)=>{a.answer=['椅子的朝向改变了等待的意思','末段回应门边的椅子','转过去的椅背','离开时跨过椅子','特别留意椅背朝向'][i];a.panels=[i%4+1]});
  await page.locator('#literary-report').fill(JSON.stringify(r));await page.locator('[data-lit-save=report]').click();
  const result=await page.evaluate(async()=>{
   const p=selected(),c=wtDirector.ensure(p);c.reviewed=true;
   c.approval={lock_hash:wtDirector.digest(p),author_approved:true,approved_at:now()};
   const errors=wtDirector.checks(p);if(errors.length)throw Error(errors.join('/'));
   const t=wfTaskObject(p),b=wfProductionBible(p,t),jobs=wfSingleImageJobs(p,t,b);
   let files;packZip=entries=>{files=entries;return new Uint8Array()};saveFile=()=>{};copyText=async()=>{};
   await wfMakeTask(p);
   const names=files.map(f=>f.name);
   const result={names,jobs:jobs.jobs.length,prompt:jobs.jobs[0].prompt,review:t.adaptation.literary_review.schema,final:canApprove(p)};
   p.panels[0].caption='已修改';result.stale=WTLiterature.passed(p,'脚本');return result;
  });
  assert.ok(result.names.includes('literary-final-review.json'));assert.ok(result.names.includes('literary-script-review.json'));assert.equal(result.jobs,5);assert.match(result.prompt,/椅背位置0/);assert.match(result.review,/v2$/);assert.equal(result.stale,false);assert.ok(result.final.some(x=>x.includes('成品的五项')));console.log('PASS: research, GUI draft and script QA, locked four-panel silent storyboard, image prompts, ZIP entries, stale and final review checks');
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
