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
    const learningCardCount = await desktop.locator('#shelf [data-id="learning-universe"]').count();
    const knowledgeCardCount = await desktop.locator('#shelf [data-id="knowledge-os"]').count();
    const newProjectsVisible = learningCardCount === 1 && knowledgeCardCount === 1;
    mark(newProjectsVisible ? 'PASS' : 'FAIL', '新增项目卡片展示', JSON.stringify({ learningCardCount, knowledgeCardCount }));
    await desktop.screenshot({ path: path.join(out, 'desktop-home.png'), fullPage: true });
    const dims = await desktop.locator('#shelf').evaluate(e => ({ viewport: e.clientWidth, content: e.scrollWidth }));
    mark(dims.content > dims.viewport + 8 ? 'PASS' : 'FAIL', '横向应用货架', JSON.stringify(dims));
    // The product controls use GSAP scroll-reveal; bring them into view before asserting visibility or clicking.
    await desktop.locator('#products .shelf-tools').scrollIntoViewIfNeeded();
    await desktop.waitForTimeout(900);
    await desktop.locator('#shelf').evaluate(el => { el.scrollLeft = 0; el.dispatchEvent(new Event('scroll')); });
    await desktop.waitForTimeout(120);
    await desktop.locator('#next').waitFor({ state: 'visible', timeout: 5000 });
    if (!(await desktop.locator('#next').isEnabled())) throw new Error('Right shelf arrow is disabled before any horizontal scrolling');
    await desktop.locator('#next').click();
    await desktop.waitForTimeout(500);
    const afterNext = await desktop.locator('#shelf').evaluate(e => e.scrollLeft);
    mark(afterNext > 0 ? 'PASS' : 'FAIL', '右箭头滚动', 'scrollLeft=' + afterNext);
    await desktop.locator('#prev').click();
    await desktop.waitForTimeout(500);
    const afterPrev = await desktop.locator('#shelf').evaluate(e => e.scrollLeft);
    mark(afterPrev < afterNext ? 'PASS' : 'FAIL', '左箭头回滚', 'scrollLeft=' + afterPrev);
    await desktop.locator('[data-detail="knowledge-os"]').click();
    await desktop.locator('#modal.open').waitFor({ timeout: 5000 });
    const knowledgeStatus = await desktop.locator('#modalStatus').innerText();
    const knowledgeState = await desktop.locator('#modalState').innerText();
    const knowledgePreview = await desktop.locator('#modalPreview .concept-label').innerText();
    mark(knowledgeStatus.includes('WP-09 开发中') && knowledgeState.includes('尚无公开运行入口') && knowledgePreview.includes('暂无公开运行页面') ? 'PASS' : 'FAIL', 'Knowledge OS 未部署状态披露', knowledgeStatus + ' · ' + knowledgePreview);
    await desktop.locator('#closeModal').click();
    await desktop.locator('[data-detail="learning-universe"]').click();
    await desktop.locator('#modal.open').waitFor({ timeout: 5000 });
    const learningLinks = await desktop.locator('#modalActions a[href]').evaluateAll(as => as.map(a => ({ text: a.innerText.trim(), href: a.href })));
    mark(learningLinks.some(a => a.href === 'https://davylab-learning-universe.pages.dev/') && learningLinks.some(a => a.href === 'https://feat-teardown-3d-simulation.davylab-learning-universe.pages.dev/') ? 'PASS' : 'FAIL', 'Learning Universe 生产与分支预览入口', JSON.stringify(learningLinks));
    await desktop.locator('#closeModal').click();
    await desktop.locator('#search').fill('Worktoon');
    const found = await desktop.locator('#shelf .app-card').count();
    const worktoonCardCount = await desktop.locator('#shelf [data-id="worktoon"]').count();
    mark(found === 1 && worktoonCardCount === 1 ? 'PASS' : 'FAIL', '搜索功能', JSON.stringify({ matches: found, worktoonCardCount }));
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
    await desktop.locator('#contact .contact-section-head').scrollIntoViewIfNeeded();
    await desktop.waitForTimeout(900);
    await desktop.locator('#contact h2').waitFor({ state: 'visible', timeout: 5000 });
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
    
    // Visual DNA Motion Lab: verify the public mobile workspace, JSON export, and poster editor.
    const motionLabMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const motionLabErrors = [];
    motionLabMobile.on('pageerror', e => motionLabErrors.push(e.message));
    const motionLabResponse = await motionLabMobile.goto(base + 'motion-lab/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await motionLabMobile.locator('#labTitle').waitFor({ timeout: 20000 });
    await motionLabMobile.waitForFunction(() => {
      const field = document.querySelector('#motionConfig');
      if (!field || !field.value.trim()) return false;
      try { return JSON.parse(field.value).schema === 'davylab.visual-dna-motion/v1'; } catch (_) { return false; }
    }, null, { timeout: 10000 });
    const motionLabMetrics = await motionLabMobile.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
      title: document.title,
      posterLink: !!document.querySelector('a[href="./motion-poster.html"]')
    }));
    mark(motionLabResponse && motionLabResponse.status() < 400 ? 'PASS' : 'FAIL', 'Motion Lab 手机端页面加载', 'HTTP ' + (motionLabResponse && motionLabResponse.status()));
    mark(motionLabMetrics.document <= motionLabMetrics.width + 2 ? 'PASS' : 'FAIL', 'Motion Lab 手机端无横向溢出', JSON.stringify(motionLabMetrics));
    mark(motionLabMetrics.posterLink ? 'PASS' : 'FAIL', 'Motion Lab 动态海报入口', motionLabMetrics.posterLink ? '入口可见' : '入口缺失');
    const motionDownloadPromise = motionLabMobile.waitForEvent('download', { timeout: 10000 });
    await motionLabMobile.locator('#downloadMotionConfig').click();
    const motionDownload = await motionDownloadPromise;
    mark(motionDownload.suggestedFilename().endsWith('.json') ? 'PASS' : 'FAIL', 'Motion Lab JSON 配置导出', motionDownload.suggestedFilename());
    mark(motionLabErrors.length === 0 ? 'PASS' : 'FAIL', 'Motion Lab 手机端 JavaScript 异常', motionLabErrors.length ? JSON.stringify(motionLabErrors) : '未发现 pageerror');
    await motionLabMobile.close();

    const posterMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const posterErrors = [];
    posterMobile.on('pageerror', e => posterErrors.push(e.message));
    const posterResponse = await posterMobile.goto(base + 'motion-lab/motion-poster.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await posterMobile.locator('#poster').waitFor({ timeout: 15000 });
    const posterMetrics = await posterMobile.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
      title: document.title,
      hasTitleInput: !!document.querySelector('#titleInput'),
      hasPngExport: !!document.querySelector('#exportPng')
    }));
    mark(posterResponse && posterResponse.status() < 400 ? 'PASS' : 'FAIL', 'Motion Poster 手机端页面加载', 'HTTP ' + (posterResponse && posterResponse.status()));
    mark(posterMetrics.document <= posterMetrics.width + 2 ? 'PASS' : 'FAIL', 'Motion Poster 手机端无横向溢出', JSON.stringify(posterMetrics));
    mark(posterMetrics.hasTitleInput && posterMetrics.hasPngExport ? 'PASS' : 'FAIL', 'Motion Poster 编辑与 PNG 导出控件', JSON.stringify(posterMetrics));
    mark(posterErrors.length === 0 ? 'PASS' : 'FAIL', 'Motion Poster 手机端 JavaScript 异常', posterErrors.length ? JSON.stringify(posterErrors) : '未发现 pageerror');
    await posterMobile.close();


    const targets = [
      ['念头盒', 'https://chenzhe223-tech.github.io/niantou-box-app/'],
      ['念头盒品牌站', 'https://chenzhe223-tech.github.io/niantou-box/'],
      ['Worktoon', 'https://worktoon.app.workbuddy.host/'],
      ['拼音星球', 'https://chenzhe223-tech.github.io/pinyin-planet/'],
      ['暖间地图', 'https://warm-room-map.pages.dev/'],
      ['物遇官网', 'https://chenzhe223-tech.github.io/wuyu-brand-site/'],
      ['物遇商家工作台', 'https://chenzhe223-tech.github.io/wuyu-brand-site/merchant/'],
      ['随调轻应用', 'https://chenzhe223-tech.github.io/SipSpark/app.html'],
      ['随调品牌站', 'https://chenzhe223-tech.github.io/SipSpark/'],
      ['音乐人生地图 MelodyMe', 'https://chenzhe223-tech.github.io/melodyme/'],
      ['Dashboard Studio 正式入口', 'https://dashboard-studio-1dp.pages.dev/'],
      ['Dashboard Studio Graphify 页面', 'https://dashboard-studio-1dp.pages.dev/graphify-studio.html'],
      ['Graphify API health', 'https://graphify-studio-api.onrender.com/health', false],
      ['DAVYLAB Learning Universe 生产版', 'https://davylab-learning-universe.pages.dev/'],
      ['Learning Universe 3D 分支预览', 'https://feat-teardown-3d-simulation.davylab-learning-universe.pages.dev/'],
      ['DAVYLAB AI Brief', 'https://chenzhe223-tech.github.io/radar/daily/'],
      ['公众号选题工作台', 'https://chenzhe223-tech.github.io/topic-studio/'],
      ['DAVYLAB DesignOS', 'https://davylab-designos.pages.dev/'],
      ['Visual DNA Motion Lab', 'https://chenzhe223-tech.github.io/motion-lab/'],
      ['Motion Poster Studio', 'https://chenzhe223-tech.github.io/motion-lab/motion-poster.html'],
      ['Motion Lab App Motion Kit', 'https://chenzhe223-tech.github.io/motion-lab/app-motion-kit.html'],
      ['Motion Lab Integration Guide', 'https://chenzhe223-tech.github.io/motion-lab/integration-guide.html'],
      ['DAVYLAB DesignOS 源码仓库', 'https://github.com/chenzhe223-tech/davylab-designos'],
      ['TrustLoop 源码仓库', 'https://github.com/chenzhe223-tech/davy-lab-trustloop'],
      ['付款填报助手源码仓库', 'https://github.com/chenzhe223-tech/payment-apply-agent'],
      ['山姆全球购工具', 'https://chenzhe223-tech.github.io/sam-global-buy/'],
      ['山姆数据导入', 'https://chenzhe223-tech.github.io/sam-global-buy/sam-app-import.html']
    ];
    const request = await require('playwright').request.newContext({ timeout: 25000 });
    const links = await Promise.all(targets.map(async ([name, url, required = true]) => {
      try {
        const r = await request.get(url, { maxRedirects: 5, timeout: required ? 25000 : 10000 });
        const ok = r.status() >= 200 && r.status() < 400;
        mark(ok ? 'PASS' : required ? 'FAIL' : 'WARN', '产品入口 · ' + name, 'HTTP ' + r.status() + ' · ' + r.url());
        return { name, url, status: r.status(), ok, required };
      } catch (e) {
        mark(required ? 'FAIL' : 'WARN', '产品入口 · ' + name, e.message);
        return { name, url, ok: false, required, error: e.message };
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
      // Isolate KeyPocket QA from any prior browser storage; never touch a user's existing vault.
      const kpContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const kp = await kpContext.newPage();
      const kpErrors = [];
      const kpConsoleErrors = [];
      let kpRadarResponse = null;
      kp.on('response', response => {
        try {
          const url = new URL(response.url());
          if (url.pathname === '/keypocket/api/skill-radar.json') kpRadarResponse = { status: response.status(), contentType: response.headers()['content-type'] || '' };
        } catch {}
      });
      kp.on('pageerror', e => kpErrors.push(e.message));
      kp.on('console', message => { if (message.type() === 'error') kpConsoleErrors.push(message.text()); });
      const kpResp = await kp.goto(base + 'keypocket/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      mark(kpResp && kpResp.status() < 400 ? 'PASS' : 'FAIL', 'KeyPocket 页面可打开', 'HTTP ' + (kpResp && kpResp.status()));
      await kp.waitForSelector('#unlockForm', { timeout: 10000 });
      const csp = await kp.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      mark(csp && csp.includes("connect-src 'self'") && csp.includes('https://api.github.com') ? 'PASS' : 'FAIL', 'KeyPocket 同源 Radar / GitHub / Supabase CSP', csp || 'CSP missing');
      // The browser context above is isolated. Wait for app initialization and branch
      // according to actual UI state instead of assuming first-run setup every time.
      try {
        await kp.waitForFunction(() => {
          const state = window.__kpInitDiagnostic;
          return state === 'ready' || state === 'unsupported'
            || state === 'vault-meta-missing-with-data'
            || String(state || '').startsWith('error:');
        }, null, { timeout: 20000 });
      } catch (error) {
        const initDiagnostics = await kp.evaluate(() => ({
          readyState: document.readyState,
          initFunction: typeof window.init,
          initDiagnostic: window.__kpInitDiagnostic,
          lockTitle: document.querySelector('#lockTitle')?.textContent,
          lockDesc: document.querySelector('#lockDesc')?.textContent,
          unlockButton: document.querySelector('#unlockBtn')?.textContent,
          confirmWrapClass: document.querySelector('#confirmWrap')?.className,
          scriptResources: performance.getEntriesByType('resource')
            .filter(item => item.name.includes('/keypocket/app.js'))
            .map(item => ({ name: item.name, duration: item.duration, transferSize: item.transferSize }))
        }));
        throw new Error('KeyPocket init diagnostics=' + JSON.stringify({ initDiagnostics, kpErrors, kpConsoleErrors }) + '; ' + error.message);
      }
      const initState = await kp.evaluate(() => ({
        state: window.__kpInitDiagnostic,
        title: document.querySelector('#lockTitle')?.textContent,
        button: document.querySelector('#unlockBtn')?.textContent,
        confirmVisible: !document.querySelector('#confirmWrap')?.classList.contains('hidden')
      }));
      mark(initState.state === 'ready' ? 'PASS' : 'FAIL', 'KeyPocket IndexedDB 初始化', JSON.stringify(initState));
      if (initState.state !== 'ready') throw new Error('KeyPocket initialization did not reach ready state: ' + JSON.stringify(initState));
      const firstRun = await kp.locator('#confirmWrap').evaluate(el => !el.classList.contains('hidden'));
      if (!firstRun) {
        // Do not guess a user's password. A non-empty isolated vault is a test fixture issue,
        // not permission to reset data; report it clearly rather than timing out.
        throw new Error('QA context unexpectedly contains an existing vault; first-run setup cannot be tested safely.');
      }
      await kp.locator('#masterPassword').fill('QA-only-demo-password-2026');
      await kp.locator('#confirmPassword').waitFor({ state: 'visible', timeout: 5000 });
      await kp.locator('#confirmPassword').fill('QA-only-demo-password-2026');
      await kp.locator('#unlockBtn').click();
      await kp.waitForSelector('#mainView:not(.hidden)', { timeout: 10000 });
      await kp.waitForFunction(() => window.__kpUnlockStep === 'complete' || !!window.__kpUnlockError, null, { timeout: 20000 });
      const initialUnlockState = await kp.evaluate(() => ({
        step: window.__kpUnlockStep || null,
        error: window.__kpUnlockError || null
      }));
      if (initialUnlockState.error) throw new Error('KeyPocket first-run setup did not complete: ' + JSON.stringify(initialUnlockState));

      // Visual & Motion Studio: exercise real controls in an isolated synthetic vault.
      await kp.locator('#settingsBtn').click();
      await kp.locator('#visualSettingsBtn').click();
      await kp.waitForSelector('#kpVisualContent', { timeout: 5000 });
      const visualTabs = await kp.locator('[data-vtab]').count();
      await kp.locator('[data-vgroup="theme"][data-vvalue="mint"]').click();
      const mintAccent = await kp.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kp-user-accent').trim());
      await kp.locator('[data-vtab="motion"]').click();
      await kp.locator('[data-vgroup="motion"][data-vvalue="glow"]').click();
      await kp.locator('#kpSpeed').fill('650');
      await kp.locator('#kpAmplitude').fill('18');
      await kp.locator('#kpDirection').selectOption('right');
      await kp.locator('[data-vtab="layout"]').click();
      await kp.locator('[data-vgroup="layout"][data-vvalue="bento"]').click();
      await kp.locator('#kpNav').count().then(() => {});
      await kp.locator('[data-vgroup="nav"][data-vvalue="bottom"]').click();
      const visualState = await kp.evaluate(() => ({
        prefs: JSON.parse(localStorage.getItem('kp.visual.preferences.v1') || 'null'),
        accent: getComputedStyle(document.documentElement).getPropertyValue('--kp-user-accent').trim(),
        motion: document.body.classList.contains('kp-motion-glow'),
        layout: document.body.classList.contains('kp-layout-bento'),
        nav: document.body.classList.contains('kp-nav-bottom')
      }));
      const visualPassed = visualTabs === 3 && visualState.prefs?.theme === 'mint'
        && visualState.prefs?.motion === 'glow' && visualState.prefs?.speed === 650
        && visualState.prefs?.amplitude === 18 && visualState.prefs?.direction === 'right'
        && visualState.prefs?.layout === 'bento' && visualState.prefs?.nav === 'bottom'
        && visualState.motion && visualState.layout && visualState.nav && visualState.accent === mintAccent;
      mark(visualPassed ? 'PASS' : 'FAIL', 'KeyPocket 视觉与动效设置实时应用及本地持久化', JSON.stringify(visualState));
      await kp.locator('#kpVisualReset').click();
      const visualReset = await kp.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('kp.visual.preferences.v1') || 'null');
        return p?.theme === 'qore' && p?.motion === 'rise' && p?.layout === 'balanced' && p?.nav === 'top';
      });
      mark(visualReset ? 'PASS' : 'FAIL', 'KeyPocket 视觉设置独立恢复默认', '恢复 QORE / 上浮 / Balanced / 顶部导航');
      await kp.locator('#modalRoot [data-action="close"]').click();
      await kp.waitForFunction(() => !document.querySelector('#modalRoot .modal-backdrop'), null, { timeout: 5000 });
      // Skill import regression: mocked GitHub results exercise the real save UI and encrypted local persistence.
      await kp.route('https://api.github.com/search/repositories**', async route => {
        const repo = {
          id: 990001, name: 'geo-sleuth', full_name: 'aibrahamdrbaa-dot/geo-sleuth',
          html_url: 'https://github.com/aibrahamdrbaa-dot/geo-sleuth',
          description: 'Independent copy of Oldcircle/geo-sleuth — agent skill for photo geolocation.',
          owner: { login: 'aibrahamdrbaa-dot', type: 'User' }, private: false, disabled: false,
          fork: true, stargazers_count: 11, forks_count: 1, pushed_at: '2026-10-07T00:00:00Z',
          language: 'Python', homepage: null, topics: ['agent', 'geolocation']
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_count: 1, incomplete_results: false, items: [repo] }) });
      });
      let kpOwnRepoScanCalls = 0;
      await kp.route('https://api.github.com/users/chenzhe223-tech/repos**', async route => {
        kpOwnRepoScanCalls++;
        const repos = [
          { id: 990101, name: 'qa-auto-scan-app', full_name: 'chenzhe223-tech/qa-auto-scan-app', html_url: 'https://github.com/chenzhe223-tech/qa-auto-scan-app', description: 'QA fixture web application', owner: { login: 'chenzhe223-tech' }, private: false, fork: false, archived: false, disabled: false, language: 'JavaScript', homepage: 'https://example.test/qa-app', topics: ['web-app','qa-fixture'] },
          { id: 990102, name: 'qa-auto-scan-skill', full_name: 'chenzhe223-tech/qa-auto-scan-skill', html_url: 'https://github.com/chenzhe223-tech/qa-auto-scan-skill', description: 'QA fixture Claude agent skill', owner: { login: 'chenzhe223-tech' }, private: false, fork: false, archived: false, disabled: false, language: 'Markdown', homepage: null, topics: ['agent-skills','qa-fixture'] },
          { id: 990103, name: 'qa-fork-ignore', full_name: 'chenzhe223-tech/qa-fork-ignore', html_url: 'https://github.com/chenzhe223-tech/qa-fork-ignore', description: 'Must be ignored', owner: { login: 'chenzhe223-tech' }, private: false, fork: true, archived: false, disabled: false, language: 'JavaScript', topics: [] }
        ];
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(repos) });
      });
      await kp.locator('[data-module="projects"]').click();
      await kp.locator('.project-tools-menu').evaluate(el => { el.open = true; });
      await kp.locator('#importSkillBtn').click();
      await kp.waitForSelector('#skillSearchForm', { timeout: 5000 });
      await kp.locator('#skillNameInput').fill('geo-sleuth');
      await kp.locator('#skillSearchForm button[type="submit"]').click();
      await kp.waitForSelector('#skillSearchResults [data-save-skill]', { timeout: 8000 });
      await kp.locator('#skillSearchResults [data-save-skill]').first().click();
      try {
        await kp.waitForFunction(() => !document.querySelector('#modalRoot .modal-backdrop')
          && (document.querySelector('#projectCards')?.innerText || '').includes('geo-sleuth · Skill'), null, { timeout: 10000 });
      } catch (error) {
        const state = await kp.evaluate(() => ({
          status: document.querySelector('#skillSearchStatus')?.textContent || '',
          saveButton: document.querySelector('#skillSearchResults [data-save-skill]')?.textContent || '',
          modalOpen: !!document.querySelector('#modalRoot .modal-backdrop'),
          modalText: document.querySelector('#modalRoot .modal')?.innerText || '',
          projectText: document.querySelector('#projectCards')?.innerText || '',
          unlockStep: window.__kpUnlockStep || null,
          projectRendererReady: window.__kpProjectRendererReady === true
        }));
        throw new Error('Skill collect diagnostic=' + JSON.stringify(state) + '; ' + error.message);
      }
      const skillImportPassed = await kp.locator('#projectCards').innerText().then(text => text.includes('geo-sleuth · Skill'));
      mark(skillImportPassed ? 'PASS' : 'FAIL', 'KeyPocket GitHub Skill 搜索结果一键加密收录',
        'mock GitHub 搜索 → 收录按钮 → 项目卡片显示；不触碰真实用户数据');

      // Main project CTA must open the project editor without requiring search input.
      await kp.locator('#addProjectBtn').click();
      const projectCtaPassed = await kp.locator('#projectEditForm').count().then(n => n === 1);
      mark(projectCtaPassed ? 'PASS' : 'FAIL', 'KeyPocket 顶部「收录项目」按钮直接打开编辑窗口',
        '点击主 CTA → 项目编辑表单可见；无需先在搜索框输入内容');
      await kp.locator('#modalRoot [data-action="close"]').first().click();
      await kp.waitForFunction(() => !document.querySelector('#modalRoot .modal-backdrop'), null, { timeout: 5000 });

      await kp.waitForFunction(() => (document.querySelector('#githubAutoScanStatus')?.textContent || '').includes('扫描完成'), null, { timeout: 10000 });
      const autoScanText = await kp.locator('#githubAutoScanStatus').innerText();
      const autoScanApp = await kp.locator('#projectCards').innerText().then(t => t.includes('qa-auto-scan-app'));
      const autoScanSkill = await kp.locator('#projectCards').innerText().then(t => t.includes('qa-auto-scan-skill · Skill'));
      mark(autoScanApp && autoScanSkill ? 'PASS' : 'FAIL', 'KeyPocket 自动发现并加密收录自有 GitHub 应用与 Skill', autoScanText);
      const autoScanSkillCategory = await kp.locator('#projectCards').innerText().then(t => t.includes('Agent 与自动化'));
      mark(autoScanSkillCategory ? 'PASS' : 'FAIL', '自动扫描的自有 Skill 分类展示', 'Skill 标签与用途分类可见');
      const scanCountBefore = await kp.locator('#projectCards .kp-resource-row').filter({ hasText: 'qa-auto-scan-app' }).count();
      const settingsTiles = await kp.locator('#settingsView .settings-tile').count();
      const coreTabs = await kp.locator('.module-tabs[aria-label="核心功能"] .module-tab').count();
      mark(settingsTiles >= 6 && coreTabs === 3 ? 'PASS' : 'FAIL', 'KeyPocket 统一设置中心与精简核心导航', '设置入口 '+settingsTiles+' 项；核心导航 '+coreTabs+' 项');
      await kp.locator('.project-tools-menu').evaluate(el => { el.open = true; });
      await kp.locator('#scanOwnReposBtn').click();
      await kp.waitForFunction(() => (document.querySelector('#githubAutoScanStatus')?.textContent || '').includes('扫描完成'), null, { timeout: 10000 });
      const scanCountAfter = await kp.locator('#projectCards .kp-resource-row').filter({ hasText: 'qa-auto-scan-app' }).count();
      mark(scanCountBefore === 1 && scanCountAfter === 1 && kpOwnRepoScanCalls >= 2 ? 'PASS' : 'FAIL', 'KeyPocket GitHub 自动扫描去重', '重复扫描前后应用卡片数量：'+scanCountBefore+' → '+scanCountAfter);
      const threeBoxes = await kp.locator('#projectCards .kp-resource-box').count();
      const resourceRows = await kp.locator('#projectCards .kp-resource-row').count();
      mark(threeBoxes >= 3 && resourceRows >= 2 ? 'PASS' : 'FAIL', 'KeyPocket 三大资源盒与横条列表布局', '资源盒数量 '+threeBoxes+'，横条记录 '+resourceRows);
      await kp.waitForFunction(() => document.querySelectorAll('#hotSkillGroups .kp-hot-domain').length === 9 || (document.querySelector('#hotSkillStatus')?.textContent || '').includes('更新失败'), null, { timeout: 15000 });
      const hotRows = await kp.locator('#hotSkillGroups .kp-hot-domain').count();
      const hotMinimum = await kp.locator('#hotSkillGroups .kp-hot-domain').evaluateAll(nodes => nodes.every(n => n.querySelectorAll('.kp-hot-row').length >= 5));
      mark(hotRows === 9 && hotMinimum ? 'PASS' : 'FAIL', '热门 Skill 九大领域每类至少五项', '领域数 '+hotRows+'；每领域至少五项：'+hotMinimum);



      // Skill Radar fetches a same-origin static JSON API. Its CSP must explicitly allow 'self'.
      await kp.locator('[data-module="radar"]').click();
      await kp.waitForSelector('#radarView:not(.hidden)', { timeout: 5000 });
      await kp.waitForFunction(() => (document.querySelector('#radarMeta')?.innerText || '').includes('数据更新：')
        || (document.querySelector('#radarMeta')?.innerText || '').includes('暂不可用'), null, { timeout: 8000 });
      const radarMetaText = await kp.locator('#radarMeta').innerText();
      await kp.locator('[data-radar-period="all"]').click();
      await kp.waitForFunction(() => document.querySelectorAll('#radarCards .card').length > 0, null, { timeout: 8000 });
      const radarCardCount = await kp.locator('#radarCards .card').count();
      const radarFetchPassed = kpRadarResponse?.status === 200
        && radarMetaText.includes('数据更新：')
        && !radarMetaText.includes('Failed to fetch')
        && radarCardCount > 0;
      mark(radarFetchPassed ? 'PASS' : 'FAIL', 'KeyPocket Skill Radar 同源 JSON 加载', JSON.stringify({ response: kpRadarResponse, meta: radarMetaText, allTimeCards: radarCardCount }));
      if (!radarFetchPassed) throw new Error('Skill Radar same-origin API did not load: ' + JSON.stringify({ response: kpRadarResponse, meta: radarMetaText, allTimeCards: radarCardCount }));
      // GitHub App is intentionally unavailable until its OAuth Worker and secrets are configured.
      await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="github"]').click();
      await kp.waitForSelector('#githubView:not(.hidden)', { timeout: 5000 });
      const githubStatus = await kp.locator('#githubAccountStatus').innerText();
      const githubConnectDisabled = await kp.locator('#githubConnectBtn').isDisabled();
      mark(githubConnectDisabled && githubStatus.includes('Worker') && githubStatus.includes('尚未启用') ? 'PASS' : 'FAIL',
        'KeyPocket GitHub App 未配置状态如实提示', '连接按钮禁用，清楚说明 OAuth Worker/Secrets 前置条件');
      await kp.locator('[data-module="keys"]').click();
      // Regression: adding multiple provider keys must remain available when the vault is non-empty.
      const addKeyButton = kp.locator('#addKeyBtn');
      mark(await addKeyButton.count() === 1 && await addKeyButton.isVisible() ? 'PASS' : 'FAIL', 'KeyPocket 始终可见的新增 API Key 入口', '新增按钮必须在已有记录前后均可访问');
      await addKeyButton.click();
      await kp.waitForSelector('#recordForm', { timeout: 5000 });
      await kp.locator('#keyInput').fill('qa-synthetic-deepseek-key-not-real-001');
      await kp.locator('#providerInput').selectOption('deepseek').catch(async () => {
        await kp.locator('#providerInput').selectOption('custom');
      });
      await kp.locator('#nameInput').fill('QA Synthetic DeepSeek Key');
      await kp.locator('#purposeInput').fill('Browser QA only');
      await kp.locator('#recordForm button[type="submit"]').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '1', null, { timeout: 5000 });
      mark('PASS', 'KeyPocket 新增首个 API Key', await kp.locator('#totalCount').innerText() + ' 条');
      await addKeyButton.click();
      await kp.waitForSelector('#recordForm', { timeout: 5000 });
      await kp.locator('#keyInput').fill('qa-synthetic-openai-key-not-real-002');
      await kp.locator('#providerInput').selectOption('openai');
      await kp.locator('#nameInput').fill('QA Synthetic OpenAI Key');
      await kp.locator('#purposeInput').fill('Second provider test');
      await kp.locator('#recordForm button[type="submit"]').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '2', null, { timeout: 5000 });
      const keyCardText = await kp.locator('#cards').innerText();
      mark(keyCardText.includes('QA Synthetic DeepSeek Key') && keyCardText.includes('QA Synthetic OpenAI Key') ? 'PASS' : 'FAIL', 'KeyPocket 多平台 API Key 分别保存与展示', keyCardText.slice(0, 500));
      await kp.reload({ waitUntil: 'domcontentloaded' });
      await kp.waitForFunction(() => window.__kpInitDiagnostic === 'ready'
        && document.querySelector('#unlockBtn')?.textContent.trim() === '解锁密钥库', null, { timeout: 20000 });
      await kp.locator('#masterPassword').fill('QA-only-demo-password-2026');
      await kp.locator('#unlockBtn').click();
      // Wait for the actual unlock flow to settle, then surface crypto/snapshot errors
      // instead of reporting only a generic hidden-main-view timeout.
      try {
        await kp.waitForFunction(() => window.__kpUnlockStep === 'complete' || !!window.__kpUnlockError, null, { timeout: 20000 });
      } catch (unlockWaitError) {
        const diagnostics = await kp.evaluate(async () => {
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('keypocket-local-v1');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const rows = await new Promise((resolve, reject) => {
            const req = db.transaction('vault', 'readonly').objectStore('vault').getAll();
            req.onsuccess = () => { db.close(); resolve(req.result); };
            req.onerror = () => { db.close(); reject(req.error); };
          });
          return {
            initDiagnostic: window.__kpInitDiagnostic,
            unlockStep: window.__kpUnlockStep || null,
            unlockError: window.__kpUnlockError || null,
            lockNotice: document.querySelector('#lockNotice')?.textContent || '',
            backupStatus: document.querySelector('#backupStatus')?.textContent || '',
            mainVisible: !document.querySelector('#mainView')?.classList.contains('hidden'),
            recordCount: rows.filter(x => x.id !== 'vault-meta' && !String(x.id || '').startsWith('kp.')).length,
            vaultMetaPresent: rows.some(x => x.id === 'vault-meta'),
            vaultMetaShape: (() => {
              const meta = rows.find(x => x.id === 'vault-meta');
              const describe = value => {
                const isString = typeof value === 'string';
                const base64 = isString && value.length > 0
                  && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
                let decodedLength = null;
                if (base64) { try { decodedLength = atob(value).length; } catch {} }
                return { type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
                  length: isString ? value.length : null, base64, decodedLength };
              };
              return meta ? {
                salt: describe(meta.salt),
                verifier: {
                  type: meta.verifier === null ? 'null' : typeof meta.verifier,
                  iv: describe(meta.verifier?.iv),
                  data: describe(meta.verifier?.data)
                },
                iterations: meta.iterations
              } : null;
            })(),
            recordEnvelopeShape: rows.filter(x => x.id !== 'vault-meta' && !String(x.id || '').startsWith('kp.'))
              .slice(0, 5).map(x => ({
                idType: typeof x.id, kind: typeof x.kind,
                ivType: typeof x.iv, ivLength: typeof x.iv === 'string' ? x.iv.length : null,
                dataType: typeof x.data, dataLength: typeof x.data === 'string' ? x.data.length : null
              }))
          };
        });
        throw new Error('KeyPocket reload unlock did not settle: ' + JSON.stringify(diagnostics) + '; ' + unlockWaitError.message);
      }
      const unlockDiagnostics = await kp.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open('keypocket-local-v1');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const rows = await new Promise((resolve, reject) => {
          const req = db.transaction('vault', 'readonly').objectStore('vault').getAll();
          req.onsuccess = () => { db.close(); resolve(req.result); };
          req.onerror = () => { db.close(); reject(req.error); };
        });
        const describe = value => {
          const isString = typeof value === 'string';
          const base64 = isString && value.length > 0
            && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
          let decodedLength = null;
          if (base64) { try { decodedLength = atob(value).length; } catch {} }
          return { type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
            length: isString ? value.length : null, base64, decodedLength };
        };
        const meta = rows.find(x => x.id === 'vault-meta');
        return {
          unlockStep: window.__kpUnlockStep || null,
          unlockError: window.__kpUnlockError || null,
          lockNotice: document.querySelector('#lockNotice')?.textContent || '',
          mainVisible: !document.querySelector('#mainView')?.classList.contains('hidden'),
          vaultMetaShape: meta ? {
            salt: describe(meta.salt),
            verifier: {
              type: meta.verifier === null ? 'null' : typeof meta.verifier,
              iv: describe(meta.verifier?.iv),
              data: describe(meta.verifier?.data)
            },
            iterations: meta.iterations
          } : null,
          recordEnvelopeShape: rows.filter(x => x.id !== 'vault-meta' && !String(x.id || '').startsWith('kp.'))
            .slice(0, 5).map(x => ({
              kind: typeof x.kind,
              iv: describe(x.iv), data: describe(x.data)
            })),
          supportItems: {
            metadata: rows.filter(x => String(x.id || '').startsWith('kp.meta.')).length,
            snapshots: rows.filter(x => String(x.id || '').startsWith('kp.snapshot.')).length,
            tombstones: rows.filter(x => String(x.id || '').startsWith('kp.tombstone.')).length
          }
        };
      });
      if (unlockDiagnostics.unlockError) throw new Error('KeyPocket reload unlock failed: ' + JSON.stringify(unlockDiagnostics));
      await kp.waitForSelector('#mainView:not(.hidden)', { timeout: 10000 });
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '2', null, { timeout: 5000 });
      const supportItemsPresent = unlockDiagnostics.supportItems.metadata > 0 && unlockDiagnostics.supportItems.snapshots > 0;
      mark(supportItemsPresent ? 'PASS' : 'FAIL', 'KeyPocket 自动备份元数据与 API Key 解锁隔离',
        'Key 数量=2；备份元数据=' + unlockDiagnostics.supportItems.metadata + '；加密快照=' + unlockDiagnostics.supportItems.snapshots);
      mark('PASS', 'KeyPocket 多个 API Key 本地加密持久化', await kp.locator('#totalCount').innerText() + ' 条解锁后记录');
      // Add a third independent custom-provider key and verify the earlier records remain intact.
      await kp.locator('#addKeyBtn').click();
      await kp.waitForSelector('#recordForm', { timeout: 5000 });
      await kp.locator('#keyInput').fill('qa-synthetic-custom-key-not-real-003');
      await kp.locator('#providerInput').selectOption('custom');
      await kp.locator('#nameInput').fill('QA Synthetic Custom Key');
      await kp.locator('#purposeInput').fill('Third independent record');
      await kp.locator('#projectInput').fill('QA isolation');
      await kp.locator('#tagsInput').fill('qa, custom, third');
      await kp.locator('#notesInput').fill('synthetic only');
      await kp.locator('#recordForm button[type="submit"]').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '3', null, { timeout: 5000 });
      let cardsText = await kp.locator('#cards').innerText();
      mark(cardsText.includes('QA Synthetic DeepSeek Key') && cardsText.includes('QA Synthetic OpenAI Key') && cardsText.includes('QA Synthetic Custom Key') ? 'PASS' : 'FAIL', 'KeyPocket 第三条记录不覆盖已有密钥', cardsText.slice(0, 450));
      // Search and provider filter must preserve accurate visible counts.
      await kp.locator('#searchInput').fill('QA Synthetic OpenAI Key');
      await kp.waitForFunction(() => document.querySelector('#listCount')?.textContent.includes('1 条'), null, { timeout: 3000 });
      mark('PASS', 'KeyPocket 多密钥搜索', await kp.locator('#listCount').innerText());
      await kp.locator('#searchInput').fill('');
      await kp.locator('#providerFilter').selectOption('custom');
      await kp.waitForFunction(() => document.querySelector('#listCount')?.textContent.includes('1 条'), null, { timeout: 3000 });
      mark('PASS', 'KeyPocket 服务商筛选', await kp.locator('#listCount').innerText());
      await kp.locator('#providerFilter').selectOption('');
      // Edit only the third record; the two existing records must remain.
      const customCard = kp.locator('#cards .card').filter({ hasText: 'QA Synthetic Custom Key' });
      await customCard.locator('[data-action="edit"]').click();
      await kp.waitForSelector('#recordForm', { timeout: 5000 });
      await kp.locator('#nameInput').fill('QA Synthetic Custom Key Edited');
      await kp.locator('#recordForm button[type="submit"]').click();
      await kp.waitForFunction(() => document.querySelector('#cards')?.innerText.includes('QA Synthetic Custom Key Edited'), null, { timeout: 5000 });
      cardsText = await kp.locator('#cards').innerText();
      mark(cardsText.includes('QA Synthetic DeepSeek Key') && cardsText.includes('QA Synthetic OpenAI Key') && cardsText.includes('QA Synthetic Custom Key Edited') ? 'PASS' : 'FAIL', 'KeyPocket 单条编辑不影响其他记录', cardsText.slice(0, 450));
      // Export backup through the real UI and verify payload is encrypted; no plaintext keys in the file.
      const downloadPromise = kp.waitForEvent('download');
      await kp.locator('#settingsBtn').click();
      await kp.locator('#exportBtn').click();
      await kp.waitForSelector('#exportForm', { timeout: 5000 });
      await kp.locator('#backupPassword').fill('QA-only-backup-password-2026');
      await kp.locator('#backupConfirm').fill('QA-only-backup-password-2026');
      await kp.locator('#exportForm button[type="submit"]').click();
      const backupDownload = await downloadPromise;
      const backupPath = await backupDownload.path();
      const backupRaw = JSON.parse(require('fs').readFileSync(backupPath, 'utf8'));
      const backupHasNoPlaintext = !JSON.stringify(backupRaw).includes('qa-synthetic-');
      mark(backupRaw.app === 'KeyPocket' && backupRaw.cipher?.name === 'AES-256-GCM' && backupHasNoPlaintext ? 'PASS' : 'FAIL', 'KeyPocket 多记录加密备份导出', '加密文件结构有效；未发现明文测试密钥');
      await kp.locator('[data-module="keys"]').click();
      // Restore the encrypted backup into a fresh, isolated browser context to verify compatibility.
      const restoreKp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const restoreErrors = [];
      restoreKp.on('pageerror', e => restoreErrors.push(e.message));
      await restoreKp.goto(base + 'keypocket/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await restoreKp.waitForFunction(() => window.__kpInitDiagnostic === 'ready'
        && !document.querySelector('#confirmWrap')?.classList.contains('hidden'), null, { timeout: 20000 });
      await restoreKp.locator('#masterPassword').fill('QA-only-restore-password-2026');
      await restoreKp.locator('#confirmPassword').fill('QA-only-restore-password-2026');
      await restoreKp.locator('#unlockBtn').click();
      await restoreKp.waitForSelector('#mainView:not(.hidden)', { timeout: 10000 });
      await restoreKp.locator('#settingsBtn').click();
      await restoreKp.locator('#importBtn').click();
      await restoreKp.locator('#backupFile').setInputFiles(backupPath);
      await restoreKp.waitForSelector('#importForm', { timeout: 5000 });
      await restoreKp.locator('#importPassword').fill('QA-only-backup-password-2026');
      await restoreKp.locator('#importMode').selectOption('replace');
      await restoreKp.locator('#importForm button[type="submit"]').click();
      await restoreKp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '3', null, { timeout: 10000 });
      const restoredNames = await restoreKp.locator('#cards').innerText();
      const restorePassed = restoredNames.includes('QA Synthetic DeepSeek Key') && restoredNames.includes('QA Synthetic OpenAI Key') && restoredNames.includes('QA Synthetic Custom Key Edited');
      mark(restorePassed && restoreErrors.length === 0 ? 'PASS' : 'FAIL', 'KeyPocket 加密备份恢复与旧格式兼容', '恢复后记录数=' + await restoreKp.locator('#totalCount').innerText() + '；仅核对合成测试记录名称');
      await restoreKp.close();
      // Exercise favourite, clipboard action, and deletion without exposing key material in the report.
      const openAiCard = kp.locator('#cards .card').filter({ hasText: 'QA Synthetic OpenAI Key' });
      await openAiCard.locator('[data-action="favorite"]').click();
      await kp.waitForFunction(() => [...document.querySelectorAll('#cards .card')].some(el => el.innerText.includes('QA Synthetic OpenAI Key') && el.innerText.includes('取消收藏')), null, { timeout: 5000 });
      mark('PASS', 'KeyPocket 收藏切换', '指定记录已收藏');
      try {
        await kp.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://chenzhe223-tech.github.io' });
        await kp.locator('#cards .card').filter({ hasText: 'QA Synthetic DeepSeek Key' }).locator('[data-action="copy"]').click();
        await kp.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('已复制完整 Key'), null, { timeout: 3000 });
        mark('PASS', 'KeyPocket 复制操作', '剪贴板操作成功；未读取或记录剪贴板内容');
      } catch {
        // Browsers can disable clipboard APIs; the visible fallback is an accepted safe path.
        const fallbackVisible = await kp.locator('#modalRoot .modal').count() > 0;
        mark(fallbackVisible ? 'PASS' : 'FAIL', 'KeyPocket 复制操作', '权限受限时显示手动复制回退窗口');
        await kp.locator('#modalRoot [data-action="close"]').click().catch(() => {});
      }
      const deleteCard = kp.locator('#cards .card').filter({ hasText: 'QA Synthetic Custom Key Edited' });
      await deleteCard.locator('[data-action="menu"]').click();
      await kp.waitForSelector('#modalRoot [data-action="delete"]', { timeout: 5000 });
      kp.once('dialog', dialog => dialog.accept());
      await kp.locator('#modalRoot [data-action="delete"]').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '2', null, { timeout: 5000 });
      mark('PASS', 'KeyPocket 单条删除与统计更新', '删除测试记录后仍保留另外两条密钥');

      // Delete a second synthetic API Key and verify both tombstones can be batch-restored.
      const secondDeleteCard = kp.locator('#cards .card').filter({ hasText: 'QA Synthetic OpenAI Key' });
      await secondDeleteCard.locator('[data-action="menu"]').click();
      await kp.waitForSelector('#modalRoot [data-action="delete"]', { timeout: 5000 });
      kp.once('dialog', dialog => dialog.accept());
      await kp.locator('#modalRoot [data-action="delete"]').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '1', null, { timeout: 5000 });
      await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="recycle"]').click();
      await kp.waitForSelector('#recycleView:not(.hidden)', { timeout: 5000 });
      await kp.waitForFunction(() => document.querySelectorAll('#recycleCards [data-trash-restore]').length >= 2, null, { timeout: 5000 });
      const tombstoneIds = await kp.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open('keypocket-local-v1');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const rows = await new Promise((resolve, reject) => {
          const req = db.transaction('vault', 'readonly').objectStore('vault').getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        db.close();
        return rows.filter(row => String(row.id || '').startsWith('kp.tombstone.record:')).map(row => row.id);
      });
      mark(tombstoneIds.length >= 2 ? 'PASS' : 'FAIL', 'KeyPocket API Key 删除 tombstone', '仅检查合成数据的 tombstone 数量=' + tombstoneIds.length);
      await kp.locator('#restoreAllBtn').click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '3', null, { timeout: 10000 });
      const restoredKeyText = await kp.locator('#cards').innerText();
      mark(restoredKeyText.includes('QA Synthetic DeepSeek Key') && restoredKeyText.includes('QA Synthetic OpenAI Key') && restoredKeyText.includes('QA Synthetic Custom Key Edited') ? 'PASS' : 'FAIL', 'KeyPocket 回收站批量恢复', '恢复后保留三条合成 API Key');

      // Verify encrypted local snapshot creation and restoration through the real UI.
      await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="backup"]').click();
      await kp.waitForSelector('#backupView:not(.hidden)', { timeout: 5000 });
      const backupPolicyText = await kp.locator('#backupView').innerText();
      mark(backupPolicyText.includes('覆盖上一份') && backupPolicyText.includes('只保留一份最新完整备份') ? 'PASS' : 'FAIL',
        'KeyPocket 单份最新备份策略说明', '备份中心明确说明全量覆盖与单份保留');
      await kp.locator('#backupNowBtn').click();
      await kp.waitForFunction(() => document.querySelectorAll('#backupCards [data-snapshot-restore]').length > 0, null, { timeout: 10000 });
      const snapshotsBeforeRestore = await kp.locator('#backupCards [data-snapshot-restore]').count();
      const firstLatestBackupId = await kp.locator('#backupCards [data-snapshot-restore]').first().getAttribute('data-snapshot-restore');
      await kp.locator('#backupNowBtn').click();
      await kp.waitForFunction(() => document.querySelectorAll('#backupCards [data-snapshot-restore]').length === 1, null, { timeout: 10000 });
      const secondLatestBackupId = await kp.locator('#backupCards [data-snapshot-restore]').first().getAttribute('data-snapshot-restore');
      mark(snapshotsBeforeRestore === 1 && firstLatestBackupId === secondLatestBackupId ? 'PASS' : 'FAIL', 'KeyPocket 自动备份全量覆盖且仅保留一份', '重复更新前后备份数量='+snapshotsBeforeRestore+'→1；稳定备份 ID='+ (firstLatestBackupId === secondLatestBackupId));
      kp.once('dialog', dialog => dialog.accept());
      await kp.locator('#backupCards [data-snapshot-restore]').first().click();
      await kp.waitForFunction(() => document.querySelector('#totalCount')?.textContent === '3', null, { timeout: 10000 });
      mark(snapshotsBeforeRestore === 1 ? 'PASS' : 'FAIL', 'KeyPocket 最新本地加密备份恢复', '恢复后仍有三条合成 API Key');

      // On mobile, ensure the permanent add button remains visible and has no horizontal overflow.
      const mobileKp = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const mobileErrors = [];
      mobileKp.on('pageerror', e => mobileErrors.push(e.message));
      await mobileKp.goto(base + 'keypocket/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await mobileKp.waitForFunction(() => window.__kpInitDiagnostic === 'ready'
        && !document.querySelector('#confirmWrap')?.classList.contains('hidden'), null, { timeout: 20000 });
      await mobileKp.locator('#masterPassword').fill('QA-only-demo-password-2026');
      await mobileKp.locator('#confirmPassword').fill('QA-only-demo-password-2026');
      await mobileKp.locator('#unlockBtn').click();
      await mobileKp.waitForSelector('#mainView:not(.hidden)', { timeout: 10000 });

      await mobileKp.locator('#settingsBtn').click();
       await mobileKp.locator('#visualSettingsBtn').click();
      await mobileKp.waitForSelector('#kpVisualContent', { timeout: 5000 });
      const mobileVisual = await mobileKp.evaluate(() => ({
        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        tabs: document.querySelectorAll('[data-vtab]').length,
        menuVisible: !!document.querySelector('#modalRoot .kp-visual-panel')
      }));
      mark(mobileVisual.documentWidth <= mobileVisual.width && mobileVisual.tabs === 3 && mobileVisual.menuVisible
        ? 'PASS' : 'FAIL', 'KeyPocket 390px 手机端视觉设置面板布局', JSON.stringify(mobileVisual));
      await mobileKp.locator('#modalRoot [data-action="close"]').click();
      await mobileKp.waitForFunction(() => !document.querySelector('#modalRoot .modal-backdrop'), null, { timeout: 5000 });
       await mobileKp.locator('[data-module="keys"]').click();
      const addOnMobile = await mobileKp.locator('#addKeyBtn').isVisible();
      const mobileBounds = await mobileKp.evaluate(() => ({viewport: innerWidth, doc: document.documentElement.scrollWidth, buttonRight: document.querySelector('#addKeyBtn').getBoundingClientRect().right}));
      mark(addOnMobile && mobileBounds.doc <= mobileBounds.viewport && mobileBounds.buttonRight <= mobileBounds.viewport ? 'PASS' : 'FAIL', 'KeyPocket 手机端新增按钮与布局', JSON.stringify(mobileBounds));
       await mobileKp.locator('[data-module="projects"]').click();
       await mobileKp.waitForSelector('#projectView:not(.hidden)', { timeout: 5000 });
       const mobileProjectLayout = await mobileKp.evaluate(() => ({
         viewport: innerWidth, document: document.documentElement.scrollWidth,
         tabs: document.querySelectorAll('.module-tabs[aria-label="核心功能"] .module-tab').length,
         toolsCollapsed: !document.querySelector('.project-tools-menu')?.open,
         filterColumns: getComputedStyle(document.querySelector('.project-filters')).gridTemplateColumns
       }));
       mark(mobileProjectLayout.document <= mobileProjectLayout.viewport && mobileProjectLayout.tabs === 3 && mobileProjectLayout.toolsCollapsed
         ? 'PASS' : 'FAIL', 'KeyPocket 手机端项目页层级与操作区布局', JSON.stringify(mobileProjectLayout));
       await mobileKp.locator('#settingsBtn').click();
       const mobileSettings = await mobileKp.evaluate(() => ({
         visible: !document.querySelector('#settingsView')?.classList.contains('hidden'),
         width: innerWidth, document: document.documentElement.scrollWidth,
         tiles: document.querySelectorAll('#settingsView .settings-tile').length
       }));
       mark(mobileSettings.visible && mobileSettings.document <= mobileSettings.width && mobileSettings.tiles >= 6
         ? 'PASS' : 'FAIL', 'KeyPocket 手机端统一设置中心布局', JSON.stringify(mobileSettings));

      mark(mobileErrors.length === 0 ? 'PASS' : 'FAIL', 'KeyPocket 手机端 JavaScript 异常', mobileErrors.length ? JSON.stringify(mobileErrors) : '未发现 pageerror');
      await mobileKp.close();
      await kp.locator('[data-module="projects"]').click();
      await kp.waitForSelector('#projectView:not(.hidden)', { timeout: 5000 });
      const importButton = await kp.locator('#importGithubBtn').count();
      mark(importButton === 1 ? 'PASS' : 'FAIL', 'KeyPocket GitHub 导入入口', '按钮数量=' + importButton);
      if (importButton === 1) {
        await kp.locator('.project-tools-menu').evaluate(el => { el.open = true; });
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

          // Verify project soft-delete and restoration retain the original project ID.
          const importedProjectCard = kp.locator('#projectCards [data-project-id]').filter({ hasText: selectedRepoName }).first();
          const originalProjectId = await importedProjectCard.getAttribute('data-project-id');
          kp.once('dialog', dialog => dialog.accept());
          await importedProjectCard.locator('[data-project-action="delete"]').click();
          await kp.waitForFunction(name => !document.querySelector('#projectCards')?.innerText.includes(name), selectedRepoName, { timeout: 10000 });
          await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="recycle"]').click();
          await kp.waitForSelector('#recycleView:not(.hidden)', { timeout: 5000 });
          await kp.waitForFunction(() => document.querySelectorAll('#recycleCards [data-kind="project"][data-trash-restore]').length === 1, null, { timeout: 5000 });
          const restoreProjectButton = kp.locator('#recycleCards [data-kind="project"][data-trash-restore]').first();
          mark(await restoreProjectButton.count() === 1 ? 'PASS' : 'FAIL', 'KeyPocket 项目软删除进入回收站', '项目 tombstone 恢复入口存在');
          await restoreProjectButton.click();
          await kp.locator('[data-module="projects"]').click();
          await kp.waitForSelector('#projectView:not(.hidden)', { timeout: 5000 });
          const restoredProjectId = await kp.locator('#projectCards [data-project-id]').filter({ hasText: selectedRepoName }).first().getAttribute('data-project-id');
          mark(restoredProjectId === originalProjectId ? 'PASS' : 'FAIL', 'KeyPocket 项目恢复保留原 ID', '原 ID 与恢复 ID 一致=' + String(restoredProjectId === originalProjectId));
        }
      }
      // Mobile Skill search modal lifecycle: mock GitHub; never call live API or use real keys.
      const originalViewport = kp.viewportSize();
      await kp.setViewportSize({ width: 390, height: 844 });
      let skillSearchRequests = 0, exactSkillRepoRequests = 0;
      await kp.route('https://api.github.com/repos/Oldcircle/geo-sleuth', async route => {
        exactSkillRepoRequests++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          id: 910001, name: 'geo-sleuth', full_name: 'Oldcircle/geo-sleuth',
          html_url: 'https://github.com/Oldcircle/geo-sleuth',
          description: 'Agent skill for photo geolocation.',
          owner: { login: 'Oldcircle' }, stargazers_count: 11, forks_count: 1,
          pushed_at: '2026-10-07T00:00:00Z', language: 'Python', topics: ['agent','skill'],
          homepage: null, private: false, fork: false
        }) });
      });
      await kp.route('https://api.github.com/search/repositories**', async route => {
        skillSearchRequests++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_count: 0, items: [] }) });
      });
      await kp.locator('.project-tools-menu').evaluate(el => { el.open = true; });
      await kp.locator('#importSkillBtn').click();
      await kp.waitForSelector('#skillSearchForm', { timeout: 5000 });
      await kp.locator('#skillNameInput').fill('https://github.com/Oldcircle/geo-sleuth');
      await kp.locator('#skillSearchForm button[type="submit"]').click();
      await kp.waitForSelector('#modalRoot [data-save-skill]', { timeout: 12000 });
      const mobileModalBounds = await kp.locator('#modalRoot .modal').evaluate(el => ({
        top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom,
        height: el.getBoundingClientRect().height, viewport: innerHeight,
        scrollable: el.scrollHeight >= el.clientHeight
      }));
      mark(exactSkillRepoRequests === 1 && skillSearchRequests === 0 && mobileModalBounds.top >= 0 && mobileModalBounds.bottom <= 844
        ? 'PASS' : 'FAIL', 'KeyPocket iPhone 宽度精确仓库 URL 搜索', JSON.stringify({ exactSkillRepoRequests, skillSearchRequests, bounds: mobileModalBounds }));
      await kp.locator('#modalRoot [data-save-skill]').click();
      await kp.waitForFunction(() => !document.querySelector('#modalRoot .modal'), null, { timeout: 10000 });
      const savedSkillVisible = await kp.locator('#projectCards').innerText().then(t => t.includes('geo-sleuth'));
      mark(savedSkillVisible ? 'PASS' : 'FAIL', 'KeyPocket 手机端收录 Skill 并正常返回', '保存后弹窗关闭且项目卡片可见=' + savedSkillVisible);
      await kp.locator('.project-tools-menu').evaluate(el => { el.open = true; });
      await kp.locator('#importSkillBtn').click();
      await kp.waitForSelector('#skillSearchForm', { timeout: 5000 });
      await kp.locator('#modalRoot [data-action="close"]').last().click();
      const modalCleanupValid = await kp.locator('#modalRoot .modal').count() === 0 && await kp.locator('body').evaluate(el => !el.classList.contains('kp-modal-open'));
      mark(modalCleanupValid ? 'PASS' : 'FAIL', 'KeyPocket 手机端弹窗关闭与再次打开', '重复打开/关闭后主页面可操作，body 滚动锁已清理');
      await kp.unroute('https://api.github.com/search/repositories**');
      await kp.setViewportSize(originalViewport);
      // Device revocation uses a fake authenticated session and mocked REST responses.
      // No live user credentials or production Key data are used in this regression.
      const qaUserId = '11111111-1111-4111-8111-111111111111';
      const qaOtherDeviceId = '22222222-2222-4222-8222-222222222222';
      const qaCurrentDeviceId = await kp.evaluate(() => {
        let id = localStorage.getItem('kp.v2.device-id');
        if (!id) { id = '33333333-3333-4333-8333-333333333333'; localStorage.setItem('kp.v2.device-id', id); }
        return id;
      });
      let qaOtherDeviceRevokedAt = null;
      let qaRevokeRequest = null;
      let qaRefreshRequest = null;
      let qaSawExpiredAccessToken = false;
      const qaRouteEvents = [];
      const qaCorsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, PATCH, OPTIONS',
        'access-control-allow-headers': 'apikey, authorization, content-type, prefer',
        'access-control-max-age': '60'
      };
      await kp.route('https://urzgghdwawpwqliafrzv.supabase.co/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        qaRouteEvents.push({ method: request.method(), path: url.pathname });
        if (request.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: qaCorsHeaders });
          return;
        }
        if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
          const body = request.postDataJSON();
          qaRefreshRequest = { refreshToken: body.refresh_token, method: request.method() };
          if (request.method() !== 'POST' || body.refresh_token !== 'qa.synthetic.refresh.token') {
            await route.fulfill({ status: 400, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Unexpected refresh request' }) });
            return;
          }
          await route.fulfill({ status: 200, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({
            access_token: 'qa.refreshed.access.token', refresh_token: 'qa.rotated.refresh.token',
            token_type: 'bearer', expires_in: 3600,
            user: { id: qaUserId, email: 'keypocket-qa@example.invalid' }
          }) });
          return;
        }
        if (url.pathname !== '/rest/v1/keypocket_devices') { await route.continue(); return; }
        if (request.method() === 'GET') {
          const auth = request.headers()['authorization'] || '';
          if (auth === 'Bearer qa.expired.access.token') {
            qaSawExpiredAccessToken = true;
            await route.fulfill({ status: 401, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'JWT expired' }) });
            return;
          }
          if (auth !== 'Bearer qa.refreshed.access.token') {
            await route.fulfill({ status: 401, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Unexpected access token' }) });
            return;
          }
          const rows = [
            { user_id: qaUserId, device_id: qaCurrentDeviceId, device_label: 'QA 当前设备', created_at: '2026-11-02T00:00:00Z', last_seen_at: '2026-11-02T00:00:00Z', revoked_at: null },
            { user_id: qaUserId, device_id: qaOtherDeviceId, device_label: 'QA 另一台设备', created_at: '2026-11-01T00:00:00Z', last_seen_at: '2026-11-02T00:00:00Z', revoked_at: qaOtherDeviceRevokedAt }
          ];
          await route.fulfill({ status: 200, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify(rows) });
          return;
        }
        if (request.method() === 'PATCH') {
          const payload = request.postDataJSON();
          qaRevokeRequest = { method: request.method(), userId: url.searchParams.get('user_id'), deviceId: url.searchParams.get('device_id'), onlyActive: url.searchParams.get('revoked_at'), payload, authorization: request.headers()['authorization'] };
          if (qaRevokeRequest.userId !== 'eq.' + qaUserId || qaRevokeRequest.deviceId !== 'eq.' + qaOtherDeviceId || qaRevokeRequest.onlyActive !== 'is.null'
            || qaRevokeRequest.authorization !== 'Bearer qa.refreshed.access.token'
            || Object.keys(payload || {}).join(',') !== 'revoked_at' || !payload.revoked_at) {
            await route.fulfill({ status: 400, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Unexpected test request shape' }) });
            return;
          }
          qaOtherDeviceRevokedAt = payload.revoked_at;
          await route.fulfill({ status: 200, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify([{ device_id: qaOtherDeviceId, revoked_at: qaOtherDeviceRevokedAt }]) });
          return;
        }
        await route.fulfill({ status: 405, headers: { ...qaCorsHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Unexpected method: ' + request.method() }) });
      });
      await kp.evaluate(userId => localStorage.setItem('kp.sync.session.v1', JSON.stringify({
        access_token: 'qa.expired.access.token',
        refresh_token: 'qa.synthetic.refresh.token',
        token_type: 'bearer',
        user: { id: userId, email: 'keypocket-qa@example.invalid' }
      })), qaUserId);
      await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="sync"]').click();
      await kp.waitForSelector('#syncView:not(.hidden)', { timeout: 5000 });
      await kp.waitForSelector('#syncDeviceList [data-revoke-device]', { timeout: 8000 });
      const refreshedSession = await kp.evaluate(() => JSON.parse(localStorage.getItem('kp.sync.session.v1') || 'null'));
      const tokenRefreshPassed = qaSawExpiredAccessToken && qaRefreshRequest?.method === 'POST'
        && qaRefreshRequest.refreshToken === 'qa.synthetic.refresh.token'
        && refreshedSession?.access_token === 'qa.refreshed.access.token'
        && refreshedSession?.refresh_token === 'qa.rotated.refresh.token';
      mark(tokenRefreshPassed ? 'PASS' : 'FAIL', 'KeyPocket Supabase 会话自动刷新与令牌轮换',
        '401 触发 refresh_token grant；新 access_token 与 refresh_token 已持久化');

      const currentDeviceActions = await kp.locator('#syncDeviceList [data-device-id="' + qaCurrentDeviceId + '"] [data-revoke-device]').count();
      const otherDeviceActions = await kp.locator('#syncDeviceList [data-device-id="' + qaOtherDeviceId + '"] [data-revoke-device]').count();
      mark(currentDeviceActions === 0 && otherDeviceActions === 1 ? 'PASS' : 'FAIL',
        'KeyPocket 设备撤销保护', '当前设备不可撤销；其他有效设备提供撤销入口');
      kp.once('dialog', dialog => dialog.accept());
      await kp.locator('#syncDeviceList [data-device-id="' + qaOtherDeviceId + '"] [data-revoke-device]').click();
      try {
        await kp.waitForFunction(id => {
          const row = document.querySelector('#syncDeviceList [data-device-id="' + id + '"]');
          return row && row.innerText.includes('已撤销，不能写入云端') && !row.querySelector('[data-revoke-device]');
        }, qaOtherDeviceId, { timeout: 8000 });
      } catch (error) {
        const syncDiagnostics = await kp.evaluate(id => ({
          status: document.querySelector('#syncStatus')?.innerText,
          deviceStatus: document.querySelector('#syncDeviceStatus')?.innerText,
          deviceRows: document.querySelector('#syncDeviceList')?.innerText,
          rowHtml: document.querySelector('#syncDeviceList [data-device-id="' + id + '"]')?.outerHTML
        }), qaOtherDeviceId);
        throw new Error('Device revoke diagnostics=' + JSON.stringify({ syncDiagnostics, qaRevokeRequest, qaOtherDeviceRevokedAt, qaRouteEvents }) + '; ' + error.message);
      }
      const revokeRequestValid = !!qaRevokeRequest && qaRevokeRequest.method === 'PATCH'
        && qaRevokeRequest.userId === 'eq.' + qaUserId && qaRevokeRequest.deviceId === 'eq.' + qaOtherDeviceId
        && qaRevokeRequest.onlyActive === 'is.null' && qaRevokeRequest.authorization === 'Bearer qa.refreshed.access.token'
        && Object.keys(qaRevokeRequest.payload || {}).join(',') === 'revoked_at';
      mark(revokeRequestValid && !!qaOtherDeviceRevokedAt ? 'PASS' : 'FAIL',
        'KeyPocket 撤销设备接口与状态刷新', 'PATCH 限定当前账号、指定设备和未撤销状态；服务端返回更新行后才显示成功');
      // Password recovery is exercised only against mocked Supabase Auth endpoints.
      let qaRecoveryRequest = null, qaPasswordUpdate = null;
      const qaAuthCors = {
        'access-control-allow-origin': 'https://chenzhe223-tech.github.io',
        'access-control-allow-methods': 'POST,PATCH,OPTIONS',
        'access-control-allow-headers': 'apikey,authorization,content-type,x-client-info',
        'access-control-max-age': '86400'
      };
      await kp.route('**/auth/v1/recover**', async route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: qaAuthCors });
        qaRecoveryRequest = { method: request.method(), email: request.postDataJSON()?.email, url: request.url() };
        await route.fulfill({ status: 200, headers: { ...qaAuthCors, 'content-type': 'application/json' }, body: '{}' });
      });
      await kp.route('**/auth/v1/user', async route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: qaAuthCors });
        qaPasswordUpdate = { method: request.method(), authorization: request.headers().authorization, password: request.postDataJSON()?.password };
        await route.fulfill({ status: 200, headers: { ...qaAuthCors, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'qa-recovery-user' }) });
      });
      await kp.locator('#settingsBtn').click();
      await kp.locator('[data-module="sync"]').click();
      await kp.locator('#syncEmail').fill('keypocket-qa@example.invalid');
      await kp.locator('#syncForgotPasswordBtn').click();
      await kp.waitForFunction(() => document.querySelector('#syncStatus')?.innerText.includes('如果该邮箱对应有效账号'), null, { timeout: 5000 });
      const recoveryRequestValid = qaRecoveryRequest?.method === 'POST'
        && qaRecoveryRequest.email === 'keypocket-qa@example.invalid'
        && new URL(qaRecoveryRequest.url).searchParams.get('redirect_to') === 'https://chenzhe223-tech.github.io/keypocket/';
      mark(recoveryRequestValid ? 'PASS' : 'FAIL', 'KeyPocket 密码找回邮件请求', 'POST /auth/v1/recover，邮箱与正式回跳地址正确');
      await kp.goto(base + 'keypocket/#access_token=qa.recovery.access.token&type=recovery', { waitUntil: 'domcontentloaded', timeout: 45000 });
      try { await kp.waitForSelector('#syncPasswordRecoveryPanel:not(.hidden)', { timeout: 8000 }); }
      catch (error) {
        const recoveryDiagnostics = await kp.evaluate(() => ({ hash: location.hash, build: window.__kpBuildVersion, state: window.__kpRecoveryDiagnostic, panelClass: document.querySelector('#syncPasswordRecoveryPanel')?.className, status: document.querySelector('#syncStatus')?.innerText }));
        throw new Error('Recovery callback diagnostics=' + JSON.stringify(recoveryDiagnostics) + '; ' + error.message);
      }
      await kp.locator('#syncNewPassword').fill('QA-Recovered-Password-2026');
      await kp.locator('#syncConfirmNewPassword').fill('QA-Recovered-Password-2026');
      await kp.locator('#syncResetPasswordBtn').click();
      await kp.waitForFunction(() => document.querySelector('#syncStatus')?.innerText.includes('同步账号密码已更新'), null, { timeout: 8000 });
      const passwordUpdateValid = qaPasswordUpdate?.method === 'PATCH'
        && qaPasswordUpdate.authorization === 'Bearer qa.recovery.access.token'
        && qaPasswordUpdate.password === 'QA-Recovered-Password-2026'
        && await kp.locator('#syncPasswordRecoveryPanel').evaluate(el => el.classList.contains('hidden'));
      mark(passwordUpdateValid ? 'PASS' : 'FAIL', 'KeyPocket 安全重置密码', '仅使用恢复 access token 更新账号密码；未写入同步口令或本地密钥库');
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
      await topicPage.locator('#ideaInput').waitFor({ timeout: 8000 });
      mark('PASS', 'V2 AI 选题工作区', '自然语言输入与方向结果区域已加载');
      mark(await topicPage.locator('#directionResults').count() === 1 ? 'PASS' : 'FAIL', '选题方向结果区域', 'directionResults 存在');
      await topicPage.locator('#importNianbox').click();
      await topicPage.locator('#importDialog[open]').waitFor({ timeout: 5000 });
      const nianboxConnectVisible = await topicPage.locator('#connectNianbox').isVisible();
      mark(nianboxConnectVisible ? 'PASS' : 'FAIL', '念头盒导入入口', '账号连接与文件/粘贴降级入口已加载');
      await topicPage.locator('#closeImportDialog').click();
      mark(await topicPage.locator('#openChatGPT').count() === 1 ? 'PASS' : 'FAIL', 'ChatGPT 交接入口', '创作指令区提供打开 ChatGPT 操作');
      await topicPage.waitForFunction(() => {
        const el = document.querySelector('#sourceStatus');
        return el && el.innerText.trim().length > 0;
      }, null, { timeout: 12000 });
      const feedState = await topicPage.locator('#sourceStatus').innerText();

      mark(feedState.includes('已连接') ? 'PASS' : 'WARN', 'Davy Radar 数据连接', feedState);
      try {
        await topicPage.waitForSelector('.feedcard', { timeout: 12000 });
        const grid = await topicPage.locator('.feedcard').first().evaluate(card => {
          const style = getComputedStyle(card);
          const cover = card.querySelector('.feed-media').getBoundingClientRect();
          const body = card.children[1].getBoundingClientRect();
          const actions = card.querySelector('.feedactions').getBoundingClientRect();
          const box = card.getBoundingClientRect();
          return {
            columns: style.gridTemplateColumns.split(' ').length,
            coverX: Math.round(cover.x), bodyX: Math.round(body.x),
            actionsX: Math.round(actions.x), actionsRight: Math.round(actions.right),
            cardRight: Math.round(box.right), cardHeight: Math.round(box.height)
          };
        });
        const aligned = grid.columns === 3 && grid.coverX < grid.bodyX && grid.bodyX < grid.actionsX && grid.actionsRight <= grid.cardRight + 2;
        mark(aligned ? 'PASS' : 'FAIL', '选题素材卡片三列对齐', JSON.stringify(grid));
      } catch (e) {
        mark('FAIL', '选题素材卡片三列对齐', e.message);
      }
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
      await topicMobile.waitForSelector('.feedcard', { timeout: 12000 });
      const mobileGrid = await topicMobile.locator('.feedcard').first().evaluate(card => {
        const style = getComputedStyle(card);
        const actions = card.querySelector('.feedactions').getBoundingClientRect();
        const box = card.getBoundingClientRect();
        return { columns: style.gridTemplateColumns.split(' ').length, actionsLeft: Math.round(actions.left), actionsRight: Math.round(actions.right), cardLeft: Math.round(box.left), cardRight: Math.round(box.right) };
      });
      const mobileAligned = mobileGrid.columns === 2 && mobileGrid.actionsLeft >= mobileGrid.cardLeft && mobileGrid.actionsRight <= mobileGrid.cardRight + 2;
      mark(mobileAligned ? 'PASS' : 'FAIL', '选题素材卡片手机端操作区', JSON.stringify(mobileGrid));
      await topicMobile.close();
    } catch (e) {
      mark('FAIL', '公众号选题工作台 smoke checks', e.stack || e.message || e);
    }

    // MelodyMe's legacy four-step story flow has been replaced by the four-city music map.
    // Reuse the dedicated desktop/mobile acceptance suite so the portfolio smoke test stays aligned.
    try {
      const { execFileSync } = require('node:child_process');
      execFileSync(process.execPath, [path.join(__dirname, 'melodyme-live-qa.cjs')], {
        stdio: 'inherit',
        env: { ...process.env, MELODYME_URL: base + 'melodyme/' }
      });
      mark('PASS', 'MelodyMe 四城音乐地图验收', '复用专用桌面与移动端验收套件');
    } catch (e) {
      mark('FAIL', 'MelodyMe 四城音乐地图验收', e.stack || e.message || e);
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
