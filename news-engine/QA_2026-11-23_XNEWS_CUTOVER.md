# DAVYLAB News Engine → AI Radar XNews replacement · 2026-11-23 acceptance record

## Code and deployed infrastructure
- Isolated News Engine landing: PR #147, merged to main as `c64c16e25473200b0295832da88fc502e6335c5b`.
- Radar overseas-reading cutover: PR #160, merged to main as `a0f4544d3f8b6eea5dda9615177ac1e7210e45b7`.
- Active code reads **five publicly accessible RSS/Atom sources** via `news-engine/collector.py`, ranks candidates using `news-engine/research.py`, filters against Radar historical archives and today's core stories, then presents up to six diverse original-source leads in the previous `xnews_voices` slot.
- XNews feed `xnews.qiaomu.ai` is **no longer the normal source**. `radar/scripts/xnews_sources.py` is retained only as a documented emergency fallback.
- `radar/config/news-engine-xnews.json`: `provider=news_engine`, read-only, no AI inference and no automatic publication. Set `provider=legacy` for a one-file rollback; the daily top5, China news, poster and publishing gates remain unchanged.
- Independent review preview: https://davylab-news-engine-preview.chenzhe223.workers.dev/ ; previously verified HTTPS homepage, editor and read-only Radar status.

## Evidence
- Full branch integration QA: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45112528176 — successful unit, live and browser jobs.
- Full original AI Daily Brief QA: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45112528160 — successful; existing XNews compatibility and other app QA also passed.
- Real RSS news-engine source coverage: 5/5 successful; 48 bounded candidates after ranking and per-source diversity. Using the **real** Radar archive plus existing main news list, the final overseas slot selected 6 leads from 3 different publishers. No news is independently fact-checked merely because the RSS fetch succeeded.
- Browser: Playwright Chromium at 390px and 1440px passes News Engine cards, date-addressed deep reader, original source links, text-only copyright rules and overflow checks. Artifacts retained by run #45112528176.
- Offline: 38 Radar integration, preflight and legacy compatibility tests + 73 News Engine Python tests passed.
- The old XNews root failure was `xnews_status=oversized_feed` in report 2026-11-22, not a GitHub Actions spending limit.

## Production freshness and exclusions
- On the last post-merge repository inspection, `main/radar/data/latest.json` still declared `report_date=2026-11-22`; publication of a **2026-11-23** edition and online poster QA **have not been confirmed**. This is a production release freshness blocker; do not claim a successful current-day publish.
- AI Gateway `davylab-news-engine` exists, authenticated and BYOK-only, logging OFF; no approved credential/model or proven zero-charge inference. No live paid inference has been enabled. Cloudflare Billing subscription lookup was inaccessible (403), so do not invent free plan proof.
- Actual end-to-end consumer API calls to WorldToon and Vibe Studio remain unverified. Do not claim those portions of the original six-day program production complete.
- The remaining 61 historical days without source archives cannot be fabricated; persistent rolling dedupe implementation itself exists.

## Five-level delivery declaration
1. Code Completed — **YES for optional Radar overseas-source replacement**; NOT YES for all AI-content workflows.
2. Build Passed — **YES**, source PR CI full green.
3. Runtime Verified — **YES** for 5-source collection and the standalone review preview; full-day production newsletter has not been reverified.
4. Functional Tested — **YES** for XNews field compatibility, real dedupe, rollback, browser source reading; NO for real model / WorldToon/Vibe integration.
5. Production Deployed — **Merged into main**, but current-day report and poster actual release **NOT VERIFIED**. The old daily publishing system remains authoritative and has not been replaced.

## Final production acceptance — 2026-11-23, 13:58 Asia/Shanghai

**This section supersedes the earlier snapshot's unresolved current-day publishing status; the earlier failure record is retained for audit.**

- Production PR #161: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/161 ; fix merged to main as `bc8b820bb6f24517fd755d768bc5043e3fbe3df0` after the 3-line mountain Skill caption overflow was identified in failed Pages run #45112717241.
- Original 1200×1800 poster and QR gates were **not weakened**; code now selects complete short Skill summary, first complete sentence, or a truthful reference fallback that fits the locked template. Isolated CJK layout QA #45120086036 and original Radar browser QA #45120085954 both **success**.
- Production GitHub Actions https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/45120262963 — **completed/success**. The original mandatory final-image QR and destination gate **PASS**, original browser QA **PASS**, refreshed report committed, and the separate **Verify automatic GitHub Pages deployment** job **success**.
- The actual online HTTPS verification initially detected stale CDN assets, retried, then returned `PASS: automatic Pages deployment verified; date=2026-11-23; global_news=16; china_ai_news=8; generated_at=2026-11-23T13:51:59.775241+08:00`. It checked live bytes against committed latest JSON, poster and historical assets.
- `main/radar/data/latest.json`: `report_date=2026-11-23`, `top5_status=ai_curated`, `top5_count=5`, `china_ai_news_count=8`, `xnews_status=ok`, `xnews_voices_count=6`; **all 6 overseas leads** have `source_kind=news_engine_rss_discovery`. Three publisher sources are present; `quality_gate.status=PASS`.
- `main/radar/posters/latest.json`: 2026-11-23, 1200×1800 PNG, fixed QR target. `main/radar/posters/latest.qr-verification.json`: status **PASS**, `truncated_text_blocks=0` and twelve checks PASS.
- The production scope of **News Engine ↔ AI Radar, replacing XNews overseas reading** is therefore **five-level delivered**: Code Completed / Build Passed / Runtime Verified / Functional Tested / Production Deployed. The optional advanced paid-model AI Gateway and WorldToon/Vibe consumer integrations are explicitly *out of this integration scope* and **not claimed complete**.
- Official live URL: https://chenzhe223-tech.github.io/radar/daily/ . Rollback remains available in `radar/config/news-engine-xnews.json` by changing `provider` to `legacy`.
