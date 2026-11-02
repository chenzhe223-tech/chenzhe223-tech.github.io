# KeyPocket V2.0 — 任务清单

状态：PLANNED / IN_PROGRESS / IMPLEMENTED / TESTED / BLOCKED / DEPLOYED / ACCEPTED。

| ID | 优先级 | 事项 | 状态 | 下一步/证据 |
|---|---|---|---|---|
| KP-001 | P0 | 保留旧 IndexedDB/AES解密 | IMPLEMENTED | 旧数据回归待做 |
| KP-002 | P0 | 本地加密快照/防抖 | IMPLEMENTED | 创建、恢复、失败回滚 E2E |
| KP-003 | P0 | API Key/项目软删除与回收站 | IMPLEMENTED | 单条、批量、永久删除/过期 E2E |
| KP-004 | P1 | 项目/Skill写操作接入队列 | IMPLEMENTED | 功能回归 |
| KP-005 | P0 | Replace导入保护快照 | IMPLEMENTED | merge/replace恢复 E2E |
| KP-006 | P0 | V2增量同步 API/schema/RLS | PLANNED | Supabase live schema/RLS核查 |
| KP-007 | P1 | Skill Radar collector/daily snapshots | PLANNED | GitHub API采集脚本与定时 workflow |
| KP-008 | P1 | GitHub App + Worker private vault | BLOCKED | 创建 App、OAuth callback、secrets |
| KP-009 | P0 | 最新 HEAD专项 E2E | IN_PROGRESS | 手动 workflow_dispatch KeyPocket Skill Handoff QA；查 confirmPassword 隐藏根因 |
| KP-010 | P0 | HEAD Pages正式部署 | DEPLOYED | run 41383453487，HEAD 6f2b9e6 build/deploy成功 |
| KP-011 | P1 | 12个月归档策略 | PLANNED | 实现并测试 |
| KP-012 | P1 | iOS Safari/微信/双设备验收 | PLANNED | 真实设备测试 |
