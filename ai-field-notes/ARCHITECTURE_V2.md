# AI Field Notes V2 — Free-First Architecture

Updated: 2026-10-29

## Decision

Do not use Supabase for this product. Keep the existing GitHub Pages learning board and DAVY Radar pipeline; use Cloudflare Workers + D1 on the Free plan for the first backend iteration. Avoid any paid plans, paid add-ons, and automatic billing changes without explicit approval.

## Existing and provisioned resources

- Existing V1 page: `/ai-field-notes/index.html` — preserve as the V1 experience until V2 is verified.
- Existing AI briefing data: `/radar/data/latest.json`; public daily view: https://chenzhe223-tech.github.io/radar/daily/
- Free development database: `ai-field-notes-dev`
- D1 database ID: `fd14c318-76ad-4071-ac54-b219f6b28380`
- D1 primary region hint: APAC
- Initial schema migration: `migrations/0001_initial_schema.sql`
- Migrations `0001` through `0006` were applied and verified. The development database contains 9 AI atlas regions, 6 published V1 learning tracks, 6 V1 releases, 6 lessons derived from the existing first-version knowledge content, 28 de-duplicated public DAVY Radar records, and 28 initial source-version snapshots. Markdown line breaks and JSON lesson metadata were checked.
- The Worker `ai-field-notes-api` v0.5.1 is deployed with a D1 binding and its `workers.dev` subdomain enabled at `https://ai-field-notes-api.chenzhe223.workers.dev`. Read endpoints include `/health`, `/api/atlas/regions`, `/api/tracks`, `/api/tracks/:slug/releases`, `/api/releases/:id/lessons`, `/api/lessons/:id`, `/api/search?q=...`, `/api/brief/latest`, and `/api/brief/versions?url=...`.
- A Cloudflare Cron Trigger (`0 * * * *`, hourly) refreshes a versioned D1 index of the public DAVY Radar feed. It records source metadata, refresh jobs, and content-change snapshots; `/api/brief/latest` reads the indexed records and falls back to the public feed if the index is unavailable. `/api/search` performs ranked keyword search across published/free D1 lessons and indexed Radar title/summary/source fields, preserving original source URLs. This is not semantic AI search or full-web search.
- No user or company learning data was imported. No payment integration, authenticated user sessions, cloud progress sync, or automatic creation/publishing of professional lessons is deployed. Only the public briefing metadata index refresh is automated.

## Free-first component map

| Concern | First choice | Notes |
| --- | --- | --- |
| Frontend | Existing GitHub Pages | Keep current URL and UI; do not redesign V1 while building V2. |
| Backend API | Cloudflare Worker (Free) | Server-side validation, authentication, entitlements, content endpoints and usage limits. |
| Database | Cloudflare D1 (Free) | Keep the dev DB isolated; use migrations committed to GitHub. |
| Scheduled content pipeline | Cloudflare Cron Trigger + D1 | Hourly index refresh of public Radar metadata and source-version snapshots is live. Course generation/review/publishing remains a separate future workflow. |
| Course content and release records | D1; larger static lesson assets may remain in Git | Do not store secrets in the repository or public JSON. |
| Knowledge search | Start with indexed keyword/title/tag/content search | Add semantic retrieval only after measuring quality and checking free inference quotas. |
| AI provider | Configurable provider adapter | Never assume model API calls are free. Start with source-grounded search and a strict usage cap. |
| Payment | Separate adapter, not coupled to database | Payment-processing fees, merchant verification and recurring-payment availability depend on the selected provider. Do not activate products until end-to-end tests pass. |

## Versioning rules

1. A published release is immutable. Corrections create a new release label and release row.
2. Learning progress points to exact lesson IDs from the version the learner studied.
3. The board displays latest, archived versions, release notes, publish date and source verification status.
4. A failed update must not replace the latest published release.
5. Keep content checksums and source manifests so releases can be compared and rolled back.
6. Existing V1 local progress remains intact during development. A migration/export tool is required before any local data reset or storage-key change.

## Access rules

- The backend is the authority for private lessons, orders, subscription dates and entitlements.
- Never rely on hiding a button or a client-side `pro` flag to protect paid content.
- Hash opaque session tokens before storing them. Never store provider client secrets, payment secrets, or raw bearer/session tokens in D1, HTML, or Git.
- The initial schema contains scaffolding only; authentication, authorization, billing callbacks and paid content gates are not yet implemented.
- Free content remains readable if AI calls or daily limits are exhausted.

## Automatic update workflow

1. Read Davy Radar's published `radar/data/latest.json` and the approved source allowlist.
2. Deduplicate by canonical URL and title; verify source URL, timestamps, and current validity.
3. Link news/skills to existing tracks; produce a draft only when the information creates a teachable learning outcome.
4. Generate course content with source references, prerequisites, explicit steps, test inputs, expected outputs, failure modes, and a verification checklist.
5. Run checks for missing sources, invalid links, unsupported claims, duplicate lessons, code/example syntax where relevant, and release completeness.
6. Publish low-risk metadata/brief indexes only when all checks pass. Keep expert-level tutorials and major syllabus changes in a review state until manually approved.
7. Create a new immutable release, write an audit event, and retain the previous release for review/rollback.

## Suggested delivery sequence

### V2.1 — Safe foundation
- Keep V1 visually intact.
- Add Worker API bindings and environment secrets.
- Add migration runner/status check.
- Build read-only track/release/lesson APIs and verify no paid content leaks.
- Add V1 progress export/import before cross-device migration.

### V2.2 — Accounts and archive
- Select identity provider and implement OAuth/session validation on the Worker.
- Add authenticated cloud progress, notes, bookmarks, and release history.
- Add per-user read/write checks and abuse/rate controls.

### V2.3 — Briefing and knowledge discovery
- Read the existing Davy Radar JSON without duplicating its ingestion pipeline.
- Add brief-to-track/lesson links, cited source cards, keyword search and related-content retrieval.
- Only add semantic search if the cost-free implementation passes a measured test set.

### V2.4 — Paid entitlements
- Configure product records initially as inactive.
- Choose a payment provider that supports the target market and merchant account.
- Verify payment signatures server-side and make callbacks idempotent.
- Test purchases, refunds, expiry, cancellation and renewal failure before enabling paid content.
- Keep one-time purchase rights separate from subscription rights.

### V2.5 — Automated release workflow
- Implement source collection, draft generation, QA, review, publishing, audit logging and rollback.
- Add usage dashboards and notifications before enabling unattended releases.

## Free-tier guardrails (verify periodically)

Cloudflare's current published Workers Free/D1 quotas include:
- Workers: up to 100,000 requests/day and 10 ms CPU time per invocation.
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage per account and up to 500 MB per database on Free.
- D1 Free has a limit of 10 databases per account. This product uses a separate database and must not share another product's tables.
- Exceeding D1's free daily read/write quota causes queries to fail until the daily reset; it is not a reason to silently enable a paid plan.
- These storage and query quotas are shared at account level. Other DAVYLAB D1 projects consume part of the account-wide storage quota.
- Infrastructure can start at $0/month on the Free plan while within the limits. AI inference, domains, email delivery and payment processing may have separate charges.

## Current status

- [x] Chosen a free-first alternative to Supabase.
- [x] Created the isolated `ai-field-notes-dev` D1 database in APAC.
- [x] Applied and re-checked migrations `0001` through `0008`.
- [x] Seeded and validated twelve atlas regions, six tracks, six published releases and six lessons.
- [x] Deployed Worker API v0.5.1 with D1 binding, live atlas metadata, ranked mixed course/brief keyword search, source-version endpoint and an hourly Cron Trigger.
- [x] Added the V2 front-end integration for live atlas metadata, indexed DAVY Radar cards, source history panels, course + brief search results, and the live version/lesson catalog in the archive page.
- [x] Added local personal-map event history, derived progress metrics, and JSON export/import backup without collecting personal data in the cloud.
- [x] Removed fake first-visit learning progress; new maps start at the camp with knowledge areas unexplored.
- [ ] Complete browser-level runtime smoke tests after refreshing the public preview; the preview tab available during development had loaded an earlier build, and direct network access to the public Worker was unavailable from the validation runtime.
- [ ] Authentication and cross-device sync are not implemented.
- [ ] Semantic/vector search and source-aware search across news and external documents are not implemented.
- [ ] Automated learning-content drafting, review, publishing and rollback are not implemented. Hourly public-brief indexing does not auto-publish course material.
- [ ] Products remain inactive; no payment gateway has been connected.


## Emerging topic queue

Migrations 0009–0010 add a review queue and deduplicated public-source evidence. The hourly Radar refresh proposes topics via explicit keyword rules. It never creates or publishes course bodies. The public read-only candidate API returns only source-grounded candidate metadata and evidence; internal reviewer notes are not exposed. Approval workflows and authenticated reviewer actions remain future work.
