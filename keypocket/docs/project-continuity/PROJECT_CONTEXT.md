# KeyPocket｜项目唯一状态文件

最后更新：2026-11-02（UTC+8）
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
| 本地 API Key 管理与加密 | 已实现 | 最新专项语法检查通过 | 正式页面/IndexedDB 初始化；浏览器烟测已添加与展示合成记录 | **未完全通过**：烟测重载后解锁卡住，需诊断 | 已部署 |
| 本地自动加密快照 | 已实现：变更防抖、解锁保护、每日快照、删除/替换前保护 | 专项脚本检查通过 | 备份 UI 在 E2E 中可打开 | API Key 快照完整创建/恢复需单独验收 | 已部署 |
| 回收站/误删恢复 | 已实现：软删除、加密 tombstone、30 天恢复、永久删除 | 专项检查通过 | Skill 项目删除/恢复 E2E 通过 | API Key 删除/恢复与过期清理尚未完整验收 | 已部署 |
| V2 多端增量同步 | 已实现：逐条加密、版本比较、冲突处理、口令校验、设备注册 | JS/源码契约通过 | Supabase schema/RLS/权限/函数部署已核验 | **未验收**：缺少真实账号双设备端到端与并发冲突测试 | 前端与后端配置已部署 |
| 云端加密备份 | 已实现：同步后每日/每月快照、跨设备查看与恢复 | 静态检查通过 | 表结构、RLS 和权限已核验 | 缺少真实账号的上传/恢复 E2E | 前端与后端表已部署 |
| Skill Radar | collector、公开榜单数据与每日 workflow 已实现 | collector self-test 与专项 QA 通过 | 真实 JSON/单日 snapshot 已发布 | **趋势排名尚不可验收**：历史只有 1 天，月/季/年仍在积累 | 已部署 |
| 简报 Skill 一键收录 | 已实现 URL 校验、确认、去重、加密保存 | 专项 QA 通过 | 线上页面可访问 | 最新线上 Playwright E2E 成功 | 已部署 |
| GitHub App / OAuth / 私有 Vault | 待开发/授权 | — | — | — | 未部署 |
| iPhone Safari / 微信浏览器专项兼容 | 待专项验收 | — | 桌面/390px 浏览器部分烟测存在 | 未验收 | 页面已部署 |

### 自动备份边界
本地自动快照在解锁状态下由数据变更触发，采用防抖写入；重大删除、导入替换前先尝试生成保护快照。快照与密钥库位于同一浏览器 IndexedDB，因此**不等于异地备份**；清理站点数据、浏览器资料损坏或设备丢失可能同时失去原记录和本地快照。每日快照也依赖用户打开并解锁页面，不是浏览器关闭后的后台任务。

### 回收站边界
API Key 和项目软删除时保留加密原记录与 tombstone；默认恢复窗口 30 天。超过期限会在后续解锁/回收站读取时清理原记录并标记 tombstone 过期。云同步必须传播删除标记，不能将旧设备记录重新“复活”。

### V2 多端同步边界
用户需要登录 Supabase 同步账号，并在各设备输入同一独立同步加密口令（至少 10 位）；它与本地密钥库解锁密码是不同概念。每个浏览器安装生成设备 ID。同步前客户端加密数据，云端仅存密文和同步元数据。生产数据库现已收敛为：同步记录表客户端只读，唯一写入口为通过身份与有效设备校验的 `keypocket_sync_put_item` RPC。尚未以真实账号完成双设备网络测试，不能宣称同步功能已验收。

### Skill Radar 数据边界
每日采集工作流与历史快照已上线；目前可核实到 1 天历史。当前 Stars 是累计量，不能伪装成增长速度；月度、季度、年度趋势需要足够历史数据后才能展示有效排名，现阶段应显示“历史积累中”。

## 4. Supabase 生产安全核验（2026-11-02）

实际项目为 KeyPocket 页面中配置的 Supabase 项目。此次只调整 KeyPocket 专属对象，不修改 Dashboard Studio 表和用户数据。

- KeyPocket 同步表均启用 RLS。
- `keypocket_sync_items` 对 `authenticated` 仅保留 SELECT；INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 已撤销，匿名角色无权限。
- 写入由 `keypocket_sync_put_item` RPC 完成；RPC 要求 `auth.uid()` 非空，验证设备属于当前用户且未撤销，并按 `user_id` 限定所有读写；函数固定空 search_path。
- RPC 仅授权 `authenticated` 执行，`anon`/PUBLIC 无 EXECUTE；旧版宽权限 `keypocket_upsert_sync_item` 已撤销。
- 其他元数据/设备/备份表保留各自所需最小操作权限，并由 RLS 限制到当前用户。
- 生产 Supabase 查询已验证表权限、函数执行 ACL、RLS 开启状态和 migration 记录。数据库没有用测试账号进行实际同步，因此不能以 SQL 权限检查代替真实 E2E。
- Supabase Security Advisor 当前仍报告两项需要如实披露的 WARN：① Auth 泄露密码防护未启用；② 面向 authenticated 的 `SECURITY DEFINER` RPC 警告。第二项为有意设计的唯一写入端点，函数已显式鉴权、检查有效设备、用户范围过滤、固定 search_path，且直接表写入权限已撤销；需持续安全复核。不要为消除告警而重新开放同步表写入。
- Supabase 管理工具为本次远端 DDL 自动生成版本号；repo 中新增 SQL migration 文件作为可复现的最终状态。未来使用 Supabase CLI 前必须先对比远端 migration history 和仓库文件，禁止盲目 db push。

## 5. 最近验证证据

- KeyPocket Skill Handoff QA：run `41408780134`，commit `b90db1495781ea3324700798d30429d85b23feca`，SUCCESS。包括 app JS 语法、collector self-test、Skill handoff source contract、线上资源验证、真实浏览器一键收录 E2E。
- GitHub Pages：run `41408779662`，commit `b90db1495781ea3324700798d30429d85b23feca`，SUCCESS。
- DAVYLAB Browser QA：run `41408780125`，同一 commit，FAIL。前序的首页、移动端、产品入口、KeyPocket 初始创建及合成 API Key 显示检查通过；在重载页面后等待 `#mainView` 显示时超时（`scripts/qa-smoke.cjs:373`）。当时诊断信息不足。
- 已在 commit `3848c1b857deac58020c14d971e5933e8acc75b1` 给该重载解锁步骤增加诊断输出。随后 QA run `41415872653` 曾在查询时处于运行中；须读取最终结果和日志后再下结论。
- Supabase 生产表权限/函数 ACL/RLS 核验在 2026-11-02 完成。当前生产端权限与上述状态一致。

## 6. 未完成事项与优先级

P0：
1. 读取最新 `DAVYLAB Browser QA` 运行结果，依据解锁诊断定位并修复 KeyPocket 本地库重载失败；为 API Key 创建、刷新解锁、快照恢复、回收站恢复补齐稳定 Playwright E2E。
2. 使用真实测试账号（不使用任何生产 API Key）完成两台浏览器/设备登录、同口令同步、设备注册、双向增量更新、删除 tombstone、恢复、冲突处理、云备份下载/恢复测试。
3. 确保错误口令、已撤销设备、未登录请求均被拒绝；确认错误不会覆盖云端密文。
4. 更新每日 Skill Radar 历史并在达到足够时间跨度前明确保持趋势视图“数据积累中”。

P1：
5. 实现设备管理与撤销入口，并在撤销后确认 RPC 拒绝该设备。
6. 完成 iPhone Safari 和微信浏览器专项测试（输入、复制、IndexedDB、下载/导入、页面恢复）。
7. 决定是否推进 GitHub App + OAuth/Worker + 私有 Vault 仓库；配置未完成前 UI 必须如实显示未绑定。

P2：
8. 完善跨设备账号恢复引导、冲突可视化、云备份恢复演练和安全说明。
9. 统一 Supabase migration history 与仓库文件，先做只读 diff，再决定如何归档远端手动 migration。

## 7. 交付等级与验收规则

每个功能按五级单独报告：Code Completed → Build Passed → Runtime Verified → Functional Tested → Production Deployed。任一级必须有证据；不能用后一级替代前一级，也不能把“部署成功”写成“功能验收通过”。所有测试只能使用合成密钥和测试账号；不得把真实 Key 写到日志、截图或测试产物。

## 8. 下一轮接手顺序

1. 先读本文件与 `docs/project-continuity/HANDOFF.md`。
2. 查 GitHub 最新 commit / Actions / Pages。
3. 先打开 QA run 失败 job log，查明 `window.__kpUnlockError`、`window.__kpUnlockStep`、lock notice 和快照状态。
4. 在隔离 Playwright profile 中复现，不使用用户浏览器存储。
5. 修复后重跑 KeyPocket 专项 E2E 与整站 Browser QA，并核实对应 SHA 的 Pages run。
6. 每次实质修改后更新本文件及交接文档。
