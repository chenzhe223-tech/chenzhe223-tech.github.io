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
  assert.ok(html.includes('id="section-growth"'), "audience Growth Lab section exists");
  assert.ok(html.includes('id="viralExperimentForm"'), "viral experiment form exists");
  assert.ok(html.includes('id="posterTaskForm"'), "daily poster task form exists");
  assert.ok(html.includes('id="growthMetricForm"'), "growth metric form exists");
  assert.ok(html.includes('data-metric-edit="'), "growth metrics support editing existing records");
  assert.ok(html.includes('id="importGrowthFile"'), "growth data import control exists");
  assert.ok(html.includes('id="exportGrowthCsv"'), "growth metrics CSV export exists");
  assert.ok(html.includes('id="exportGrowthReview"'), "weekly review export exists");
  assert.ok(html.includes('id="growthTrendChart"'), "subscriber trend chart container exists");
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
    page.on("console", message => { if (message.type() === "error" && !/status of 429/i.test(message.text())) errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${address.port}/topic-studio/index.html`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /先说一个念头/ }).waitFor();
    assert.equal(await page.title(), "公众号选题工作台 · DAVYLAB");

    // Visual DNA: theme customization, responsive navigation, motion preview/export and persistence.
    await page.locator("#openVisualSettings").click();
    await page.locator("#visualSettingsDialog[open]").waitFor();
    await page.locator('[data-visual-theme="ocean"]').click();
    await page.locator("#visualBgColor").evaluate(el => { el.value = "#e5f0ff"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.locator("#visualDensity").selectOption("compact");
    await page.locator("#visualRadius").selectOption("16");
    await page.locator("#visualNavMode").selectOption("top");
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("visual-density-compact")), true, "compact density applies immediately");
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("visual-nav-top")), true, "top navigation mode applies immediately");
    await page.locator('[data-visual-tab="motion"]').click();
    await page.locator('[data-motion-effect="stagger"]').click();
    await page.locator("#visualDuration").evaluate(el => { el.value = "1600"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.locator("#previewVisualMotion").click();
    assert.ok((await page.locator("#visualMotionStatus").innerText()).includes("错峰展开"), "selected Motion Lab effect previews in the embedded control panel");
    const motionDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportVisualMotion").click();
    const motionDownload = await motionDownloadPromise;
    const motionConfig = JSON.parse(fs.readFileSync(await motionDownload.path(), "utf8"));
    assert.equal(motionConfig.schema, "davylab.topic-studio.visual-dna/v1", "motion export uses a versioned integration schema");
    assert.equal(motionConfig.motion.effect, "stagger", "motion export preserves selected effect");
    await page.locator("#saveVisualMotion").click();
    await page.locator("#closeVisualSettings").click();
    const visualSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("davylab-topic-visual-dna-v1") || "null"));
    assert.equal(visualSaved.theme, "ocean", "theme preset persists locally");
    assert.equal(visualSaved.colors.bg, "#e5f0ff", "custom background color persists locally");
    assert.equal(visualSaved.motion.effect, "stagger", "motion effect persists locally");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#openVisualSettings").waitFor();
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("visual-density-compact")), true, "density setting restores after reload");
    assert.equal(await page.locator("body").evaluate(el => el.classList.contains("visual-nav-top")), true, "navigation setting restores after reload");
    await page.locator("#openVisualSettings").click();
    await page.locator('[data-visual-theme="qore"]').click();
    await page.locator("#visualNavMode").selectOption("side");
    await page.locator("#visualDensity").selectOption("comfortable");
    await page.locator("#saveVisualSettings").click();
    await page.locator("#closeVisualSettings").click();
    await page.locator(".feedcard").first().waitFor({ timeout: 12000 });
    const radarFirstTitle = await page.locator(".feedcard").first().locator("h3").innerText();
    assert.equal(await page.locator("#radarResultCount").count(), 1, "global AI radar includes a visible/total result counter");
    assert.ok((await page.locator("#radarResultCount").textContent()).includes("/"), "global AI radar shows visible/total result counts");
    await page.locator("#radarSearch").fill(radarFirstTitle);
    await page.locator(".feedcard").first().locator("h3").getByText(radarFirstTitle, { exact: true }).waitFor();
    assert.equal(await page.locator(".feedcard").count(), 1, "global AI radar search narrows results to the matching story");
    await page.locator("#radarSearch").fill("");
    await page.locator("#radarSort").selectOption("source");
    await page.locator("#radarSort").selectOption("fresh");
    const radarBeforeTheme = await page.locator(".feedcard").count();
    await page.locator("#radarTheme").selectOption("models");
    assert.ok(/^显示 \d+ \/ \d+ 条$/.test(await page.locator("#radarResultCount").innerText()), "theme clustering keeps visible/total result count in sync");
    assert.ok((await page.locator(".feedcard").count()) <= radarBeforeTheme, "topic clustering filters the current radar without inventing new items");
    await page.locator("#radarTheme").selectOption("all");

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


    // Growth Lab: target persistence, viral experiment threshold, poster queue and metrics.
    await page.locator('button[data-section="growth"]').click();
    await page.locator("#section-growth.active").waitFor();
    await page.evaluate(() => {
      const url = "https://mp.weixin.qq.com/s/qa-review-article";
      publishedArticles = publishedArticles.filter(a => a.url !== url);
      publishedArticles.unshift({ id: "qa-review-article", title: "QA 7/30 日复盘文章", url, publishedAt: "2026-09-01", column: "AI 实战手记", format: "文章", summary: "", coverUrl: "", linkedTopicId: "", source: "qa", addedAt: new Date().toISOString(), storageSource: "local" });
      savePublishedArticles();
      renderGrowthReviews();
    });
    await page.locator("#reviewArticle").selectOption("https://mp.weixin.qq.com/s/qa-review-article");
    await page.locator("#reviewCheckpoint").selectOption("7");
    await page.locator("#reviewDate").fill(new Date().toISOString().slice(0, 10));
    await page.locator("#reviewReads").fill("240");
    await page.locator("#reviewShares").fill("18");
    await page.locator("#reviewFollows").fill("6");
    await page.locator("#growthReviewForm button[type=submit]").click();
    let reviewCount = await page.evaluate(() => JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "{}").reviews?.length || 0);
    assert.equal(reviewCount, 1, "7-day review saves actual metrics");
    await page.locator("#reviewArticle").selectOption("https://mp.weixin.qq.com/s/qa-review-article");
    await page.locator("#reviewCheckpoint").selectOption("30");
    await page.locator("#reviewDate").fill(new Date().toISOString().slice(0, 10));
    await page.locator("#reviewReads").fill("520");
    await page.locator("#reviewShares").fill("31");
    await page.locator("#reviewFollows").fill("12");
    await page.locator("#growthReviewForm button[type=submit]").click();
    reviewCount = await page.evaluate(() => JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "{}").reviews?.length || 0);
    assert.equal(reviewCount, 2, "30-day review is tracked separately from the 7-day review");
    await page.locator('[data-review-edit="https://mp.weixin.qq.com/s/qa-review-article::7"]').click();
    await page.locator("#reviewReads").fill("250");
    await page.locator("#growthReviewForm button[type=submit]").click();
    reviewCount = await page.evaluate(() => JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "{}").reviews?.length || 0);
    assert.equal(reviewCount, 2, "editing a review updates the existing checkpoint instead of duplicating it");
    await page.locator("#growthReviewList").getByText("7 日 → 30 日表现变化", { exact: true }).waitFor();
    assert.ok((await page.locator("#growthReviewList").innerText()).includes("阅读变化 +270"), "7/30 review comparison calculates the observed cumulative-read difference");
    assert.ok((await page.locator("#growthReviewSummary").innerText()).includes("1 篇文章已有完整 7/30 日双节点数据"), "review summary counts complete 7/30 comparisons");

    await page.locator("#growthActionPlan .growth-action-item").first().waitFor();
    assert.ok(await page.locator("#growthActionPlan .growth-action-item").count() >= 2, "Growth Lab renders data-driven next actions when initial data is missing");
    assert.ok((await page.locator("#growthActionPlan").innerText()).includes("当前真实订阅人数"), "action plan identifies the missing baseline without inventing values");
    await page.locator('#growthActionPlan [data-growth-focus="growthLatest"]').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "growthLatest", "growth action shortcut focuses the relevant input");
    await page.locator("#growthBaseline").fill("120");
    await page.locator("#growthLatest").fill("135");
    await page.locator("#growthStartDate").fill("2026-10-29");
    await page.locator("#growthDeadline").fill("2027-04-29");
    await page.locator("#growthMedianViews").fill("40");
    await page.locator("#saveGrowthTarget").click();
    assert.equal((await page.locator("#growthCurrent").innerText()).trim(), "135", "Growth Lab shows the latest subscriber count");
    assert.equal((await page.locator("#growthRemaining").innerText()).trim(), "365", "Growth Lab calculates remaining subscribers to 500");
    await page.locator("#viralTitle").fill("QA 爆款实验记录");
    await page.locator("#viralType").selectOption("AI 实测");
    await page.locator("#viralStatus").selectOption("published");
    await page.locator("#viralViews").fill("120");
    await page.locator("#viralShares").fill("12");
    await page.locator("#viralFollows").fill("4");
    await page.locator("#viralDate").fill("2026-10-29");
    await page.locator("#viralExperimentForm").locator("button[type=submit]").click();
    await page.locator("#viralExperimentList").getByText("QA 爆款实验记录", { exact: true }).waitFor();
    await page.locator("#viralExperimentList").getByText("达到内部爆款候选线", { exact: true }).waitFor();
    await page.locator("#posterTitle").fill("QA 每日新闻贴图任务");
    await page.locator("#posterDate").fill("2026-10-29");
    await page.locator("#posterStatus").selectOption("qa_passed");
    await page.locator("#posterTaskForm").locator("button[type=submit]").click();
    await page.locator("#posterTaskList").getByText("QA 每日新闻贴图任务", { exact: true }).waitFor();
    await page.locator("#metricDate").fill("2026-10-29");
    await page.locator("#metricFollowers").fill("135");
    await page.locator("#metricArticle").fill("QA 增长数据记录");
    await page.locator("#metricReads").fill("120");
    await page.locator("#metricShares").fill("12");
    await page.locator("#metricNewFollowers").fill("4");
    await page.locator("#growthMetricForm").locator("button[type=submit]").click();
    await page.locator("#growthMetricList").getByText("QA 增长数据记录", { exact: true }).waitFor();
    await page.locator('#growthMetricList button[data-metric-edit]').first().click();
    await page.locator("#metricShares").fill("13");
    await page.locator("#growthMetricForm").locator("button[type=submit]").click();
    const editedMetric = await page.evaluate(() => {
      const x = JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "null");
      return x && x.metrics.filter(m => m.article === "QA 增长数据记录").length === 1 && x.metrics.find(m => m.article === "QA 增长数据记录").shares === 13;
    });
    assert.ok(editedMetric, "editing a growth metric updates the existing record instead of duplicating it");
    const growthSaved = await page.evaluate(() => {
      const x = JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "null");
      return !!x && x.target.latest === 135 && x.experiments.some(e => e.title === "QA 爆款实验记录") && x.posters.some(p => p.title === "QA 每日新闻贴图任务") && x.metrics.some(m => m.article === "QA 增长数据记录");
    });
    assert.ok(growthSaved, "Growth Lab target, experiments, poster tasks and metrics persist locally");
    await page.locator("#metricDate").fill("2026-10-28");
    await page.locator("#metricFollowers").fill("131");
    await page.locator("#metricArticle").fill("QA 前一日订阅记录");
    await page.locator("#growthMetricForm").locator("button[type=submit]").click();
    await page.locator("#growthTrendChart svg polyline").waitFor();
    assert.ok(await page.locator("#growthTrendChart svg circle").count() >= 2, "subscriber trend chart plots recorded metric points");

    page.once("dialog", dialog => dialog.accept());
    const importedGrowth = {
      schemaVersion: 1,
      exportedAt: "2026-10-29T00:00:00.000Z",
      data: {
        target: { latest: 140, medianViews: 40 },
        experiments: [{ id: "qa-import-experiment", title: "QA 导入实验", type: "海外信息差", status: "planned", views: null, shares: null, follows: null, date: "2026-10-29", note: "导入测试", createdAt: "2026-10-29T00:00:00.000Z" }],
        posters: [],
        metrics: [{ id: "qa-missing-follower", date: "2026-10-30", followers: null, article: "缺失值不能当成零" }],
        tasks: { 0: true }
      }
    };
    await page.locator("#importGrowthFile").setInputFiles({
      name: "davylab-growth-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedGrowth))
    });
    await page.locator("#viralExperimentList").getByText("QA 导入实验", { exact: true }).waitFor();
    assert.equal((await page.locator("#growthCurrent").innerText()).trim(), "140", "Growth Lab imports target values");
    assert.equal(await page.locator("#growthTrendChart svg circle").count(), 2, "trend chart excludes imported metrics with missing subscriber values instead of plotting them as zero");
    assert.ok(!(await page.locator("#growthMetricSummary").innerText()).includes("-131"), "growth summary does not calculate missing subscriber values as zero");
    const mergedGrowth = await page.evaluate(() => {
      const x = JSON.parse(localStorage.getItem("davylab-growth-lab-v1") || "null");
      return !!x && x.experiments.some(e => e.title === "QA 爆款实验记录") && x.experiments.some(e => e.title === "QA 导入实验") && x.posters.some(p => p.title === "QA 每日新闻贴图任务") && x.metrics.some(m => m.article === "QA 增长数据记录") && x.tasks[0] === true;
    });
    assert.ok(mergedGrowth, "Growth Lab import merges records and preserves existing data");
    const csvDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportGrowthCsv").click();
    const csvDownload = await csvDownloadPromise;
    const csvPath = await csvDownload.path();
    const csvContent = fs.readFileSync(csvPath, "utf8");
    assert.ok(csvContent.includes("QA 增长数据记录"), "CSV export includes recorded article data");
    assert.ok(csvContent.includes("订阅总人数"), "CSV export includes Chinese column headers");
    const reviewDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportGrowthReview").click();
    const reviewDownload = await reviewDownloadPromise;
    const reviewPath = await reviewDownload.path();
    const reviewContent = fs.readFileSync(reviewPath, "utf8");
    assert.ok(reviewContent.includes("DAVYLAB 公众号增长周复盘"), "weekly review export has a clear title");
    assert.ok(reviewContent.includes("QA 爆款实验记录"), "weekly review includes recorded experiment results");


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
