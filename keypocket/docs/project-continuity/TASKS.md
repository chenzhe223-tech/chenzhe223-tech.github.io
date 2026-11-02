# KeyPocket V2.0 — 任务清单

状态：PLANNED / IN_PROGRESS / IMPLEMENTED / TESTED / BLOCKED / DEPLOYED / ACCEPTED。

| ID | 优先级 | 事项 | 状态 | 下一步/证据 |
|---|---|---|---|---|
| KP-001 | P0 | 保留旧 IndexedDB/AES解密 | IMPLEMENTED | 需用旧测试库做兼容回归 |
| KP-002 | P0 | 本地加密快照/防抖 | IMPLEMENTED（基础） | 创建、解密、恢复、失败保护 E2E |
| KP-003 | P0 | API Key/项目软删除与回收站 | IMPLEMENTED（基础） | 单条、批量、永久删除、过期清理 E2E |
| KP-004 | P1 | 项目/Skill写操作接入队列 | IMPLEMENTED | 需最新线上浏览器验收 |
| KP-005 | P0 | Replace导入保护快照 | IMPLEMENTED（基础） | merge/replace恢复 E2E |
| KP-006 | P0 | V2增量同步 API/schema/RLS | PLANNED | 核对 Supabase live schema/RLS，设计事件表 |
| KP-007 | P1 | Skill Radar collector/daily snapshots | PLANNED | GitHub API采集脚本、每日定时 workflow |
| KP-008 | P1 | GitHub App + Worker private vault | BLOCKED | 创建 App、OAuth callback、Cloudflare secrets |
| KP-009 | P0 | 最新 HEAD线上 E2E | IN_PROGRESS | Actions手动 Run workflow_dispatch；确认 Radar→KeyPocket加密收录流程 |
| KP-010 | P0 | HEAD Pages正式部署 | DEPLOYED | run 41385211770，HEAD 022232f build/deploy成功 |
| KP-011 | P1 | 12个月归档策略 | PLANNED | 实现并测试 |
| KP-012 | P1 | iOS Safari/微信/双设备验收 | PLANNED | 真实设备测试 |
