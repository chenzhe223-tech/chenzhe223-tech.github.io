'use strict';
/* Production-origin browser QA for original style previews.
 * Read-only: renders the real selector into a temporary local DOM, no user records modified. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const scenarios=[{width:390,height:844,label:'mobile'},{width:820,height:1180,label:'tablet'},{width:1440,height:960,label:'desktop'}];
 const report={schema:'davylab.worldtoon.style-browser-qa.v1',viewports:[]};
 fs.mkdirSync('worldtoon-ui-screenshots',{recursive:true});
 try{
  for(const spec of scenarios){
   const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto('https://worldtoon.chenzhe223.workers.dev/',{waitUntil:'domcontentloaded',timeout:60000});
   let ready=false;
   for(let attempt=0;attempt<22;attempt++){
     ready=await page.evaluate(()=>window.WTStyleV3?.CATALOG?.length===25);
     if(ready)break;
     await page.waitForTimeout(4500);
     await page.reload({waitUntil:'domcontentloaded',timeout:30000});
   }
   if(!ready)throw Error('Live WorldToon Creative Director has not deployed 25 styles; refusing a mock pass');
   await page.evaluate(()=>{
    const view=document.getElementById('view');
    view.innerHTML='<div class="director-page"><section class="box director-section"><h2>选择漫画画风</h2>'+
       window.WTStyleV3.cards({styleId:'japanese-pastoral-wonder'})+
       window.WTStyleV3.detail({styleId:'japanese-pastoral-wonder'})+'</section></div>';
    document.querySelector('.wt-v3-allstyles').open=true;
    document.querySelector('.wt-v3-selected-detail').open=true;
    document.querySelectorAll('img').forEach(img=>{img.loading='eager'});
   });
   await page.waitForFunction(()=>{
      const pictures=[...document.querySelectorAll('.wt-v3-grid img')];
      return pictures.length===25&&pictures.every(img=>img.complete&&img.naturalWidth>0);
   },{timeout:55000});
   const metrics=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.wt-v3-grid .wt-v3-card')];
    const imgs=[...document.querySelectorAll('.wt-v3-grid img')];
    const m=cards.map(el=>el.getBoundingClientRect());
    const widthDiff=Math.abs(m[0].width-m[1].width);
    const detailImg=document.querySelector('.wt-v3-guide-zoom img');
    return {
      count:imgs.length,valid:imgs.every(x=>x.complete&&x.naturalWidth>0),
      sources:new Set(imgs.map(x=>x.currentSrc)).size,
      widthsEqual:widthDiff<2,
      cropped:imgs.some(x=>getComputedStyle(x).objectFit!=='contain'),
      horizontalOverflow:document.documentElement.scrollWidth>window.innerWidth+1,
      visibleGuide:!!detailImg&&detailImg.complete&&detailImg.naturalWidth>0,
      viewport:window.innerWidth,
      cardsWidth:m[0].width
    };
   });
   if(metrics.count!==25||!metrics.valid||metrics.sources!==25||!metrics.widthsEqual||
      metrics.cropped||metrics.horizontalOverflow||!metrics.visibleGuide)
      throw Error(spec.label+' UI assertion failed: '+JSON.stringify(metrics));
   await page.locator('.wt-v3-grid').screenshot({path:path.join('worldtoon-ui-screenshots',spec.label+'-25styles.png'),timeout:30000});
   report.viewports.push({label:spec.label,...metrics,passed:true,pageErrors:errors.slice(0,5)});
   console.log(spec.label,'PASS',JSON.stringify(metrics));
   await page.close();
  }
  report.passed=true;
 }finally{
  fs.writeFileSync('worldtoon-browser-qa.json',JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(err=>{console.error(err);process.exitCode=1});
