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
      const firstCard = page.locator('#top5List .top5-card').first();
      const cardStyles = await firstCard.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el.querySelector('p')).color, title: getComputedStyle(el.querySelector('h3')).color }));
      check(cardStyles.background === 'rgb(255, 255, 255)', viewport.name + ': story card has solid light background', JSON.stringify(cardStyles));
      check(cardStyles.text === 'rgb(52, 70, 94)' && cardStyles.title === 'rgb(23, 79, 126)', viewport.name + ': story text has high-contrast colors', JSON.stringify(cardStyles));
      const editorial = page.locator('#editorialCore');
      if (await editorial.count()) {
        const isVisible = await editorial.isVisible();
        const hasSynthesis = await page.evaluate(() => !!document.querySelector('#editorialCore strong'));
        if (!hasSynthesis) check(!isVisible, viewport.name + ': internal missing-analysis status is hidden from readers');
      }
      check(await page.locator('#featureTitle').innerText().then(x => x.trim().length > 0), viewport.name + ': lead feature has a headline');
      const storyLabel = await page.locator('#top5List .story-label').first().innerText();
      if (storyLabel.includes('暂不可用') || storyLabel.includes('UNAVAILABLE')) {
        const cardsText = await cards.allInnerTexts();
        check(cardsText.every(x => !x.includes('/50') && !x.includes('/10')), viewport.name + ': source fallback does not display fabricated scores');
        check(!(await page.locator('#editorialCore').isVisible()), viewport.name + ': internal AI-unavailable note stays hidden');
      }
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
