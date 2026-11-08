#!/usr/bin/env python3
"""Production-pipeline integration: audit selected stories, write diagnostics only.

Does not mutate latest.json, archive, posters, or publish eligibility.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from radar.scripts.firecrawl_candidate_audit import audit, history

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "radar/data/latest.json"
OUT = ROOT / "test-results/radar/firecrawl-source-audit.json"

def run(report, today):
    candidates = []
    for section in ("top5", "china_ai_news"):
        for item in report.get(section, []):
            if not isinstance(item, dict):
                continue
            candidates.append({
                "title": item.get("title_zh") or item.get("title") or item.get("title_en"),
                "title_en": item.get("title_en"),
                "url": item.get("source_url") or item.get("url"),
                "published": item.get("published"),
                # Never infer provenance from RSS date or crawl time.
                "published_origin": item.get("published_origin"),
                "source": item.get("source"),
                "section": section,
            })
    records, error = history(today)
    result = audit(candidates, today, records, error)
    result["integration"] = "advisory_only"
    result["summary"] = {s: sum(x["status"] == s for x in result["results"])
                         for s in ("HOLD", "DUPLICATE", "REVIEW_DUPLICATE", "CANDIDATE")}
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--output", type=Path, default=OUT)
    args = parser.parse_args()
    report = json.loads(args.report.read_text(encoding="utf-8"))
    today = report.get("report_date") or dt.datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()
    result = run(report, today)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Firecrawl advisory source audit:", result["summary"], "history_error:", result["history_error"])

if __name__ == "__main__":
    main()
