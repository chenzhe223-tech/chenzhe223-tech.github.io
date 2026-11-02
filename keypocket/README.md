# KeyPocket

KeyPocket 是本地优先的个人 AI 资产管理工具，管理 API Key、Skills、项目与 GitHub 仓库。

正式入口：https://chenzhe223-tech.github.io/keypocket/

## V2.0 当前状态（2026-11-02）
- 原 IndexedDB 与 AES-GCM/PBKDF2 本地加密格式保留。
- 已写入本地加密快照、回收站/tombstone、恢复入口和 V2 导航，尚未完成全部功能测试。
- 本地快照存放在同一浏览器，不是异地云备份；每日检查需要当天打开并解锁页面。
- Skill Radar 四周期 UI 已存在，但没有真实历史数据 collector/API/workflow；无数据时显示空态。
- V2 增量云同步尚未启用；旧 Supabase 手动整库合并仍保留，RLS/并发可靠性未验证。
- KeyPocket GitHub App/Worker 回调/私有 vault 仓库尚未配置。
- 代码已提交不等于功能验收或生产部署完成。

## 数据安全
- IndexedDB：`keypocket-local-v1`，object store：`vault`，DB version 1。
- 现有 API Key/project envelope：AES-GCM；PBKDF2-HMAC-SHA-256 默认 310,000 次。
- 本地密码和派生密钥不得上传。
- 请另行安全保存独立密码加密的备份文件。
- 项目尚未通过独立密码管理器安全审计。

## 目录
- `index.html` 页面/样式/CSP
- `app.js` 本地加密、IndexedDB、项目/Skill/旧同步及 V2 本地恢复框架
- `docs/project-continuity/` 项目状态与交接
- `docs/backup-recovery.md`、`docs/sync-architecture.md`、`docs/skill-radar.md`、`docs/github-app.md` 技术说明
