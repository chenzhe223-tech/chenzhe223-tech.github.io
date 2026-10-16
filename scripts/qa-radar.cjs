const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.RADAR_TEST_URL || 'http://127.0.0.1:4173/radar/daily/';
const out = 'test-results/radar';
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(ok, name, detail = '') {
  results.push({ status: ok ? 'PASS' : 'FAIL', name, detail: String(detail) });
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : ''));
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
      check(!!response && response.status() < 400, viewport.name + ': daily page loads', 'HTTP ' + (response && response.status()));
      await page.waitForSelector('#reportDate', { timeout: 10000 });
      await page.waitForTimeout(700);
      check((await page.title()).includes('AI 前沿简报'), viewport.name + ': page title');
      check(await page.locator('#newsCount').innerText().then(x => Number(x) > 0), viewport.name + ': source news rendered', await page.locator('#newsCount').innerText());
      const cards = page.locator('#top5List .top5-card');
      const count = await cards.count();
      check(count === 5, viewport.name + ': five story cards visible', 'count=' + count);
      check(await page.locator('#top5List .story-image img').count() === 5, viewport.name + ': editorial imagery present');
      check(await page.locator('#top5List a[href^="http"]').count() === 5, viewport.name + ': each story has source link');
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      check(overflow.document <= overflow.viewport + 2, viewport.name + ': no horizontal page overflow', JSON.stringify(overflow));
      const bodyColor = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
      check(bodyColor !== 'rgba(0, 0, 0, 0)', viewport.name + ': page has computed background', bodyColor);
      await page.screenshot({ path: path.join(out, viewport.name + '.png'), fullPage: true });
      await page.getByRole('button', { name: 'EN' }).click();
      check(await page.locator('html').getAttribute('lang') === 'en', viewport.name + ': language switch works');
      await page.getByRole('button', { name: '中文' }).click();
      check(await page.locator('html').getAttribute('lang') === 'zh-CN', viewport.name + ': language switches back');
      check(errors.length === 0, viewport.name + ': no JavaScript errors', errors.join('; '));
      await page.close();
    }
  } catch (error) {
    check(false, 'test runner completed', error.stack || error.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ target: base, results, passed: results.filter(x => x.status === 'PASS').length, failed: results.filter(x => x.status === 'FAIL').length }, null, 2));
  if (results.some(x => x.status === 'FAIL')) process.exitCode = 1;
})();
