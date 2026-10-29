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
- The migration was applied and verified. It created the core tables for users/identities/sessions, tracks/releases/lessons, user progress/notes/bookmarks, sources and source-to-lesson links, products/orders/entitlements, usage metering, refresh jobs, audit events, and schema migration tracking.
- No user or company learning data was imported. No payment integration or public API was deployed.

## Free-first component map

| Concern | First choice | Notes |
| --- | --- | --- |
| Frontend | Existing GitHub Pages | Keep current URL and UI; do not redesign V1 while building V2. |
| Backend API | Cloudflare Worker (Free) | Server-side validation, authentication, entitlements, content endpoints and usage limits. |
| Database | Cloudflare D1 (Free) | Keep the dev DB isolated; use migrations committed to GitHub. |
| Scheduled content pipeline | Existing GitHub Actions + a new V2 workflow | Reuse public brief JSON; validate and create draft releases before publishing. |
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
- [x] Committed and applied the initial schema migration.
- [x] Verified the migration record and created tables.
- [ ] Worker API is not deployed.
- [ ] Authentication and cross-device sync are not implemented.
- [ ] Davy Radar is not yet wired to V2 APIs.
- [ ] Knowledge search and automated learning-content releases are not implemented.
- [ ] Products remain inactive; no payment gateway has been connected.
