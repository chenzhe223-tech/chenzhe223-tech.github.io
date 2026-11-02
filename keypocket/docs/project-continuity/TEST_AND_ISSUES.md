# KeyPocket — 测试证据与问题

最后更新：2026-11-02（UTC+8）

## 最新成功证据
### GitHub Pages build/deploy
- Run：`41432733771`
- Commit：`a05d4bb0a83edf8fe37c26f26cdae353799978c5`
- 结果：SUCCESS。

### DAVYLAB Browser QA
- Run：`41432732355`
- Commit：`a05d4bb0a83edf8fe37c26f26cdae353799978c5`
- 结果：SUCCESS。
- KeyPocket 合成 E2E：页面 HTTP 200/CSP、IndexedDB 初始化、新增首条和多条 API Key、刷新解锁、搜索/筛选/编辑、加密备份导出/导入且无明文测试密钥、收藏/复制、API Key tombstone/批量恢复、本地快照恢复、390px 布局、GitHub 公开仓库导入、项目回收站恢复并保留 ID。
- Session refresh 回归：模拟 access token 401，refresh_token grant 返回新的 access token 与轮换后的 refresh token；两者均持久化，随后设备撤销请求使用新 access token。
- 设备撤销回归：当前设备无撤销按钮；其他有效设备可撤销；PATCH 限定当前用户、设备和 `revoked_at IS NULL`；收到服务端返回已撤销行后才刷新 UI。
- 所有列出的 KeyPocket 检查均 PASS；未发现页面 JavaScript pageerror。

### KeyPocket Skill Handoff QA
- Run：`41432732267`
- Commit：`a05d4bb0a83edf8fe37c26f26cdae353799978c5`
- 结果：SUCCESS。语法、Radar collector、Radar-to-KeyPocket source contract、正式资源版本、一键收录浏览器 E2E 通过。

## 历史自动化测试问题及修复
- 设备撤销 mock 初版未识别 PostgREST `eq.<id>` 查询格式；修复后 Browser QA `41432048440` SUCCESS。
- Supabase Auth 续期 mock 加入 OPTIONS/CORS 预检响应，避免测试请求误打到真实认证端点。
- 一次 Skill Handoff QA 失败是 HTML cache-bust 版本与 app.js 内部 build marker 不一致；a05d4bb 统一后 `41432732267` 成功。
- Browser QA `41432642680` 等待的 Pages run 被后续提交取消，属于 superseded run，不代表应用运行故障。

## Supabase 生产核验
- 项目 ref：`urzgghdwawpwqliafrzv`。
- `keypocket_sync_items` 仅 authenticated SELECT；直接表写权限已撤销；唯一写入 RPC 显式限定 `auth.uid()`、用户范围与 active device；anon/PUBLIC 无 EXECUTE。
- `keypocket_devices` authenticated UPDATE grants 存在，RLS USING/WITH CHECK 限制 `auth.uid() = user_id`。
- `keypocket_backup_snapshots` 的 SELECT/INSERT/UPDATE/DELETE grants 受 user-scoped RLS 限制；唯一索引 `(user_id, device_id, snapshot_type, period_key)` 支持 upsert。
- 本轮未新增 DDL 或放宽权限。
- Security Advisor WARN：Auth 泄露密码保护未启用；受限 SECURITY DEFINER CAS RPC 对 authenticated 可执行，需继续审查函数内的身份/设备/user scope/search_path 和直接表写权限。

## 仍未完成的真实验收
- 真实账号双设备登录、双向新增/编辑/删除同步、tombstone 传播、错口令拒绝和并发冲突。
- 真实撤销设备后服务端 CAS RPC 拒绝写入。
- 云端日/月快照真实上传及第二设备恢复。
- iPhone Safari 与微信内置浏览器实机。
- Skill Radar 月/季/年历史不足，不能展示伪增长。
- GitHub App / Worker OAuth / 私有 Vault 未配置。


## 2026-11-02 新增用户反馈与修复证据
### Skill Radar Failed to fetch
- 用户反馈：Skill Radar 显示“榜单暂不可用：Failed to fetch”。
- 根因：KeyPocket `index.html` CSP 的 `connect-src` 仅列出 GitHub API 与 Supabase，没有包含 `'self'`；`renderSkillRadar()` 请求的是同源 `./api/skill-radar.json`，被 CSP 阻断。
- 修复：commit `a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25` 将 `'self'` 加入 `connect-src`，不扩大到通配域名。
- Pages run `41435348472` SUCCESS；Browser QA run `41435352026` SUCCESS；Skill Handoff run `41435352002` SUCCESS。
- Browser QA 日志确认：CSP 有 `connect-src 'self'`；`/keypocket/api/skill-radar.json` 返回 HTTP 200 / `application/json`；累计 Stars 榜渲染 10 条卡片。
- 月/季/年仍只有 1 天真实历史，因此这些周期榜应继续显示“历史积累中”；不是网络故障。

### GitHub 账户入口状态
- 用户指出“未绑定 KeyPocket GitHub App”，并正确区分 ChatGPT GitHub connector 与应用内 OAuth。
- Cloudflare 只读核验：Worker `keypocket-vault-api` 存在；workers.dev subdomain `enabled=false`；Worker Secrets 列表为空；当前 settings 仅见普通 `APP_ORIGIN` binding。
- 结论：该项不是前端 fetch 故障，而是 GitHub App/OAuth 后端未完成配置。
- UI 修复：禁用无效“连接 GitHub”入口，改为“授权服务待配置”，解释缺少的 Worker 公网入口/Secrets 并提供配置文档。
- 本轮没有伪造 OAuth 成功、没有把 ChatGPT connector 当作用户授权，也没有向 Worker 暴露未配置的后端。
- 后续依赖：注册 GitHub App、确定 callback URL、启用 Worker 公网入口、部署并配置 App secrets/private key/state signing key，之后再做 OAuth/installation/vault 跨设备 E2E。
