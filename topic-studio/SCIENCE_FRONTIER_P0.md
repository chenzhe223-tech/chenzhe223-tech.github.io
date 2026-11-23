# DAVYLAB · 科学前沿（Nature × Science）｜P0
状态：开发分支 / 待线上部署与验收（不可写成已上线）。

## 目标与非目标
- 在现有「选题发现」增加「科学前沿」选项卡，不新建站点、不更改其他来源入口。
- 真实 DOI 与公开 Crossref 文献元数据驱动；仅主刊 Nature (0028-0836) 与 Science (0036-8075)，子刊后续分批添加并确认 ISSN。
- 不自动抓取付费全文，不把学术论文的存在等同于证明解读可靠，不把自动分数当作科学质量。
- 不自动批准或发表：选题进入原有 `inbox/draft`，由作者决定是否批准。

## 数据与更新
1. `topic-studio/scripts/fetch_science.py` 按 ISSN 查询近 90 天 DOI 元数据，对来源、DOI、标题、发表时间做结构校验；合并历史快照，保留最多 180 篇。
2. `.github/workflows/science-discovery.yml` 计划每天 00:15 UTC 运行；GitHub Actions 可能因额度、禁用或调度延迟失败，不能把计划任务当作执行成功。
3. `data/science-discovery.json` 初始为空。首次成功任务更新为快照；网页也可主动向 Crossref API 查询。查询失败会保留已验证的历史快照或本机缓存，明确显示缓存/异常状态，绝不虚构论文。
4. 来源元数据不包含有保证的原文摘要：无摘要时必须打开原论文，不允许凭标题生成研究结论。
5. 核验层级：**Crossref 元数据已匹配** ≠ 原文研究方法已审查 ≠ 结论已在人体证实 ≠ 可直接作为科普标题。

## 选题交接与制作门槛
点击「加入选题池」复用原 `saveTopics`、`showPrompt`、`changeSection`，保存 DOI、原文入口、发表日期和 `factCheckStatus`，选择现有 `planning`（内容策划）模式。

正式制作之前须检查：
- 原始论文是否可阅读全文/开放获取；若不能，准确声明仅核验摘要；
- Article、Review、Commentary、Editorial 等论文类型；不能从 Crossref `journal-article` 单独推断类型；
- 样本种类与规模、对照组、统计方法、效应量、研究局限、是否被撤稿/更正；
- 区分“论文发现”“作者推论”“媒体报道”“对人体的推断”；
- 版权、配图来源、引用许可、中文意译声明及 AI 协助说明；
- 所有成稿保持 `draft`，未经作者明确 `approved` 不进入正式发表。

## 开发验收
- `python3 -m unittest discover -s topic-studio/scripts -p 'test_fetch_science.py' -v`
- `node --check topic-studio/science-discovery.js`
- `node --check topic-studio/editorial-workspace-v4.js`
- `python3 topic-studio/scripts/fetch_science.py`（需真实可用网络）
- 浏览器手动核对：六个发现入口切换、Nature/Science 筛选、DOI 原文链接、重复入池拦截、手机端布局、选题默认 draft、断网时错误提示。
- 合并前测试不能视为生产部署；合并后检查实际线上网址： https://chenzhe223-tech.github.io/topic-studio/ 。

## 下一阶段
P1 补强原论文全文/开放获取许可、撤稿状态与证据等级核查；P2 新增符合 DAVYLAB 规范的科学文章/贴图/视频双轨素材生产；P3 添加内容审批、草稿箱交接和复盘。
