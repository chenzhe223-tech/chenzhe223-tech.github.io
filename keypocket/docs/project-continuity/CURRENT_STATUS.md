# KeyPocket — 当前状态

最后更新：2026-11-02（UTC+8）
版本目标：V2.0
总体状态：IN_PROGRESS。本地 API Key、自动快照、回收站、设备撤销 UI、Supabase 会话续期、同步账号密码找回，以及移动端 Skill 导入弹窗生命周期已通过合成 Chromium E2E；真实邮箱投递、双设备云同步、云端跨设备恢复和 iPhone Safari 真机兼容仍待验收。
正式入口：https://chenzhe223-tech.github.io/keypocket/
唯一状态源：`keypocket/PROJECT_CONTEXT.md`。

## 最新核验基准
- 仓库：`chenzhe223-tech/chenzhe223-tech.github.io`
- 分支：`main`
- 本轮 Skill 导入移动端弹窗代码：commit 4bb640dc（Browser QA 41548966622 SUCCESS，Pages 41548966425 SUCCESS）。
- 指定仓库 URL 精确读取逻辑：commit 38c88377；语法/Skill Handoff QA 41549386767 SUCCESS。
- 后续 main commit f67ec5d 的 Pages build 41549584320 SUCCESS，包含精确 URL 修复；对应专项 Browser QA 尚未完成。

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
| iOS Safari / 微信 | 页面已部署 | — | 390px Chromium 视口通过 | 真机专项未验收 | 页面已部署 |

## 最新 Browser QA 已通过
run `41478022304`（commit `1bd2296`）：本地多 Key 新建与刷新解锁、加密备份导出/导入、误删恢复、本地快照恢复、GitHub 公开仓库导入、项目恢复、390px 布局、401 会话续期/令牌轮换、设备撤销 UI/PATCH/状态刷新均 PASS；本轮新增 Radar 同源 JSON HTTP 200 与累计 Stars 卡片（10 条）检查、GitHub App 未配置提示/禁用按钮检查、密码找回请求/回跳/更新密码 mock E2E，以及 390px Skill 导入弹窗打开/关闭/收录返回均 PASS；无 JavaScript pageerror。

## 当前最高优先级
P0：补跑最新代码的精确 GitHub 仓库 URL Browser QA，并用 iPhone Safari 真机复测白屏/弹窗；完成 Supabase 自定义 SMTP 与 Redirect URL 配置，用真实 QQ 邮箱验证邮件投递；随后使用独立真实测试账号和两个隔离 profile 完成双向同步、错口令、并发冲突、设备撤销、云备份恢复；禁止使用真实 API Key。
P1：iPhone Safari 与微信内置浏览器专项；回收站 30 天边界和云备份保留清理测试；继续采集 Skill Radar 历史。
P2：冲突可视化、账号恢复引导、GitHub App/OAuth/私有 Vault 评估、migration history 只读对比。

详见 `PROJECT_CONTEXT.md`、`TEST_AND_ISSUES.md` 与 `HANDOFF.md`。


## GitHub OAuth 前置条件
Cloudflare 中的 `keypocket-vault-api` Worker 脚本目前未启用 workers.dev 子域名，Worker Secrets 列表为空，仅有 `APP_ORIGIN` 普通 binding。需先注册 KeyPocket GitHub App、确定 callback URL、启用 Worker 公网入口并配置服务端 Secrets；完成真实 OAuth E2E 前，应用内连接按钮保持禁用。
