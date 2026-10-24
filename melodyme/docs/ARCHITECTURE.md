# MelodyMe 技术架构与实施边界 v0.1

## 当前真实状态
- 目前产品原型以静态 HTML/CSS/JS 运行，记忆数据保存在用户当前浏览器 localStorage。
- 当前前端已接入 DeepSeek Worker 的故事与分享文案生成、海报风格规划调用；实际线上模型响应仍需按当前验收报告确认。iTunes Search 公开目录已接入。认证、云数据库、跨设备同步与公开分享未接入。
- 现有 Supabase 连接可见的项目为其他产品（dashboard-studio、tongxing-aa）；不得把 MelodyMe 数据写入这些项目。
- 当前代码位于 DAVYLAB GitHub Pages 仓库的 `melodyme/` 子目录，尚未建立独立应用仓库。
- 生产后端需要独立 Supabase 项目/明确的数据隔离与服务端 AI provider 配置；新建付费资源前需先确认成本。

## 目标架构（待实施）
- **Web client**：React/TypeScript 可在 MVP 工程阶段引入；先保持页面体验简单，避免不必要的框架迁移。
- **Auth + Postgres**：专属 Supabase 项目；Auth 管理身份，Postgres 保存记忆、作品和任务；RLS 作为数据边界。
- **Storage**：私有对象桶保存用户上传和私有作品；公开作品应使用单独的发布副本/授权流程，不直接暴露原始私有文件。
- **Server API**：Cloudflare Worker 或 Supabase Edge Function 负责鉴权、AI 调用、配额、幂等、错误归一化；只选择一个主要服务端入口，避免双重业务逻辑。
- **AI provider**：由服务端适配器调用；密钥仅存 Secret；记录 provider/model、任务状态、用量和错误类别，不默认记录完整私密提示词。
- **Music metadata**：先允许手动输入歌名/艺人/合法链接；只有在核实条款、可用性和授权后才接入第三方目录或播放能力。
- **Deployment**：当前静态概念页沿用 GitHub Pages；正式应用应在独立仓库和独立发布目标中部署，避免与个人站点工作流互相影响。

## API 约定草案
- `POST /api/memories` 创建记忆；服务端从 session 获取 user_id，不信任请求体 user_id。
- `GET /api/memories` 返回当前用户获准访问的记忆。
- `PATCH /api/memories/:id` 更新并校验所有权。
- `DELETE /api/memories/:id` 执行删除策略并清理派生资源。
- `POST /api/generations` 创建任务，要求幂等键；返回 job id。
- `GET /api/generations/:id` 返回任务状态及可见结果。
- `POST /api/posts` 仅发布用户明确选择的内容快照。
- `POST /api/share-links` 生成一次性/可撤销分享；数据库只存 token hash。
- `DELETE /api/share-links/:id` 撤销分享。

## GenerationJob 状态
`queued → running → succeeded | failed | cancelled`
- 任务需要 owner_id、job_type、status、idempotency_key、attempt_count、provider、model、started_at、completed_at、error_code。
- 同一用户同一幂等键只能创建一个逻辑任务。
- 失败时保留输入草稿；重试应有次数/成本限制。
- 不把服务端 Secret 或第三方错误原文直接返回浏览器。

## 多设备同步
- 以 Postgres 作为云端事实源；每条记录有 id、user_id、created_at、updated_at、version。
- 客户端离线草稿明确标记 pending sync。
- 更新采用乐观并发：version 不匹配时返回冲突，不静默覆盖。
- 删除使用 tombstone 或可追踪的删除事件，避免旧设备把删除数据重新上传。
- 上传/下载仅同步当前用户获准访问的数据；退出登录后清除内存中的敏感数据。

## 上线前的基础设施阻塞
1. 创建专属 Supabase 项目并确认成本/区域。
2. 确定 AI 文本模型 provider 与可用密钥；不要复用其他项目的密钥或把密钥写入前端。
3. 确认正式应用独立仓库/域名/部署目标。
4. 配置 Storage 私有桶与访问策略。
5. 执行真实 RLS、跨账号和撤销分享测试。


## 音乐人生地图 v0.2 增补

### 当前前端交互状态
- 首页使用静态 SVG 地图承载四个可操作节点：记忆、情绪、音乐线索、作品。
- 旅程草稿使用浏览器 localStorage；作品集使用独立的本地键。两者均仅限当前浏览器/设备，不是云备份。
- 文案由本地规则生成，UI 明确标注当前没有真实模型调用。不要把此逻辑包装成在线 AI。
- 歌曲与艺人仅作为可选用户输入；v0.3 已接入用户主动触发的 Apple iTunes Search 公共搜索端点，返回候选及真实 artwork URL。该适配器是浏览器直连，不是后端服务，也不提供歌曲识别或播放。
- 当前外部音乐查询入口只应被描述为查询/识曲入口，不能承诺直接播放或已确认匹配。正式接入前需验证官方跳转和地区可用性。

### 目标 AI 服务边界
定义 provider-neutral 的服务接口，后续按职责拆分：
- `analyzeMemory(input, consent)`：返回结构化线索及置信度，不生成未提供的事实。
- `suggestTracks(clues, provider)`：只返回可追溯来源的候选；每项包含 source、sourceUrl、retrievedAt、verificationStatus。
- `generateStory(memory, preferences)`：生成可编辑文案，并区分用户事实与创作性修辞。
- `composePoster(artwork, theme)`：生成可访问的静态海报布局；真实封面必须带来源，原创视觉不得冒充专辑封面。

这些是目标接口约定，不代表生产服务已部署。服务端负责密钥、速率限制、幂等、成本和错误归一化；浏览器不得持有模型 Secret。

### 真实音乐数据验证
- 优先使用官方或授权的目录/深链接；接入前核对条款、地区可用性、图片使用权及 API 限额。
- 歌曲发行年份、专辑发行年份分别存储。
- 用户输入、AI 候选、外部来源字段和用户确认状态分别存储，不把候选直接升级为已确认数据。
- 不可用或未确认的字段应显示为待确认/未知；不使用随机图片填充真实封面槽位。

### 隐私边界
- 当前 localStorage 原型没有服务器传输，但浏览器存储并非加密保险箱；设备共享时仍可能被同设备用户访问。
- 后端接入后，原始故事默认私密；只向用户明确允许的模型任务传输最小必要文本。
- 不创建公开分享链接，直到实现内容快照、权限校验、撤销/到期与双用户隔离测试。
- 本阶段不实现音乐视频或 AI 视频接口。


## v0.3 音乐目录与风格匹配边界
- 当前前端在用户主动点击后请求 Apple iTunes Search 公共搜索端点，查询歌曲实体，最多显示 8 个候选。没有后端代理、SLA 或自有密钥。
- 目录响应的 trackName、artistName、collectionName、artworkUrl100、releaseDate、trackViewUrl 作为来源字段使用；候选需用户选择。releaseDate 不自动标记为歌曲首次发行年份。
- Shazam 当前仅使用官方站点和用户提供的具体歌曲 URL。未依赖 Shazam 内部未公开 API 或爬取页面元数据；没有宣称网页可 iframe 内嵌播放。
- 12 种海报风格有独立色彩和装饰处理。自动推荐为本地关键词规则，不是 AI。未来接入真实模型后再定义 provider-neutral 风格分析接口。
- 外部搜索会将用户输入的歌曲词发送给 Apple；不会发送原始人生故事。上线前仍需评估 API 条款、地区差异、CORS、限流和封面展示规则。


## v0.3 生产验证快照（2026-10-24）
- 生产提交：`31e2fcd0769e2c3ee2070bf4bdd106e3ea9c91bd`。
- 生产 smoke test：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081612291>；真实查询返回 8 个 iTunes 候选，至少一个候选返回真实 artwork URL，选择后音乐卡显示候选信息。
- 目前音乐数据只在用户主动搜索时请求，搜索词会发送到 Apple；人生故事不随该音乐查询请求发送。
- Shazam 使用用户粘贴的官方歌曲 URL；这是外部链接，不代表 Shazam 在页面内播放，也不代表自动识别故事里的歌曲。
- 真实 AI 模型、服务端代理、账号/云同步、RLS 与跨用户安全测试仍未交付。

## DeepSeek AI adapter (implementation added, deployment pending)

Source: `melodyme/worker/src/index.js`; Wrangler configuration: `melodyme/worker/wrangler.toml`.

- Server-side adapter supports `analyzeMemory`, `inferMusicCandidates`, `compareTrackVersions`, `generateMemoryStory`, `generateSocialCopy`, and `planPosterComposition`.
- The API key is read only from the Worker secret `DEEPSEEK_API_KEY`; it is never bundled into client code.
- Requests are restricted to the configured exact Origin, POST JSON, bounded payloads, 20-second provider timeout, and structured JSON responses.
- Provider/network/timeout/invalid-output errors return explicit error codes. The adapter never fabricates success when the key is missing.
- The Worker source is deployed to the `melodyme-ai` workers.dev endpoint; current branch changes still require a new deployment after merge. Keep deployment and real smoke-test status distinct.
- The existing front end references the deployed Worker for story/share generation and poster-style planning. Real DeepSeek responses remain unverified until a live browser request succeeds; the new image-generation action is not deployed until this branch is merged and released.


## DeepSeek AI adapter (source deployed previously; current production verification remains separate)

Source: `melodyme/worker/src/index.js`; Wrangler configuration: `melodyme/worker/wrangler.toml`.

- Supports `analyzeMemory`, `inferMusicCandidates`, `compareTrackVersions`, `generateMemoryStory`, `generateSocialCopy`, and `planPosterComposition`.
- Reads the key only from Worker secret `DEEPSEEK_API_KEY`; it is not bundled into client code.
- Includes exact-origin check, POST-only JSON, bounded payloads, 20-second provider timeout, and explicit provider/network/invalid-output errors.
- The Worker has been deployed previously as `melodyme-ai`, and the front end references its workers.dev endpoint. The `DEEPSEEK_API_KEY` secret name was confirmed in Cloudflare, but a real model response has not been verified by the current execution environment. Do not mark live inference as accepted until a real browser request succeeds.


## 2026-10-24 implementation addendum: preview audio and generated cover

This section supersedes older statements above that say the Worker source is undeployed or that all AI integration is absent. Status must still be distinguished between code, CI, deployment and real end-to-end verification.

### iTunes preview audio

- The selected iTunes Search result may include `previewUrl`. The UI uses that exact returned URL; it never constructs or guesses a preview URL.
- When present, the selected music card renders an HTML audio control with `preload="none"` and the label “30 秒试听片段”. Playback is user-initiated, not autoplay.
- Starting a different audio element pauses any other page audio element.
- If the selected catalog record has no preview URL, the UI states “该曲目暂无试听片段” and does not render a broken player.
- Preview audio is a short sample only, not full-track playback. Shazam remains a separate external song-detail/recognition link.

### AI decorative cover generation

- Pollinations.ai is the first attempt and requires no API key. Its URL is constructed from a prompt containing only a mapped scene category, selected style and mood keywords; the original story text is never sent to Pollinations.
- A deterministic seed is derived locally from song/style/mood and mapped prompt keywords. The story is only inspected locally to map to a small predefined scene category; raw story text is not transmitted.
- The generated image is displayed separately from both the catalog artwork and the existing SVG poster. It must carry the label “AI 生成封面（非真实专辑封面）”.
- Pollinations image load failure or a 12-second timeout triggers the Worker fallback. If both fail, a local gradient placeholder and the honest message “AI 封面暂不可用，已保留你的文字和海报内容” remain visible.
- The Worker action `generateAlbumArt` uses a Cloudflare Workers AI binding configured as `[ai] binding = "AI"`. Primary model: `@cf/stabilityai/stable-diffusion-xl-base-1.0`; fallback model: `@cf/black-forest-labs/flux-1-schnell` when available to the account. Availability and included/free usage limits are account- and model-dependent; neither unlimited usage nor continuous availability is promised.
- Worker returns image bytes as `image/png`; errors use the existing JSON error envelope and controlled error codes. The image action does not require the DeepSeek key, but still uses the same Origin check, request size bound, rate limiter and explicit timeout.
- AI images are decorative outputs only. They never replace iTunes artwork and do not alter the 12 poster styles or SVG export process.

### Boundaries

No music generation, AI video, complete-song playback, autoplay, account requirement, cloud sync, cross-device sync, paid/credit-card-required service or client-side model secret is introduced. Public-service availability and free quotas can change. CI success is not a substitute for real browser verification of both image providers and the preview player.
