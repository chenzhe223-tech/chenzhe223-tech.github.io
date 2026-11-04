# KeyPocket 阶段开发交接｜2026-11-04

> 新对话接手入口。GitHub main 实际代码为唯一事实源。接手时先核对最新代码、状态文件和 Actions；不要要求用户重复项目背景、仓库地址或已确认决策。

## 项目基本信息
- 产品：KeyPocket（By DAVYLAB），轻量级 AI 工具、GitHub Skill 与 API Key 管理应用。
- 仓库：`chenzhe223-tech/chenzhe223-tech.github.io`
- 项目目录：`keypocket/`；分支：`main`
- 正式入口：https://chenzhe223-tech.github.io/keypocket/
- 本次交接基准 SHA：`194a5fd2d571386654a064c42ae5a54299767061`（状态文档提交；后续新提交优先）。
- 当前前端资源版本：`kp-v2-mobile-settings-20261104-02`

## 一、本阶段成果

### 1. API Key 本地管理、安全与恢复
- IndexedDB `keypocket-local-v1`；Key 和项目记录沿用 AES-GCM/PBKDF2 加密 envelope。
- 新增、编辑、删除、复制、多 Key、搜索、收藏已实现。
- 自动本地快照固定槽 `kp.snapshot.latest`，只保留最新一份；新快照成功写入后再替换旧快照，失败保留旧有效快照。
- 回收站/tombstone、误删恢复、加密备份导入/导出已实现。
- 云端备份使用现有表约束下的 `milestone/latest` 单槽，不改 Supabase schema、RLS、grants。
- 边界：真实账号云端快照 upsert/delete 与第二设备恢复仍未真实验收；本地合成数据 E2E 不等于真实云端验收。

### 2. 同步、账号与设备安全
- V2 增量同步、独立同步口令逐条加密、版本比较、设备注册/撤销界面已实现。
- Supabase Auth 401 自动刷新并保存轮换 refresh token；密码找回使用 Supabase Auth recovery link。
- 密码找回仅更新 Supabase 登录账号密码，不改变本地密钥库密码、跨设备加密口令、IndexedDB 或云端密文。
- Token refresh、密码找回、设备撤销接口已有 mock 自动化覆盖。
- 未验收：真实双设备双向同步、错同步口令拒绝、并发冲突、tombstone 传播、真实设备撤销后的写入拒绝、跨设备云端快照恢复。
- 真实邮件投递未验收；需核验 Supabase Auth SMTP 和 Redirect URL。recover mock 通过不代表邮件已送达。

### 3. GitHub Skill 搜索、收录与仓库扫描
- Skill 搜索/收录已实现；完整 GitHub URL 走 `GET /repos/{owner}/{repo}` 精确查询，不以关键词或 Fork 替代目标仓库。
- 移动端导入弹窗支持取消请求、视口内滚动、关闭清理 body scroll lock、保存后自动返回。
- 项目页进入时自动扫描 `chenzhe223-tech` 公开原创仓库，每 24 小时一次；可手动扫描；过滤 fork/archived/disabled 并去重。
- 私有仓库尚未接入。GitHub App/OAuth 后端未配置；ChatGPT GitHub connector 不等于 KeyPocket 授权；禁止前端硬编码 Token。

### 4. Skill Intelligence Library 首期 P1–P3
- 九大领域：AI Agent 与自动化、编程与软件工程、UI/UX 与视觉设计、数据分析与知识管理、内容创作与办公、搜索与深度研究、多媒体与创意、业务与行业应用、安全与系统运维。
- 已实现二级子分类、场景标签、规则摘要、能力标签、置信度/归纳依据、领域浏览、场景筛选与扩展搜索。
- 项目加密记录增加可选 `skillProfile`；旧记录缺字段时自动补齐；不改变 IndexedDB schema/envelope 或 Supabase schema。
- 人工 domain/subcategory/summary 必须优先于自动推断；自动刷新不得覆盖人工字段。
- 边界：当前是基于本地元数据/规则归纳，不是语义 AI；不能宣称完整解析 GitHub README 正文、Topics、目录树或模型理解。人工覆盖持久化、旧记录升级、场景筛选仍需专项回归验证。

### 5. 三盒式 Skill 资源库与 Radar
- 资源盒：我的开发、外部收录、热门 Skill；项目采用紧凑横条展示；其他非 Skill 外部项目保留。
- 热门 Skill 来自每日 GitHub Radar 静态 JSON 中验证过的公开仓库（检查 `SKILL.md`，过滤 fork/archived）；九大领域每类至少 5 条，不足时明确标注「综合热门补充」；支持刷新发布数据与一键加密收录。
- 页面刷新只重新请求已发布 JSON，不触发 GitHub Actions 全量采集；采集由每日 workflow 执行。
- 月/季/年增长榜历史不足，不得伪造增长趋势。

### 6. 视觉与动效
- 主题预设/自定义强调色、背景色、卡片色；字体、内容密度、圆角。
- 多种动效，速度/幅度/方向可调，尊重 `prefers-reduced-motion`。
- 布局预设、宽度、列数、间距、导航位置可调。
- 偏好独立存储于 localStorage `kp.visual.preferences.v1`，不进入密钥库或云同步；支持实时预览、恢复默认、JSON 导出。

### 7. 最新主界面与统一设置中心
- 核心导航精简为「我的密钥 / 我的 Skills 与项目 / Skill Radar」。
- 顶部仅保留「设置」；视觉与动效、导入/导出备份、自动备份、回收站、同步中心、GitHub 账户、锁定统一收入设置中心。
- 设置分组：外观与体验、数据与备份、账户与连接、安全；7 个设置入口。
- 项目页将 GitHub 导入、Skill 名称导入、AI 简报收录、刷新收藏热度、扫描仓库放入默认折叠的「导入与管理工具」，突出「收录项目」主按钮。
- 手机端搜索整行、筛选双列、三项导航等分；设置卡片单列；桌面端保留两列设置卡片与三列工具布局。设置与子页面均有返回路径。

## 二、最新部署与测试证据
最终同 SHA `194a5fd2d571386654a064c42ae5a54299767061`：
- Pages：run `41812576668` SUCCESS。
- DAVYLAB Browser QA：run `41812576957` SUCCESS。
- KeyPocket Skill Handoff QA：run `41812576892` SUCCESS。
- 正式站：https://chenzhe223-tech.github.io/keypocket/

Browser QA 已验证：设置中心 7 项、核心导航 3 项；390px Playwright/Chromium 项目页布局、默认折叠工具、双列筛选、设置中心布局；新增 Key 入口可见；无横向溢出、无 KeyPocket pageerror；视觉偏好实时应用/持久化/恢复默认；Key CRUD、加密备份导入导出、回收站恢复、本地最新快照恢复、Skill 收录、公开仓库扫描去重、Radar 同源 JSON 等合成 E2E 通过。
**验收边界：390px Chromium 不是 iPhone Safari 或微信内置浏览器实机验收。**

## 三、关键提交
- app.js 设置中心/移动布局：`1b1547967fda7cd5d49c4cf807cdda576153af4b`
- index.html：`3424038af3a0e8304bfb7b78053dea08784075b9`
- 测试修正：`da51f222540988f1de37129dadcb3903820dc967`、`0cc119fb252fc77ea421cc3d84e9d6245fe7e447`、`551f4b9511add3e1beb68da7efdf77fbd676decc`
- 本轮交接基准：`194a5fd2d571386654a064c42ae5a54299767061`
- 新对话必须重新查询 main 最新 SHA 与 Actions，不要假设本文件的 SHA 永远最新。

## 四、未完成事项与优先级

### P0：可靠性与真实环境验收
1. 用独立测试账号、两个隔离浏览器/设备验证真实双设备登录、双向新增/编辑/删除、错口令拒绝、并发冲突、tombstone 传播、设备撤销后服务端拒绝写入、云端最新快照跨设备恢复。
2. 核验 Supabase Auth SMTP/Redirect URL，用用户本人邮箱完成真实密码找回邮件与重置闭环。
3. 真实 iPhone Safari、微信内置浏览器验收首页、设置中心、Skill 导入弹窗、搜索、滚动、动态视口/键盘、刘海安全区、重新打开流程。**不得清除网站数据、IndexedDB 或 localStorage。**
4. 如再现白屏，收集 `window.__kpInitDiagnostic`、`window.__kpBuildVersion` 和 Safari Console 首条错误；自动化未复现不等于真机根因已排除。

### P1：Skill 知识库深化
1. 专项测试 `skillProfile` 旧记录自动升级、人工领域/子类/摘要保存、刷新不覆盖、场景筛选与搜索。
2. 保留来源可追溯，增加 GitHub README、Description、Topics、目录树解析；低置信度提示人工复核。
3. 再推进 Skill 关联推荐、能力组合与工作流编排。

### P1：用户已批准的 V2.1 Phase 1（尚未交付）
- 应用与 API Key 正式绑定（同一服务商多个 Key 必须明确绑定具体应用，才可精准归因）。
- DeepSeek 账单导入与解析。
- 按应用/模型/日期统计；未分配账单管理；预算提醒；Excel/CSV 导出。
- 官方服务商账单是财务金额权威来源；KeyPocket 内部请求量/估算费用必须与官方账单金额分开展示。
- 账单明细先走现有 AES-GCM 本地加密和备份；Supabase schema/权限/隐私评估前，不擅自上传账单明文。
- 开发前核实现有稳定项目 ID 与账单数据模型，不照搬旧方案。

### P2：GitHub 私有仓库
- 配置 GitHub App、OAuth callback、Cloudflare Worker 公网入口与所需 Secrets，之后再实现私有仓库读取/收录。
- 真实 OAuth/installation/vault E2E 通过前，保持连接状态如实提示、禁用无效连接按钮。

## 五、不可破坏的约束
- GitHub main 是唯一代码事实源；`PROJECT_CONTEXT.md` 是长期项目状态源。
- 不得清除用户现有 IndexedDB、localStorage、加密快照或密钥库。
- API Key 明文、主密码、同步口令、派生密钥、refresh token、恢复 token 不得提交、日志记录或硬编码。
- 不得随意改变 AES-GCM/PBKDF2 envelope、IndexedDB store/schema、Supabase schema/RLS/grants；必要变更须先有迁移设计和批准。
- 自动扫描/刷新不得覆盖人工分类、摘要、备注、收藏、标签。
- 不伪造 Skill、Stars、趋势、账单、邮件投递结果；分类置信度不是语义正确性证明。
- 每次实质开发更新 PROJECT_CONTEXT、CURRENT_STATUS、HANDOFF、CHANGELOG、TEST_AND_ISSUES，并以同 SHA Actions 验收。区分 Code Completed / Build Passed / Runtime Verified / Functional Tested / Production Deployed。

## 六、新对话接手清单
1. 先读本文件、`PROJECT_CONTEXT.md`、`README.md`、`CURRENT_STATUS.md`、`HANDOFF.md`、`CHANGELOG.md`、`TEST_AND_ISSUES.md`。
2. 查询 main 最新 commit、最近 Actions 和失败日志；核对 HTML/app.js build marker 与线上资源版本。
3. 按用户当前任务选择 P0/P1；若继续 V2.1，先审查当前代码和数据源，再实现已批准范围。
4. 修改前保护数据结构和现有功能，加入对应自动化测试；失败必须读取日志并修复。
5. 同 SHA 完成 Pages、Browser QA、KeyPocket Handoff QA 后，更新所有状态文档并写入 commit/run ID/验收边界。
6. 不要求用户重复项目背景、仓库地址和已确认决策；用户已要求持续推进的开发不得擅自暂停。

## 七、本轮交接记录
- 日期：2026-11-04（UTC+8）。
- 本阶段范围：Skill Intelligence 首期、三盒式 Skill 资源库、视觉与动效、移动端主界面与统一设置中心。
- 最终验收 SHA：`194a5fd2d571386654a064c42ae5a54299767061`。
- Pages `41812576668`、Browser QA `41812576957`、Handoff QA `41812576892` 均 SUCCESS。
