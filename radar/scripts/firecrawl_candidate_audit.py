#!/usr/bin/env python3
"""Read-only Firecrawl candidate audit. Never publishes or modifies radar data.

Usage:
  python radar/scripts/firecrawl_candidate_audit.py --input candidates.json --date 2026-11-08
Input: JSON array of {title,url,published,published_origin,source} objects.\n  published_origin must be article_meta, json_ld, or publisher_page.
"""
import argparse
import datetime as dt
import json
import re
import difflib
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

def title_variants(item):
    return [title_key(item.get(k)) for k in ("title", "title_zh", "title_en", "original_title")
            if item.get(k)]

def near_event(a, b):
    """Conservative same-language event match, never a shared-brand-only match."""
    for x in title_variants(a):
        for y in title_variants(b):
            if not x or not y or min(len(x), len(y)) < 18:
                continue
            ratio = difflib.SequenceMatcher(None, x, y).ratio()
            if ratio >= 0.86:
                return True
    return False

def verified_publication(item):
    """Require provenance for a publication date; scrape timestamps are not publication dates."""
    value = item.get("published")
    origin = item.get("published_origin")
    if origin not in ("article_meta", "json_ld", "publisher_page"):
        return None
    return published_date(value)

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
                        records.append({**item, "url": item.get("source_url") or item.get("url"), "archive_date": file.stem})
        except (ValueError, OSError, TypeError) as exc:
            return None, f"unreadable history file {file.name}: {type(exc).__name__}"
    if not records:
        return None, "no dated history records in 90-day window"
    return records, None

def audit(candidates, today, records, history_error=None):
    seen_urls, seen_titles = set(), set()
    history_urls = {url_key(x.get("url")) for x in records or []}
    history_titles = {t for x in records or [] for t in title_variants(x)}
    seen_items = []
    output = []
    for item in candidates:
        u, t = url_key(item.get("url")), title_key(item.get("title"))
        variants = title_variants(item)
        date = verified_publication(item)
        if not u or not t or not date:
            status, reason = "HOLD", "missing verified URL/title/publication date provenance"
        elif date > today:
            status, reason = "HOLD", "future publication date"
        elif u in seen_urls or t in seen_titles or any(near_event(item, prior) for prior in seen_items):
            status, reason = "DUPLICATE", "duplicate within candidate batch"
        elif history_error:
            status, reason = "HOLD", "historical comparison unavailable"
        elif u in history_urls or any(v in history_titles for v in variants):
            status, reason = "DUPLICATE", "matches 90-day historical URL or normalized title"
        elif any(near_event(item, old) for old in records or []):
            status, reason = "REVIEW_DUPLICATE", "possible same event across publishers; manual verification required"
        else:
            status, reason = "CANDIDATE", "no exact or high-similarity title match; semantic review still required"
        output.append({"title": item.get("title"), "url": item.get("url"),
                       "published": date, "published_origin": item.get("published_origin"), "source": item.get("source"),
                       "status": status, "reason": reason})
        if u: seen_urls.add(u)
        if t: seen_titles.add(t)
        seen_items.append(item)
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
