# WORLD/TOON · DAVYLAB AI Radar 接入说明

## 架构（2026-11-09）
- 原站（保持独立发布）：https://chenzhe223-tech.github.io/radar/daily/
- 数据源：`radar/data/latest.json`、`radar/data/history.json`、`radar/data/archive/YYYY-MM-DD.json`
- 官方主海报：`radar/posters/YYYY-MM-DD.png`
- 漫画平台：https://worldtoon.chenzhe223.workers.dev/#/ai-briefing
- Worker API：`GET /api/ai-briefing?date=latest`、`GET /api/ai-briefing?date=YYYY-MM-DD`、`GET /api/ai-briefing/history`
- 前端：`comic-studio/briefing.js`，导航与路由在 `index.html` 和 `app.js`。
- Worker 以明确 commit SHA 为静态资源来源；更新 `app.js` / `briefing.js` / `styles.css` 等生产资源后，必须同步调整 `worker.js` 中的 `ORIGIN` 并重新部署。

## 功能与边界
1. 原生展示今日五大观察、全球 AI 新闻、中国 AI 新闻、热门 Skill、DAVY’S NOTE、每期主海报和历史回看。
2. 新闻图片与标题沿用原 Radar 发布数据；如是主题配图，明确标明非新闻现场。保留原文链接、媒体名称与发布日期。
3. 新闻可收入原有漫画选题池，或创建编辑草稿并打开创作台；未核验事实不视为已证实，绝不自动发布。
4. 只读消费原始日报，不修改日报仓库下的数据或每日生成自动化。前端不直接下载大体积原始 JSON，由 Worker 生成精简结构；上游不可用时显示错误而非伪造新闻。
5. 原有邮箱登录、私有云端同步、角色档案、手动出版、AI_ENABLED=false 和 Worker bindings 不受此次功能变更影响。

## 验收证据
- 静态与脚本：修改后静态模块集成，历史数据结构经过原始 GitHub 数据验证。
- 后端：Cloudflare Worker v2.2.1 PUT 成功；线上 `/api/ai-briefing?date=latest` 返回 HTTP 200，`date=2026-11-09`，含官方海报和全部栏目。
- 历史：`date=2026-11-08` 返回 HTTP 200，包含新闻数组和对应官方海报链接。
- 前端：线上 `/#/ai-briefing` 返回 HTTP 200、能渲染 2026-11-09 正式新闻及源链接、5 大栏目和主海报入口。
- 编辑操作：本地 Chromium 桌面 1440px / 手机 390px 通过分类切换、加入选题、创建草稿、无水平溢出检查。线上自动点击测试超时，故不将线上跨端编辑点击标记为独立验证通过。
- API 映射只传输新闻字段和公开图片，不传输用户密钥、访问令牌或模型推理密钥。

发布责任：By DAVYLAB。
