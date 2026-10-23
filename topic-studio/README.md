# DAVYLAB 公众号选题工作台

线上地址：https://chenzhe223-tech.github.io/topic-studio/

## 现有能力
- 读取 Davy Radar 公开 JSON：AI 新闻、中国 AI 新闻、GitHub Skill。
- 选题池、评分、状态管理、排期、搜索和 JSON 导入导出。
- 生成可复制的 ChatGPT 创作指令，并保留原始来源链接。
- V2 工作区提供自然语言入口、选题方向卡片、方向选择/调整、创作指令和保存动作。
- 念头盒灵感支持导入导出的 JSON、TXT、Markdown 文件或粘贴文本；导入时可预览/勾选，记录会保留原始文本和来源 ID，并进行重复检查。
- 选题发现和选题池使用主题化的 CSS 封面模板；它们是本地视觉模板，不冒充真实照片或 AI 生成图片。
- 「已发内容」模块：查看共享文章档案、手动添加/编辑、搜索和筛选、JSON 导入/导出，并可关联现有选题；关联后会把对应选题标记为已发布。
- WorkBuddy 共享档案位置：`topic-studio/data/published-articles.json`；同步流程见 `topic-studio/WECHAT_CONTENT_SYNC.md`。

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
- 不会自动操作或发布微信公众号；正式发布仍由作者本人确认。

## 数据来源
- Davy Radar：https://chenzhe223-tech.github.io/radar/daily/
- 今日 JSON：https://chenzhe223-tech.github.io/radar/data/latest.json
- Dashboard Studio：https://ds.dashboard-studio-1dp.pages.dev/

## 技术
纯 HTML/CSS/JavaScript，无需 npm build；GitHub Pages 通过仓库现有 Actions 工作流部署。
