# KeyPocket 安全边界与验收状态

最后更新：2026-11-02

## 当前源码可确认
- 原 IndexedDB `keypocket-local-v1` / store `vault` / DB version 1 未改。
- 原 API Key/project AES-GCM envelope 与 PBKDF2-HMAC-SHA-256 派生流程保留；默认 310,000 次。
- 本地快照 payload 使用当前客户端 AES-GCM 函数加密后才写入 IndexedDB。
- 常规 API Key/项目/Skill 保存入口接入快照防抖队列。
- API Key/项目软删除使用原记录 ID 保存加密删除内容，并写 encrypted tombstone。
- 回收站 UI 提供恢复和永久删除入口。
- Replace import 前会尝试创建保护快照。
- UI 明确说明旧 Supabase 仍为手动整库合并；V2 自动增量同步未启用。
- 未配置 GitHub App 时明确展示未绑定。

## 不能据此声称已完成
- 本地快照与密钥库同处一份浏览器数据；清除站点数据/设备丢失可能同时失去二者。
- 每日快照依赖用户当天打开并解锁页面，不是后台常驻任务。
- 尚无备份/回收站恢复 E2E。
- Supabase schema/RLS/生产 Auth/双设备冲突测试未完成。
- 尚无远程云端加密备份和增量多端同步。
- 尚无 KeyPocket GitHub App、Worker OAuth 回调和私有 vault 仓库。
- 尚无 Skill Radar 历史采集与榜单 workflow。

## Actions 证据
- Run 41382408180（commit e27d535）：node syntax PASS、source contract PASS、live asset PASS；Playwright handoff E2E FAIL，原因是测试重用旧 IndexedDB context，导致首次创建的确认密码栏隐藏。
- E2E 已在 e30311f 增加空 storageState；该修复的后续运行仍需检查。
- e27d535 后有后续代码变更；必须对最新 HEAD 重跑语法/E2E。
- iOS Safari 与微信浏览器未测试。

## 安全红线
不上传解锁密码、派生密钥或 API Key 明文。所有云端表必须 RLS 并完成跨用户拒绝测试。GitHub App 只访问用户授权的专用 vault。
