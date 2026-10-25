# MelodyMe — 音乐人生地图

> 每一首歌，都是你走过的路。

MelodyMe 是一款以人生记忆为起点、以音乐为线索的轻量创作应用。用户通过四站地图式流程，逐步生成可编辑的记忆故事、分享文案和纪念海报。

## 当前功能

- 四站探索地图：唤起记忆、找到感觉、发现音乐、收获作品；无需注册，每一步可跳过或返回。
- 记忆故事、情绪线索、音乐目录候选与 9 种独立视觉规范的海报模式（彩色素描漫画含 3 种子风格）。
- Apple iTunes Search 真实目录查询。若所选目录结果提供 `previewUrl`，显示用户主动点击的**30 秒试听片段**；这不是完整歌曲播放，也不自动播放。
- Shazam 作为外部歌曲详情/识曲入口，与试听片段分开；不承诺网页内完整播放或自动播放。
- AI 纪念封面：优先请求 Pollinations.ai；图片加载失败时调用 Cloudflare Worker 的 Workers AI 文生图兜底。封面必须标注“AI 生成封面（非真实专辑封面）”，不替换真实 iTunes artwork 或 SVG 海报。
- 故事与朋友圈文案可编辑；保留 SVG 海报下载、纯文字创作与图片/文字海报路径。
- 当前草稿与作品保存在本浏览器 `localStorage`。不提供账号、云同步或跨设备同步。

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

## 验收状态说明

必须分别记录：**已代码修改 / 已跑测试 / 已部署 / 真实端到端验收通过**。本次新功能的代码、CI、部署与真实线上验证状态以对应 PR、Actions 和交付报告为准；未经实际测试不得标注为生产验收通过。
