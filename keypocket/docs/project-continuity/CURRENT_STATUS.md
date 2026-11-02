# KeyPocket — 当前状态

最后更新：2026-11-02（UTC+8）
目标版本：V2.0
状态：IN_PROGRESS — 已部署本地恢复基础，尚未完成整体功能验收。

## 当前线上/仓库基准
- 仓库：chenzhe223-tech/chenzhe223-tech.github.io
- 分支：main
- HEAD：`6f2b9e62f67d8f2e808f257ae398a1293f7c8b74`
- 正式入口：https://chenzhe223-tech.github.io/keypocket/
- Pages run：`41383453487`，该 HEAD build/deploy SUCCESS
- app.js：`76d10a8a3ebd21dc080964cdca4f06e64984d01d`
- index.html：`4778579552ee0d665d47876b97448d6fd65ef4bd`

## 已实现但未完整验收
- 原 IndexedDB `keypocket-local-v1` / store `vault` / DB version 1 保留；原 AES-GCM/PBKDF2 兼容保留。
- 七模块 UI：我的密钥、我的 Skills/项目、Skill Radar、回收站、自动备份、同步中心、GitHub 账户。
- 本地加密快照、防抖、首次解锁保护快照、每日打开后检查。
- API Key/项目软删除与 tombstone，回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除与 Skill 收录/更新接入持久化队列。
- 替换导入前尝试创建保护快照。
- Radar UI有四个周期入口，数据缺失时显示空态。
- 同步/GitHub 页面明确展示未启用/未绑定。

## 五级交付状态
| 模块 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| 本地快照 | 部分实现 | Node syntax在旧提交PASS；HEAD需专项QA复核 | 页面已部署 | 创建/恢复E2E未通过/未做 | HEAD Pages成功 |
| 回收站 | 部分实现 | 同上 | 页面已部署 | API Key/项目/批量恢复未测 | HEAD Pages成功 |
| 项目保存/Skill收录 | 已实现路径 | 旧提交 source contract PASS | HEAD 页面部署成功 | 最新E2E未通过/未获得新 run | HEAD Pages成功 |
| V2增量同步 | 未实现 | — | — | — | — |
| Skill Radar collector | 未实现（只有 UI） | — | — | — | — |
| GitHub App/Worker | 未实现/待授权 | — | — | — | — |
| 导航 UI | 已实现 | 旧提交静态检查通过 | HEAD部署成功 | 全模块 E2E未做 | HEAD Pages成功 |

## 最新测试证据
- Run `41383221465` / commit `2513ed8`：Node syntax PASS、source contract PASS、published assets PASS；Playwright FAIL，confirmPassword 不可见。
- E2E 脚本现为 `0dcac99`，增加读取隔离测试 IndexedDB 并仅在测试 context 清理数据库；但当前没有该版本对应的专项 QA run。
- Run `41383453487` / HEAD `6f2b9e6`：Pages build/deploy SUCCESS。
- iOS Safari/微信未测；快照/回收站恢复未 E2E。

## 阻塞
V2 Supabase event schema/RLS及双设备同步；Skill Radar真实 GitHub 历史采集；KeyPocket GitHub App/Worker OAuth及 secrets；完整本地恢复和移动端验收。
