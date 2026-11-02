# KeyPocket — 变更记录

## 2026-11-02 · V2.0 partial implementation
- 增加 V2 七个模块入口：我的密钥、我的 Skills/项目、Skill Radar、回收站、自动备份、同步中心、GitHub账户。
- 增加本地 AES-GCM 快照、防抖、首次解锁保护快照、每日打开后检查。
- 增加 API Key/项目软删除、encrypted tombstone、回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除、Skill收录与热度更新接入加密持久化队列。
- Replace导入前尝试创建保护快照。
- 增加备份恢复、同步架构、Skill Radar、GitHub App技术说明。
- 更新 README、SECURITY-ACCEPTANCE 和 continuity docs。
- 更新 QA：push静态检查；成功Pages部署后/手动触发线上Playwright。

### 验证
- HEAD `022232f`：KeyPocket QA run `41385211674` syntax/source contract PASS。
- HEAD `022232f`：Pages run `41385211770` build/deploy SUCCESS。
- 最新HEAD的Playwright尚无成功运行证据；旧失败主要是 push/Pages 部署竞态。

### 尚未交付
V2增量同步/RLS、异地云备份、Skill Radar采集/历史数据、GitHub App/Worker、12个月归档、回收站/快照完整E2E、移动端验收。
