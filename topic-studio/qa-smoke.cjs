const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const root = path.resolve(__dirname, "..");
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

    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(80);
      const sizes = await page.evaluate(() => ({ viewport: innerWidth, doc: document.documentElement.scrollWidth }));
      assert.ok(sizes.doc <= sizes.viewport + 1, `no horizontal overflow at ${width}px: ${JSON.stringify(sizes)}`);
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
