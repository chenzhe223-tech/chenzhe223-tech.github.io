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
