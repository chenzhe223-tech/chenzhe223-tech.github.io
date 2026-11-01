# Poster Feedback Log

## 2026-11-01 — Approved reference alignment
- Original issue: daily main poster drifted from the user's explicitly approved 2026-10-31 reference poster.
- User requirement: preserve the approved brand, mountain-editorial design language, masthead, hero/title/date hierarchy, five-news grid, insight banner, Skill module and independent QR panel; only daily content and visual assets may change.
- Implemented: added baseline metadata, deterministic style lock, layout specification, typography policy, color tokens and fail-closed QA policy under `radar/config/`.
- Reference screenshot SHA-256: `7ec1b618ff78cf40b8a46c346aff23a80f6dfe11b83b30485546cd5483e406bd` (1086×1448 JPEG, supplied in conversation).
- Website production artifact remains `radar/posters/2026-10-31.png` under existing 1200×1800 contract; WeChat social export remains separate 900×1200. These are different channel outputs and must not be conflated.
- Regression status: configuration created; runtime wiring, full test matrix and production deployment are still pending and must not be reported as complete.
