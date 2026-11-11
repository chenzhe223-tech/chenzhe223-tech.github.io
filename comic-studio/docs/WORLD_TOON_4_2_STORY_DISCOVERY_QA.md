# WORLD/TOON 4.2 · 红果短剧与小说剧情选择

**发布日期：** 2026-11-11  
**定位：** 素材发现 → 网络书名/剧名检索 → 有据可查的剧情片段勾选 → 同一作品工作空间 AI 编剧 → 创意导演 → 既有双 SOP / GitHub QA / 作者最终授权。

## 功能落地

1. 「素材发现」顶部新增独立但集成在原工作流内的 **红果热剧 · 网络小说 · 世界名著** 搜索区。按短剧、小说和综合类型查找，支持新搜索和有日期的精选热点快照。
2. 原著/公开短剧剧情 **可勾选多个片段**、调整忠实改编与独立原创方式；选完自动建立真实本机项目，保留所选剧情、出典、创作描述和版权状态，并跳转 `#/workspace/<project_id>/1`。
3. 公版示例：`简·爱` 来自 Project Gutenberg（https://www.gutenberg.org/ebooks/1260），6 个源于原著阶段的剧情候选；仅能认定美国公版，翻译、其他地区和插画另核权利。
4. 商业短剧示例：`他过分野` 来自第三方公开作品介绍（https://www.soduanju.com/duanju/taguofenye.html），4 个有依据的**概要剧情节点**，明确不是精确的集数表；保留 `copyrighted` 权利状态。
5. 红果热点：2026-11-11 有来源的第三方榜单条目 + 实时 Google News RSS 公开报道线索。显示快照日期和来源，不把第三方榜单冒充红果官方的实时播放统计。
6. 其它小说：调用 Google Books 和 Gutendex 的公开**书目**接口；如可用，仅从带来源的描述句中提取“简介线索”，不捏造原著章节；无内容时允许作者输入有权使用的剧情摘要再拆为可选段落。
7. 原有公版素材池、AI 简报、题库、漫画书架和两种 Agent SOP 保持不变；本功能不是模型生图工具。
8. 直接忠实改编受保护作品：需作者确认授权并填写可查的授权证明 URL 才可通过 `wfCanTask` 的初步派单条件，之后 **仍须** 完成创意、真实首图、GitHub QA 和作者终审。独立原创模式只引用抽象主题，明确要求创造全新的角色、情节和对白。

## 文件与真实交付记录

- `comic-studio/story-discovery.json`：来源与分镜候选索引，含版权状态及快照日期。
- `comic-studio/story-discovery-service.js`：Cloudflare Worker 源码，在线读取上述索引，并在用户发起搜索后使用 Google Books / Gutendex / Google News RSS。
- `comic-studio/story-discovery-ui.js`：独立可维护的剧情发现/选取逻辑，实际嵌入白名单允许的 `extension.js`。
- `comic-studio/styles.css`：浏览器端双列结果、剧情复选框、版权提示及手机单列适配。
- `comic-studio/app.js`：保存剧情选择至生产任务，增加忠实改编授权门禁。
- `comic-studio/index.html` 和 `comic-studio/sw.js`：4.2.0 浏览器和 Service Worker 版本刷新。
- `comic-studio/tests/worldtoon-story-discovery.cjs`：新增自动化回归脚本；已加入原有 GitHub Actions 回归工作流。

## 本次验证

- Cloudflare Worker **真实部署新版本**，`/api/comic/story-search` GET 路由和 `wtStorySearch` 函数已从部署脚本回读；原有 6 项绑定仍完整，包括 D1、DeepSeek Key、GitHub Key；部署记录可获取。
- 原 3.0、4.0 代码/行为烟雾测试在隔离 JS 模拟环境中均返回 **PASS**。
- 搜索/选段/版权功能 **11/11** 模拟联动检查通过：两本指定素材命中、热点快照、图书目录、可选剧情、漫画草稿、AI 编剧入口、版权门禁。
- GitHub `worldtoon-story-discovery.cjs` 脚本内容已通过受控依赖模拟执行并输出 `WORLD/TOON STORY SEARCH PASS`；真实 GitHub Actions 云端成功回执尚未核实。

## 未核实的节点（禁止假报通过）

- 实际登录用户的浏览器 **实时网络搜索 GET 返回 HTTP 200** 与第三方上游可用性、不同网络条件下的 UI 操作与响应时间。
- 桌面/手机端真实视觉截图与点击路径验收（源代码包含断点适配）。
- 所有受保护小说/短剧的真实商业改编许可；此种授权须项目逐部取得。
- AI 编剧真实付费 DeepSeek 扩写、漫画图片、封面及真实发布回执（仍按原 SOP 审核）。

**下一次浏览器手动验收**：打开 https://worldtoon.chenzhe223.workers.dev/#/live ，点《简·爱》或《他过分野》快捷词 → 搜索结果 → 选择剧情 → 勾选一至多段 → 确认改编方式 → 建立漫画草稿，确认页面跳转到本作品 AI 编剧。若 API 返回明确错误，不应默默使用伪造结果。

**By DAVYLAB · 把想法，做成能用的工具。**
