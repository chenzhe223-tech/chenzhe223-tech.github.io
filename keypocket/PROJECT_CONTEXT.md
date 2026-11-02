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
| 本地 API Key 管理与加密 | 已实现：IndexedDB、AES-GCM、PBKDF2 | JS/Chromium 检查通过 | 正式站与 IndexedDB 实际运行 | **合成数据 E2E 通过**：新增、多条保存、刷新解锁、搜索/筛选/编辑、收藏/复制 | a05d4bb 对应 Pages 成功 |
| 本地自动加密快照 | 已实现：变更防抖快照、删除/替换前保护 | 检查通过 | 备份中心真实页面运行 | **合成数据 E2E 通过**：加密备份导出/导入、本地快照创建/恢复 | a05d4bb 对应 Pages 成功 |
| 回收站/误删恢复 | 已实现：软删除、加密 tombstone、30 天恢复 | 检查通过 | 回收站页面真实运行 | **合成数据 E2E 通过**：API Key 批量恢复、项目恢复并保留原 ID；30 天到期边界未专项测 | a05d4bb 对应 Pages 成功 |
| V2 多端增量同步 | 已实现：逐条加密、版本比较、冲突处理、设备注册、401 自动续期与 refresh token 轮换 | Skill Handoff 与 Browser QA 通过 | Supabase schema/RLS/权限已核验；正式页面运行 | **部分通过**：401→refresh→令牌轮换由 mock E2E 通过；真实账号双设备同步/并发冲突未验收 | a05d4bb 对应 Pages 成功 |
| 云端加密备份 | 已实现：成功同步后刷新当日/月度加密快照 | JS/CI 检查通过 | 表、RLS、权限、唯一索引已核验 | 真实账号上传、跨设备查看与恢复未执行 | a05d4bb 对应 Pages 成功 |
| 设备管理/撤销 | 已实现：设备列表、撤销其他设备、当前设备自撤销保护 | CI 通过 | 正式页面运行 | **模拟 REST E2E 通过**：用户/设备/未撤销行过滤和服务端响应校验；真实 RPC 拒绝已撤销设备待测 | a05d4bb 对应 Pages 成功 |
| Skill Radar | collector、公开榜单数据与每日 workflow 已实现 | collector self-test 与专项 QA 通过 | 真实 JSON/单日 snapshot 已发布 | **趋势排名暂不验收**：月/季/年历史仍在积累 | 已部署 |
| 简报 Skill 一键收录 | URL 校验、确认、去重、加密保存已实现 | 专项 QA 通过 | 正式页面和 bundle 已核验 | Playwright 线上一键收录 E2E 通过 | 已部署 |
| GitHub App / OAuth / 私有 Vault | 待开发/授权 | — | — | — | 未部署 |
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
每日采集工作流与历史快照已上线；目前可核实到 1 天历史。当前 Stars 是累计量，不能伪装成增长速度；月度、季度、年度趋势需要足够历史数据后才能展示有效排名，现阶段应显示“历史积累中”。

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

## 5. 最近验证证据

- 最新已核验 main：`a05d4bb0a83edf8fe37c26f26cdae353799978c5`。
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

**仍未证明**：真实账号双设备登录/双向同步、错同步口令拒绝、并发冲突、撤销设备后 CAS RPC 真实拒绝、云端快照跨设备恢复，以及 iPhone Safari/微信内置浏览器实机兼容。

## 6. 未完成事项与优先级

P0：
1. 使用独立真实测试账号和两个隔离浏览器 profile/设备，完成双向新增、编辑、删除同步、tombstone 传播、错口令拒绝、并发冲突与云端快照跨设备恢复；严禁使用真实 API Key。
2. 真实验证设备撤销后 `keypocket_sync_put_item` 拒绝写入，并验证未登录请求被拒绝、错误不会覆盖云端密文。
3. 验证 refresh token 真实轮换后两设备登录连续性、退出登录及设备状态行为；不要用 mock 代替账号验收。

P1：
4. 完成 iPhone Safari 与微信内置浏览器实机测试（创建/解锁、输入、复制、IndexedDB、导出/导入、页面恢复）。
5. 补测回收站 30 天到期边界、云端 daily/monthly snapshot 保留清理及网络中断恢复行为。
6. 继续采集 Skill Radar 历史；跨度充足前，月/季/年增长排名必须显示“数据积累中”。
7. 评估 GitHub App + OAuth/Worker + 私有 Vault；配置前 UI 必须保持未绑定。

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
