# KeyPocket｜项目唯一状态文件

最后更新：2026-11-04（UTC+8）
产品版本目标：V2.0
正式应用：https://chenzhe223-tech.github.io/keypocket/
代码仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io（应用目录：`keypocket/`）
唯一代码事实源：GitHub `main`。代码状态、Actions、线上 Supabase 和正式页面必须交叉核验；聊天记录不作为项目状态替代品。

## 1. 产品定位与基本原则

KeyPocket（By DAVYLAB）是本地优先的 AI 工具、GitHub Skill、开发项目与 API Key 管理应用。必须保持轻量、移动端优先、数据安全优先；不允许明文存储/上传 API Key，不以静态 UI 或代码提交冒充完整交付。

## 2. 技术架构

- 前端：原生 HTML/CSS/JavaScript，无构建框架；GitHub Pages 发布。
- 本地存储：IndexedDB `keypocket-local-v1`，object store `vault`，DB version 1。旧数据结构和加密 envelope 保持兼容。
- 本地加密：Web Crypto API，AES-GCM；PBKDF2-HMAC-SHA-256，默认 310,000 次迭代。密钥和 API Key 明文不得写入日志或发到服务端。
- 云端账号与数据：Supabase Auth + REST/Postgres。V2 同步表包含 `keypocket_sync_meta`、`keypocket_sync_items`、`keypocket_devices`、`keypocket_backup_snapshots`。云端仅保存独立同步口令加密后的 envelope。
- Skill Radar：GitHub Actions 调用 GitHub API 采集公开仓库指标，生成 `keypocket/api/skill-radar.json` 与历史 snapshot。
- 质量保障：GitHub Actions、Node 语法/契约检查、Playwright 线上 E2E。

## 3. 当前功能状态

状态必须区分代码、构建、运行、功能验收、生产部署五个层级：

| 功能 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| 本地 API Key 管理与加密 | 已实现：IndexedDB、AES-GCM、PBKDF2 | JS/Chromium 检查通过 | 正式站与 IndexedDB 实际运行 | **合成数据 E2E 通过**：新增、多条保存、刷新解锁、搜索/筛选/编辑、收藏/复制 | a05d4bb 对应 Pages 成功 |
| 本地自动加密快照 | 已实现：变更防抖快照、删除/替换前保护 | 检查通过 | 备份中心真实页面运行 | **合成数据 E2E 通过**：加密备份导出/导入、本地快照创建/恢复 | a05d4bb 对应 Pages 成功 |
| 回收站/误删恢复 | 已实现：软删除、加密 tombstone、30 天恢复 | 检查通过 | 回收站页面真实运行 | **合成数据 E2E 通过**：API Key 批量恢复、项目恢复并保留原 ID；30 天到期边界未专项测 | a05d4bb 对应 Pages 成功 |
| V2 多端增量同步 | 已实现：逐条加密、版本比较、冲突处理、设备注册、401 自动续期与 refresh token 轮换 | Skill Handoff 与 Browser QA 通过 | Supabase schema/RLS/权限已核验；正式页面运行 | **部分通过**：401→refresh→令牌轮换由 mock E2E 通过；真实账号双设备同步/并发冲突未验收 | a05d4bb 对应 Pages 成功 |
| 云端加密备份 | 已实现：成功同步后刷新当日/月度加密快照 | JS/CI 检查通过 | 表、RLS、权限、唯一索引已核验 | 真实账号上传、跨设备查看与恢复未执行 | a05d4bb 对应 Pages 成功 |
| 设备管理/撤销 | 已实现：设备列表、撤销其他设备、当前设备自撤销保护 | CI 通过 | 正式页面运行 | **模拟 REST E2E 通过**：用户/设备/未撤销行过滤和服务端响应校验；真实 RPC 拒绝已撤销设备待测 | a05d4bb 对应 Pages 成功 |
| Skill Radar | collector、公开榜单数据与每日 workflow 已实现；CSP 已允许同源 JSON | collector self-test 与 Browser QA 通过 | 正式站 GET `/keypocket/api/skill-radar.json` 返回 200 | **累计 Stars 榜浏览器 E2E 通过**（本次加载 10 条）；月/季/年因仅 1 天历史仍显示积累中 | a1a4127 对应 Pages 成功 |
| 简报 Skill 一键收录 | URL 校验、确认、去重、加密保存已实现 | 专项 QA 通过 | 正式页面和 bundle 已核验 | Playwright 线上一键收录 E2E 通过 | 已部署 |
| GitHub App / OAuth / 私有 Vault | 页面状态已如实说明；授权后端仍待配置 | UI/静态检查通过 | Cloudflare Worker `keypocket-vault-api` 存在，但 workers.dev disabled、Secrets 为空 | 未实现 OAuth/installation/vault E2E | 未部署；连接按钮禁用 |
| iPhone Safari / 微信浏览器专项兼容 | 待专项验收 | — | 390px Chromium 视口通过；非实机 | 未验收 | 页面已部署 |



### 自动备份边界
本地自动快照在解锁状态下由数据变更触发，采用防抖写入；重大删除、导入替换前先尝试生成保护快照。快照与密钥库位于同一浏览器 IndexedDB，因此**不等于异地备份**；清理站点数据、浏览器资料损坏或设备丢失可能同时失去原记录和本地快照。每日快照也依赖用户打开并解锁页面，不是浏览器关闭后的后台任务。 云端每日/月度快照在每次成功 V2 同步后刷新当前周期的最新密文；只有同步成功后，云端恢复点才更新。

### 回收站边界
API Key 和项目软删除时保留加密原记录与 tombstone；默认恢复窗口 30 天。超过期限会在后续解锁/回收站读取时清理原记录并标记 tombstone 过期。云同步必须传播删除标记，不能将旧设备记录重新“复活”。

### V2 多端同步边界
用户需要登录 Supabase 同步账号，并在各设备输入同一独立同步加密口令（至少 10 位）；它与本地密钥库解锁密码不同。每个浏览器安装生成设备 ID。同步前客户端逐条加密，云端仅存密文和同步元数据。生产数据库的同步记录表客户端只读，唯一写入口为通过身份、用户范围和有效设备校验的 `keypocket_sync_put_item` RPC。
V2 REST 请求遇到 HTTP 401 时会使用 refresh_token grant 自动获取新 access token，并保存 Supabase 轮换后的 refresh token；页面内通过 single-flight 合并并发刷新，若另一标签页已更新会话则复用新会话。过期 token 的 401→刷新→重试流程已用合成会话完成 Playwright E2E。
同步中心可撤销其他有效设备，但不能撤销当前设备；撤销动作只更新当前账号下指定且尚未撤销的设备，只有服务器返回更新行后才显示成功。
以上为代码、数据库安全配置与模拟请求验收；仍未使用真实测试账号完成双设备双向同步、并发冲突、撤销后 RPC 拒绝及云端恢复，不能宣称真实多端同步已验收。

### Skill Radar 数据边界
每日采集工作流与历史快照已上线；当前可核实到 1 天历史。正式页面的 `connect-src` 现已包含 `'self'`，允许从同源 `/keypocket/api/skill-radar.json` 读取静态榜单数据；最新 Browser QA 已实际收到 HTTP 200 并渲染累计 Stars 卡片。当前 Stars 是累计量，不能伪装成增长速度；月度、季度、年度趋势需要足够历史数据后才能展示有效排名，现阶段应显示“历史积累中”。

## 4. Supabase 生产安全核验（2026-11-02）

实际项目为 KeyPocket 页面中配置的 Supabase 项目。此次只调整 KeyPocket 专属对象，不修改 Dashboard Studio 表和用户数据。

- KeyPocket 同步表均启用 RLS。
- `keypocket_sync_items` 对 `authenticated` 仅保留 SELECT；INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 已撤销，匿名角色无权限。
- 写入由 `keypocket_sync_put_item` RPC 完成；RPC 要求 `auth.uid()` 非空，验证设备属于当前用户且未撤销，并按 `user_id` 限定所有读写；函数固定空 search_path。
- RPC 仅授权 `authenticated` 执行，`anon`/PUBLIC 无 EXECUTE；旧版宽权限 `keypocket_upsert_sync_item` 已撤销。
- 其他元数据/设备/备份表保留各自所需最小操作权限，并由 RLS 限制到当前用户。追加核验确认：`keypocket_devices` 对 authenticated 的必要 UPDATE 权限存在，UPDATE RLS 的 USING/WITH CHECK 都限制 `auth.uid() = user_id`；`keypocket_backup_snapshots` 的 SELECT/INSERT/UPDATE/DELETE grants 受用户范围 RLS 限定，并存在 `(user_id, device_id, snapshot_type, period_key)` 唯一索引，匹配 daily/monthly 快照 upsert。
- 生产 Supabase 查询已验证表权限、函数执行 ACL、RLS 开启状态和 migration 记录；上述数据库检查不是实际账号同步 E2E。
- Supabase Security Advisor 当前仍报告两项需要如实披露的 WARN：① Auth 泄露密码防护未启用；② 面向 authenticated 的 `SECURITY DEFINER` RPC 警告。第二项为有意设计的唯一写入端点，函数已显式鉴权、检查有效设备、用户范围过滤、固定 search_path，且直接表写入权限已撤销；需持续安全复核。不要为消除告警而重新开放同步表写入。
- Supabase 管理工具为本次远端 DDL 自动生成版本号；repo 中新增 SQL migration 文件作为可复现的最终状态。未来使用 Supabase CLI 前必须先对比远端 migration history 和仓库文件，禁止盲目 db push。

## 4.1 同步账号密码找回（2026-11-02）

- 同步中心新增“忘记密码”入口，使用 Supabase Auth POST /auth/v1/recover?redirect_to=... 请求发送恢复邮件。
- 恢复回跳地址固定为 https://chenzhe223-tech.github.io/keypocket/。Supabase Auth 的 Redirect URLs 必须显式允许该精确地址；如果邮件模板自定义，恢复链接必须正确使用 RedirectTo 或 ConfirmationURL。
- 支持恢复回跳 hash 中的 access_token&type=recovery，以及 token_hash 通过 /auth/v1/verify 换取恢复会话；恢复令牌仅保存在页面内存，不写入 localStorage。
- 用户提交新密码后，以恢复 access token 调用 PATCH /auth/v1/user。不会修改本地密钥库密码、跨设备加密口令、IndexedDB 数据或云端加密 envelope。
- 对外提示采用不暴露账号是否存在的通用文案。
- Browser QA 41478022304 已通过模拟 Supabase Auth 的恢复邮件请求、恢复回跳和密码更新 E2E；Pages run 41478020574、Skill Handoff QA 41478022270 均 SUCCESS，代码 commit 1bd229675c164d3e825a73088ba36665f60e48ec。
- 尚未验证真实邮箱投递。当前工具无法读取/修改 Supabase Auth SMTP 与 URL Configuration。Supabase 官方默认 SMTP 只向项目组织团队预授权邮箱投递，且有严格速率限制；若用户 QQ 邮箱不在团队成员列表，默认 SMTP 可能拒发。生产环境应配置自定义 SMTP，并将上述 KeyPocket 回跳地址加入 Redirect URLs。官方说明：https://supabase.com/docs/guides/auth/auth-smtp、https://supabase.com/docs/guides/auth/redirect-urls。

## 4.2 iPhone Skill 导入卡顿与精确仓库 URL（2026-11-03）

- 用户反馈：iPhone Safari 在“按 Skill 名称导入”搜索结果页卡住，离开后重新打开应用出现白屏；截图显示已成功返回一个第三方复制仓库，但用户输入的是上游仓库 URL https://github.com/Oldcircle/geo-sleuth。
- 已修复移动端弹窗生命周期：关闭弹窗时取消待处理搜索、使旧异步响应失效、清理 body 滚动锁；手机端不再自动 focus 搜索输入框以避免强制弹出键盘和 visual viewport 跳动；弹窗内部滚动并受视口高度限制；收录成功后自动关闭弹窗并返回项目列表；GitHub 搜索请求设置 12 秒超时并显示可恢复提示。
- 已修复 URL 搜索逻辑：输入有效 GitHub owner/repo URL 时，直接请求 GET /repos/{owner}/{repo} 精确读取目标仓库，不再将完整 URL 当作普通关键词并返回相似 Fork。指定仓库不可公开读取时明确报错，不降级推荐同名复制仓库。
- iPhone 宽度 390px Chromium E2E：弹窗视口布局、Skill 收录后关闭、再次打开/关闭及滚动锁清理均 PASS（Browser QA run 41548966622，commit 4bb640dc）。
- 精确 URL 查询的专项 mock 已加入 Browser QA（输入 Oldcircle/geo-sleuth 必须命中 /repos/Oldcircle/geo-sleuth，且不调用 search/repositories）；应用语法/Skill Handoff 检查已通过对应 commit 38c8837，但此专项 Browser QA 尚未在同一 SHA 完成，不能标记为 E2E 已通过。
- GitHub Pages build/deploy：41549584320 SUCCESS（commit f67ec5d，包含本轮代码）。Browser QA 对该提交尚未取得最终成功证据，需在最新部署后补跑。
- 当前不清理 localStorage、IndexedDB 或网站数据；不要卸载/清除 Safari 网站数据，以免影响本地加密库。白屏恢复先关闭旧标签页并重新打开正式 URL；若仍白屏，保留现场和原设备数据再排查。

## 5. 最近验证证据

- 最近一次已验证应用代码 commit：`a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25`（后续 `6e843dc` 为本轮状态/交接文档同步，不修改应用代码）。
- Radar 故障原因：`index.html` 的 CSP `connect-src` 未包含 `'self'`，阻止 `renderSkillRadar()` 请求同源 `/keypocket/api/skill-radar.json`，浏览器因此呈现 `Failed to fetch`。已在 a1a4127 添加 `'self'` 并通过整站 Browser QA 实际请求验证。
- GitHub 账户状态复核：Cloudflare 中 `keypocket-vault-api` Worker 已存在，但 `workers.dev` subdomain `enabled=false`，Worker Secret 列表为空，当前不能执行 OAuth。页面连接按钮现已禁用并解释前置条件。
- GitHub Pages build/deploy：run `41432733771`，同一 SHA，SUCCESS。
- DAVYLAB Browser QA：run `41432732355`，同一 SHA，SUCCESS。KeyPocket 日志逐项通过：本地密钥库初始化、新增首条与多条 API Key、刷新后原密码解锁、搜索/筛选/编辑、加密备份导出/导入、收藏/复制、API Key 删除 tombstone/回收站批量恢复、本地快照创建/恢复、GitHub 公开仓库导入、项目软删除/恢复且 ID 不变、390px Chromium 布局、401 会话续期和设备撤销；未发现 pageerror。
- KeyPocket 会话续期 E2E：模拟旧 access token 返回 401，客户端发送 refresh_token grant，保存新 access token 与轮换后的 refresh token，随后设备撤销请求使用新 token。
- 设备撤销 E2E：当前设备没有撤销入口；其他有效设备可撤销；PATCH 限定当前 user_id、目标 device_id 和 `revoked_at IS NULL`，只有 REST 返回已撤销记录才刷新界面。
- KeyPocket Skill Handoff QA：run `41432732267`，同一 SHA，SUCCESS。app.js 语法、Skill Radar collector、自收录 source contract、线上 HTML/JS 版本及真实浏览器一键收录流程均通过。
- 历史设备撤销专项 Browser QA：run `41432048440` SUCCESS；模拟 REST 设备列表与 PATCH 回归通过。
- 本地密钥库与恢复基线 Browser QA：run `41418830069`，commit `c8e232607f4d197ffd6e96c0fb60732a22d1293c`，SUCCESS；覆盖刷新解锁、备份导出/导入、删除 tombstone、批量恢复、本地快照恢复、项目恢复及 390px 检查。
- 已定位的历史测试故障：`41431598666` 的 mock 未处理 PostgREST `eq.<id>` 格式；修正后 `41432048440` 通过。`41432496710` 因 HTML cache-bust 与 app.js 内部 build marker 不一致而失败，统一版本后 `41432732267` 通过。`41432642680` 等待的 Pages deployment 被后续提交取消，属于 superseded run，不是应用功能错误。
- Supabase 生产表权限/RLS 核验：`keypocket_devices` authenticated UPDATE 与 user-scoped RLS 可用；`keypocket_backup_snapshots` 用户范围 grants/RLS 和周期唯一索引可用。`keypocket_sync_items` 继续只读，写入走 active-device CAS RPC。本轮未新增 DDL 或放宽权限。
- Security Advisor 仍有两项 WARN：Auth 泄露密码保护未开启；authenticated 可执行受限 SECURITY DEFINER CAS RPC。后者作为唯一同步写入口，已检查 auth.uid、user scope、active-device、固定 search_path 与 sync_items 直接写权限撤销状态。
- 最新 Radar / GitHub 页面修复 QA：Pages run `41435348472` SUCCESS；DAVYLAB Browser QA `41435352026` SUCCESS；KeyPocket Skill Handoff QA `41435352002` SUCCESS，均对应 `a1a4127e9d2e48c2044158a1c7a7e4bc27fccd25`。Browser QA 中 Radar JSON HTTP 200、`application/json`、累计榜 10 张卡片 PASS；GitHub 未配置状态提示 PASS。

**仍未证明**：真实账号双设备登录/双向同步、错同步口令拒绝、并发冲突、撤销设备后 CAS RPC 真实拒绝、云端快照跨设备恢复，以及 iPhone Safari/微信内置浏览器实机兼容。

## 6. 未完成事项与优先级

P0：
0. 完成 Supabase 自定义 SMTP、KeyPocket 精确 Redirect URL 白名单和 QQ 邮箱真实投递验收；当前只完成代码与模拟 E2E，不得标记真实邮件已验证。
0. 使用真实 iPhone Safari 与微信内置浏览器复测白屏、弹窗滚动、精确仓库 URL、收录后返回；390px Chromium E2E 已通过，但不能替代真机验收。
1. 使用独立真实测试账号和两个隔离浏览器 profile/设备，完成双向新增、编辑、删除同步、tombstone 传播、错口令拒绝、并发冲突与云端快照跨设备恢复；严禁使用真实 API Key。
2. 真实验证设备撤销后 `keypocket_sync_put_item` 拒绝写入，并验证未登录请求被拒绝、错误不会覆盖云端密文。
3. 验证 refresh token 真实轮换后两设备登录连续性、退出登录及设备状态行为；不要用 mock 代替账号验收。

P1：
4. 完成 iPhone Safari 与微信内置浏览器实机测试（创建/解锁、输入、复制、IndexedDB、导出/导入、页面恢复）。
5. 补测回收站 30 天到期边界、云端 daily/monthly snapshot 保留清理及网络中断恢复行为。
6. 继续采集 Skill Radar 历史；跨度充足前，月/季/年增长排名必须显示“数据积累中”。
7. 完成 GitHub App 注册和最小权限配置；启用 Cloudflare Worker 公网入口、配置 App/ OAuth/state secrets、实现 callback/installation/vault routes。完成真实 OAuth E2E 前，UI 必须保持未绑定且连接按钮禁用。

P2：
8. 完善冲突可视化、账号恢复引导、云备份恢复演练与用户可读的安全说明。
9. 只读对比 Supabase migration history 与仓库 migration 文件，再决定归档；禁止盲目 db push。

## 7. 交付等级与验收规则

每个功能按五级单独报告：Code Completed → Build Passed → Runtime Verified → Functional Tested → Production Deployed。任一级必须有证据；不能用后一级替代前一级，也不能把“部署成功”写成“功能验收通过”。所有测试只能使用合成密钥和测试账号；不得把真实 Key 写到日志、截图或测试产物。

## 8. 下一轮接手顺序

1. 读取本文件与 `docs/project-continuity/CURRENT_STATUS.md`、`TEST_AND_ISSUES.md`、`HANDOFF.md`。
2. 查看 main 最新 commit 及同 SHA 的 Pages、DAVYLAB Browser QA、KeyPocket Skill Handoff QA；失败先读 job log 和 artifacts。
3. 使用独立测试账号和两个隔离浏览器 profile，完成真实双设备新增/编辑/删除、错口令、并发冲突、设备撤销及云备份跨设备恢复。
4. 完成 iPhone Safari 和微信内置浏览器实机测试。
5. 继续核对 Skill Radar 历史采集；历史不足时不展示伪增长数据。
6. 每次实质开发更新本文件和交接文档，并按 Code Completed、Build Passed、Runtime Verified、Functional Tested、Production Deployed 五级分别报告。


## 2026-11-03 Skill 导入与 iPhone 弹窗稳定性修复

- 完整 GitHub 仓库 URL 走 GitHub `GET /repos/{owner}/{repo}` 精确读取；不再把完整 URL 当作关键词搜索。仓库名/owner 比较采用大小写不敏感，兼容 GitHub URL 大小写规范化。
- 移动端弹窗：取消输入框自动聚焦；弹窗本身在视觉视口内滚动；关闭时取消进行中的搜索并清理 body 滚动锁；收录成功后关闭弹窗并返回项目列表；搜索请求有 12 秒超时提示。
- 修复 Skill 收录数据规范化与错误反馈，项目标签保持 `normalizeProject()` 要求的字符串格式（逗号分隔）。
- HTML 与 app.js 资源版本同步更新为 `kp-v2-skill-import-fix-20261103-23`，强制 Safari 获取最新脚本，避免继续使用旧缓存。
- Browser QA run `41550563288`（commit `164d8b096890726750429541370f92062065fdc3`）SUCCESS；Pages run `41550562420` SUCCESS；Skill Handoff QA run `41550563395` SUCCESS。验证了 Skill 搜索/加密收录、390px iPhone 宽度精确仓库 URL 查询（精确请求 1 次、关键词搜索 0 次）、移动端收录后关闭、弹窗再次打开/关闭、页面可操作、无 KeyPocket JavaScript pageerror。
- 随后资源缓存版本更新至 `kp-v2-skill-import-fix-20261103-23`；Pages run `41550827155`、Browser QA `41550827588`、Skill Handoff QA `41550827587` 均 SUCCESS。该组结果为当前正式资源的最终部署验收。
- **验收边界**：390px Playwright/Chromium 触屏测试通过，不等同真实 iPhone Safari 或微信内置浏览器真机验收。白屏现象在自动化环境未复现，不能声称真机白屏已被完全证实根治。不得要求用户清除网站数据、IndexedDB 或 localStorage。
- 正式入口：https://chenzhe223-tech.github.io/keypocket/ 。



## 2026-11-04 顶部「收录项目」按钮无响应修复

- 用户反馈：网页版「我的 Skills / 项目」页面点击顶部「＋ 收录项目」无反应；在搜索框粘贴 GitHub URL 后才出现收录窗口。
- 根因已从 main 分支代码确认：#addProjectBtn 在 keypocket/index.html 中存在，但 keypocket/app.js 没有为其注册 click handler；空列表中的 data-project-action=add 有事件委托处理，因此两种入口表现不一致。
- 修复：为 #addProjectBtn 绑定 openProjectEditor()，直接打开空白项目表单；不依赖搜索框输入，不改变 Skill 搜索、加密保存或现有项目数据。
- HTML/app.js 缓存版本更新为 kp-v2-project-cta-fix-20261104-01，避免浏览器继续使用旧脚本。
- 新增 Browser QA 回归：解锁后直接点击顶部 CTA，断言 #projectEditForm 出现，再关闭弹窗并确认遮罩清除。
- 本项状态：代码修复已提交后待 Actions 构建、线上浏览器 E2E 与生产页面核验；不得在这些验证完成前标记为功能验收通过。


## 2026-11-04 GitHub 自有仓库自动发现与收录

- 产品需求：扫描用户自己的 GitHub 仓库，自动发现新开发的 Skill 与应用，并收录到「我的 Skills / 项目」。
- 实现方案：首次进入项目页自动扫描；成功后记录本地扫描时间，之后每 24 小时自动扫描一次；页面提供「扫描我的仓库」手动入口。
- 数据源：GitHub 用户公开仓库 API，仅读取 `chenzhe223-tech` 名下非 fork、非 archived、未 disabled 的公开仓库元数据；按规范化 GitHub owner/repo URL 去重。
- 分类：依据仓库名称、描述和 Topics 中的 Skill/Agent Skill 等明确关键词识别 Skill；其他自有仓库作为应用/开发项目；自有 Skill 在「仅看 Skill」筛选中可见。
- 保存：新增项目继续走 KeyPocket 现有 AES-GCM 本地加密与 `persistProject()` 路径；不会覆盖已收录项目的个人备注、分类、收藏或标签；不会导入 API Key。
- 私有仓库：当前 KeyPocket GitHub App/OAuth 尚未配置，不能扫描私有仓库；页面明确提示，待 GitHub App 最小权限授权后再扩展。不得通过前端硬编码 Token 绕过。
- 自动扫描频率：每个浏览器本地记录 24 小时扫描时间；手动扫描可随时触发。首次扫描会补齐此前未录入的公开原创仓库。
- 本轮新增 Browser QA：模拟自有应用、Skill 与 fork 仓库，验证自动发现、Skill 分类、重复扫描去重；测试仅使用合成仓库元数据。
- 验收结果：Pages build/deploy run `41794539121` SUCCESS；DAVYLAB Browser QA run `41794539177` SUCCESS；KeyPocket Skill Handoff QA run `41794539058` SUCCESS，三者均对应最终功能 SHA `4fe8ac7f45561ffd19ce637723c84aa3376e2875`。Browser QA 实测自动发现 2 个模拟自有仓库（1 个 Skill、1 个应用）、Skill 分类展示、重复扫描不重复收录均 PASS。


### GitHub 自动发现功能验收记录（2026-11-04）

- 最新功能代码：`fc48a6d023c30aabfb8977c1fda1d748789f17fa`；HTML：`940064f7131f6c710cb38308019dea581b7389c8`；Browser QA：`96c02ccde08bd4dae184e72dbb5907a63b8413b5`；项目状态文档：`0e7de5eb923aca5b8d783036d5364a7732265d7b`；README：`4fe8ac7f45561ffd19ce637723c84aa3376e2875`。
- 五级交付：Code Completed；Build Passed（Pages run 41794539121）；Runtime Verified（Pages deployment 与线上资源检查通过）；Functional Tested（Browser QA run 41794539177）；Production Deployed（GitHub Pages deploy SUCCESS）。
- Browser QA 关键结果：自动发现并加密收录自有 GitHub 应用与 Skill PASS；自有 Skill 分类展示 PASS；重复扫描去重 PASS；KeyPocket 页面无 JavaScript pageerror。
- 自动扫描默认每 24 小时执行一次（用户进入「我的 Skills / 项目」模块时触发），并提供手动扫描按钮；首次扫描补齐未收录的公开原创仓库。现有记录不会被自动覆盖。
- 当前仅公开仓库：GitHub App/OAuth 未配置，私有仓库不可扫描。不得将此能力描述为全量私有仓库同步。
