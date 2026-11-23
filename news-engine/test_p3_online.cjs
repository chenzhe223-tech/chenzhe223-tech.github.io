const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const timestamp=Date.now();
const sites={
 worldtoon:"https://worldtoon.chenzhe223.workers.dev/",
 topic:"https://chenzhe223-tech.github.io/topic-studio/",
 knowa:"https://davylab-knowa-p0.chenzhe223.workers.dev/studio"
};
async function one(browser,width,which){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900}});
 try{
  const url=which==="worldtoon"?sites.worldtoon+"?p3="+timestamp+"#/ai-briefing":
   which==="topic"?sites.topic+"?p3="+timestamp:sites.knowa+"?p3="+timestamp;
  const r=await page.goto(url,{waitUntil:"domcontentloaded",timeout:40000});
  assert.equal(r.status(),200,which+" reachable");
  const host=which==="worldtoon"?"#neP3World":which==="topic"?"#neP3Topic":"#neP3Knowa";
  if(which==="worldtoon"){
   await page.locator('button[data-brief="view"][data-value="history"]').waitFor({timeout:25000});
   await page.locator('button[data-brief="view"][data-value="history"]').click();
  }else if(which==="topic"){
   await page.evaluate(()=>{if(typeof changeSection==="function")changeSection("discover");window.DAVYLABEditorialWorkspace?.setSource("xnews",false)});
   await page.locator("#newsEngineP3Topic summary").waitFor({timeout:25000});
   await page.locator("#newsEngineP3Topic summary").click();
  }else{
   await page.locator("#neP3KnowaDetails summary").waitFor({timeout:25000});
   await page.locator("#neP3KnowaDetails summary").click();
  }
  await page.locator(host+" [data-ne-card]").first().waitFor({timeout:50000});
  const cards=await page.locator(host+" [data-ne-card]").count();
  assert.ok(cards>0,which+" real V2 cards");
  assert.match(await page.locator(host+" [data-ne-status]").textContent(),/有效期刊|匹配 [0-9]+ 条/);
  assert.ok(await page.locator(host+" [data-ne-card] a[href^='https://']").count()>=cards);
  const scoreText=await page.locator(host+" [data-ne-card]").first().textContent();
  assert.ok(scoreText.includes("规则分")&&scoreText.includes("来源"),which+" P2 score/rights");
  // P3 component remains responsive and does not force horizontal overflow.
  if(width===390)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=2),
   which+" 390px horizontal overflow");
  if(which==="worldtoon"){
   await page.locator('button[data-brief="view"][data-value="top5"]').click();
   await page.locator(".brief-spotlight").waitFor({timeout:10000});
   await page.locator('button[data-brief="view"][data-value="engine"]').click();
   await page.locator(".brief-story").first().waitFor({timeout:12000});
  }else if(which==="topic"){
   await page.waitForFunction(()=>window.DAVYLABXNews?.status?.().newsEngineOk===true,null,{timeout:25000});
   assert.ok(await page.locator("#xnewsList .xnews-card").count()>0,"Original overseas discovery still exists");
  }else{
   const health=await page.request.get(sites.knowa.replace("/studio","/api/health"),{timeout:15000});
   assert.equal(health.status(),200);
   const d=await health.json();assert.equal(d.ok,true);
   assert.ok(d.knowledgeAssets>=36,"Original knowledge assets untouched");
   // Pick a historical item in an isolated Chromium profile.
   const href=await page.locator(host+" [data-ne-card] a").first().getAttribute("href");
   await page.locator(host+" [data-ne-pick='0']").click();
   await page.waitForFunction(key=>{
    try{return(JSON.parse(localStorage.getItem("knowa:radar:pool:v1")||"[]")).some(x=>x.sourceUrl===key&&x.publishable===false)}
    catch{return false}
   },href,{timeout:16000});
  }
  console.log("P3 ONLINE PASS "+which+" "+width+"px live HTTPS, source links, rule scores, old flow and rights");
 }finally{await page.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   for(const which of ["worldtoon","topic","knowa"]){
    let failure;
    for(let attempt=1;attempt<=5;attempt++){
     try{await one(browser,width,which);failure=null;break}
     catch(e){failure=e;console.log("P3 rollout retry "+which+" "+width+" attempt "+attempt+": "+String(e.message).slice(0,180));await new Promise(r=>setTimeout(r,5000))}
    }
    if(failure)throw failure;
   }
  }
  console.log("P3 PRODUCTION SUCCESS: six site+viewport combinations, live V2 and preserved v1/knowledge");
 }finally{await browser.close()}
})().catch(e=>{console.error("P3 PRODUCTION FAILED",e);process.exitCode=1});
