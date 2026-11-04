# KeyPocket — 测试证据与问题

最后更新：2026-11-03（UTC+8）

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


## 2026-11-02 同步账号密码找回
- 用户反馈：已验证邮箱的同步账号登录返回 invalid_credentials，无法使用原账号密码登录。
- 已新增同步中心“忘记密码”入口。请求 Supabase Auth POST /auth/v1/recover?redirect_to=https://chenzhe223-tech.github.io/keypocket/；回跳支持 recovery access token 与 token_hash；重置使用 PATCH /auth/v1/user。
- 安全边界：恢复 access token 只在页面内存中使用；重置仅更新 Supabase 登录密码，不触碰 IndexedDB、本地密钥库密码、跨设备加密口令或任何同步密文；用户提示不暴露邮箱是否注册。
- Browser QA 41478022304 SUCCESS：recover 请求参数/回跳 URL、恢复 hash 解析、Auth user PATCH 与新密码更新流程均使用模拟端点通过；未向真实 Supabase 发送测试邮件，也未更改真实账号密码。
- Pages 41478020574 SUCCESS；KeyPocket Skill Handoff QA 41478022270 SUCCESS；应用代码 commit 1bd229675c164d3e825a73088ba36665f60e48ec。
- 真实邮件投递尚未验收。需在 Supabase Dashboard → Authentication → URL Configuration 添加精确 Redirect URL：https://chenzhe223-tech.github.io/keypocket/；在 Authentication → SMTP Settings 配置生产自定义 SMTP，并检查 Reset Password 邮件模板使用有效确认链接。
- Supabase 官方默认 SMTP 只向组织团队预授权地址投递，并有较低速率限制；这可能解释 QQ 邮箱收不到邮件，但当前未读取项目实际 SMTP 配置，不能断言项目一定使用默认 SMTP。参考官方文档：https://supabase.com/docs/guides/auth/auth-smtp、https://supabase.com/docs/guides/auth/redirect-urls。


## 2026-11-03 iPhone Skill 导入卡顿 / 白屏反馈
- 截图场景：用户在 iPhone 上输入完整 GitHub URL Oldcircle/geo-sleuth，页面显示一个第三方复制仓库候选，弹窗遮罩占据页面；用户反馈操作卡住，重新打开页面白屏。
- 已实施移动端弹窗恢复改造：取消搜索输入框自动聚焦；弹窗高度限制在视觉视口内、弹窗内容本身滚动；关闭时中止 Skill 搜索并清理 body 滚动锁；收录成功后自动关闭弹窗；搜索请求 12 秒超时并提示重试。
- 已实施 URL 精确查询：完整 github.com/owner/repo 走 GitHub GET /repos/{owner}/{repo}，关键词仍走 Search API；指定仓库不存在/不可公开读取时不再回退到相似 Fork。
- Browser QA run 41548966622 SUCCESS：390px 视口弹窗边界、mock 收录后弹窗关闭且项目卡片可见、重新打开/关闭与 body scroll lock 清理均 PASS；未发现 pageerror。
- 指定 URL 精确查询 mock 已写入 scripts/qa-smoke.cjs；最新代码 commit 38c88377 的 Skill Handoff QA 41549386767 SUCCESS，Pages build 对包含该代码的 main commit f67ec5d run 41549584320 SUCCESS。由于连续的 AI 简报生产部署使同 SHA Browser QA 被取消/跳过，精确 URL 的专项 E2E 尚待补跑。
- 不能仅凭 390px Chromium 视口声称 iPhone Safari 真机兼容已通过；仍需真机验证。不要让用户清除 Safari 网站数据、IndexedDB 或 localStorage。


## 2026-11-03 Skill 导入与 iPhone 弹窗稳定性修复

- 完整 GitHub 仓库 URL 走 GitHub `GET /repos/{owner}/{repo}` 精确读取；不再把完整 URL 当作关键词搜索。仓库名/owner 比较采用大小写不敏感，兼容 GitHub URL 大小写规范化。
- 移动端弹窗：取消输入框自动聚焦；弹窗本身在视觉视口内滚动；关闭时取消进行中的搜索并清理 body 滚动锁；收录成功后关闭弹窗并返回项目列表；搜索请求有 12 秒超时提示。
- 修复 Skill 收录数据规范化与错误反馈，项目标签保持 `normalizeProject()` 要求的字符串格式（逗号分隔）。
- HTML 与 app.js 资源版本同步更新为 `kp-v2-skill-import-fix-20261103-23`，强制 Safari 获取最新脚本，避免继续使用旧缓存。
- Browser QA run `41550563288`（commit `164d8b096890726750429541370f92062065fdc3`）SUCCESS；Pages run `41550562420` SUCCESS；Skill Handoff QA run `41550563395` SUCCESS。验证了 Skill 搜索/加密收录、390px iPhone 宽度精确仓库 URL 查询（精确请求 1 次、关键词搜索 0 次）、移动端收录后关闭、弹窗再次打开/关闭、页面可操作、无 KeyPocket JavaScript pageerror。
- 随后资源缓存版本更新至 `kp-v2-skill-import-fix-20261103-23`；Pages run `41550827155`、Browser QA `41550827588`、Skill Handoff QA `41550827587` 均 SUCCESS。该组结果为当前正式资源的最终部署验收。
- **验收边界**：390px Playwright/Chromium 触屏测试通过，不等同真实 iPhone Safari 或微信内置浏览器真机验收。白屏现象在自动化环境未复现，不能声称真机白屏已被完全证实根治。不得要求用户清除网站数据、IndexedDB 或 localStorage。
- 正式入口：https://chenzhe223-tech.github.io/keypocket/ 。




## 2026-11-04 — 视觉与动效自定义中心
- 资源版本：`kp-v2-visual-motion-studio-20261104-02`；Pages run `41798223345` SUCCESS。
- KeyPocket Skill Handoff QA run `41798222925` SUCCESS：app.js syntax、Radar/KeyPocket source contract、线上资源版本及一键 Skill 收录 E2E 通过。
- DAVYLAB Browser QA run `41798222827` 正在运行；测试脚本新增桌面端主题/动效/布局操作、localStorage 持久化、恢复默认，以及 390px 手机端面板宽度检查。
- 缓存问题：旧 -01 URL 曾继续返回语法错误 bundle；最终通过同步更新 HTML 引用与 JS build marker 至 -02 解决，Pages 与线上资源校验已通过。



### 视觉与动效中心 Browser QA 最终结果（2026-11-04）
- DAVYLAB Browser QA run `41798222827` 的 KeyPocket 子项全部通过：桌面端主题切换、动效/速度/幅度/方向、布局与导航位置实时应用；localStorage 偏好持久化；恢复默认；390px 手机端面板三标签可见、documentWidth=390，无横向溢出；桌面与手机端均无 KeyPocket pageerror。
- 关键输出：`[PASS] KeyPocket 视觉与动效设置实时应用及本地持久化`；`[PASS] KeyPocket 视觉设置独立恢复默认`；`[PASS] KeyPocket 390px 手机端视觉设置面板布局`。
- 整站 Browser QA 最终结论为 FAILURE，但唯一失败项为外部产品入口 Worktoon 的 URL `https://worktoon.app.workbuddy.host/` 请求超时 25 秒，与 KeyPocket 无关。KeyPocket 子项包括原有备份覆盖/恢复、GitHub 收录、同步/密码找回 mock 等均 PASS。
- 结论：KeyPocket 视觉与动效功能的 Browser Functional Test 通过；不把整站 QA 的外部 Worktoon 超时归因于 KeyPocket。


## 2026-11-04 Skill Intelligence 首期测试范围
- 待验证：app.js 语法与 source contract；线上 HTML/JS cache-bust 版本一致；旧项目记录解锁时自动生成并加密保存 skillProfile；人工 domain/subcategory/summary 覆盖刷新后保留；场景筛选、领域快捷筛选、自然语言关键词搜索；390px 手机端无横向溢出；无 pageerror。
- 本轮未验证 GitHub README 正文抓取、Topics/目录深度分析、AI 语义归纳、Skill 之间的依赖/关联图谱。
- 风险：规则匹配的置信度仅代表元数据覆盖程度，不代表语义正确性；建议人工复核低置信度记录。
- Actions 41802609405 / 41802610144 / 41802610170 需在最终提交 SHA 上完成核验。
