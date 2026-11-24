---
name: davylab-finance-engine
description: Shared financial information collection, source verification and API routing for DAVYLAB applications.
---
# Finance Engine P0
Status: bootstrap; not deployed. Do not invent a working endpoint.
## Workflow
1. Resolve company name, exchange and ticker; never assume an ambiguous ticker.
2. Select a permitted source by market and capability. Horizon and existing News Engine are news providers, not authoritative quote providers.
3. Normalize source URL, provider, observation time, currency, exchange, delay status and retrieval time. Unknown delay must remain unknown.
4. Deduplicate news by canonical URL and title. Preserve attribution. Only retain permitted summaries and filing documents.
5. Return explicit unavailable/error status for missing data, never substitute invented prices.
6. Separate factual financial information from AI interpretations; no guaranteed returns.
## Providers
- Horizon: existing radar/scripts/run_horizon.py and radar/data/latest.json; dedicated financial profile is pending.
- News Engine: existing shared news service; verify finance coverage before use.
- AKShare, Yahoo Finance, finance MCPs: candidate adapters only; verify upstream usage rights before enabling.
- Official SEC and exchange/company filings: prioritize official documents, check storage rights.
## Proposed API (not yet live)
GET /api/v1/health
GET /api/v1/news?q=&limit=
GET /api/v1/search?q=
GET /api/v1/quote?symbol=&exchange=
GET /api/v1/history?symbol=&exchange=&range=
GET /api/v1/fundamentals?symbol=&exchange=
GET /api/v1/filings?symbol=&exchange=&years=3
GET /api/v1/fx?base=&quote=
GET /api/v1/metals?symbol=
## Release gates
Provider rights, unit tests, actual upstream smoke, stale/error handling, authorized deployment, KNOWA integration and regression tests. Do not edit FinHub. Keep existing Radar publishing intact.
