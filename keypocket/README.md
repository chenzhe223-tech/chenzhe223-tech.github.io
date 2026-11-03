# KeyPocket

KeyPocket 是本地优先的 AI 资产管理工具，管理 API Key、GitHub Skills、开发项目与仓库。

正式入口：https://chenzhe223-tech.github.io/keypocket/

## V2.0 当前状态（2026-11-02）

- 本地 API Key 与项目沿用 IndexedDB `keypocket-local-v1` 和 AES-GCM/PBKDF2 加密 envelope。
- 本地自动加密快照、删除前保护、回收站/tombstone 和 30 天恢复入口已实现；最新整站 Browser QA 用合成数据通过刷新解锁、加密备份导入/恢复、误删恢复与本地快照恢复。
- V2 使用独立同步口令逐条加密、版本比较和设备注册；HTTP 401 会触发 Supabase refresh_token grant，保存轮换后的 refresh token，降低长时间运行后会话过期导致同步停止的风险。
- 同步中心可撤销其他有效设备，不允许当前设备自撤销；操作限定当前用户、目标设备和未撤销记录，并检查服务端更新结果。
- 同步账号新增密码找回：通过 Supabase Auth 邮件恢复链接重设账号密码；不会改动本地密钥库密码、跨设备加密口令或现有加密数据。合成 Playwright E2E 已通过，真实邮箱投递仍待自定义 SMTP 与 Redirect URL 配置验收。
- Skill 导入移动端弹窗增加滚动/关闭恢复保护；输入 GitHub 仓库 URL 时直接精确读取指定仓库，避免把 URL 当关键词并误返回 Fork。
- 云端 daily/monthly 加密快照在每次成功同步后更新当前周期内容；生产表权限、RLS 和唯一索引已核验。**真实账号双设备同步和跨设备恢复仍未验收**。
- 最新 Radar/GitHub 状态修复 commit `a1a4127` 的 Browser QA `41435352026`、KeyPocket Skill Handoff QA `41435352002`、Pages 部署 `41435348472` 均通过。此前 V2 本地功能与模拟请求 E2E 通过不等于真实账号双设备网络验收。
- Skill Radar 原先因 CSP `connect-src` 漏掉 `'self'` 而无法读取同源 JSON；a1a4127 已修复。线上 Browser QA 验证 `/keypocket/api/skill-radar.json` 返回 HTTP 200 并渲染累计 Stars 榜 10 条记录。月/季/年增长榜仍因历史跨度不足而保持数据积累中，不把累计 Stars 当作增长速度。
- 简报 Skill 一键收录已通过线上 Playwright E2E。
- GitHub App / Worker OAuth / 私有 Vault 尚未配置：Cloudflare Worker 占位脚本存在，但 workers.dev 未启用、Secrets 为空。应用内连接按钮已禁用并说明前置条件。ChatGPT GitHub connector 不等于 KeyPocket OAuth 授权。
- 390px Chromium 视口检查通过；iPhone Safari 和微信内置浏览器实机专项仍未验收。

## 数据安全

- IndexedDB：`keypocket-local-v1`，object store：`vault`，DB version 1。
- 本地 API Key/project envelope：AES-GCM；PBKDF2-HMAC-SHA-256 默认 310,000 次。
- 本地解锁密码、跨设备同步口令、派生密钥和 API Key 明文不得上传或写日志。
- 云端只保存独立同步口令加密后的密文 envelope；同步记录表仅按用户 RLS 限制读取，写入通过校验用户与有效设备的 RPC。
- refresh token 是认证凭据，仅用于 Supabase Auth 续期；不得写入 console、测试报告或错误日志。
- 密码恢复 access token 仅在恢复页面内存中使用；不得持久化、记录或发送到非 Supabase 服务。
- 不要清理浏览器站点数据来重置应用；本地快照与密钥库同处 IndexedDB，清除站点数据可能同时删除二者。

## 目录

- `index.html`：页面、样式与 CSP。
- `app.js`：本地加密、IndexedDB、API Key/项目管理、回收站、自动快照、V2 云同步、会话续期和 Skill 收录。
- `api/skill-radar.json`：真实 Skill Radar 数据 API。
- `data/skill-radar/snapshots/`：历史采集快照。
- `supabase/migrations/`：KeyPocket 同步数据库迁移。
- `docs/project-continuity/`：项目状态、测试问题与交接记录。
- `docs/backup-recovery.md`、`docs/sync-architecture.md`、`docs/skill-radar.md`、`docs/github-app.md`：专项技术说明。

## 验收规则

采用 Code Completed、Build Passed、Runtime Verified、Functional Tested、Production Deployed 五级交付；每一级必须有实际证据。代码提交或 Pages 部署成功不代表功能验收通过，合成 E2E 也不等于真实双设备已验收。
