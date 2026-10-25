const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const target = process.env.MELODYME_URL || 'https://chenzhe223-tech.github.io/melodyme/';
const out = 'melodyme-live-results';
fs.mkdirSync(out, {recursive:true});
const results=[];
function record(name,ok,detail=''){results.push({name,status:ok?'PASS':'FAIL',detail:String(detail)});console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail?' — '+detail:''));}
const catalog={results:[
 {trackId:1001,trackName:'QA Preview Track',artistName:'QA Artist',collectionName:'QA Album',artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/qa/100x100bb.jpg',previewUrl:'https://audio-ssl.itunes.apple.com/qa-preview.m4a',releaseDate:'2001-01-01T00:00:00Z'},
 {trackId:1002,trackName:'QA No Preview Track',artistName:'QA Artist',collectionName:'QA Album',artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/qa2/100x100bb.jpg',releaseDate:'2002-01-01T00:00:00Z'}
]};
const coords=[{lng:108.9398,lat:34.3416},{lng:104.0668,lat:30.5728},{lng:121.4737,lat:31.2304},{lng:103.8198,lat:1.3521}];
async function mockServices(page){
 await page.route(/melodyme-ai\\.chenzhe223\\.workers\\.dev/,async route=>{
  const payload=route.request().postDataJSON()||{};
  if(payload.action==='resolveCities'){
   const names=payload.input.cities||[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,action:'resolveCities',source:'AMap Web Service geocoding',cities:names.map((name,index)=>({index,name,matchedName:name,formattedAddress:name,province:'QA Province',city:name,adcode:String(index),...coords[index],source:'高德地图地理编码'}))})});
  }
  if(payload.action==='searchMusic')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,action:'searchMusic',results:catalog.results,queries:1,failedQueries:0})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,action:payload.action,result:{}})});
 });
}
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.addInitScript(()=>{if(!sessionStorage.getItem('melodyme-test-clean')){localStorage.clear();sessionStorage.setItem('melodyme-test-clean','1')}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  record('Production route responds',!!response&&response.status()===200,'HTTP '+(response&&response.status()));
  record('Product title',(await page.title()).includes('MelodyMe'),await page.title());
  await mockServices(page);
  await page.getByRole('button',{name:/开始探索/}).click();
  await page.locator('#cityStudio').waitFor({state:'visible'});
  record('Start opens four-city studio',await page.locator('#cityStudio').isVisible(),'City memory map is the primary journey');
  await page.locator('#buildCityMap').click();
  record('Empty city validation',await page.getByText('请填写完整的四座城市').count()>0,'Incomplete city input receives guidance');
  const cities=['西安','成都','上海','新加坡'];
  for(let i=0;i<4;i++)await page.locator('#cityInput'+i).fill(cities[i]);
  await page.locator('#citySongInput').fill('QA Preview Track');
  await page.locator('#citySearchSong').click();
  await page.locator('.city-track-option').first().waitFor({state:'visible',timeout:10000});
  record('Music catalog result metadata',await page.locator('#citySelectedTrack').innerText().then(t=>t.includes('QA Artist')),'Artist and title come from catalog response');
  record('Preview URL uses catalog response',await page.locator('#cityAudio').getAttribute('src')==='https://audio-ssl.itunes.apple.com/qa-preview.m4a','No invented audio URL');
  await page.locator('#buildCityMap').click();
  await page.locator('#cityRouteSvg').waitFor({state:'visible',timeout:10000});
  record('Four city pins rendered',await page.locator('#cityMapCanvas .city-map-pin').count()===4,'Four coordinate-based map stops');
  record('Map identifies coordinate source',(await page.locator('#cityMapStatus').innerText()).includes('高德地图'),'Coordinate source disclosed');
  record('Playback enabled for preview track',!(await page.locator('#cityPlayJourney').isDisabled()),'Play journey available when preview exists');
  record('Map SVG export enabled',!(await page.locator('#downloadCityMap').isDisabled()),'SVG map download available');
  const duplicate=['西安','西安','上海','新加坡'];
  for(let i=0;i<4;i++)await page.locator('#cityInput'+i).fill(duplicate[i]);
  await page.locator('#buildCityMap').click();
  record('Duplicate cities rejected',await page.getByText('请填写四座不同的城市').count()>0,'Four distinct cities are required');
  await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
  record('Desktop JavaScript errors',errors.length===0,errors.join('; ')||'none');
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mockServices(mobile);
  const mr=await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  const dims=await mobile.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
  record('Mobile route and overflow',!!mr&&mr.status()===200&&dims.document<=dims.viewport+2,JSON.stringify({status:mr&&mr.status(),...dims}));
  await mobile.getByRole('button',{name:/开始探索/}).click();
  for(let i=0;i<4;i++)await mobile.locator('#cityInput'+i).fill(cities[i]);
  await mobile.locator('#citySongInput').fill('QA Preview Track');
  await mobile.locator('#buildCityMap').click();
  await mobile.locator('#cityRouteSvg').waitFor({state:'visible',timeout:10000});
  record('Mobile map renders four cities',await mobile.locator('#cityMapCanvas .city-map-pin').count()===4,'All four stops visible');
  const mobileDims=await mobile.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
  record('Mobile map has no horizontal overflow',mobileDims.document<=mobileDims.viewport+2,JSON.stringify(mobileDims));
  record('Mobile JavaScript errors',mobileErrors.length===0,mobileErrors.join('; ')||'none');
  await mobile.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
  const downloadPromise=mobile.waitForEvent('download',{timeout:5000});
  await mobile.locator('#downloadCityMap').click();
  const download=await downloadPromise;
  record('SVG map export',download.suggestedFilename().endsWith('.svg'),download.suggestedFilename());
  await mobile.close();
 }catch(e){record('Test runner exception',false,e.stack||e.message||e)}
 finally{if(browser)await browser.close().catch(()=>{})}
 const failed=results.filter(r=>r.status==='FAIL');
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({target,finishedAt:new Date().toISOString(),summary:{passed:results.length-failed.length,failed:failed.length},results},null,2));
 if(failed.length)process.exitCode=1;
})();
