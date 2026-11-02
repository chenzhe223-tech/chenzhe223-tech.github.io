# KeyPocket — 测试与问题记录

更新：2026-11-02（UTC+8）

## 1. 本轮自动化测试

### GitHub Actions V2 CI
- Workflow：KeyPocket V2 CI
- Run：41379299165
- Commit：1e8086f6686c6647678a60aec0f8bf2d3c2f101e
- 结果：completed / success
- Job：contract-and-syntax
- 步骤：Node 语法检查、V2 静态契约测试均成功。

覆盖语法文件：
- keypocket/app.js
- keypocket/app-v2.js
- keypocket/scripts/collect-skill-radar.cjs
- keypocket/worker/github-app/src/index.js

六项静态契约：
1. V1 IndexedDB 与加密入口保持存在。
2. V2 自动快照/回收站使用原有加密数据库路径。
3. V2 逐记录同步与 SECURITY INVOKER RPC。
4. Skill Radar 每日快照和历史增长口径。
5. GitHub Worker 固定仓库、固定文件和加密 envelope。
6. HTML V1/V2 脚本顺序和 Worker CSP。

注意：这是静态代码契约，不是浏览器业务流程 E2E。

## 2. Supabase 核查
- 项目：urzgghdwawpwqliafrzv。
- V2 表已部署：sync_meta、sync_items、backup_snapshots、devices、skill_repos、skill_snapshots。
- keypocket_sync_meta、keypocket_sync_items、keypocket_backup_snapshots、keypocket_devices RLS 已启用。
- 个人数据表策略限定 auth.uid() = user_id。
- Skill Radar 表对 anon/authenticated 只读，service_role 可写。
- keypocket_upsert_sync_item 为 SECURITY INVOKER，包含版本条件更新。
- Skill snapshots identity sequence 的 service_role USAGE 已核验。
- 旧 keypocket_vault_sync 未修改；核查时该表没有同步行。
- 尚未用真实账号验证用户 A 无法读写用户 B 数据，也未做 API Key 密文抓包。

## 3. Cloudflare Worker
- Worker 名：keypocket-vault-api。
- 部署 ID：229ccd2b797f405a97934b7f5f3fb5ff。
- Cloudflare API 返回部署成功与模块入口 index.js。
- 当前容器访问外网时 DNS 暂时失败，无法访问 /health；故 Runtime Verified 仅限部署元数据，不代表公网请求已经成功。
- Worker secrets 与 GitHub App 账户授权尚未完成。

## 4. 当前问题/阻塞
- Actions secrets 未设置，Skill Radar 首次采集没有运行。
- GitHub App 未建立；没有 app id/private key/slug/Session Secret。
- keypocket-cloud-vault 尚未建立与 App installation。
- Supabase Auth 用户真实会话与 token refresh 尚未做运行测试。
- V2 页面尚未部署，不能对线上界面验收。
- 真实 Safari/微信浏览器与设备间数据恢复未测。
- 独立安全审计未完成。

## 5. 处理纪律
- 不把 CI success 写成 E2E success。
- 不把 Supabase schema created 写成 sync functional tested。
- 不把 Worker deployment metadata 写成 public health check passed。
- 不把 GitHub App Worker code 写成 account connected。
- 不把累计 Stars 写成月/季/年增长。
- 失败或缺失配置时保留上一次有效 Skill Radar 数据。
