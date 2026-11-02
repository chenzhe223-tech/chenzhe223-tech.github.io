# KeyPocket V2 多端同步架构

最后更新：2026-11-02（UTC+8）

## 当前实现

前端使用 Supabase Auth + REST/RPC：
- `keypocket_sync_meta`：每用户独立 salt、PBKDF2 iterations、schema version 和加密验证器。
- `keypocket_devices`：按用户登记浏览器设备 ID、设备标签、最近活跃时间和撤销时间。
- `keypocket_sync_items`：以 `user_id + entity_type + entity_id` 作为单条同步实体唯一键，记录 version/device/updated/deleted/payload/schema version。
- `keypocket_backup_snapshots`：每日/月度独立加密云快照。
- `keypocket_vault_sync`：旧版兼容表；V2 逐条同步不再依赖旧版宽权限写入 RPC。

本地 API Key 与项目先由应用本地密钥保护。跨设备同步时，客户端用独立同步口令通过 PBKDF2-HMAC-SHA-256（默认 310,000 次）导出 AES-GCM 密钥；逐条 payload 和云备份快照均在客户端加密。云端只收到密文和必要的同步元数据。

## 同步流程

1. 用户登录 Supabase 同步账号。
2. 用户输入独立跨设备加密口令（至少 10 位）；它不是本地密钥库解锁密码。
3. 首次初始化时生成随机 salt、派生密钥并写入加密验证器；后续设备必须能解密验证器，否则拒绝同步写入。
4. 当前浏览器生成稳定设备 ID 并登记。
5. 拉取自己的 sync_items；客户端解密后与本地实体/tombstone 合并。
6. 通过 `keypocket_sync_put_item` 执行 compare-and-set 版本更新；冲突根据版本、更新时间和设备标识确定处理方向。
7. 同步结束后写入当前设备的每日和月度加密快照；每日快照保留 35 天，月度归档保留 400 天。
8. 锁定本地密钥库时清除本会话内存密钥，不把口令或派生密钥持久化到 localStorage。

## 生产安全边界

- 所有 KeyPocket 同步表均开启 RLS，用户数据按 `auth.uid() = user_id` 限制。
- `keypocket_sync_items` 对 authenticated 仅开放 SELECT；客户端不得通过 REST 直接 INSERT/UPDATE/DELETE。
- 唯一写入端点 `keypocket_sync_put_item` 使用 SECURITY DEFINER，但仅对 authenticated 授权。函数内部显式验证 `auth.uid()`、设备归属及未撤销状态，写入 user_id 固定为当前用户；search_path 为空并使用限定 schema 的对象名。
- 旧 `keypocket_upsert_sync_item` 已撤销 EXECUTE。
- 其余同步元数据/设备/备份表保持所需 CRUD，并由用户 RLS 策略限制。
- 不能开放 service_role/secret key 到前端；当前浏览器只使用公开 publishable/anon key 和用户 access token。

## 当前限制与验收状态

代码、迁移与生产权限已实现并核验；但截至 2026-11-02 尚未用真实测试账号完成两套独立浏览器/设备的完整端到端测试。以下仍需验收：
- 首次账号连接、口令初始化、第二设备口令验证。
- 两端新增、编辑、删除、恢复的双向传播。
- 并发更新和版本冲突。
- 错误口令、未登录和已撤销设备必须拒绝写入。
- 云备份上传、跨设备查看、恢复前保护快照与恢复后再次同步。
- 手机 Safari 与微信浏览器会话稳定性。

Supabase Advisor 会对 authenticated 可调用的 SECURITY DEFINER RPC 给出警告。此处属于有意的唯一写入端点，不能为了清除告警恢复直接表写权限；必须持续检查函数内部授权、search_path 与用户范围。
