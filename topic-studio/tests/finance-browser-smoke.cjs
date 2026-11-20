"use strict";
/* Browser E2E for Finance selection -> C mode -> style & count. Fixture is local TEST ONLY. */
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"../..");
const fixture={
 schema_version:2,checked_at:"2026-11-20T07:30:00+00:00",count:2,source:"browser-test-only",
 sources:[{source:"CNBC",status:"ok",count:1},{source:"SEC",status:"ok",count:1}],
 articles:[
 {id:"fin-test-company",title:"2026年中国企业三季度财报测试样本",url:"https://www.sec.gov/Archives/edgar/data/1/demo",
  summary:"TEST ONLY. This is a synthetic frontend contract record, not actual financial news.",source:"美国证券交易委员会 · SEC",
  category:"中国商业",region:"中国",published_at:"2026-11-20T06:30:00+00:00",source_type:"media_report",
  score:{basis:"editorial_heuristic_not_audience_metrics",total:83,timeliness:94,readability:87,value:90,heat:75,appeal:72,reasons:["测试:数字口径待查"]}},
 {id:"fin-test-world",title:"World finance test fixture",url:"https://www.cnbc.com/world/",
  summary:"TEST ONLY. This is a synthetic frontend contract record, not actual financial news.",source:"CNBC · 世界财经",
  category:"全球市场",region:"全球",published_at:"2026-11-19T06:30:00+00:00",source_type:"media_report",
  score:{basis:"editorial_heuristic_not_audience_metrics",total:70,timeliness:68,readability:64,value:65,heat:92,appeal:60,reasons:["测试:关键词估算"]}}]};
const contentTypes={".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".js":"application/javascript;charset=utf-8",".json":"application/json;charset=utf-8",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
 const requested=decodeURIComponent((req.url||"/").split("?")[0]);
 const pathname=path.resolve(root,"."+requested);
 if(!pathname.startsWith(root+path.sep)||!fs.existsSync(pathname)||fs.statSync(pathname).isDirectory()){
  res.writeHead(404);res.end("not found");return;
 }
 res.setHeader("Content-Type",contentTypes[path.extname(pathname)]||"application/octet-stream");
 fs.createReadStream(pathname).pipe(res);
});
const listen=()=>new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve(server.address().port)));
async function run(){
 const port=await listen(),base="http://127.0.0.1:"+port;
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===1440?900:844}});
  await page.route("**/data/finance-discovery.json?**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
  await page.route("**/data/overseas-discovery.json?**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({schema_version:1,articles:[],sources:[]})}));
  await page.goto(base+"/topic-studio/index.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#financeCount")?.textContent.includes("已收录 2 条"),null,{timeout:12000});
  assert.equal(await page.locator("#financeList .finance-card").count(),2,"two fixture finance cards must render");
  assert.match(await page.locator("#financeCount").textContent(),/中国 1 条/);
  assert.match(await page.locator("#financeList .finance-card").first().textContent(),/综合优先级/);
  assert.equal(await page.locator(".finance-score-item").count(),10,"both cards have five scores");
  await page.locator("#financeSort").selectOption("heat");
  assert.match(await page.locator("#financeList .finance-card").first().textContent(),/World finance test fixture/);
  await page.locator("#financeSort").selectOption("total");
  await page.locator("#financeRegion").selectOption("中国");
  assert.equal(await page.locator("#financeList .finance-card").count(),1,"China filter excludes global lead");
  assert.match(await page.locator("#financeList .finance-card").first().textContent(),/中国/);
  await page.locator("#financeRegion").selectOption("全球");
  assert.equal(await page.locator("#financeList .finance-card").count(),1,"Global filter excludes China lead");
  await page.locator("#financeRegion").selectOption("all");
  assert.equal(await page.locator("#financeList .finance-card").count(),2);
  await page.locator('button[data-fin-id="fin-test-company"]').click();
  assert.equal(await page.locator("#promptMode").inputValue(),"finance","finance pick must activate C mode");
  await page.locator("#promptBox").waitFor();
  let brief=await page.locator("#promptBox").inputValue();
  assert.match(brief,/100～300字/);
  assert.match(brief,/不是长篇文章/);
  await page.locator("#financePosterStyle").selectOption("capital-blackgold");
  await page.locator("#financePosterCount").selectOption("3");
  brief=await page.locator("#promptBox").inputValue();
  assert.match(brief,/黑金资本杂志/);
  assert.match(brief,/数量：3张/);
  assert.match(brief,/第3张/);
  await page.locator("#promptMode").selectOption("planning");
  assert.match(await page.locator("#promptBox").inputValue(),/PLAN_ONLY/);
  await page.locator("#promptMode").selectOption("production");
  assert.match(await page.locator("#promptBox").inputValue(),/完整文章/);
  await page.locator("#promptMode").selectOption("finance");
  assert.match(await page.locator("#promptBox").inputValue(),/黑金资本杂志/);
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(dims.scroll<=dims.client+5,"no root horizontal overflow: "+JSON.stringify(dims));
  console.log("PASS finance E2E viewport "+width+"; finance topic->C mode->3 posters->style->A/B preserved");
  await page.close();
 }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
run().catch(err=>{console.error(err);server.close();process.exitCode=1});
