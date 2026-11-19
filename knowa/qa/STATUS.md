# KNOWA P0 QA · 2026-11-19 · v0.3.0

## Five delivery gates

1. **Code Completed — YES**: Incremental fix on original `knowa/`, no reimplementation, no changes to main.
2. **Build Passed — YES**: GitHub Actions run 44475060643 passed all 19 tests, Node syntax validation, reproducible build and bundled-file parity.
3. **Runtime Verified — PARTIAL**: Cloudflare deployment and workers.dev subdomain enabled, but this environment could not independently retrieve a real HTTP response from public URL. Local Chromium Playwright viewport checks passed at 1440×900 and 390×844; nine cards, no horizontal overflow.
4. **Functional Tested — PARTIAL**: GitHub CI mock integration passed 19 tests (Nobel complete pagination, 601 records across pages, duplicates, inconsistent totals, nationality/birthplace split, sourced curated facts). In local Playwright, the nationality warning, suggested-question click and original source links passed for desktop/mobile using mocked network responses. Live Nobel/Wikipedia/Wikidata feeds and production browser requests are NOT verified.
5. **Production Deployed — CONFIRMED, acceptance still PENDING**: Isolated Cloudflare Worker `davylab-knowa-p0` deployment `7b6562a8-ec25-4214-a466-bdcbb7b0d895`, version `4ff806b3-0b64-4cd4-9636-8917e785b3a8` has 100% traffic at 2026-11-19 06:51:18Z.

## Security and cost controls

- Cloudflare deployment explicitly sets `AI_ENABLED=false` and `DAILY_AI_LIMIT=0`. No DeepSeek model billing enabled or API key uploaded.
- Nobel official data is read in full (up to 3000 laureates) and filtered by `birth.place.countryNow`. The result is NOT a measure of citizenship.
- Incomplete official page, missing ID or duplicate awardee IDs fail closed rather than returning a false count.
- Main GitHub branch and all other Cloudflare Workers untouched.

## Outstanding live acceptance (P0)

- External GET `/api/health` HTTP 200 (unavailable in current tool environment).
- External POST `/api/ask` with real Nobel results; match official live records, verify all pages.
- Verify Wikipedia / Wikidata source degradation and original links.
- Windows Edge and iPhone Safari live browser review for homepage and references.
- Paid DeepSeek only after explicit user approval and atomic spending/quota gate.

Final CI after aligning Wrangler name and zero-spend defaults: run 44475629776 — success.
