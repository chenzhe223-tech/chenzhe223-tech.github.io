# DAVYLAB 公众号内容生产流水线（主运行规范）

目标：ChatGPT 负责选题分析、来源核验、原创内容及素材 QA；用户批准后产出内容包并同步 GitHub；WorkBuddy 下载、校验，保存微信公众号草稿；只有针对具体内容包的单次明确发布命令，才允许正式发表。

## 系统边界

- 选题工作台：https://chenzhe223-tech.github.io/topic-studio/
- 公开代码仓库：chenzhe223-tech/chenzhe223-tech.github.io（main）。此仓库公开可见，只存平台代码、公开来源及已核验的已发表档案，不存未发表全文、内部审稿意见、图片包或凭证。
- 实际内容包存储：私有仓库 chenzhe223-tech/workbuddy-workspace（private），目录 davylab-content-pipeline/。
- 私有仓库文件：
  - [README 与存储规范](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/README.md)
  - [WorkBuddy 执行指令](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/WORKBUDDY_COMMAND.md)
  - [内容包模板](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/templates/manifest.template.json)
  - [ChatGPT 复用执行指令](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/CHATGPT_WORKFLOW_PROMPT.md)
  - [内容包校验器](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/scripts/validate-package.mjs)
  - [队列校验器](https://github.com/chenzhe223-tech/workbuddy-workspace/blob/main/davylab-content-pipeline/scripts/validate-queue.mjs)
- 已发表内容共享列表：公开仓库的 topic-studio/data/published-articles.json。只有公众号后台真实发表状态与永久链接已核验后才更新。
- 贴图标准通常为 8 页、每页 1080×1440 px、每页一个核心结论并带有主体插画；标题不超过 20 个 Unicode 字符，正文与标签须通过长度检查。贴图与普通图文文章不可混用。封面即使复用同一图像文件，也必须按微信要求单独上传。

## 增长实验室
- 工作台包含 Growth Lab，用于手动记录订阅目标、爆款实验、每日新闻贴图任务和真实数据指标。
- Growth Lab 的记录独立保存在浏览器 localStorage，可导出 JSON；不能跨设备自动同步，也不会自动读取公众号后台数据。
- 「达到内部爆款候选线」使用最近 10 篇文章阅读量中位数 × 3 的内部参考规则，需根据真实数据复盘；不是平台官方标准或爆款保证。
- 贴图任务状态为运营跟踪字段。仅在真实回执核验后，才可把任务标记为 draft_saved 或 published。

## Topic Studio 的已知局限

Topic Studio 是静态 GitHub Pages 应用。部分选题池记录保存在浏览器 localStorage，不会自动跨设备同步；ChatGPT 无法仅凭打开公开网址读取另一台设备的本地记录。若要分析这些选题，请从平台导出 JSON 并上传，或直接提供标题与原始链接。Davy Radar 的公开 JSON 和已发表档案可以作为公开研究来源。

尚未核实微信公众号官方 API 权限。WorkBuddy 使用用户授权的登录浏览器；登录过期、扫码/验证码、账号不匹配或权限异常时，必须停下并交由账号所有者处理，不得绕过安全验证。

## 标准流程

1. **研究与去重：** 查看 Topic Studio、Davy Radar、已发内容档案和原始来源。优先阅读原文，不以搜索摘要代替；打不开原文时请用户粘贴正文或上传截图。
2. **提案：** 输出一个首选方向和最多两个备选，说明目标读者、读者收获、原创角度、标题候选、结构、建议形式、来源依据和事实风险。此时只提案，不生成最终素材、不进入公众号后台。
3. **用户批准制作：** 用户针对明确 package ID 回复“批准方案 <package_id>，开始制作”。这只授权制作，不授权正式发表。
4. **制作与 QA：** 生成原创正文/配文、分页文案、真实图片文件、来源说明、审稿记录、素材清单和 QA 报告。逐张检查尺寸、文字、错字、裁切、手机可读性、来源/授权。存在阻断项时不得交给 WorkBuddy。
5. **私有 GitHub 归档：** 内容放在私有仓库 davylab-content-pipeline/packages/<package_id>/，至少包含 manifest.json、proposal.md、正文/配文、source-notes.md、qa-report.json、ASSET_MANIFEST.md 和实际素材。每次修订采用新版本/commit；已批准版本不原地覆盖。
6. **WorkBuddy 保存草稿：** 拉取私有仓库最新版本，验证 package ID、版本、审批、文件与 SHA-256、素材数量/尺寸及来源；确认公众号账号为 DAVYLAB，选择正确内容类型并实际上传媒体。保存草稿后重新打开检查，再完成手机预览。
7. **单次正式发表授权：** 手机预览通过后，用户在 WorkBuddy 当前会话中对具体 package ID 发出单独的明确发布命令。命令必须绑定当前内容包与版本；任何实质改动都需重新审核。不得无人值守、定时或批量发布。
8. **回流已发档案：** 只有正式发表状态和永久 URL 经核验后，才把最少必要的标题、链接、日期与形式写入公开的 topic-studio/data/published-articles.json，并按 URL 去重。

## WorkBuddy 操作方式

- **默认只保存草稿：** 打开私有仓库 davylab-content-pipeline/WORKBUDDY_COMMAND.md，复制“命令 A”，替换成目标 package ID。命令明确要求只保存草稿，不发表。
- **正式发表：** 从同一文件复制“命令 B”，将 <package_id> 替换为具体包 ID。该命令本身是对当前版本的单次明确发表授权；WorkBuddy 将先完成下载、校验、保存草稿与手机预览，只有所有检查通过时才发表。校验失败或状态无法确认时，必须停止且不发表。

## 状态分别汇报

- awaiting_approval：提案待批准。
- ready_for_workbuddy：内容与素材 QA 通过，可以交给执行端。
- draft_saved：微信公众号草稿已保存并回查。
- preview_passed：实际手机预览通过。
- published：正式发表状态与永久链接已核验。
- blocked / failed / needs_revision：明确原因并停止继续操作。

## 真实性和安全

- 不伪造数据、引语、作者经历、截图、产品效果、二维码或媒体授权。
- 公开仓库存储均视为公众可见；未发表稿件、图片包与审稿信息必须在私有仓库。
- AppSecret、access_token、Cookie、密码、验证码和临时认证链接不得存入 GitHub、前端、manifest 或日志。
- 公开仓库内现有 topic-studio/content-pipeline/ 队列/模板/校验脚本仅作为公开工程脚手架；不得将它当作未发表内容的私有存储区。
- 文档、模板和校验器已建立，但 WorkBuddy 的真实登录浏览器、微信公众号草稿、手机预览与发表尚未在本次修改中完成端到端实测。只有获取真实运行回执后才能报告成功。