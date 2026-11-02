# KeyPocket V2.0 — 多端同步架构

## 现状
旧客户端使用 Supabase Auth 与 `keypocket_vault_sync` 单行全量加密快照。客户端按 `updatedAt` 合并 records/projects，再写回整份快照。这不是 V2 增量事件同步；没有可靠 tombstone 冲突规则。当前 UI 明确提示 V2 同步尚未启用。

## V2 事件格式
每条事件至少具备：
- eventId（幂等 ID）
- recordId（稳定记录 ID）
- entityType（api-key / skill / project）
- operation（upsert / delete / restore）
- recordVersion（单调递增版本）
- deviceId
- clientUpdatedAt
- encryptedPayload（仅客户端密文、IV、formatVersion）

服务端以服务器 sequence/cursor 排序；不要只比较客户端设备时钟。相同 eventId 重放必须幂等。delete 创建 tombstone；restore 必须是更高版本的明确事件。旧 upsert 不得让 tombstone 复活。

## 建议表
- kp_devices：设备、最后在线时间与 cursor。
- kp_sync_events：每用户事件序列、记录 ID、版本、操作与密文。
- kp_sync_heads：每记录当前版本、操作与最新序列。
- kp_sync_snapshots：压缩后的加密快照及其 sequence。

所有用户表必须启用 RLS，并确保 auth.uid() = user_id。上线前需做跨用户 SELECT/INSERT/UPDATE 拒绝测试。

## 迁移步骤
1. 提醒用户导出独立加密备份。
2. 逐条读取现有本地数据，保留记录 ID 与分类/标签/关联。
3. 客户端解密后按 V2 envelope 重新加密，生成初始 upsert 事件。
4. 上传并回读 cursor、数量、版本校验。
5. 其他设备下载事件后本地解密与合并。
6. 只有所有记录验证一致才把设备标为 v2-ready。
7. 失败时不清空原始 IndexedDB；保留旧库与独立备份。
8. 全设备完成迁移后才停用旧单行快照接口。

## 安全
不上传解锁密码、派生 AES key 或 API Key 明文。服务端只存加密 payload 与最小必要的事件元数据。GitHub 授权与本地解锁分离。

## 当前阻塞
Supabase live schema/RLS 未核实；没有 V2 事件 API、设备注册、多设备 E2E 与生产策略验证。
