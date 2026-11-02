# KeyPocket V2.0 — 实施任务与验收清单

状态更新时间：2026-11-02

## P0 — 安全与数据正确性
| ID | 工作项 | 当前状态 | 证据/未完成 |
|---|---|---|---|
| KP2-001 | 保留 V1 IndexedDB/加密兼容 | CODE_COMPLETE / BUILD_PASSED | Node 契约测试通过；真实旧用户数据迁移待测 |
| KP2-002 | V2 Supabase schema/RLS/RPC | RUNTIME_VERIFIED | 已部署并核查个人 RLS、Skill 只读策略和 sequence grant；真实账号读写隔离待测 |
| KP2-003 | 逐记录增量同步/冲突/墓碑 | CODE_COMPLETE / BUILD_PASSED | 静态契约测试通过；双设备并发/离线 E2E 待测 |
| KP2-004 | 回收站/恢复/永久删除传播 | CODE_COMPLETE / BUILD_PASSED | 静态契约测试通过；真实设备恢复和冲突待测 |
| KP2-005 | 本地自动检查点/云端快照 | CODE_COMPLETE / BUILD_PASSED | 代码与静态检查完成；本机浏览器运行/云端真实恢复待测 |

## P1 — 资产发现与备份
| ID | 工作项 | 当前状态 | 证据/未完成 |
|---|---|---|---|
| KP2-006 | Skill Radar schema/页面/采集器 | CODE_COMPLETE / BUILD_PASSED | Supabase 表已部署；Actions Secrets 缺失，首次采集待运行 |
| KP2-007 | GitHub App Worker | DEPLOYED / CONFIG_PENDING | Cloudflare Worker 部署 ID 229ccd2b797f405a97934b7f5f3fb5ff；App ID/Slug/PEM/Session Secret 未设置 |
| KP2-008 | 私有 keypocket-cloud-vault 仓库 | BLOCKED | 需用户创建仓库并仅安装该 App |
| KP2-009 | GitHub Pages V2 正式发布 | PENDING | V2 分支未创建/合并 PR，尚未进入 main |

## P2 — 全面验收
| ID | 工作项 | 当前状态 |
|---|---|---|
| KP2-010 | 虚构数据双设备 E2E（3 Keys/7 Projects/5 Skills） | PENDING |
| KP2-011 | 网络中断、重复同步、并发、删除恢复冲突 | PENDING |
| KP2-012 | 云端备份恢复/密文网络抓包 | PENDING |
| KP2-013 | iPhone Safari / 微信浏览器验收 | PENDING |
| KP2-014 | Worker 公网健康检查与 GitHub App 权限核验 | PENDING |
| KP2-015 | 独立安全审计 | PENDING |

## 五级交付状态
- Code Completed：V2 核心代码和技术文档已形成在 feature/keypocket-v2。
- Build Passed：当前 CI run 41379299165 成功（Node 语法 + 6 静态契约测试）；无独立 bundler 构建。
- Runtime Verified：Supabase schema/RLS 和 Worker 部署元数据已确认；前端浏览器运行未验证。
- Functional Tested：尚未完成真实账号、双设备和移动端功能测试。
- Production Deployed：Supabase V2 表和 Cloudflare Worker 已部署；KeyPocket GitHub Pages V2 未部署。
