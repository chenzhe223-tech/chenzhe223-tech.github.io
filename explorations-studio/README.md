# AI Explorations Studio · By DAVYLAB

独立入口：`/explorations-studio/`。不修改每日 AI Radar 的数据与自动化。

## 产品定位

围绕 AI Explorations 的完整内容生命周期：启动专题 → 核验选题 → 建立编辑素材 → 修订与审校 → 输出 WorkBuddy 交接单 → 核实发布 → 历史归档与知识关联。

## 已实现（首期静态 MVP）

- 编辑首页与最新素材概览
- 素材新建、修改、分类、标签、状态、来源 URL、图片 URL、DAVY'S NOTE
- 素材版本操作日志（不是逐字段完整快照），每次保存追加一条记录
- 历史归档室、检索与恢复
- 基于记录的专题与标签关系图谱，节点点击打开详情
- 本地 JSON 完整导入/导出、WorkBuddy Markdown 任务单导出
- 手机端响应式排版

## 安全、存储与真实执行边界

- 当前使用 localStorage，**不提供登录和多端同步**，清除浏览器数据可能导致记录丢失。
- 图片使用 URL 引用，当前没有上传或永久储存图像的能力。
- 目前生成的是**交接任务单**，不代表已触发 WorkBuddy 执行、发布了微信公众号文章或调用 AI 生图。
- 示例数据仅为首期演示记录，所有条目默认未核验为正式线上已发布。
- 版本记录仅保存修改说明，不是可回滚的全量文件历史；未来采用后端版本表。
- JSON 备份可能包含未公开内容，请勿随意分享。

## 待开发阶段

P1: Supabase 新加坡区 Auth / RLS / Storage / 结构化数据模型 + 多设备同步；迁移与冲突解决。
P2: AI 新闻采集、去重、素材生成编排和审校流水线；可编辑版式源文件。
P3: GitHub/WorkBuddy 接收回执、公众号草稿预览与上线验证；完整发布证据。
P4: 图谱扩充：来源事实、素材版本、衍生图、专题、品牌规范、Skill、发布记录之间的可追溯实体关系与查询。

## 发布与 QA

- 文件路径 `explorations-studio/index.html`
- 仓库源码已提交；生产 URL 必须独立打开并验证后才可标记 Production Deployed。
- 测试范围包括：创建/编辑、版本操作日志、归档/恢复、检索、关系图谱、JSON 导入导出、任务单下载、移动端适配。
- 状态标签：Code Completed；GitHub 提交完成；Live Runtime / Functional Test / Production Deployment 待验证。


## AI Radar 每周情报源（已接入）

- **入口**：Explorations Studio 左侧「AI Radar 情报源」。
- **唯一上游数据源**：同一 GitHub Pages 站点的 \`/radar/data/history.json\` 以及 \`/radar/data/archive/YYYY-MM-DD.json\`；**只读**，不会修改原有每日新闻工作流。
- **日期范围**：按北京时间每周一至周日，以用户打开时的上一完整自然周为默认范围；支持浏览之前三周。
- **来源字段**：\`top5\`、\`news\`、\`china_ai_news\`、\`skills\`、\`report_date\`；保留原始报道链接、日期及来源标识。
- **候选初筛**：按来源 URL 和标题去重，新闻按是否入选 Radar 五大观察、归档出现次数与来源类型辅助排序；这只是**初筛顺序，不是实测社交热度**。Skill 按 Radar 的评分和证据验证字段辅助排序。
- **编辑选择**：允许人工更换候选，强制选择 7 条新闻 + 5 个 Skill。只有当 7 天归档均存在时可建立完整周刊；缺失时提示具体日期。
- **创建九条素材**：7 条新闻素材 + 两条 Skill 合辑（前三个和后两个）入库，初始状态「构思中」，自动附原始链接与历史日期，\`DAVY'S NOTE\` 留空待编辑；重复导入同一期条目会跳过而不覆盖已修改数据。
- **没有实现**：自动生成高清贴图、AI 自动事实核查、跨不同新闻 URL 的语义事件去重、真正的社交媒体热度测量、已授权图片版权自动判断、实时推送 WorkBuddy 和公众号正式发布。这些仍需后续单独实现与验收。

### 操作说明
1. 打开 \`/explorations-studio/\`，选择「AI Radar 情报源」。
2. 确认上一完整周的 7 天归档覆盖，以及 7 条新闻和 5 个 Skill 的选择。
3. 点击「建立本周九张素材任务」，到「素材工作台」编辑每条内容与 DAVY'S NOTE。
4. 在实际完成生图、审校、上传后，再修改任务状态并在「生产与交付」导出 WorkBuddy 任务单。

当前默认不再用静态示例素材填充空账号。原来浏览器已经存储的记录不做迁移清理；请先备份并核对是否为旧演示数据。


## 2026-11-09 | Production SOP V0.2

### 已部署
- **生产数据模型**：\`explorations_runs\`、\`explorations_assets\`，Supabase 新加坡区数据库，RLS 只允许登录用户读取自己的记录；前端匿名账户无写入权限。
- **后端 Edge Function**：\`explorations-production\`，接收经过 \`auth.getUser\` 验证的登录用户 token，内置操作 \`start/list/detail\`，生产状态存于云端，不暴露服务端密钥。
- **一键创建批次**：点击自动生产后，默认上一完整北京时间自然周，读取 \`/radar/data/history.json\` 和 7 天归档；无完整来源会明确阻止进入完成状态。
- **自动初选**：自动从 \`top5/news/china_ai_news/skills\` 抽取并按 URL/标题去重，筛 7+5；排除该用户近 90 天已在周刊批次中选过的相同来源标识。**尚不等于 AI 语义事件级 90 天历史查重**。
- **九条编辑稿**：成功筛选时写入 7 条新闻、2 条 Skill 合辑云端资产，附原文 URL、摘要、重要性和统一视觉规范；状态标记 \`image_status=not_generated\`。
- **成果工作台**：云端批次、九条结果、阶段状态、阻塞原因及可导出的编辑草稿 JSON，不再要求手动二次挑选。
- **代码**：\`explorations-studio/production.js\`、\`explorations-studio/backend/explorations-production/index.ts\`、\`explorations-studio/index.html\`。
- **接口安全**：公开 URL 不能匿名触发生成，Edge Function 自行验证 JWT；关闭了平台级 verify_jwt 以兼容现代 publishable key，**不代表免认证**。

### 严格尚未完成
- 没有配置可由该后端调用的实际图像生成模型/API、媒体文件存储与版式渲染器，无法自动生成 9 张真实 PNG。
- 没有接通独立可靠的官方来源逐条二次核验、跨 URL 事件语义去重和实际社交热度采集。
- 没有 WorkBuddy 自动执行接口、公众号贴图上传与发布回执；仅提供可导出的 JSON 编辑清单。
- 由于没有用户登录凭证，正式登录后一键点击到数据库插入的端到端功能测试**尚待实际登录验证**，不能将其标为 Functional Tested。
- 这不是异步后台队列：Edge Function 在一次调用中完成来源读取与草稿入库。后续大规模生图须改为服务端持久队列、断点恢复、重试、幂等和日志。

### 交付状态
1. Code Completed：V0.2 代码已写入 GitHub。
2. Build Passed：JS 静态语法检查通过（不等于前端所有第三方依赖都成功加载）。
3. Runtime Verified：GitHub Pages 页面与脚本 HTTP 200；Edge Function ACTIVE；数据库新表存在且 RLS 已开启。
4. Functional Tested：未完成登录后的端到端点击验收。
5. Production Deployed：V0.2 基础设施已部署；**完整 9 PNG 自动生产/WorkBuddy 发布未上线**。

### 下一阶段技术工作
1. 确定已授权的图像生产 API 与费用预算，图像请求、结果永久存储、服务端合成中文排版与视觉 QC。
2. 增加可靠后台 Job/队列、状态恢复、任务超时、失败重试、分段执行与可观察日志。
3. 90 天新闻事件指纹及跨源语义去重；建立 verified source evidence，避免把 Radar 自动评分误称真实社会热度。
4. 构建 WorkBuddy API/webhook 正式交接并验证草稿链接、发布回执，未经许可不公开发布。


## 2026-11-09 | UI V0.3 — 生产页与认证修复
- 重新设计“周刊生产中心”：高密度杂志编辑版，紧凑主视觉 + 7/5/9 构成统计 + 批次列表；取消巨大英文广告视觉、常驻邮箱输入区和重复后台术语。
- 账号入口移动至顶部轻量弹窗；未登录可直接浏览公开页面和 AI Radar，启动云端任务时才要求登录。
- 认证主流程由 signInWithOtp 魔法链接改为 Supabase signInWithPassword；支持 email/password 首次注册、自动保存浏览器登录态、退出、忘记密码一次性恢复。已登录用户可直接设置长期登录密码，无须再发邮件。
- 处理回跳链接错误显示、PASSWORD_RECOVERY 回调，以及登录成功后继续被中断的“启动生产”意图。
- Supabase 共享项目此前 Auth 日志出现一些邮件一次性链接失效和发送限流，日志中也有来自其他 DAVYLAB 应用的请求，不能直接推断 Studio 的唯一根因。取消依赖 magic link 的主登录流程是针对体验与可靠性的修复。
- 验收：GitHub Pages 主页面与 production.js HTTP 200；静态 JS 语法检查通过；所有脚本引用的表单控件在 DOM 中存在。尚未用真实账号完成密码登录 → 生产调用的浏览器端到端测试，因而不可宣称已验证此链路。


## 2026-11-09 | 正式流程修订 V0.4

**唯一正确路径：Studio 派单 → ChatGPT 完成全部创作 → WorkBuddy 上传/发布 → 状态回写 Studio。**

- Studio 的 Edge Function `start` 只创建 `queued / awaiting_chatgpt` 创作委托与正式任务书，**不执行选题、写稿或图片生成**。可用 `work_order` 按批次获取任务书。
- ChatGPT 每周 09:00 定时自动化已更新，优先读取平台委托；若该环境无法直接访问私有队列，仅能按既定日期从 AI Radar 报道独立创作，不能宣称该委托已被真正领取。
- Studio 页面提供 **下载任务书** 和 **交给 ChatGPT**：后者复制明确委托提示词并打开 ChatGPT，由用户发送。当前不等于网站拥有 ChatGPT 对话创建 API 或已自动派发到 ChatGPT，须如实标注。
- WorkBuddy 必须在 ChatGPT 完成 9 个独立 PNG，提供 ZIP、原文核验清单、文案与 QA 后才能进入上传和发布。缺少真实回执不得显示已发布。
- 不直接写入微信，不修改每日 AI Radar 数据。
- 自动任务领取、ChatGPT 成品文件回传数据库及 WorkBuddy 自动接单发表的 webhook/连接授权目前尚未完成端到端验证，属于下一阶段技术工作。


## 2026-11-09 | GitHub 成品 → Studio 成果与历史档案同步 V0.5

Studio 用户点击「成果工作台」或「历史档案室」中的「刷新 · 同步 GitHub」，将指定**私有仓库** chenzhe223-tech/workbuddy-workspace 的 ai-explorations/releases/index.json 中通过 QA 的正式 GitHub Releases，导入 Supabase 新表 public.explorations_deliveries。

- **Studio 已发表**：ChatGPT 已完成九图且 GitHub 正式 Release 通过验收；这是 Studio 内作品发表/收录，不代表公众号实际发表。
- **微信公众号状态**：独立存储为 wechat_status，不由 GitHub 发布成功推断。
- **同步内容**：期号、版本、7 条新闻及原文、5 个 Skill 及原址、九图文件名/尺寸/SHA、GitHub Release ZIP 下载地址，带授权的单图预览。
- **档案**：每期+修订版本独立保存；重复点击同步不会生成重复记录。历史档案查询与成果列表共享同一个云端数据来源。
- **权限**：Supabase RLS 用户隔离；独立表 explorations_sync_owners 作为受信账号白名单；客户端**没有 GitHub 私有仓库 token**，后端逐次校验用户有效 Supabase session。
- **验收**：服务器先检查 GitHub Release 已正式发布且包含 ZIP，下载实际 Release ZIP 验证 9 个 PNG 与 hash，以及 manifest/validated-manifest.json 中的7+5、QA。未经过 GitHub 验收的草稿绝不导入。
- **性能**：同一期/版本只验证和导入一次，后续刷新跳过已有版本，避免每次重复下载大 ZIP。
- **安全**：不向公开 GitHub Pages 复制私有素材，只有登录授权账户才能通过 Edge Function 读取。
- **生产 Edge Function**：explorations-github-sync，对应源码 backend/explorations-github-sync/index.ts。

### 初次连接私有 GitHub 仓库

在 Supabase 项目 qjyqaydfezbpeimpvlcb 的 **Edge Function Secrets** 内，新增一个仅授予 chenzhe223-tech/workbuddy-workspace 仓库 Contents: Read 和 Metadata: Read（以及 Releases 读取所需）的 fine-grained GitHub token，密钥名 **EXPLORATIONS_GITHUB_TOKEN**。必须只在 Supabase 后台填写，禁止粘贴到聊天、公开源码、浏览器代码或 GitHub 仓库。

没配凭证时，点刷新会明确提示「私有仓库同步尚需配置服务端 GitHub 访问凭证」，不会显示伪造的成功结果。

### 核验边界

代码已提交，Edge Function ACTIVE，网页和 JS 静态检查可验证。当前私有 GitHub 仓库在本次检查时没有 ready_for_workbuddy 的有效 Release，历史云端同步表为空。由于尚无用户登录测试会话，**刷新 → 私有 GitHub → 成果落库**全链路不能提前标为通过；需在配置 GitHub 只读凭证及首个完整九图 Release 后运行端到端验收。
