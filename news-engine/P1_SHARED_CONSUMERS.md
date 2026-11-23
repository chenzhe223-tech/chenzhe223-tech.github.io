# DAVYLAB News Engine P1 · 三平台共享新闻候选接入

## 目标与边界

用户批准从独立 P0 News API 进入 P1：WorldToon、KNOWA、公众号 Topic Studio 复用真实新闻线索；**不改变原有核心 UI 和已验证生产链路，不调用付费模型、不覆盖知识库、不自动发表漫画、视频、文章或贴图。**

公共只读 API：`https://davylab-news-api.chenzhe223.workers.dev/`。P0 当前索引**仅包含 AI 日报最新一期正式发表内容**，不是实时全网搜索。任何事实都必须返回原始 HTTPS 出处并由作者独立核验。

## WorldToon

- 项目实际浏览器资源位于本仓库 `comic-studio/briefing.js`（`comic-studio/index.html` 引用），不是私有 `worldtoon` **生产交付**仓中的自动发布脚本。
- `AI 前沿简报` 里新增 **News Engine** 选题视图，直接读取 `/api/v1/news?stream=overseas&limit=50`。
- 原有 AI Radar 五大观察、全球、中国、Skill、NOTE、历史、海报、角色、双轨生产、审批与发表流程不变。
- 新闻保留媒体、日期、原文链接、待核验提示；使用原有“收录选题 / 创建漫画草稿”两个入口，**创建草稿不等于自动正式生成或发表**。
- News API 异常时仍可查看原 AI Radar 已发表简报；源图片不存在时保持旧占位视觉。

## 公众号 Topic Studio

- 线上原地址 `https://chenzhe223-tech.github.io/topic-studio/`，已有 `topic-studio/xnews-discovery.js` 及本地 XNews、独立来源镜像。
- 优先从共享 News API 读取来源明确的海外 AI 新闻；转为原选题池使用的元数据形状，保持分类、搜索、去重、文章/贴图入池及原来的审稿排期规则。
- 来源记录采用 `source_kind=news_engine_public_api`，创建选题保留 `origin=news_engine`，原文链接和“待核实”状态。
- News API 失败后保留旧 XNews/独立镜像和本机缓存。**不取消历史 XNews 快照**，只将正常优先来源改为 News Engine，防止海外资讯再次断供。
- 不涉及真实微信后台 token、账号同步、收费模型或发布授权。

## KNOWA

- 现有生产入口：`https://davylab-knowa-p0.chenzhe223.workers.dev`。
- 源代码由 Cloudflare Worker 托管，不能误将个人知识操作系统 `davylab-knowledge-os` 仓库当作 KNOWA 当前生产源码。
- 在已存在的 `GET /api/topics` 上新增 **只读后处理适配器** `news-engine/p1-knowa-topic-adapter.js`，不改原返回结构、原有学术源、知识库、TOPIC_STORE 或任何永久数据。
- 加入的候选单独标记 `AI 技术与产业 · 待核验`、`publishable:false`、媒体与原文链接；**媒体新闻不等同科学研究结论**。
- Cloudflare 同账户 Worker 间直接 fetch 存在兼容限制。优先尝试 News API；请求失败时从**质量门禁 PASS 的正式 AI Radar JSON**中筛选 `news_engine_rss_discovery`，而非伪造选题。两者均不可用时返回原有 KNOWA 结果。
- 原 Worker 5 项绑定在执行 `PUT /workers/scripts/.../content` 后全部保留，未触碰使用量、DeepSeek 密钥、KV、Durable Object 配额；先前版本ID `493da519-fbd1-4966-8465-33146285b75a`，接入前最新基线版本 `801dd60f-8a65-4635-b0ab-fc9086fb7823`，后续回退可按 Cloudflare 部署版本处理。

## 验收

- `node news-engine/test_p1_consumers.cjs` — 仅元数据与权限契约、故障回退，不使用模型。
- `node news-engine/test_p1_browser.cjs` — 真实 Chromium 390/1440 宽度，WorldToon 和公众号页面，不更改正式业务数据。
- KNOWA live smoke — 检查 `GET /api/health` 36 个原知识资产与 `GET /api/topics` 中 News Engine 附加候选、来源、版权和待核验状态。
- GitHub Actions：`.github/workflows/news-engine-p1-consumers.yml`。
- 仓库已有 WorldToon 两条红色 CI **在本次 PR 之前 main 就失败**：baseline `#45130443249`、`#45130443226`，错误涉及旧 `localStoryboardCore` 测试和过时版本期待。此次接入没有改这两套旧模块，不能借这次修复来推翻旧业务内容。需另案处理旧 CI，并清楚区分与 P1 新增测试结果。

## 发布规则

只有独立 P1 CI 的浏览器、离线、KNOWA 生产和原有公众号/News Engine 相关测试通过，才允许合并。合并后再确认实际网站已加载新脚本版本以及真实 News API 新闻候选。P1 完成不意味着 KNOWN/KNO WA 全网实时新闻研究或 WorldToon 自动生产已完成。

## 2026-11-23 正式生产交付验收

**P1 范围内：Code Completed / Build Passed / Runtime Verified / Functional Tested / Production Deployed 全部 PASS。**

- [P1 功能合并 PR #168](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/168)，合并 SHA `610f7311795aa5d9cc264542c52d804fa291881a`。
- [WorldToon CSP 修复 PR #169](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/169)，合并 SHA `1848c36d2e786acc8101ac2f35a8f7bae9d91258`。问题根因：WorldToon Worker 的 HTTP `Content-Security-Policy` 中 `connect-src` 仅允许本站和 Supabase，阻止浏览器访问新增的 `davylab-news-api.chenzhe223.workers.dev`。修复仅将该单一受控域名加入许可清单，保留所有原有安全限制、脚本、密钥和漫画业务。Cloudflare 内容单独更新，实际新增48字节，7项绑定前后一致；线上 Worker 新版本 `8a89382b-8051-4ca0-90af-4792a8187d6c`（可回退原版本 `10a72952-a167-4482-9ff5-1e9eb1c422f1`）。
- [最终 P1 生产 CI #45137657528](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45137657528)：四个 job **全部 SUCCESS**（`consumer-contract`、`consumer-chromium`、`knowa-production-readonly-smoke`、`deployed-production-qa`）。真实 HTTPS 浏览器日志明确为 `P1 PRODUCTION VERIFIED 390 WorldToon + Topic Studio` 和 `P1 PRODUCTION VERIFIED 1440 WorldToon + Topic Studio`。
- [P1 更新后 GitHub Pages 构建 #45137656265](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45137656265)：build、status、deploy **SUCCESS**。
- KNOWA 独立生产 `/api/topics` 检验：保留36个知识资产，当前65个候选中新增6条 `DAVYLAB News Engine` 来源新闻。Cloudflare 同账户 Worker 之间直连受限，KNOWA 使用官方质量验收通过的 AI 日报 JSON 作为回退，不宣称这些是额外全网搜索结果；各条均未核验，`publishable=false`。
- WorldToon 仍有与此次升级无关的旧 CI 失败（旧脚本版本期待、无定义的旧 `localStoryboardCore` 等），在本次开发前 main 上已可复现。上述 P1 独立集成测试和**真实线上浏览器访问**均通过；不能混称全平台既有测试均通过。
- **边界：** News API 仍是最新一期已发布日报的只读新闻/选题服务，不是实时全网搜索；三个平台均不因接入而自动完成新闻事实核验、受版权保护正文复制、漫画图片生成、文章/视频制作或公众号发文。

### 已验收用户入口

- WorldToon（AI 简报内 News Engine 标签）：https://worldtoon.chenzhe223.workers.dev/#/ai-briefing
- KNOWA（科普选题）：https://davylab-knowa-p0.chenzhe223.workers.dev/studio
- 公众号 Topic Studio（海外精选选题）：https://chenzhe223-tech.github.io/topic-studio/
- 共用 News API：https://davylab-news-api.chenzhe223.workers.dev/api/v1/health
