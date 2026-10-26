# DAVYLAB 公众号选题工作台

线上地址：https://chenzhe223-tech.github.io/topic-studio/

## 现有能力
- 读取 Davy Radar 公开 JSON：AI 新闻、中国 AI 新闻、GitHub Skill。
- 选题池、评分、状态管理、排期、搜索和 JSON 导入导出。
- 生成可复制的 ChatGPT 创作指令，并保留原始来源链接。
- V2 工作区提供自然语言入口、选题方向卡片、方向选择/调整、创作指令和保存动作。
- 念头盒灵感支持导入导出的 JSON、TXT、Markdown 文件或粘贴文本；导入时可预览/勾选，记录会保留原始文本和来源 ID，并进行重复检查。
- 选题发现新闻卡优先使用 Davy Radar 的原始图片字段；无原图或加载失败时使用主题匹配的 fallback，并明确标注为“主题配图”，不冒充新闻原图。GitHub Skill 可使用对应项目预览图。选题池仍可使用主题化 CSS 视觉卡片。
- 「已发内容」模块：查看共享文章档案、手动添加/编辑、搜索和筛选、JSON 导入/导出，并可关联现有选题；关联后会把对应选题标记为已发布。
- WorkBuddy 共享档案位置：`topic-studio/data/published-articles.json`；同步流程见 `topic-studio/WECHAT_CONTENT_SYNC.md`。

## 公众号内容生产流水线（新增）
- 流程规范：[`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md)
- GitHub/WorkBuddy 交接协议与队列：[`content-pipeline/README.md`](./content-pipeline/README.md)、[`content-pipeline/queue.json`](./content-pipeline/queue.json)
- Manifest 模板：[`content-pipeline/templates/manifest.template.json`](./content-pipeline/templates/manifest.template.json)
- 包验证脚本：[`scripts/validate-content-package.mjs`](./scripts/validate-content-package.mjs)
- GitHub Actions 会在内容流水线文件变更时自动检查包结构、审批范围、来源/QA 必填项及贴图尺寸。
- 内容流程：ChatGPT 提案 → 用户明确批准 → 生成原创内容与图片 → QA → GitHub 版本化归档 → WorkBuddy 下载并复核 → 保存草稿/预览 → 按审批范围执行发布。
- “批准”默认只授权保存草稿；只有明确批准当前内容包“生成并发布”，且包 ID 与提案版本匹配、素材 QA 与手机预览均通过，才允许 WorkBuddy 自动发布。
- 当前队列为空；此前只在聊天中制作、尚未提交到该仓库的素材并不算入队。

## 对话记录、产品规则与后续交接

为了避免跨对话重复解释，请在开始新任务前依次查看：
- [精简运营上下文](./OPERATIONS_CONTEXT.md)：当前架构、功能状态、关键路径和待办。
- [产品与工程规则](./docs/PRODUCT_RULES.md)：UI/配图/事实核查/微信同步/数据安全/验收要求。
- [对话与决策日志（2026-10-23）](./docs/CONVERSATION_LOG_2026-10-23.md)：此前关键需求、设计决策、错误经验与验收记录。
- [公众号已发内容同步指南](./WECHAT_CONTENT_SYNC.md)：WorkBuddy 核验和更新共享文章档案的步骤。

## 使用方式
1. 在「选题发现」顶部输入一句话，或从念头盒导出文件/粘贴灵感。
2. 连接念头盒账号后点击「分析并生成方向」；AI 服务不可用时会明确显示错误，不会展示伪造结果。
3. 选择一个方向，可继续补充调整要求。
4. 生成创作指令，复制到 ChatGPT；文章和图片需要在外部工具实际生成后再标记为完成。
5. 保存方向至选题池，并继续使用评分、筛选和排期。

## 当前集成边界（重要）
- 当前公开站点通过 GitHub Pages 静态托管，原有记录存储在当前浏览器的 localStorage，不具备账号隔离或自动跨设备同步。
- AI 选题分析通过已部署的 NianBox Cloud Worker `/ai/topic-directions` 接口进行，要求先连接念头盒账号；请求经过账号鉴权并受每用户每日次数限制。模型密钥只保留在 Worker Secret。
- 不在浏览器中直接调用模型供应商 API，不在前端代码写入 API Key。
- 念头盒支持用户主动登录后读取本人云端念头；同时保留 JSON/TXT/Markdown 文件与粘贴降级。账号令牌只保存在当前标签页 sessionStorage。
- CSS 主题封面不是生成式图片，也不代表有真实图片素材授权。
- 公众号内容库目前读取 GitHub 共享 JSON 与本地浏览器记录；只有经 WorkBuddy 从 DAVYLAB 后台核验并更新共享 JSON 后，文章才会出现在所有设备的共享列表中。当前还没有直接连接公众号官方 API。
- 官方 API 是否能直接拉取已发表内容取决于账号主体、认证情况和接口权限。任何 AppSecret/access_token 只能保存在后端 Secret，不得写入 GitHub 或前端。
- WorkBuddy 内容流水线协议和校验脚本已建立，但 WorkBuddy 本机真实下载、公众号后台录入与发布是否成功，必须基于本次实际执行的日志/回执确认。
- 不会仅因素材生成完成就自动发布；发布取决于当前内容包里可核验的明确授权范围与发布前 QA。
 
## 数据来源
- Davy Radar：https://chenzhe223-tech.github.io/radar/daily/
- 今日 JSON：https://chenzhe223-tech.github.io/radar/data/latest.json
- Dashboard Studio：https://ds.dashboard-studio-1dp.pages.dev/

## 技术
纯 HTML/CSS/JavaScript，无需 npm build；GitHub Pages 通过仓库现有 Actions 工作流部署。
