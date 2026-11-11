# WORLD/TOON 4.0 · P0–P3 acceptance ledger

**Date:** 2026-11-11  
**Scope:** Product-first unification of the existing comic platform; no destructive data migration.  
**Canonical source:** `comic-studio/workflow-v4.js`, `comic-studio/workflow-v4.css`.

## What changed

- **P0:** Five primary navigation items, seven linked production stages, one project workspace, current work selector, next-best-action guidance, last-verified cloud catalog preserved on sync errors.
- **P1:** DeepSeek configuration status uses an authenticated, read-only `deepseek-status` call. Generation still requires an explicit author action that acknowledges possible charges. Director's approval lock is not invented.
- **P2:** Both ChatGPT-producer and WorkBuddy-producer SOPs remain supported. Imported ZIP uploads resume idempotently; successful upload does not bypass real pilot review, final author approval, GitHub QA, or actual WeChat publish receipt. WorkBuddy's production and publication queues remain independent.
- **P3:** Chapters retain series identity, ordered episode links, style/character continuity references and direct continuation into a new independent project.

Legacy editor, director, handoff, production center, account, and publishing routes remain reachable under **更多工具**. The existing local storage project key is unchanged.

## Runtime delivery architecture

The currently deployed Cloudflare Worker fetches public static resources from the GitHub `comic-studio/` origin, with a restrictive allowlist and a short asset TTL. New canonical v4 code is embedded in already-permitted `worldtoon-v3.js` and `worldtoon-v3.css` assets. Existing `mobile-refine.css` was likewise embedded into `styles.css` to avoid a blocked file path. All 21 static resources referenced by `index.html` were verified against the actual deployed Worker allowlist (21/21 allowed).

`index.html` references cache-revisioned v4 assets and the service worker cache key has been rotated.

## Evidence obtained

- Latest merged JavaScript and prior modules passed syntax checks.
- Direct code-level lifecycle simulation: **22 / 22 assertions pass**, including new/story/author-lock/queued/uploaded/QA/published states, invalid receipt rejection, both production agents, project switching, original data immutability and series links.
- Source integration checks: **19 / 19 pass** at the checked revision.
- Worker static path allowlist comparison: **21 / 21 pass** against the actual script returned by Cloudflare.
- Cloudflare Worker secret binding names were checked (no secret values retrieved or logged).
- Static references were matched against the live Cloudflare Worker path allowlist; all 21 page assets were permitted, including the consolidated mobile stylesheet.
- A genuine production-queue or published-receipt test was not fabricated to force end-to-end acceptance.
- Automated GitHub regression workflow was updated to include `worldtoon-v3-smoke.cjs` and `worldtoon-v4-smoke.cjs`. Both complete smoke scripts were also executed in an isolated V8-compatible test harness, returning `PASS` for both suites. This does not substitute for the separate GitHub Actions runner status.

## Important limitations (NOT accepted yet)

- **GitHub Actions run result:** workflow source is committed, but a completed, successful CI run has not been retrieved.
- **Real browser QA:** production desktop/mobile visual rendering and click-through were not independently exercised in a logged-in browser.
- **DeepSeek real inference:** the server-side secret binding exists; a paid model generation was not invoked in this development pass.
- **Real ZIP → remote SHA256 → GitHub Actions QA → independent final author approval:** cannot be certified without a genuine task delivery and author action.
- **WorkBuddy automatic production and WeChat publication:** no independent end-to-end production/publication receipt was observed in this pass.
- **Published bookshelf:** do not promote content to a verified comic without the required GitHub QA + receipt, even if the shared WeChat archive contains image-post records.

## Acceptance rules

This ledger reports **code and static/simulated QA** only. It does **not** mark Runtime Verified, Functional Tested (end-to-end), Author Approved, WorkBuddy Ready, Published or Archived as complete. No task, model bill, author approval or publication was fabricated.

## Reproducible checks

```bash
node comic-studio/tests/worldtoon-v3-smoke.cjs
node comic-studio/tests/worldtoon-v4-smoke.cjs
```

CI: `.github/workflows/worldtoon-v3-smoke.yml`.

**WORLD/TOON · By DAVYLAB — source-backed progress only.**
