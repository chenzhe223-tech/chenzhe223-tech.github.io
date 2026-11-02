# KeyPocket — 当前状态

最后更新：2026-11-02（UTC+8）
版本目标：V2.0
状态：IN_PROGRESS — 本地恢复基础和模块 UI 已提交并部署，未完成全量功能验收。

## 当前线上/仓库基准
- 仓库：chenzhe223-tech/chenzhe223-tech.github.io
- 分支：main
- HEAD：`022232f278763afcac8dbd327a638a9632b9d999`
- 正式入口：https://chenzhe223-tech.github.io/keypocket/
- Pages run：`41385211770`，该 HEAD build/deploy SUCCESS
- KeyPocket static QA：`41385211674`，syntax/source contract SUCCESS
- app.js blob SHA：`2d16fdaa1d2f253721d769df42f0c56317074bb5`
- index.html blob SHA：`d8940124d90e12b27580ea456770d39f0a776c36`
- cache key：`kp-v2-init-debug-20261102-1`

## 已写入代码但仍需验收
- 保留 IndexedDB `keypocket-local-v1` / store `vault` / DB version 1；旧 AES-GCM/PBKDF2 格式保留。
- 七模块 UI：我的密钥、我的 Skills/项目、Skill Radar、回收站、自动备份、同步中心、GitHub 账户。
- 本地加密快照、防抖、首次解锁保护快照、每日打开后检查。
- API Key/项目软删除与 tombstone，回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除及 Skill 收录/更新接入持久化队列。
- Replace 导入前尝试生成保护快照。
- Skill Radar UI有四周期入口；真实采集数据未配置时显示空态。
- 同步/GitHub 页面明确显示 V2 同步未启用/KeyPocket App 未绑定。

## 五级交付状态
| 模块 | Code Completed | Build Passed | Runtime Verified | Functional Tested | Production Deployed |
|---|---|---|---|---|---|
| 本地快照 | 基础代码已写，边界/保留策略未完全实现 | 静态检查通过 | 页面随 HEAD 已部署 | 快照创建/解密/恢复未验收 | HEAD Pages成功 |
| 回收站 | API Key/项目软删除 UI/代码已写 | 静态检查通过 | 页面随 HEAD 已部署 | 单条/批量/过期/tombstone未验收 | HEAD Pages成功 |
| 项目保存/Skill handoff | 保存路径已接入持久化队列 | source contract PASS | HEAD 页面已部署 | 最新线上 Playwright待手动触发 | HEAD Pages成功 |
| V2增量同步 | 未实现 | — | — | — | — |
| 云端加密备份 | 未实现 | — | — | — | — |
| Skill Radar collector | 未实现（只有UI） | — | — | — | — |
| GitHub App/Worker | 未实现/待授权 | — | — | — | — |
| 导航 UI | 已实现 | 静态检查通过 | Pages部署成功 | 全模块 E2E未做 | HEAD Pages成功 |

## 测试证据
- KeyPocket run `41385211674` / HEAD `022232f`：Node syntax PASS、source contract PASS；push运行按新workflow设计跳过Playwright。
- Pages run `41385211770` / HEAD `022232f`：build/deploy SUCCESS。
- 旧 E2E run曾因部署前加载旧缓存脚本失败；已识别为部署/测试时序问题并修改 workflow，但当前没有最新HEAD的E2E success。
- iOS Safari/微信未测试；本地快照/回收站恢复未进行专项E2E。

## 阻塞
Supabase event schema/RLS/双设备同步；Skill Radar GitHub历史采集；KeyPocket GitHub App/Worker OAuth及 secrets；本地恢复完整测试；移动端验收。
