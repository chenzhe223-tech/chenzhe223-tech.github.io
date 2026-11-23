# DAVYLAB News Engine × AI 日报｜正式融合与回退说明

**作用范围：仅替换 AI 日报“海外精选 / 海外深读”原 XNews 的新闻线索采集来源。** 不替换全球 Top 5、中国 AI、Skill、微信输出、1200×1800 主海报或原有的 QA/发布工作流。

## 生产接入
- 默认配置：`radar/config/news-engine-xnews.json` 的 `provider: "news_engine"`。
- 采集、过滤、研究排序：`radar/scripts/news_engine_xnews.py`，调用 `news-engine/collector.py` 与 `news-engine/research.py`。
- 不依赖 `xnews.qiaomu.ai`；五个可信公开 RSS/Atom 线索源：OpenAI、Google AI Blog、Hugging Face、Simon Willison、TechCrunch AI。
- 保留 `radar/data/latest.json` 的 `xnews_voices` 数组与 `xnews_status` 字段，避免破坏既有页面和 Pages 发布门禁。现有的海外阅读卡片、原文链接、深读页面会展示这些字段。
- 从最多48条候选中对历史日报与当日主新闻去重，再按照来源多样性筛选最多6条；单一源异常时继续，至少3个源正常时优先使用新引擎，严重故障回退旧接口。
- 只是**未独立核实的新闻线索**：不自动刊登完整内容，不生成未经事实核验的结论，不复制受限图片、不调用付费模型。

## 单独回退
如新引擎失效，编辑 `radar/config/news-engine-xnews.json`：
```json
{ "provider": "legacy" }
```
请保留原有其他开关字段。下一次既有日报构建会恢复旧 XNews 源，不必回退其它日报栏目或海报。也可临时将 `RADAR_XNEWS_PROVIDER=legacy` 作为运行环境覆盖。若两个来源均不可用，展示明确空状态，而不会编造线索或阻断日报核心栏目。

## 验收证据
- PR #147: News Engine 基础引擎（合并 `c64c16e25473200b0295832da88fc502e6335c5b`）。
- PR #160: Radar 主分支融合（合并 `a0f4544d3f8b6eea5dda9615177ac1e7210e45b7`）。
- 集成 CI：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45112528176 （离线测试、真实 RSS、390px / 1440px Chromium）。
- 原日报全站 QA：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45112528160。
- 实采 5/5 源、48条候选、历史和当日去重后6条/3个来源，尚不构成新闻事实核验。
- 最终**上线验收**必须另核对：`radar/data/latest.json` 当天 `report_date`、`xnews_status=ok`、新引擎 `source_kind=news_engine_rss_discovery`、主海报 QA PASS 和 Pages 实际部署。单纯合并代码或触发流水线不算完成。
