# DAVYLAB 公众号选题工作台｜精简运营上下文

> 新对话和 WorkBuddy 的优先恢复文件。请先读取本文件，再读取应用规则及最新对话日志。此文件是精简交接摘要，不是原始聊天记录。

## 项目定位
- 品牌：DAVYLAB；主张：把想法，做成能用的工具。
- 工作台：https://chenzhe223-tech.github.io/topic-studio/
- 主仓库：`chenzhe223-tech/chenzhe223-tech.github.io`，分支 `main`，项目目录 `topic-studio/`。
- 当前主要任务：让选题发现、选题池、内容排期、AI 方向生成、念头盒导入、已发公众号内容和 WorkBuddy 流程协同工作。

## 必读文件
- 应用规则：`topic-studio/docs/PRODUCT_RULES.md`
- 对话决策日志：`topic-studio/docs/CONVERSATION_LOG_2026-10-23.md`
- 公众号同步说明：`topic-studio/WECHAT_CONTENT_SYNC.md`
- 已发文章共享数据：`topic-studio/data/published-articles.json`
- 主要代码：`topic-studio/index.html`
- QA：`topic-studio/qa-smoke.cjs`
- 项目说明：`topic-studio/README.md`

## 已确认实现
- Davy Radar 数据：每日 AI 新闻、中国 AI 动态及 GitHub Skill 素材。
- 自然语言选题入口，以及经 NianBox Cloud Worker 鉴权的 AI 选题方向；需要连接念头盒账号，密钥在 Worker Secret，不写入前端。
- 念头盒灵感导入导出；选题池、评分、状态、排期与创作指令。
- 新闻卡片配图：优先原始 `image_url`，无原图时采用主题 fallback；图片失败有降级处理；真实来源图与主题辅助图必须区分标注。
- 「已发内容」模块：读取 GitHub 共享 JSON，支持搜索、筛选、本地添加/编辑、JSON 导入/导出及关联选题。
- GitHub Pages 部署和 DAVYLAB Browser QA 最新记录通过。最近已验证的 Actions：
  - 部署：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/39924260078
  - QA：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/39924260664

## 已发公众号文章档案状态
- 最近同步：2026-10-23 12:20 +08:00。
- 目前已核验 3 篇记录，具体链接以 `data/published-articles.json` 为准。
- 可选字段栏目、摘要、封面链接目前为空，不能自行猜测。
- 工作台当前读取 GitHub JSON；本地直接新增记录不会自动写回 GitHub。WorkBuddy 同步需更新 JSON 并提交。
- 官方公众号 API 尚未接入。权限需在公众号后台实际核实；凭证只能存服务端 Secret。
- 公众号发布操作不自动化到最后一击，正式发布前必须由作者本人确认。

## 关键经验
- WorkBuddy 找不到目录时，先核对仓库和工作目录；正确仓库为 `chenzhe223-tech/chenzhe223-tech.github.io`，不要在错误仓库重复创建整套应用。
- 设计需整齐、对齐、对称、清晰和克制；品牌配色使用深海军蓝/蓝灰、浅灰白与少量科技蓝。
- 每条新闻素材应有配图：优先真实源图；否则使用标注清楚的主题配图。不要将主题辅助图冒充原新闻图。
- 仅在真实验证后宣称功能、同步、部署或测试完成。
- “草稿已准备”“公众号草稿已保存”“手机预览通过”“正式发布”是四个独立状态。

## 推荐恢复指令
“请读取 `topic-studio/OPERATIONS_CONTEXT.md`、`topic-studio/docs/PRODUCT_RULES.md` 和最新对话日志；以 GitHub main 分支的当前代码、共享文章 JSON 和最近 Actions 结果为准继续工作。禁止重复建站、虚构文章或凭旧对话宣称未验证功能已完成。”
