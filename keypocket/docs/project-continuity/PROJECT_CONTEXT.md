# KeyPocket — 项目长期基准

- 文档版本：DPCS 1.0 / KeyPocket 初始化
- 最后核实：2026-10-25（UTC+8）
- 产品目录：`keypocket/`
- 仓库：`https://github.com/chenzhe223-tech/chenzhe223-tech.github.io`
- 默认分支：`main`
- 线上地址：`https://chenzhe223-tech.github.io/keypocket/`
- 部署方式：GitHub Pages；仓库根目录还包含 DAVYLAB 官网和其他应用
- 产品类型：本地优先的 API Key 管理网页应用，并包含“我的应用与仓库”、Skill 收录和页面中可见的加密同步入口

## 1. 产品目标
为用户提供轻量的 API Key 本地加密管理、加密备份/恢复、应用与 GitHub 仓库资料管理，以及从 DAVYLAB AI 前沿简报收录公开 Skill 元数据的工作流。

## 2. 已核实的关键文件
- `keypocket/index.html`：页面结构、样式、CSP、同步 UI、模块入口和脚本引用。
- `keypocket/app.js`：客户端加密、IndexedDB、密钥/项目记录、备份及相关交互逻辑。
- `keypocket/README.md`：产品说明、运行方式、数据边界和简报收录说明。
- `keypocket/SECURITY-ACCEPTANCE.md`：安全控制和验收记录（需要与现有实现复核）。
- `keypocket/DELIVERY-REPORT.md`：交付及 QA 记录（部分内容与当前页面存在潜在冲突，见 CURRENT_STATUS 和 TEST_AND_ISSUES）。

## 3. 已知技术事实
- 页面通过 `./app.js?v=kp-sync-20261025-3` 引入应用脚本。
- JS 使用 Web Crypto：AES-GCM 加密 JSON；PBKDF2-HMAC-SHA-256 派生密钥，代码默认迭代次数 310,000。
- IndexedDB 数据库常量为 `keypocket-local-v1`，对象仓库为 `vault`。
- 项目记录通过 `sealProject` 加密后写入 IndexedDB。
- 备份、导入与恢复属于产品关键数据路径。
- 简报到 KeyPocket 的待收录队列键为 `kp.radar.pending-skills.v1`，队列设计为公开 Skill 元数据，不应包含 API Key、Token 或保险库秘密。
- `index.html` 当前 CSP 的 `connect-src` 包含 GitHub API 和 Supabase URL；因此不能直接沿用旧安全文档中“connect-src 'none' / 应用完全不发起网络请求”的陈述。
- 页面当前展示“跨设备同步（加密）”和账号注册/登录/同步按钮；必须进一步核实 `app.js` 中实际实现、Supabase RLS/策略、加密边界及交付文档后，才能准确描述同步安全模型。

## 4. 产品安全与数据边界
- 不把 API Key、密码、访问令牌、Cookie、加密备份内容或用户生产数据写入本项目档案、日志、Issue 或交接单。
- 不要把公开 Skill 元数据队列误当作云同步；本地队列与账户同步是不同机制。
- 不要宣称已完成独立安全审计，除非存在可核查的独立审计报告。
- 不要将代码已修改、CI 通过、Pages 部署和真实设备验收混为一谈。
- 涉及删除本地库、备份恢复、账号数据合并、生产数据迁移等操作时，先核实备份和授权边界。

## 5. 当前必须澄清的冲突
1. README 的安全说明称“不会提供云同步”，但 index 页面已显示 Supabase 加密同步 UI。
2. README 对 CSP 的描述与 index 当前 CSP 不完全一致。
3. SECURITY-ACCEPTANCE.md 记载 `connect-src 'none'`，与 index 当前内容冲突。
4. DELIVERY-REPORT.md 的状态/测试时间及“无云同步”描述可能未随当前同步 UI 更新。
在核实实际 `app.js`、部署版本和 Supabase 配置前，不要自行断定哪份旧文档代表当前真实状态。

## 6. 验收原则
以当前代码、实际 GitHub Actions 运行记录、线上资源和明确测试证据为依据。每个结论标记为已核实、未核实或存在冲突。
