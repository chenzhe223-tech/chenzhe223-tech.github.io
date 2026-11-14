# DAVYLAB Content Studio · 多端自动同步交接指令

**唯一正式验收标准：** 同一 CloudBase 账号登录 Windows 与 iPhone 后，Windows 新增/修改选题，iPhone 无需手动点击同步即能看到；反向同理。配图、排期、研究、增长记录也自动更新；离线恢复后自动补传；两端同时修改同一记录不可静默覆盖。

## 环境与约束

- 唯一目标：excess-tiglon-d6gjc77qr6fa193f2，CloudBase 上海个人版，PostgreSQL 由用户截图确认已经运行。
- 另一个受限制环境 cloud1-d3guyfuxtfeef189a 禁止使用。
- 原有 public.cron_locks、public.dashboard_metrics、public.mail_board_snapshots 不得改动。
- 网站入口 https://chenzhe223-tech.github.io/topic-studio/ ，GitHub Pages 前端保留。
- 不得推送微信公众号、修改 draft/approved/published 状态，也不得发布真实私有草稿到公开仓库。

## 已实现的自动同步设计

- sync-core.js：覆盖九类浏览器本地数据来源，包含选题、排期、增长、对标研究、研究简报、已发记录、配图风格、视觉 DNA、发现偏好。
- auto-sync-model.js：独立记录的可逆本地写回；无稳定 ID 的历史对标记录采用整体的冲突保护文档，避免伪造 ID。
- auto-sync-engine.js：首次备份、账号绑定、三方基线合并、CAS 修订号校验、保存后自动推送、登录后读取、页面聚焦更新、45 秒定时拉取、离线重试、并发冲突保留。
- pg-sync-adapter.js：锁定 excess-tiglon，先检查当前账号 owner allowlist，生产写入需要显式安全授权。
- auto-sync-ui.js / auto-sync-ui.css：主站登录按钮、手机登录入口、邮箱密码和验证码、会话恢复与同步状态。
- sync-activation.json：正式启用位默认 false；只有云端真实权限与双端验收通过才能开启。
- schema-postgres-p1-excess-tiglon.sql：待执行的专用表、owner-only RLS 和事务 CAS RPC 迁移；不影响其他数据库表。
- SDK 已在仓库 vendoring：CloudBase Web SDK 4.1.0-beta.0。注意这是 Beta，npm latest 稳定版仍是 v3；必须完整验证。
- index.html：主业务模块同步后刷新其内存状态和 UI，不要求用户再按刷新按钮。

## 自动化验收

- cloudbase/test-auto-sync.cjs：模拟双设备首登自动对齐、手机→电脑、电脑→手机、增长/研究/配图、离线重试、并发冲突、账号越权拒绝。
- tests/auto-sync-browser-smoke.py：两个独立 Chromium 会话，Windows 1440px 和手机 390px，调用完全合成的 CloudBase SDK + PostgreSQL 模拟接口，检验无需点击同步的端到端 UI。
- GitHub Actions 运行上述脚本，模拟测试报告不能替代真实数据库 RLS 与 iPhone Safari 测试。

## 尚须实际完成的生产工作

1. 用户已选择 excess-tiglon，但 ChatGPT 当前无 CloudBase 控制台写入连接。应先运行 read-only-preflight-excess-tiglon.sql 只读确认 auth.uid() / auth.role() / auth.jwt()、用户角色和现有表。
2. CloudBase 身份认证开启邮箱登录，网站域名 chenzhe223-tech.github.io 加入安全来源。CloudBase 平台 UIN 不是业务登录 Auth UID。
3. 在正确环境审核执行 schema-postgres-p1-excess-tiglon.sql，仅新增 davylab_ts_v1_ 前缀对象。
4. 使用真实 CloudBase Auth UID 在私有控制台配置本人 allowlist。禁止在聊天和仓库中公开密码、密钥。
5. 真正验证：游客及第二账号拒绝、本账号读写通过、CAS 旧版本冲突、合成记录多端传播、网络中断自动恢复、海外访问与额度控制。
6. Windows 和真实 iPhone Safari 同账号跑双向选题、排期、研究、配图和增长自动对齐验收；同时进行删除/并发冲突、回滚与旧数据无损检查。
7. 所有验证通过后，才将 sync-activation.json 三个开关 enabled、permissionsVerified、productionApproved 打开，并再次在线验收。未通过则保持 false。

## 交付等级（截至 2026-11-15）

- Code Completed：客户端主体和 SQL 脚本已提交。
- Build Passed：固定 SDK 包已生成，纯 JavaScript 语法与模拟同步通过。
- Runtime Verified：本机模拟双设备通过；正式网站浏览器报告尚待核实。
- Functional Tested：模拟版通过，腾讯云实测尚未完成。
- Production Deployed：否，生产写入未开启。

**不能宣称多端同步已完成。** 下一次继续工作应从最新 CI 浏览器报告与 excess-tiglon 的真实安全预检结果入手，不重复讨论架构方案，不降低验收标准。
