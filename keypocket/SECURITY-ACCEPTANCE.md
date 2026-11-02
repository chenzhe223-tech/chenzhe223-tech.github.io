# KeyPocket 安全边界与验收状态

> 本文件区分代码中可见的实现、已有历史检查记录和仍需重新验证的项目。代码检查不等于独立安全审计。

## 1. 从当前代码中可见的实现
- [x] API Key 记录在客户端使用 AES-GCM 加密后保存至 IndexedDB。
- [x] 本地密码通过 PBKDF2-HMAC-SHA-256 派生 AES-GCM 密钥；当前代码默认迭代次数为 310,000。
- [x] 派生密钥不可导出，并在解锁期间保存在内存中。
- [x] UI 默认遮蔽密钥，显示/复制需要明确操作。
- [x] 备份使用独立密码加密；导入流程包含文件大小、迭代次数、字段和记录数量等校验。
- [x] 简报到 KeyPocket 的待收录队列只接受经过验证的公开 GitHub 仓库资料；保存前需要解锁和用户确认。
- [x] 项目记录通过现有 AES-GCM 路径加密后保存到 IndexedDB。
- [x] 当前页面有可选同步账号 UI。客户端使用 Supabase Auth / REST API；同步前会将 records 与 projects 快照用 AES-GCM 加密，再发送 envelope。
- [x] 当前 index.html CSP 的 connect-src 允许 GitHub API 和 Supabase 域名；这与旧版 connect-src 'none' 描述不同。

## 2. 同步模型的已知边界

从当前客户端代码可见：
- Supabase 请求会包含认证信息；客户端配置包含 publishable 项目键，该类客户端键本身不是服务端秘密，但必须依赖正确的服务端访问策略。
- 同步 payload 包含加密的快照 envelope；云端记录另有 user ID、schema version、revision 和更新时间等元数据。
- 客户端使用本地解锁密码派生用于同步快照的加密密钥，因此跨设备同步需要用户在各设备使用兼容的本地解锁密码。
- 代码可见的客户端加密并不能单独证明服务端表策略配置正确。

以下项目仍未核实：
- [ ] Supabase keypocket_vault_sync 表的 RLS 是否启用，以及 SELECT/INSERT/UPDATE 策略是否严格限制到当前认证用户。
- [ ] 生产项目配置、认证会话生命周期、账号删除/恢复策略和服务端日志保留情况。
- [ ] 真实浏览器网络面板中请求与预期一致，未发送明文 records/projects。
- [ ] 云端 envelope 在生产环境中的实际存储形态与权限隔离。
- [ ] 同步冲突、并发更新、请求失败、重复点击和恢复场景的 E2E 测试。
- [ ] 独立安全审计。

## 3. 已有历史检查记录（需在本轮重新执行前视为历史证据）

历史交付资料记录过 JavaScript 语法、AES-GCM 往返、错误密码拒绝、备份往返和简报收录流程检查。由于这些记录不等于对当前提交重新运行测试，本文件不把它们计作本次验证结果。

## 4. 本次连续性试运行检查
- [x] 读取当前 README、index.html、app.js 片段和既有交付/安全文档。
- [x] 发现并记录旧文档与当前页面/代码之间的同步及 CSP 描述冲突。
- [ ] 对当前 HEAD 重新运行 JavaScript 语法检查。
- [ ] 运行现有静态检查与 Skill handoff 测试。
- [ ] 运行完整浏览器 E2E。
- [ ] 核对 Supabase RLS / 访问策略。
- [ ] 核对 GitHub Pages 当前部署并执行生产冒烟测试。
- [ ] 在真实 iOS / Android 浏览器完成移动端验收。

## 5. 安全验收原则
- 不要将“页面能打开”视为完整功能验收。
- 不要将“payload 在客户端加密”视为服务端权限策略已验证。
- 不要把“CI 曾通过”当作当前提交已通过。
- 不要把客户端 publishable key 当作用户 API Key 或服务端秘密；也不要将任何真正的秘密写入仓库。
- 任何安全结论都应附带对应代码、测试、配置或运行证据。


## 5. V2.0 安全边界与真实部署状态（2026-11-02）

### 5.1 已部署到 Supabase 的隔离数据层
- [x] 在现有 KeyPocket Supabase 项目 urzgghdwawpwqliafrzv 中新增 keypocket_sync_meta、keypocket_sync_items、keypocket_backup_snapshots、keypocket_devices。
- [x] 新增 keypocket_upsert_sync_item，使用 SECURITY INVOKER；写入时要求有效 auth.uid()，服务端按 version、updated_at、device_id 比较，不接受旧版本覆盖新版本。
- [x] 新增 keypocket_skill_repos、keypocket_skill_snapshots；RLS 开启，浏览器角色仅有公开只读权限，采集任务需使用服务端 service_role 凭据。
- [x] 已核对新增个人资料表的 RLS：SELECT/INSERT/UPDATE 均限制到 auth.uid() = user_id；备份表另允许用户删除自己的快照。
- [x] 已核对 Skill Radar identity sequence 对 service_role 的 USAGE 权限。
- [x] 旧表 keypocket_vault_sync 未删除、未修改；其既有 RLS 仍保留。
- [ ] 尚未通过真实用户账号做两设备认证、读写隔离和密文抓包验收。

### 5.2 本地与云端加密
- V1 IndexedDB 名称、对象仓库、旧 AES-GCM 密文和 PBKDF2 迭代次数未更改；V2 作为附加脚本接入。
- V2 同步载荷在浏览器内使用用户本地解锁密码派生的共享密钥再次进行 AES-GCM 加密；服务器只比较明文版本元数据，读取不到记录内容。
- 明文 API Key 不应进入日志、Worker 请求或 Supabase payload。当前静态契约测试已验证 V2 代码包含客户端加密路径，但尚未完成真实浏览器网络抓包，故“生产环境无明文外传”仍标记为待运行验收。
- 跨设备首次初始化需要各设备使用相同 KeyPocket 本地解锁密码。Supabase 登录密码与 KeyPocket 本地解锁密码分离。
- GitHub Vault Worker 只接受固定文件路径和带 salt/iterations/iv/data 的加密封包；App installation token 在 Worker 服务端临时生成并限定为 keypocket-cloud-vault 一个仓库。

### 5.3 已完成与未完成的安全验证
- [x] Supabase RLS 开启及策略核验。
- [x] 新增同步 RPC 使用 SECURITY INVOKER，按用户认证身份执行。
- [x] GitHub Worker 已部署，App 私钥和 SESSION_SECRET 未写入仓库。
- [x] 静态契约测试覆盖 V1 加密兼容、V2 快照/回收站、增量同步/RLS、真实历史榜单和 Worker 固定仓库边界。
- [ ] Cloudflare Worker 外部 /health 网络探测（当前执行容器 DNS 解析失败，不能标记通过）。
- [ ] 配置 GitHub App ID/Slug/私钥与 SESSION_SECRET。
- [ ] 配置 GitHub Actions 的 KEYPOCKET_SUPABASE_URL 与 KEYPOCKET_SUPABASE_SERVICE_ROLE_KEY。
- [ ] 创建并授权 keypocket-cloud-vault 私有仓库。
- [ ] 使用虚构数据完成双设备并发、离线恢复、删除冲突与云端恢复 E2E。
- [ ] 在 iPhone Safari 与微信浏览器完成真实操作验收。
- [ ] 独立安全审计。

### 5.4 当前禁止做出的结论
- 不得称 V2.0 已完成生产上线；分支尚未合并到 main。
- 不得称 GitHub App 已绑定；用户授权与 Worker Secrets 尚未配置。
- 不得称 Skill Radar 已有真实榜单；采集任务需要 Actions Secrets，尚未成功执行首次每日采集。
- 不得称云端备份/跨设备已通过真实双设备测试；当前只完成后端数据层和客户端代码/静态契约测试。
