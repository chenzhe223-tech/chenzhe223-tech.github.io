#!/usr/bin/env python3
"""Discover source-backed public RSS/Atom items for DAVYLAB Hotspot Radar.

Standard-library only. This helper does not scrape login-protected platforms, infer
popularity, or claim to cover all video/podcast platforms. Feed URLs must be configured
and verified by a human. Usage:
  python radar/scripts/discover_media.py
  python radar/scripts/discover_media.py --days 14 --limit 80
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "radar" / "config" / "hotspot_sources.json"
OUT = ROOT / "radar" / "data" / "hotspot-radar"
TZ = ZoneInfo("Asia/Shanghai")
USER_AGENT = "DAVYLAB-Hotspot-Radar/0.1 (+https://chenzhe223-tech.github.io/radar/daily/)"
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean(value: str | None) -> str:
    return WS_RE.sub(" ", TAG_RE.sub(" ", value or "")).strip()


def parse_date(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip()
    try:
        from email.utils import parsedate_to_datetime
        stamp = parsedate_to_datetime(value)
    except Exception:
        try:
            stamp = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return ""
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=dt.timezone.utc)
    return stamp.astimezone(dt.timezone.utc).isoformat()


def fetch(url: str, timeout: int = 15) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Only absolute HTTPS feed URLs are permitted")
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        final_url = response.geturl()
        if urllib.parse.urlparse(final_url).scheme != "https":
            raise ValueError("Feed redirected to a non-HTTPS URL")
        return response.read(4_000_000)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def child_text(node: ET.Element, *names: str) -> str:
    for child in list(node):
        if local_name(child.tag) in names and child.text:
            return child.text
    return ""


def parse_feed(feed: dict, collected_at: str) -> tuple[list[dict], str | None]:
    try:
        root = ET.fromstring(fetch(feed["url"]))
    except Exception as exc:
        return [], f"{type(exc).__name__}: {str(exc)[:180]}"
    items: list[dict] = []
    # RSS 2.0 / RSS 1.0 items
    for item in root.iter():
        if local_name(item.tag) != "item":
            continue
        title = clean(child_text(item, "title"))
        link = clean(child_text(item, "link"))
        guid = clean(child_text(item, "guid", "id"))
        summary = clean(child_text(item, "description", "summary", "encoded", "content"))
        published = parse_date(child_text(item, "pubdate", "published", "updated", "date", "date.modified"))
        enclosure_url = ""
        for child in list(item):
            if local_name(child.tag) == "enclosure" and child.attrib.get("url"):
                enclosure_url = child.attrib["url"]
                break
        if not link:
            link = guid if guid.startswith("https://") else ""
        if title and link.startswith("https://"):
            items.append(make_record(feed, title, link, summary, published, collected_at, enclosure_url))
    # Atom feeds
    if not items:
        for item in root.iter():
            if local_name(item.tag) != "entry":
                continue
            title = clean(child_text(item, "title"))
            summary = clean(child_text(item, "summary", "content"))
            published = parse_date(child_text(item, "published", "updated"))
            link = ""
            for child in list(item):
                if local_name(child.tag) == "link" and child.attrib.get("href"):
                    rel = child.attrib.get("rel", "alternate")
                    if rel == "alternate":
                        link = child.attrib["href"]
                        break
            if title and link.startswith("https://"):
                items.append(make_record(feed, title, link, summary, published, collected_at, ""))
    return items, None


def make_record(feed: dict, title: str, url: str, summary: str, published: str, collected_at: str, enclosure_url: str) -> dict:
    content_type = feed.get("type", "news")
    if content_type == "podcast" or enclosure_url:
        content_type = "podcast"
    elif content_type == "video":
        content_type = "video"
    canonical = url.split("#", 1)[0]
    stable = hashlib.sha256((canonical or title.casefold()).encode("utf-8")).hexdigest()[:16]
    record = {
        "id": stable,
        "title": title[:300],
        "content_type": content_type,
        "source_name": str(feed.get("name", "Unknown source")),
        "source_url": canonical,
        "published_at": published,
        "collected_at": collected_at,
        "summary": summary[:700],
        "region": feed.get("region", "unknown"),
        "metrics": {"views": None, "likes": None, "comments": None, "listeners": None, "interest_signal": "unknown"},
        "evidence_links": [canonical],
        "claims_to_verify": [],
        "rights_notes": "Metadata and short summary only; do not republish full text, audio, or video.",
        "status": "discovered" if published else "needs_verification",
    }
    if enclosure_url.startswith("https://"):
        record["enclosure_url"] = enclosure_url
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=None, help="Only keep items published within this many days; unknown dates are kept but flagged.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--output", default=None, help="Optional output JSON path.")
    args = parser.parse_args()
    if args.days is not None and args.days < 1:
        parser.error("--days must be at least 1")
    if args.limit < 1:
        parser.error("--limit must be at least 1")
    if not CONFIG.exists():
        print(f"Missing source configuration: {CONFIG}", file=sys.stderr)
        return 2
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    now = dt.datetime.now(TZ)
    collected_at = now.isoformat()
    window = args.days or int(config.get("default_window_days", 7))
    cutoff = now.astimezone(dt.timezone.utc) - dt.timedelta(days=window)
    all_items: list[dict] = []
    source_status: list[dict] = []
    for feed in config.get("feeds", []):
        if not feed.get("enabled", True):
            continue
        items, error = parse_feed(feed, collected_at)
        kept = []
        for item in items:
            if item["published_at"]:
                stamp = dt.datetime.fromisoformat(item["published_at"].replace("Z", "+00:00"))
                if stamp < cutoff or stamp > now.astimezone(dt.timezone.utc) + dt.timedelta(hours=6):
                    continue
            else:
                item["status"] = "needs_verification"
            kept.append(item)
        all_items.extend(kept)
        source_status.append({
            "name": feed.get("name", "Unknown source"),
            "url": feed.get("url", ""),
            "type": feed.get("type", "news"),
            "items_found": len(items),
            "items_kept": len(kept),
            "status": "error" if error else ("ok" if items else "empty"),
            "error": error,
        })
        print(f"[{source_status[-1]['status']}] {feed.get('name')}: {len(kept)} kept")
    # Stable URL + normalized title deduplication; retain first source provenance.
    deduped: list[dict] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for item in sorted(all_items, key=lambda x: x.get("published_at", ""), reverse=True):
        url_key = item["source_url"].rstrip("/")
        title_key = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", item["title"].casefold())
        if url_key in seen_urls or (title_key and title_key in seen_titles):
            continue
        seen_urls.add(url_key)
        if title_key:
            seen_titles.add(title_key)
        deduped.append(item)
    deduped = deduped[:args.limit]
    report = {
        "product": "DAVYLAB Hotspot Radar",
        "schema_version": 1,
        "report_date": now.strftime("%Y-%m-%d"),
        "timezone": "Asia/Shanghai",
        "generated_at": collected_at,
        "window_days": window,
        "status": "ok" if any(s["status"] == "ok" for s in source_status) else "partial",
        "source_summary": {
            "configured": len(source_status),
            "successful": sum(1 for s in source_status if s["status"] == "ok"),
            "failed": sum(1 for s in source_status if s["status"] == "error"),
            "items_before_deduplication": len(all_items),
            "items_after_deduplication": len(deduped),
        },
        "sources": source_status,
        "items": deduped,
        "limitations": [
            "Only configured public RSS/Atom feeds are queried.",
            "No platform-wide video or podcast popularity metrics are collected.",
            "Unknown publication timestamps and engagement metrics are not fabricated.",
            "Items are discoveries, not verified editorial recommendations; review source claims before publication."
        ]
    }
    output = Path(args.output).resolve() if args.output else OUT / "latest.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    dated = output.parent / f"{now.strftime('%Y-%m-%d')}.json"
    if not args.output:
        dated.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}; {len(deduped)} unique items from {report['source_summary']['successful']}/{len(source_status)} feeds.")
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
