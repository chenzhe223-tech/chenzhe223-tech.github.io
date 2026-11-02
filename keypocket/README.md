# KeyPocket

KeyPocket 是本地优先的 AI 资产管理工具，管理 API Key、GitHub Skills、开发项目与仓库。

正式入口：https://chenzhe223-tech.github.io/keypocket/

## V2.0 当前状态（2026-11-02）

- 本地 API Key 与项目沿用 IndexedDB `keypocket-local-v1` 和 AES-GCM/PBKDF2 加密 envelope。
- 已实现本地自动加密快照、删除前保护、回收站/tombstone 和 30 天恢复入口；本地快照与密钥库处于同一浏览器存储，不是异地备份。
- 已实现 V2 逐条加密同步、独立同步口令验证、设备登记、版本冲突处理和云端每日/月度加密快照。生产 Supabase 权限已收敛到受限 RPC 写入；**真实账号双设备同步尚未 E2E 验收**。
- Skill Radar collector 和每日历史快照 workflow 已上线；目前只有单日历史，月/季/年增长榜仍在数据积累中，不能把累计 Stars 当作增长速度。
- 简报 Skill 一键收录已通过线上 Playwright E2E。
- GitHub App / Worker OAuth / 私有 Vault 尚未配置，页面状态必须保持“未绑定”。
- iPhone Safari 与微信浏览器仍需专项验收；整站 Browser QA 中“创建后刷新解锁”存在待诊断失败，不能声称本地密钥库功能已全量验收。

## 数据安全

- IndexedDB：`keypocket-local-v1`，object store：`vault`，DB version 1。
- 本地 API Key/project envelope：AES-GCM；PBKDF2-HMAC-SHA-256 默认 310,000 次。
- 本地解锁密码、跨设备同步口令、派生密钥和 API Key 明文不得上传或写日志。
- 云端只保存独立同步口令加密后的密文 envelope；同步记录表只开放按用户 RLS 限制的读取，写入通过校验登录用户和有效设备的 RPC。
- 不要清理浏览器站点数据来“重置”应用；本地快照与密钥库同处 IndexedDB，站点数据清除可能同时删除二者。

## 目录

- `index.html`：页面、样式与 CSP。
- `app.js`：本地加密、IndexedDB、API Key/项目管理、回收站、自动快照、V2 云同步、Skill 收录逻辑。
- `api/skill-radar.json`：真实 Skill Radar 数据 API。
- `data/skill-radar/snapshots/`：历史采集快照。
- `supabase/migrations/`：KeyPocket 同步数据库迁移。
- `docs/project-continuity/`：项目状态、测试问题与交接记录。
- `docs/backup-recovery.md`、`docs/sync-architecture.md`、`docs/skill-radar.md`、`docs/github-app.md`：专项技术说明。

## 验收规则

采用 Code Completed、Build Passed、Runtime Verified、Functional Tested、Production Deployed 五级交付；每一级必须有实际证据。代码提交和 Pages 部署成功不代表功能验收通过。
