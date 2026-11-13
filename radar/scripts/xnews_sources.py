"""X News (joeseesun/xnews) RSS v1 adapter for DAVYLAB Radar.

Read *metadata and a short excerpt only*, not the full third-party article.
The source's qiaomu:versions contract is documented at
https://github.com/joeseesun/xnews/blob/main/content/SCHEMA.md .
An RSS item is an editorial discovery lead, NOT independent fact verification.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser

FEED_URL = "https://xnews.qiaomu.ai/feed.xml"
CURATED_HOST = "xnews.qiaomu.ai"
VERSIONS_NS = "{https://qiaomu.ai/ns/rss/1.0}versions"
MAX_FEED_BYTES = 3_000_000
MAX_AGE_DAYS = 7
MAX_ITEMS = 12


def _https_url(value: object, *, host: str | None = None) -> str:
    """Reject relative, unsafe, credential-bearing and unexpected destination URLs."""
    if not isinstance(value, str):
        return ""
    candidate = value.strip()
    try:
        parsed = urllib.parse.urlsplit(candidate)
        if (parsed.scheme.lower() != "https" or not parsed.hostname or
                parsed.username or parsed.password or any(c.isspace() for c in candidate)):
            return ""
        if host and parsed.hostname.lower() != host:
            return ""
        return candidate
    except (ValueError, TypeError):
        return ""


def _short_excerpt(markdown: object) -> str:
    """A clearly attributed brief excerpt; never copy full translated articles."""
    if not isinstance(markdown, str):
        return ""
    for paragraph in re.split(r"\n\s*\n", markdown):
        line = paragraph.strip()
        if not line or line.startswith(("#", ">", "```", "|", "![", "- ", "* ")):
            continue
        line = re.sub(r"!?\[([^\]]+)\]\(https?://[^)]*\)", r"\1", line)
        line = html.unescape(re.sub(r"<[^>]*>", " ", line))
        line = re.sub(r"[\*_\`~]+", "", line)
        line = re.sub(r"\s+", " ", line).strip()
        if len(line) >= 24:
            return line[:120].rstrip("，,；;。 ") + ("…" if len(line) > 120 else "")
    return ""


class SourceImage(HTMLParser):
    """Keep the first original image reference without rendering provider HTML."""
    def __init__(self):
        super().__init__()
        self.fields = {}

    def handle_starttag(self, tag, attrs):
        if tag != "img" or self.fields:
            return
        values = dict(attrs)
        url = _https_url(values.get("src"))
        if url:
            self.fields = {"image_url": url, "image_alt": (values.get("alt") or "")[:240],
                           "image_match_status": "article_image"}


def parse_xnews_feed(payload: bytes, *, now: dt.datetime | None = None) -> tuple[list[dict], str]:
    """Parse source timestamps and independent original links from RSS v1.

    A missing/unknown version must not fall back to mixed content:encoded,
    since X News explicitly states it combines original and rewrite.
    """
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if len(payload) > MAX_FEED_BYTES or b"<!DOCTYPE" in payload.upper():
        return [], "invalid_xml"
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        return [], "invalid_xml"
    if root.tag != "rss":
        return [], "incompatible_feed"

    items: list[dict] = []
    seen: set[str] = set()
    recognized_versions = 0
    cutoff = now.astimezone(dt.timezone.utc) - dt.timedelta(days=MAX_AGE_DAYS)
    future = now.astimezone(dt.timezone.utc) + dt.timedelta(hours=6)
    for item in root.findall("./channel/item"):
        raw_versions = item.findtext(VERSIONS_NS)
        if not raw_versions:
            continue
        try:
            versions = json.loads(raw_versions)
        except (json.JSONDecodeError, ValueError):
            continue
        if not isinstance(versions, dict) or versions.get("version") != 1:
            continue
        recognized_versions += 1
        original = versions.get("original")
        rewrite = versions.get("rewrite")
        if not isinstance(original, dict) or not isinstance(rewrite, dict):
            continue

        source_url = _https_url(original.get("url"))
        curated_url = _https_url(item.findtext("link"), host=CURATED_HOST)
        title_zh = str(rewrite.get("title") or item.findtext("title") or "").strip()
        title_en = str(original.get("title") or "").strip()
        if not source_url or not curated_url or not title_zh or source_url in seen:
            continue

        raw_date = item.findtext("pubDate")
        try:
            published = parsedate_to_datetime(str(raw_date or ""))
            if published.tzinfo is None:
                continue
            published = published.astimezone(dt.timezone.utc)
        except (TypeError, ValueError, IndexError, OverflowError):
            continue
        if published < cutoff or published > future:
            continue

        # The curated prose is a secondary source. Preserve its provenance
        # and a very short attributed excerpt; no article body or media is copied.
        excerpt = _short_excerpt(rewrite.get("markdown"))
        media = SourceImage()
        if isinstance(original.get("html"), str):
            media.feed(original["html"])
        seen.add(source_url)
        items.append({
            **media.fields,
            "title": title_zh[:220],
            "title_zh": title_zh[:220],
            "title_en": title_en[:220],
            "summary": excerpt,
            "summary_zh": excerpt,
            "summary_en": "Editorial reading lead; check the original author and source.",
            "url": source_url,
            "source_url": source_url,
            "curated_url": curated_url,
            "source": "X News · 海外发现",
            "source_kind": "curated_secondary",
            "verification_status": "source_not_independently_verified",
            "published": published.isoformat(),
        })

    items.sort(key=lambda row: row["published"], reverse=True)
    status = "ok" if items else ("no_recent" if recognized_versions else "incompatible_schema")
    return items[:MAX_ITEMS], status


def collect_xnews_articles(http_get, *, now: dt.datetime) -> tuple[list[dict], str]:
    """Fail open: an external RSS outage must never block the core daily briefing."""
    try:
        payload = http_get(
            FEED_URL,
            "application/rss+xml, application/xml, text/xml",
            timeout=10,
        )
        return parse_xnews_feed(payload, now=now)
    except Exception as exc:
        print(f"[xnews-warning] feed unavailable: {type(exc).__name__}")
        return [], "unavailable"
