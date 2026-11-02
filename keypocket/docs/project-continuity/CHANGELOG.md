# KeyPocket — 变更记录

## 2026-11-02 · V2.0 partial implementation
- 增加 V2 导航：密钥、Skills/项目、Skill Radar、回收站、自动备份、同步中心、GitHub账户。
- 增加本地 AES-GCM 快照、防抖、首次解锁与每日打开后检查。
- 增加 API Key/项目软删除、encrypted tombstone、回收站恢复入口。
- 项目新增/编辑/收藏/删除、Skill收录、热度更新走加密持久化队列。
- Replace导入前尝试创建保护快照。
- 增加备份恢复、同步架构、Skill Radar、GitHub App文档。
- 更新 README 与 SECURITY-ACCEPTANCE。
- 更新 Skill handoff源代码契约断言与 E2E 浏览器存储隔离。

### 验证
- Run 41382408180 / e27d535：syntax PASS、contract PASS、live asset PASS，Playwright FAIL（测试上下文复用旧 IndexedDB）。
- E2E storageState 修复提交 e30311f；需要检查后续 run。
- 后续 e27d535/7cdccec 代码还需最新 HEAD 验收和部署证明。

### 尚未交付
V2增量同步/RLS、云端备份、Skill Radar采集/历史数据、GitHub App/Worker、12个月归档、移动端验收。
