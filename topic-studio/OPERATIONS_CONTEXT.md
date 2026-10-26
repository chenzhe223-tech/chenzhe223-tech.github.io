# DAVYLAB 公众号选题工作台｜精简运营上下文

> 新对话和 WorkBuddy 的优先恢复文件。请先读取本文件，再读取应用规则及最新对话日志。此文件是精简交接摘要，不是原始聊天记录。

## 项目定位
- 品牌：DAVYLAB；主张：把想法，做成能用的工具。
- 工作台：https://chenzhe223-tech.github.io/topic-studio/
- 主仓库：`chenzhe223-tech/chenzhe223-tech.github.io`，分支 `main`，项目目录 `topic-studio/`。
- 当前主要任务：让选题发现、选题池、内容排期、AI 方向生成、念头盒导入、已发公众号内容与 WorkBuddy 内容生产流水线协同工作。

## 必读文件
- 本次新增内容生产流程：`topic-studio/CONTENT_PIPELINE.md`
- 内容包队列和交接约定：`topic-studio/content-pipeline/README.md`
- 队列：`topic-studio/content-pipeline/queue.json`
- 内容包模板：`topic-studio/content-pipeline/templates/manifest.template.json`
- 包校验脚本：`topic-studio/scripts/validate-content-package.mjs`
- 应用规则：`topic-studio/docs/PRODUCT_RULES.md`
- 最新对话决策日志：`topic-studio/docs/CONVERSATION_LOG_2026-10-26.md`
- 公众号已发内容同步说明：`topic-studio/WECHAT_CONTENT_SYNC.md`
- 已发文章共享数据：`topic-studio/data/published-articles.json`

## 已确认实现
- Davy Radar 数据：每日 AI 新闻、中国 AI 动态及 GitHub Skill 素材。
- 自然语言选题入口，以及经 NianBox Cloud Worker 鉴权的 AI 选题方向；需要连接念头盒账号，密钥在 Worker Secret，不写入前端。
- 念头盒灵感导入导出；选题池、评分、状态、排期与创作指令。
- 新闻卡片配图：优先原始 `image_url`，无原图时采用主题 fallback；图片失败有降级处理；真实来源图与主题辅助图必须区分标注。
- 「已发内容」模块：读取 GitHub 共享 JSON，支持搜索、筛选、本地添加/编辑、JSON 导入/导出及关联选题。
- 内容生产规范和私有 WorkBuddy 交接协议已建立；新内容包实际保存于 private 仓库 workbuddy-workspace/davylab-content-pipeline/。首次真实 WorkBuddy 操作仍需实测，不能仅凭文档声称端到端通过。
- 私有仓库的内容队列刚初始化为空；在聊天里生成但没有提交到私有仓库的素材不算已入队。
- 公开仓库的 QA Action 仅验证公开工程脚手架，不代表已验证微信后台下载、草稿、手机预览或发表。
- 公众号官方 API 尚未接入。权限需在公众号后台实际核实；凭证只能存服务端 Secret。
- 贴图与普通文章使用不同内容类型；正式发布必须遵循当前 manifest 的审批范围、内容包绑定、素材 QA、手机预览和回查要求。

## 已发公众号文章档案状态
- 当前共享 JSON 最近同步时间与篇数以 `topic-studio/data/published-articles.json` 为准。最新核验版本记载 4 篇，更新时间为 2026-10-26。
- 共享档案以公众号后台真实发表记录为准；栏目、摘要、封面等可选字段缺失时留空，不推测。
- 工作台本地记录不会自动提交 GitHub；WorkBuddy 同步需更新 JSON 并提交。
  
## 内容流水线状态机与授权
- 状态：`proposed → awaiting_approval → approved → generating → qa_passed → ready_for_workbuddy → downloaded → draft_saved → preview_passed → published`；异常状态包括 needs_revision、blocked、failed。
- 用户必须针对明确的 package ID 和提案作审批。没有审批时不生成最终发布包，也不能进入公众号后台。
- `generate_only` 只生成并同步；`draft_only` 允许保存草稿但不得发布；`publish_after_approval` 仅在当前包有可核验的明确授权且 QA/手机预览通过时允许发布。
- 用户只说“批准”默认为 `draft_only`；只有明确表示“批准生成并发布”才可能进入 `publish_after_approval`。
- WorkBuddy 执行指令与失败停机条件详见公开的 CONTENT_PIPELINE.md 及私有仓库 davylab-content-pipeline/WORKBUDDY_COMMAND.md。
- 用户批准选题只授权开始制作，不是发表许可；只有 WorkBuddy 针对指定 package ID 的单次明确发布命令，才可触发该包发表。
- 公共 GitHub 只能存打算公开的内容素材，严禁任何账号凭证、Cookie、token 或隐私信息。

## 关键经验
- WorkBuddy 找不到目录时，先核对仓库和工作目录；正确仓库为 `chenzhe223-tech/chenzhe223-tech.github.io`，不要在错误仓库重复创建整套应用。
- 设计需整齐、对齐、对称、清晰和克制；品牌配色使用深海军蓝/蓝灰、浅灰白与少量科技蓝。
- 每条新闻素材应有配图：优先真实源图；否则使用标注清楚的主题配图。不要将主题辅助图冒充原新闻图。
- 仅在真实验证后宣称功能、同步、部署或测试完成。
- “稿件已准备”“GitHub 已同步”“公众号草稿已保存”“手机预览通过”“正式发表”是不同状态。
- Topic Studio 使用 GitHub Pages 和浏览器 localStorage。浏览器本地选题在没有主动导出/上传或实现后端同步前，ChatGPT/其他设备无法自动读取。

## 恢复指令
“先读取 `topic-studio/OPERATIONS_CONTEXT.md`、`topic-studio/docs/PRODUCT_RULES.md`、`topic-studio/CONTENT_PIPELINE.md` 和最新对话日志；以 GitHub main 分支的当前代码、内容包队列和最近 Actions 结果为准继续工作。禁止重复建站、虚构文章或凭旧对话宣称未验证功能已完成。”
