# DAVYLAB News Engine · P0

Independent, dependency-free RSS/Atom discovery module. This is a new engine; it does not change existing AI Radar publishing or the X News adapter.

## Run

```bash
python -m unittest discover -s news-engine -p 'test_*.py' -v
python news-engine/collector.py --out news-engine/data/latest.json
```

P0 discovery only: 5 public sources, HTTPS URLs, bounded response size, XML DOCTYPE rejection, 7-day freshness, URL-based dedupe, per-source failure isolation, structured JSON and explicit provenance. News is **not independently verified** and is **not auto-published**. Source metadata is not a license to republish complete articles.

Acceptance: unit tests pass; real fetch run produces diagnosable results; manual source review before writing; no regression to Radar. Next: source adapters, 90-day dedupe, evidence checks, AI editorial workflow, human approval and optional publication.
