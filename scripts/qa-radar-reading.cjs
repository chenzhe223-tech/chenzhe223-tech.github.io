const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.RADAR_TEST_URL || 'http://127.0.0.1:4173/radar/daily/';
const out = process.env.READING_QA_OUT || 'test-results/radar-reading';
const results = [];
function check(value, name, detail) {
  results.push({ status: value ? 'PASS' : 'FAIL', name, detail });
  console.log(`[${value ? 'PASS' : 'FAIL'}] ${name}`);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PW_BROWSER_CHANNEL ? { channel: process.env.PW_BROWSER_CHANNEL } : {}) });
  try {
    for (const width of [320,360,390,428,768,820,1024,1280,1440,1920]) {
      const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 1000 }, hasTouch: width < 500 });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#xnewsVoices .item').first().waitFor();
      check(response.status() === 200 && (await page.title()).includes('AI 前沿简报'), `${width}: actual briefing loads`);
      const audit = await page.evaluate(() => {
        const summaries = [...document.querySelectorAll('#xnewsVoices .explain')];
        const boxes = [...document.querySelectorAll('#featuredSkill > div')].map(e => e.getBoundingClientRect().toJSON());
        const report = reportData;
        return {
          noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
          summariesComplete: summaries.every((e,i) => e.textContent === (report.xnews_voices[i].summary_zh || report.xnews_voices[i].summary || '') && e.scrollHeight <= e.clientHeight + 2 && getComputedStyle(e).webkitLineClamp === 'none'),
          fullImages: [...document.querySelectorAll('#xnewsVoices img,#leadStory img')].every(e => getComputedStyle(e).objectFit === 'contain'),
          skillColumns: getComputedStyle(document.querySelector('#featuredSkill')).gridTemplateColumns.split(' ').length,
          skillGap: innerWidth <= 760 ? boxes[1].top - boxes[0].bottom : Math.abs(boxes[0].top - boxes[1].top),
          newsCount: report.news.length, skillsCount: Math.min(10,report.skills.length),
          date: report.report_date
        };
      });
      check(audit.noOverflow, `${width}: whole page has no horizontal overflow`);
      check(audit.summariesComplete, `${width}: collected X News text is fully rendered without clamping`);
      check(audit.fullImages, `${width}: source figures and lead artwork use complete-image fitting`);
      check(audit.skillColumns === (width <= 760 ? 1 : 2) && audit.skillGap <= 32, `${width}: Skill columns have no empty 70px row`, audit);
      for (const [root, kind, total] of [['newsList','news',audit.newsCount],['skillList','skills',audit.skillsCount]]) {
        check(await page.locator(`#${root} > .item:visible`).count() === Math.min(4,total), `${width}: ${kind} has useful visible previews`);
        check(await page.locator(`#${root} .item`).count() === total, `${width}: all ${kind} records are retained`);
        if (total > 4) {
          const more = page.locator(`#${root} > details`);
          await more.locator('summary').click();
          check(await more.locator('.item:visible').count() === total - 4, `${width}: expanding ${kind} exposes every remaining item`);
          await more.locator('summary').click();
        }
      }
      if ([390,820,1440,1920].includes(width)) {
        await page.locator('#xnewsVoices img').evaluateAll(imgs => Promise.all(imgs.map(img => { img.loading = 'eager'; return img.decode(); })));
        for (const [id,label] of [['xnewsVoicesSection','xnews'],['dailySkill','skill'],['news','news']]) await page.locator('#'+id).screenshot({ path: path.join(out,`${width}-${label}.png`) });
        if ([390,1440].includes(width)) await page.screenshot({ path: path.join(out,`${width}-full.png`), fullPage: true });
      }
      if ([390,1440].includes(width)) {
        await page.locator('#xnewsVoices .voice-cover').first().click();
        const dialog = page.locator('#readingImageDialog');
        await dialog.locator('img').evaluate(img => img.decode());
        const box = await dialog.boundingBox();
        check(await dialog.isVisible() && box.width <= width && box.height <= (width < 500 ? 844 : 1000), `${width}: image viewer fits the device`);
        const imageSpace=await dialog.evaluate(d=>({stage:d.querySelector('.image-stage').getBoundingClientRect().height,image:d.querySelector('img').getBoundingClientRect().height}));
        check(imageSpace.stage<=imageSpace.image+4,`${width}: fitted image viewer has no artificial vertical blank area`,imageSpace);
        await page.screenshot({ path: path.join(out,`${width}-image-viewer.png`) });
        await dialog.locator('.image-size').click();
        check(await dialog.locator('.image-size').getAttribute('aria-pressed') === 'true', `${width}: image can be inspected at original size`);
        check(await dialog.locator('.image-stage').evaluate(e=>e.scrollWidth>e.clientWidth),`${width}: original-size diagram supports horizontal inspection`);
        await page.keyboard.press('Escape');
        check(!await dialog.isVisible() && await page.locator('#xnewsVoices .voice-cover').first().evaluate(e => e === document.activeElement), `${width}: Escape restores focus and reading position`);
      }
      const fixture = await page.evaluate(() => reportData.xnews_voices[0]);
      for (const count of [4,5,6]) {
        const shape = await page.evaluate(({fixture,count}) => {
          const rows = Array.from({length:count},(_,i) => ({...fixture,title:'测试条目',title_zh:'用于检验完整换行与阅读布局的长标题'.repeat(8),summary_zh:'这是检查完整文本展示的长摘要。'.repeat(28)}));
          renderXnewsVoices(rows);
          const root=document.querySelector('#xnewsVoices'), cards=[...root.querySelectorAll('.item')], boxes=cards.map(e=>e.getBoundingClientRect().toJSON());
          return {columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,lastWidth:boxes.at(-1).width,rootWidth:root.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth+1,fullText:cards.every(e=>[...e.querySelectorAll('h3,.explain')].every(n=>n.scrollHeight<=n.clientHeight+2)),count:cards.length};
        },{fixture,count});
        check(shape.count===count&&!shape.overflow&&shape.fullText, `${width}: ${count} long-title cards keep all content visible`, shape);
        check(shape.columns===(width<=600?1:2)&&(count!==5||width<=600||shape.lastWidth>=shape.rootWidth-2), `${width}: ${count} cards use balanced rows`, shape);
      }
      await page.evaluate(() => renderXnewsVoices(reportData.xnews_voices));
      if ([390,1440].includes(width)) {
        await page.locator('#xnewsVoices h3 a').first().click();
        await page.locator('.story .cover').evaluate(img=>img.decode());
        check(page.url().includes('type=xnews')&&page.url().includes(audit.date),`${width}: actual deep read keeps the issue and source`);
        await page.locator('.story .cover').focus(); await page.keyboard.press('Enter');
        check(await page.locator('#readingImageDialog').isVisible(),`${width}: keyboard opens the deep-reader image`);
        await page.keyboard.press('Escape');
        check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: deep reader has no horizontal overflow`);
      }
      check(errors.length===0,`${width}: no page script errors`,errors);
      await page.close();
    }
  } catch(error) { check(false,'reading regression completes',error.stack); }
  finally { await browser.close(); }
  const summary={target:base,checkedAt:new Date().toISOString(),browser:'Playwright; Browser plugin not available',results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));
  console.log(`Reading QA: ${summary.passed} passed, ${summary.failed} failed`);
  if(summary.failed)process.exitCode=1;
})();
