# WORLD/TOON Discovery v2 — Cache-first newsroom

## Why
Previously `#/live` re-fetched Google News/RSS/GDELT, Hacker News, arXiv, Gutenberg and Wikidata **on every source/category change**, returned no data on failure, and mistakenly filtered the `all` source against category `经典故事` even though `all` did not include evergreen feeds.

## Live architecture
- `GET /api/comic/catalog?source=all&limit=250` reads **D1 materialized snapshots only**; it does not make external HTTP requests.
- Cloudflare Worker `scheduled()` runs with `*/30 * * * *` UTC: news every 30 minutes; HN and arXiv hourly; classics and history daily at 02:00 UTC. **First invocation fills all missing sources**.
- D1 table `wt_discovery_snapshots` is isolated from existing `usage_counts`. Migration: `comic-studio/migrations/0001_discovery_snapshots.sql`.
- Each source is refreshed independently. On 4xx, invalid, zero-result, or upstream outage, **do not overwrite the last successful payload**. Store a `last_error` status and show previously saved content.
- Browser loads all five snapshots once, renders selected category/source locally, keeps a localStorage copy for outages and limits visible cards to 12 initially.
- Historic/literary research remains unverified and may require jurisdiction/translation copyright checks. No LLM model scoring, no paid image inference and no auto-publication.
- `GET /api/comic/discover` remains a backwards-compatible *manual live diagnostics endpoint* but is no longer used by the UI.
- New 6-source editorial navigation and `今日值得画` show candidates **already returned by the catalog**, ranked by the published rule-based score. No simulated stories.

## Rollout
1. Apply D1 migration (non-destructive).
2. Merge code after static CI and D1 mocked unit test.
3. Upload Worker while **strictly inheriting** D1, private GitHub token, AI binding and `AI_ENABLED=false`.
4. Configure cron trigger; confirm schedule. On first cron, validate D1 row counts and live `/api/comic/catalog`; do not claim immediate readiness before real writes.
5. Validate representative source/category filters and mobile viewport; if a source is missing, show the initializing state without falling back to live scrape.

## Performance metric
- Target: category/source chip switching = entirely local filter, no network call; the browser may take longer than 300ms on an underpowered device and needs actual device profiling.
- Target: latest catalog fetched from D1 in one HTTP request; response latency measured in GitHub live checks.
- Last successful sources remain usable even when a specific source reports `last_error`.

Status distinction: code completed / CI passed / runtime verified / functional tested / production deployed.
