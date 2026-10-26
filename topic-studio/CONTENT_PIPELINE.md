# DAVYLAB 公众号内容生产自动化流程

> 目标：以现有选题工作台和 GitHub 仓库作为内容源与交付中枢，由 ChatGPT 研究、判断和制作；用户批准后生成素材并归档；WorkBuddy 下载、验收并操作已登录的 DAVYLAB 公众号后台。

## 现状和边界

- 选题工作台：https://chenzhe223-tech.github.io/topic-studio/
- 仓库：`chenzhe223-tech/chenzhe223-tech.github.io`，分支 `main`，项目目录 `topic-studio/`
- Davy Radar 原始素材：https://chenzhe223-tech.github.io/radar/daily/
- 已发内容共享档案：`topic-studio/data/published-articles.json`
- 贴图格式参考：`wechat-newspic` Skill，默认 8 页、1080×1440、每页有叙事性插画；标题不超过 20 个 Unicode 字符，正文与标签按平台规范验收。
- 当前 Topic Studio 是 GitHub Pages 静态站点。部分选题池数据保存在浏览器 `localStorage`，不会自动跨设备同步。因此 ChatGPT 可直接读取 GitHub 中的公开素材和已发档案，但不能凭空读取另一个浏览器里的私有本地记录；如需用某条本地选题，应从平台导出后上传，或把内容链接/选题文字发送给 ChatGPT。
- 当前并未证明已接入微信公众号官方 API。WorkBuddy 应使用用户授权的登录浏览器/后台；遇到扫码、验证码或登录过期，由用户本人完成验证。不得绕过安全验证。
- GitHub Pages 仓库为公开仓库，内容包只能保存计划公开的文章、公开来源、图片、文案和非敏感 QA 信息。严禁保存 AppSecret、access_token、Cookie、密码、用户隐私或未脱敏商业资料。

## 状态机

`proposed → awaiting_approval → approved → generating → qa_passed → ready_for_workbuddy → downloaded → draft_saved → preview_passed → published`

异常状态为 `needs_revision`、`blocked`、`failed`。每次转态都要更新 `manifest.json`、`updated_at`，并记录可核验原因。不得跳过审批、素材 QA 或后台回执。

### 审批范围

审批需要针对一个明确的 package ID、标题、核心观点与内容形式。默认仅在聊天中收到明确“批准”后才开始生产，不把沉默或模糊的赞同当授权。

- `generate_only`：允许生成并同步素材到 GitHub；WorkBuddy 不操作公众号。
- `draft_only`：允许生成、同步并由 WorkBuddy 保存为公众号草稿；不正式发布。
- `publish_after_approval`：用户明确回复“批准生成并发布”，且审批绑定当前 package ID、提案摘要和哈希时，WorkBuddy 可在完成素材 QA、草稿回查与手机预览后发布该包；任何改题、改标题、改核心结论、改素材都必须重新审批。遇到平台安全验证、内容与审批不一致或 QA 失败，立即停止并回报。
- 单独的“批准”默认解释为 `draft_only`，不能解释为允许群发。

发布授权应记录在内容包的 `approval` 对象里，并注明用户原话/确认时间；不要让一个旧的批准自动授权未来内容。正式发布后必须记录公众号真实永久链接和发布时间。

## 每次运行流程

### A. 分析与提案（ChatGPT）

1. 读取本文件、`docs/PRODUCT_RULES.md`、`OPERATIONS_CONTEXT.md`、`WECHAT_CONTENT_SYNC.md`、最新对话日志、`data/published-articles.json` 和相关雷达原始 JSON。
2. 核对原文链接和文章实际内容；把来源支持的事实、作者观点、模型推论分开记录。链接不可读取时应请求用户提供正文，不得以标题/搜索摘要代替原文。
3. 对候选选题按读者价值、时效性、实操性、差异化、品牌契合度分析。评分只辅助决策，不预测阅读量。检查近期开过的主题，避免重复。
4. 产出一份短提案：为什么值得写、目标读者、读者收获、一句话观点、内容结构、事实风险、建议形式（贴图/文章），并附提案摘要 hash 或稳定版本号。
5. 在当前对话中展示提案，明确 package ID、提案版本/hash、建议形式和默认审批范围；此阶段不把未批准提案或草稿放入公开 GitHub。用户批准后才创建正式内容包并提交。若用户明确要求把提案归档，才将其作为非发布状态单独提交。

### B. 获批后生产（ChatGPT）

1. 用户针对确切 package ID 明确批准，并选择审批范围。若用户没明确选择，按 `draft_only` 处理。
2. 生成原创稿件、贴图页文案、配图、配文、来源核验说明、素材清单和 QA 报告。允许创造性重构，不照抄来源；引用需有出处。
3. 用稳定的 package ID 版本化保存至 `topic-studio/content-pipeline/packages/<package-id>/`。
4. 每页独立插画；文字由排版层渲染，不让生图模型直接绘制中文正文。不得伪造二维码、数据、截图、用户评价或引用。
5. 运行包校验脚本并逐张肉眼查看渲染图片。若失败，先修复；QA 不通过不得将状态写为 `ready_for_workbuddy`。
6. 通过授权的 Git 写入通道提交 manifest、正文、图片和 QA 文件，并保存 commit 链接。二进制图片必须在仓库里真实存在且能通过尺寸/文件校验；仅有本地 ZIP 下载链接不算 GitHub 同步成功。若当前执行环境不能把 PNG 二进制写入 GitHub，状态必须保持 `qa_passed`/ `blocked`，清楚报告图片同步阻塞，不可伪报 `ready_for_workbuddy`。

### C. 下载与公众号后台处理（WorkBuddy）

1. 执行下方标准指令；从 GitHub 拉取最新 `main`，只选择状态为 `ready_for_workbuddy` 且审批有效的内容包。
2. 下载后校验包 ID、文件 hash、图片数量/尺寸、标题、正文、来源及 `qa-report.json`；不通过即停止。
3. 进入已授权的 DAVYLAB 微信公众平台后台。确认账号名称；不接受其他公众号混淆。不得复用旧文章正文，不得把预览链接当永久链接。
4. 根据 `content_type` 选择正确发布类型：`newspic` 贴图与普通图文文章不可互换。标题、封面、正文分别填入对应位置。正文图片实际上传到微信编辑器，不能使用本地文件 URL。
5. 按审批范围执行：
   - `generate_only`：不进入后台。
   - `draft_only`：保存草稿，回查标题/类型/图片数量/草稿 ID；重新生成手机预览并检查。
   - `publish_after_approval`：只有审批绑定的包与当前包完全一致，且素材/草稿回查及手机预览都通过时，才发布。发布后回查真实永久链接。
6. 用新 commit 回写 manifest 状态、草稿 ID、手机预览结果、真实永久链接、时间和 QA 回执。不可写入 Cookie/token/密码。

## WorkBuddy 标准指令

复制以下指令发送给 WorkBuddy（项目仓库路径可按其本地环境配置）：

```text
执行 DAVYLAB 公众号内容流水线。先读取
topic-studio/CONTENT_PIPELINE.md、
topic-studio/OPERATIONS_CONTEXT.md、
topic-studio/docs/PRODUCT_RULES.md 和
topic-studio/content-pipeline/README.md。

目标仓库必须是 chenzhe223-tech/chenzhe223-tech.github.io，分支 main。
拉取最新提交，只处理 topic-studio/content-pipeline/queue.json 中指向、
且 manifest.state=ready_for_workbuddy 的包。严格按 manifest.approval.scope 执行；
缺少对本包的明确审批、提案 hash 不匹配、内容包校验失败、账号不匹配、
二维码/图片/来源验证失败、需要重新登录/扫码/验证码时，立即停止并报告，
不要猜测、不要绕过安全机制、不要发布别的包。

运行 node topic-studio/scripts/validate-content-package.mjs。
下载并校验所有素材，依照内容类型将内容录入 DAVYLAB 公众号后台；
保存草稿并检查手机预览。仅当 approval.scope=publish_after_approval、
审批记录绑定此包且全部 QA 通过时才正式发布；否则停在草稿。
完成后回写 manifest 与队列相关记录、提交 GitHub，报告 package_id、
commit、素材数、草稿 ID、手机预览状态、发布链接（如有）和所有阻塞项。
绝不把凭证、Cookie、access_token 或 AppSecret 写进仓库和日志。
```

## 运行命令

在仓库根目录执行：

```bash
node topic-studio/scripts/validate-content-package.mjs
```

或传入内容流水线目录：

```bash
node topic-studio/scripts/validate-content-package.mjs topic-studio/content-pipeline
```

## 已知未自动化项

- ChatGPT 在当前会话中执行分析和内容制作，不代表一个持续运行的后台 Agent；用户提出任务或批准后，才继续相应阶段。
- Topic Studio 的 localStorage 选题不会自动进入 GitHub。本地选题必须导出/分享，后续可以升级为有身份验证的服务端同步。
- GitHub 存储与包验证协议已定义，空队列的校验 Action 已跑通；尚未用一套带真实 PNG 的内容包验证二进制图片提交及 WorkBuddy 端到端流程。公众号后台能否完全无人值守，取决于 WorkBuddy 本地浏览器权限、当前登录状态和微信后台实际支持的操作。不能在未运行的环境里宣称已完成端到端实测。
- 如果后续确认公众号官方接口权限，可另行设计服务端集成；凭证只能放在 Cloudflare Worker Secret 或其他服务端密钥存储，不能放在静态站点或公开 GitHub 文件中。
