# KeyPocket — 最新交接

更新：2026-11-02（UTC+8）
当前阶段：V2.0 partial implementation / IN_PROGRESS

- 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io
- 项目路径：`keypocket/`
- 正式应用：https://chenzhe223-tech.github.io/keypocket/
- 分支：main
- 已知应用 JS cache-bust：`kp-v2-recovery-20261102-1`
- 源码最近一次核验包括 e27d535；后续代码提交需重新读取最新 HEAD。

## 已写入代码
- 保留 IndexedDB v1/AES-GCM/PBKDF2。
- V2 七个 UI 模块入口。
- 本地加密快照、防抖、首次解锁保护快照、每日打开后快照检查。
- API Key/项目软删除、加密 tombstone、回收站恢复/永久删除入口。
- 项目创建/编辑/收藏/删除和现有 Skill 保存/导入/热度更新接入加密持久化。
- Replace 导入前保护快照。
- Skill Radar UI 无数据时显示空态；同步中心/GitHub账户页明确提示未启用。

## 当前限制
- 本地快照与密钥库处于同一 IndexedDB，不是异地备份；浏览器清理可能一起丢失。
- 每日检查必须用户当天打开并解锁应用；不具备浏览器关闭后后台运行能力。
- 未实现 12 个月归档。
- 回收站和快照恢复尚未完成 E2E。
- V2 增量同步/RLS/two-device 测试未完成；旧 Supabase全量同步仍在。
- Skill Radar collector/API/历史快照未完成。
- KeyPocket GitHub App/Cloudflare Worker/Secrets 未配置。
- iOS Safari/微信浏览器未测。

## CI记录
- Run 41382408180 / commit e27d535：Node syntax PASS、source contract PASS、live asset PASS；Playwright E2E FAIL：重复运行共享旧 IndexedDB 导致创建密码确认栏隐藏。
- e30311f 已改为独立空 storageState；需检查后续 run。
- 7cdccec 加入首次解锁保护快照；最新 HEAD 的测试和部署需重新核实。
- 多个 Pages deployment 中间运行曾被后续提交取消，必须核验最新 HEAD 的 Pages run/线上 JS。

## 下一步
1. 检查最新 Actions：KeyPocket Skill Handoff QA、DAVYLAB Browser QA、Pages。
2. 修复当前 E2E 并对最新 HEAD 重跑。
3. 增加备份/回收站真实 E2E。
4. 建立 Skill Radar collector + daily snapshots。
5. 连接 Supabase live project 检查 schema/RLS，设计 event tables 并先 dry-run。
6. 创建 KeyPocket GitHub App、Worker OAuth callback，最后集中配置 secrets。
7. 验收最新线上 bundle、iOS Safari 和微信浏览器。

## 安全红线
不要清理或覆盖用户原 IndexedDB；不要将 API Key、解锁密码、service role 或 GitHub App私钥写入代码或文档。没有两设备测试/RLS检查证据不得宣称同步已完成。
