import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto("http://127.0.0.1:4173/motion-lab/", { waitUntil: "domcontentloaded" });
  await page.locator("#labTitle").waitFor();
  if (!(await page.title()).includes("Visual DNA Motion Lab")) throw new Error("Motion Lab document title missing");

  const card = page.locator("#motionCard");
  await card.click();
  if (await card.getAttribute("aria-pressed") !== "true") throw new Error("Motion card did not toggle to pressed state");
  if (!(await page.locator("#cardTitle").textContent()).includes("反馈已触发")) throw new Error("Motion card status copy did not update");

  // A selected motion must produce a matching, inspectable live preview.
  const springOption = page.locator('.motion-option[data-effect="spring"]');
  await springOption.click();
  if (await springOption.getAttribute("aria-pressed") !== "true") throw new Error("Selected motion preset did not become active");
  if (!(await page.locator("#previewName").textContent()).includes("弹性聚焦")) throw new Error("Selected motion name did not update");
  if (!(await page.locator("#previewDescription").textContent()).includes("放大")) throw new Error("Selected motion description did not update");
  const springAnimations = await page.locator("#previewObject").evaluate(el => el.getAnimations().length);
  if (springAnimations < 1) throw new Error("Selecting a motion did not start a real Web Animations API preview");

  await page.locator("#previewDuration").evaluate(el => {
    el.value = "3500";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const exportedConfig = JSON.parse(await page.locator("#motionConfig").inputValue());
  if (exportedConfig.effect !== "spring" || exportedConfig.durationMs !== 3500) {
    throw new Error("Motion JSON did not reflect the selected effect and tuned preview duration");
  }
  if (!(await page.locator("#previewDurationLabel").textContent()).includes("3.5")) {
    throw new Error("Preview duration label did not update");
  }

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadMotionConfig").click();
  const download = await downloadPromise;
  if (!download.suggestedFilename().includes("spring") || !download.suggestedFilename().endsWith(".json")) {
    throw new Error("Motion JSON download filename did not reflect the selected effect");
  }

  for (const effect of ["fade-up", "slide", "blur", "stagger", "orbit"]) {
    const option = page.locator(".motion-option[data-effect=" + String.fromCharCode(34) + effect + String.fromCharCode(34) + "]");
    await option.click();
    if (await option.getAttribute("aria-pressed") !== "true") throw new Error("Preset selection failed: " + effect);
    const config = JSON.parse(await page.locator("#motionConfig").inputValue());
    if (config.effect !== effect) throw new Error("Preset JSON mismatch: " + effect);
    const count = await page.locator("#previewObject").evaluate(el => el.getAnimations().length);
    if (count < 1) throw new Error("Preview did not animate: " + effect);
    if (effect === "orbit" && !(await page.locator("#previewOrbit").isVisible())) throw new Error("Orbit path is hidden");
    if (effect === "stagger" && !(await page.locator("#previewTrail").isVisible())) throw new Error("Stagger trail is hidden");
  }
  // Scene-first workflow: use-case presets apply coherent effect/timing values and remain editable.
  const sceneExpectations = {
    content: "fade-up", feedback: "spring", panel: "slide", focus: "blur", list: "stagger", brand: "orbit"
  };
  for (const [scene, expectedEffect] of Object.entries(sceneExpectations)) {
    const sceneButton = page.locator('.motion-scenario[data-scenario="' + scene + '"]');
    await sceneButton.click();
    if (await sceneButton.getAttribute("aria-pressed") !== "true") throw new Error("Scene preset did not become active: " + scene);
    const sceneConfig = JSON.parse(await page.locator("#motionConfig").inputValue());
    if (sceneConfig.effect !== expectedEffect) throw new Error("Scene preset effect mismatch for " + scene + ": " + sceneConfig.effect);
    if (sceneConfig.durationMs < 1000 || sceneConfig.durationMs > 5000) throw new Error("Scene preset duration outside supported preview range: " + scene);
    if (await page.locator("#previewName").textContent() === "") throw new Error("Scene preset did not update preview details: " + scene);
  }

  await page.locator('.motion-scenario[data-scenario="panel"]').click();
  await page.locator('.motion-option[data-effect="fade-up"]').click();
  if (await page.locator('.motion-scenario[aria-pressed="true"]').count() !== 0) throw new Error("Choosing a standalone effect left a stale active scene preset");
  await page.locator('.motion-scenario[data-scenario="feedback"]').click();
  await page.locator('.motion-personality[data-personality="editorial"]').click();
  if (await page.locator('.motion-scenario[aria-pressed="true"]').count() !== 0) throw new Error("Choosing a personality left a stale active scene preset");

  // Productivity workflow: named personalities, validated JSON import, and engine-specific code generation.
  const productPersonality = page.locator('.motion-personality[data-personality="product"]');
  await productPersonality.click();
  if (await productPersonality.getAttribute("aria-pressed") !== "true") throw new Error("Product interaction personality did not activate");
  const personalityConfig = JSON.parse(await page.locator("#motionConfig").inputValue());
  if (personalityConfig.effect !== "spring" || personalityConfig.durationMs !== 1500) throw new Error("Product personality did not apply its documented defaults: " + JSON.stringify(personalityConfig));

  for (const engine of ["waapi", "gsap", "motion"]) {
    await page.locator("#motionSnippetEngine").selectOption(engine);
    const snippet = await page.locator("#motionIntegrationSnippet").inputValue();
    if (!snippet.includes(".your-target")) throw new Error("Integration snippet missing target placeholder: " + engine);
    if (engine === "gsap" && !snippet.includes("timeline.fromTo")) throw new Error("GSAP snippet was not generated");
    if (engine === "motion" && !snippet.includes('from "motion"')) throw new Error("Motion vanilla import was not generated");
    if (engine === "waapi" && !snippet.includes(".animate(")) throw new Error("Web Animations API snippet was not generated");
  }

  // Integration snippets must expose cleanup and mirror selected effect-specific values.
  await page.locator('.motion-scenario[data-scenario="feedback"]').click();
  for (const engine of ["waapi", "gsap", "motion"]) {
    await page.locator("#motionSnippetEngine").selectOption(engine);
    const snippet = await page.locator("#motionIntegrationSnippet").inputValue();
    if (!snippet.includes('prefers-reduced-motion: reduce')) throw new Error("Snippet missing reduced-motion guard: " + engine);
    if (engine === "waapi" && !snippet.includes("animation.cancel()")) throw new Error("WAAPI snippet missing animation cleanup");
    if (engine === "gsap" && !snippet.includes("timeline.kill()")) throw new Error("GSAP snippet missing timeline cleanup");
    if (engine === "motion" && !snippet.includes("controls.stop()")) throw new Error("Motion snippet missing controls cleanup");
    if (!snippet.includes("Replace .your-target")) throw new Error("Snippet missing selector setup guidance: " + engine);
    if (!snippet.includes("function mountMotion()") || !snippet.includes("const cleanupMotion = mountMotion()")) throw new Error("Snippet is not wrapped in a runnable lifecycle function: " + engine);
    if (/^\s*return\s/m.test(snippet)) throw new Error("Snippet contains an illegal top-level return: " + engine);
  }
  await page.locator('.motion-option[data-effect="stagger"]').click();
  await page.locator("#motionSnippetEngine").selectOption("waapi");
  if (!(await page.locator("#motionIntegrationSnippet").inputValue()).includes("translateY")) throw new Error("Stagger snippet did not include stagger-style movement");
  await page.locator('.motion-option[data-effect="blur"]').click();
  await page.locator("#motionSnippetEngine").selectOption("motion");
  if (!(await page.locator("#motionIntegrationSnippet").inputValue()).includes('"filter"')) throw new Error("Blur snippet did not include filter animation");

  // Engine snippets preserve multi-keyframe spring motion and keep loops inside the configured total duration.
  await page.locator('.motion-personality[data-personality="product"]').click();
  await page.locator("#motionSnippetEngine").selectOption("gsap");
  const springGsapSnippet = await page.locator("#motionIntegrationSnippet").inputValue();
  if (!springGsapSnippet.includes("timeline.to")) throw new Error("GSAP snippet did not preserve intermediate spring keyframes");
  await page.locator('.motion-personality[data-personality="immersive"]').click();
  await page.locator("#motionSnippetEngine").selectOption("waapi");
  const loopSnippet = await page.locator("#motionIntegrationSnippet").inputValue();
  if (!loopSnippet.includes("duration: 2000") || !loopSnippet.includes("iterations: 2")) {
    throw new Error("Loop snippet must fit two cycles inside the configured 4-second total preview window");
  }

  const importConfig = {
    schema: "davylab.visual-dna-motion/v1",
    effect: "slide",
    durationMs: 3500,
    intensityPercent: 80,
    distancePx: 40,
    direction: "left",
    easing: "cubic-bezier(0.22,1,0.36,1)",
    playback: "once",
    globalTokens: { speed: 1, staggerMs: 90, reducedMotion: false }
  };
  await page.locator("#motionImportJson").fill(JSON.stringify(importConfig));
  await page.locator("#applyImportedMotionConfig").click();
  const importedConfig = JSON.parse(await page.locator("#motionConfig").inputValue());
  if (importedConfig.effect !== "slide" || importedConfig.durationMs !== 3500 || importedConfig.direction !== "left") {
    throw new Error("Valid JSON import did not apply selected effect and tuning values");
  }
  if (!(await page.locator("#motionImportStatus").textContent()).includes("成功应用")) throw new Error("Successful JSON import status was not announced");

  await page.locator("#shareMotionConfig").click();
  const shareUrl = await page.locator("#motionShareUrl").inputValue();
  if (!shareUrl.includes("#motion=")) throw new Error("Share link did not encode the current motion config in its URL fragment");
  const sharedPage = await browser.newPage({ viewport: { width: 1024, height: 900 }, reducedMotion: "no-preference" });
  sharedPage.on("pageerror", error => pageErrors.push("shared page: " + error.message));
  await sharedPage.goto(shareUrl, { waitUntil: "domcontentloaded" });
  await sharedPage.locator("#labTitle").waitFor();
  const sharedConfig = JSON.parse(await sharedPage.locator("#motionConfig").inputValue());
  if (sharedConfig.effect !== "slide" || sharedConfig.durationMs !== 3500 || sharedConfig.direction !== "left") {
    throw new Error("Opening a share link did not restore the motion configuration on a fresh page");
  }
  await sharedPage.close();


  const beforeInvalidImport = await page.locator("#motionConfig").inputValue();
  await page.locator("#motionImportJson").fill(JSON.stringify({ schema:"wrong/version", effect:"orbit" }));
  await page.locator("#applyImportedMotionConfig").click();
  if (await page.locator("#motionConfig").inputValue() !== beforeInvalidImport) throw new Error("Invalid JSON import modified current configuration");
  if (!(await page.locator("#motionImportStatus").textContent()).includes("导入失败")) throw new Error("Invalid JSON import did not explain the failure");

  // Custom presets are stored locally, survive reload, and tolerate malformed storage.
  await page.locator("#customPresetName").fill("My saved slide");
  await page.locator("#saveMotionPreset").click();
  if (!(await page.locator("#savedPresetStatus").textContent()).includes("已保存预设")) throw new Error("Custom motion preset was not saved");
  if (await page.locator("#savedMotionPresets option").count() !== 1) throw new Error("Saved preset did not appear in the local preset list");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#labTitle").waitFor();
  if (await page.locator("#savedMotionPresets option").count() !== 1) throw new Error("Saved preset did not persist after reload");
  await page.locator("#loadMotionPreset").click();
  const loadedSavedPreset = JSON.parse(await page.locator("#motionConfig").inputValue());
  if (loadedSavedPreset.effect !== "slide" || loadedSavedPreset.durationMs !== 3500) throw new Error("Saved custom preset did not restore its configuration");
  await page.locator("#deleteMotionPreset").click();
  if (await page.locator("#savedMotionPresets option").count() !== 1 || !(await page.locator("#savedMotionPresets option").first().textContent()).includes("暂无")) {
    throw new Error("Deleting a custom preset did not restore the empty state");
  }
  await page.evaluate(() => localStorage.setItem("davylab.visual-dna-motion.saved-presets.v1", "{malformed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#labTitle").waitFor();
  if (!(await page.locator("#savedMotionPresets option").first().textContent()).includes("暂无")) throw new Error("Malformed local storage broke the saved preset empty state");
  await page.evaluate(() => localStorage.removeItem("davylab.visual-dna-motion.saved-presets.v1"));
  await page.locator("#speed").evaluate(el => {
    el.value = "1.4";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  if ((await page.locator("#speedValue").textContent()).trim() !== "1.4×") throw new Error("Speed control output did not update");

  await page.locator("#reduceMotion").check();
  if (!(await page.locator("#controlNote").textContent()).includes("减少动态效果已开启")) throw new Error("Reduced-motion control did not update status");
  if (!(await page.locator("#motionStatus").textContent()).includes("减少动态效果")) throw new Error("Motion preview did not explain reduced-motion behavior");
  const reducedAnimations = await page.locator("#previewObject").evaluate(el => el.getAnimations().length);
  if (reducedAnimations !== 0) throw new Error("Motion preview continued animating after reduced-motion was enabled");

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth
    }));
    if (dimensions.page > dimensions.viewport + 1) {
      throw new Error(`Horizontal overflow at ${width}px: page=${dimensions.page}, viewport=${dimensions.viewport}`);
    }
  }

  if (pageErrors.length) throw new Error("Uncaught page errors: " + pageErrors.join(" | "));
  console.log("PASS: Motion Lab loads, card interaction works, controls update, and 1440/1024/390px layouts have no horizontal overflow.");
} finally {
  await browser.close();
}
