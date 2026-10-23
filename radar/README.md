# Davy Radar · Daily

Daily AI news, a public GitHub Skill shortlist, and an optional Horizon-powered Chinese AI briefing for DAVYLAB.

## Schedule
GitHub Actions refreshes and publishes the report daily at 23:30 UTC (07:30 Asia/Shanghai), and supports manual workflow dispatch. It collects public RSS news and GitHub Skill data, optionally enriches the report with Horizon/DeepSeek, validates the report date and source freshness, stores a daily archive, deploys GitHub Pages, and then checks the live page and JSON. GitHub may delay scheduled starts during busy periods; 07:30 is the target, not an exact-time guarantee.

## Data pipeline
- `scripts/build_daily.py` collects public RSS feeds and public GitHub repository search results.
- News retains source, timestamp and original URL; AI-related headlines are filtered and deduplicated.
- The Skill list ranks public repositories by stars with a modest freshness adjustment. Stars are not downloads or actual usage.
- `scripts/run_horizon.py` runs the upstream MIT-licensed [Horizon](https://github.com/Thysrael/Horizon) project with DeepSeek, then attaches its Chinese daily digest to `data/latest.json`.
- `config/horizon.json` contains only non-secret runtime configuration. The API key is read from the GitHub Actions secret `DEEPSEEK_API_KEY`; never commit the key itself.
- Horizon webhook, email, and WeChat delivery are disabled. Results are published only to the website; no active notifications are sent.
- If AI analysis fails, the public RSS/GitHub report remains available and the page shows a non-sensitive status message.

## Published data
- Latest report: `data/latest.json`
- Daily snapshots: `data/archive/`
- Horizon runtime summaries: `data/horizon-data/summaries/` (generated in Actions; not required to be committed)
- Public page: https://chenzhe223-tech.github.io/radar/daily/

## Verification
The workflow logs show whether Horizon completed and whether the Chinese summary was attached. Public source links remain the basis for checking claims; model-generated analysis is editorial assistance, not independent verification.


## News Image Match Skill

The daily build runs radar/scripts/news_image_match.py after Horizon selection and before publication. It prefers RSS/article editorial images, then searches Openverse and Wikimedia Commons, followed by relevant public-web image results and a labeled topic illustration fallback. Per-story source, creator, license, landing page and match status are retained. The pipeline also stores an `image_generation_prompt` handoff for agent-based illustration; this is not a generated image. Optional Firecrawl extraction is off by default; it requires the Actions secret `FIRECRAWL_API_KEY` and the Actions variable `RADAR_USE_FIRECRAWL=true`. Use `python radar/scripts/reverse_image_search.py --help` for on-demand Google Lens Pro search. Full project-level skills live under `.agents/skills/`. Skill rules: radar/skills/news-image-match/SKILL.md.


## China AI coverage floor

The China AI module targets 8 stories and publishes up to 10, with a hard minimum of 6. Collection uses multiple Chinese technology news feeds (QbitAI, 机器之心, 极客公园, 36氪, 雷峰网 AI/robotics/chips, 爱范儿 and AI圈报), filters for China-related AI entities and seven-day timestamps, deduplicates identical headlines/URLs, and limits any single publisher to two stories before relaxing the cap. Both daily publishing workflows block publication if fewer than six fresh, source-linked stories are available; they never fill gaps with invented stories or stale items.

## Poster design system and weekly style cycle

The two DAVYLAB reference designs are stored as complete templates: geometric-navy (deep navy technology-editorial) and mountain-editorial (warm-white mountain / cloud-sea magazine style).

The style changes weekly, not daily. radar/scripts/poster_style.py is the single deterministic source of truth. It anchors ISO 2026-W01 to Monday 2025-12-29 and alternates every consecutive Monday-based week, including ISO year boundaries. For example, 2026-10-23 (ISO 2026-W43) uses geometric-navy; the week starting 2026-10-26 (ISO 2026-W44) uses mountain-editorial.

Every daily run generates one complete poster in that week's style, with real story content and locally encoded QR, decodes the QR from the final PNG, checks the canonical URL, and records the ISO year/week, style-cycle index and template version. The build then commits the daily archive and assets, deploys GitHub Pages, and verifies the public report and poster assets. Automated decoding is distinct from physical phone-camera scanning.
