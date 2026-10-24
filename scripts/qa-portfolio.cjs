const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const results = [];
  const outDir = path.join(process.cwd(), 'test-results', 'portfolio');
  fs.mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('#products').waitFor();
    await page.locator('#shelf .app-card').first().waitFor({ timeout: 10000 });
    const title = await page.locator('h1').innerText();
    if (!title.trim()) throw new Error('Hero heading is empty');
    results.push({ test: 'desktop initial render', status: 'PASS', detail: title.replace(/\s+/g, ' ').trim() });

    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    }));
    if (!colors.canvas.toLowerCase().includes('#f7f7f4') || !colors.ink.toLowerCase().includes('#202630')) {
      throw new Error('Balanced SaaS design tokens are not active: ' + JSON.stringify(colors));
    }
    results.push({ test: 'Balanced SaaS design tokens', status: 'PASS', detail: colors });

    const initialCount = await page.locator('#shelf .app-card').count();
    if (initialCount < 3) throw new Error('Expected at least 3 product cards, got ' + initialCount);
    await page.locator('#search').fill('zz-no-match-davylab-qa');
    if (await page.locator('#shelf .app-card').count() !== 0) throw new Error('Search does not filter to zero results for a unique unmatched query');
    await page.locator('#search').fill('');
    if (await page.locator('#shelf .app-card').count() !== initialCount) throw new Error('Clearing search did not restore product cards');
    results.push({ test: 'product search and reset', status: 'PASS', detail: { initialCount } });

    await page.locator('[data-filter="apps"]').click();
    const filteredCount = await page.locator('#shelf .app-card').count();
    if (filteredCount < 1 || filteredCount > initialCount) throw new Error('App category filter produced unexpected count: ' + filteredCount);
    await page.locator('[data-filter="all"]').click();
    if (await page.locator('#shelf .app-card').count() !== initialCount) throw new Error('All-products filter did not restore product cards');
    results.push({ test: 'category filters', status: 'PASS', detail: { initialCount, filteredCount } });

    await page.locator('#shelf [data-detail]').first().click();
    await page.locator('#modal.open').waitFor({ timeout: 5000 });
    await page.locator('#closeModal').click();
    await page.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('open'), null, { timeout: 3000 });
    results.push({ test: 'project detail modal open/close', status: 'PASS' });

    await page.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (desktopOverflow) throw new Error('Horizontal page overflow at 1440px desktop viewport');
    results.push({ test: 'desktop layout overflow', status: 'PASS' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const mobile = await page.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      heroVisible: !!document.querySelector('h1') && document.querySelector('h1').getBoundingClientRect().width > 0,
      searchVisible: !!document.querySelector('#search') && document.querySelector('#search').getBoundingClientRect().width > 0,
      cardWidth: document.querySelector('#shelf .app-card')?.getBoundingClientRect().width || 0
    }));
    if (!mobile.heroVisible || !mobile.searchVisible || mobile.cardWidth <= 0) throw new Error('Essential mobile content is not visible: ' + JSON.stringify(mobile));
    if (mobile.documentWidth > mobile.width + 2) throw new Error('Horizontal page overflow at mobile viewport: ' + JSON.stringify(mobile));
    await page.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });
    results.push({ test: 'mobile 390px layout', status: 'PASS', detail: mobile });

    if (errors.length) throw new Error('Browser console/page errors: ' + errors.join(' | '));
    results.push({ test: 'browser console and uncaught exceptions', status: 'PASS', detail: 'No errors captured' });
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ status: 'PASS', results, errors }, null, 2));
    console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ status: 'FAIL', results, errors, failure: error.stack || String(error) }, null, 2));
    console.error(JSON.stringify({ status: 'FAIL', results, errors, failure: error.stack || String(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
