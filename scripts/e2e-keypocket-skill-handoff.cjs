'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keypocket-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: ['--no-sandbox'],
    viewport: { width: 1365, height: 900 }
  });
  try {
    // A fresh browser profile isolates cookies, localStorage and IndexedDB across CI runs.
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
    const consoleErrors = [];
    keyPocket.on('pageerror', error => pageErrors.push(error.message));
    keyPocket.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    // The popup may be fulfilled by an older cached page during a Pages deployment.
    // Do not continue until the exact V2 bundle expected by the repository is loaded.
    await keyPocket.waitForFunction(() => {
      const script = [...document.scripts].find(item => item.src.includes('/keypocket/app.js'));
      return script && script.src.includes('kp-v2-recovery-20261102-1')
        && document.querySelector('#recycleView')
        && document.querySelector('#backupView')
        && document.querySelector('#radarView');
    }, null, { timeout: 30000 });
    await keyPocket.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await keyPocket.locator('#unlockForm').waitFor({ state: 'visible', timeout: 30000 });

    // app.js runs init() asynchronously after DOM parsing and opens IndexedDB before
    // it switches the lock title/confirm field from their static HTML defaults.
    try {
      await keyPocket.waitForFunction(() => {
        const title = document.querySelector('#lockTitle')?.textContent?.trim();
        return title === '创建你的本地密钥库' || title === '欢迎回来'
          || title === '检测到本地数据，但密钥库信息缺失'
          || title === '本地密钥库暂时无法读取';
      }, null, { timeout: 15000 });
    } catch (error) {
      const debugState = await keyPocket.evaluate(() => ({
        readyState: document.readyState,
        initFunction: typeof window.init,
        lockTitle: document.querySelector('#lockTitle')?.textContent,
        lockDescription: document.querySelector('#lockDesc')?.textContent,
        confirmWrapClass: document.querySelector('#confirmWrap')?.className,
        unlockButton: document.querySelector('#unlockBtn')?.textContent,
        scriptResources: performance.getEntriesByType('resource')
          .filter(item => item.name.includes('/keypocket/app.js'))
          .map(item => ({ name: item.name, duration: item.duration, transferSize: item.transferSize }))
      }));
      console.error('KEYPOCKET_INIT_DIAGNOSTICS ' + JSON.stringify({
        debugState, pageErrors, consoleErrors
      }));
      throw error;
    }
    const initialState = await keyPocket.evaluate(async () => {
      const dbs = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('keypocket-local-v1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const hasStore = Array.from(db.objectStoreNames).includes('vault');
      const rows = hasStore ? await new Promise((resolve, reject) => {
        const request = db.transaction('vault', 'readonly').objectStore('vault').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }) : [];
      const state = {
        url: location.href,
        databases: dbs.map(item => ({ name: item.name, version: item.version })),
        hasStore,
        ids: rows.map(item => String(item.id || '')),
        hasVault: rows.some(item => item.id === 'vault-meta'),
        confirmWrapClass: document.querySelector('#confirmWrap')?.className,
        lockTitle: document.querySelector('#lockTitle')?.textContent,
        unlockButton: document.querySelector('#unlockBtn')?.textContent
      };
      db.close();
      return state;
    });
    console.log('KEYPOCKET_E2E_INITIAL_STATE ' + JSON.stringify(initialState));
    const testPassword = 'Handoff-Test-Password-2026';
    assert.equal(initialState.hasVault, false, 'fresh E2E profile unexpectedly contains a KeyPocket vault');
    assert.equal(initialState.ids.length, 0, 'fresh E2E profile unexpectedly contains vault records');
    assert.ok(!String(initialState.confirmWrapClass).includes('hidden'), 'new-vault confirmation input should be visible');
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
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
