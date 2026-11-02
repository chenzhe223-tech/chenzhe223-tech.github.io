# KeyPocket — 当前状态快照

- 快照时间：2026-11-02（UTC+8）
- 产品版本目标：V2.0
- 仓库：chenzhe223-tech/chenzhe223-tech.github.io
- 目录：keypocket/
- 生产分支：main
- 升级分支：feature/keypocket-v2
- 最近已验证 CI commit：1e8086f6686c6647678a60aec0f8bf2d3c2f101e
- 正式应用：https://chenzhe223-tech.github.io/keypocket/
- GitHub Pages：V2 尚未合并/部署
- Supabase 项目：urzgghdwawpwqliafrzv（既有 Dashboard Studio 项目，仅新增 keypocket_ 前缀表）
- Cloudflare Worker：keypocket-vault-api 已部署
- 总体状态：V2_CODE_READY / EXTERNAL_CONFIG_PENDING

## 1. 已核实的 V1 基线
- IndexedDB：keypocket-local-v1，store 为 vault。
- AES-GCM；PBKDF2-HMAC-SHA-256，默认 310,000 次。
- 旧 seal/open 函数与旧数据格式保留。
- 旧 Supabase 整库同步表 keypocket_vault_sync 保留；RLS 原有策略按 auth.uid() 限制。
- 旧版有手动导出/导入、API Key 和项目/Skill 收录能力。

## 2. V2 实施结果
- 客户端：新增 app-v2.js；本地自动检查点/历史快照、30 天回收站、版本化逐记录同步、设备面板、四类 Skill Radar、GitHub App UI。
- Supabase：新增个人同步元数据、逐记录密文、备份快照、设备注册表；新增 Skill 元数据和每日快照；版本比较 RPC 使用 SECURITY INVOKER。
- Cloudflare：部署 keypocket-vault-api Worker，实际部署 ID 为 229ccd2b797f405a97934b7f5f3fb5ff。
- GitHub Actions：新增 V2 静态契约 CI 和每日 Skill Radar 采集 workflow。
- 技术文档：备份恢复、加密同步、数据模型、Skill Radar、GitHub App Vault。

## 3. 已通过检查
- CI run 41379299165：success，commit 1e8086f6686c6647678a60aec0f8bf2d3c2f101e。
- Node 语法检查：app.js、app-v2.js、Skill Radar collector、GitHub App Worker 均通过。
- 六项静态契约测试通过：V1 加密兼容、自动快照与回收站、逐记录同步/RPC、Skill 历史采集、Worker 固定仓库/加密封包、HTML 脚本顺序/CSP。
- Supabase V2 表存在；个人同步/备份/设备表 RLS 策略按当前 auth.uid() 限制；Skill Radar 浏览器角色只读。
- service_role 的 Skill snapshot identity sequence USAGE 权限已核验。

## 4. 未完成与风险
- GitHub App 尚未创建/安装；Worker Secrets/Slug 未配置。
- GitHub 私有仓库 keypocket-cloud-vault 尚未创建/安装授权。
- GitHub Actions Secrets 未配置，Skill Radar 无首次采集结果。
- Worker 公网 /health 探测因当前执行容器 DNS 临时解析失败未验证。
- 真实双设备、断网重试、并发冲突、删除/恢复传播、密文抓包未测。
- iPhone Safari/微信浏览器未实机验收。
- V2 分支未合并 main，生产页面未更新。

## 5. 当前已知问题
- 同步采用确定性 LWW，不是逐字段 CRDT；同时修改同一记录会有一方覆盖另一方，依赖版本比较与快照恢复。
- 多设备必须使用相同 KeyPocket 本地解锁密码派生共享云端密钥。
- 本地快照不能抵御浏览器清除站点数据；需要验证 Supabase 云快照/GitHub 备份成功。
- 页面关闭期间不会运行客户端自动快照；每日检查点在应用解锁/运行时创建。
- GitHub App 解除绑定入口当前清除本设备会话；彻底撤销需从 GitHub Installed GitHub Apps 卸载 App。

## 6. 下一步
1. 创建 PR 并检查最新 PR CI。
2. 完成 GitHub App 与 Worker Secrets 配置。
3. 配置 GitHub Actions 两个 Supabase Secrets，运行首次 Skill Radar 采集。
4. 用虚构测试账户跑双设备 E2E。
5. 完成移动端、线上部署与生产冒烟验证；逐项更新五级状态。
