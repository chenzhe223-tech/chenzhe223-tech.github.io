'use strict';
/* Read-only production smoke: new ephemeral anonymous browser context, no account and no publication. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='https://worldtoon.chenzhe223.workers.dev';
(async()=>{
 const config=await fetch(base+'/api/config').then(r=>r.json());
 assert.equal(typeof config.storyboardAiEnabled,'boolean','Worker must advertise native storyboard AI capability');
 assert.equal(config.aiEnabled,false,'Do not enable unrelated paid graphic/script AI track');
 const response=await fetch(base+'/api/ai/storyboard',{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({title:'试验',summary:'这是一份用于测试未经授权生成的故事背景资料',provider:'native',cast:[{name:'甲'},{name:'乙'}]})});
 assert.equal(response.status,401,'Storyboard API must refuse unauthenticated visitors');
 const chromiumBrowser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [name,width] of [['mobile',390],['desktop',1440]]){
   const page=await chromiumBrowser.newPage({viewport:{width,height:900}});
   await page.goto(base+'/#/director',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>typeof window.wtDirector==='object'&&typeof newProject==='function',{timeout:45000});
   await page.evaluate(()=>newProject({title:'时间机器｜The Time Machine',category:'世界文学',
    summary:'青年研究员制造时间机器，前往遥远未来后发现文明与责任的巨大悖论。'}));
   await page.locator('[data-director-step="2"]').click();
   await page.waitForFunction(()=>selected()?.panels?.every(x=>String(x.scene||'').length>=32),null,{timeout:30000});
   const original=await page.evaluate(()=>({
      method:selected().creativeDirection.storyboardProvenance.method,
      scenes:selected().panels.map(x=>x.scene),
      buttons:[...document.querySelectorAll('[data-director-action]')].map(x=>x.dataset.directorAction),
      overflow:document.documentElement.scrollWidth>window.innerWidth+1,
      arc:document.querySelector('.director-board-info')?.textContent||''
   }));
   assert.equal(original.scenes.length,9);
   assert.ok(original.scenes[0].includes('铜制时间机器'));
   assert.equal(original.method,'local_structure_rules','Anonymous must never pretend that a model generated the script');
   assert.ok(original.buttons.includes('ai')&&original.buttons.includes('fill')&&original.buttons.includes('draft'));
   assert.ok(original.arc.includes('反转寓言'));
   assert.equal(original.overflow,false,'No horizontal overflow on '+name);
   const first=page.locator('[data-director-panel="dialogue"][data-panel-index="0"]');
   await first.fill('作者亲自编写的原创对白，我要保留。');await first.blur();
   assert.equal(await page.evaluate(()=>selected().panels[0].dialogue),'作者亲自编写的原创对白，我要保留。');
   await page.locator('[data-director-provider]').selectOption('deepseek');
   const key=page.locator('[data-director-api-key]');
   assert.equal(await key.count(),1);
   await key.fill('sk-test-ephemeral-key-do-not-store');
   const serialized=await page.evaluate(()=>JSON.stringify({project:selected(),saved:localStorage.getItem('davylab-comic-press-v1')}));
   assert.ok(!serialized.includes('sk-test-ephemeral-key'),'BYOK key must not enter persistent project storage');
   console.log('BROWSER_PASS',name,JSON.stringify({nineFrames:original.scenes.length,mode:original.method,arc:original.arc,noOverflow:true,manualEdit:true,ephemeralKey:true}));
   await page.close();
  }
 }finally{await chromiumBrowser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
