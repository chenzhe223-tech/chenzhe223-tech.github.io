/* DAVYLAB analysis + News Engine reader-facing design: real Chromium E2E.
 * No publishing mutations or API model calls. Requires local http.server :8877.
 */
const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const BASE=process.env.RADAR_QA_BASE||"http://127.0.0.1:8877";
const widths=[320,375,390,430,768,820,1024,1280,1440,1920];
const captures=new Set([390,820,1440]);
const out="test-results/radar-analysis-editorial";
fs.mkdirSync(out,{recursive:true});
const expectedSources=["IT之家","MarkTechPost","AI圈报","TechCrunch AI"];
async function one(browser,width){
 const page=await browser.newPage({viewport:{width,height:width<=430?844:950},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  const resp=await page.goto(BASE+"/radar/daily/",{waitUntil:"domcontentloaded",timeout:35000});
  assert.equal(resp.status(),200,"daily HTML status");
  await page.waitForFunction(()=>typeof reportData!=="undefined"&&!!reportData&&
    document.querySelector("#editorialCore .editorial-analysis-title")&&
    document.querySelectorAll("#xnewsVoices .item").length>=3,null,{timeout:25000});
  const state=await page.evaluate(()=>{
   const root=document.querySelector("#editorialCore"),img=root.querySelector("figure img"),
     x=document.querySelector("#xnewsVoices"),china=document.querySelector("#chinaAINewsList"),
     title=root.querySelector("h2");
   const box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
   return {
    hidden:root.hidden, heading:root.querySelector(".editorial-analysis-heading strong").textContent,
    title:title.textContent,
    imgSrc:img.src,imgAlt:img.alt,mediaBox:box(root.querySelector("figure")),
    contentBox:box(root.querySelector(".editorial-analysis-content")),
    figureCaption:root.querySelector("figcaption").textContent,
    sources:[...root.querySelectorAll(".editorial-analysis-source-links a")].map(a=>a.textContent),
    evidenceRows:root.querySelectorAll(".editorial-analysis-evidence-list li").length,
    detailsClosed:!root.querySelector("details").open,
    overseasDescription:!!document.querySelector("#xnewsVoicesSection .section-intro"),
    overseasHint:!!document.querySelector("#xnewsVoicesSection .section-head p"),
    chinaDescription:!!document.querySelector("#chinaAI .section-intro"),
    xnewsFirstTop:box(x).top,chinaFirstTop:box(china).top,
    pageWidth:document.documentElement.scrollWidth
   };
  });
  assert.equal(state.hidden,false,width+" editorial must be visible");
  assert.ok(state.heading.includes("今日核心判断"),width+" analysis label");
  assert.ok(state.title.length>=30,width+" substantive actual analysis");
  assert.equal(state.overseasDescription,false,width+" backend RSS description hidden");
  assert.equal(state.overseasHint,false,width+" backend 5-source hint hidden");
  assert.equal(state.chinaDescription,false,width+" backend China-side workflow prose hidden");
  assert.equal(state.pageWidth<=width+2,true,width+" no document horizontal overflow: "+state.pageWidth);
  assert.deepEqual(state.sources,expectedSources,width+" citation list deduplicated by publisher");
  assert.equal(state.evidenceRows,5,width+" all original evidence articles preserved behind disclosure");
  assert.equal(state.detailsClosed,true,width+" long evidence should not clutter default layout");
  assert.ok(state.imgSrc.startsWith("https://images.unsplash.com/photo-"),width+" licensed photo source");
  assert.ok(state.figureCaption.includes("非新闻现场"),width+" no misleading news footage");
  assert.ok(state.imgAlt.length>10,width+" accessible image alt");
  if(width>=1280) assert.ok(Math.abs(state.xnewsFirstTop-state.chinaFirstTop)<=8,width+" cross-column news card start alignment");
  if(width<=760) assert.ok(state.mediaBox.bottom<state.contentBox.top,width+" phone photo appears before long analysis body");
  if(captures.has(width)){
    // Network photo is licensed; accept only when it can actually decode in browser.
    await page.locator("#editorialCore .editorial-analysis-media img").evaluate(img=>img.decode());
    await page.locator("#editorialCore").screenshot({path:path.join(out,"analysis-"+width+".png"),timeout:30000,animations:"disabled"});
    await page.locator("#xnewsVoicesSection").screenshot({path:path.join(out,"overseas-"+width+".png"),timeout:30000,animations:"disabled"});
  }
  if(width===390||width===1440){
    await page.locator("#editorialCore details summary").click();
    assert.equal(await page.locator("#editorialCore details").evaluate(e=>e.open),true,width+" evidence opens");
    assert.equal(await page.locator("#editorialCore .editorial-analysis-evidence-list li").count(),5);
    const full=await page.locator("#editorialCore .editorial-analysis-next").textContent();
    assert.ok(full.includes("独立评测"),width+" original next question preserved");
  }
  const result={width,pass:true,photo:state.imgSrc.split("?")[0],evidenceCount:state.evidenceRows,
    sources:state.sources.length,noHorizontalOverflow:true};
  console.log("ANALYSIS-QA "+JSON.stringify(result));
  return result;
 }catch(e){
  try{await page.screenshot({path:path.join(out,"failed-"+width+".png"),fullPage:true,timeout:12000})}catch(_){}
  throw e;
 }finally{await page.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const results=[];
  for(const width of widths)results.push(await one(browser,width));
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({status:"PASS",results},null,2));
  console.log("DAVYLAB analysis 10-viewport editorial QA PASS");
 }finally{await browser.close()}
})().catch(e=>{console.error("DAVYLAB EDITORIAL QA FAILED "+e.stack);process.exitCode=1});
