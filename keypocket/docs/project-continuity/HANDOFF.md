# KeyPocket — 最新交接

更新：2026-11-02（UTC+8）
当前阶段：V2.0 partial implementation / IN_PROGRESS，不是完整 V2 验收通过。

- 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io
- 项目路径：`keypocket/`
- 正式应用：https://chenzhe223-tech.github.io/keypocket/
- 分支：main
- 当前主分支 HEAD：`6f2b9e62f67d8f2e808f257ae398a1293f7c8b74`
- Pages build/deploy run：`41383453487`，该 HEAD build/deploy SUCCESS
- app.js SHA：`76d10a8a3ebd21dc080964cdca4f06e64984d01d`
- index.html SHA：`4778579552ee0d665d47876b97448d6fd65ef4bd`
- E2E harness SHA：`0dcac99813c7a4108752c9789bb3bcad6d721c75`
- KeyPocket QA workflow SHA：`32e35fc7bba8c0cdc8b46bb6fc95ab945a9b74db`

## 已写入代码
- 保留 IndexedDB v1、旧 AES-GCM envelope 与 PBKDF2。
- 新增七个导航/视图入口。
- 本地加密快照、防抖、首次解锁保护快照、每日打开后检查。
- API Key/项目软删除、加密 tombstone、回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除、现有 Skill 收录/导入/热度更新接入加密保存队列。
- Replace 导入前保护快照。
- Skill Radar UI读取 `./api/skill-radar.json`，无数据时显示空态。
- 同步中心明确提示 V2 增量同步未启用；GitHub 账户页明确提示 KeyPocket App 未绑定。
- 新增 backup-recovery / sync-architecture / skill-radar / github-app 说明。

## 已知限制
- 本地快照与密钥库同处 IndexedDB，浏览器清理/设备丢失可能同时丢失，不是云备份。
- 每日快照需要用户当天打开并解锁，不是后台常驻执行。
- 尚未实现 12 个月归档。
- 回收站与快照恢复尚无 E2E 验收。
- V2 增量同步/RLS/两设备冲突处理未完成；旧 Supabase 整库快照同步仍保留。
- Skill Radar collector/API/每日历史快照未完成。
- KeyPocket GitHub App/Cloudflare Worker/OAuth/Secrets 未配置。
- iOS Safari/微信浏览器未测。

## CI / 部署证据
- Run `41383453487`（HEAD `6f2b9e6`）：Pages build SUCCESS、deploy SUCCESS。
- KeyPocket专项 QA 最近完整运行 `41383221465`（旧 HEAD `2513ed8`）：syntax PASS、source contract PASS、published asset PASS；Playwright FAIL，失败点是测试在创建密钥库路径中发现 confirmPassword 隐藏。
- 已更新 E2E：先检测隔离 IndexedDB，再仅清理一次性测试上下文里的测试库；并等待 V2 bundle。该最新测试脚本 `0dcac99` 尚无对应 KeyPocket 专项 QA run。
- 当前没有证据证明新 E2E 通过。不得将静态检查/部署通过替代功能验收。

## 下一步
1. 在 GitHub Actions 页面手动运行 workflow `KeyPocket Skill Handoff QA`（workflow_dispatch）核验 HEAD `6f2b9e6`。
2. 继续修复 E2E；需要输出 lock 页面初始化状态（vault-meta、数据库记录 ID、confirmWrap class），确定为何测试上下文含旧库。
3. 新增专门的快照创建/恢复、API Key/项目软删除/恢复/批量恢复 E2E。
4. 建立 Skill Radar collector + daily snapshots。
5. 连接 Supabase live project 检查 schema/RLS，设计 event-based sync，并先做 dry-run。
6. 创建 KeyPocket GitHub App、Worker OAuth callback，最后集中配置 secrets。
7. 做 iOS Safari/微信浏览器真实设备验收。

## 安全红线
不要清理/覆盖任何用户真实 IndexedDB。不要将 API Key、解锁密码、派生密钥、Supabase service role 或 GitHub App 私钥提交到仓库。没有 RLS/两设备测试证据不得宣称同步完成。
