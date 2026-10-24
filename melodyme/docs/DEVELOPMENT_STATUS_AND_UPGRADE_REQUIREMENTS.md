# MelodyMe 开发情况与升级需求交接文档

> 文档更新时间：2026-10-24  
> 产品：MelodyMe｜音乐人生地图  
> 产品主张：每一首歌，都是你走过的路。  
> 生产地址：https://chenzhe223-tech.github.io/melodyme/  
> GitHub 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io  
> AI Worker：`melodyme-ai`  
> Worker 预期地址：https://melodyme-ai.chenzhe223.workers.dev  
> 本文用于后续开发对话接续、任务交接、升级实施和验收；请以实际代码、线上测试与 CI 结果为准。

---

## 1. 产品定位与体验原则

MelodyMe 是一款围绕「人生记忆 × 音乐 × 个人表达」的轻量创作应用。用户从一句记忆或一段人生经历开始，逐步补充情绪、音乐线索，并将其整理为个人故事、朋友圈文案和纪念海报。

核心体验不是填写复杂表单，而是渐进式探索：

1. 唤起记忆：先让用户用一句话开始。
2. 找到感觉：通过情绪与线索补充记忆。
3. 发现音乐：查找、比较并确认真实歌曲及版本。
4. 收获作品：生成可编辑的故事、分享文案和海报。

### 产品原则

- **真实优先**：歌曲、艺人、专辑、封面、年份和外部链接必须有真实来源；AI 猜测只能明确标注为候选，不能伪装成已核验事实。
- **低门槛**：尽量减少必填项，允许跳过、返回、修改，不要求用户一次性完成所有信息。
- **用户可控**：生成结果可编辑；用户可确认、更换或跳过候选。
- **本地优先与隐私透明**：当前作品保存在当前浏览器；不得声称已支持云端或跨设备同步。
- **保留创作自由**：12 种既有海报风格、纯文字输出、地图探索路径均应保留。
- **移动端优先**：布局清晰、可读、操作区域易触达，不出现横向溢出。
- **不做虚假承诺**：不承诺网页内自动播放；Shazam 作为外部识曲/歌曲页面入口。

## 2. 当前功能与技术现状

### 2.1 前端与托管

- 前端为静态网页，主文件：`melodyme/index.html`。
- 生产托管：GitHub Pages。
- 无需登录即可体验。
- 当前数据使用浏览器 `localStorage`；作品、草稿不是云端账户数据。
- 当前保存的作品明确属于本设备/当前浏览器；清理浏览器数据可能导致本地内容丢失。
- 页面包含四站地图式流程、故事输入、情绪选择、音乐查找、风格选择、文案编辑、作品保存与 SVG 海报导出等交互。

### 2.2 音乐目录

- 前端集成 Apple iTunes Search 公共目录查询。
- 用户输入歌名或歌手后可搜索候选，并查看目录返回的歌曲、艺人、专辑和封面信息。
- 用户选择候选后，歌曲与艺人字段更新为目录候选；界面仍应提示用户核对匹配关系。
- 目录查询依赖外部服务、网络和地区可用性；查询失败时应清楚提示，不能生成假封面或假目录结果。
- 目录返回的专辑发行日期不应直接被当作单曲发行年份；需要区分专辑年份与单曲年份。
- Shazam 链接输入已做域名和歌曲路径校验，要求指向具体歌曲页面；不能把 Shazam 首页伪装成歌曲专属链接。
- 不保证 Shazam 网页内嵌播放，也不承诺自动播放。

### 2.3 海报与创作输出

当前保留以下 12 种风格，升级不得删除或随意改名：

1. 电影雾光
2. 旧照片
3. 海边蓝调
4. 城市夜色
5. 胶片日记
6. 温柔水彩
7. 极简留白
8. 复古唱片
9. 星夜诗篇
10. 旅行手账
11. 花园记忆
12. 午夜电台

- 支持手动选择风格。
- 支持图片/文字海报及纯文字创作的产品方向；不得为了新增 AI 功能而移除纯文字模式。
- 支持编辑生成的故事与朋友圈文案。
- 当前海报导出实现为 SVG 下载；后续验收需验证文件可打开、文字无截断、移动端操作正常。
- 本地关键词规则推荐仍作为 AI 不可用时的降级路径。

### 2.4 Cloudflare Worker / DeepSeek AI 服务

- Worker 名称：`melodyme-ai`。
- 源码：`melodyme/worker/src/index.js`。
- 配置：`melodyme/worker/wrangler.toml`。
- 测试：`melodyme/worker/test/worker.test.js`。
- CI：`.github/workflows/melodyme-worker-ci.yml`。
- 模型默认配置为 `deepseek-chat`，调用 DeepSeek Chat Completions API。
- `DEEPSEEK_API_KEY` 已在 Cloudflare Worker 的 Secret 绑定列表中确认存在。**此确认只证明 Secret 名称已配置，不代表密钥有效，也不代表真实模型调用已通过。**
- Worker 具备六类动作接口：
  - `analyzeMemory`：分析记忆线索。
  - `inferMusicCandidates`：推断可能的音乐候选；输出必须标为 AI 推断/未核验，不得冒充目录事实。
  - `compareTrackVersions`：比较候选版本与记忆线索的匹配度。
  - `generateMemoryStory`：生成记忆故事。
  - `generateSocialCopy`：生成分享文案。
  - `planPosterComposition`：规划海报构图与风格建议。
- 安全措施包括：精确 Origin 检查、仅允许 POST（OPTIONS 预检除外）、请求体大小限制、输入/输出结构校验、超时控制、错误状态映射、Cloudflare Rate Limiter 绑定。
- Worker 不应向浏览器暴露 DeepSeek API Key；密钥只能保存在服务端 Secret 中。
- AI 返回的音乐候选不得直接被当成已核验的真实歌曲；必须通过真实目录查询和用户确认完成验证。

## 3. 最近代码变更与验证记录

### 已完成

- PR #35 已合并：第一阶段 Worker AI 适配器、安全控制、测试与文档。
  - https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/35
- PR #36 已合并：将「自动推荐海报风格」连接到 Worker 的 `planPosterComposition` 接口；仅接受 12 种现有风格之一，AI 失败或返回未知风格时回退本地关键词推荐。
  - https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/36
- PR #36 合并提交：`0cd7f16d9036628c7d0ef903c372ea3bd55c32b3`。
- 已有 Worker CI 成功记录：语法检查与 Worker 测试通过。
- PR #36 对应的原型 QA 运行：  
  https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40089720561  
  该运行的 HTML/嵌入式 JavaScript 检查、浏览器 QA 脚本语法检查、桌面与移动端 journey smoke tests 均通过。

### 尚未完成最终验证

- 当前执行环境访问 `melodyme-ai.chenzhe223.workers.dev` 时遭遇网络策略拦截，因此没有从该执行环境取得可验证的线上 Worker HTTP 响应。
- 尚不能宣称 DeepSeek 真实推理已在生产环境验收通过。
- 尚需在真实浏览器中测试 AI 海报风格推荐、故事生成和分享文案生成，确认页面确实显示模型响应，而不是本地降级结果。
- 需要检查 GitHub Pages 是否已发布 PR #36 合并后的最新代码，再执行线上回归。
- 当前 CI 的桌面/移动冒烟通过不等于完整端到端生产验收；真实音乐目录、真实 DeepSeek 调用、真实用户操作仍需单独验证。

## 4. 升级需求清单

### P0 — 真实 AI 生产链路与验收

1. **确认 Worker 真实调用 DeepSeek**
   - 通过真实浏览器向 Worker 发起请求。
   - 验证成功响应中的 `ok`、`action`、`model`、`result` 与生成时间。
   - 分别验证有效请求、缺少 Secret、无效输入、模型错误、超时、限流和错误 Origin 的行为。
   - 不在日志、前端或报告中输出密钥值。
2. **把 AI 海报推荐真正验收通过**
   - 输入不同故事与情绪线索，点击自动推荐。
   - 结果只能是上述 12 种风格之一。
   - AI 成功时应明确显示 AI 推荐；失败时应明确显示本地规则降级提示。
   - AI 推荐不得擅自覆盖用户手动选择，除非用户主动再次请求推荐。
3. **接通并验收故事与分享文案生成**
   - 生成的故事不虚构用户未提供的经历、关系或事件。
   - 朋友圈文案自然、简洁、可编辑。
   - 失败时保留用户输入与本地初稿，不丢数据、不阻断流程。
4. **检查生产发布**
   - 确认 GitHub Pages 生产页面已包含合并后的代码。
   - 线上实际验证，而不是只依据仓库提交或 CI 推断已部署。

### P1 — AI 记忆理解与真实音乐发现

1. 把 `analyzeMemory` 接入真实用户路径：抽取人物、人生阶段、时间、地点、关系、情绪、音乐类型等线索，并明确标注不确定性。
2. 把 `inferMusicCandidates` 接入音乐发现流程：AI 仅生成候选歌名/艺人/检索关键词与简要匹配理由。
3. 对 AI 候选逐一使用 Apple iTunes Search 等真实目录核验；目录未返回的字段显示“待核实”，禁止编造封面、年份、专辑或歌曲链接。
4. 支持多个真实候选供用户确认、替换或跳过；保留用户原始线索。
5. 对同名歌曲、翻唱、现场版、重录版、Remaster、不同专辑版本进行区分。
6. 将 `compareTrackVersions` 用于版本匹配辅助：明确比较依据与缺失证据，不把模型推断包装成客观事实。
7. 发行年份必须区分单曲与专辑；无法核实则不显示或明确标注未知。
8. Shazam 链接必须指向经过验证的具体歌曲页面；禁止自动拼接猜测 URL 或退回首页后声称已找到歌曲。

### P1 — 创作体验与视觉质量

1. 保留地图探索式的四步流程，避免退回复杂长表单。
2. 12 种海报风格全部保留，逐一验证手动切换、AI 推荐、文字可读性、配色对比度与导出结果。
3. 明确提供两种结果路径：
   - 图片/文字组合海报；
   - 纯文字故事与分享文案。
4. 用户可以确认、更换、跳过歌曲候选；可以编辑故事、朋友圈文案和海报文字。
5. AI 不可用时必须有清楚、诚实的降级提示，且不能清空输入或保存内容。
6. 继续保持暖白、深蓝、低饱和、具有编辑感的视觉风格；重点改善移动端可读性、按钮间距、卡片层级与长文本换行。
7. 不新增音乐生成或 AI 视频生成；这两项不属于本阶段需求。

### P2 — 数据、隐私与后续架构

1. 当前只支持本地浏览器保存；任何介绍和 UI 文案都不得宣称账号、云同步或跨设备同步已完成。
2. 若未来增加账号/云同步，需单独制定数据模型、用户授权、隐私说明、删除/导出流程与安全测试，不应混入本轮 AI 接入而未经验证上线。
3. 对故事等个人内容采用最少必要发送原则：只向 AI 发送当前任务所需字段，避免记录不必要的个人内容。
4. 明确告知用户 AI 服务会处理其主动提交的故事内容；在真实部署前检查隐私说明、错误日志和第三方请求行为。
5. 为核心 AI 接口补充可复现测试样例，覆盖正常、边界、无效输出、网络失败、超时与限流情境。

## 5. 必须遵守的约束

- 不删除现有 12 种海报风格。
- 不删除地图探索式体验。
- 保留纯文字模式和图片/文字海报模式。
- 不要求注册后才能体验当前核心流程。
- 不编造歌曲、艺人、专辑、封面、发行年份、Shazam URL 或 AI 生成来源。
- 不把 AI 推断当成真实音乐目录验证结果。
- 不宣称自动播放、云同步或跨设备同步已实现，除非真实开发并通过验收。
- 不开发音乐生成或 AI 视频功能。
- 不因 AI 服务故障而丢失用户输入、阻断核心体验或隐藏降级事实。
- 未经真实线上验证，不得把功能标记为生产验收通过。

## 6. 生产验收标准（Definition of Done）

只有以下项目全部通过，才能将本阶段标记为“生产验收完成”：

- [ ] 最新主分支代码已发布到 GitHub Pages，线上页面与预期提交一致。
- [ ] Worker 的真实 DeepSeek 请求成功返回，模型响应结构正确。
- [ ] 海报风格 AI 推荐成功；结果限定在 12 种既有风格内。
- [ ] AI 不可用、超时、限流时有正确提示和本地降级，不丢输入。
- [ ] 记忆故事与朋友圈文案通过真实模型生成、内容边界和编辑流程测试。
- [ ] iTunes 真实查询可用；候选歌曲、艺人、专辑信息与封面均来自目录响应。
- [ ] AI 音乐候选经过目录核验后才显示为已核实；未核实内容明确标注。
- [ ] 歌曲版本比较不虚构证据；年份与版本信息区分准确。
- [ ] Shazam 入口指向具体歌曲页面，并验证域名和路径。
- [ ] 12 种风格均可选择、渲染和导出；纯文字模式可用。
- [ ] 桌面与移动端核心流程通过真实浏览器回归，无明显横向溢出、JS 错误或内容截断。
- [ ] 本地保存、刷新恢复、编辑、删除和导出行为符合预期。
- [ ] Worker 的 Origin、请求大小、方法、限流、超时和错误处理测试通过。
- [ ] README、架构文档、PRD、QA 计划与实际实现保持一致，不再保留过时的“没有真实 AI”或“Worker 尚未部署”等冲突描述。
- [ ] 验收报告明确区分“代码合并”“CI 通过”“已部署”“真实端到端验收通过”四种状态。

## 7. 后续执行顺序

1. 先完成生产页面与 Worker 的真实端到端请求验证。
2. 逐项验收已接入的风格推荐、故事生成和分享文案生成。
3. 把记忆分析、音乐候选、版本比较接入用户流程，并以真实目录结果核验音乐事实。
4. 完成 12 种风格、纯文字模式、桌面/移动端、保存/导出回归测试。
5. 同步修订 README、架构、PRD 和 QA 文档，清除与当前实现冲突的旧说明。
6. 发布并记录最终验收证据、提交 SHA、CI 运行链接和已知限制。

**交接原则：持续推进直到真实验收完成；不因计划或代码合并而提前停止。只有确实需要用户授权或在用户侧执行无法代办的操作时，才提出明确、最少的请求。**


---

## v0.4 implementation handoff — iTunes preview + AI decorative cover (2026-10-24)

### Scope of this change

- Add a 30-second audio preview player for the selected iTunes candidate only when the catalog result includes `previewUrl`; source is the returned URL unchanged, playback is user-initiated, and other audio elements pause when playback starts.
- Keep Shazam as a separate external song page/recognition entry.
- Add a separate decorative AI cover area, not replacing the poster, catalog artwork, or SVG export.
- Use Pollinations.ai first with prompt keywords derived locally from a fixed style map, selected moods, and a small mapped scene category. The original story text is not included in the Pollinations request.
- Use a deterministic seed derived from song/style/mood/mapped prompt terms.
- Pollinations image failure or 12-second timeout triggers Worker `generateAlbumArt`; two-provider failure leaves a local gradient placeholder and preserves text/poster content.
- Add Cloudflare Workers AI binding `[ai] binding = "AI"`. Primary model is `@cf/stabilityai/stable-diffusion-xl-base-1.0`; fallback is `@cf/black-forest-labs/flux-1-schnell` when available. Free quotas and model availability are not guaranteed or unlimited.
- Worker image response is binary `image/png`; errors use controlled JSON codes. Image generation does not require the DeepSeek key, but still follows exact Origin checks, POST-only, payload limit, rate limiting and timeout controls.

### Code changes prepared on branch

Branch: `feat/melodyme-preview-ai-cover`

Files changed:
- `melodyme/index.html`
- `melodyme/worker/src/index.js`
- `melodyme/worker/wrangler.toml`
- `melodyme/worker/test/worker.test.js`
- `melodyme/README.md`
- `melodyme/docs/ARCHITECTURE.md`
- `melodyme/docs/PRD.md`
- `melodyme/docs/QA_PLAN.md`
- this handoff document

### Status at handoff

- [x] Code edits committed to a feature branch.
- [x] Added Worker unit test cases for valid image response, origin, method, oversized body, prompt/dimensions validation, missing binding, provider errors, and absence of secret data in response.
- [ ] Worker syntax check and unit tests have not yet been confirmed for this branch.
- [ ] Desktop/mobile journey tests have not yet been confirmed for this branch.
- [ ] PR not yet merged.
- [ ] Worker binding/model fallback not yet deployed to Cloudflare.
- [ ] GitHub Pages deployment not yet confirmed.
- [ ] Real iTunes preview playback, Pollinations generation, Worker fallback and total-failure preservation not yet verified in a production browser.

### Required next actions

1. Run `npm run check` and `npm test` in `melodyme/worker` through CI.
2. Run existing desktop/mobile prototype journey smoke tests and extend them if the harness can reliably stub audio and image services.
3. Review any test failures, then open/merge PR only when CI is green.
4. Deploy Worker config and code; confirm `AI` binding is attached. No new secret is required for image generation.
5. Confirm Cloudflare Workers AI model availability and actual account-included usage limits; model fallback is best-effort.
6. Verify production browser flows for audio, Pollinations, Worker fallback and graceful degradation.
7. Update this document with exact CI run, merge SHA, deployment evidence and real end-to-end status. Never infer deployment or acceptance from code merge alone.
