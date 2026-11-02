# KeyPocket — 当前状态

最后更新：2026-11-02（UTC+8）
版本目标：V2.0
当前阶段：IN_PROGRESS；局部代码已写入，未完成正式验收。

- 仓库：chenzhe223-tech/chenzhe223-tech.github.io
- 目录：keypocket/
- 正式入口：https://chenzhe223-tech.github.io/keypocket/

## 已实现代码（尚未全量验收）
- IndexedDB v1 / AES-GCM / PBKDF2 兼容保留。
- V2 七个导航/视图入口。
- 本地加密快照、防抖、首次解锁快照与每日打开后检查。
- API Key / 项目软删除、加密 tombstone、回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除及现有 Skill 收录、GitHub 导入和热度刷新已接入持久化队列。
- 替换导入前尝试保护快照。
- Skill Radar 前端读取 `./api/skill-radar.json`，无服务数据时显示空态。
- 同步中心明确提示 V2 增量同步未启用；旧 Supabase 全量合并仍在。
- GitHub 账户页明确提示 KeyPocket App 尚未绑定。

## 五级交付状态
| 模块 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| 本地快照 | 部分已实现 | 对 e27d535 的 Node syntax PASS；最新提交需重跑 | 待验 | 恢复流程待验 | 最新 HEAD 部署待核 |
| 回收站 | 部分已实现 | 同上 | 待验 | API Key/项目/批量恢复待验 | 待核 |
| 项目资料操作 | 已实现常规 UI 路径 | 最新 HEAD 待验 | 待验 | 待验 | 待核 |
| V2 增量同步 | 未实现 | — | — | — | — |
| Skill Radar collector | 未实现（仅 UI） | — | — | — | — |
| GitHub App/Worker | 未实现 | — | — | — | — |
| 导航 UI | 已写入 | 早期源码契约 PASS | 早期线上静态资源 PASS | 全部模块未逐个 E2E | 最新 HEAD 待核 |

## CI 证据
- Run 41382408180，commit e27d535：Node syntax PASS、Skill handoff source contract PASS、live asset PASS；Playwright E2E FAIL，原因是测试复用了已有 IndexedDB，首次创建表单的 confirmPassword 不可见。
- E2E 在 commit e30311f 改为独立空 storageState；需核验其后续运行。
- commit 7cdccec 加入首次解锁保护快照；需核验最新 HEAD 的 Actions。
- 多个 Pages 中间运行被后续提交取消；需核验最新 HEAD 对应部署。

## 重大未完成
Supabase schema/RLS 和两设备事件同步；Skill Radar 每日采集与历史数据；KeyPocket GitHub App、Cloudflare Worker/Secrets；iOS Safari 与微信浏览器验收。
