# DAVYLAB × 麦田：P0–P3 增量融合执行状态（2026-11-18）

> 本文为当前 Chat 会话代码交付记录。新分支预览不等于正式上线。禁止静默修改原内容稿件和发布状态。

## 来源
- 麦田：https://github.com/CzzzzzzJ/mdldm-maitian （MIT；参考架构及思想）
- 发布助手：https://github.com/CzzzzzzJ/mdldm-maitian-publisher （Apache-2.0）
- 本次代码为独立实现，未直接拷贝麦田适配器或受限采集逻辑。

## P0：数据与权限门禁
- operations/core.js：stableId、草稿资产、显式批准、微信草稿回执、发表的永久 URL/人工授权/预览/后台验证四重门禁；CloudBase 同步继续使用既有代码，不改生产开关。
- 当前运营中控使用独立 localStorage 键 davylab-operations-preview-v1，仅供合成测试和本机试用；尚未与选题池、CloudBase 或 WorkBuddy 的真实内容包自动同步。
- 生产门禁 topic-studio/cloudbase/sync-activation.json 保持 false，待 RLS/CAS/授权/Windows+iPhone 现场实测后才可进入真实 P0 云端验收。

## P1：安全分发任务
- tasks 使用 assetId + platform 幂等去重；已发布任务不可回退；发布状态不允许缺证明。
- operations/index.html 提供本地任务登记及异常/待人工处理显示，不执行上传、不操作 Chrome、不自动发表。
- 微信公众号图文不等同视频号，未复用麦田视频号适配器。

## P2：增长复盘
- core.sameAge 计算第 1、3、7、30 天同龄指标，缺失统计返回 null（不视为零）；独立运营工作台允许手工补录。
- 下一验收：读入真实公众号数据并记录采样来源、采样时间、同日跨平台去重口径；没有微信指标采集权限时保持手工/文件导入。

## P3：归因扩展
- 已实现 UTM 链接参数生成和纯逻辑解析/聚合接口；没有连接站点真实访客、注册或收入数据。
- 下一验收：最小化匿名汇总、用户同意与隐私审查、只读接口、跨产品端到端归因测试。

## 已交付代码
- topic-studio/operations/core.js
- topic-studio/operations/index.html
- topic-studio/operations/ui.js
- topic-studio/operations/tests/core.test.cjs
- .github/workflows/topic-studio-operations.yml
- topic-studio/index.html （仅新增桌面更多工具 / 移动端更多入口）

## 测试与发布门禁
- CI 运行 Node 22 语法检查及权限门禁/任务去重/同龄分析/缺失指标/UTM 回归测试。
- 需确认当前分支最新 GitHub Actions 结果后才能报告 Build Passed。
- 浏览器 UI 跨设备、CloudBase 真实隔离、微信公众号草稿后台及第三方平台适配尚未实测。
- 禁止在公共仓库保存未发表正文、个人指标、账号凭据或 Cookie。
- 不得仅凭这份文档将 P0–P3 标为生产完成。

## 后续实施顺序
1. CloudBase excess-tiglon 在私有控制台完成真实只读安全预检、权限和 RLS/CAS 合成测试。
2. 正式登录后双端无按钮同步，且两个设备同时编辑时不静默覆盖。
3. 将本地中控的数据模型绑定既有选题池和私有内容包，不迁移未获授权数据；新增 WorkBuddy 草稿只读回执导入。
4. 逐步开放真实数据的文章级复盘与合规自有产品匿名归因。
5. 完成 UI 手机/电脑真实验收、CI、回滚清单后才合并部署。

## 2026-11-20 新增：已发内容与增长数据只读桥接
- 新增 `operations/bridge.js`：对 `../data/published-articles.json` 的 DAVYLAB 账号名、`synced_via_browser` 同步状态、来源标记、永久链接与日期进行逐条校验；校验失败的记录不会展示为核验内容。
- 新增独立页面按钮「读取已核验发表档案与复盘」：需要用户主动点击；通过同源静态 JSON 读取历史已发记录，只读读取同浏览器 Growth Lab 的 `davylab-growth-lab-v1` 下 `reviews`。
- 仅将匹配到已核验永久链接的第 7 / 30 日人工 `reads` 记录转为预览数据，保留 `source=growth-lab-manual`；`null`、缺失值和未知 URL 一律跳过；禁止伪造第 1 / 3 日指标。
- 导入采用稳定 URL 资产标识和指标主键，重复执行不会产生重复条目；已手动输入的本机预览指标不被覆盖。
- 只更新隔离的 `davylab-operations-preview-v1`，不修改正式选题池、增长实验室、CloudBase、微信后台与私有仓库。
- 新增 `operations/tests/bridge.test.cjs`，覆盖未核验档案拒绝、重复文章过滤、7/30 日转化、空值拒绝及二次导入幂等；接入隔离 CI。
- 最新 CI 检查 URL：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/44683586130 （success）。
- **生产阻断仍存在**：微信后台实时统计、WorkBuddy 回执接入、CloudBase 真实同步、Windows/iPhone 双端验收均未完成；不得将只读档案镜像视作生产同步已启用。
