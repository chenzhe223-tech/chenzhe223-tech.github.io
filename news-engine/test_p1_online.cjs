const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const src={
 worldtoon:"https://worldtoon.chenzhe223.workers.dev/",
 topic:"https://chenzhe223-tech.github.io/topic-studio/"
};
const stamp=Date.now();
async function withPage(browser,width,site,check){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900}});
 try{
  const resp=await page.goto(site+"?p1qa="+stamp+(site===src.worldtoon?"#/ai-briefing":""),{waitUntil:"domcontentloaded",timeout:35000});
  assert.equal(resp.status(),200,"Live site HTTP "+site);
  await check(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=2,"Page horizontal overflow "+overflow+"px at "+width);
  return true;
 }finally{await page.close()}
}
async function retry(browser,width,site,check){
 let error;
 for(let i=0;i<5;i++){
  try{return await withPage(browser,width,site,check)}
  catch(e){error=e;console.log("P1 pending CDN propagation or runtime: "+site+" width="+width+" attempt="+(i+1)+" "+String(e.message).slice(0,120));await new Promise(r=>setTimeout(r,5000))}
 }
 throw error;
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   await retry(browser,width,src.worldtoon,async page=>{
    await page.locator('button[data-brief="view"][data-value="engine"]').waitFor({timeout:20000});
    await page.locator('button[data-brief="view"][data-value="engine"]').click();
    await page.locator('.brief-story').first().waitFor({timeout:12000});
    const first=await page.locator('.brief-story a[href^="https://"]').first().getAttribute("href");
    assert.ok(first?.startsWith("https://")&&!first.includes("workers.dev/api"),"Original publisher link missing");
    assert.match(await page.locator(".brief-section-head").textContent(),/News Engine/);
   });
   await retry(browser,width,src.topic,async page=>{
    await page.waitForFunction(()=>window.DAVYLABXNews?.status?.().newsEngineOk===true,null,{timeout:22000});
    const items=await page.evaluate(()=>window.DAVYLABXNews.getItems());
    assert.ok(items.some(x=>x.source_kind==="news_engine_public_api"),"News Engine not integrated into published Topic Studio");
    assert.ok(items.every(x=>x.original_url.startsWith("https://")),"Original source preservation");
    assert.match(await page.locator("#xnewsStatus").textContent(),/News Engine/);
   });
   console.log("P1 PRODUCTION VERIFIED "+width+" WorldToon + Topic Studio");
  }
 }finally{await browser.close()}
})().catch(e=>{console.error("P1 PRODUCTION QA FAILED",e);process.exitCode=1});
