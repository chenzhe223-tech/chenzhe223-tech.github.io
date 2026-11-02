# KeyPocket — 项目长期基准

最后核实：2026-11-02（UTC+8）

- 仓库：`chenzhe223-tech/chenzhe223-tech.github.io`，分支 `main`
- 项目：`keypocket/`
- 正式入口：https://chenzhe223-tech.github.io/keypocket/
- 代码事实源：GitHub main 最新提交与可验证 Actions/线上资源。

## 长期不可变原则
1. 最新代码优先；文档与代码冲突时核实后修正文档。
2. 保留 IndexedDB `keypocket-local-v1`、store `vault`、DB version 1。
3. 保留旧 AES-GCM envelope 与 PBKDF2-HMAC-SHA-256 解密兼容；旧记录不得要求重录。
4. API Key 明文、密码和派生密钥不上传、不写日志、不提交仓库。
5. 本地解锁与 GitHub 授权分离；云同步失败不得破坏本地保存。
6. Code Completed / Build Passed / Runtime Verified / Functional Tested / Production Deployed 分别标记。

## 已核实架构
- `index.html`：UI、样式、CSP 与 V2 导航。
- `app.js`：IndexedDB、本地加密、密钥/项目/Skill 管理、旧 Supabase 整库快照同步与 V2 本地恢复框架。
- 旧同步：Supabase Auth + `keypocket_vault_sync` 单行加密 snapshot；按 updatedAt 合并，不是增量事件同步。
- V2 导航：我的密钥、我的 Skills/项目、Skill Radar、回收站、自动备份、同步中心、GitHub 账户。
- 技术说明见 `docs/backup-recovery.md`、`docs/sync-architecture.md`、`docs/skill-radar.md`、`docs/github-app.md`。

## 当前事实边界
- 本地加密快照、软删除/tombstone 与回收站入口已写代码；功能验收仍未完成。
- 本地快照与密钥库在同一浏览器，不能抵御浏览器数据清理/设备丢失；不是异地备份。
- 每日快照依赖用户打开并解锁页面。
- V2 增量同步、Supabase RLS核验、Skill Radar 历史采集、KeyPocket GitHub App/Worker 均未完成。
- 所有模块的完整移动端和功能验收尚未完成。
