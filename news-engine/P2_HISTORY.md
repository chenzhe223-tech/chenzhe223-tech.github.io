# DAVYLAB News Engine P2 · 历史期刊检索与统一选题评分

## 最小侵入式架构

- **不创建另一个平台，也不改 Radar 自动日报、生产海报、公众号文章或 WorldToon 漫画。** 同一个独立 Worker `davylab-news-api`，新增 `/api/v2/` 接口，`/api/v1/` 保持协议及行为不变。
- 取数只来自 `radar/data/latest.json`、`radar/data/history.json` 和按日期限定的 `radar/data/archive/YYYY-MM-DD.json`，仅允许现有 GitHub Pages 与同仓 GitHub raw 两个明确源。
- 每一份归档必须通过 **quality_gate.status=PASS**，日期、字段及体积校验后才入索引；不会请求新闻第三方正文、RSS 之外的网页、用户输入的网址或图片。
- **历史结构兼容：** 2026-11-12 及更早期部分正式期刊尚无可选 `xnews_voices` 海外栏目。只有字段**缺失**且该期核心内容与 PASS 质量门禁均有效时，才将该栏目视为空；字段存在但类型非法仍拒绝索引。不得因为新栏目缺失而抹去早期历史新闻。
- 最多查看官方历史目录最近 **30期**（不是无界全网实时搜索）。默认查询7期；每个请求同时抓取最多5份历史归档，GitHub/Cloudflare HTTP 缓存300秒，不新增 D1、KV、R2、付费模型、定时任务或新的 Cloudflare Worker。
- 如果历史归档某日无法访问或质量不通过，返回 `partial:true` 和 `missing_issues`，不把未查日期冒充“无相关报道”。全部不可用时 HTTP 503，原 V1 最新日报接口仍可用。

## P2 API

| 接口 | 功能 |
| --- | --- |
| `GET /api/v2/history?days=30` | 公布最多30期可查询期刊日期（仅目录，不声称逐期质量已核实） |
| `GET /api/v2/news?days=7&category=agents&sort=latest` | 多期原始来源新闻元数据；跨期 URL 去重、栏目与分类筛选 |
| `GET /api/v2/search?q=OpenAI&days=30&sort=relevance` | 在最多30期已发布归档中检索，不是实时全网检索 |
| `GET /api/v2/topics?days=7&category=research&sort=score` | 可解释、确定性的五维选题推荐 |
| `GET /api/v2/openapi.json` | P2 独立接口文档 |

共有参数：`days=1..30`、`from=YYYY-MM-DD`、`to=YYYY-MM-DD`、`stream=all|top5|china|overseas|more`、`region=all|china|global`、`category=all|agents|models|research|products|business|safety|creative|other`、`source`、`q`、`sort=latest|score|relevance`、`limit=1..50`、`offset=0..500`。历史目录仅接受日期范围与 days；search 要求 q 至少两个字符。超出最大天数、分页上限将钳制为最大允许值。多值或不合法参数 HTTP 400。

## 评分方法（100分，非虚构社交热度）

| 维度 | 满分 | 来源 |
| --- | ---: | --- |
| 时效性 `timeliness` | 30 | 归档发布日期与最新正式日报日期的间隔 |
| 来源可追溯 `traceability` | 20 | HTTPS 原始链接、媒体署名和文章发布日期是否存在 |
| 实用性 `practicality` | 20 | 标题和摘要中可审计的应用/发布/开发等关键词 |
| 主题匹配 `topic_match` | 20 | 关键词在标题、摘要、原始标题中的匹配 |
| 编辑优先级 `editorial_priority` | 10 | 原日报自带规则研究分的有限归一化 |

**不是**平台社交数据、新闻真实阅读量、外部用户热度或 AI 模型打分。返回 `selection_score`、`score_breakdown`、`score_type=deterministic_rule_v2_not_social_heat`，适合人工编辑复查；不可将规则分数当成流量或科学结论。

## 安全与版权

- 只返回标题、短摘要、媒体、原始报道 HTTPS 链接、归档日期及分类；不返回原文章全文、新闻图片或未授权素材。
- 每个候选均 `verification_status=requires_independent_fact_check`、`publishable:false`、`external_copy_allowed:false`。
- 30期日期来源是由正式日报维护的公开 history.json；不擅自增补缺少的期次，不虚构现场更新频率。
- WorldToon、KNOWA 和公众号平台仍继续使用 **V1 P0/P1**，无需修改其 UI；V2 供未来选题台逐步升级历史搜索。

## 验收及回退

- `node news-engine/test_public_api.cjs` — 老版接口所有回归保持通过。
- `node news-engine/test_p2_history.cjs` — 两期归档、时间和分类筛选、跨期去重、五维评分、异常输入、版权、缺失期次显式披露、原接口失效隔离。
- `.github/workflows/news-engine-p2.yml` — GitHub 真实公开历史归档可访问性、质量门禁、P2+V1 双协议与生产 HTTPS。
- Cloudflare `davylab-news-api` 作为唯一部署目标，生产前保存旧版本 ID，**只替换 Worker 代码、不改账号绑定、路由、其他平台和每日生产定时任务**。
- 如果新 Worker 有不可恢复问题，按 Cloudflare 保存的版本回退，已上线的 V1 下游消费者不需更改配置。

状态：本文件描述 P2 设计及验收标准；正式上线以 GitHub Actions 最新日志和 Cloudflare 实际 Worker 版本、HTTPS 响应为准。
