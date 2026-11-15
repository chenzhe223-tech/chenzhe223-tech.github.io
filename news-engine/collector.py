"""DAVYLAB News Engine P0: bounded RSS discovery, no external dependencies."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

MAX_BYTES = 2_000_000
MAX_ITEMS_PER_SOURCE = 40
USER_AGENT = "DAVYLAB-NewsEngine/0.1 (+https://chenzhe223-tech.github.io/radar/daily/)"
SOURCES = [
    {"name": "GitHub Blog", "url": "https://github.blog/feed/"},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/"},
    {"name": "Hugging Face", "url": "https://huggingface.co/blog/feed.xml"},
    {"name": "Simon Willison", "url": "https://simonwillison.net/atom/everything/"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
]
ATOM = "{http://www.w3.org/2005/Atom}"
def safe_url(value):
    if not isinstance(value, str) or any(c.isspace() for c in value):
        return ""
    try:
        u = urllib.parse.urlsplit(value)
        if u.scheme != "https" or not u.hostname or u.username or u.password:
            return ""
        return value
    except ValueError:
        return ""

def fetch(url):
    if not safe_url(url):
        raise ValueError("source URL must be HTTPS")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml,application/atom+xml,application/xml"})
    with urllib.request.urlopen(request, timeout=12) as response:
        if response.status != 200:
            raise ValueError("non-200 HTTP response")
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("feed exceeds size limit")
        return data

def parse(payload, source, now):
    if len(payload) > MAX_BYTES or b"<!DOCTYPE" in payload.upper():
        raise ValueError("unsafe or oversized XML")
    root = ET.fromstring(payload)
    if root.tag == "rss":
        rows = [(n.findtext("title"), n.findtext("link"), n.findtext("pubDate")) for n in root.findall("./channel/item")]
    elif root.tag == ATOM + "feed":
        rows = []
        for n in root.findall(ATOM + "entry"):
            links = [a.get("href") for a in n.findall(ATOM + "link") if a.get("rel", "alternate") == "alternate"]
            rows.append((n.findtext(ATOM + "title"), links[0] if links else "", n.findtext(ATOM + "published") or n.findtext(ATOM + "updated")))
    else:
        raise ValueError("unsupported feed root")
    cutoff = now - dt.timedelta(days=7)
    results = []
    for title, url, stamp in rows[:MAX_ITEMS_PER_SOURCE]:
        if not title or not safe_url(url) or not stamp:
            continue
        try:
            published = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00")) if "T" in stamp else parsedate_to_datetime(stamp)
            if not published.tzinfo:
                continue
            published = published.astimezone(dt.timezone.utc)
        except (ValueError, TypeError, OverflowError, IndexError):
            continue
        if not cutoff <= published <= now + dt.timedelta(hours=6):
            continue
        normalized = urllib.parse.urlsplit(url)
        canonical = urllib.parse.urlunsplit((normalized.scheme, normalized.netloc.lower(), normalized.path.rstrip("/") or "/", normalized.query, ""))
        results.append({"id": hashlib.sha256(canonical.encode()).hexdigest()[:20], "title": re.sub(r"\\s+", " ", title).strip()[:240], "url": url, "source": source, "published_at": published.isoformat(), "verification_status": "source_not_independently_verified", "editorial_status": "discovered"})
    return results

def collect(sources=SOURCES, http_get=fetch, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    stories, seen, diagnostics = [], set(), []
    for source in sources:
        name, url = source["name"], source["url"]
        try:
            items = parse(http_get(url), name, now)
            for item in items:
                if item["id"] not in seen:
                    seen.add(item["id"])
                    stories.append(item)
            diagnostics.append({"source": name, "status": "ok", "parsed": len(items)})
        except (ValueError, ET.ParseError, OSError, TimeoutError) as exc:
            diagnostics.append({"source": name, "status": "error", "error_type": type(exc).__name__})
    stories.sort(key=lambda x: x["published_at"], reverse=True)
    return {"generated_at": now.isoformat(), "stories": stories, "diagnostics": diagnostics, "schema_version": 1}

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="news-engine/data/latest.json")
    args = p.parse_args()
    result = collect()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"stories": len(result["stories"]), "diagnostics": result["diagnostics"]}, ensure_ascii=False))
