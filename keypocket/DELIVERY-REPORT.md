# KeyPocket — V2.0 交付与当前状态报告

更新时间：2026-11-02（UTC+8）
正式入口：https://chenzhe223-tech.github.io/keypocket/
代码事实源：GitHub main / `keypocket/`。

## 本轮核验结论
KeyPocket 已从本地优先的 API Key/项目管理基础，推进到 V2 本地快照、回收站、Supabase 增量同步、云端加密备份和 Skill Radar 历史采集框架。上述功能都有代码和部分自动化证据，但不等于全量验收。

## 已完成并有证据
- 原 IndexedDB 与 AES-GCM/PBKDF2 本地数据格式保持兼容。
- 本地自动加密快照、删除 tombstone、回收站恢复与批量恢复入口已实现。
- V2 同步使用独立口令派生加密密钥，逐条同步、版本比较、设备注册、错误口令验证与云端密文备份已实现。
- 生产 Supabase KeyPocket 专属表 RLS 开启；sync_items 已收敛到客户端只读，唯一写入通过经过鉴权/设备校验的 RPC；生产 SQL 权限已回查。
- Skill Radar collector、每日 Actions 与历史快照已实现；单日采集成功。
- 最新已确认 KeyPocket Skill handoff E2E run 41408780134 SUCCESS。
- 对应 Pages deployment run 41408779662 SUCCESS。

## 仍未通过/未验证
- 整站 Browser QA run 41408780125 在 API Key 创建两条合成记录后，重载再解锁未通过。已增加具体诊断；必须先查最新 Actions 诊断，再修复应用。
- API Key 快照恢复和删除恢复专项 E2E 未完整通过。
- V2 双设备、错误口令、设备撤销、云端备份上传与跨设备恢复未使用真实测试账号完成 E2E。
- iPhone Safari 和微信内置浏览器未验收。
- Skill Radar 当前仅单日历史，月/季/年增长榜尚不具备统计意义。
- GitHub App、Worker OAuth 与私有 Vault 仓库尚未配置。

## 生产安全
Supabase 生产权限已收紧：sync_items 表客户端只读，只有 authenticated 可执行唯一 RPC；RPC 内部限制当前用户并检查有效设备；匿名不可执行。Advisor 仍有 Auth 泄露密码保护未开启与受限 SECURITY DEFINER RPC 两项 WARN，详细见 `SECURITY-ACCEPTANCE.md`。

## 本轮交付判断
- Code Completed：V2 核心模块已有实现。
- Build Passed：最新 KeyPocket 专项 QA 与对应 Pages build 曾通过。
- Runtime Verified：页面与若干真实浏览器流程可运行，生产数据库安全设置已核验。
- Functional Tested：部分通过，关键的本地库刷新解锁与真实多端同步尚未验收。
- Production Deployed：b90db14 对应 Pages run 成功；其后的诊断/文档提交仍应以对应 SHA 的最新 Pages run 为准。

详见 `PROJECT_CONTEXT.md`、`docs/project-continuity/CURRENT_STATUS.md` 和 `TEST_AND_ISSUES.md`。
