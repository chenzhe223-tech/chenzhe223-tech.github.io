# KeyPocket — 最近一次对话交接

更新时间：2026-11-02（UTC+8）
交接主题：接手 KeyPocket V2.0 升级；核验真实代码、生产数据库安全、QA 失败原因，并更新项目状态。

## 已做的事
1. 以 GitHub `main` 为唯一事实源检查项目目录、代码、连续性文档、最近 commit 和 Actions。
2. 确认项目已有大量 V2 代码，不是“只剩静态页面”：本地加密快照、tombstone 回收站、V2 逐条同步、设备注册、同步口令校验、每日 Skill Radar collector 和 Skill handoff E2E 均已有实现。
3. 核对 KeyPocket 专项 QA run `41408780134` 与 Pages run `41408779662` 均 SUCCESS。
4. 找到整站 Browser QA run `41408780125` 在页面刷新后解锁阶段失败；已提交 `3848c1b` 让后续日志暴露真实 unlock error/step。
5. 生产 Supabase 核验后收回同步表无用权限、旧 RPC 权限。
6. 进一步发现新 RPC INVOKER 设计要求给 authenticated 直接写表权限，导致 CAS/设备校验可被 REST 直写绕过；已改为唯一 authenticated SECURITY DEFINER RPC、空 search_path、显式 auth.uid/active device/user_id 约束，sync_items 表只读，并移除旧 INSERT/UPDATE policy。
7. 数据库查询复验：RLS 开启、sync_items 只保留 authenticated SELECT，RPC 对 authenticated 可执行、anon 不可执行；旧 RPC 禁止执行。
8. 将最终权限迁移文件加入 `keypocket/supabase/migrations/20261102140000_keypocket_sync_rpc_only_mutations.sql`，并准备同步状态文档。

## 尚未证明
- 本地密钥库刷新后再次解锁的稳定性（QA 失败诊断运行尚需查完）。
- 多设备真实登录与完整增量同步 E2E。
- 云端备份真实上传/恢复。
- iPhone Safari 与微信浏览器。
- Skill Radar 有效增长率：当前只有 1 天历史，月/季/年不应声称具备统计意义。
- Supabase Auth 泄露密码检查尚未打开；SECURITY DEFINER Advisor 对唯一受限 RPC 仍会 WARN，属于需持续审查的设计告警。

## 下一个对话必须先做
1. 读取 `keypocket/PROJECT_CONTEXT.md`。
2. 查询最新 Actions，重点读取 `41415872653`（如尚未完成则查后续同 SHA/最新运行）；获取 `KeyPocket reload unlock` 诊断。
3. 按诊断修复 app.js，不允许仅扩大 timeout。
4. 增加 API Key 刷新解锁、备份恢复、回收站恢复专项 E2E。
5. 使用测试账号完成双设备同步 E2E，禁止使用真实 API Key。
6. 每次实质开发更新根项目状态文件和本交接文档。
