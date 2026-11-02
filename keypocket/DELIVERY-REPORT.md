# KeyPocket — V2.0 交付与当前状态报告

更新时间：2026-11-02（UTC+8）
正式入口：https://chenzhe223-tech.github.io/keypocket/
代码事实源：GitHub main / `keypocket/`。

## 最新代码与部署
- 已核验 commit：`a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25`。
- Pages build/deploy：run `41435348472`，SUCCESS。
- DAVYLAB Browser QA：run `41435352026`，SUCCESS。
- KeyPocket Skill Handoff QA：run `41435352002`，SUCCESS。

## 本轮实际开发
1. 云端每日/月度快照在每次成功同步后 upsert 当前周期的最新加密内容与时间，避免同一天第一次备份后后续编辑未进入最新恢复点。
2. 同步中心加入撤销其他有效设备；当前设备不能自撤销。PATCH 限定当前账号、目标设备和 `revoked_at IS NULL`，只有服务端返回已更新行才显示成功。
3. V2 REST 请求遇到 HTTP 401 自动执行 refresh_token grant；保存新的 access token 与轮换后的 refresh token；single-flight 合并同一标签页并发刷新，并兼容另一个标签页已先完成轮换的情况。
4. 增加设备撤销与令牌轮换的 Playwright 回归；修正 mock 的 CORS 预检、PostgREST `eq.<id>` 查询格式和 HTML/JS build marker 一致性。
5. 修复 Skill Radar `Failed to fetch`：CSP `connect-src` 增加 `'self'`，允许同源 JSON API 请求。
6. GitHub 账户页不再显示可点击的空连接按钮；明确显示 Cloudflare Worker 公网子域名与 OAuth Secrets 尚未配置，并链接配置说明。

## 最新自动化验收
Browser QA run `41432732355` SUCCESS，关键 KeyPocket 测试全部通过：
- 本地库初始化、添加多个 API Key、刷新后原密码解锁。
- 多密钥搜索、服务商筛选、编辑、收藏和复制。
- 加密备份导出/导入；导出文件中没有明文合成密钥。
- API Key 删除 tombstone、回收站批量恢复、本地加密快照创建/恢复。
- GitHub 公开仓库导入、项目软删除/恢复并保持原 ID。
- 390px Chromium 布局，无 JavaScript pageerror。
- 401 后 refresh_token grant 成功，新的 access/refresh token 已持久化，随后请求使用新 access token。
- 当前设备不显示撤销入口；其他有效设备可以撤销；PATCH 过滤当前用户/设备/未撤销行，收到服务端更新回执后刷新 UI。
KeyPocket Skill Handoff QA run `41435352002` SUCCESS，验证 app.js 语法、Skill Radar collector、source contract、线上资源版本和真实浏览器一键收录流程。
DAVYLAB Browser QA `41435352026` 新增并通过：同源 Radar JSON 返回 200、`application/json`，累计榜渲染 10 条；GitHub App 未配置时连接按钮为 disabled，且页面清楚解释 Worker/Secrets 前置条件。

## 生产 Supabase 核验
- 项目 ref：`urzgghdwawpwqliafrzv`。
- `keypocket_sync_items` 客户端只读，唯一写入口为 authenticated CAS RPC；RPC 限制 auth.uid、user scope 和 active device，anon/PUBLIC 不可执行，直接表写权限已撤销。
- `keypocket_devices` authenticated UPDATE 权限可用，RLS USING/WITH CHECK 均限定当前 `auth.uid() = user_id`。
- `keypocket_backup_snapshots` 所需 SELECT/INSERT/UPDATE/DELETE grants 受用户范围 RLS 限定；唯一索引 `(user_id, device_id, snapshot_type, period_key)` 支持 daily/monthly upsert。
- 本轮未新增数据库 DDL 或放宽权限。
- Security Advisor 仍有两项 WARN：Auth 泄露密码防护未开启；authenticated 可执行受限 SECURITY DEFINER CAS RPC，需持续审查，不得重新开放 sync_items 直接写权限。

## 尚未通过真实环境验收
- 真实账号两台设备双向同步、新增/编辑/删除传播与 tombstone 恢复。
- 错误同步口令拒绝、并发冲突处理、真实撤销设备后 CAS RPC 拒绝。
- 云端 daily/monthly 快照真实上传，以及另一设备查看和恢复。
- iPhone Safari 与微信内置浏览器实机测试。
- Skill Radar 历史跨度不足，月/季/年增长榜继续保持数据积累中。
- GitHub App / Worker OAuth / 私有 Vault 尚未配置。Cloudflare 当前有 `keypocket-vault-api` Worker 脚本，但 `workers.dev` 子域名 disabled，Secrets 为空；因此尚不能完成真实 OAuth。

## 五级交付判断
- Code Completed：本轮快照 upsert、设备撤销、会话续期及自动化回归已提交。
- Build Passed：a1a4127 对应 Pages build/deploy SUCCESS；Skill Handoff QA SUCCESS。
- Runtime Verified：同 SHA 正式站由整站 Browser QA 实际访问，Radar JSON HTTP 200 且累计 Stars 卡片渲染。
- Functional Tested：合成数据 Chromium E2E 覆盖本地功能、401 会话续期、设备撤销 mock、Radar 同源 JSON 与 GitHub 未配置状态；真实 OAuth/双设备仍未验收。
- Production Deployed：a1a4127 对应 Pages deploy SUCCESS。

详见 `PROJECT_CONTEXT.md`、`CURRENT_STATUS.md`、`TEST_AND_ISSUES.md` 和 `HANDOFF.md`。
