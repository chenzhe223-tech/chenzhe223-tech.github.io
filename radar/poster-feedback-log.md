# Poster Feedback Log

## 2026-11-01 — Approved reference alignment
- Original issue: daily main poster drifted from the user's explicitly approved 2026-10-31 reference poster.
- User requirement: preserve the approved brand, mountain-editorial design language, masthead, hero/title/date hierarchy, five-news grid, insight banner, Skill module and independent QR panel; only daily content and visual assets may change.
- Implemented: added baseline metadata, deterministic style lock, layout specification, typography policy, color tokens and fail-closed QA policy under `radar/config/`.
- Reference screenshot SHA-256: `7ec1b618ff78cf40b8a46c346aff23a80f6dfe11b83b30485546cd5483e406bd` (1086×1448 JPEG, supplied in conversation).
- Website production artifact remains `radar/posters/2026-10-31.png` under existing 1200×1800 contract; WeChat social export remains separate 900×1200. These are different channel outputs and must not be conflated.
- Regression status: configuration created; runtime wiring, full test matrix and production deployment are still pending and must not be reported as complete.


## 2026-11-02 — 配图相关性与来源可信度复核

- 问题：线上日报页面的 AI 推理、Apple Intelligence、OpenAI–ServiceNow 新闻卡片虽通过图片 URL 可访问性检查，但出现人物照片、苹果水果和单一品牌 Logo 等语义错配；其中 Web 搜索图片相关性分数仅为 0.125–0.25。
- 根因：`candidate_relevance` 的实体词命中可绕过相关性分数阈值；`quality_gate.py` 只检查图片可下载、去重和周内复用，没有检查语义相关性。
- 修复：将最低相关性阈值写入并读取 `qa-rules.json`；低分候选自动回退到对应主题配图；软件 Agent 与实体机器人分开分类；主题配图增加“非新闻现场”可见标识；低置信度新闻必须在正文披露独立验证状态；Skill 展示平台兼容性。
- 生产保护：本次修复不改动 2026-10-31 已批准参考图、W45 geometric-navy 风格、网站 1200×1800 画布或微信 900×1200 六图画布。新版本必须通过全套测试和线上复验后才允许覆盖。
- 验收：等待本次修复后的 GitHub Actions 全套工作流、浏览器截图、二维码和线上资产复验；未完成前不宣称修复交付。


## 2026-11-02 — 微信六图包与正式简报数据一致性修复

- 发现：`radar/data/latest.json` 已更新至 09:06，但 `radar/social/2026-11-02/manifest.json` 仍为 08:38；微信贴图文案、新闻顺序和 Skill 数字与正式简报不一致。
- 根因：社交包生成与验证步骤虽执行成功，但 `verify_social_pack.py` 只检查文案是否包含 manifest 中的标题，没有把 manifest 与当前 `latest.json` 的生成时间、SHA256、五条标题/URL及 Skill 记录逐项比对；主分支提交保护只检查 report/poster/QR，未把社交包纳入完整性判断。
- 修复：社交包 manifest 增加 `source_report_generated_at`、`source_report_sha256`、逐图尺寸/文件大小/SHA256/QA 状态；验证脚本强制核对正式报告、五条新闻顺序、来源 URL、Skill 兼容性及低置信度提示；preflight 和提交保护纳入社交包一致性；若主分支报告更新而仅社交包过期，则只按当前主分支报告重生成社交包，禁止回滚报告。
- 验收：等待下一轮完整工作流验证新门禁、六图文件级元数据、ZIP 内容和线上下载结果；当前旧版微信包不得作为最终交付。


## 2026-11-02 — 新闻主张来源归属与原型限定升级

- 新增编辑约束：对“首次/首个/最高/最大/纪录”等绝对表述，必须明确指标口径与日期/范围；研究原型、非正式产品及未量产状态不得被改写成正式产品；基准分数、性能和预测必须明确披露方或测量方。
- 工程门禁：`qa-rules.json` 新增 `claim_provenance.policy_version=2026-11-02.2`；`run_horizon.py` 提示词保留原型限定并区分自报与独立评测；`quality_gate.py` 阻断无日期/指标范围的绝对表述、无来源归属的性能数字及丢失原型限定；`visual_lock.py` 和 preflight 校验政策版本。
- 验收：等待下一轮完整工作流执行新增回归测试并重新生成正式简报、主海报及微信六图包。


## 2026-11-02 — DAVYLAB 趋势判断增加来源依据

- 问题：日报的 `core_zh` 与 `trend_zh` 明确属于 DAVYLAB 观察，但原数据未将分析结论与支撑它的新闻来源建立结构化关联。
- 修复：`run_horizon.py` 为 editorial 写入分析标签、分析范围说明及至少 3 条新闻 `source_basis`；`quality_gate.py` 要求来源 URL 有效且数量达标；日报网页展示可点击依据来源，微信贴图文案明确标注为基于本期公开来源的综合判断。
- 验收：等待下一轮浏览器测试与线上页面验证来源链接展示。


## 2026-11-02 — 五张专题配图取消固定新闻分类配额

- 发现：正式 Top 5 经来源核验后包含 3 条全球动态、0 条中国 AI 动态；旧社交包规则强制要求 2 条全球 + 2 条中国 + 1 张 Skill 图，导致生产失败，也与“某类没有可靠新闻时不得为了凑数编造”的要求冲突。
- 修复：5 张专题配图改为与正式 Top 5 五条新闻逐条、一一对应；分类只按真实 `source_section` 显示，不虚构中国 AI 标签；Skill 继续放在主海报和贴图文案中，因此仍是 1 张主海报 + 5 张新闻专题配图，共 6 张。
- 验收：新增测试覆盖类别缺失时仍保留五条真实新闻；等待完整工作流重新生成并验证六张 PNG、来源映射、文案和线上部署。


## 2026-11-02 — Browser QA 区分公开分析与内部 AI 状态

- 发现：当 Horizon 未完成时，日报保留了基于已核验来源的 DAVYLAB 分析；旧浏览器测试却把整个 `editorialCore` 误判为内部 AI 不可用提示，导致有效的来源分析被错误阻断。
- 修复：浏览器测试改为验证内部 `#aiList` 状态容器保持隐藏，不再要求公开、带来源依据的 DAVYLAB 分析隐藏。
- 验收：等待下一轮桌面与移动端 Playwright 复测。


## 2026-11-02 — 中文本地化与人工编辑兜底门禁

- 发现：GitHub Actions 未配置 `DEEPSEEK_API_KEY`，自动本地化/Top 5 选择不可用；旧流程仍会保留英文 source-fallback，不能作为中文正式简报发布。
- 修复：增加日期限定的 `radar/data/manual-editorial/YYYY-MM-DD.json` 人工编辑稿机制；本期 5 条新闻逐条核验来源、日期与限定条件，人工完成中文标题、事实摘要和意义分析，并明确标记 `manual_editorial_verified` / `editorial_curated`，不冒称 AI 生成。
- 门禁：质量门禁要求五条新闻均具备中文标题、事实摘要和意义说明；无 DeepSeek API 且无当日人工编辑稿时，阻断发布并保留上一有效版本。
- 后续：若要恢复全自动中文选题与本地化，需要在 GitHub Actions Secrets 配置 `DEEPSEEK_API_KEY`；本期人工稿不替代后续日期的自动化密钥配置。


## 2026-11-02 — 人工编辑稿来源与 Skill 元数据复核

- 对 2026-11-02 人工编辑稿补充了机器人赛事的明确年份和赛道数据口径，避免“首届”表述缺少日期/指标范围。
- 修复人工 Skill 覆盖逻辑：仅覆盖展示文案与已核验字段，同时保留 Skill Radar 原始 canonical ID、证据 URL、核验时间、质量状态、评分和实际 SKILL.md 扫描记录，防止人工文案覆盖丢失质量证据。
- 复测要求：质量门禁必须同时通过新闻来源、中文本地化、Skill 证据与图片相关性检查。


## 2026-11-02 — 缺少 DeepSeek Key 时跳过可选 Horizon 安装

- 发现：当 `DEEPSEEK_API_KEY` 缺失时，Horizon 克隆、依赖安装和模型调用仍会占用数分钟，但不会产生可用的 AI 本地化结果。
- 修复：诊断步骤输出是否配置密钥；只有密钥存在时才运行 Horizon。密钥缺失时直接进入日期限定人工编辑稿或 fail-closed 质量门禁，不再等待无效的可选步骤。


## 2026-11-02 — 主海报截断 P0 与贴图文案精简

- 发现：1200×1800 网站主海报的布局元数据记录到 6 个截断文本块，但旧验收仅统计数量，没有阻断发布；这不符合“不得截断”的要求。
- 修复：主海报改用独立短摘要和短观察字段，保留五条新闻、Skill、二维码与原有版式层级；`verify_poster.py` 现在将任何截断文本块视为失败，并新增回归测试。
- 文案：贴图文案改为优先使用独立社交摘要，保留完整正式简报内容；主标题读取 DAVYLAB 编辑标题，按真实覆盖范围生成开场句，Skill 说明避免重复标点并明确未实测安装/未做独立安全审计。


## 2026-11-02 — GitHub Actions 条件表达式显式化

- 将可选 Horizon 步骤的 `if` 条件改为显式 `${{ ... }}` 表达式，避免工作流解析歧义；密钥缺失时跳过 Horizon，直接执行当日人工编辑稿与质量门禁。


## 2026-11-02 — 发布预检增加截断与贴图文案一致性阻断

- 预检、候选版本与线上复验均要求主海报 `truncated_text_blocks == 0`；旧海报即使二维码正确，也不能因截断文本而被跳过或发布。
- 贴图文案验收新增主标题必须等于正式编辑标题、五条新闻必须使用各自核准的短摘要；避免正式简报、海报和微信文案出现不同口径。


## 2026-11-02 — 微信六图全部纳入零截断门禁

- 复核发现：900×1200 微信主海报和两张专题图也存在被旧 QA 统计但未阻断的截断文本。
- 修复：微信主海报使用独立短摘要，专题图使用经编辑的社交摘要；Skill 区域使用短版说明。`verify_social_pack.py` 现在对六张图任一截断直接失败，并新增回归测试；发布预检要求 `social_images_have_no_truncated_text`。


## 2026-11-02 — Top 5 来源在栏目去重后保留审计引用

- 发现：Top 5 与中国 AI 栏目去重后，部分新闻的原始 URL 不再出现在展示列表，导致来源回溯测试误判为无来源。
- 修复：`cross_section_dedupe.top5_source_references` 单独保留 Top 5 的原始来源、日期、栏目和补充来源；中国 AI 栏目仍不重复展示，测试同时校验来源引用记录。


## 2026-11-02 — 最新代码优先的并发策略

- 将 Radar 日更工作流的 `cancel-in-progress` 设为 `true`，新提交到达时取消过期运行，避免旧版测试结果或旧版配置阻塞最新修复后的正式验收。


## 2026-11-02 — 主海报底部两栏摘要二次收紧

- P0 截断门禁定位到网站主海报底部两条新闻摘要超出两行限制；进一步缩短 ServiceNow 与 Datasette 的 poster-only 摘要，不改正式新闻正文和微信长文案。


## 2026-11-02 — 线上复验改为读取已提交的来源证据

- 发现：主生产工作流已通过完整来源核验，但线上复验错误地读取未随 `latest.json` 持久化的 `quality_gate.claims` 子对象，造成候选包误报失败。
- 修复：候选、提交保护和线上复验统一读取已提交报告中的五条 Top 5 `source_url`、来源名称、发布日期及 DAVYLAB `source_basis`，并继续要求 claim-provenance policy 版本与总质量门禁 PASS。

## 2026-11-04 — Daily production brief and visual lock

- 今日人工编辑基线最终版本位于 `radar/data/manual-editorial/2026-11-04.json`：五条新闻核对 MIT CSAIL 研究者原始博客、Reuters、Anthropic 官方研究、Soniox 官方公告（并参考 MarkTechPost）及澎湃新闻；企业自报能力、早期研究和原型限制均保留限定。较早提交中记录的 IT之家、36氪、TechCrunch、Kimi 与 SEC 来源清单已被后续编辑稿替换，不作为本期最终来源。
- 按 `poster_style.py::poster_style_metadata` 的 ISO 周轮换算法，2026-11-04 属于 ISO 2026-W45，风格为 `geometric-navy`；本周重试必须固定此风格。
- 当前社交图片生产已停用：本日只允许生成网站正式主海报 `1200×1800 PNG`。历史记录中关于 900×1200 微信六图、专题配图和 ZIP 的条目仅保留为历史，不再属于当前生产输出或门禁。
- 本记录提交用于启动本日正式生产工作流；记录时尚未取得本日生成、二维码、浏览器 QA 或线上部署证据。未通过 P0 前不得覆盖上一有效线上版本或宣称完成。


### 2026-11-04 — Production repair round 1: geometric Skill description

- Run: `41743270512` (commit `1027be353cbf9145f23c6232c9dec46972279b5d`).
- Evidence before poster gate: Skill Radar selected 9 verified Skills from 214 candidates; seven-day history coverage was complete; image/claim quality gate PASS; all 13 current story images passed relevance and freshness checks; W45 ISO style resolved to `geometric-navy`; renderer created a 1200×1800 PNG.
- P0 failure: final-poster verifier found one truncated Skill description paragraph at `x=82,y=1434,width=550`; the original 15px/3-line block clipped the final text. The final-image QR/deployment gate stopped the workflow. No candidate report, poster, or QR manifest was committed; the previous published version remains protected.
- Repair: keep the same geometric-navy design and region order; render the full Skill description at 13px (the configured minimum body size) in a 565px-wide, four-line reserved area, leaving the existing topics row and QR panel in place. Added a regression test proving the four-line block fits before the topics row without truncation.
- Retest status at this commit: code/test change committed; complete production, QR, desktop/mobile and deployment retest pending the next Actions run. No production success is claimed yet.


## 2026-11-05 — Daily source review and production kickoff

- Prepared the date-scoped editorial source file: `radar/data/manual-editorial/2026-11-05.json`.
- Five reviewed items: Apple China developer beta (Apple newsroom, announcement dated 2026-10-31; beta began 2026-11-04); OCC bank-AI examiner guidance (Reuters, 2026-11-04; explicitly nonbinding); India's I4C warning on AI-agent-assisted financial cyberattacks (Reuters, 2026-11-04); Chinese financial-regulator remarks on AI-investment concentration (Reuters, 2026-11-03); and an arXiv preprint on Agent Skill evolution (2026-11-03; not peer reviewed).
- Checked the accessible 2026-10-29 through 2026-11-04 archive reports; the five selected event/source records were not present in the prior seven-day news pools. Repeated Tencent Hy4 coverage from 2026-11-04 was deliberately not promoted again.
- The source file records the exact source URLs, publication dates, Chinese/English summaries, limitations and DAVYLAB analysis. It does not override the automatic Skill Radar list.
- Production state at kickoff: editorial source review complete; daily RSS collection, Skill selection, data quality gate, poster rendering, QR verification, deployment and live QA are pending. No production success is claimed by this record.
- Website poster target remains 1200×1800 PNG only. ISO 2026-W45 must use the deterministic `poster_style_metadata` result; WeChat six-image and social ZIP outputs remain disabled.


## 2026-11-05 — P0 gate failure and verified-image fallback repair

- First production attempt: run `41935297547` reached the historical news/image freshness gate but correctly blocked publication. No report, poster or QR bundle was deployed.
- The gate found zero historical news duplicates, zero China-news duplicates, zero same-ISO-week image reuse and zero Skill errors (9 recommendations; seven-day history complete). It found two image issues: one unavailable Unsplash topic image and one same-day duplicate image fingerprint. It also flagged the OCC headline's inherited “first-ever” wording because the claim did not carry an explicit year/metric scope.
- Repair: keep the gate fail-closed, but permit a declared `image_fallback_url` only when it independently passes URL, download, SHA-256/perceptual duplicate and topic-label checks. If the fallback also fails, publication remains blocked. Add regression tests for unavailable, duplicate and low-relevance primary images.
- Editorial repair: replace the OCC original-title wording with a neutral title; the underlying Reuters story remains attributed and the guidance's nonbinding status remains explicit.
- Current status: repair code and regression tests are prepared for the next production attempt; no successful publication is claimed.
