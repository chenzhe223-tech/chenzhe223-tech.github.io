# KeyPocket — 项目长期基准与 V2.0 架构

- 最近核实：2026-11-02（UTC+8）
- 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io
- 应用目录：keypocket/
- 正式地址：https://chenzhe223-tech.github.io/keypocket/
- 生产分支：main；V2 升级分支：feature/keypocket-v2
- 产品定位：本地优先的个人 AI 资产管理中心，管理 API Key、Skills、项目和加密备份。

## 1. 既有基线（不可随意破坏）
- IndexedDB 数据库 keypocket-local-v1，object store vault。
- AES-GCM 加密 JSON；PBKDF2-HMAC-SHA-256，默认 310,000 次。
- 原 V1 sealRecord/openRecord、sealProject/openProject、手动导出导入流程继续保留。
- 原 Supabase keypocket_vault_sync 表不删除、不覆盖，作为旧版首次迁移读取源。
- 原页面视觉基础和密钥/项目管理模块保留；V2 通过附加脚本增加导航模块。

## 2. V2 新增客户端
- app-v2.js：自动检查点、本地每日/月度/重要快照、回收站、逐记录增量同步、设备状态、Skill Radar、GitHub Vault 前端。
- 系统行以 kpv2: 前缀隔离，不参与 V1 业务记录遍历。
- 自动本地检查点防抖约 900ms；保留自动检查点 1、每日 30、月度 12、里程碑 24。
- 回收站默认 30 天，墓碑参与同步；永久删除以加密标记传播。
- 云端备份只有在 Supabase 认证并成功同步后才形成；GitHub App 备份需要授权。
- 不允许将本机 IndexedDB 副本描述为云端备份。

## 3. Supabase
KeyPocket 使用现有项目 ref urzgghdwawpwqliafrzv（该项目还承载其他产品，不可清理/重建非 KeyPocket 表）。
V2 表：
- keypocket_sync_meta
- keypocket_sync_items
- keypocket_backup_snapshots
- keypocket_devices
- keypocket_skill_repos
- keypocket_skill_snapshots

同步 RPC：keypocket_upsert_sync_item，SECURITY INVOKER。个人表 RLS 以 auth.uid() 隔离；Skill Radar 表浏览器只读，collector 用 service_role 写入。
旧表 keypocket_vault_sync 保留。

## 4. Skill Radar
- GitHub 公共仓库搜索为主要来源；过滤 fork、归档和无关教程。
- 保存仓库当前元数据与每日历史 Stars/Forks 快照。
- 月度 30 天、季度 90 天、年度 365 天增长榜；累计榜按当前 Stars。
- 评分：Stars 增长 70%、Forks 增长 20%、README 相关性 10%；不代表安装量。
- 不足完整历史周期时显示数据积累中；首次采集日是历史统计起点。
- workflow: .github/workflows/keypocket-skill-radar.yml；依赖 GitHub Actions Secrets。

## 5. GitHub App Vault
- Worker: https://keypocket-vault-api.chenzhe223.workers.dev
- Worker 固定操作用户授权的 keypocket-cloud-vault 私有仓库和 keypocket-vault.v2.json 文件。
- Contents 读写、Metadata 只读；Installation Token 服务端生成并只限定此仓库。
- App 私钥、App ID、Session Secret 必须存 Cloudflare Worker Secrets。
- 当前 Worker 已部署，App 未配置/安装；不得显示为已连接。

## 6. 数据迁移与冲突策略
- 首次 V2 同步尝试解密旧整库快照，按记录 ID/更新时间合并，不直接覆盖更高版本本地记录。
- 逐条同步按 version、updated_at、device_id 确定胜出版本。
- 并发编辑同一记录使用 LWW，非字段级合并。
- 软删除形成 tombstone；恢复会以新时间版本写回。
- 永久删除标记参与同步；墓碑保留以防旧设备复活资产。

## 7. 安全边界
- API Key 明文不得上传；客户端加密后才写入 Supabase/GitHub。
- 服务端能看到必要的用户/实体/版本/删除元数据，但不应获得本地密码或密钥明文。
- Supabase publishable key 可在客户端使用；service_role key 只允许 GitHub Actions Secret。
- Worker 私钥与 Session Secret 不得写入仓库、浏览器或日志。
- 本地密码与 Supabase 登录密码分离；不同设备需要相同本地密码生成共享云端密钥。
- 独立安全审计尚未完成。

## 8. 连续性文件
HANDOFF.md、CURRENT_STATUS.md、DECISIONS.md、TASKS.md、TEST_AND_ISSUES.md、CHANGELOG.md 是最新交接事实入口；但与代码冲突时必须核实实际代码和服务状态。
