# KeyPocket V2.0 — 测试与问题

## KP-ISSUE-001 — 初始语法错误
已修复。Actions 在 e27d535 对 `node --check keypocket/app.js` 执行 PASS。

## KP-ISSUE-002 — E2E 首次库测试数据泄漏
原因：Playwright 复用浏览器上下文已有 IndexedDB，导致密码确认框隐藏。commit e30311f 已为测试增加空 storageState；需确认后续运行结果。

## KP-ISSUE-003 — Pages队列取消
连续提交时中间 pages build/deployment jobs 被后续 commit 取消。必须以最新 main HEAD 对应 run 和线上资源作为部署证据。

## KP-ISSUE-004 — V2同步未实现
旧 Supabase 仍是单行全量snapshot/last-write-wins；RLS和云端schema未读取/验证。

## KP-ISSUE-005 — Skill Radar无真实榜单
页面尝试读取 `./api/skill-radar.json`，仓库暂无 collector/每日快照workflow；显示空态是预期行为。

## KP-ISSUE-006 — GitHub私有备份授权缺失
未创建 KeyPocket GitHub App/Worker OAuth callback/secret；应用内GitHub连接尚不可用。

## 尚未执行的测试
- 本地快照创建、解密、恢复和恢复前快照。
- API Key/项目删除、保留ID恢复、批量恢复、永久删除、30天过期。
- 本地写入失败不阻断原数据保存。
- Offline/online、快照并发、页面刷新。
- 旧版备份导入 merge/replace。
- Supabase RLS跨用户拒绝、增量事件、tombstone冲突、两设备同步。
- Skill Radar历史增量/过滤/限流/失败保留。
- GitHub App安装/取消/撤销/多设备/私有仓库恢复。
- iOS Safari、微信浏览器。
