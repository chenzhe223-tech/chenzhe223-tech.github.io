'use strict';
/* Genuine production read-only smoke. Must consume deployed Cloudflare Worker and D1;
 * no fixture data, no local source interception, no synthetic thumbnails. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base='https://worldtoon.chenzhe223.workers.dev';
(async()=>{
 const response=await fetch(base+'/api/comic/catalog?source=all&limit=500',{headers:{'cache-control':'no-cache'}});
 assert.equal(response.status,200,'Live D1 endpoint unavailable');
 const catalog=await response.json();
 assert.equal(catalog.schema,'davylab.worldtoon.catalog.v3');
 for(const [source,min] of [['literary_series',12],['nobel_literature',6],['academic_events',8]]){
  const count=catalog.items.filter(x=>x.cache_source===source).length;
  assert.ok(count>=min,'Live '+source+' underfilled: '+count);
  const stat=catalog.stats.find(x=>x.id===source);assert.ok(stat?.ready&&stat.count>=min);
 }
 // Ensure future scheduled refresh can fetch actual versioned upstream material,
 // not merely that someone manually seeded the first three D1 snapshots.
 for(const [source,min] of [['literary_series',12],['nobel_literature',6],['academic_events',8]]){
  const resp=await fetch(base+'/api/comic/discover?source='+source+'&limit=90',{headers:{'cache-control':'no-cache'}});
  const body=await resp.json();
  assert.equal(resp.status,200,'The next scheduled source refresh will fail: '+source+' '+JSON.stringify(body));
  assert.ok(body.items?.length>=min,'Upstream editorial source '+source+' only has '+body.items?.length);
  assert.ok(body.items.every(x=>x.rights_cleared===false));
  console.log('LIVE_UPSTREAM_PASS',source,body.items.length);
 }
 const sourceIds=['literary_series','nobel_literature','academic_events'];
 assert.ok(catalog.items.filter(x=>sourceIds.includes(x.cache_source)).every(x=>x.rights_cleared===false));
 console.log('LIVE_D1_PASS',JSON.stringify(catalog.stats.filter(x=>sourceIds.includes(x.id))));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const [label,width] of [['mobile',390],['desktop',1440]]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(base+'/#/live',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>Array.isArray(window.wtEditorialRank?.weights?wtNews:[])&&wtSourceCounts?.some(x=>x.id==='academic_events'&&x.ready),null,{timeout:45000});
   const score=await page.evaluate(()=>{
    const scored=wtNews.map(x=>({source:x.cache_source,score:wtEditorialRank.evaluate(x).overall}));
    const sources=['literary_series','nobel_literature','academic_events'];
    const filtered=scored.filter(x=>sources.includes(x.source));
    return {total:wtNews.length,curated:filtered.length,high80:filtered.filter(x=>x.score>=80).length,
      sourceTabs:document.querySelectorAll('.wt-source-tabs [data-wt="source"]').length,
      seriesPanel:!!document.querySelector('.wt-series-featured'),
      overflow:document.documentElement.scrollWidth>window.innerWidth+1};
   });
   assert.ok(score.curated>=26,label+' missing curated materials: '+JSON.stringify(score));
   assert.ok(score.high80>=12,label+' no top-quality pre-estimated story leads');
   assert.ok(score.sourceTabs>=9&&score.seriesPanel);
   assert.equal(score.overflow,false,label+' horizontal overflow');
   for(const [source,category] of [['literary_series','世界文学'],['nobel_literature','诺奖文学'],['academic_events','世界学术活动']]){
    await page.locator('[data-wt="source"][data-value="'+source+'"]').click();
    const m=await page.evaluate(()=>({source:wtSource,count:document.querySelectorAll('.wt-news-card').length,
      cards:[...document.querySelectorAll('.wt-news-card .wt-status')].map(x=>x.textContent)}));
    assert.equal(m.source,source);
    assert.ok(m.count>0,source+' tab is empty');
    assert.ok(m.cards.every(x=>x.includes(category)),source+' contains unrelated category');
   }
   console.log('LIVE_BROWSER_PASS',label,JSON.stringify(score));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
