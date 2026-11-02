# KeyPocket — 测试证据与问题

最后更新：2026-11-02（UTC+8）

## 成功证据
### KeyPocket 专项
- Actions run：`41408780134`
- Commit：`b90db1495781ea3324700798d30429d85b23feca`
- 结果：SUCCESS
- 已通过：`keypocket/app.js` 语法检查、Skill Radar collector 语法与自测、Radar-to-KeyPocket source contract、线上资源检查、浏览器真实一键收录 E2E。
- E2E 已确认：从 AI 简报选择 Skill → 打开 KeyPocket → 用户确认 → 项目加密保存 → 清除待导入队列；且演练了 Skill 项目软删除、回收站恢复、本地备份界面。

### GitHub Pages
- Actions run：`41408779662`
- Commit：`b90db1495781ea3324700798d30429d85b23feca`
- 结果：SUCCESS。

### Supabase 生产核验
- KeyPocket sync/meta/items/devices/backup tables 的 RLS 已启用。
- sync_items 现仅对 authenticated 保留 SELECT，匿名无权限；直接 INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 均撤销。
- 唯一写入 RPC `keypocket_sync_put_item`：security_definer=true、owner=postgres、search_path 固定为空；authenticated EXECUTE=true、anon=false；函数内部显式校验 `auth.uid()`、设备归属/未撤销状态，所有表读写使用当前 user_id 限定。
- 旧 `keypocket_upsert_sync_item` 对 PUBLIC/anon/authenticated 的 EXECUTE 已撤销。
- 远端 migration history 记录：`20261102084655 keypocket_sync_least_privilege`、`20261102085045 keypocket_sync_rpc_only_mutations`、`20261102085211 keypocket_sync_rpc_privilege_cleanup`。
- 生产表权限回查和 RLS 回查成功；没有使用真实账号同步记录，因此并非功能 E2E。

## 当前失败/待调查
### DAVYLAB Browser QA
- 上一轮 run：`41408780125`，commit `b90db1495781ea3324700798d30429d85b23feca`，FAIL。
- 失败位置：`scripts/qa-smoke.cjs:373`，新建 2 条合成 API Key 后刷新页面，再解锁时，等待 `#mainView:not(.hidden)` 超时。
- 之前没有输出 `window.__kpUnlockError`、`__kpUnlockStep`、密码提示、快照和 IndexedDB 条目等诊断，无法确认根因。
- 已提交诊断增强：commit `3848c1b857deac58020c14d971e5933e8acc75b1`，Actions run `41415872653` 在文档更新前查询时仍在运行。
- 下一步必须读取该 run 的最终结果与 job log，取得具体失败步骤，再改应用代码；不能只加等待时间掩盖错误。

## 尚未完成的功能验收
- API Key 创建→刷新→原密码解锁→记录完整。
- API Key 删除、回收站恢复、批量恢复、30 天过期处理。
- 本地快照自动创建、加密内容验证、从历史快照恢复、错误密码拒绝。
- Supabase 真实账号登录、两个独立设备完整同步、云端快照上传/恢复、错误口令/撤销设备/并发冲突。
- iPhone Safari、微信内置浏览器。

## Advisor 当前 WARN
- `auth_leaked_password_protection`：Supabase Auth 泄露密码保护未启用，需要在 Auth 设置中人工评估开启。
- `authenticated_security_definer_function_executable`：KeyPocket 唯一写入 RPC 有意作为 authenticated endpoint；因其使用 SECURITY DEFINER，必须持续复核其内部鉴权、用户过滤、有效设备校验、空 search_path 与直接表写权限撤销状态。
- 与 Dashboard Studio 其他表相关的性能 advisor 不列为 KeyPocket 缺陷。
