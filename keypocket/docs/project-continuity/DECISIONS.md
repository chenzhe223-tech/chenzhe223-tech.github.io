# KeyPocket — 架构决策记录

## ADR-KP-001 — 连续性档案与应用文件分离
- 状态：ACCEPTED
- 日期：2026-10-25
- 决定：连续性档案放在 docs/project-continuity/。

## ADR-KP-002 — 仓库代码与档案需相互核验
- 状态：ACCEPTED
- 日期：2026-10-25
- 决定：实际代码、运行配置与测试证据高于历史档案的状态描述。

## ADR-KP-003 — 以 Supabase Auth/RLS 为多用户访问边界
- 状态：ACCEPTED
- 日期：2026-10-25
- 决定：浏览器使用 Supabase Auth，个人同步数据必须通过 auth.uid() RLS 隔离；不能以客户端加密替代行级访问控制。

## ADR-KP-004 — V2 保留 V1 IndexedDB 与加密格式
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：保留 keypocket-local-v1、store vault、AES-GCM/PBKDF2 和旧密文解密入口。V2 以附加脚本与 kpv2: 系统行实现。
- 原因：避免升级时数据迁移风险与旧密文不可解密。
- 回滚：V2 脚本可从 index.html 移除，原 app.js 和原数据库保持兼容。

## ADR-KP-005 — 逐记录增量同步与版本墓碑
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：V2 主同步表使用 (user_id,entity_type,entity_id) 主键，按 version/updated_at/device_id 决胜；软删除以 deleted_at tombstone 传播。旧整库表保留作迁移源。
- 限制：采用确定性 LWW，不提供字段级 CRDT 合并。

## ADR-KP-006 — 共享云端密钥派生
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：以每用户随机盐和 PBKDF2 从 KeyPocket 本地解锁密码派生共享同步密钥；各设备必须使用相同本地密码。Supabase 登录密码独立。
- 原因：服务端不持有密钥明文；同一用户多个设备可派生一致密钥。

## ADR-KP-007 — Skill Radar 历史口径
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：Stars/Forks 必须每日快照。月/季/年榜基于真实历史快照，不允许用当前 Stars 伪造增长；累计榜明确标注当前 Stars。
- 评分：Stars 增长 70%、Forks 增长 20%、README 相关性 10%。

## ADR-KP-008 — GitHub App 专用私有仓库
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：Worker 只允许访问 keypocket-cloud-vault 固定私有仓库和固定文件；Contents 写入、Metadata 只读；App 私钥只存 Worker Secrets。
- 原因：最小权限，不同步用户其他私有仓库源码。

## ADR-KP-009 — V2 发布采用五级交付
- 状态：ACCEPTED
- 日期：2026-11-02
- 决定：Code Completed、Build Passed、Runtime Verified、Functional Tested、Production Deployed 分别记录，不能互相替代。
