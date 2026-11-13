'use strict';
/* Real Chromium UI regression for the existing browser application. No model calls or production publication. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost:9877');
 if(url.pathname.startsWith('/api/')||url.pathname==='/health'){res.writeHead(404);res.end('not configured for this isolated test');return}
 const file=path.resolve(root,decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)));
 if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
 fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(9877,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const report={schema:'davylab.worldtoon.v4.ui-qa.v1',tests:[],real_browser:true,model_inference_invoked:false};
 fs.mkdirSync('worldtoon-v4-screenshots',{recursive:true});
 try{
  const cases=[
   {name:'mobile',width:390,height:844,mode:'one_line'},
   {name:'tablet',width:820,height:1180,mode:'hotspot'},
   {name:'desktop',width:1440,height:960,mode:'original'}
  ];
  for(const scenario of cases){
   const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},deviceScaleFactor:1});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:9877/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.WT4Workflow&&!!document.querySelector('#wt4-original-form'),{timeout:12000});
   for(const label of ['热点改编','一句话创作','自主创作']){
    assert.ok((await page.locator('.wt4-entry h2').allTextContents()).includes(label),label+' entry exists');
   }
   let horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   assert.equal(horizontal,false,scenario.name+' landing page has horizontal overflow');
   await page.screenshot({path:'worldtoon-v4-screenshots/'+scenario.name+'-start.png',fullPage:true});
   if(scenario.mode==='hotspot'){
    assert.equal(await page.locator('a[href="#/live"]').count()>0,true);
    await page.evaluate(()=>{
     data.topics.unshift({id:'v4-browser-fixture',title:'仅用于隔离测试的虚构热点',summary:'该热点为自动化测试夹具，不是新闻事实。',
      stage:'待核验',category:'AI 科技',heat:1,impact:1,story:1,source:'',isSample:true});
     persist();
    });
    await page.locator('.wt4-entry a[href="#/radar"]').click();
    await page.waitForFunction(()=>location.hash==='#/radar');
    await page.locator('[data-action="topic-to-project"][data-id="v4-browser-fixture"]').click();
    await page.waitForFunction(()=>location.hash.startsWith('#/workspace/')&&!!document.querySelector('.wt4-workspace'),{timeout:12000});
    const actual=await page.evaluate(()=>({path:selected().creationPath,id:selected().id,sourceTitle:selected().sourceTitle||selected().title,
      saved:JSON.parse(localStorage.getItem('davylab-comic-press-v1')||'{}').projects.some(x=>x.id===selected().id)}));
    assert.equal(actual.path,'hotspot');
    assert.equal(actual.saved,true);
    assert.ok(actual.sourceTitle.includes('虚构热点'));
    report.tests.push({viewport:scenario.name,flow:'hotspot to real project',source_claims:'test fixture, not news fact',passed:true});
   } else {
    if(scenario.mode==='one_line'){
     await page.locator('#wt4-idea').fill('未来城市里，一枚芯片意外成为所有人的护照');
     await page.locator('#wt4-idea-form button[type=submit]').click();
    }else{
     await page.locator('#wt4-title').fill('月球书店');
     await page.locator('#wt4-theme').fill('一家月球书店试图为地球保留真实的故事');
     await page.locator('#wt4-original-form button[type=submit]').click();
    }
    await page.waitForFunction(()=>location.hash.startsWith('#/workspace/')&&!!document.querySelector('.wt4-workspace'),{timeout:12000});
    const data=await page.evaluate(()=>{
      const p=selected(),stored=JSON.parse(localStorage.getItem('davylab-comic-press-v1')||'{}');
      return {path:p.creationPath,id:p.id,title:p.title,idea:p.ideaSeed||'',projectStored:stored.projects.some(x=>x.id===p.id),stepCount:document.querySelectorAll('.wt4-step').length};
    });
    assert.equal(data.path,scenario.mode);
    assert.equal(data.projectStored,true,'project persists immediately');
    assert.equal(data.stepCount,7);
    assert.ok(scenario.mode==='one_line'?data.idea.includes('一枚芯片'):data.title==='月球书店');
    await page.locator('[data-wt4-step="1"]').first().click();
    await page.waitForFunction(()=>location.hash.endsWith('/1'));
    assert.ok(await page.locator('.wt4-role-picker').isVisible());
    await page.locator('.wt4-editor button[data-wt4-step="0"]').first().click();
    await page.waitForFunction(()=>location.hash.endsWith('/0'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!document.querySelector('.wt4-workspace'));
    const recovered=await page.evaluate(()=>{const p=selected();return {path:p.creationPath,id:p.id,title:p.title}});
    assert.equal(recovered.id,data.id,'reload restores original project, not a sample');
    await page.screenshot({path:'worldtoon-v4-screenshots/'+scenario.name+'-workspace.png',fullPage:true});
    horizontal=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
    assert.equal(horizontal,false,scenario.name+' wizard has horizontal overflow');
    report.tests.push({viewport:scenario.name,flow:scenario.mode,project_recovery:true,seven_steps:true,passed:true});
   }
   await context.close();
  }
  report.passed=true;
 } finally {
  fs.writeFileSync('worldtoon-v4-browser-qa.json',JSON.stringify(report,null,2));
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
 console.log('WorldToon V4 real Chromium UI acceptance PASS:',JSON.stringify(report.tests));
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
