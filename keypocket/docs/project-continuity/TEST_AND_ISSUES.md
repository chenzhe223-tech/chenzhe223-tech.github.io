# KeyPocket — 测试与问题记录

## KP-ISSUE-001 — CSP 与安全验收文档冲突
- 状态：`OPEN`
- 严重级别：`HIGH`（文档准确性与安全审查优先级；不等于已确认漏洞）
- 发现日期：2026-10-25
- 证据：
  - `keypocket/index.html` 当前 CSP 中 `connect-src` 包含 `https://api.github.com` 和 Supabase URL。
  - `keypocket/SECURITY-ACCEPTANCE.md` 仍声称 `connect-src 'none'`。
- 影响：安全审查者可能误判实际网络请求边界。
- 下一步：核对 app.js 的全部网络调用与实际请求目标；据真实实现更新安全说明和验收清单。
- 验证：检查 CSP、fetch 调用、账号同步流程及浏览器网络请求。

## KP-ISSUE-002 — 本地优先与跨设备同步描述不一致
- 状态：`OPEN`
- 严重级别：`HIGH`（用户预期与数据安全模型）
- 发现日期：2026-10-25
- 证据：
  - README 的隐私说明称不提供云同步，并称 Skill 队列不是云同步。
  - index.html 展示跨设备加密同步、创建账号、登录和合并同步按钮。
  - DELIVERY-REPORT 仍包含“没有云同步”的历史表述。
- 影响：用户可能无法准确理解哪些数据留在本地、哪些数据会被同步。
- 下一步：检查同步代码、Supabase 表/策略与加密 envelope；明确同步的是密文还是其他元数据；核对线上版本。
- 验证：文档描述、代码实现、服务端策略和网络测试一致。

## 本次连续性档案安装检查
| 检查 | 结果 | 证据/备注 |
|---|---|---|
| 读取 README | PASS | GitHub 文件读取成功 |
| 读取 index.html | PASS | 已确认当前页面结构、CSP 和同步 UI |
| 读取 app.js | PARTIAL | 已读取代码开头片段，尚未完成完整审查 |
| 读取 SECURITY-ACCEPTANCE.md | PASS | 发现其 CSP 描述与 index 不一致 |
| 读取 DELIVERY-REPORT.md | PASS | 发现其旧同步状态描述需复核 |
| 本次语法检查 | NOT RUN | 本次没有执行 Node |
| 本次浏览器 E2E | NOT RUN | 本次没有执行浏览器测试 |
| 本次生产部署验证 | NOT RUN | 尚未核实最新部署 |
| 独立安全审计 | NOT COMPLETED | 不应声称已完成 |

