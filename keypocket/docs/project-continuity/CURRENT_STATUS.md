# KeyPocket — 当前状态

最后更新：2026-11-03（UTC+8）
版本目标：V2.0
总体状态：IN_PROGRESS。本地 API Key、自动快照、回收站、设备撤销 UI、Supabase 会话续期、同步账号密码找回、Skill 精确 URL 查询与移动端弹窗收录流程已通过线上 Playwright/Chromium E2E；真实邮箱投递、双设备云同步、云端跨设备恢复和 iPhone Safari/微信真机兼容仍待验收。
正式入口：https://chenzhe223-tech.github.io/keypocket/
唯一状态源：`keypocket/PROJECT_CONTEXT.md`。

## 最新核验基准
- 仓库：`chenzhe223-tech/chenzhe223-tech.github.io`
- 分支：`main`
- 最终应用资源版本：`kp-v2-skill-import-fix-20261103-23`。
- 最终代码提交：`203387eccf8a7ef85c3fee7bbf1ccd90019182a5`（其后仅有不影响 KeyPocket 的 Radar workflow/脚本提交）。
- Pages build/deploy：run `41550827155` SUCCESS。
- DAVYLAB Browser QA：run `41550827588` SUCCESS。
- KeyPocket Skill Handoff QA：run `41550827587` SUCCESS。

## 五级交付状态

| 模块 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| API Key 本地加密管理 | 是 | 通过 | 正式站 Chromium 运行 | 合成 E2E：新建、多 Key、刷新解锁、搜索/编辑/复制通过 | 是 |
| 本地自动快照 | 是 | 通过 | IndexedDB/备份中心运行 | 合成 E2E：加密导出/导入、本地快照恢复通过 | 是 |
| 回收站/误删恢复 | 是 | 通过 | 回收站页面运行 | 合成 E2E：API Key tombstone/批量恢复、项目恢复保留 ID 通过 | 是 |
| V2 增量云同步 | 是 | 通过 | Supabase 表/RLS/RPC 已核验 | 会话续期 mock 通过；真实双设备同步未执行 | 前后端已部署 |
| 云端加密备份 | 是 | 通过 | 表/RLS/唯一索引核验 | 真实上传/跨设备恢复未执行 | 前后端已部署 |
| 设备管理/撤销 | 是 | 通过 | 正式页面运行 | 撤销 UI/PATCH mock E2E 通过；真实 CAS 拒绝待双设备验证 | 是 |
| Skill Radar | 是；CSP 已加入 `'self'` | collector / Browser QA 通过 | 同源 JSON HTTP 200 | 累计榜 10 卡片 E2E 通过；月/季/年历史仍不足 | 是 |
| 简报 Skill 一键收录 | 是 | 专项 QA 通过 | 线上资源已验证 | Playwright 收录 E2E 通过 | 是 |
| GitHub App / OAuth / 私有 Vault | 页面状态真实说明 | UI 检查通过 | Worker 存在但 subdomain disabled、Secrets 为空 | OAuth E2E 未实现 | 未部署；连接按钮禁用 |
| iOS Safari / 微信 | 页面已部署 | — | 390px Chromium 触屏/弹窗 E2E 通过 | 真机专项未验收；白屏未在自动化中复现 | 页面已部署 |

## 最新 Browser QA 已通过
run `41550827588`（最终资源版本 `kp-v2-skill-import-fix-20261103-23`）：KeyPocket 页面 HTTP 200、IndexedDB 初始化、GitHub Skill 搜索→加密收录、390px 精确仓库 URL（1 次 `/repos/owner/repo`、0 次关键词 Search API）、收录后弹窗关闭、再次打开/关闭、body 滚动锁释放及无 JavaScript pageerror 均 PASS。此前 run `41478022304`（commit `1bd2296`）：本地多 Key 新建与刷新解锁、加密备份导出/导入、误删恢复、本地快照恢复、GitHub 公开仓库导入、项目恢复、390px 布局、401 会话续期/令牌轮换、设备撤销 UI/PATCH/状态刷新均 PASS；本轮新增 Radar 同源 JSON HTTP 200 与累计 Stars 卡片（10 条）检查、GitHub App 未配置提示/禁用按钮检查、密码找回请求/回跳/更新密码 mock E2E，以及 390px Skill 导入弹窗打开/关闭/收录返回均 PASS；无 JavaScript pageerror。

## 当前最高优先级
P0：用真实 iPhone Safari 与微信内置浏览器复测白屏/弹窗；完成 Supabase 自定义 SMTP 与 Redirect URL 配置，用真实 QQ 邮箱验证邮件投递；随后使用独立真实测试账号和两个隔离 profile 完成双向同步、错口令、并发冲突、设备撤销、云备份恢复；禁止使用真实 API Key。
P1：iPhone Safari 与微信内置浏览器专项；回收站 30 天边界和云备份保留清理测试；继续采集 Skill Radar 历史。
P2：冲突可视化、账号恢复引导、GitHub App/OAuth/私有 Vault 评估、migration history 只读对比。

详见 `PROJECT_CONTEXT.md`、`TEST_AND_ISSUES.md` 与 `HANDOFF.md`。


## GitHub OAuth 前置条件
Cloudflare 中的 `keypocket-vault-api` Worker 脚本目前未启用 workers.dev 子域名，Worker Secrets 列表为空，仅有 `APP_ORIGIN` 普通 binding。需先注册 KeyPocket GitHub App、确定 callback URL、启用 Worker 公网入口并配置服务端 Secrets；完成真实 OAuth E2E 前，应用内连接按钮保持禁用。


## 2026-11-03 Skill 导入专项验收
## 2026-11-03 Skill 导入与 iPhone 弹窗稳定性修复

- 完整 GitHub 仓库 URL 走 GitHub `GET /repos/{owner}/{repo}` 精确读取；不再把完整 URL 当作关键词搜索。仓库名/owner 比较采用大小写不敏感，兼容 GitHub URL 大小写规范化。
- 移动端弹窗：取消输入框自动聚焦；弹窗本身在视觉视口内滚动；关闭时取消进行中的搜索并清理 body 滚动锁；收录成功后关闭弹窗并返回项目列表；搜索请求有 12 秒超时提示。
- 修复 Skill 收录数据规范化与错误反馈，项目标签保持 `normalizeProject()` 要求的字符串格式（逗号分隔）。
- HTML 与 app.js 资源版本同步更新为 `kp-v2-skill-import-fix-20261103-23`，强制 Safari 获取最新脚本，避免继续使用旧缓存。
- Browser QA run `41550563288`（commit `164d8b096890726750429541370f92062065fdc3`）SUCCESS；Pages run `41550562420` SUCCESS；Skill Handoff QA run `41550563395` SUCCESS。验证了 Skill 搜索/加密收录、390px iPhone 宽度精确仓库 URL 查询（精确请求 1 次、关键词搜索 0 次）、移动端收录后关闭、弹窗再次打开/关闭、页面可操作、无 KeyPocket JavaScript pageerror。
- 随后资源缓存版本更新至 `kp-v2-skill-import-fix-20261103-23`；Pages run `41550827155`、Browser QA `41550827588`、Skill Handoff QA `41550827587` 均 SUCCESS。该组结果为当前正式资源的最终部署验收。
- **验收边界**：390px Playwright/Chromium 触屏测试通过，不等同真实 iPhone Safari 或微信内置浏览器真机验收。白屏现象在自动化环境未复现，不能声称真机白屏已被完全证实根治。不得要求用户清除网站数据、IndexedDB 或 localStorage。
- 正式入口：https://chenzhe223-tech.github.io/keypocket/ 。

