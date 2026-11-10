'use strict';
// Browser regression for persistent visible nested handoff navigation.
// Live read-only navigation only; never mutate production user projects.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [label,width,height] of [['desktop',1440,900],['tablet',820,1000],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto('https://worldtoon.chenzhe223.workers.dev/',{waitUntil:'domcontentloaded',timeout:60000});
   const probe=await page.evaluate(()=>({
      href:location.href,groupCount:document.querySelectorAll('#mainnav [data-nav-group="handoff"]').length,
      navPreview:document.getElementById('mainnav')?.innerHTML?.slice(0,1500),
      pageTitle:document.title
   }));
   console.log('NAV_PROBE',label,JSON.stringify(probe));
   await page.waitForSelector('#mainnav [data-nav-group="handoff"]',{state:'attached',timeout:30000});
   const nav=page.locator('#mainnav');
   assert.equal(await nav.locator('a[data-route="handoff"]').count(),1);
   assert.equal(await nav.locator('a[data-route="director"]').count(),1);
   assert.equal(await nav.locator('a[data-route="archive"]').count(),1);
   assert.equal(await nav.locator('.nav-children>a').count(),2);
   const styles=await page.locator('.nav-child').first().evaluate(el=>({
      margin:getComputedStyle(el.parentElement).marginLeft,
      display:getComputedStyle(el.parentElement).display,
      isNested:!!el.closest('[data-nav-group="handoff"]')
   }));
   assert.equal(styles.isNested,true);
   assert.equal(styles.display,'grid');

   for(const [route,crumb] of [['handoff','制作交接'],['director','创意导演台'],['archive','生产调度中心']]){
      if(width<=800)await page.locator('#menuToggle').click();
      const anchor=page.locator('#mainnav a[data-route="'+route+'"]');
      assert.equal(await anchor.isVisible(),true,label+' '+route+' navigation hidden');
      await anchor.click();
      await page.waitForFunction(expected=>document.querySelector('#crumb')?.textContent===expected,crumb,{timeout:12000});
      assert.equal(await anchor.getAttribute('aria-current'),'page');
      assert.equal(await anchor.evaluate(el=>el.classList.contains('active')),true);
      assert.equal(await page.locator('.nav-parent').evaluate(el=>el.classList.contains('is-group-active')),true);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      assert.equal(overflow,false,label+' '+route+' horizontal overflow');
   }
   if(errors.length)console.warn(label,'non-fatal page errors',JSON.stringify(errors.slice(0,3)));
   console.log('PASS',label,width,'main link and two sublinks navigate directly, correct active highlight, no overflow');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
