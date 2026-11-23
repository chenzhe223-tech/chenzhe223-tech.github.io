# DAVYLAB News Engine · P3 原生三平台历史选题 UI 集成

目标：在已上线三平台 **WorldToon / 公众号 Topic Studio / KNOWA Studio** 的原有选题界面使用 P2 官方历史新闻。**不改变 AI Radar 日报采集、登录、内容知识库、历史 V1 接口、制作引擎或用户已保存数据。**

## 共享组件

- 唯一组件源代码 `news-engine/p3-widget.js`，复制到 `comic-studio/news-history-p3.js`、`topic-studio/news-history-p3.js`；CI 验证三个文件 **字节完全一致**。KNOWA Worker 内嵌也使用该源，而不另写算法。
- 仅根据明确的点击调用 `GET /api/v2/news` 或 `GET /api/v2/search`，默认7期，支持7/14/30期、中文或英文关键词（至少2字）、8类主题、国内与国际区域、规则评分或最新排序，15条分页加载更多。
- 原始 HTTPS 链接、来源、首次/最新收录日期、五维解释分数、实际有效期次及部分缺失期次明示。不会复制全文、下载或复用新闻图片，且各项均要求 `publishable=false`、`verification_status=requires_independent_fact_check`。
- 任一历史 API 失效，仅在这个新组件内提示失败；P1 原现有的新闻选题、XNews、知识来源及制作功能继续可用。

## WorldToon

- `comic-studio/briefing.js` 在原 AI 简报标签中增设“**历史搜索**”。原“今日五大观察”、高分优选、全球、中国、News Engine 当日、热门 Skill、NOTE 均完整保留。
- 历史卡片经过 `briefCollect('engineHistory',index,false)` 加入原有 **漫画选题池**；仍为“待核验”，制作需在原平台下一步完成，**不会直接生成九宫格或发布**。
- 原历史新闻首次收录期与来源写入候选，禁止将今日日报日期冒充历史新闻首发时间。

## 公众号 Topic Studio

- 在原 XNews 海外精选的顶部工具栏与已有卡片之间，新增 **News Engine · 跨期历史搜索** 折叠区。关闭后原始卡片列表无变化。
- 点击“加入公众号选题”经现有 `normalize → toFeed → addFeed` 链路，继续使用原有文章/贴图选题、来源、创作指令及审稿流程。
- P3 规则分不是站内真实阅读量；明确与 P1 自带规则评分不同，禁止以此预测流量或自动发表。

## KNOWA Studio

- 部署方式：只更新同一个生产 Worker `davylab-knowa-p0` 的 `/studio` **HTML 响应**（附加折叠搜索区和内联同源组件），并为该路由 `connect-src` 增加明确的已授权 `https://davylab-news-api.chenzhe223.workers.dev`，不放开其他域名。
- 浏览器桥 `news-engine/p3-knowa-bridge.js` 将用户**明确选中**的历史线索添加到原本本地的 `knowa:radar:pool:v1`；原 Studio 从原 `/api/topics` 与本地数据合并，用户继续走原有选题导演台/双轨制作。**不修改 KV、AI_QUOTA 或百科知识库**。
- Cloudflare 现有 5项绑定 AI_ENABLED、AI_QUOTA、DAILY_AI_LIMIT、DEEPSEEK_API_KEY、TOPIC_STORE 必须前后同名同类型，其他后端路由保持原样。必须保存旧 deployment version，并真实浏览器测试 `/studio` 以核实页面可访问、V2 候选来源有效及本机选题池可保存。

## QA 和交付

- PR `.github/workflows/news-engine-p3.yml`：离线 HTML/JS 合同、规范组件三份一致性；本地 Chromium 手机390px+电脑1440px三平台浏览器集成；V1 旧接口兼容。
- 合并后真实生产浏览器跑六个组合（WorldToon、Topic Studio、KNOWA × 390/1440），复核两个 P1 来源列表、KNOWA知识资产、P2归档规则分、点击添加与版权门禁。
- 成功验证前不宣称 P3 全面上线。用户取消 P3：git revert `briefing.js`/主页和 Topic Studio 页面及脚本；KNOWA 用 Cloudflare 旧版本部署即可，P2公共服务和 P1继续运行。

P3 不包含全网实时搜索、论文原文语义评测、真正社交热度推算、自动漫画/文章/贴图生产或发表。
