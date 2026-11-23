# DAVYLAB News Engine · Public API P0

**Status:** implementation branch, read-only public published-data API. Live deployment and real HTTPS smoke must pass before using this as a production dependency.

## Design boundaries

- Isolated Cloudflare Worker `davylab-news-api`. **Never repurposes** the Radar production website, existing `davylab-news-engine-preview` editor or any other app.
- Server fetches only two hardcoded official HTTPS origins for the **latest quality-approved AI Radar report** (`radar/data/latest.json`). This makes existing News Engine overseas discovery available across platforms, while also offering Top 5, China AI, other global stories.
- **NOT** live internet searching, historic full-text indexing, a separate news crawler, independent fact checking, model-generated research or a publishing service. In P0, search searches **only the latest published issue**.
- Every response contains `publishable:false`, and normalized stories contain `verification_status:"requires_independent_fact_check"` and original links. No copies of complete articles or publisher images, no model calls, secret credentials, D1, paid KV or cron tasks.
- Public data can be read cross-origin (CORS `*`). No private sources or write endpoints are allowed. For restricted future personal/customer data, separate authenticated API and provider-specific access controls must be designed.

## API base

`https://davylab-news-api.chenzhe223.workers.dev`

| Endpoint | Example | Description |
| --- | --- | --- |
| `GET /api/v1/health` | `/api/v1/health` | Upstream approval, current published issue date, source freshness and API capability flags |
| `GET /api/v1/news` | `/api/v1/news?stream=overseas&limit=6` | Published news list; streams: `top5`, `china`, `overseas`, `more`, `all` (default) |
| `GET /api/v1/search` | `/api/v1/search?q=NVIDIA` | Literal case-insensitive search within indexed issue; q at least two characters |
| `GET /api/v1/topics` | `/api/v1/topics?limit=10` | Deterministic topic ideas based on published headlines and original-source ranking |
| `GET /api/v1/openapi.json` | `/api/v1/openapi.json` | Machine-readable API entrypoint summary |

Parameters on `news` and `search`: `stream`, `region=all|china|global`, `source` (substring), `q` (literal substring), `limit` (1–50), `offset` (0–200); limits clamp to max. `topics` accepts `stream` and `limit` (max 30). All routes are GET/HEAD/OPTIONS; methods that write return HTTP 405. Invalid query is HTTP 400, missing path HTTP 404, unavailable or failing quality gate is HTTP 503 (fail-closed).

News results include `title`, `title_original`, `summary`, `source`, `source_url`, `published_at`, `issue_date`, `stream`, `region`, `relevance_score`, `ranking_basis`, `verification_status`, `content_rights`, `publishable`, `external_copy_allowed`. The API does not redistribute unlicensed article images.

For freshness, inspect `issue_date` and `is_today`; `/health` says `stale_issue` when the last published date is not today in Asia/Shanghai. A successfully retrieved stale edition is still served with **explicit** age metadata, not silently represented as a fresh crawl.

## Consumer example

```js
const API = "https://davylab-news-api.chenzhe223.workers.dev";
const response = await fetch(API + "/api/v1/news?stream=overseas&limit=6");
if (!response.ok) throw new Error("News API unavailable");
const payload = await response.json();
if (!payload.is_today) console.warn("Latest published issue is older than today");
const items = payload.data; // source-linked, NOT fact-checked or publishable
```

For WorldToon / Vibe Studio, pass each item through the existing evidence and rights/role review workflow to construct a creation brief. For KNOWA/WeChat, use `/topics` as candidates and verify all original papers and reporting before creating knowledge content. No automatic article/video/comic publishing has been authorized.

## Deployment and verification

The current `news-engine/public-api-worker.mjs` is an independent single-file module Worker. Deploy only to the new Worker name `davylab-news-api`; do not modify the existing production `radar/` workflow or preview Worker.

Required gates:
1. `node --check news-engine/public-api-worker.mjs`
2. `node news-engine/test_public_api.cjs` (fake feed only; method/input/permission/rights/stale/fallback contracts)
3. GitHub Runner real upstream HTTPS check and published report validation.
4. Publish new isolated Worker to `workers.dev` with **no bindings**, CORS public read-only, zero AI calls.
5. `node news-engine/test_public_api_online.cjs` from GitHub Runner against live deployed worker; verify dates, quality, response shape, origin and denied writes.
6. Preserve existing AI Radar all regressions and keep separate CDN source.

No persistent cache/database, API key, recurring crawler, billing activation or additional connected platform integrations are created by this P0. Later phases may add indexed history, a read-only internal service token and event-based updates when explicitly planned and tested.

## Rollback

Since this Worker does **not** replace any existing Radar endpoint, failure requires no production Radar rollback. Consumers may fail open to their previous news source; do not represent it as real-time News Engine data. Disable the new Worker's `workers.dev` route (or revert its last deployment) if necessary; existing Radar and existing preview Worker remain untouched.
