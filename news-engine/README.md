# DAVYLAB News Engine · P0

Independent RSS/Atom discovery module. It does **not** modify AI Radar production publishing or X News.

## Run locally

```bash
python -m unittest discover -s news-engine -p 'test_*.py' -v
python news-engine/collector.py --out news-engine/data/latest.json --history news-engine/data/history.json
```

Five configured feeds: GitHub Blog, Google AI Blog, Hugging Face, Simon Willison, TechCrunch AI. All sources must be verified with a real network run before claiming P0 runtime acceptance.

Features: HTTPS source restriction, bounded XML payload, DOCTYPE/ENTITY rejection, RSS/Atom dates, bounded retries with timeout, source failure isolation, 7-day news freshness, canonical URL and normalized-title deduplication, and a **local JSON history file retaining 90 days of discovery keys**. History is written atomically; malformed history fails closed.

**Important deployment limitation:** history.json is persistent only when the caller provides persistent storage. A fresh GitHub Actions runner will not retain this file automatically. Before production automation, add durable storage or artifact restore with integrity checks. Same-event semantic dedupe and independent fact verification are not implemented yet.

Collected stories are unverified discovery leads, never publishable facts. No automatic publication, paid API, or changes to existing Radar workflows. Do not commit source content without verification and copyright review.

## Acceptance status

- Offline tests: must pass in PR CI.
- Live 5-feed sampling: pending network-enabled execution and evidence.
- Cross-run 90-day persistence: blocked on durable store integration.
- Production deployment: not authorized by P0.


## P1 research triage (2026-11-17)

Run after a separately verified collector output:

```bash
python news-engine/research.py --input news-engine/data/latest.json --out news-engine/data/research.json
python -m unittest discover -s news-engine -p 'test_*.py' -v
```

`research.py` computes a deterministic 0–100 **editorial triage priority**, groups potentially related titles across domains, retains source URLs, and drafts a four-part evidence-checking outline. Two different domains are **not proof of independent confirmation**; all candidates remain `requires_primary_source_and_fact_check`. `gateway_request` only prepares a payload for an existing authorized AI Gateway; it makes no paid/network call and cannot mark an item verified. The P1 output must never be used to publish automatically.

**Production isolation:** No existing `radar/` files, production workflows, poster rules, or publication gates are modified by this branch. The News Engine workflow is independent and has no production deploy job. Integration must remain off by default and require regression checks plus rollback before activation.

**Outstanding acceptance:** Real five-source collection (runner DNS/network), durable cross-run 90-day history, semantic event verification, actual authorized AI Gateway invocation, GitHub CI evidence, and end-to-end runtime QA are pending. Local/offline tests do not establish production readiness.
