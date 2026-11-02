# KeyPocket V2.0 — 最新交接单

- 项目：KeyPocket
- 更新时间：2026-11-02（UTC+8）
- 交接原因：V2.0 升级实施与待配置项交接
- 当前状态：V2_CODE_READY / EXTERNAL_CONFIG_PENDING
- 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io
- 项目目录：keypocket/
- 正式应用：https://chenzhe223-tech.github.io/keypocket/
- 开发分支：feature/keypocket-v2
- 本轮最近已验证 CI commit：1e8086f6686c6647678a60aec0f8bf2d3c2f101e
- GitHub Pages：V2 分支尚未合并，线上应用仍为 main 版本
- Supabase：V2 专属表与策略已部署、已核查
- Cloudflare Worker：keypocket-vault-api 已部署；GitHub App Secrets 未配置
- 当前 PR：尚未创建，准备提交审查

## 1. 必须继承
- GitHub 最新 main 是生产代码事实源；feature/keypocket-v2 是本轮待审升级分支。
- 保留旧 IndexedDB、AES-GCM/PBKDF2 与 V1 解密兼容；不要重建本地库。
- 不覆盖或清空旧 Supabase keypocket_vault_sync 表。
- 不把静态测试、Worker API 部署、生产网页发布或真实功能验收混为一谈。
- 不把 GitHub App、云端备份或 Skill Radar 标成已绑定/有数据，除非存在实际配置与运行证据。
- 不在仓库、Issue、日志或交接材料中保存任何真实密钥、用户 API Key 或凭据。

## 2. 本轮已完成
1. 审查了 README、连续性文件、index.html、app.js、CI 与最新提交。
2. Supabase 新增 keypocket_sync_meta、keypocket_sync_items、keypocket_backup_snapshots、keypocket_devices、keypocket_skill_repos、keypocket_skill_snapshots，以及版本保护 RPC；RLS 和策略已核查。
3. GitHub 分支 feature/keypocket-v2 已创建并提交 V2 客户端、迁移文件、Skill Radar 采集器/工作流、GitHub App Worker、测试和技术文档。
4. Cloudflare Worker keypocket-vault-api 已部署，部署 ID：229ccd2b797f405a97934b7f5f3fb5ff。
5. CI run 41379299165 成功，commit 1e8086f6686c6647678a60aec0f8bf2d3c2f101e；Node 语法和 6 项静态契约测试成功。

## 3. 仍未完成/阻塞
1. GitHub App 尚未创建或安装；Worker 缺少 GITHUB_APP_ID、GITHUB_APP_PRIVATE_KEY、SESSION_SECRET 和 GITHUB_APP_SLUG。
2. 尚未创建/授权私有仓库 keypocket-cloud-vault。
3. GitHub Actions 缺少 KEYPOCKET_SUPABASE_URL 与 KEYPOCKET_SUPABASE_SERVICE_ROLE_KEY，Skill Radar 首次采集未运行。
4. Cloudflare Worker 公网 /health 冒烟探测未完成；当前执行环境 DNS 解析失败。
5. 尚未使用专用测试账号完成双设备同步、离线重试、冲突、回收站和云端恢复 E2E。
6. 尚未在 iPhone Safari、微信浏览器完成实机验收。
7. V2 PR 尚未创建/合并；GitHub Pages 尚未发布 V2 客户端。

## 4. 五级交付状态
| 模块 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| 自动保存/本地快照 | 是 | 静态检查通过 | 待浏览器验证 | 待 E2E | 未随 V2 页面上线 |
| 回收站/恢复 | 是 | 静态检查通过 | 待浏览器验证 | 待 E2E | 未随 V2 页面上线 |
| Supabase 增量同步 | 是 | 静态检查通过 | Schema/RLS 已验证 | 双设备待测 | 后端表已部署，页面未部署 |
| Skill Radar | 是 | 静态检查通过 | Schema 已部署 | 首次采集待运行 | 无真实榜单数据 |
| GitHub App Vault | 是 | 静态检查通过 | Worker 部署元数据已确认 | Secrets/授权/仓库读写待测 | Worker 已部署，App 未绑定 |

## 5. 下一步执行
1. 对当前分支创建 PR，等待 PR CI 与代码审查。
2. 完成客户端代码审查，特别检查并发版本、恢复、回收站、Supabase session refresh 与 Worker API。
3. 用户按 GITHUB-APP-VAULT.md 配置 GitHub App、私有仓库与 Cloudflare Secrets。
4. 用户在 GitHub Actions 配置 Skill Radar 两个 Secrets 并执行首次采集。
5. 完成虚构测试数据 E2E 和真实浏览器网络密文检查。
6. 通过验收后合并 PR，确认 GitHub Pages 部署成功，再做线上冒烟测试。
7. 每项结果以实际证据更新本文件与 CURRENT_STATUS.md。

## 6. 关键技术文件
- docs/architecture/V2.0-DATA-MODEL.md
- docs/AUTOMATIC-BACKUP-AND-RECOVERY.md
- docs/ENCRYPTED-SYNC.md
- docs/SKILL-RADAR.md
- docs/GITHUB-APP-VAULT.md
- SECURITY-ACCEPTANCE.md
- DELIVERY-REPORT.md
