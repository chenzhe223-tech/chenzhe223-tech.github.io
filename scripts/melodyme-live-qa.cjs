const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const target = process.env.MELODYME_URL || 'https://chenzhe223-tech.github.io/melodyme/';
const out = 'melodyme-live-results';
fs.mkdirSync(out, { recursive: true });
const results = [];
const record = (name, ok, detail='') => {
  results.push({name, status: ok ? 'PASS' : 'FAIL', detail: String(detail)});
  console.log('['+(ok?'PASS':'FAIL')+'] '+name+(detail ? ' — '+detail : ''));
};
(async()=>{
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    const response = await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
    record('Production route responds',!!response && response.status()===200,'HTTP '+(response&&response.status()));
    record('Product title', (await page.title()).includes('MelodyMe'), await page.title());
    await page.getByRole('button',{name:/记录一个音乐瞬间/}).click();
    await page.locator('#generate').click();
    await page.getByRole('status').filter({hasText:'先写下一句话'}).waitFor({timeout:3000});
    record('Empty input is blocked',true,'Validation message displayed');
    await page.locator('#song').fill('线上验收测试歌曲');
    await page.locator('#artist').fill('MelodyMe QA');
    await page.locator('#year').fill('2024');
    await page.locator('#story').fill('线上验收：傍晚走在海边，听到这首歌，决定重新出发。');
    await page.locator('#moods .chip').filter({hasText:'怀念'}).click();
    await page.locator('#generate').click();
    await page.locator('#result').waitFor({state:'visible',timeout:5000});
    record('Memory to preview flow',await page.locator('#posterTitle').innerText().then(t=>t.length>0),'Create → preview');
    await page.locator('#editCopy').fill('Live QA edited story');
    await page.locator('#save').click();
    await page.locator('#timeline').getByText('线上验收测试歌曲').waitFor({timeout:5000});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:/我的音乐人生/}).click();
    await page.locator('#timeline').getByText('线上验收测试歌曲').waitFor({timeout:5000});
    record('Local persistence after reload',true,'Saved record restored from browser storage');
    await page.locator('#timeline').getByRole('button',{name:'查看 / 编辑'}).first().click();
    const downloadPromise=page.waitForEvent('download',{timeout:5000});
    await page.locator('#download').click();
    const download=await downloadPromise;
    record('Poster SVG export',download.suggestedFilename().endsWith('.svg'),download.suggestedFilename());
    await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
    record('Desktop JavaScript errors',errors.length===0,errors.join('; ')||'none');
    await page.close();

    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const mobileErrors=[];
    mobile.on('pageerror',e=>mobileErrors.push(e.message));
    const mr=await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
    const dims=await mobile.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    record('Mobile route and horizontal overflow',!!mr&&mr.status()===200&&dims.document<=dims.viewport+2,JSON.stringify({status:mr&&mr.status(),...dims}));
    await mobile.getByRole('button',{name:/记录一首歌/}).click();
    await mobile.locator('#story').fill('手机端线上验收：这首歌让我想起一次旅行。');
    await mobile.locator('#generate').click();
    await mobile.locator('#result').waitFor({state:'visible',timeout:5000});
    record('Mobile create flow',true,'Input → preview');
    record('Mobile JavaScript errors',mobileErrors.length===0,mobileErrors.join('; ')||'none');
    await mobile.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
    await mobile.close();
  } catch(e) {
    record('Test runner exception',false,e.stack||e.message||e);
  } finally {
    if(browser) await browser.close().catch(()=>{});
  }
  const failures=results.filter(r=>r.status==='FAIL');
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({target,finishedAt:new Date().toISOString(),summary:{passed:results.length-failures.length,failed:failures.length},results},null,2));
  if(failures.length) process.exitCode=1;
})();
