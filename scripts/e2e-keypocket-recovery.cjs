'use strict';
// Run against a locally served checkout. Only synthetic credentials and mocked cloud REST are used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.KP_CHROME_PATH || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], requests = [], scans = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://api.github.com/**', async route => {
      scans.push(route.request().url());
      await route.fulfill({ json: [] });
    });
    await page.goto(process.env.KP_TEST_URL || 'http://127.0.0.1:8798/keypocket/');
    await page.fill('#masterPassword','fixture-only-vault');
    await page.fill('#confirmPassword','fixture-only-vault');
    await page.click('#unlockBtn');
    await page.click('[data-module="projects"]');
    assert.match(await page.innerText('#githubAutoScanStatus'), /选择/);
    assert.equal(scans.length,0);
    await page.locator('.project-tools-menu').evaluate(el => { el.open=true; });
    await page.click('#editPublicOwner');
    await page.fill('#publicOwner','Test-Owner');
    await page.click('#publicOwnerForm button[type=submit]');
    await page.waitForFunction(() => document.querySelector('#githubAutoScanStatus').textContent.includes('扫描完成'));
    assert.equal(new URL(scans[0]).pathname,'/users/test-owner/repos');
    const state = await page.evaluate(async () => {
      const pass='fixture-only-cloud',salt=randomBytes(16),iterations=310000;
      const syncKey=await deriveKey(pass,salt,iterations);
      const makeKey=id=>({id,key:'synthetic-'+id,provider:'custom',name:id});
      const deleted={...makeKey('key-3'),deletedAt:Date.now()};
      const snap={schemaVersion:2,records:[makeKey('key-1'),makeKey('key-2')],projects:[{id:'a',name:'Skill A'},{id:'b',name:'Skill B'}],deleted:[{id:deleted.id,kind:'key',plain:deleted}]};
      const payload={...await encryptJson(snap,syncKey),salt:toB64(salt)};
      const row={id:'fixture-snapshot',payload,schema_version:2,record_count:2,created_at:new Date().toISOString()};
      kpSetSession({access_token:'fixture-only-session',user:{id:'fixture'}});
      const existing=makeKey('existing');
      await persistRecord(existing);records.push(existing);
      return {row,meta:{key_salt:toB64(salt),iterations}};
    });
    await page.route('**/rest/v1/**',async route=>{
      const req=route.request(), url=new URL(req.url());requests.push(req.method());
      assert.equal(req.method(),'GET');
      await route.fulfill({json:url.pathname.endsWith('keypocket_sync_meta')?[state.meta]:[state.row]});
    });
    await page.click('#settingsBtn');
    await page.click('[data-module="backup"]');
    await page.click('[data-cloud-restore]');
    await page.fill('#restorePass','fixture-wrong-pass');
    await page.click('#cloudRestoreForm [type=submit]');
    await page.waitForFunction(()=>document.querySelector('#restoreError')?.textContent.includes('口令不匹配'));
    assert.ok(await page.evaluate(async()=>!!await getItem('existing')));
    await page.fill('#restorePass','fixture-only-cloud');
    await page.click('#cloudRestoreForm [type=submit]');
    await page.waitForFunction(()=>!document.querySelector('#cloudRestoreForm'));
    const result=await page.evaluate(async()=>({
      keys:records.map(x=>x.key),projects:projects.map(x=>x.name),
      trash:(await kpReadTrash()).map(x=>x.item.key),old:!!await getItem('existing'),
      encrypted:!(await allItems()).some(x=>JSON.stringify(x).includes('synthetic-key'))
    }));
    assert.deepEqual(result,{keys:['synthetic-key-1','synthetic-key-2'],projects:['Skill A','Skill B'],trash:['synthetic-key-3'],old:false,encrypted:true});
    assert.ok(requests.length>=5);assert.deepEqual(errors,[]);
    console.log('PASS 390px owner opt-in and account selection; read-only cloud listing; wrong password preserves existing data; restored 2 keys, 2 projects and 1 deleted key using Web Crypto and IndexedDB; zero cloud writes.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
