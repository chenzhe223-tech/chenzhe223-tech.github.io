# KeyPocket — 测试与问题记录

## KP-ISSUE-001 — CSP 与安全验收文档冲突
- 状态：DOCS_UPDATED_NEEDS_RUNTIME_VERIFICATION
- 严重级别：HIGH（文档准确性与安全审查优先级；不等于已确认漏洞）
- 发现日期：2026-10-25
- 原始证据：
  - index.html CSP 的 connect-src 包含 GitHub API 和 Supabase URL。
  - 旧版 SECURITY-ACCEPTANCE.md 声称 connect-src 'none'。
- 处理：已更新 SECURITY-ACCEPTANCE.md，明确当前客户端网络依赖和未核实项。
- 尚需验证：实际部署 CSP、浏览器网络请求和服务端访问策略。

## KP-ISSUE-002 — 本地优先与跨设备同步描述不一致
- 状态：DOCS_UPDATED_NEEDS_RUNTIME_VERIFICATION
- 严重级别：HIGH（用户预期与数据安全模型）
- 发现日期：2026-10-25
- 原始证据：
  - 旧 README 声称不提供云同步。
  - index.html 展示跨设备加密同步、创建账号、登录和合并同步按钮。
  - app.js 包含 Supabase Auth/REST 请求，并先加密 records/projects 快照，再写入同步记录。
- 处理：已更新 README.md 与 DELIVERY-REPORT.md，说明客户端同步实现、云端元数据和未核验的服务端策略。
- 尚需验证：Supabase keypocket_vault_sync 的 RLS/访问策略、生产网络请求、账号生命周期及同步冲突处理。

## 连续性档案安装检查
| 检查 | 结果 | 证据/备注 |
|---|---|---|
| 读取 README | PASS | GitHub 文件读取成功 |
| 读取 index.html | PASS | 已确认当前页面结构、CSP 和同步 UI |
| 读取 app.js | PARTIAL | 已读取加密、Skill 收录和同步函数相关片段；尚未完成全量审查 |
| 读取 SECURITY-ACCEPTANCE.md | PASS | 已发现并修正文档冲突 |
| 读取 DELIVERY-REPORT.md | PASS | 已更新旧同步状态描述 |
| 连续性档案写入/回读 | PASS | 9/9 文件写入并回读 |
| 本次语法检查 | NOT RUN | 本次没有执行 Node |
| 本次浏览器 E2E | NOT RUN | 本次没有执行浏览器测试 |
| 本次生产部署验证 | NOT RUN | 尚未核实最新部署 |
| Supabase RLS 核验 | NOT RUN | 当前未读取服务端策略配置 |
| 独立安全审计 | NOT COMPLETED | 不应声称已完成 |
