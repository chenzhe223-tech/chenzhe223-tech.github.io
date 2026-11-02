AI 不只会回答，开始接手一整段工作

过去我们习惯用参数、榜单和发布会衡量 AI。现在更值得问的是：它能不能接入工具、完成任务，还能把权限和成本管住？

2026-11-02 这期简报，挑出五条值得关注的全球与中国 AI 动态，看看 AI 正怎样走进真实场景 👇

🔎 DeepSeek 开源 Router-Worker 编码代理原型
11月1日，DeepSeek Harness 团队公开 dsh-superagent-prototype，一个采用 MIT 许可的研究原型。它用 Router 接收 GitHub、可选飞书事件，再把获授权任务拆成独立 Ticket，由各自的 Worker 会话和工作目录执行；据 MarkTechPost 报道，DeepSeek 的合成消息流模拟测试给出 p95 15.7 分钟，对照单会话基线 29.5 分钟，但测试使用合成消息和模拟工具，并未测量真实编码质量。 它的价值在于把多任务 Agent 拆成授权、派单和隔离执行，减少上下文串扰与人工盯任务的成本；但官方仓库明确标注为研究原型，不是生产就绪产品，也不是可直接代表 DeepSeek 内部系统的正式产品。模拟性能数据不能等同于真实代码质量。
来源：MarkTechPost；DeepSeek 官方 GitHub

🔎 清华团队提出代数世界模型：让 AI 从探索走向可验证证明
10月29日发布在 arXiv 的论文介绍 Algebraic World Model（AWM），由清华大学与上海期智研究院团队提出。系统把未知环境中的探索记录转成可执行的 Python 假设，再整理为结构化规则并用 Lean 4 做机器检查；论文作者报告称，在 25 个 ARC-AGI-3 公开游戏、183 个关卡上取得 99.9 分，认证轨迹使用的动作数约为人类基线的 43%。 看点不只是分数，而是把探索得到的规则转成可检查模型，再用 Lean 4 对可达性或不可达性进行机器证明；这条“先建模、再验证”的路线，对机器人、自动化测试和复杂软件操作都有参考价值。论文目前是 arXiv 预印本，实验结果为作者报告，仍需独立复现。
来源：量子位；arXiv 论文

🔎 机器人登泰山大赛今日开赛：真实山地检验感知与运动控制
2026年11月2日，首届 CMG 世界机器人登泰山大赛在山东泰安开赛。媒体发布的赛道数据包括：足式机器人赛段约 3.9 公里、攀爬 3100 余级台阶、累计高差约 600 米；赛事设置 4 个正式赛项和 1 个特色挑战，涉及人形、足式、负重和外骨骼等项目。 真实山地环境比平地演示更能检验机器人的环境感知、步态控制、平衡与负重能力；目前核实到的是开赛安排和赛道设计，尚未看到最终比赛结果，不能把赛前信息写成比赛成绩。
来源：IT之家；快科技（引用央视新闻）

🧮 OpenAI 扩大与 ServiceNow 合作：把 AI 接入企业工作流
10月28日，OpenAI 与 ServiceNow 官方公告披露双方扩大合作，ServiceNow 应用已进入 ChatGPT 应用目录，帮助用户在企业权限与流程约束下调用 ServiceNow 工作流。双方还公布了 Codex 与 ServiceNow AI Workflow Factory 的集成计划，以及安全、风险和语音能力的后续安排；公告列出的部分能力将在 2026 年底至 2027 年分阶段推出，并非全部已经开放。 企业 AI 的竞争正从“能回答问题”转向“能否在权限、审批和审计边界内完成动作”；对企业而言，真正的落地点是把模型接入已有工单、知识、IT 运维和安全流程，而不是只增加一个聊天入口。
来源：OpenAI 官方公告；ServiceNow Newsroom

🤖 Datasette Agent 更新：自动继承 LLM CLI 默认模型
10月31日，Simon Willison 发布 datasette-llm 0.1a9。更新后，Datasette Agent 会直接沿用 LLM CLI 的默认模型配置，不必再重复设置 `default_model`；这是面向 Datasette 开发者的一项配置体验优化。 它没有带来新模型或性能突破，但减少了工具链里的重复配置；如果你用 Datasette 搭建数据应用和 Agent，可以少维护一份模型设置。项目仓库采用 Apache-2.0 许可证。
来源：Simon Willison's Weblog；datasette/datasette-llm GitHub

🧰 今日实用 Skill
Cloudflare Security Audit Skill：面向支持 Agent Skills 标准的编码代理，按多阶段流程检查代码仓库、API、服务和工具，生成结构化发现项，并对关键问题做独立复核。适合在隔离环境中辅助开展代码安全检查（仓库实际扫描到1个SKILL.md文件）
许可证：MIT；项目仓库：https://github.com/cloudflare/security-audit-skill。
官方项目主页：https://github.com/cloudflare/security-audit-skill（未声明独立官网，使用官方 GitHub 项目页）。
适用范围：已核验 Agent Skills 文档与仓库结构；未实测安装。。
已核验官方项目主页、仓库 README、实际 SKILL.md 文件及许可证；未实测安装，未完成专项安全审计，使用请自行评估。

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
