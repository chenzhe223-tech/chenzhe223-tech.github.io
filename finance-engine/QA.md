# Finance Engine QA

## 2026-11-24
- Local Python unittest: 6/6 passed (test_market.py). Exact Git blob hashes matched connector-fetched files: market.py 99d7738ff98ce69f54945c3b5cd9b6da99193745; twelve_data.py aa74044bdea721a3a10c974b513e6c0e6f609ebf; test_market.py 0ccb36c21c16c4ce668b6da478187c13be145bbc.
- Tests cover OHLCV validity, wrong exchange, nonfinite data, disabled provider and fallback. Fixtures only, not actual market observations.
- Direct git clone unavailable: local DNS cannot resolve github.com. GitHub connector commits succeeded.
- SEC metadata and authenticated WSGI API committed, not yet tested. SEC actual contact, shared rate limiting and caching required before deployment. AKShare and Twelve Data stay disabled pending authorization review. P1 Horizon real runtime, official filing downloads, global market coverage, production deployment and application integration remain incomplete.
- No changes to Radar, KNOWA or FinHub production.

## 2026-11-25 — quota runtime checks
- Executed local Python against quota.py, exact Git blob b4b17bf5861b3bfba2b3b2d4af110ab64a721ce7. 32 concurrent requests (8 threads): exactly 7 allowed, 25 denied, all denied retry=60. Persistence across instances, client isolation and window reset all passed.
- Four direct assertions passed; not the full test_quota.py suite. WSGI HTTP integration and upstream smoke remain unverified. No production changes.
- KNOWA automation get returned action-not-found; retain original requirements from prior task snapshot.
