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
- 本轮应用代码提交：`a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25`。
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


## 2026-11-02 最新故障接手记录
1. 用户反馈 Skill Radar 与 GitHub 账户页不可用。
2. 已定位 Radar 根因：CSP `connect-src` 缺少 `'self'`，阻止同源 `/keypocket/api/skill-radar.json` 请求；a1a4127 已修复。
3. 最新真实 Browser QA `41435352026` 通过：同源 JSON HTTP 200 / JSON content type、累计 Stars 榜 10 条；GitHub 未配置状态提示及禁用按钮 PASS。
4. GitHub App 只读基础设施核验：Cloudflare Worker `keypocket-vault-api` 存在，但 workers.dev subdomain disabled、Secrets 为空。未完成 App 注册、OAuth callback、Worker Secrets 和私有 vault 接口。
5. 最新 Pages `41435348472`、Browser QA `41435352026`、Skill Handoff `41435352002` 全部 SUCCESS；代码 commit `a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25`。
6. 下次优先完成 GitHub App 注册与 Worker 安全部署；在真实 OAuth/installation E2E 通过前，不得启用连接按钮，也不得把 GitHub connector 描述为 KeyPocket 授权。


## 2026-11-02 同步账号密码找回专项交接
1. 用户反馈同步账号登录提示邮箱或密码不正确；Supabase Auth 日志确认 invalid_credentials，原邮箱账号存在且已验证，但无法据此恢复旧密码。
2. 已在同步中心新增“忘记密码”按钮、邮件恢复请求、恢复链接处理（hash access token / token_hash）、设置新密码表单。
3. 安全实现：/auth/v1/recover 只请求邮件；恢复 access token 只驻留页面内存；PATCH /auth/v1/user 更新 Supabase 账号密码。不会改变本地解锁密码、跨设备加密口令、IndexedDB 或云端密文。
4. 修复 hashchange 场景，支持邮件链接在当前页面 hash 跳转时展示恢复表单。
5. 最新代码 commit：1bd229675c164d3e825a73088ba36665f60e48ec。
6. Pages run 41478020574 SUCCESS；DAVYLAB Browser QA 41478022304 SUCCESS；KeyPocket Skill Handoff QA 41478022270 SUCCESS。密码找回请求、恢复回跳、更新密码均由 mock E2E 覆盖。
7. 未完成的外部依赖：真实 SMTP 邮件投递未验证；需检查 Supabase Auth SMTP，配置生产自定义 SMTP，并在 URL Configuration 允许 https://chenzhe223-tech.github.io/keypocket/。默认 SMTP 对非团队邮箱有限制，QQ 邮箱可能因此收不到邮件；实际项目配置尚未确认。
8. 下一步先完成 SMTP 与 Redirect URL 配置，再使用用户本人邮箱做一次真实找回邮件验收；切勿要求用户重复注册或修改跨设备加密口令。


## 2026-11-03 iPhone Skill 导入故障专项交接
1. 用户截图显示 iPhone Skill 导入弹窗搜索 GitHub URL Oldcircle/geo-sleuth 后，返回的是第三方复制仓库；随后反馈页面卡住，重新打开白屏。
2. 已修复移动端弹窗：搜索请求可取消，旧异步响应失效；关闭清理 body scroll lock；手机不自动聚焦输入框；弹窗内部滚动并限制在视口内；保存成功自动关闭并返回项目列表；GitHub Search 每个请求 12 秒超时。
3. 已修复完整 GitHub URL 查询：直接 GET /repos/{owner}/{repo}，不再当关键词搜索；目标不可公开读取时提示失败，不推荐同名 fork 代替。
4. 390px Chromium Browser QA run 41548966622 SUCCESS：弹窗布局、收录后返回、再次打开/关闭均通过；精确 URL 专项测试已写入 QA 脚本，但尚未在同 SHA Browser QA 跑通。
5. 当前正式入口：https://chenzhe223-tech.github.io/keypocket/。Pages build 41549584320 SUCCESS，commit f67ec5d 包含本轮修复。仍需等待稳定部署后补跑 Browser QA，并由用户在真实 iPhone Safari 复测。
6. 保护数据：不得清除 Safari 网站数据、IndexedDB 或 localStorage；如仍白屏，关闭旧标签页后新开正式 URL，保留原设备与数据。


## 2026-11-03 Skill 导入与 iPhone 弹窗稳定性修复

- 完整 GitHub 仓库 URL 走 GitHub `GET /repos/{owner}/{repo}` 精确读取；不再把完整 URL 当作关键词搜索。仓库名/owner 比较采用大小写不敏感，兼容 GitHub URL 大小写规范化。
- 移动端弹窗：取消输入框自动聚焦；弹窗本身在视觉视口内滚动；关闭时取消进行中的搜索并清理 body 滚动锁；收录成功后关闭弹窗并返回项目列表；搜索请求有 12 秒超时提示。
- 修复 Skill 收录数据规范化与错误反馈，项目标签保持 `normalizeProject()` 要求的字符串格式（逗号分隔）。
- HTML 与 app.js 资源版本同步更新为 `kp-v2-skill-import-fix-20261103-23`，强制 Safari 获取最新脚本，避免继续使用旧缓存。
- Browser QA run `41550563288`（commit `164d8b096890726750429541370f92062065fdc3`）SUCCESS；Pages run `41550562420` SUCCESS；Skill Handoff QA run `41550563395` SUCCESS。验证了 Skill 搜索/加密收录、390px iPhone 宽度精确仓库 URL 查询（精确请求 1 次、关键词搜索 0 次）、移动端收录后关闭、弹窗再次打开/关闭、页面可操作、无 KeyPocket JavaScript pageerror。
- 随后资源缓存版本更新至 `kp-v2-skill-import-fix-20261103-23`；Pages run `41550827155`、Browser QA `41550827588`、Skill Handoff QA `41550827587` 均 SUCCESS。该组结果为当前正式资源的最终部署验收。
- **验收边界**：390px Playwright/Chromium 触屏测试通过，不等同真实 iPhone Safari 或微信内置浏览器真机验收。白屏现象在自动化环境未复现，不能声称真机白屏已被完全证实根治。不得要求用户清除网站数据、IndexedDB 或 localStorage。
- 正式入口：https://chenzhe223-tech.github.io/keypocket/ 。


## 下一轮接手事项
1. 请用户在原 iPhone Safari 设备和原网址重新打开最新资源，测试 Skill URL `https://github.com/Oldcircle/geo-sleuth`、弹窗取消/再次打开、收录成功返回列表；不要清除网站数据。
2. 若仍白屏，优先收集 Safari Web Inspector 的 `window.__kpInitDiagnostic`、`window.__kpBuildVersion` 与 Console 首条异常；不能要求用户重置 IndexedDB。
3. 后续按 P0 完成真实 QQ 邮箱 SMTP 投递、双设备云同步及云备份恢复；这些不属于本轮 Skill UI 验收范围。


## 2026-11-04 单份最新自动备份交接
1. 用户明确要求：自动备份完成后全量覆盖上一版，不保留每一版历史。
2. 本地采用固定 IndexedDB key `kp.snapshot.latest`；新密文 put 成功后才删除旧版快照；失败保留旧版。
3. 云端采用现有约束允许的 `snapshot_type='milestone'` 与 `period_key='latest'`，无需改数据库 schema；upsert 成功后删除当前用户其他快照，确保账号级只保留一份。
4. 云端快照仍含 records、projects 与 deleted/tombstone；恢复前保护流程不提前删除原快照。
5. 新 Browser QA 将连续两次本地备份更新后断言只有一张备份卡片且稳定 ID 不变，再执行恢复回归。
6. 真实 Supabase 账号同步与云备份仍未进行；mock/代码测试不能标记为真实云端验收。
