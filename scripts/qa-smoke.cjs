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
    mark(n >= 17 ? 'PASS' : 'FAIL', '产品卡片渲染', '预期至少 17，实际 ' + n);
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
    mark(cn > 0 && cn < n ? 'PASS' : 'FAIL', '分类筛选', '概念项目筛选数=' + cn + ' / 全部=' + n);
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
      hasRequiredReplyEmail: !!form.querySelector('input[name="email"][type="email"][required]'),
      hasRequiredConsent: !!form.querySelector('[name="联系授权"][required]')
    }));
    mark(contactValidity.emptyFormIsBlocked && contactValidity.hasRequiredDescription && contactValidity.hasRequiredContact && contactValidity.hasRequiredReplyEmail && contactValidity.hasRequiredConsent ? 'PASS' : 'FAIL', '表单必填校验（含回执邮箱）', JSON.stringify(contactValidity));
    const autoReply = await desktop.locator('#leadForm [name="_autoresponse"]').inputValue();
    mark(autoReply.includes('感谢联系 DAVYLAB') && autoReply.includes('自动确认邮件') && autoReply.includes('DavyChen') ? 'PASS' : 'FAIL', '自动回复邮件内容配置', autoReply.slice(0, 180));
    const replyEmailField = await desktop.locator('#leadForm input[name="email"]').evaluate(el => ({type:el.type,required:el.required,autocomplete:el.autocomplete}));
    mark(replyEmailField.type === 'email' && replyEmailField.required ? 'PASS' : 'FAIL', '自动回复目标邮箱字段', JSON.stringify(replyEmailField));
    const mailto = await desktop.locator('.contact-email').getAttribute('href');
    mark(mailto === 'mailto:chenzhe223@gmail.com' ? 'PASS' : 'FAIL', '备用邮箱入口', mailto || 'missing');
    const formConfig = await desktop.locator('#leadForm').evaluate(form => ({
      action: form.action,
      method: form.method.toUpperCase(),
      next: form.querySelector('[name="_next"]')?.value || '',
      url: form.querySelector('[name="_url"]')?.value || ''
    }));
    mark(formConfig.action === 'https://formsubmit.co/chenzhe223@gmail.com' && formConfig.method === 'POST' ? 'PASS' : 'FAIL', '原生邮件表单提交配置', JSON.stringify(formConfig));
    mark(formConfig.next.includes('contact=submitted') && formConfig.url === 'https://chenzhe223-tech.github.io/' ? 'PASS' : 'FAIL', '提交后返回链接', JSON.stringify({ next: formConfig.next, url: formConfig.url }));
    // Simulate the provider's success redirect without sending another email.
    const returnResponse = await desktop.goto(base + '?contact=submitted#contact', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await desktop.waitForFunction(() => document.querySelector('#leadStatus')?.classList.contains('success'), null, { timeout: 5000 });
    const redirectMessage = await desktop.locator('#leadStatus').innerText();
    mark(returnResponse && returnResponse.status() < 400 && redirectMessage.includes('邮件服务处理') ? 'PASS' : 'FAIL', '提交成功后的回站提示', redirectMessage);

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

    // End-to-end Skill save: the brief writes the hand-off queue, then the real
    // NianBox app imports it into IndexedDB. Each smoke run uses a fresh browser
    // context, so the test does not touch a user's persistent browser data.
    try {
      const radarPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const radarResponse = await radarPage.goto('https://chenzhe223-tech.github.io/radar/daily/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await radarPage.waitForSelector('#featuredSkill [data-nb-skill-save]', { timeout: 20000 });
      const saveButton = radarPage.locator('#featuredSkill [data-nb-skill-save]').first();
      const savedSkillName = await saveButton.getAttribute('data-skill-name');
      const popupPromise = radarPage.context().waitForEvent('page', { timeout: 20000 });
      await saveButton.click();
      const nianboxPopup = await popupPromise;
      await nianboxPopup.waitForLoadState('domcontentloaded', { timeout: 45000 });
      const importToast = nianboxPopup.locator('.nb-toast--success').filter({ hasText: '已从 AI 简报收录' });
      await importToast.waitFor({ state: 'visible', timeout: 20000 });
      mark(
        radarResponse && radarResponse.status() < 400 ? 'PASS' : 'FAIL',
        'AI 简报 → 念头盒一键收录',
        '打开念头盒并成功收录：' + (savedSkillName || '今日推荐 Skill')
      );
      const queueCleared = await radarPage.evaluate(() => window.localStorage.getItem('nb.radar.pending-skill.v1') === null);
      mark(queueCleared ? 'PASS' : 'FAIL', 'Skill 交接队列清理', queueCleared ? '成功写入后清除待导入项' : '队列仍存在');
      await nianboxPopup.locator('.nb-tabbar__link[href="#/inbox"]').click();
      const importedTitle = 'Skill：' + (savedSkillName || '');
      await nianboxPopup.locator('.nb-list .nb-idea__title').filter({ hasText: importedTitle }).waitFor({ state: 'visible', timeout: 12000 });
      mark('PASS', 'Skill 出现在念头盒收件箱', importedTitle);
      await nianboxPopup.close();
      await radarPage.close();
    } catch (e) {
      mark('FAIL', 'AI 简报 → 念头盒一键收录', e.stack || e.message || e);
    }


    // KeyPocket public GitHub import smoke checks
    try {
      const kp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const kpErrors = [];
      kp.on('pageerror', e => kpErrors.push(e.message));
      const kpResp = await kp.goto(base + 'keypocket/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      mark(kpResp && kpResp.status() < 400 ? 'PASS' : 'FAIL', 'KeyPocket 页面可打开', 'HTTP ' + (kpResp && kpResp.status()));
      await kp.waitForSelector('#unlockForm', { timeout: 10000 });
      const csp = await kp.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      mark(csp && csp.includes('https://api.github.com') ? 'PASS' : 'FAIL', 'KeyPocket GitHub API CSP', csp || 'CSP missing');
      // Fresh browser context: create a disposable test vault using synthetic credentials only.
      await kp.locator('#masterPassword').fill('QA-only-demo-password-2026');
      await kp.locator('#confirmPassword').fill('QA-only-demo-password-2026');
      await kp.locator('#unlockBtn').click();
      await kp.waitForSelector('#mainView:not(.hidden)', { timeout: 10000 });
      await kp.locator('[data-module="projects"]').click();
      await kp.waitForSelector('#projectView:not(.hidden)', { timeout: 5000 });
      const importButton = await kp.locator('#importGithubBtn').count();
      mark(importButton === 1 ? 'PASS' : 'FAIL', 'KeyPocket GitHub 导入入口', '按钮数量=' + importButton);
      if (importButton === 1) {
        await kp.locator('#importGithubBtn').click();
        await kp.waitForSelector('#githubOwner', { timeout: 5000 });
        await kp.locator('#githubOwner').fill('octocat');
        await kp.locator('#githubLoadBtn').click();
        await kp.waitForFunction(() => document.querySelector('#githubImportStatus')?.classList.contains('ok'), null, { timeout: 20000 });
        const repoCount = await kp.locator('#githubRepoList .github-repo-row').count();
        mark(repoCount > 0 ? 'PASS' : 'FAIL', 'KeyPocket GitHub 公开仓库加载', 'octocat 可选仓库数=' + repoCount);
        if (repoCount > 0) {
          const selectedRepoName = await kp.locator('#githubRepoList .github-repo-row strong').first().innerText();
          await kp.locator('#githubRepoList input[type="checkbox"]').first().check();
          await kp.locator('#githubImportSelectedBtn').click();
          await kp.waitForFunction(name => document.querySelector('#projectCards')?.innerText.includes(name), selectedRepoName, { timeout: 10000 });
          mark('PASS', 'KeyPocket 仓库导入与项目卡片渲染', '测试仓库已导入：' + selectedRepoName);
        }
      }
      mark(kpErrors.length === 0 ? 'PASS' : 'FAIL', 'KeyPocket 页面 JavaScript 异常', kpErrors.length ? JSON.stringify(kpErrors) : '未发现 pageerror');
      await kp.screenshot({ path: path.join(out, 'keypocket-home.png'), fullPage: true });
      await kp.close();
    } catch (e) {
      mark('FAIL', 'KeyPocket smoke checks', e.stack || e.message || e);
    }


    // DAVYLAB WeChat Topic Studio: verify the route and its core local-first workflow.
    try {
      const topicPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const topicErrors = [];
      topicPage.on('pageerror', e => topicErrors.push(e.message));
      const topicResp = await topicPage.goto(base + 'topic-studio/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      mark(topicResp && topicResp.status() === 200 ? 'PASS' : 'FAIL', '公众号选题工作台路由', 'HTTP ' + (topicResp && topicResp.status()));
      await topicPage.waitForSelector('#feedList', { timeout: 10000 });
      const topicTitle = await topicPage.title();
      mark(topicTitle.includes('公众号选题工作台') ? 'PASS' : 'FAIL', '选题工作台页面标题', topicTitle);
      await topicPage.waitForFunction(() => {
        const el = document.querySelector('#sourceStatus');
        return el && el.innerText.trim().length > 0;
      }, null, { timeout: 12000 });
      const feedState = await topicPage.locator('#sourceStatus').innerText();
      mark(feedState.includes('已连接') ? 'PASS' : 'WARN', 'Davy Radar 数据连接', feedState);
      await topicPage.locator('#newTop').click();
      await topicPage.locator('#topicDialog[open]').waitFor({ timeout: 5000 });
      await topicPage.locator('#topicTitle').fill('QA 临时选题：AI 产品实践');
      await topicPage.locator('#topicWhy').fill('用于验证选题新建、评分和本地保存路径，不作为正式选题。');
      await topicPage.locator('#topicForm button[type="submit"]').click();
      await topicPage.locator('#topicList').getByText('QA 临时选题：AI 产品实践').waitFor({ timeout: 8000 });
      const savedTopic = await topicPage.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('davylab-topic-studio-v1') || '[]');
        return data.some(t => t.title === 'QA 临时选题：AI 产品实践');
      });
      mark(savedTopic ? 'PASS' : 'FAIL', '选题新建与本地保存', savedTopic ? '新建记录可重新读取' : '未在 localStorage 找到测试选题');
      await topicPage.screenshot({ path: path.join(out, 'topic-studio-home.png'), fullPage: true });
      mark(topicErrors.length === 0 ? 'PASS' : 'FAIL', '选题工作台 JavaScript 异常', topicErrors.length ? JSON.stringify(topicErrors) : '未发现 pageerror');
      await topicPage.close();

      const topicMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const mobileResp = await topicMobile.goto(base + 'topic-studio/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await topicMobile.waitForSelector('#feedList', { timeout: 10000 });
      const overflow = await topicMobile.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
      mark(mobileResp && mobileResp.status() === 200 && overflow.document <= overflow.viewport + 4 ? 'PASS' : 'FAIL', '选题工作台手机端与横向溢出', JSON.stringify({ status: mobileResp && mobileResp.status(), ...overflow }));
      await topicMobile.close();
    } catch (e) {
      mark('FAIL', '公众号选题工作台 smoke checks', e.stack || e.message || e);
    }

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
