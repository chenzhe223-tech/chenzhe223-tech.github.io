# WORLD/TOON / Discovery editorial expansion v3 (2026-11-11)

## Scope and facts
Production: https://worldtoon.chenzhe223.workers.dev/#/live
Existing WorldToon site and Cloudflare Worker; no new app, no paid model, no unlicensed text reproduction.

Eight sources in D1:
- **news** (global events), **hackernews**, **arxiv**, **classics** (Gutendex), **history** (Wikidata)
- **literary_series** — 14 original serialized-story plans linked to individual Project Gutenberg book records.
- **nobel_literature** — 7 editorial study leads with NobelPrize.org official literature links; *the prize and source attribution do NOT grant permission to adapt a modern copyrighted work*.
- **academic_events** — 10 event leads linked to the Royal Society, NeurIPS, ICLR, Lindau organizers. Event end dates filter out concluded meetings, including when D1 holds an older successful snapshot.

First editorial batch: `comic-studio/editorial-series.json`, date of editorial curation 2026-11-11. This is a source-linked **curated set, not an automatically expanding web crawler**. The existing Worker cron refreshes the stored source manifest, every 30 minutes invoking the corresponding due periods. To add new conference events or literature works, update and review the manifest; it then enters the same cache pipeline. Once a source refresh fails, the previous successful snapshot remains visible with an error warning.

Each curated item has origin URL, rights status, title, three or more original storyboard beats and planned episodic structure. No protected original fiction or book excerpt is embedded. Nobelist works require separate rights clearance before commercial adaptation. Science stories cannot represent hypotheses or conference abstracts as established results.

## Scoring

Six metric values shown; overall score weights from requested WorldToon rubric: `heat 32% + impact 36% + drawability 32%`. Conflict, novelty and traceability remain diagnostics. The score engine version is `1.3.0`, methods `rule_estimate`, `evergreen_rule_estimate`, `event_rule_estimate`. Scores are **editorial estimates** of cartoon potential, not real internet popularity, neural-model grading, source verification or copyright approval. Under-60 cards remain filtered by default. Evidence-bearing three-episode outlines and source-specific editorial metadata help illustrate eligible high-quality comic series instead of artificially increasing all existing records.

## Real deployment and evidence

- Current Workers script version: `0a0585c0-2613-4210-bfcb-6f1fbccae42d`, deployment `969d7359-3810-4c30-bc5e-85e0c9ad5e03`, all 5 existing Cloudflare bindings preserved, AI paid image generation disabled.
- Initial D1 staging was non-destructive `INSERT OR IGNORE` for the **three new** sources. Verified rows: literature 14, Nobel 7, academic 10, last_success `2026-11-11T04:05:04.171Z`. Existing 5 snapshots untouched.
- `GET /api/comic/catalog?source=all&limit=500`: real result on 2026-11-11 = **233 URL-deduplicated cards** across all eight sources, 31 new curated entries, all three categories available in combined pool and independently filtered source tabs.
- New-series rule pre-scores: 29 / 31 ≥70, 24 / 31 ≥80 (do not call these verified public-interest ratings).
- Production Chromium acceptance: phone 390px and desktop 1440px, 9 source tabs, 3 new source tabs each navigable and populated, series top panel visible, no horizontal overflow.
- Real upstream refresh proof: `/api/comic/discover?source=literary_series` returned 14; `nobel_literature` returned 7; `academic_events` returned 10.
- Existing regression and new offline tests: GitHub Actions `42956501569`; live refresh/browser: `42958047502`; legacy live smoke after schema migration: `42957633130`.

## Honest limits
- This first wave is **not** ongoing automatic discovery of new Nobel books or future meetings. Updating the file with newly sourced/verified leads is required.
- Some official conference details can change; date and registration status must be checked against organizer pages before publication.
- All modern literary works are discoverable for editorial research only, not approved commercial adaptations. For public-domain books, review jurisdiction, original editions, translations, images and character adaptations separately.
- A high score does not satisfy the source facts, rights or nine-panel image production acceptance gates.
