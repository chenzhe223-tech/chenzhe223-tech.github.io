# KeyPocket V2.0 — 测试与问题

## KP-ISSUE-001 — 初始语法错误
已修复。Actions在 e27d535 对 `node --check keypocket/app.js` 执行 PASS。当前 app.js 后续无改动，最新仍需再次专项检查。

## KP-ISSUE-002 — E2E confirmPassword 隐藏
- Run 41383221465 / commit 2513ed8。
- Node syntax、source contract、published assets均 PASS；Playwright在填充 `#confirmPassword` 时失败，元素按页面逻辑被隐藏。
- 先前仅加入空 storageState不足以解决。
- 最新 E2E script 0dcac99 增加读取隔离测试 IndexedDB的 vault/记录 ID，并仅对一次性测试 context删除该DB，再 reload 创建测试密钥库；还没有新的 KeyPocket QA run。
- 下一步必须 workflow_dispatch运行 KeyPocket Skill Handoff QA并查看锁屏状态，不能把测试脚本修改等同测试通过。

## KP-ISSUE-003 — Pages部署队列取消
旧提交中间 Pages runs会被后续提交取消；最新 HEAD 6f2b9e6对应 run 41383453487 build/deploy已SUCCESS。

## KP-ISSUE-004 — V2同步未实现
旧Supabase仍为单行全量snapshot/last-write-wins；生产 schema/RLS和双设备冲突未验证。

## KP-ISSUE-005 — Skill Radar无真实榜单
页面读取 `./api/skill-radar.json`，尚无collector与每日历史快照workflow；空态为预期。

## KP-ISSUE-006 — GitHub私有备份授权缺失
尚无KeyPocket GitHub App/Worker OAuth callback/secret与专用私有 vault。

## 未执行测试
本地快照解密/恢复、回收站单条/批量/删除过期、导入保护回滚、同步离线/并发/删除冲突、RLS跨用户拒绝、两设备、Radar周期增长/限流失败保留、GitHub App授权撤销与恢复、iOS Safari/微信。
