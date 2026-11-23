const assert=require("node:assert/strict"),fs=require("node:fs");
const {chromium}=require("playwright");
const path=require("node:path");
const base="http://127.0.0.1:8877";
const out="test-results/news-engine-p3";
fs.mkdirSync(out,{recursive:true});
const report=JSON.parse(fs.readFileSync("radar/data/latest.json","utf8"));
const raw=(report.top5||[]).slice(0,3);
assert.ok(raw.length===3);
const item=(x,i)=>({
 id:"p3-"+i,issue_date:report.report_date,first_seen:"2026-11-19",latest_seen:report.report_date,
 issue_dates:["2026-11-19",report.report_date],stream:"top5",topic_category:"agents",
 title:x.title_zh||x.title,summary:x.summary_zh||x.summary||"新闻元数据",source:x.source,
 source_url:x.source_url||x.url,published_at:x.published,
 publishable:false,external_copy_allowed:false,verification_status:"requires_independent_fact_check",
 editorial_score:{total:83-i,method:"deterministic_rule_v2_not_social_heat",parts:{timeliness:28,traceability:20,practicality:17,topic_match:10,editorial_priority:8-i}}
});
const payload={schema_version:"2.0.0",publishable:false,latest_issue_date:report.report_date,
 scanned_issues:7,attempted_issues:7,partial:false,missing_issues:[],total:3,data:raw.map(item)};
const v1={issue_date:report.report_date,is_today:true,publishable:false,data:report.xnews_voices.filter(x=>x.source_kind==="news_engine_rss_discovery").slice(0,6).map((x,i)=>({
 id:"latest-"+i,issue_date:report.report_date,stream:"overseas",title:x.title_zh||x.title,
 summary:x.summary_zh||x.summary,source:x.source,source_url:x.source_url||x.url,
 published_at:x.published,publishable:false,verification_status:"requires_independent_fact_check"
}))};
const issue={status:"ok",date:report.report_date,posterUrl:"",
 top5:raw.map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 global:(report.news||[]).slice(0,4).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 china:(report.china_ai_news||[]).slice(0,3).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,source:x.source,url:x.url,published:x.published})),
 skills:[],note:{core:"今日",trend:"核验",question:"来源"}};
async function routes(page){
 await page.route("**/api/v1/news?*",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(v1)}));
 await page.route("**/api/v2/news?*",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(payload)}));
 await page.route("**/api/v2/search?*",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(payload)}));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   let page=await browser.newPage({viewport:{width,height:width===390?844:900}});
   await routes(page);
   await page.route("**/api/ai-briefing?*",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(issue)}));
   await page.route("**/api/ai-briefing/history",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({days:[report.report_date]})}));
   let r=await page.goto(base+"/comic-studio/#/ai-briefing",{waitUntil:"domcontentloaded",timeout:30000});assert.equal(r.status(),200);
   await page.locator('button[data-brief="view"][data-value="history"]').waitFor({timeout:20000});
   await page.locator('button[data-brief="view"][data-value="history"]').click();
   await page.locator('#neP3World [data-ne-card]').first().waitFor({timeout:15000});
   assert.equal(await page.locator('#neP3World [data-ne-card]').count(),3);
   assert.match(await page.locator("#neP3World [data-ne-status]").textContent(),/有效期刊 7\/7/);
   assert.match(await page.locator("#neP3World [data-ne-card]").first().textContent(),/规则分 83/);
   assert.ok(await page.locator("#neP3World [data-ne-card] a[href^='https://']").count()>0);
   await page.locator("#neP3World [data-ne-pick='0']").click();
   await page.locator('button[data-brief="view"][data-value="top5"]').click();
   await page.locator(".brief-spotlight").first().waitFor({timeout:8000});
   if(width===390)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.screenshot({path:path.join(out,"worldtoon-"+width+".png"),fullPage:true,timeout:25000});
   await page.close();

   page=await browser.newPage({viewport:{width,height:width===390?844:900}});
   await routes(page);
   r=await page.goto(base+"/topic-studio/",{waitUntil:"domcontentloaded",timeout:30000});assert.equal(r.status(),200);
   await page.evaluate(()=>{if(typeof changeSection==="function")changeSection("discover");window.DAVYLABEditorialWorkspace?.setSource("xnews",false)});
   console.log("P3 Topic navigation",await page.evaluate(()=>({
    active:[...document.querySelectorAll(".section.active")].map(x=>x.id),
    discover:!!document.getElementById("section-discover"),
    summaryDisplay:getComputedStyle(document.querySelector("#newsEngineP3Topic summary")).display, activeSource:document.querySelector("#section-discover")?.dataset.activeSource
   })));
   await page.locator("#newsEngineP3Topic summary").waitFor({timeout:15000});
   await page.locator("#newsEngineP3Topic summary").click();
   await page.locator("#neP3Topic [data-ne-card]").first().waitFor({timeout:15000});
   assert.equal(await page.locator("#neP3Topic [data-ne-card]").count(),3);
   const key=await page.locator("#neP3Topic [data-ne-form] select[name='days']").inputValue();
   assert.equal(key,"7");
   await page.locator("#neP3Topic [data-ne-form] select[name='days']").selectOption("30");
   await page.locator("#neP3Topic [data-ne-form] select[name='category']").selectOption("research");
   await page.locator("#neP3Topic [data-ne-form] button[type='submit']").click();
   await page.locator("#neP3Topic [data-ne-card]").first().waitFor({timeout:14000});
   await page.locator("#neP3Topic [data-ne-pick='0']").click();
   assert.ok(await page.locator("#xnewsList .xnews-card").count()>=1,"Original Overseas list preserved");
   if(width===390)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.screenshot({path:path.join(out,"topicstudio-"+width+".png"),fullPage:true,timeout:25000});
   await page.close();
   console.log("P3 LOCAL BROWSER PASS "+width+"px WorldToon + WeChat selection and old views");
  }
  // Simulate KNOWA /studio content with the precise delivered widget + bridge:
  const p3=fs.readFileSync("news-engine/p3-widget.js","utf8");
  const bridge=fs.readFileSync("news-engine/p3-knowa-bridge.js","utf8");
  const knowa=await browser.newPage();
  await routes(knowa);
  await knowa.goto(base+"/topic-studio/",{waitUntil:"domcontentloaded"});
  await knowa.evaluate(({widget,bridge})=>{
   const node=document.createElement("details");node.id="neP3KnowaDetails";node.innerHTML='<summary>历史选题</summary><div id="neP3Knowa"></div><div id="neP3KnowaNote"></div>';
   document.body.append(node);
   // Run the same in-page script as the hosted KNOWA Worker would embed.
   const a=document.createElement("script");a.textContent=widget;document.body.append(a);
   const b=document.createElement("script");b.textContent=bridge;document.body.append(b);
  },{widget:p3,bridge});
  await knowa.locator("#neP3KnowaDetails summary").click();
  await knowa.locator("#neP3Knowa [data-ne-card]").first().waitFor({timeout:15000});
  await knowa.locator("#neP3Knowa [data-ne-pick='0']").click();
  const saved=await knowa.evaluate(()=>JSON.parse(localStorage.getItem("knowa:radar:pool:v1")||"[]"));
  assert.ok(saved.some(x=>x.sourceUrl===payload.data[0].source_url&&x.publishable===false));
  assert.ok(saved.some(x=>x.verificationStatus==="source_not_independently_verified"));
  await knowa.close();
  console.log("P3 KNOWA BROWSER PASS read-only history selection persisted in original browser topic pool");
 }finally{await browser.close()}
})().catch(e=>{console.error("P3 BROWSER FAILED",e);process.exitCode=1});
