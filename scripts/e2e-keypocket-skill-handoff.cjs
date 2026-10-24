'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const radar = await context.newPage();

    await radar.goto('https://chenzhe223-tech.github.io/radar/daily/?e2e-keypocket=' + Date.now(), {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    const collectButton = radar.locator('[data-kp-skill-save]').first();
    await collectButton.waitFor({ state: 'visible', timeout: 45000 });
    const repositoryUrl = await collectButton.getAttribute('data-skill-url');
    const skillName = await collectButton.getAttribute('data-skill-name');
    assert.ok(skillName, 'Radar did not supply a Skill name');
    assert.match(repositoryUrl || '', /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/, 'Radar did not supply a canonical public GitHub repository URL');

    const popupPromise = radar.waitForEvent('popup', { timeout: 20000 });
    await collectButton.click();
    const keyPocket = await popupPromise;
    const pageErrors = [];
    keyPocket.on('pageerror', error => pageErrors.push(error.message));
    await keyPocket.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await keyPocket.locator('#unlockForm').waitFor({ state: 'visible', timeout: 30000 });

    const testPassword = 'Handoff-Test-Password-2026';
    await keyPocket.locator('#masterPassword').fill(testPassword);
    await keyPocket.locator('#confirmPassword').fill(testPassword);
    await keyPocket.locator('#unlockBtn').click();

    await keyPocket.locator('#saveRadarSkillBtn').waitFor({ state: 'visible', timeout: 15000 });
    const modalRepository = await keyPocket.locator('#modalRoot a[href^="https://github.com/"]').first().getAttribute('href');
    assert.equal(modalRepository, repositoryUrl, 'KeyPocket preview repository must match the selected Radar Skill');

    await keyPocket.locator('#saveRadarSkillBtn').click();
    await keyPocket.waitForFunction(
      expectedName => {
        const view = document.querySelector('#projectView');
        const cards = document.querySelector('#projectCards');
        return view && !view.classList.contains('hidden') && cards && cards.textContent.includes(expectedName);
      },
      skillName,
      { timeout: 15000 }
    );

    const persisted = await keyPocket.evaluate(async () => {
      const queued = JSON.parse(localStorage.getItem('kp.radar.pending-skills.v1') || '[]');
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('keypocket-local-v1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const stored = await new Promise((resolve, reject) => {
        const request = db.transaction('vault', 'readonly').objectStore('vault').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        queueLength: Array.isArray(queued) ? queued.length : -1,
        projects: stored.filter(item => item.kind === 'project'),
        serializedProjectEnvelopes: JSON.stringify(stored.filter(item => item.kind === 'project'))
      };
    });

    assert.equal(persisted.queueLength, 0, 'saved Skill must be removed from the pending queue');
    assert.ok(persisted.projects.length >= 1, 'Skill must be saved in the IndexedDB project store');
    assert.ok(persisted.projects.some(item => item.iv && item.data), 'project metadata must be stored in an encrypted envelope');
    assert.ok(!persisted.serializedProjectEnvelopes.includes(repositoryUrl), 'repository URL must not appear in plaintext in the project envelope');
    assert.deepEqual(pageErrors, [], 'KeyPocket should not raise browser JavaScript errors during import');

    console.log('PASS: clicked a Skill in the live AI brief');
    console.log('PASS: opened KeyPocket and displayed an explicit confirmation dialog');
    console.log('PASS: saved the selected repository to the encrypted local project store');
    console.log('PASS: cleared the pending item without plaintext repository metadata in the stored envelope');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
