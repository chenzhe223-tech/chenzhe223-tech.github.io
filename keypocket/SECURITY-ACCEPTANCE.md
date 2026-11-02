# KeyPocket 安全边界与验收状态

最后更新：2026-11-02（UTC+8）

## 本地安全实现
- 原 IndexedDB `keypocket-local-v1` / store `vault` / DB version 1 保留。
- 原 API Key/project AES-GCM envelope 与 PBKDF2-HMAC-SHA-256 派生流程保留，默认 310,000 次。
- 本地快照在写入 IndexedDB 前通过当前客户端密钥 AES-GCM 加密。
- 常规记录/项目保存接入快照防抖；删除、导入替换等破坏性操作前尝试创建保护快照。
- 删除操作使用加密原记录与 encrypted tombstone，默认 30 天可恢复。
- 云端同步 payload 使用用户独立同步口令派生的 AES-GCM 密钥加密；云端不接触 API Key 明文或派生密钥。
- 跨设备同步口令验证器本身也以派生密钥加密；口令不匹配时阻止本轮写入。

## Supabase 生产安全（2026-11-02 已核验）
- KeyPocket 同步元数据、同步记录、设备、云备份表均已开启 RLS。
- 读策略按 `auth.uid() = user_id` 限制当前用户。
- `keypocket_sync_items` 对客户端只开放 authenticated SELECT；直接 INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER 已撤销。匿名角色无表权限。
- 唯一同步记录写入口 `public.keypocket_sync_put_item`：
  - authenticated 可 EXECUTE；anon/PUBLIC 不可 EXECUTE。
  - 函数要求 `auth.uid()` 非空。
  - 验证目标设备属于同一用户且 `revoked_at IS NULL`。
  - 每次读写明确限制 `user_id = auth.uid()`。
  - SECURITY DEFINER 以便在客户端无表写权限时安全完成原子 CAS；search_path 固定为空，SQL 对表和 auth 函数均使用 schema-qualified 名称。
- 删除同步表的 INSERT/UPDATE RLS policies，避免日后误授表权限重新打开旁路。
- 旧宽权限 `keypocket_upsert_sync_item` RPC 对 PUBLIC/anon/authenticated 已撤销。
- 生产查询已验证权限、RPC ACL、search_path、RLS 及 migration 记录；未用真实用户凭据完成双设备功能测试。

## Supabase Advisor 警告
1. `auth_leaked_password_protection`：Auth 泄露密码防护未启用，需要在 Supabase Auth 设置中评估开启。
2. `authenticated_security_definer_function_executable`：当前唯一同步写入 RPC 对 authenticated 可执行，因此 Advisor 会提示 SECURITY DEFINER。此为有意的受限 endpoint，不可盲目撤销 EXECUTE；必须持续审查函数鉴权、用户范围、有效设备、空 search_path 和无表写权限。
3. 同库中 Dashboard Studio 的部分性能告警不属于 KeyPocket 缺陷，排查时需区分。

## 不能据此声称已完成
- 生产真实账号双设备登录、双向同步与并发冲突 E2E。
- 云端快照上传/新设备恢复完整 E2E。
- API Key 创建→刷新→再次解锁的稳定性验收；当前整站 Browser QA 对该路径存在待诊断失败。
- iOS Safari 与微信浏览器兼容验收。
- GitHub App、Worker OAuth、私有 Vault 配置。

## 安全红线
不上传本地解锁密码、同步口令、派生密钥或 API Key 明文；不把密钥写入日志、截图、CI artifact；所有云端用户数据必须有 RLS 和当前用户范围约束。测试只能用合成密钥和测试账号。
