# WORLD/TOON 角色、系列与创作流程升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有作品、同步、版权边界与作者审批的前提下，把角色身份、系列规划、热点发现、风格选择和视觉素材接入一条连贯的漫画创作路径。

**Architecture:** 沿用静态前端、Cloudflare Worker、D1 使用配额、Supabase 用户级工作区同步和现有 GitHub QA。通过本地优先的增量字段建立工作区级角色 ID 和别名；DeepSeek、系列规划共用固定供应商的服务端代理；系列、发现、风格和视觉素材作为独立前端模块接入已有工作台。

**Tech Stack:** 浏览器原生 JavaScript/CSS、Cloudflare Workers、D1、Supabase workspace payload、现有 CommonJS Node smoke suites。

**Spec:** `comic-studio/docs/superpowers/specs/2026-11-12-worldtoon-character-series-workflow-design.md`

## Global Constraints

- 角色身份数据仅在当前创作者本地/已同步工作区内跨漫画复用，不跨账号共享或公开检索。
- 原生 AI 保留现有登录与使用次数限制；第三方 DeepSeek Key 只随本次请求发送，不能写入作品、备份或浏览器存储，并须先说明潜在费用。
- AI 结果是可编辑草稿；作者确认前不得覆盖已锁定的剧本、系列计划或角色设定。
- 现代受版权保护的作品不得被抓取或大量复现；热点、版权、来源身份、日期和失败状态必须如实标记。
- 只将 CC0、自有或经授权视觉素材加入生产参考包；逐项保存来源与应用对象。
- 兼容旧 `data.characters`、`creativeDirection.cast`、`characters`、`seriesId`、`seriesBible`、项目备份和用户级同步，不静默删除未知字段。
- 保留 GitHub QA、作者独立审批、私有交付与 WorkBuddy 发布回执门禁；不自动发表。

## Review Focus

- 旧角色字段缺少稳定身份或存在同名角色时，不自动合并；由 Task 1 的角色连续性用例固定行为。
- 重试、并行点击或 AI 返回重复男女主时不重复建档；由 Task 2 的角色生成用例固定幂等行为。
- 长系列计划部分缺集、角色引用不存在或响应 JSON 损坏时不创建半成品系列；由 Task 3 的规划用例固定原子创建。
- 热点来源超时、标题不对应或版权状态未核实时不冒充有效剧情候选；由 Task 4 的空结果与来源匹配用例固定提示。
- 未确认许可的馆藏、服装、图片或用户参考不得进入生产包；由 Task 5 的素材应用与打包用例固定许可门禁。

---

## 文件结构

- `comic-studio/character-continuity.js`：角色档案迁移、稳定 ID、作品别名和生成角色幂等入档的纯数据逻辑。
- `comic-studio/series-planner.js`：全季计划校验、角色圣经连续性、可重复的逐集建档和系列版本处理。
- `comic-studio/discovery-flow.js`：热点与题材的栏目定义、内容类型筛选及候选卡片所需的明确元数据。
- `comic-studio/comic-visuals.js`：素材类型、适用位置、角色/集数/场景应用和许可门禁。
- `comic-studio/extension.js`、`personalize.js`、`workflow-v4.js`、`creative-director.js`：接入角色档案、DeepSeek、系列策划、热点到工作台路由。
- `comic-studio/worker.js`：DeepSeek 角色生成和系列规划安全代理、配额、JSON 校验及固定供应商路由。
- `comic-studio/style-v3.js`、`style-v3.css`、`creative-director.css`、`styles.css`：紧凑风格选择与桌面/手机布局。
- `comic-studio/index.html`、`sw.js`：新模块加载、资产版本和缓存刷新。
- `comic-studio/tests/character-deepseek.cjs`、`editorial-series.cjs`、`comic-engine.cjs`、`style-gallery-browser.cjs`、`mobile-layout.cjs`：对应子系统的新增/更新回归覆盖。

## 执行顺序

角色 ID 与作品别名是系列规划和视觉角色素材的基础；先交付角色连续性，再交付系列规划。热点导航与风格选择不依赖角色数据，可以在角色基础模块落地后并行开发但按原生执行方式串行合并。视觉素材应用最后接入角色、服装和画格 ID。每个工作包可单独验收和提交。

### Task 1: 角色身份与旧档案兼容

**Files:**
- Create: `comic-studio/character-continuity.js`
- Modify: `comic-studio/index.html`, `comic-studio/extension.js`, `comic-studio/personalize.js`
- Test: `comic-studio/tests/character-continuity.cjs`

**Interfaces:**
- Produces `window.WTCharacterContinuity.normalizeWorkspace(data) -> data`：为旧档案补 `characterId`、原生名和作品别名容器；保持 legacy fields 和已有 ID。
- Produces `window.WTCharacterContinuity.upsertGenerated(data, project, candidates) -> {added, linked, unresolved}`：只按显式角色 ID 或作者确认映射，幂等写入明确标注的主角草稿。
- Produces `window.WTCharacterContinuity.displayName(data, characterId, projectId) -> string`：优先返回本作品漫画名，回退原生名。
- Produces `window.WTCharacterContinuity.setComicName(data, characterId, projectId, comicName) -> boolean`：只修改指定作品的漫画名映射。
- Consumes existing `data.characters`, `creativeDirection.cast`, `p.characters`, `persist()`, `uid()`.

- [x] **Step 1: Add failing compatibility cases** in `character-continuity.cjs` for old profiles without IDs, same-name profiles, existing stable IDs, project-specific aliases, explicit lead enrollment, retry idempotency, and unknown workspace fields.
- [x] **Step 2: Run `node comic-studio/tests/character-continuity.cjs`**; it failed because the continuity module was absent.
- [x] **Step 3: Implement the normalization and identity helpers** in `character-continuity.js`, load it before the UI modules, and call it at workspace load without persisting unrelated changes.
- [x] **Step 4: Extend profile editing** to show native name and project comic name separately; allow creating a distinct same-name identity.
- [x] **Step 5: Run `node comic-studio/tests/character-continuity.cjs`** and confirm existing profile edits retain the old display fields and portrait references.
- [x] **Step 6: Commit** as `feat: add workspace character identity and aliases`.

### Task 2: AI 主角自动建档与 DeepSeek 角色生成

**Files:**
- Modify: `comic-studio/worker.js`, `comic-studio/personalize.js`, `comic-studio/extension.js`, `comic-studio/creative-director.js`
- Test: `comic-studio/tests/character-deepseek.cjs`, `comic-studio/tests/director-storyboard-ai.cjs`

**Interfaces:**
- Reuse `WTCharacterContinuity.upsertGenerated(data, project, candidates)` from Task 1 after an AI screenplay response has been parsed and before rendering/saving its draft.
- Extend `/api/ai/characters` request with `provider: 'native' | 'deepseek'`, optional request-scoped `apiKey`, and optional provider-validated `model`.
- Native mode retains current `/api/config` capability, authentication, and D1 daily limit. DeepSeek mode uses a fixed `https://api.deepseek.com/chat/completions` route, a separate metered quota, and never logs/echoes/stores the key.

- [x] **Step 1: Add failing cases** for explicit male/female lead roles, no role/uncertain role, duplicate response candidates, request retry, native quota, DeepSeek missing/invalid key, and response sanitization.
- [x] **Step 2: Run** `node comic-studio/tests/character-deepseek.cjs` and `node comic-studio/tests/director-storyboard-ai.cjs`; the new UI assertion and lead-enrollment assertion failed before implementation.
- [x] **Step 3: Add a validated DeepSeek character branch** to the Worker endpoint while preserving the native model path and D1 quotas; return only normalized character fields and provider/model provenance.
- [x] **Step 4: Update the character generator UI** with an explicit native/DeepSeek choice, one-time key input, cost notice and per-request confirmation; clear the key after the request and keep it out of workspace data.
- [x] **Step 5: Auto-enroll clearly identified male/female leads** from an accepted script as profile drafts; persist uncertain candidates for review and leave screenplay data intact if enrollment returns no profile.
- [x] **Step 6: Run both suites** and confirm provider routing, quota, key ephemerality, idempotent enrollment and no silent script overwrite.
- [x] **Step 7: Commit** as `feat: add AI lead profiles and DeepSeek character drafting`.

### Task 3: 系列全季规划与连续制作

**Files:**
- Create: `comic-studio/series-planner.js`
- Modify: `comic-studio/worker.js`, `comic-studio/index.html`, `comic-studio/workflow-v4.js`, `comic-studio/creative-director.js`, `comic-studio/app.js`, `comic-studio/extension.js`
- Test: `comic-studio/tests/editorial-series.cjs`, create `comic-studio/tests/series-planner.cjs`

**Interfaces:**
- Produces `window.WTSeriesPlanner.validatePlan(plan, data) -> {ok, errors}`; validates all episode numbers, episode summaries, cast refs, continuity rules, and series identity before writes.
- Produces `window.WTSeriesPlanner.createEpisodes(data, seriesPlan) -> project[]`; assigns stable `seriesId`, one-based `seriesEpisode`, `seriesBible`, `seriesPlanVersion`, `characterId` refs, per-episode aliases and outfit/location notes. It is idempotent for `(seriesId, seriesEpisode)`.
- Adds authenticated `/api/ai/series-plan` request with topic/theme, total episode count, audience, provider/model, original/adaptation status, authorized-source metadata and the current creator workspace cast; returns a bounded JSON plan only.
- AI output is a draft. Creation is atomic at the workspace level only after author confirmation; malformed/partial plans do not write projects.

- [x] **Step 1: Add failing plan cases** for complete series arcs, fixed cast/wardrobe inheritance, broken character refs, missing episodes, malformed JSON, duplicate create attempts, and revised plan versions.
- [x] **Step 2: Run** `node comic-studio/tests/series-planner.cjs` and `node comic-studio/tests/editorial-series.cjs`; incomplete plans, broken role refs and duplicate writes are rejected.
- [x] **Step 3: Implement plan validation and project creation** in `series-planner.js`; preserve legacy `seriesId`/`seriesBible` and approved creative locks.
- [x] **Step 4: Implement the authenticated Worker route** with native/DeepSeek/Claude/Gemini/Kimi/Qwen/OpenAI provider wire formats, separate quotas, strict size/episode/cast limits, and copyright prompts.
- [x] **Step 5: Add the series planning UI** from the selected project: choose episode count and audience, review/edit all episodes, cast, wardrobe and world bible, then explicitly confirm before creating the batch.
- [x] **Step 6: Route each confirmed episode** into the existing workbench; later plan versions add missing episodes and do not rewrite existing episodes.
- [x] **Step 7: Run both suites** and confirm whole-season plan, authenticated provider routing, idempotent creation, and legacy series continuity.
- [x] **Step 8: Commit** as `feat: add AI series planning and episode continuity`.

### Task 4: 热点与题材发现信息架构

**Files:**
- Create: `comic-studio/discovery-flow.js`
- Modify: `comic-studio/extension.js`, `comic-studio/story-discovery-ui.js`, `comic-studio/story-discovery-service.js`, `comic-studio/story-discovery.json`, `comic-studio/index.html`, `comic-studio/tests/editorial-live.cjs`
- Test: `comic-studio/tests/editorial-live.cjs`, `comic-studio/tests/worldtoon-story-discovery.cjs`

**Interfaces:**
- `WTDiscoveryFlow.categories` maps stable source IDs to representative Chinese names, content kind, expected source metadata and destination (single-story or series planner).
- `WTDiscoveryFlow.card(item)` produces a presentation model with title, matching summary, source name/URL, source date, fetched/cache date, rights/identity status, and explicit heat-evidence label.
- Source IDs and APIs remain stable for existing cached content and project links; only presentation and flow metadata are added.

- [x] **Step 1: Add failing cases** for source/category alignment, matching title-summary pairs, date/provenance display, failed-source state, empty searches, and heat label honesty.
- [x] **Step 2: Run** the discovery-flow and story-discovery suites; the new flow-model import failed before implementation. The browser-only editorial suite remains unavailable because Playwright is absent.
- [x] **Step 3: Define source-specific navigation and card models** in `discovery-flow.js`; existing source IDs and search APIs remain stable.
- [x] **Step 4: Reorganize the discovery page** into source → identity/rights → story arcs → workbench, with explicit dates, sources and search failure/empty states.
- [x] **Step 5: Use accurate labels** for web drama leads, dated third-party rankings, literature metadata and unverified heat; no official Red Fruit ranking is claimed.
- [x] **Step 6: Run the flow, story-search and v4 workflow suites**; valid candidate handoff and copyright gates passed.
- [x] **Step 7: Commit** as `feat: organize discovery by source and story workflow`.

### Task 5: 视觉素材多维分类与精确应用

**Files:**
- Modify: `comic-studio/comic-visuals.js`, `comic-studio/comic-engine.js`, `comic-studio/creative-director.js`, `comic-studio/extension.js`, `comic-studio/worker.js`
- Test: `comic-studio/tests/comic-engine.cjs`; add applicable reference-application cases to `comic-studio/tests/style-v3-production.cjs`

**Interfaces:**
- Extend a project visual reference with `assetType: 'character' | 'wardrobe' | 'location' | 'prop' | 'lighting' | 'composition'`, `appliesTo: {characterId?, episode?, panelIndices?}`, `usageNote`, `source`, `source_url`, and verified `license`.
- Produces `WTVisuals.validateApplication(reference, target) -> {ok, reason}`; target is a character, outfit/event, location, or panel and only type-compatible applications are accepted.
- Production brief exports references with application targets; no image is copied as finished art.

- [x] **Step 1: Add failing cases** for material types, incompatible targets, CC0 museum sources, self-owned and authorized user metadata, missing classification and unsupported license rejection at packaging.
- [x] **Step 2: Run** the comic-engine suite; panel-scoped application failed before implementation.
- [x] **Step 3: Define asset type and target validation** in `comic-visuals.js`; preserve old records and require reclassification before production export.
- [x] **Step 4: Add context-specific application controls** from the project workbench and classic editor, with per-project, per-character or per-panel bindings; prompts select only matching references.
- [x] **Step 5: Include only CC0, author-confirmed self-owned or evidenced authorized items** in production metadata with original source and target information; block unsupported references at packaging.
- [x] **Step 6: Run comic-engine and style-v3-production suites** and confirm target scoping, rights metadata and packaging rejection.
- [x] **Step 7: Commit** as `feat: apply visual references by creative context`.

### Task 6: 创作台画风选择紧凑化

**Files:**
- Modify: `comic-studio/style-v3.js`, `comic-studio/style-v3.css`, `comic-studio/creative-director.css`, `comic-studio/styles.css`
- Test: `comic-studio/tests/style-gallery-browser.cjs`, `comic-studio/tests/mobile-layout.cjs`

**Interfaces:**
- Preserve `WTStyleV3.CATALOG`, selected `styleId`, style lock payload, existing image assets and accessibility labels.
- Default selector exposes search/category/selected style compactly; expand opens a detail preview without changing the saved style until the user selects it.

- [x] **Step 1: Add failing layout assertions** for collapsed directory, keyboard-accessible disclosure, 25-style catalog retention and compact responsive rules.
- [x] **Step 2: Run** the regression suites; `mobile-layout.cjs` initially failed on a stale version assertion. Playwright browser suite cannot start because `playwright` is not installed in this workspace.
- [x] **Step 3: Implement a compact selector** with accessible expand/collapse and selected-style summary; retain all 25 catalog IDs and preview disclosure.
- [x] **Step 4: Tune desktop and mobile CSS** with a four-column desktop recommendation row, two-column tablet/phone row and compact image thumbs.
- [x] **Step 5: Run** `style-v3-production.cjs` and `mobile-layout.cjs`; both pass. Actual browser selection/persistence remains for Task 7 acceptance.
- [x] **Step 6: Commit** as `feat: compact responsive comic style selector`.

### Task 7: Integration, cache versions and complete release

**Files:**
- Modify: `comic-studio/index.html`, `comic-studio/sw.js`, `comic-studio/README.md`, `comic-studio/docs/`
- Test: `comic-studio/tests/service-worker-cache.cjs`, the relevant character, series, discovery, visuals, style, task-flow and mobile suites.

- [x] **Step 1: Bump cache versions for every changed static module** and confirm all new static modules remain in the Worker allowlist and Service Worker core list. Worker health/header target 4.6.0; existing bindings are not changed.
- [x] **Step 2: Run the relevant existing suites** plus `git diff --check`; 22 local business/data suites pass. Whole-branch review caught and closed a native series-planning `AI_ENABLED` gate gap with a no-invocation regression. Four Playwright browser suites cannot launch locally because the package is absent; CI installs its own browser runtime. No live provider calls or keys are used.
- [x] **Step 3: Review data round trips**: project backup/import serializes the existing full workspace object (including new optional identity/series/reference fields); user sync continues to carry `data` under the existing archive schema; no destructive schema migration was introduced. Compatibility tests cover legacy profile normalization, aliases, series revisions, scoped visual references and protected approvals.
- [x] **Step 4: Update release documentation** with shipped scope, privacy/copyright boundaries, migration behavior and exact evidence still pending.
- [x] **Step 5: Commit** as `chore: integrate worldtoon continuity and discovery release`.
- [ ] **Step 6: Complete browser desktop/mobile acceptance** for the role, series, discovery, visual asset and compact style flows; do not click paid model generation during acceptance.
- [ ] **Step 7: Publish through the existing GitHub QA and Cloudflare Worker path**, preserving D1, AI, Supabase/GitHub secrets, and all existing bindings.
- [ ] **Step 8: Verify production `/health`, versioned script assets, provider controls, data compatibility, and Worker deployment record; report each verified and unverified item separately.**

## Self-Review

- **Spec coverage:** role auto-enrollment and DeepSeek are Tasks 1–2; global-in-workspace character identity/aliases are Task 1; full-season planning/continuity is Task 3; topic/heat navigation is Task 4; visual material scope and use is Task 5; responsive style selection is Task 6; privacy, backups, QA, approval and deployment are Task 7.
- **Step scan:** each task separates behavior contract, implementation, and integration/release; no existing provider endpoint, dataset or source ID is replaced without compatibility mapping.
- **Type consistency:** character helpers use workspace `data` and `project`; project references use stable `characterId`; series planner consumes those IDs and emits `seriesId`/`seriesEpisode` plus `seriesBible`; visual application targets the same IDs and episode/panel numbers.
- **Review focus:** each of the five failure classes has named cases in its owning task.
- **Proportion:** tasks follow current app modules and avoid a database migration, frontend framework rewrite or new image-generation service.
