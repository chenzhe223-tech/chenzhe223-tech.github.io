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
