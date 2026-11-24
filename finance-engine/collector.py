"""P1 adapter: reuse News Engine collector without writing Radar state."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("shared_news_collector", ROOT / "news-engine" / "collector.py")
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)

def merge_sources(stories, horizon, now):
    """Horizon input must be from a dedicated finance profile, not AI Radar."""
    merged = {}
    titles = set()
    for provider, rows in (("news-engine", stories), ("horizon", horizon)):
        for row in rows:
            if not isinstance(row, dict): continue
            title = str(row.get("title") or "").strip()
            url = shared.canonical_url(row.get("url"))
            stamp = row.get("published_at") or row.get("published")
            try:
                date = dt.datetime.fromisoformat(stamp.replace("Z","+00:00"))
                if not date.tzinfo or not now-dt.timedelta(days=7) <= date <= now+dt.timedelta(minutes=5): continue
            except (AttributeError, ValueError, TypeError): continue
            key = shared.normalized_title(title)
            source = str(row.get("source") or "").strip()
            if not title or not key or not url or not source: continue
            if url in merged:
                if provider not in merged[url]["providers"]: merged[url]["providers"].append(provider)
                continue
            if key in titles: continue
            titles.add(key)
            merged[url] = {"id":hashlib.sha256(url.encode()).hexdigest()[:20],"title":title[:240],"url":url,
                           "source":source[:160],"published_at":date.astimezone(dt.timezone.utc).isoformat(),
                           "providers":[provider],"verification_status":"source_not_independently_verified",
                           "rights_status":"metadata_only_pending_review"}
    return sorted(merged.values(),key=lambda x:x["published_at"],reverse=True)

def run(horizon_path=None, http_get=None, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    registry = json.loads((BASE/"config/sources.json").read_text())
    sources = [s for s in registry["sources"] if s.get("enabled")]
    data,_ = shared.collect(sources=sources,now=now,**({"http_get":http_get} if http_get else {}))
    rows=[]; horizon_status="not_configured"
    if horizon_path:
        try:
            doc=json.loads(Path(horizon_path).read_text())
            if doc.get("profile")!="finance-news" or not isinstance(doc.get("stories"),list):
                raise ValueError("finance profile required")
            rows=doc["stories"]; horizon_status="imported"
        except (OSError,ValueError,AttributeError): horizon_status="invalid_or_unavailable"
    stories=merge_sources(data["stories"],rows,now)
    return {"schema_version":1,"generated_at":now.isoformat(),"stories":stories,
            "diagnostics":data["diagnostics"],"horizon_status":horizon_status,
            "status":"partial" if horizon_status!="imported" or any(x["status"]!="ok" for x in data["diagnostics"]) else "ok"}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--horizon")
    p.add_argument("--out",default=str(BASE/"data/latest.json"))
    args=p.parse_args()
    shared.save_json(Path(args.out),run(args.horizon))
