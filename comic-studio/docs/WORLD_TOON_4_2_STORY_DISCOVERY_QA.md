# WORLD/TOON · 热剧 / 小说来源发现与漫画交接 QA

**完成日期：** 2026-11-11
**线上入口：** https://worldtoon.chenzhe223.workers.dev/#/live
**功能路径：** 素材发现 → 搜索短剧/小说/名著 → 查看来源与概要片段 → 选择原创或授权改编 → 进入原有编剧、导演与双 SOP。

## 已交付

- 搜索入口接入现有“素材发现”页，支持短剧、小说、综合检索，以及带日期的红果题材榜单快照。
- 作品卡显示来源、来源日期、身份核验状态、权利提示。新闻只提到题名时不冒充作品上架证明；书目接口只读取目录与简介，不抓取现代作品全文。
- 《简·爱》候选链接到 Project Gutenberg，按公版候选处理，并提示地区、译本及插画另核权利。
- 《他过分野》候选链接到第三方公开作品介绍，剧情节点标为公开简介概要，不虚构集数；保留受版权作品的原创改写与授权改编门禁。
- 红果热榜快照收敛为同一第三方来源的 2026-11-11 前十榜位，显示来源日期与第三方口径，不把估算指数标成红果官方播放量；无法确认剧情的榜单条目不提供编造的剧情片段。
- 搜索失败显示逐来源告警；零匹配显示明确空结果说明。选段进入原有漫画工作台，最终生产继续经过既有作者审核和 GitHub QA。

## 代码与仓库

- 搜索与标题身份规则：comic-studio/story-discovery-service.js
- 搜索卡片、选段及工作台交接：comic-studio/story-discovery-ui.js（嵌入 Worker 白名单允许的 extension.js）
- 日期榜单与作品索引：comic-studio/story-discovery.json
- Worker 路由与健康版本：comic-studio/worker.js
- 回归脚本：comic-studio/tests/worldtoon-story-discovery.cjs

GitHub PR [#125](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/125) 已合并，合并提交 75f1a1dbc4bee2b251171a62d2acdc5dc50c4b0d。PR 上的 WORLD/TOON static quality gate 与 WorldToon mobile layout contract 两项 Actions 检查均成功。\nGitHub PR [#126](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/126) 已合并，合并提交 02364314b7c22a533c322c342bd631544f399e1a；该提交的 WORLD/TOON static quality gate 成功。

## 真实验收记录

- Cloudflare Worker worldtoon 已通过 Replace Worker Script Content 上传 4.3.0 模块，deployment id 7b1e2b13f2ef4edcbf8c1daad9a3c55f；线上 /health 返回 storySearch:true 和 titleIdentityChecks:true。
- 线上小说查询 简爱 返回《简·爱》来源卡与六个剧情候选；同次响应明确报告 Google Books HTTP 429、Gutendex 超时，仍展示可追溯的精选来源。
- 线上短剧查询 他过分野 返回来源明确的第三方简介候选；同次响应明确报告 Google News RSS HTTP 503。
- 线上未匹配小说关键词返回 items:[] 与“暂未找到匹配来源；可更换关键词或稍后重试”。\n- PR #126 合并后重新打开生产页面并强制刷新热点快照；UI 与线上 API 均返回同一份 2026-11-11 第三方前十榜单（共 11 条含《他过分野》精选资料），不再混入旧榜源。\n- 在隔离的 ChatGPT 内置浏览器中实测《简·爱》搜索、六个片段展示、勾选片段并建立临时草稿，成功进入现有 AI 编剧工作台；该临时草稿未写入作者持久浏览器数据。
- 浏览器中已检查桌面视口，并在 375×812、390×844、430×932 手机视口检查搜索、来源卡、片段选择及版权提示布局。
- 本地 20 个非浏览器回归脚本通过。另有四项 Playwright 浏览器脚本因仓库未安装 playwright 依赖无法运行；上面的浏览器验收通过连接的实际浏览器完成。GitHub Actions 的静态质量和移动布局检查均成功。

## 保留边界

- 没有在作者的持久浏览器数据中创建测试项目；正式选择剧情后会沿用现有作品工作台及双 SOP。
- 近年短剧/网络小说仍须逐作品核验改编许可；公网来源或公开简介不等同于授权。
- DeepSeek 扩写、生图、作者终审、GitHub 成品验收和对外发表不由搜索功能自动触发。
- 在线书目与新闻源有时会限流/超时；页面显示告警并可用带来源快照兜底，不声称上游始终可用。

**By DAVYLAB · 把想法，做成能用的工具。**

## 角色修改同步修复（2026-11-11）

- 根因：DeepSeek 扩写将角色名直接写入分镜文本；导演台角色卡编辑只更新角色圣经，没有同步修改已有镜头文本。
- 修复：编辑角色姓名、外貌、服装、识别道具或性格时，将旧字段值在该作品已有分镜标题、场景、旁白、对白及制作提示中精确替换为新值；其他文字保持不变，修改继续使作者定版失效并要求复审。
- 缓存版本更新为 creative-director.js?v=4.1.1。
- 回归脚本 creative-director.cjs 覆盖改名、外貌替换及其他对白保留；creative-director.cjs 与 worldtoon-deepseek-smoke.cjs 均通过。

