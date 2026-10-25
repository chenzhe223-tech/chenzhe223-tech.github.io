# MelodyMe — 音乐人生地图

> 每一首歌，都是你走过的路。

MelodyMe 是一款以城市经历与音乐为线索的创作应用。用户输入四座有意义的城市和一首歌，应用核验城市坐标、匹配真实音乐目录与可用试听片段，生成可播放、可下载 SVG 的动态记忆地图。

## 当前功能

- 四城音乐地图：按经历顺序输入四座不同城市，使用高德地图 Web 服务地理编码核验坐标，以精致的坐标地图绘制记忆路线；路线为视觉连线，不是导航路线。
- 记忆故事、情绪线索、音乐目录候选与 9 种独立视觉规范的海报模式（彩色素描漫画含 3 种子风格）。
- Apple iTunes Search 真实目录查询，自动匹配歌名与歌手；若目录结果提供 `previewUrl`，支持用户主动播放试听片段，不自动播放、不提供完整歌曲流媒体。
- Shazam 作为外部歌曲详情/识曲入口，与试听片段分开；不承诺网页内完整播放或自动播放。
- AI 纪念封面：优先请求 Pollinations.ai；图片加载失败时调用 Cloudflare Worker 的 Workers AI 文生图兜底。封面必须标注“AI 生成封面（非真实专辑封面）”，不替换真实 iTunes artwork 或 SVG 海报。
- 故事与朋友圈文案可编辑；保留 SVG 海报下载、纯文字创作与图片/文字海报路径。
- 城市草稿与当前作品参数保存在本浏览器 `localStorage`。不提供账号、云同步或跨设备同步。


## 高德地图配置（必需）

四城坐标使用高德地图 Web 服务地理编码接口。为了不把 REST API Key 暴露在网页源代码中，前端只请求现有 Cloudflare Worker，密钥只放在 Worker Secret：

```sh
cd melodyme/worker
npx wrangler secret put AMAP_REST_KEY
# 粘贴高德开放平台创建的 Web 服务 Key
npx wrangler deploy
```

在高德开放平台创建 Web 服务 Key，并遵守对应的配额、使用条款和地图数据展示要求。没有配置 `AMAP_REST_KEY` 时，城市核验会明确提示服务未配置，不会伪造城市坐标。修改 Worker 后需要重新部署 Worker；GitHub Pages 只负责前端，不会自动发布 Worker。

## AI 与图片服务

- 文本 AI 通过 Cloudflare Worker 服务端调用 DeepSeek；密钥仅存 Worker Secret，不得放进前端。
- AI 图片首选 Pollinations.ai（无需 API Key）；这是外部公共服务，服务可用性、速率、模型策略及免费政策可能变化。
- 图片兜底使用 Cloudflare Workers AI 绑定。Workers AI 的免费额度、模型可用性与账户限制以 Cloudflare 当前规则为准；不保证无限量免费。
- 首选图片超时/加载失败后尝试 Worker；两者都失败时显示本地渐变占位和明确提示，保留故事、文案与 SVG 海报。
- 图片 prompt 只发送风格、情绪和有限场景关键词，不发送完整故事原文。
- AI 封面是创作装饰，不是真实专辑封面。真实专辑 artwork 只使用 iTunes Search 返回的 URL。
- 不接入音乐生成、AI 视频、完整歌曲播放或需要付费/绑卡的新服务。

## 开发与测试

直接在现代浏览器打开 `index.html` 可查看静态前端；Worker 在 `worker/` 目录中，使用 Node.js 22 运行：

```sh
cd melodyme/worker
npm run check
npm test
```

GitHub Actions 会在相关 PR/push 上运行 Worker 测试。CI 通过不等于线上 Worker 或真实模型端到端验收通过。

## 文档

- [开发状态与升级需求](docs/DEVELOPMENT_STATUS_AND_UPGRADE_REQUIREMENTS.md)
- [PRD](docs/PRD.md)
- [设计系统](docs/DESIGN_SYSTEM.md)
- [技术架构](docs/ARCHITECTURE.md)
- [测试计划](docs/QA_PLAN.md)\n- [海报设计系统](docs/POSTER_DESIGN_SYSTEM.md)

## 工程技能（开发代理使用）

`AGENTS.md` 为 MelodyMe 任务提供技能路由；以下本地 Skill 是开发与验收规范，不会作为浏览器运行时代码加载：

- [前端质量与视觉验收](skills/melodyme-frontend/SKILL.md)
- [浏览器音频试听工程](skills/melodyme-audio-engineering/SKILL.md)
- [音乐目录与 MusicKit 合规接入](skills/melodyme-music-platform/SKILL.md)

这些规范以当前 Web 架构为准：iTunes Search 与真实可用的短试听仍是默认路径。MusicKit 是未来可选集成，不代表当前已接入 Apple Music 完整曲库或原生 iOS 播放能力。

## 验收状态说明

必须分别记录：**已代码修改 / 已跑测试 / 已部署 / 真实端到端验收通过**。本次新功能的代码、CI、部署与真实线上验证状态以对应 PR、Actions 和交付报告为准；未经实际测试不得标注为生产验收通过。
