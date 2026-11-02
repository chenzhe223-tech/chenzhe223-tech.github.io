AI 不只要更强，还得真能干活

过去我们习惯用参数、榜单、发布会衡量 AI。现在问题变了：它能不能在真实流程里执行任务、验证结果、处理复杂环境？

2026年11月2日 这期简报，挑出五条值得关注的全球与中国 AI 动态，看看 AI 正怎样走进真实场景 👇

🔎 DeepSeek 开源 Router-Worker 编码代理原型
DeepSeek Harness 团队公开了 dsh-superagent-prototype：Router 接收 GitHub/飞书任务，再交给隔离 Worker 执行。报道中的 p95 15.7 分钟来自合成模拟，不代表真实编码质量。 看点是授权、派单和隔离执行的工程设计；仓库明确标注为研究原型，暂不适合直接上生产。
来源：MarkTechPost；DeepSeek 官方 GitHub

🔎 清华团队提出代数世界模型：让 AI 从探索走向可验证证明
清华与上海期智研究院团队提出 AWM，把环境探索转成 Python 假设，再用 Lean 4 做机器检查。作者在 25 个 ARC-AGI-3 游戏、183 个关卡上报告 99.9 分，结果仍待独立复现。 它展示了“先建模、再验证”的路线，可能影响机器人、自动化测试和复杂软件操作。
来源：量子位；arXiv 论文

🔎 机器人登泰山大赛今日开赛：真实山地检验感知与运动控制
首届 CMG 世界机器人登泰山大赛今天开赛，足式机器人赛段约 3.9 公里、3100 余级台阶、约 600 米高差。当前确认的是赛道与开赛安排，赛果尚未公布。 真实山地比平地演示更能检验感知、步态控制和平衡能力。
来源：IT之家；快科技（引用央视新闻）

🧮 OpenAI 扩大与 ServiceNow 合作：把 AI 接入企业工作流
OpenAI 与 ServiceNow 扩大合作，ServiceNow 应用已进入 ChatGPT 应用目录；Codex、安全和语音能力按官方路线图分阶段推进。部分能力要到 2026 年底至 2027 年，不能当成现在全部可用。 企业 AI 正从回答问题，走向在权限、审批和审计边界内完成实际流程。
来源：OpenAI 官方公告；ServiceNow Newsroom

🤖 Datasette Agent 更新：自动继承 LLM CLI 默认模型
datasette-llm 0.1a9 让 Datasette Agent 自动继承 LLM CLI 的默认模型，不必重复配置 `default_model`。 这是小幅但实用的开发体验优化，适合正在用 Datasette 搭数据应用的人。
来源：Simon Willison's Weblog；datasette/datasette-llm GitHub

🧰 今日实用 Skill
Cloudflare 安全审计 Skill：面向支持 Agent Skills 标准的编码代理，可分阶段检查代码仓库、API、服务与工具，输出结构化发现并复核关键问题。
许可证：MIT；项目仓库：https://github.com/cloudflare/security-audit-skill。
官方项目主页：https://github.com/cloudflare/security-audit-skill（未声明独立官网，使用官方 GitHub 项目页）。
适用范围：已核验官方 GitHub 项目页、README、SKILL.md 与 MIT 许可证；未实测安装，使用请自行评估。
安全说明：未对该 Skill 本身做独立安全审计；建议在隔离沙箱中运行。

💡 DAVYLAB 观察
从 DeepSeek 的多任务 Agent、清华团队的可验证世界模型，到泰山真实地形机器人赛，本期中国 AI 的共同方向是把能力从演示推进到执行与验证；OpenAI 与 ServiceNow 的合作则显示，企业 AI 正在接入权限、审批和安全流程。
企业可以先挑选权限边界清晰的工作流，验证模型能否稳定执行、记录证据并允许人工接管；普通人则从一项可重复的 Skill 入手，把 AI 用进真实任务，而不是只追逐榜单。
以下为 DAVYLAB 基于本期已核验公开来源的综合判断，不代表任何单一机构或企业的结论。

❓ 如果把 AI 接进你的日常工作，你最希望它先接手哪一步？
A. 查资料与做研究  B. 写代码与做产品  C. 门店与客户服务  D. 流程、审批与成本管理
欢迎在评论区分享一个你真想交给 AI 的任务。

作者：DAVYLAB｜让可能发生
#AI #人工智能 #AI智能体 #AI工具 #职场效率

完整简报：https://chenzhe223-tech.github.io/radar/daily/
