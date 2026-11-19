# KNOWA P0 QA · 2026-11-19 · v0.4.0

- Original branch: feat/knowa-p0-20261119. No change to main or other Workers.
- Live health GET: HTTP 200 from external browser.
- Live Nobel POST: HTTP 200, 31 birth.place.countryNow=Japan awardees at this verification time (not citizenship).
- Live general POST before fix: HTTP 503 for uncurated question; provider requests lacked Wikimedia policy-compliant User-Agent. Additional endpoint test needed after deployment.
- New code: Wikimedia User-Agent/Api-User-Agent, removed origin=* from server-to-server API requests, detailed safe upstream failure classification, no-results semantics.
- Paid DeepSeek: disabled; no key, strict quota backend or authorized spend. No paid inference performed.
- QA: local mocked tests pass on patched source; CI and live post-deploy acceptance must be verified separately.

- 0.4.1: Normalize entity-focused queries, expose safe sourceDiagnostics to show which provider fails, preserve no-fabrication policy. Real two-source query still needs confirmation.
