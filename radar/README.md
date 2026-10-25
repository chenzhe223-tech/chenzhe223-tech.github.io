# Davy Radar · Daily

Daily AI news, a public GitHub Skill shortlist, and an optional Horizon-powered Chinese AI briefing for DAVYLAB.

## Schedule
GitHub Actions refreshes and publishes the report daily starting at 21:30 UTC (05:30 Asia/Shanghai), and supports manual workflow dispatch. Recovery runs are scheduled at 22:15, 23:00 and 23:45 UTC (06:15, 07:00 and 07:45 Beijing time) if a complete AI-curated report is still missing. It collects public RSS news and GitHub Skill data, optionally enriches the report with Horizon/DeepSeek, validates the report date and source freshness, stores a daily archive, deploys GitHub Pages, and then checks the live page and JSON. GitHub may delay scheduled starts during busy periods; 05:30 is the target, not an exact-time guarantee.

## Data pipeline
- `scripts/build_daily.py` collects public RSS feeds and public GitHub repository search results.
- News retains source, timestamp and original URL; AI-related headlines are filtered and deduplicated.
- The Skill list ranks public repositories by stars with a modest freshness adjustment. Stars are not downloads or actual usage. Routine recommendations avoid repeating the same repository within seven days unless a material update is verified; older projects may return after that cooling-off period.
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

## One-click Skill collection to KeyPocket

Each Skill recommendation card and the featured Skill include a separate 「一键收录到 KeyPocket」 action linking to https://chenzhe223-tech.github.io/keypocket/. Before navigation, the daily page places the public repository URL, name, short description, topics, license, observed Stars, update date and report date in the same-origin browser `localStorage` queue (`kp.radar.pending-skills.v1`). No API keys or access tokens are sent. KeyPocket validates the repository URL, requires vault unlock and explicit confirmation, deduplicates by repository URL, encrypts the project metadata using its existing local vault, and removes the queued item after a successful save or explicit ignore. This is a same-browser handoff, not cloud sync or automatic Skill installation; if browser storage is blocked, the link is cancelled and the page shows an error.


## News Image Match Skill

The daily build runs radar/scripts/news_image_match.py after Horizon selection and before publication. It prefers RSS/article editorial images, then searches Openverse and Wikimedia Commons, followed by relevant public-web image results and a labeled topic illustration fallback. Per-story source, creator, license, landing page and match status are retained. The pipeline also stores an `image_generation_prompt` handoff for agent-based illustration; this is not a generated image. Optional Firecrawl extraction is off by default; it requires the Actions secret `FIRECRAWL_API_KEY` and the Actions variable `RADAR_USE_FIRECRAWL=true`. Use `python radar/scripts/reverse_image_search.py --help` for on-demand Google Lens Pro search. Full project-level skills live under `.agents/skills/`. Skill rules: radar/skills/news-image-match/SKILL.md.


## China AI coverage floor

The China AI module targets 8 stories and publishes up to 10, with a hard minimum of 6. Collection uses multiple Chinese technology news feeds (QbitAI, 机器之心, 极客公园, 36氪, 雷峰网 AI/robotics/chips, 爱范儿 and AI圈报), filters for China-related AI entities and seven-day timestamps, deduplicates identical headlines/URLs, and limits any single publisher to two stories before relaxing the cap. Both daily publishing workflows block publication if fewer than six fresh, source-linked stories are available; they never fill gaps with invented stories or stale items.

## Poster design system and weekly style cycle

The two DAVYLAB reference designs are stored as complete templates: geometric-navy (deep navy technology-editorial) and mountain-editorial (warm-white mountain / cloud-sea magazine style).

The style changes weekly, not daily. radar/scripts/poster_style.py is the single deterministic source of truth. It anchors ISO 2026-W01 to Monday 2025-12-29 and alternates every consecutive Monday-based week, including ISO year boundaries. For example, 2026-10-23 (ISO 2026-W43) uses geometric-navy; the week starting 2026-10-26 (ISO 2026-W44) uses mountain-editorial.

Every daily run generates one complete poster in that week's style, with real story content and locally encoded QR, decodes the QR from the final PNG, checks the canonical URL, and records the ISO year/week, style-cycle index and template version. The build then commits the daily archive and assets, deploys GitHub Pages, and verifies the public report and poster assets. Automated decoding is distinct from physical phone-camera scanning.


Topic fallback images are visibly labeled 「主题插画 · 非新闻现场」 in the final poster. The poster template version is 2.1.0; production preflight requires the manifest template version to match the code so template changes trigger a fresh generation.

## Concurrent recovery runs and monotonic publishing

Daily schedule/recovery runs may overlap in queue time. Before committing, each run snapshots its output, syncs the latest `main`, and compares its `generated_at` with the current branch. A run must not replace a coherent same-day report/poster/QR bundle whose report timestamp is newer or equal to its snapshot. Preflight checks date, AI-curated five-story state, localization status, current-week style metadata, the first Skill name across report/poster, poster generation time, and the PASS QR record. This preserves the newest complete daily bundle if an older queued run finishes later.

## Daily social share copy

- Every daily social post must include the stable public brief URL: https://chenzhe223-tech.github.io/radar/daily/.
- Keep weekday copy concise and useful; on weekends prefer a relaxed, upbeat tone with a small touch of humor rather than urgency or work-pressure language.
- Posters must encode the exact stable public brief URL in a real QR code. The final dated poster and `latest.png` must both be decoded and checked against that URL before sharing; never publish placeholder QR artwork or temporary URLs.
- Clearly distinguish verified reporting from editorial interpretation, and only recommend a Skill after checking its public repository, actual Skill file, and license evidence.
