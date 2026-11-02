# KeyPocket V2.0 — 测试与问题

## KP-ISSUE-001 — 初始语法错误
已修复。旧 run `41382408180` 对 e27d535 的 `node --check keypocket/app.js` 执行 PASS；HEAD `022232f` 最新 static QA也通过。

## KP-ISSUE-002 — Playwright部署竞态
- Run `41384700603` / commit f4dd151：静态检查通过、Playwright失败。
- 日志显示它加载 `app.js?v=kp-v2-recovery-20261102-1`，但目标页面缓存版本已经更新；锁屏仍为静态默认状态。原因是 push 触发 QA 在 GitHub Pages 部署完成前读取生产站点。
- E2E增加独立临时 Chromium profile、版本检查和 init 诊断。
- QA workflow已改为 push只运行语法/源码契约；Playwright只在 workflow_dispatch或成功的 pages workflow_run执行。
- HEAD `022232f` push QA run `41385211674` 静态检查 PASS；Pages run `41385211770` build/deploy SUCCESS。
- Pages成功后目前未检索到 KeyPocket自有 workflow_run QA记录，因此最新线上 Playwright仍待手动触发，不能记为 PASS。

## KP-ISSUE-003 — Pages中间队列取消
连续提交期间旧Pages运行被取消；当前HEAD `022232f` 对应 `41385211770` build/deploy SUCCESS。

## KP-ISSUE-004 — V2同步未实现
旧 Supabase 仍为单行全量 snapshot/last-write-wins；live schema/RLS和双设备冲突未验证。

## KP-ISSUE-005 — Skill Radar无真实榜单
页面读取 `./api/skill-radar.json`，尚无collector/每日历史快照workflow；空态为预期。

## KP-ISSUE-006 — GitHub私有备份授权缺失
尚无KeyPocket GitHub App/Worker OAuth callback/secrets与专用私有vault。

## 未执行测试
本地快照解密/恢复、回收站单条/批量/到期清理、导入保护回滚、离线/并发/删除冲突、RLS跨用户拒绝、两设备同步、Radar周期增长/限流、GitHub App授权/撤销/恢复、iOS Safari/微信。
