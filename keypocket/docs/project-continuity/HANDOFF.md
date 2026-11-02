# KeyPocket — 最新交接

更新：2026-11-02（UTC+8）
当前阶段：V2.0 partial implementation / IN_PROGRESS；本次未完成全量验收。

- 仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io
- 项目路径：`keypocket/`
- 正式应用：https://chenzhe223-tech.github.io/keypocket/
- 分支：main
- 当前已核验 HEAD：`022232f278763afcac8dbd327a638a9632b9d999`
- Pages run：`41385211770`，该 HEAD build / deploy SUCCESS
- KeyPocket static QA：`41385211674`，该 HEAD syntax + source contract SUCCESS
- 当前 app.js blob SHA：`2d16fdaa1d2f253721d769df42f0c56317074bb5`
- 当前 index.html blob SHA：`d8940124d90e12b27580ea456770d39f0a776c36`
- E2E harness blob SHA：`4c8663c2f400d5616df2aeca3fb85295bea65d0b`
- QA workflow blob SHA：`14293166233b9cbae08e8a115070b4fef50ae2e0`
- 当前缓存键：`kp-v2-init-debug-20261102-1`

## 已写代码
- 保留 IndexedDB v1、旧 AES-GCM envelope 与 PBKDF2 派生格式。
- 新增七个导航/视图入口。
- 本地加密快照、防抖、首次解锁保护快照、每日打开后检查。
- API Key/项目软删除、加密 tombstone、回收站恢复/永久删除入口。
- 项目新增/编辑/收藏/删除、Skill 收录/导入/热度更新已接入加密持久化队列。
- Replace 导入前尝试创建保护快照。
- Skill Radar UI读取 `./api/skill-radar.json`；无数据时显示空态。
- 同步中心明确提示 V2 增量同步未启用；GitHub 账户页明确提示 KeyPocket App 未绑定。
- 新增 backup-recovery / sync-architecture / skill-radar / github-app 技术说明。

## 真实限制
- 本地快照与密钥库同处 IndexedDB，浏览器清理/设备丢失可能一起丢失，不是云备份。
- 每日快照要求当天打开并解锁页面；没有浏览器关闭后的后台执行能力。
- 尚未实现 12 个月归档。
- 快照/回收站恢复尚无通过的 E2E。
- V2 增量同步、Supabase RLS、两设备冲突处理未完成；旧 Supabase 单行全量快照流程仍在。
- Skill Radar collector/API/每日历史快照未完成。
- KeyPocket GitHub App/Cloudflare Worker/OAuth/Secrets 未配置。
- iOS Safari/微信浏览器未测。

## CI / 部署证据
- Pages run `41385211770` / HEAD `022232f`：build SUCCESS、deploy SUCCESS。
- KeyPocket QA run `41385211674` / HEAD `022232f`：Node syntax PASS、Radar-to-KeyPocket source contract PASS。该 push 运行按新配置跳过线上 Playwright。
- 旧 run `41384700603` 在旧 bundle 下 Playwright FAIL；诊断证明测试运行于 Pages 部署前的旧 app.js 缓存版本（而非 V2 当前 bundle）。
- QA workflow 已改为：push 只做静态检查；Playwright 仅在 workflow_dispatch 或成功的 Pages workflow_run 后运行。但 Pages 成功后没有看到 KeyPocket 自身 workflow_run 记录；需要手动触发下方工作流来确认线上 E2E。
- 不能把静态检查和部署成功替代回收站/快照/云同步功能验收。

## 下一步
1. GitHub Actions 页面手动运行 `KeyPocket Skill Handoff QA` 的 workflow_dispatch，核验当前生产 V2 bundle 的简报→KeyPocket 收录链路。
2. 为自动快照创建/恢复、API Key/项目软删除/恢复/批量操作建立独立 E2E。
3. 建立 Skill Radar collector + daily snapshot workflow。
4. 连接 Supabase 项目检查 live schema/RLS，创建 event-based sync API 并先 dry-run。
5. 创建 KeyPocket GitHub App + Worker OAuth callback，最后集中配置 secrets。
6. 做 iOS Safari / 微信浏览器 / 双设备验收。
7. 每项按五级交付证据逐一更新。

## 安全红线
不要清理或覆盖用户真实 IndexedDB；不要将 API Key、解锁密码、派生密钥、Supabase service role 或 GitHub App 私钥提交到仓库。没有 RLS/两设备测试证据不得宣称同步完成。
