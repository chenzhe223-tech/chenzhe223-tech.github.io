# KeyPocket — 连续性与产品变更记录

## [2026-11-02] — V2.0 升级实施（feature/keypocket-v2）

### Added
- 增加 app-v2.js：自动检查点、每日/月度/里程碑快照、30 天回收站、永久删除墓碑传播、逐记录加密同步、设备状态、云端恢复、Skill Radar 和 GitHub App Vault 前端。
- 增加 Supabase migrations：逐记录同步、备份快照、设备登记、Skill 当前仓库与每日历史快照、service_role sequence grant。
- 增加 GitHub Actions：V2 syntax/contract CI 和每日 Skill Radar collector。
- 增加 GitHub App Worker：固定 private vault 仓库/文件、HMAC session、GitHub App JWT 和受限 Installation Token。
- 增加数据模型、自动备份恢复、加密同步、Skill Radar 和 GitHub App 技术文档。

### Changed
- index.html 加载 V1 app.js 后再加载 V2 app-v2.js；扩展 CSP 到 Cloudflare Workers。
- README、SECURITY-ACCEPTANCE、DELIVERY-REPORT 与全部连续性文件更新至 V2 状态。

### Backend
- Supabase V2 专属 schema/RLS 已部署并核验；旧整库同步表未删除。
- Cloudflare Worker keypocket-vault-api 已部署，deployment ID 229ccd2b797f405a97934b7f5f3fb5ff；Secrets/App 安装仍待配置。

### Verification
- GitHub Actions run 41379299165 / commit 1e8086f6686c6647678a60aec0f8bf2d3c2f101e：Node syntax 与 6 项静态 contract tests success。
- 未完成双设备 E2E、iOS/微信实机验证、Worker 公网健康探测和生产 GitHub Pages 部署。
- Skill Radar Actions Secrets 未配置，首次采集未运行。
