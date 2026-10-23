const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const root = path.resolve(__dirname, "..");
const screenshotDir = path.join(__dirname, "test-results");
fs.mkdirSync(screenshotDir, { recursive: true });
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };

async function main() {
  const htmlPath = path.join(root, "topic-studio", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const inline = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, "inline application script exists");
  new Function(inline[1]);
  assert.ok(html.includes('id="ideaInput"'), "AI idea input exists");
  assert.ok(html.includes('id="directionResults"'), "direction result region exists");
  assert.ok(html.includes('id="importNianbox"'), "NianBox import entry exists");
  assert.ok(html.includes("NIANBOX_TOKEN_KEY"), "NianBox session token is session-scoped");
  assert.ok(!/AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}/.test(html), "no obvious provider API key is embedded");
  const archivePath = path.join(root, "topic-studio", "data", "published-articles.json");
  assert.ok(fs.existsSync(archivePath), "published content archive JSON exists");
  const archiveJson = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  assert.ok(Array.isArray(archiveJson.articles), "published archive uses articles array schema");

  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const target = path.resolve(root, "." + pathname);
    if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404); res.end("Not found"); return;
    }
    res.writeHead(200, { "content-type": mime[path.extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${address.port}/topic-studio/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /先说一个念头/ }).waitFor();
    assert.equal(await page.title(), "公众号选题工作台 · DAVYLAB");
    await page.locator(".feedcard").first().waitFor({ timeout: 12000 });

    // Desktop visual regression: the feed card has a dedicated visual, content and action column.
    const desktopCard = await page.locator(".feedcard").first().evaluate(card => {
      const style = getComputedStyle(card);
      const cover = card.querySelector(".feed-media").getBoundingClientRect();
      const body = card.children[1].getBoundingClientRect();
      const actions = card.querySelector(".feedactions").getBoundingClientRect();
      const box = card.getBoundingClientRect();
      return {
        columns: style.gridTemplateColumns.trim().split(/\s+/).length,
        coverX: Math.round(cover.x), bodyX: Math.round(body.x), actionsX: Math.round(actions.x),
        actionsRight: Math.round(actions.right), cardRight: Math.round(box.right),
        minCardHeight: Math.round(box.height)
      };
    });
    assert.equal(desktopCard.columns, 3, `desktop topic card must have three aligned columns: ${JSON.stringify(desktopCard)}`);
    const imageCheck = await page.locator(".feedcard").first().evaluate(card => {
      const img = card.querySelector(".feed-media img");
      const b = card.querySelector(".feed-media").getBoundingClientRect();
      return { exists: !!img, src: img?.getAttribute("src") || "", alt: img?.getAttribute("alt") || "", fallback: img?.getAttribute("data-fallback") || "", width: Math.round(b.width), height: Math.round(b.height) };
    });
    assert.ok(imageCheck.exists, "news card must show an image element instead of a plain color square");
    assert.match(imageCheck.src, /^https:\/\//, `thumbnail must use a public HTTPS image: ${JSON.stringify(imageCheck)}`);
    assert.ok(imageCheck.alt.length > 0, "thumbnail alt text should identify the related story");
    assert.match(imageCheck.fallback, /^https:\/\//, "each thumbnail should have an HTTPS fallback");
    assert.ok(imageCheck.width >= 120 && imageCheck.height >= 75, `desktop thumbnail should be editorial landscape size: ${JSON.stringify(imageCheck)}`);
    const cardsImages = await page.locator(".feedcard .feed-media img").count();
    const cardsCount = await page.locator(".feedcard").count();
    assert.equal(cardsImages, cardsCount, "every visible source/topic card has its own thumbnail");
    await page.locator(".feedcard").first().locator(".feed-media img").evaluate(img => { img.dispatchEvent(new Event("error")); });
    await page.waitForFunction(() => {
      const img = document.querySelector(".feedcard .feed-media img");
      return img && img.dataset.fallbackUsed === "1";
    }, null, { timeout: 7000 });
    assert.ok(await page.locator(".feedcard").first().locator(".feed-media").evaluate(el => el.classList.contains("is-thematic")), "failed source image should switch to the thematic fallback");

    assert.ok(desktopCard.coverX < desktopCard.bodyX && desktopCard.bodyX < desktopCard.actionsX, `desktop card order is wrong: ${JSON.stringify(desktopCard)}`);
    assert.ok(desktopCard.actionsRight <= desktopCard.cardRight + 2, `desktop actions overflow the card: ${JSON.stringify(desktopCard)}`);
    await page.screenshot({ path: path.join(screenshotDir, "topic-studio-desktop.png"), fullPage: false });
    await page.locator(".feedcard").first().screenshot({ path: path.join(screenshotDir, "topic-studio-feed-card.png") });

    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(80);
      const sizes = await page.evaluate(() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth }));
      assert.ok(sizes.doc <= sizes.viewport + 1, `no horizontal overflow at ${width}px: ${JSON.stringify(sizes)}`);
      if (width === 390) {
        const mobileCard = await page.locator(".feedcard").first().evaluate(card => {
          const style = getComputedStyle(card);
          const actions = card.querySelector(".feedactions").getBoundingClientRect();
          const body = card.children[1].getBoundingClientRect();
          const cover = card.querySelector(".feed-media").getBoundingClientRect();
          const box = card.getBoundingClientRect();
          return {
            columns: style.gridTemplateColumns.trim().split(/\s+/).length,
            actionsLeft: Math.round(actions.left), actionsRight: Math.round(actions.right),
            bodyBottom: Math.round(body.bottom), actionsTop: Math.round(actions.top), imageWidth: Math.round(cover.width), imageHeight: Math.round(cover.height),
            cardLeft: Math.round(box.left), cardRight: Math.round(box.right)
          };
        });
        assert.equal(mobileCard.columns, 2, `mobile card should use two columns: ${JSON.stringify(mobileCard)}`);
        assert.ok(mobileCard.imageWidth >= 75 && mobileCard.imageHeight >= 55, `mobile card image should remain visible: ${JSON.stringify(mobileCard)}`);
        assert.ok(mobileCard.actionsLeft >= mobileCard.cardLeft && mobileCard.actionsRight <= mobileCard.cardRight + 2, `mobile actions overflow: ${JSON.stringify(mobileCard)}`);
        assert.ok(mobileCard.actionsTop >= mobileCard.bodyBottom - 2, `mobile actions should follow the content: ${JSON.stringify(mobileCard)}`);
        await page.screenshot({ path: path.join(screenshotDir, "topic-studio-mobile.png"), fullPage: false });
      }
    }

    await page.locator("#ideaInput").fill("普通人如何用 AI 做出第一个小产品");
    await page.getByRole("button", { name: /分析并生成方向/ }).click();
    await page.locator("#aiState").waitFor();
    await page.waitForTimeout(150);
    assert.match(await page.locator("#aiState").innerText(), /请先点击|登录|连接/, "AI analysis must require an authenticated NianBox session");
    assert.equal(await page.locator(".direction-card").count(), 0, "AI failure/auth-required state must not show fake direction cards");

    await page.getByRole("button", { name: /从念头盒导入/ }).click();
    await page.locator("#nianboxPaste").fill("我想写一篇普通人如何用 AI 做出第一个小产品的文章。\\n\\n重点是从真实经历出发，避免技术术语。");
    await page.locator("#nianboxPreview label").first().waitFor();
    await page.getByRole("button", { name: "导入选中灵感" }).click();
    await page.getByRole("button", { name: "我的选题池" }).click();
    await page.getByText("我想写一篇普通人如何用 AI 做出第一个小产品的文章。", { exact: false }).first().waitFor();
    assert.equal(await page.locator("#topicList .topiccard").count(), 1, "manual NianBox fallback import adds one idea");

    await page.locator('#topicList button[data-a="prompt"]').first().click();
    assert.ok((await page.locator("#promptBox").inputValue()).includes("事实核查"), "creation prompt includes fact-checking instructions");
    
    // Published content library: shared archive loading, create/preview/local persistence and cleanup.
    await page.locator('button[data-section="published"]').click();
    await page.locator("#publishedCount").waitFor();
    await page.waitForFunction(() => {
      const status = document.querySelector("#publishedSyncStatus");
      return status && !status.innerText.includes("正在读取");
    }, null, { timeout: 7000 });
    assert.ok((await page.locator("#publishedSyncStatus").innerText()).includes("共享档案"), "published page reports shared archive state");
    await page.locator("#addPublished").click();
    await page.locator("#publishedTitle").fill("QA 临时已发表文章");
    await page.locator("#publishedUrl").fill("https://mp.weixin.qq.com/s/davylab-qa-temporary");
    await page.locator("#publishedDate").fill("2026-10-23");
    await page.locator("#publishedSummary").fill("只用于浏览器验收的临时记录。");
    await page.locator("#publishedForm button[type=submit]").click();
    await page.locator("#publishedList").getByText("QA 临时已发表文章", { exact: true }).waitFor({ timeout: 5000 });
    const savedPublished = await page.evaluate(() => {
      const rows = JSON.parse(localStorage.getItem("davylab-published-articles-v1") || "[]");
      return rows.some(a => a.title === "QA 临时已发表文章" && a.url === "https://mp.weixin.qq.com/s/davylab-qa-temporary");
    });
    assert.ok(savedPublished, "published article record is stored locally");
    page.once("dialog", dialog => dialog.accept());
    await page.locator('#publishedList button[data-published-action="remove"]').first().click();

    assert.deepEqual(errors, [], `browser console/page errors: ${errors.join("; ")}`);

    const worker = await fetch("https://nianbox-cloud.chenzhe223.workers.dev/health");
    assert.equal(worker.status, 200, "NianBox cloud Worker health endpoint responds");
    const health = await worker.json();

    const capabilitiesResponse = await fetch("https://nianbox-cloud.chenzhe223.workers.dev/capabilities");
    assert.equal(capabilitiesResponse.status, 200, "NianBox AI capabilities endpoint responds");
    const capabilities = await capabilitiesResponse.json();
    assert.equal(typeof capabilities.classify, "boolean", "server reports AI configuration status without exposing secrets");
    assert.ok(capabilities.aiModel === "" || typeof capabilities.aiModel === "string", "AI model metadata is safe string metadata");
    const unauthenticated = await fetch("https://nianbox-cloud.chenzhe223.workers.dev/ai/topic-directions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: "普通人如何用 AI 做出第一个小产品" }),
    });
    assert.equal(unauthenticated.status, 401, "topic directions API rejects unauthenticated calls");
    console.log(JSON.stringify({ ok: true, browser: "Chromium", viewports: [1440, 1024, 390, 360], fallbackImport: "passed", prompt: "passed", workerHealth: health, aiConfigured: capabilities.classify, aiModel: capabilities.aiModel || null, endpointAuth: unauthenticated.status }, null, 2));
    console.log(JSON.stringify({ ok: true, browser: "Chromium", viewports: [1440, 1024, 390, 360], fallbackImport: "passed", prompt: "passed", workerHealth: health }, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
