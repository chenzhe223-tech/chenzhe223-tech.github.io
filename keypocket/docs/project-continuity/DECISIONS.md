# KeyPocket — 决策记录

## ADR-KP-001：连续性档案
已确认：状态文件位于 `keypocket/docs/project-continuity/`。

## ADR-KP-002：代码/证据优先
已确认：代码、Actions、线上资源优先于历史聊天或旧文档。

## ADR-KP-003：旧同步不等于 V2
已确认：Supabase 单行全量 envelope + updatedAt last-write-wins 不满足增量同步/tombstone冲突要求；V2未通过验证前不能宣称自动同步。

## ADR-KP-004：保留本地加密兼容
2026-11-02：保留 IndexedDB v1 与旧 AES-GCM/PBKDF2 格式；本地快照用当前解锁密钥加密，软删除保留原ID并使用 encrypted tombstone。

## ADR-KP-005：V2同步事件模型
目标架构：eventId、recordId、entityType、operation、recordVersion、deviceId、server cursor；delete tombstone 和 restore 事件必须参与合并，禁止整库覆盖。

## ADR-KP-006：Skill Radar真实历史
目标架构：周期增长仅用每日快照计算；公开首次采集日；样本不足显示空态；累计榜按当前 Stars 标注。

## ADR-KP-007：GitHub vault隔离
目标架构：只访问用户明确安装授权给 KeyPocket 的专用私有 vault 仓库；GitHub授权与本地解锁独立。
