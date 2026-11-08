#!/usr/bin/env python3
"""Read-only Firecrawl candidate audit. Never publishes or modifies radar data.

Usage:
  python radar/scripts/firecrawl_candidate_audit.py --input candidates.json --date 2026-11-08
Input: JSON array of {title,url,published,source} objects.
"""
import argparse
import datetime as dt
import json
import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / "radar/data/archive"
SECTIONS = ("news", "top5", "china_ai_news", "china_news", "top_news", "selected_news")

def url_key(url):
    p = urllib.parse.urlsplit(str(url or "").strip())
    if p.scheme not in ("https", "http") or not p.hostname:
        return ""
    host = p.hostname.lower().removeprefix("www.")
    path = re.sub(r"/+", "/", p.path).rstrip("/")
    return f"https://{host}{path}"

def title_key(title):
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", str(title or "").casefold())

def published_date(value):
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except (ValueError, TypeError):
        return None

def history(today, days=90):
    if not ARCHIVE.is_dir():
        return None, "archive directory unavailable"
    cutoff = dt.date.fromisoformat(today) - dt.timedelta(days=days)
    records = []
    for file in sorted(ARCHIVE.glob("*.json")):
        try:
            day = dt.date.fromisoformat(file.stem)
        except ValueError:
            continue
        if not cutoff <= day < dt.date.fromisoformat(today):
            continue
        try:
            document = json.loads(file.read_text(encoding="utf-8"))
            for section in SECTIONS:
                for item in document.get(section, []):
                    if isinstance(item, dict):
                        records.append({"title": item.get("title_zh") or item.get("title") or item.get("title_en"),
                                        "url": item.get("source_url") or item.get("url"),
                                        "archive_date": file.stem})
        except (ValueError, OSError, TypeError) as exc:
            return None, f"unreadable history file {file.name}: {type(exc).__name__}"
    if not records:
        return None, "no dated history records in 90-day window"
    return records, None

def audit(candidates, today, records, history_error=None):
    seen_urls, seen_titles = set(), set()
    history_urls = {url_key(x.get("url")) for x in records or []}
    history_titles = {title_key(x.get("title")) for x in records or []}
    output = []
    for item in candidates:
        u, t = url_key(item.get("url")), title_key(item.get("title"))
        date = published_date(item.get("published"))
        if not u or not t or not date:
            status, reason = "HOLD", "missing verified URL/title/ISO publication date"
        elif date > today:
            status, reason = "HOLD", "future publication date"
        elif u in seen_urls or t in seen_titles:
            status, reason = "DUPLICATE", "duplicate within candidate batch"
        elif history_error:
            status, reason = "HOLD", "historical comparison unavailable"
        elif u in history_urls or t in history_titles:
            status, reason = "DUPLICATE", "matches 90-day historical URL or normalized title"
        else:
            status, reason = "CANDIDATE", "no exact URL/title match; semantic review still required"
        output.append({"title": item.get("title"), "url": item.get("url"),
                       "published": date, "source": item.get("source"),
                       "status": status, "reason": reason})
        if u: seen_urls.add(u)
        if t: seen_titles.add(t)
    return {"audit_date": today, "mode": "read_only", "history_records": len(records or []),
            "history_error": history_error, "results": output,
            "publish_allowed": False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--date", required=True)
    args = parser.parse_args()
    dt.date.fromisoformat(args.date)
    candidates = json.loads(Path(args.input).read_text(encoding="utf-8"))
    if not isinstance(candidates, list):
        parser.error("input must be a JSON array")
    records, error = history(args.date)
    print(json.dumps(audit(candidates, args.date, records, error), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
