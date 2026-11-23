// DAVYLAB News Engine: real Chromium browser acceptance for the local-only editor.
// Runs without secrets, server, external media and production deploy.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const editorUrl = pathToFileURL(path.resolve(__dirname, 'editor.html')).href;

async function exercise(browser, viewport, name) {
  const context = await browser.newContext({
    viewport, acceptDownloads: true, serviceWorkers: 'block', offline: true,
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto(editorUrl);
  assert.equal(await page.locator('#save').isDisabled(), true);
  assert.equal(await page.locator('#refresh').isDisabled(), true);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');

  const bad = { title: 'Should be rejected', body: 'not approved', publishable: true,
                editorial_status: 'requires_human_review' };
  await page.locator('#upload').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bad)),
  });
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('加载失败'));
  assert.equal(await page.locator('#save').isDisabled(), true);

  const draft = {
    candidate_id: 'research-candidate-001',
    title: 'Initial verified-evidence draft',
    body: 'A provisional source fact [来源：https://example.com/original]',
    editorial_status: 'requires_human_review',
    publishable: false,
    revision: 1,
    evidence: [{ claim: 'provisional',
                 source_url: 'https://example.com/original',
                 checked_at: '2026-11-19T00:00:00+00:00' }],
  };
  await page.locator('#upload').setInputFiles({
    name: 'review.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(draft)),
  });
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
  await page.locator('#title').fill('<News> Revised');
  await page.locator('#body').fill('<script>window.pwned=true</script> Updated body with citations.');
  await page.locator('#addAsset').click();
  const asset = page.locator('.media-row').last();
  await asset.locator('[data-field="id"]').fill('cover');
  await asset.locator('[data-field="kind"]').selectOption('document');
  await asset.locator('[data-field="url"]').fill('https://example.org/asset.pdf');
  await asset.locator('[data-field="source_url"]').fill('https://example.org/notice');
  await asset.locator('[data-field="rights_status"]').selectOption('permission_granted');
  await asset.locator('[data-field="alt"]').fill('Public document notice');
  await page.locator('#refresh').click();
  assert.equal(await page.locator('#previewTitle').textContent(), '<News> Revised');
  assert.match(await page.locator('#preview').textContent(), /<script>window.pwned=true<\/script>/);
  assert.equal(await page.locator('#preview script').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.pwned)), false);

  const overflow = await page.evaluate(
    () => ({width: document.documentElement.scrollWidth, viewport: innerWidth})
  );
  assert.ok(overflow.width <= overflow.viewport + 2,
    'horizontal overflow on ' + name + ': ' + JSON.stringify(overflow));

  const screenshotDir = process.env.NEWS_ENGINE_SCREENSHOT_DIR || path.join(os.tmpdir(), 'news-engine-screenshots');
  fs.mkdirSync(screenshotDir, {recursive: true});
  await page.screenshot({path: path.join(screenshotDir, name + '.png'), fullPage: true});

  const pending = page.waitForEvent('download');
  await page.locator('#save').click();
  const download = await pending;
  assert.match(download.suggestedFilename(), /^davylab-news-review-r2\.json$/);
  const output = path.join(screenshotDir, name + '-export.json');
  await download.saveAs(output);
  const result = JSON.parse(fs.readFileSync(output, 'utf-8'));
  assert.equal(result.editorial_status, 'requires_human_review');
  assert.equal(result.publishable, false);
  assert.equal(result.evidence_review_required, true);
  assert.equal(result.revision, 2);
  assert.equal(result.candidate_id, draft.candidate_id);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].rights_status, 'permission_granted');
  assert.equal(result.assets[0].source_url, 'https://example.org/notice');
  assert.equal(result.editor_content_sha256.length, 64);
  assert.equal(result.title, '<News> Revised');
  assert.ok(!('sha256' in result));
  assert.ok(!('content_sha256' in result));
  assert.deepEqual(browserErrors, []);
  await context.close();
  return {name, viewport, export_revision: result.revision, asset_count: result.assets.length};
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
    const results = [];
    results.push(await exercise(browser, {width: 1280, height: 900}, 'desktop'));
    results.push(await exercise(browser, {width: 390, height: 844}, 'mobile'));
    console.log(JSON.stringify({status:'PASS', editor: 'offline_review_only', checks: results}, null, 2));
  } finally {
    if (browser) await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
