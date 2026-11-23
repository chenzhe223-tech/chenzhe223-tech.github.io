/* Browser contract for News Engine overseas-reading cutover. Runs only locally in CI. */
const fs=require("node:fs");
const path=require("node:path");
const { chromium }=require("playwright");
const assert=require("node:assert/strict");
const origin="http://127.0.0.1:8877";
const original=JSON.parse(fs.readFileSync("radar/data/latest.json","utf8"));
const date=original.report_date;
original.xnews_status="ok";
original.xnews_voices=Array.from({length:6},(_,i)=>({
  title:"Original independent AI research announcement "+(i+1),
  title_en:"Original independent AI research announcement "+(i+1),
  title_zh:"",
  url:"https://research"+i+".example.org/post",
  source_url:"https://research"+i+".example.org/post",
  published: date+"T10:00:00+08:00",
  summary:"来源：公开RSS。新闻线索未经独立核验。",
  summary_zh:"来源：公开RSS。新闻线索未经独立核验。",
  source:"DAVYLAB News Engine · Original",
  source_kind:"news_engine_rss_discovery",
  verification_status:"source_not_independently_verified",
  publishable:false,
}));
async function run(){
 const out="test-results/news-engine-radar";
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900}});
   await page.route("**/radar/data/latest.json*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(original)}));
   await page.route("**/radar/data/archive/*.json*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(original)}));
   const response=await page.goto(origin+"/radar/daily/",{waitUntil:"domcontentloaded",timeout:25000});
   assert.equal(response.status(),200);
   await page.waitForFunction(()=>typeof reportData!=="undefined" && reportData && reportData.xnews_voices?.length===6,null,{timeout:20000});
   await page.locator("#xnewsVoices .item").first().waitFor();
   assert.equal(await page.locator("#xnewsVoices .item").count(),6);
   assert.equal(await page.locator("#xnewsVoices .voice-cover").count(),0);
   assert.equal(await page.locator("#xnewsVoices .story-label").first().textContent().then(s=>s.includes("NEWS ENGINE")),true);
   assert.equal(await page.locator("#xnewsVoices a[href^='https://research']").count(),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.locator("#xnewsVoicesSection").screenshot({path:path.join(out,"overseas-"+width+".png")});
   await page.locator("#xnewsVoices h3 a").first().click();
   await page.locator(".rail-links .primary").waitFor();
   assert.match(page.url(),/type=xnews/);
   assert.equal(await page.locator(".rail-links .primary").getAttribute("href"),"https://research0.example.org/post");
   assert.match(await page.locator(".rail").textContent(),/News Engine/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   await page.screenshot({path:path.join(out,"reader-"+width+".png")});
   await page.close();
  }
  console.log("DAVYLAB News Engine Radar browser E2E: mobile+desktop source-only cards, deep link, provenance and overflow PASS");
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1});
