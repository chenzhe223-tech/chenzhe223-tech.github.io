const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const base="http://127.0.0.1:8877",out="test-results/news-engine-p1";
fs.mkdirSync(out,{recursive:true});
const report=JSON.parse(fs.readFileSync("radar/data/latest.json","utf8"));
const leads=report.xnews_voices.filter(x=>x.source_kind==="news_engine_rss_discovery").slice(0,6).map((x,i)=>({
 id:"overseas-"+i,issue_date:report.report_date,stream:"overseas",
 title:x.title_zh||x.title,title_original:x.title,
 summary:x.summary_zh||x.summary||"Original source lead, unverified",
 source:x.source,source_url:x.source_url||x.url,published_at:x.published,
 publishable:false,verification_status:"requires_independent_fact_check",selection_score:65
}));
assert.ok(leads.length>=3,"Require real Radar items in fixture");
const payload={issue_date:report.report_date,is_today:true,publishable:false,data:leads};
const issue={
 status:"ok",date:report.report_date,posterUrl:"",
 top5:(report.top5||[]).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 global:(report.news||[]).slice(0,8).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 china:(report.china_ai_news||[]).slice(0,5).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 skills:[],note:{core:"Today published Radar issue",trend:"Human review required",question:"What can be verified?"}
};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900}});
   await page.route("**/api/ai-briefing?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(issue)}));
   await page.route("**/api/ai-briefing/history",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({days:[report.report_date]})}));
   await page.route("**/api/v1/news?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload),headers:{"access-control-allow-origin":"*"}}));
   const main=await page.goto(base+"/comic-studio/#/ai-briefing",{waitUntil:"domcontentloaded",timeout:30000});
   assert.equal(main.status(),200);
   await page.locator('button[data-brief="view"][data-value="engine"]').waitFor({timeout:25000});
   await page.locator('button[data-brief="view"][data-value="engine"]').click();
   const cards=page.locator(".brief-story");
   await cards.first().waitFor({timeout:15000});
   assert.ok(await cards.count()>=1,"WorldToon shows News API candidates");
   assert.match(await page.locator(".brief-section-head").textContent(),/News Engine/);
   assert.ok(await page.locator('.brief-story a[target="_blank"]').count()>0);
   assert.ok(await page.locator('.brief-story button[data-brief="save"]').count()>0);
   assert.ok(await page.locator('.brief-story button[data-brief="draft"]').count()>0);
   await page.locator('button[data-brief="view"][data-value="top5"]').click();
   assert.match(await page.locator(".brief-spotlight").textContent(),/今日五大观察/);
   if(width===390)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.screenshot({path:path.join(out,"worldtoon-"+width+".png"),fullPage:true,timeout:30000});
   await page.close();
   const t=await browser.newPage({viewport:{width,height:width===390?844:900}});
   await t.route("**/api/v1/news?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload),headers:{"access-control-allow-origin":"*"}}));
   await t.goto(base+"/topic-studio/",{waitUntil:"domcontentloaded",timeout:30000});
   await t.waitForFunction(()=>window.DAVYLABXNews?.status?.().newsEngineOk===true,null,{timeout:30000});
   const st=await t.evaluate(()=>window.DAVYLABXNews.status());
   assert.equal(st.newsEngineOk,true,"Topic Studio News API connected");
   const items=await t.evaluate(()=>window.DAVYLABXNews.getItems());
   assert.ok(items.some(x=>x.source_kind==="news_engine_public_api"&&x.original_url.startsWith("https://")));
   assert.match(await t.locator("#xnewsStatus").textContent(),/News Engine 已连接/);
   assert.ok(await t.locator("#xnewsList .xnews-card").count()>0);
   if(width===390)assert.ok(await t.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await t.locator("#xnewsDiscovery").screenshot({path:path.join(out,"topicstudio-"+width+".png"),timeout:30000});
   await t.close();
   console.log("P1 BROWSER PASS "+width+"px WorldToon + Topic Studio");
  }
  const t=await browser.newPage({viewport:{width:390,height:844}});
  await t.route("**/api/v1/news?*",r=>r.abort());
  await t.goto(base+"/topic-studio/",{waitUntil:"domcontentloaded",timeout:30000});
  await t.waitForFunction(()=>window.DAVYLABXNews?.status?.().loaded===true,null,{timeout:30000});
  const failed=await t.evaluate(()=>window.DAVYLABXNews.status());
  assert.equal(failed.newsEngineOk,false);
  assert.ok(failed.count>0,"Legacy fallback usable");
  await t.close();
  console.log("P1 BROWSER PASS: upstream unavailable still preserves original discovery source");
 }finally{await browser.close()}
})().catch(e=>{console.error("P1 BROWSER FAILED",e);process.exitCode=1});
