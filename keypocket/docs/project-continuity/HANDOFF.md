# KeyPocket — 最近一次对话交接

更新时间：2026-11-02（UTC+8）
交接主题：继续 V2.0 实际升级，完成设备撤销、云端周期快照刷新、Supabase 会话自动续期，并通过线上 E2E。

## 本轮完成
1. 以 GitHub main 为唯一事实源，核对 PROJECT_CONTEXT、README、专项架构说明、近期 commits、Actions、Pages 与生产 Supabase。
2. 云端 daily/monthly snapshot 改为每次成功同步时 upsert 当前周期最新加密内容与时间，避免后续编辑未进入最新恢复点。
3. 同步中心支持撤销其他有效设备，禁止当前设备自撤销；PATCH 限定当前账号、指定设备和未撤销行，只有服务器返回更新行才显示成功。
4. V2 REST 请求遇到 HTTP 401 时自动使用 refresh_token grant 获取新 access token，并持久化 Supabase 轮换后的 refresh token；single-flight 合并同一标签页并发刷新，并兼容其他标签页已先完成轮换。
5. 新增设备撤销与 token rotation Playwright mock 回归；修复 PostgREST eq.<id> 条件、Supabase Auth OPTIONS/CORS 预检和 HTML/JS build marker 不一致。
6. 生产 Supabase keypocket_devices authenticated UPDATE grants/RLS、keypocket_backup_snapshots grants/RLS/唯一索引已核验；本轮未新增 DDL 或放宽权限。

## 最新代码与自动化验收
- 最新 main commit：`a05d4bb0a83edf8fe37c26f26cdae353799978c5`。
- Pages build/deploy：run `41432733771` SUCCESS。
- DAVYLAB Browser QA：run `41432732355` SUCCESS；多 Key 保存/刷新解锁、加密备份导出导入、tombstone/批量恢复、本地快照恢复、390px、token refresh rotation、设备撤销 mock 全部通过。
- KeyPocket Skill Handoff QA：run `41432732267` SUCCESS；包括真实线上 Radar→KeyPocket 一键收录浏览器流程。

## 五级验收
- Code Completed：周期快照 upsert、设备撤销、401 会话续期与回归测试已提交。
- Build Passed：a05d4bb 对应 Pages build/deploy SUCCESS；Skill Handoff QA SUCCESS。
- Runtime Verified：a05d4bb 正式站由整站 Browser QA 实际访问运行。
- Functional Tested：合成数据 Chromium E2E 覆盖上述本地功能、session refresh 和设备 revoke mock；真实账号双设备功能仍未验收。
- Production Deployed：a05d4bb 对应 Pages deploy SUCCESS。

## 未证明的事项
- 真实账号两个独立设备登录、双向增量同步、错误同步口令拒绝、并发冲突和 tombstone 传播。
- 真实撤销设备后 CAS RPC 拒绝该设备写入。
- 云端 daily/monthly snapshot 真实上传与第二设备查看/恢复。
- iPhone Safari/微信内置浏览器实机兼容。
- Skill Radar 月/季/年增长历史；GitHub App/OAuth/私有 Vault。

## 下一轮接手顺序
1. 先读 PROJECT_CONTEXT.md、CURRENT_STATUS.md、TEST_AND_ISSUES.md 与本 HANDOFF。
2. 查询 main 最新 commit 及同 SHA 的 Pages、Browser QA、Skill Handoff QA；失败时读取日志和 artifacts。
3. 使用独立测试账号和两个隔离 profile 完成双设备新增/编辑/删除、错口令、并发冲突、设备撤销、云备份跨设备恢复。
4. 完成 iPhone Safari 和微信浏览器实机测试。
5. 不把 mock 测试写成真实账号验收；每次实质开发更新项目状态文件和交接文档。
