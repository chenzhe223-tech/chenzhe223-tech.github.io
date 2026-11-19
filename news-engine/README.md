# DAVYLAB News Engine · P0–P2 independent preview

**Status (2026-11-19): source collector, persisted history, review-only drafting and local desktop/mobile editor have verified independent tests; no production deployment.** Release evidence and exceptions: [QA_2026-11-19.md](QA_2026-11-19.md).

## Scope and source-of-truth

News Engine is a separate, free-first collector + curation + fact-check preparation + review system. It never replaces the existing DAVYLAB AI Radar production news pipeline while disabled. The official Radar website, daily poster, 08:30 target and visual lock remain untouched. All discovered news is unverified until an editor checks its original sources, published date, numbers and reuse rights.

## Run locally (Python 3.11+)

~~~bash
python -m unittest discover -s news-engine -p 'test_*.py' -v
python news-engine/collector.py --out news-engine/data/latest-shadow.json --history news-engine/data/history-local.json
python news-engine/research.py --input news-engine/data/latest-shadow.json --out news-engine/data/research-shadow.json
~~~

Open news-engine/editor.html in Chrome/Edge. Import a review-only JSON draft to edit title, body, attached image/video/document provenance, preview responsive content and export a new revision JSON file. It works locally without accounts or production writes. Browser E2E runs on Ubuntu 24.04 via open-source Playwright.

### Actual story processing

1. collector.py: five HTTPS sources, bounded retries/response size, safe RSS/Atom, 7-day source freshness, canonical URLs and exact normalized titles; fail-isolated diagnostic results.
2. history_backend.py: independent news-engine-state branch, weekly persisted 90-day keys via GitHub Contents API, conditional SHA writes with merge retry, first-observed timestamps preserved. No state is stored in radar/.
3. backfill_radar.py: read-only import of exact URL/title keys from Radar's existing historical archive manifest (not a substitute for independent factual verification). As of 11/19, archives cover 10/21–11/19 (30 days), 1,767 stored keys; previous 61 days of the 90-day lookback are not backed by available Radar archives.
4. research.py: source-preserving ranking, cross-source cluster candidates and a deterministic four-part research outline, expressly unverified.
5. gateway_client.py: optional OpenAI-compatible research draft adapter. **Needs an approved HTTPS endpoint, exact hostname, secret, model and NEWS_ENGINE_GATEWAY_AUTHORIZED=1.** It does not auto-spend tokens or auto-publish.
6. article.py + studio.py + editor.html: evidence-first human-review drafts, checksums, revision exports, rights-tracked assets and XSS-safe preview. The "verified" input is editorial metadata, not independent automated verification.
7. integration.py: **DAVYLAB_NEWS_ENGINE_ENABLED defaults to 0**. A second approval gate is also mandatory. If an enabled shadow candidate is invalid or the new engine fails, the legacy provider is used. Never returns an automatically publishable draft.

### Independent CI

.github/workflows/news-engine-p0.yml uses separate jobs: offline unit tests, five real-feed smoke, Chromium desktop/mobile editor browser E2E, and PR changed-path production isolation guard. It cannot write Radar production files. The optional durable-history-shadow job runs only on workflow_dispatch and the state branch owns its separate backfill workflow.

**Verified:** [Actions run 44477426540](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/44477426540) — 67 offline Python tests, five live RSS sources (54 unverified leads), editor E2E and production scope isolation all PASS. After the QA-document-only update, [run 44477985715](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/44477985715) was also successful.

**Not accepted:** paid/free AI Gateway live contract is not verified because no approved, demonstrably non-chargeable endpoint/model is accessible for this project. Historical archive coverage before 2026-10-21 is missing, so the prior full 90 days are not backfilled. Production release, external ecosystem integration and rollback on the real site have not been verified.

## Production release rule

Do not merge or deploy this preview as a replacement for Radar until the AI contract is verified without unauthorized spending, all data provenance and copyright quality gates pass, feature-flag/fallback integration receives real end-to-end QA, and the existing website/primary poster publish pipeline remains green. Failed or incomplete runs must preserve the last valid Radar edition.
