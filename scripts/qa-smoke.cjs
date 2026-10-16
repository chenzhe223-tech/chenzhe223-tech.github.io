const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'https://chenzhe223-tech.github.io/';
const out = 'test-results';
fs.mkdirSync(out, { recursive: true });
const checks = [], warnings = [], failures = [];
const mark = (status, name, detail = '') => {
  const r = { status, name, detail: String(detail) };
  checks.push(r); console.log('[' + status + '] ' + name + (detail ? ' — ' + detail : ''));
  if (status === 'WARN') warnings.push(r);
  if (status === 'FAIL') failures.push(r);
};
(async () => {
  let browser;
  const report = { target: base, checkedAt: new Date().toISOString() };
  try {
    browser = await chromium.launch({ headless: true });
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    desktop.on('pageerror', e => errors.push(e.message));
    const resp = await desktop.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!resp || resp.status() >= 400) throw new Error('Homepage HTTP ' + (resp && resp.status()));
    await desktop.waitForSelector('#shelf .app-card', { timeout: 20000 });
    mark('PASS', '线上首页可打开', 'HTTP ' + resp.status() + ' · ' + await desktop.title());
    const titleOk = (await desktop.title()).includes('DAVYLAB');
    mark(titleOk ? 'PASS' : 'FAIL', '页面标题', await desktop.title());
    const n = await desktop.locator('#shelf .app-card').count();
    mark(n === 17 ? 'PASS' : 'FAIL', '产品卡片渲染', '预期 17，实际 ' + n);
    await desktop.screenshot({ path: path.join(out, 'desktop-home.png'), fullPage: true });
    const dims = await desktop.locator('#shelf').evaluate(e => ({ viewport: e.clientWidth, content: e.scrollWidth }));
    mark(dims.content > dims.viewport + 8 ? 'PASS' : 'FAIL', '横向应用货架', JSON.stringify(dims));
    await desktop.locator('#next').click();
    await desktop.waitForTimeout(500);
    const afterNext = await desktop.locator('#shelf').evaluate(e => e.scrollLeft);
    mark(afterNext > 0 ? 'PASS' : 'FAIL', '右箭头滚动', 'scrollLeft=' + afterNext);
    await desktop.locator('#prev').click();
    await desktop.waitForTimeout(500);
    const afterPrev = await desktop.locator('#shelf').evaluate(e => e.scrollLeft);
    mark(afterPrev < afterNext ? 'PASS' : 'FAIL', '左箭头回滚', 'scrollLeft=' + afterPrev);
    await desktop.locator('#search').fill('Worktoon');
    const found = await desktop.locator('#shelf .app-card').count();
    mark(found === 1 && (await desktop.locator('#shelf').innerText()).includes('Worktoon') ? 'PASS' : 'FAIL', '搜索功能', 'Worktoon 匹配数=' + found);
    await desktop.locator('#search').fill('');
    await desktop.locator('[data-filter="concepts"]').click();
    const cn = await desktop.locator('#shelf .app-card').count();
    mark(cn > 0 && cn < 17 ? 'PASS' : 'FAIL', '分类筛选', '概念项目筛选数=' + cn);
    await desktop.locator('[data-filter="all"]').click();
    await desktop.locator('[data-detail="nianbox"]').click();
    await desktop.locator('#modal.open').waitFor({ timeout: 5000 });
    const modalTitle = await desktop.locator('#modalTitle').innerText();
    mark(modalTitle.includes('念头盒') ? 'PASS' : 'FAIL', '产品详情弹窗', modalTitle);
    let preview = 'unconfirmed';
    try {
      await desktop.waitForFunction(() => {
        const i = document.querySelector('#productPreviewImage');
        return i && i.complete && i.naturalWidth >= 640 && i.naturalHeight >= 400 && i.style.visibility !== 'hidden';
      }, null, { timeout: 16000 });
      const size = await desktop.locator('#productPreviewImage').evaluate(i => i.naturalWidth + '×' + i.naturalHeight);
      preview = 'loaded ' + size;
      mark('PASS', '念头盒网页截图预览', preview);
    } catch (e) {
      const state = await desktop.locator('#previewStatus').innerText().catch(() => '状态不可读');
      preview = '尚未确认：' + state;
      mark('WARN', '念头盒网页截图预览', preview);
    }
    await desktop.screenshot({ path: path.join(out, 'nianbox-detail.png') });
    const detailLinks = await desktop.locator('#modalActions a[href]').evaluateAll(as => as.map(a => ({ text: a.innerText.trim(), href: a.href })));
    mark(detailLinks.some(a => a.href.includes('niantou-box-app')) ? 'PASS' : 'FAIL', '详情中的真实应用链接', JSON.stringify(detailLinks));
    await desktop.locator('#closeModal').click();

    // Contact intake UI and QR asset are checked without sending a real email.
    await desktop.locator('#contact').scrollIntoViewIfNeeded();
    const formExists = await desktop.locator('#leadForm').count();
    mark(formExists === 1 ? 'PASS' : 'FAIL', '需求表单渲染', '表单数量=' + formExists);
    const contactHeading = await desktop.locator('#contact h2').innerText();
    mark(contactHeading.includes('聊聊') ? 'PASS' : 'FAIL', '需求联系区标题', contactHeading);
    const qr = desktop.locator('.wechat-qr');
    try {
      await qr.waitFor({ state: 'visible', timeout: 5000 });
      await desktop.waitForFunction(() => {
        const img = document.querySelector('.wechat-qr');
        return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      }, null, { timeout: 8000 });
      const qrDim = await qr.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, src: img.currentSrc }));
      mark('PASS', '微信二维码素材加载', JSON.stringify(qrDim));
    } catch (e) {
      mark('FAIL', '微信二维码素材加载', e.message);
    }
    await desktop.locator('[data-project-type="AI 应用"]').click();
    const selectedType = await desktop.locator('#projectType').inputValue();
    mark(selectedType === 'AI 应用' ? 'PASS' : 'FAIL', '需求类型快捷选择', selectedType);
    const contactValidity = await desktop.locator('#leadForm').evaluate(form => ({
      emptyFormIsBlocked: !form.checkValidity(),
      hasRequiredDescription: !!form.querySelector('[name="需求描述"][required]'),
      hasRequiredContact: !!form.querySelector('[name="联系方式"][required]'),
      hasRequiredConsent: !!form.querySelector('[name="联系授权"][required]')
    }));
    mark(contactValidity.emptyFormIsBlocked && contactValidity.hasRequiredDescription && contactValidity.hasRequiredContact && contactValidity.hasRequiredConsent ? 'PASS' : 'FAIL', '表单必填校验', JSON.stringify(contactValidity));
    const mailto = await desktop.locator('.contact-email').getAttribute('href');
    mark(mailto === 'mailto:chenzhe223@gamil.com' ? 'PASS' : 'FAIL', '备用邮箱入口', mailto || 'missing');

    mark(errors.length === 0 ? 'PASS' : 'FAIL', '桌面端 JavaScript 异常', errors.length ? JSON.stringify(errors) : '未发现 pageerror');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const mobileErrors = [];
    mobile.on('pageerror', e => mobileErrors.push(e.message));
    const mr = await mobile.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await mobile.waitForSelector('#shelf .app-card', { timeout: 20000 });
    const md = await mobile.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, shelf: document.querySelector('#shelf').clientWidth, shelfContent: document.querySelector('#shelf').scrollWidth }));
    mark(mr && mr.status() < 400 ? 'PASS' : 'FAIL', '手机端首页响应', 'HTTP ' + (mr && mr.status()));
    mark(md.document <= md.width + 2 ? 'PASS' : 'FAIL', '手机端页面无横向溢出', JSON.stringify(md));
    mark(md.shelfContent > md.shelf ? 'PASS' : 'FAIL', '手机端横向滑动货架', JSON.stringify(md));
    await mobile.screenshot({ path: path.join(out, 'mobile-home.png'), fullPage: true });
    mark(mobileErrors.length === 0 ? 'PASS' : 'FAIL', '手机端 JavaScript 异常', mobileErrors.length ? JSON.stringify(mobileErrors) : '未发现 pageerror');

    const targets = [
      ['念头盒', 'https://chenzhe223-tech.github.io/niantou-box-app/'],
      ['念头盒品牌站', 'https://chenzhe223-tech.github.io/niantou-box/'],
      ['Worktoon', 'https://worktoon.app.workbuddy.host/'],
      ['拼音星球', 'https://chenzhe223-tech.github.io/pinyin-planet/'],
      ['暖间地图', 'https://warm-room-map.pages.dev/'],
      ['物遇官网', 'https://chenzhe223-tech.github.io/wuyu-brand-site/'],
      ['物遇商家工作台', 'https://chenzhe223-tech.github.io/wuyu-brand-site/merchant/'],
      ['随调', 'https://chenzhe223-tech.github.io/SipSpark/'],
      ['山姆全球购工具', 'https://chenzhe223-tech.github.io/sam-global-buy/'],
      ['山姆数据导入', 'https://chenzhe223-tech.github.io/sam-global-buy/sam-app-import.html']
    ];
    const request = await require('playwright').request.newContext({ timeout: 25000 });
    const links = await Promise.all(targets.map(async ([name, url]) => {
      try {
        const r = await request.get(url, { maxRedirects: 5 });
        const ok = r.status() >= 200 && r.status() < 400;
        mark(ok ? 'PASS' : 'WARN', '产品入口 · ' + name, 'HTTP ' + r.status() + ' · ' + r.url());
        return { name, url, status: r.status(), ok };
      } catch (e) {
        mark('WARN', '产品入口 · ' + name, e.message);
        return { name, url, ok: false, error: e.message };
      }
    }));
    await request.dispose();
    report.externalLinks = links;
    report.summary = {
      passed: checks.filter(c => c.status === 'PASS').length,
      warnings: warnings.length,
      failures: failures.length,
      linksOk: links.filter(l => l.ok).length,
      linksTotal: links.length,
      screenshotPreview: preview
    };
  } catch (e) {
    mark('FAIL', '测试执行器', e.stack || e.message || e);
    report.runnerError = e.stack || e.message || String(e);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  report.finishedAt = new Date().toISOString();
  report.checks = checks;
  report.warnings = warnings;
  report.failures = failures;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    '# DAVYLAB Browser QA',
    '',
    '- Target: ' + base,
    '- Finished: ' + report.finishedAt,
    '- Summary: ' + JSON.stringify(report.summary || { failures: failures.length }),
    '',
    '| Status | Check | Detail |',
    '|---|---|---|',
    ...checks.map(c => '| ' + c.status + ' | ' + c.name.replace(/\|/g, '\\|') + ' | ' + c.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ') + ' |')
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  if (failures.length) process.exitCode = 1;
})();
