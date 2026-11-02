# KeyPocket — 交付与当前状态报告

> 本报告在 2026-10-25 连续性试运行中更新。下文区分代码可见能力、历史 QA 记录和本轮尚未重新验证的事项。

## 当前产品能力（从仓库代码可见）
- keypocket/index.html — 响应式网页界面，包含 API Key、我的应用与仓库、加密备份/导入和同步账号入口。
- keypocket/app.js — 客户端加密、IndexedDB 记录管理、项目清单、简报到 KeyPocket 的待收录流程，以及 Supabase Auth/REST 同步客户端逻辑。
- README.md — 功能、数据边界、本地运行与同步说明。
- SECURITY-ACCEPTANCE.md — 安全控制、已知边界和待核验事项。
- docs/project-continuity/ — 项目背景、当前状态、决策、任务、问题、变更、交接和恢复指令。

## 简报到 KeyPocket 的 Skill 收录流程
- 简报页通过同一网站源的浏览器存储队列传递公开 Skill 元数据。
- KeyPocket 解锁后展示待收录信息，用户明确确认后才保存。
- 仓库 URL 会被校验，并根据规范化的 GitHub 仓库地址去重。
- Skill 项目通过当前 AES-GCM 项目加密路径写入 IndexedDB。
- 该队列不包含 API Key，不会自动安装 Skill，也不等于跨设备同步。

## 可选加密同步（当前代码可见，生产安全配置尚待核验）
- 客户端使用 Supabase Auth 注册/登录，并通过 REST API 读取/写入同步记录。
- 客户端先将 records 与 projects 快照使用 AES-GCM 加密，再发送 envelope；云端行另包含 user ID、schema version、revision 和更新时间。
- 生产 Supabase 表的 RLS/访问策略、真实网络请求、账号恢复与同步冲突场景尚需独立核验。
- 同步前应导出加密备份，并确保各设备使用相同的本地解锁密码。
- 由于页面存在真实同步入口，旧版“没有云同步 / connect-src 'none'”说明已不适用于当前页面，已在本次更新中标记并修正相关文档。

## 历史 QA 记录（不是本轮新跑的结果）
旧版报告曾记录 JavaScript 语法、简报交接 E2E、密文中不含仓库 URL 明文以及 GitHub Pages 部署检查通过。此处保留其历史意义，但本轮尚未重新运行这些检查，不能将其视为当前提交的验收结论。

## 本轮连续性试运行
- [x] 新增 9 份连续性档案并从 GitHub 逐一回读。
- [x] 更新项目背景与交接单，记录发现的同步/CSP 文档冲突。
- [x] 对 README、安全验收和交付报告进行最小必要的状态描述修正。
- [ ] 当前提交的语法 / 静态 / E2E 测试重新运行。
- [ ] 核实 GitHub Actions 最新结果及 Pages 部署版本。
- [ ] 核实 Supabase RLS 与生产访问策略。
- [ ] 完成移动设备验收。
- [ ] 完成独立安全审计（目前尚未完成）。

## 本地运行
从仓库根目录执行：

    python -m http.server 8000

打开 http://localhost:8000/keypocket/。Web Crypto 和剪贴板能力需要安全上下文；现代浏览器通常将 localhost 视为安全上下文。


## 2026-11-02 — KeyPocket V2.0 升级分支

### 代码完成（feature/keypocket-v2）
- 新增 app-v2.js，保留 V1 IndexedDB 与 AES-GCM/PBKDF2 解密路径。
- 新增自动快照、回收站、版本化增量同步、Skill Radar 客户端和 GitHub App Worker 客户端。
- 新增 Supabase migrations、每日 Skill Radar 采集器、GitHub App Worker、CI 和契约测试。

### 后端配置完成
- Supabase 项目已创建 V2 专属同步、备份、设备和 Skill 历史表；RLS 已开启并核验。
- Cloudflare Worker keypocket-vault-api 已通过 Cloudflare API 部署，部署 ID：229ccd2b797f405a97934b7f5f3fb5ff。
- Worker 外网运行探测尚未完成；GitHub App Secrets 与 App 安装未配置。

### 当前测试证据
- GitHub Actions：KeyPocket V2 CI run 41378870974 于 2026-11-02 02:39 UTC 成功；对应 commit eaddaa8bd4f19b545d6ae0eb398cb60354371518。
- 该 run 覆盖 Node 语法与 6 项静态契约测试；它早于后续版本修复提交，不能代替最新 HEAD 的 CI 结果。
- 真实双设备、浏览器 E2E、iOS/微信浏览器和生产线上版本尚未通过验收。

### 发布状态
- Code Completed：V2 升级分支主要代码已形成，仍需最新 CI 与审查。
- Build Passed：仅静态 Node 语法检查通过；无独立前端构建系统。
- Runtime Verified：Cloudflare API 确认 Worker 部署成功，但外部健康检查未验证。
- Functional Tested：仅 6 项静态契约测试通过，核心真实业务 E2E 未完成。
- Production Deployed：Supabase schema 和 Worker 已部署；KeyPocket GitHub Pages V2 尚未部署。
