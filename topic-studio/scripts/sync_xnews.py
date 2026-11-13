#!/usr/bin/env python3
"""Sync the public XNews metadata index into DAVYLAB Topic Studio.

No article bodies, media, login, private sources, API keys, or user data are copied.
Fail closed: a failed/empty upstream request must not overwrite the last good snapshot.
"""
from __future__ import annotations

import argparse
from datetime import datetime, date, timedelta, timezone
import ipaddress
import json
import pathlib
import re
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

SOURCE = "https://xnews.qiaomu.ai/articles.json"
DEST = pathlib.Path(__file__).resolve().parents[1] / "data" / "xnews-discovery.json"
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{0,100}$")


def public_http_url(value: object) -> str:
    """Keep only outward-facing public http(s) URLs, never javascript/local/file."""
    if not isinstance(value, str):
        return ""
    value = value.strip()
    if len(value) > 2000:
        return ""
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower().strip(".")
        if parsed.scheme not in ("http", "https") or not host or parsed.username or parsed.password:
            return ""
        if host in ("localhost", "localhost.localdomain") or host.endswith((".local", ".internal", ".test")):
            return ""
        try:
            ip = ipaddress.ip_address(host)
            if not ip.is_global:
                return ""
        except ValueError:
            pass
        return value
    except (ValueError, TypeError):
        return ""


def compact(value: object, max_chars: int) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()[:max_chars]


def build_snapshot(records: object, synced_at: str) -> dict:
    if not isinstance(records, list):
        raise ValueError("XNews index must be a JSON array")
    result, seen_original, seen_ids = [], set(), set()
    for record in records:
        if not isinstance(record, dict):
            continue
        slug = compact(record.get("id"), 110)
        title = compact(record.get("title"), 150)
        original = public_http_url(record.get("source_url"))
        raw_date = compact(record.get("date"), 20)
        if not SLUG.fullmatch(slug) or len(title) < 3 or not original:
            continue
        try:
            published = date.fromisoformat(raw_date)
        except ValueError:
            continue
        if published > datetime.now(timezone.utc).date() + timedelta(days=366):
            continue
        source_key = original.lower().split("#", 1)[0].rstrip("/")
        if slug in seen_ids or source_key in seen_original:
            continue
        seen_original.add(source_key)
        seen_ids.add(slug)
        tags = record.get("tags") if isinstance(record.get("tags"), list) else []
        result.append({
            "id": slug,
            "date": published.isoformat(),
            "title": title,
            "summary": compact(record.get("dek"), 240),
            "original_url": original,
            "xnews_url": "https://xnews.qiaomu.ai/a/" + slug,
            "tags": [x for x in (compact(t, 32) for t in tags) if x][:8],
            "source": "XNews · 向阳乔木",
            "verification": "upstream_metadata_not_independently_verified",
        })
    result.sort(key=lambda v: (v["date"], v["id"]), reverse=True)
    if len(result) < 3:
        raise ValueError("XNews index yielded fewer than 3 valid distinct articles; keep last good snapshot")
    trimmed = result[:100]
    return {
        "schema_version": 1,
        "source": "XNews (joeseesun/xnews)",
        "source_index": SOURCE,
        "license_note": "MIT source code; editorial content is attributed and only short metadata excerpts are displayed",
        "synced_at": synced_at,
        "count": len(trimmed),
        "articles": trimmed,
    }


def fetch_upstream(url: str = SOURCE) -> object:
    req = Request(url, headers={"User-Agent": "DAVYLAB-TopicStudio/1.0 (public editorial discovery)", "Accept": "application/json"})
    with urlopen(req, timeout=20) as response:
        if response.status != 200:
            raise ValueError("Upstream returned HTTP " + str(response.status))
        size_limit = 2_000_000
        raw = response.read(size_limit + 1)
        if len(raw) > size_limit:
            raise ValueError("Upstream JSON exceeds 2 MB safety limit")
    return json.loads(raw.decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=pathlib.Path, help="Read local source JSON for offline tests/bootstrapping")
    parser.add_argument("--output", type=pathlib.Path, default=DEST)
    args = parser.parse_args()
    try:
        records = json.loads(args.input.read_text(encoding="utf-8")) if args.input else fetch_upstream()
        snapshot = build_snapshot(records, datetime.now(timezone.utc).isoformat(timespec="seconds"))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        tmp = args.output.with_name(args.output.name + ".tmp")
        tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(args.output)
        print("XNews metadata synced: " + str(snapshot["count"]) + " entries")
        return 0
    except Exception as e:
        print("XNews sync failed, existing snapshot preserved: " + str(e), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
