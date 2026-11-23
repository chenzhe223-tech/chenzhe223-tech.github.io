/* Real Chromium geometric layout checks across desktop, iPad, and phones. */
const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const BASE=process.env.RADAR_QA_BASE||"http://127.0.0.1:8877";
const SIZES=[320,375,390,430,760,768,820,1024,1180,1280,1440,1920];
const CAPTURES=new Set([390,820,1024,1440,1920]);
const OUT="test-results/radar-geometry";fs.mkdirSync(OUT,{recursive:true});
function near(a,b,margin=2.5){return Math.abs(a-b)<=margin}
async function testWidth(browser,width){
 const page=await browser.newPage({viewport:{width,height:width<=430?844:950},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try {
  const r=await page.goto(BASE+"/radar/daily/",{waitUntil:"domcontentloaded",timeout:30000});
  assert.equal(r.status(),200,width+" page returned HTTP "+r.status());
  await page.waitForFunction(()=>typeof reportData!=="undefined"&&!!reportData&&document.querySelectorAll("#xnewsVoices .item").length===6&&document.querySelectorAll("#top5List>.top5-card").length===5&&document.querySelectorAll("#chinaAINewsList>.top5-card").length===3,null,{timeout:20000});
  await page.waitForFunction(()=>{const el=document.querySelector("#radar-geometry-contract");return !!(el&&el.sheet&&el.sheet.cssRules.length>0)},null,{timeout:15000});
  const g=await page.evaluate(()=>{
   const el=s=>document.querySelector(s);
   const rect=s=>{const b=el(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,width:b.width}};
   const css=s=>getComputedStyle(el(s));
   return {
    full:document.documentElement.scrollWidth,
    wrap:rect(".wrap"),lead:rect("#leadStory"),hot:rect("#top5List"),last:rect("#top5List>.top5-card:last-child"),
    newsCards:[...document.querySelectorAll("#newsList > article.item")].slice(0,4).map(e=>({
      box:{top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right},
      meta:{top:e.querySelector(".meta").getBoundingClientRect().top,bottom:e.querySelector(".meta").getBoundingClientRect().bottom}
    })),
    skillCards:[...document.querySelectorAll("#skillList > article.item.skill")].slice(0,4).map(e=>({
      box:{top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right},
      stars:{top:e.querySelector(".stars").getBoundingClientRect().top,bottom:e.querySelector(".stars").getBoundingClientRect().bottom},
      action:{top:e.querySelector(".skill-actions").getBoundingClientRect().top,bottom:e.querySelector(".skill-actions").getBoundingClientRect().bottom}
    })),
    overseas:rect("#xnewsVoicesSection"),china:rect("#chinaAI"),overseasList:rect("#xnewsVoices"),chinaList:rect("#chinaAINewsList"),
    style:{alignment:css(".secondary-editorial-grid").alignItems,overseasDisplay:css("#xnewsVoicesSection").display,
      primaryNav:css(".primary-nav").display,editorialTabs:css(".tabs").display,
      overseasCols:css("#xnewsVoices").gridTemplateColumns,chinaCols:css("#chinaAINewsList").gridTemplateColumns},
    overflow:[...document.querySelectorAll("#xnewsVoices .item,#top5List>.top5-card")].filter(e=>e.scrollHeight>e.clientHeight+3||e.scrollWidth>e.clientWidth+3).map(e=>({text:e.textContent.slice(0,35),scrollHeight:e.scrollHeight,height:e.clientHeight,scrollWidth:e.scrollWidth,width:e.clientWidth}))
   };
  });
  assert.ok(g.full<=width+2,width+" horizontal scrollWidth="+g.full);
  assert.ok(g.wrap.width>0&&g.wrap.right<=width+1,width+" outer wrap overflow");
  assert.equal(g.style.overseasDisplay,"flex",width+" overseas not visible");
  assert.equal(g.style.alignment,"stretch",width+" wrong secondary alignment");
  assert.equal(g.overflow.length,0,width+" clipped items: "+JSON.stringify(g.overflow));
  if(width===1180 || width===1024 || width===390) console.log("LAYOUT-DIAGNOSTIC "+width+" "+JSON.stringify({lead:g.lead,hot:g.hot,last:g.last,overseas:g.overseas,china:g.china,cols:g.style}));
  if(width>1024){
   assert.ok(g.lead.right<g.hot.left,width+" primary columns not separated");
   assert.ok(near(g.lead.top,g.hot.top),width+" primary top misalignment");
   assert.ok(near(g.lead.bottom,g.hot.bottom),width+" primary bottom misalignment: "+JSON.stringify([g.lead.bottom,g.hot.bottom]));
   assert.ok(near(g.hot.bottom,g.last.bottom),width+" empty tail after fifth hotspot");
  }else assert.ok(g.hot.top>=g.lead.bottom+10,width+" primary modules overlap");
  if(width>1180){
   assert.ok(g.overseas.right<g.china.left,width+" secondary columns overlap");
   assert.ok(near(g.overseas.top,g.china.top),width+" secondary top misalignment");
   assert.ok(near(g.overseas.bottom,g.china.bottom),width+" secondary bottom misalignment: "+JSON.stringify([g.overseas.bottom,g.china.bottom]));
   // Contract across both independent grids, not just inside each row.
   assert.ok(near(g.lead.left,g.overseas.left),width+" lead/overseas left boundaries must be identical");
   assert.ok(near(g.lead.right,g.overseas.right),width+" lead/overseas right boundaries must be identical");
   assert.ok(near(g.hot.left,g.china.left),width+" top-five/China left boundaries must be identical");
   assert.ok(near(g.hot.right,g.china.right),width+" top-five/China right boundaries must be identical");
   assert.ok(near(g.overseasList.top,g.chinaList.top,8),width+" content start rows misaligned: "+JSON.stringify([g.overseasList.top,g.chinaList.top]));
  }else assert.ok(g.china.top>=g.overseas.bottom+12,width+" secondary modules overlap");
  assert.equal(g.newsCards.length,4,width+" preview needs four actual source-backed news cards");
  assert.equal(g.skillCards.length,4,width+" preview needs four actual Skill cards");
  if(width>760){
    for(const [name,cards] of [["AI news",g.newsCards],["Skill",g.skillCards]]){
      for(let index=0;index+1<cards.length;index+=2){
        const a=cards[index],b=cards[index+1];
        assert.ok(near(a.box.top,b.box.top),width+" "+name+" row "+index+" top edges differ");
        assert.ok(near(a.box.bottom,b.box.bottom),width+" "+name+" row "+index+" bottom edges differ");
      }
    }
    for(let index=0;index+1<4;index+=2){
      const n1=g.newsCards[index],n2=g.newsCards[index+1];
      assert.ok(near(n1.meta.bottom,n2.meta.bottom,3),width+" AI news metadata footers must align");
      const k1=g.skillCards[index],k2=g.skillCards[index+1];
      assert.ok(near(k1.stars.bottom,k2.stars.bottom,3),width+" Skill popularity footers must align");
      assert.ok(near(k1.action.bottom,k2.action.bottom,3),width+" Skill CTA footers must align");
    }
  }else{
    for(const cards of [g.newsCards,g.skillCards])for(let i=0;i+1<cards.length;i++)
      assert.ok(cards[i+1].box.top>=cards[i].box.bottom+9,width+" single-column cards must not overlap");
  }
  const overseasCols=g.style.overseasCols.trim().split(/\s+/).length;
  const chinaCols=g.style.chinaCols.trim().split(/\s+/).length;
  if(width===768) console.log("TABLET-NAV-DIAG "+JSON.stringify(await page.evaluate(()=>{ const t=document.querySelector(".tabs");const z=getComputedStyle(t);return {display:z.display,visibility:z.visibility,opacity:z.opacity,height:t.getBoundingClientRect().height,parentDisplay:getComputedStyle(t.parentElement).display,inlineStyle:t.getAttribute("style")}})));
  if(width>760&&width<=1024){
   assert.equal(g.style.primaryNav,"none",width+" tablet desktop nav should not collide");
   assert.equal(g.style.editorialTabs,"flex",width+" tablet needs visible editorial navigation");
  }
  if(width<=760){
   assert.equal(overseasCols,1,width+" overseas phone columns");
   assert.equal(chinaCols,1,width+" china phone columns");
  }else if(width<=1180) assert.equal(overseasCols,2,width+" tablet overseas columns");
  assert.deepEqual(errors,[],width+" JS errors");
  if(CAPTURES.has(width)) await page.screenshot({path:path.join(OUT,"radar-"+width+".png"),fullPage:true,animations:"disabled",timeout:30000});
  const result={width,status:"PASS",primaryBottomDifference:Math.round((g.lead.bottom-g.hot.bottom)*100)/100,secondaryBottomDifference:Math.round((g.overseas.bottom-g.china.bottom)*100)/100,scrollWidth:g.full,overseasCols};
  if(width===1440||width===820||width===390)console.log("CARD-FOOTER-DIAGNOSTIC "+width+" "+JSON.stringify({news:g.newsCards,skills:g.skillCards}));
  console.log("GEOMETRY "+JSON.stringify(result));return result;
 }catch(e){
  try{await page.screenshot({path:path.join(OUT,"failed-"+width+".png"),fullPage:true,timeout:10000})}catch(_){}
  throw e;
 }finally{await page.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const results=[];
  for(const width of SIZES) results.push(await testWidth(browser,width));
  fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify({status:"PASS",viewports:results},null,2));
  console.log("12 viewport responsive geometry contracts PASS");
 }finally{await browser.close()}
})().catch(e=>{console.error("RADAR RESPONSIVE GEOMETRY FAILED "+e.stack);process.exitCode=1});
