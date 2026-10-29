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

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#products').waitFor();
    await page.locator('#shelf .app-card').first().waitFor({ timeout: 10000 });
    // GSAP intentionally starts the hero heading hidden; wait for its entrance animation before asserting rendered text.
    await page.locator('h1').waitFor({ state: 'visible', timeout: 10000 });
    const title = await page.locator('h1').innerText();
    if (!title.trim()) throw new Error('Hero heading is empty');
    const motion = await page.evaluate(() => ({
      gsapLoaded: !!window.gsap,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      heroVisibility: getComputedStyle(document.querySelector('h1')).visibility,
      heroOpacity: Number(getComputedStyle(document.querySelector('h1')).opacity)
    }));
    if (motion.heroVisibility === 'hidden') throw new Error('Hero heading remained hidden after initial render');
    if (motion.gsapLoaded && !motion.reducedMotion) {
      await page.waitForFunction(() => {
        const heading = document.querySelector('h1');
        return heading && getComputedStyle(heading).visibility !== 'hidden' && Number(getComputedStyle(heading).opacity) >= 0.99;
      }, null, { timeout: 10000 });
    }
    results.push({ test: 'desktop initial render and GSAP progressive enhancement', status: 'PASS', detail: { title: title.replace(/\s+/g, ' ').trim(), ...motion } });

    const colors = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    }));
    // The current Visual DNA homepage intentionally uses the editorial light palette.
    // Keep this assertion aligned with the actual design tokens rather than the legacy dark theme.
    if (!colors.canvas.toLowerCase().includes('#f5f3ed') || !colors.ink.toLowerCase().includes('#14263d')) {
      throw new Error('Editorial light design tokens are not active: ' + JSON.stringify(colors));
    }
    results.push({ test: 'Visual DNA editorial light design tokens', status: 'PASS', detail: colors });

    // Trigger the existing scroll-reveal enhancement before interacting with product tools.
    // A zero-opacity pre-reveal element is intentionally not actionable until it enters view.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.querySelector('#products').offsetTop);
    });
    await page.waitForTimeout(900);

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

    const opener = page.locator('#shelf [data-detail]').first();
    await opener.click();
    await page.locator('#modal.open').waitFor({ timeout: 5000 });
    if (await page.evaluate(() => document.activeElement?.id) !== 'closeModal') throw new Error('Opening the detail dialog did not move focus to its close button');
    await page.keyboard.press('Shift+Tab');
    const wrappedToLast = await page.evaluate(() => {
      const modal = document.querySelector('#modal');
      const focusable = Array.from(modal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el => el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      return document.activeElement === focusable[focusable.length - 1];
    });
    if (!wrappedToLast) throw new Error('Dialog focus did not wrap from first to last control with Shift+Tab');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#modal')?.classList.contains('open'), null, { timeout: 3000 });
    if (!(await opener.evaluate(el => document.activeElement === el))) throw new Error('Closing the detail dialog did not restore focus to the opener');
    results.push({ test: 'project detail dialog keyboard focus and Escape close', status: 'PASS' });

    const adapterAvailable = await page.evaluate(() => !!window.DAVYLABMotion && typeof window.DAVYLABMotion.applyPreset === 'function');
    if (!adapterAvailable) throw new Error('Visual DNA motion preset adapter did not load');
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, document.querySelector('#skills').offsetTop);
    });
    await page.waitForTimeout(120);
    const skillsMotion = await page.evaluate(() => ({
      targetCount: document.querySelectorAll('#skills .open-skill-main, #skills .open-skill-aside').length,
      activePreviewCount: Array.from(document.querySelectorAll('#skills .open-skill-main, #skills .open-skill-aside'))
        .reduce((count, element) => count + element.getAnimations().length, 0),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    }));
    if (skillsMotion.targetCount !== 2) throw new Error('Expected two isolated Open Skills motion targets: ' + JSON.stringify(skillsMotion));
    if (!skillsMotion.reducedMotion && skillsMotion.activePreviewCount < 1) {
      throw new Error('Open Skills section did not use the Visual DNA preset adapter: ' + JSON.stringify(skillsMotion));
    }
    results.push({ test: 'isolated Visual DNA preset integration in Open Skills section', status: 'PASS', detail: skillsMotion });

    await page.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (desktopOverflow) throw new Error('Horizontal page overflow at 1440px desktop viewport');
    results.push({ test: 'desktop layout overflow', status: 'PASS' });

    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true
    });
    mobilePage.on('pageerror', error => errors.push('mobile: ' + error.message));
    await mobilePage.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.locator('#products').waitFor();
    await mobilePage.locator('#shelf .app-card').first().waitFor({ timeout: 10000 });
    await mobilePage.locator('h1').waitFor({ state: 'visible', timeout: 10000 });
    await mobilePage.waitForTimeout(1600);
    const mobile = await mobilePage.evaluate(() => ({
      width: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      gsapLoaded: !!window.gsap,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      heroVisible: !!document.querySelector('h1') && document.querySelector('h1').getBoundingClientRect().width > 0,
      heroOpacity: Number(getComputedStyle(document.querySelector('h1')).opacity),
      searchVisible: !!document.querySelector('#search') && document.querySelector('#search').getBoundingClientRect().width > 0,
      cardWidth: document.querySelector('#shelf .app-card')?.getBoundingClientRect().width || 0,
      progressRail: !!document.querySelector('.motion-progress'),
      activeGsapAnimations: window.gsap ? window.gsap.globalTimeline.getChildren(true, true, true).length : 0
    }));
    if (!mobile.heroVisible || !mobile.searchVisible || mobile.cardWidth <= 0) throw new Error('Essential mobile content is not visible: ' + JSON.stringify(mobile));
    if (!mobile.coarsePointer) throw new Error('Mobile test did not activate coarse-pointer/touch media features: ' + JSON.stringify(mobile));
    if (mobile.documentWidth > mobile.width + 2) throw new Error('Horizontal page overflow at mobile viewport: ' + JSON.stringify(mobile));
    if (mobile.gsapLoaded && !mobile.reducedMotion && (!mobile.progressRail || mobile.activeGsapAnimations < 1)) {
      throw new Error('GSAP mobile motion layer did not initialize: ' + JSON.stringify(mobile));
    }
    if (mobile.gsapLoaded && !mobile.reducedMotion && mobile.heroOpacity < 0.99) {
      throw new Error('Mobile hero entrance did not finish: ' + JSON.stringify(mobile));
    }
    await mobilePage.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });
    results.push({ test: 'real touch-mobile layout and GSAP motion', status: 'PASS', detail: mobile });
    await mobilePage.close();

    if (errors.length) throw new Error('Uncaught browser page errors: ' + errors.join(' | '));
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
