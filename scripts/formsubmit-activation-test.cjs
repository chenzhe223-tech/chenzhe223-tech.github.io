const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://chenzhe223-tech.github.io/#contact';
const ENDPOINT = 'https://formsubmit.co/ajax/chenzhe223@gamil.com';
const OUT = 'test-results';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let browser;
  let responseRecord = null;
  const requestFailures = [];
  const report = {
    test: 'single post-activation FormSubmit delivery-path check',
    startedAt: new Date().toISOString(),
    destination: 'chenzhe223@gamil.com',
    note: 'One clearly labeled system-test email; no real customer data.'
  };

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
    page.on('requestfailed', request => {
      if (request.url().startsWith(ENDPOINT)) {
        requestFailures.push({ method: request.method(), error: request.failure()?.errorText || 'request failed' });
      }
    });

    const home = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!home || home.status() >= 400) throw new Error('Live DAVYLAB page could not be opened.');
    await page.locator('#leadForm').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('#leadForm').scrollIntoViewIfNeeded();

    // Use an explicitly labeled test submission with no real customer's details.
    await page.locator('input[name="_subject"]').evaluate(el => { el.value = '[DAVYLAB 系统测试] FormSubmit 激活后提交链路验证（请忽略）'; });
    await page.locator('[data-project-type="小型应用 / 工具"]').click();
    await page.locator('#ideaDescription').fill('【系统测试，请忽略】DAVYLAB 站点所有者已完成 FormSubmit 邮箱激活。本条用于验证激活后的邮件转发链路，不是客户需求，无需回复。');
    await page.locator('#leadName').fill('DAVYLAB 系统测试（无需回复）');
    await page.locator('#leadContactMethod').selectOption({ label: '邮箱' });
    await page.locator('#leadContact').fill('SYSTEM-TEST-NO-REPLY');
    await page.locator('#leadBudget').selectOption({ label: '暂不确定，先聊需求' });
    await page.locator('#leadTimeline').selectOption({ label: '灵活，先看方案' });
    await page.locator('[name="联系授权"]').check();

    const responsePromise = page.waitForResponse(
      response => response.url().startsWith(ENDPOINT) && response.request().method() === 'POST',
      { timeout: 30000 }
    ).catch(() => null);

    await page.locator('#submitLead').click();
    await page.waitForFunction(() => {
      const status = document.querySelector('#leadStatus');
      return status && (status.classList.contains('success') || status.classList.contains('error'));
    }, null, { timeout: 35000 }).catch(() => null);

    const response = await responsePromise;
    const pageStatus = await page.locator('#leadStatus').innerText().catch(() => 'No page status');
    const statusClasses = await page.locator('#leadStatus').getAttribute('class').catch(() => '');
    let bodyText = '';
    let bodyJson = null;
    if (response) {
      bodyText = await response.text().catch(() => '');
      try { bodyJson = JSON.parse(bodyText); } catch {}
      responseRecord = {
        httpStatus: response.status(),
        contentType: response.headers()['content-type'] || 'unknown',
        successField: bodyJson?.success ?? null,
        message: typeof bodyJson?.message === 'string' ? bodyJson.message.slice(0, 300) : null,
        responseBodySample: bodyJson ? undefined : bodyText.slice(0, 220)
      };
    }

    const accepted = !!response &&
      response.status() >= 200 && response.status() < 300 &&
      (bodyJson?.success === true || bodyJson?.success === 'true') &&
      statusClasses.includes('success');

    report.finishedAt = new Date().toISOString();
    report.homepageStatus = home.status();
    report.endpoint = responseRecord;
    report.requestFailures = requestFailures;
    report.pageStatus = pageStatus;
    report.serviceAcceptedSubmission = accepted;
    report.mailboxDeliveryConfirmed = false;
    report.mailboxDeliveryNote = 'The recipient inbox must be checked separately; a successful API response does not prove final delivery.';
    fs.writeFileSync(path.join(OUT, 'formsubmit-post-activation-test.json'), JSON.stringify(report, null, 2));
    console.log('[FORM_SUBMIT_POST_ACTIVATION_RESULT] ' + JSON.stringify(report, null, 2));

    await page.screenshot({ path: path.join(OUT, 'formsubmit-post-activation-page.png'), fullPage: false });
    if (!accepted) process.exitCode = 1;
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.error = error?.stack || error?.message || String(error);
    report.endpoint = responseRecord;
    report.requestFailures = requestFailures;
    fs.writeFileSync(path.join(OUT, 'formsubmit-post-activation-test.json'), JSON.stringify(report, null, 2));
    console.error('[FORM_SUBMIT_POST_ACTIVATION_RESULT] ' + JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
