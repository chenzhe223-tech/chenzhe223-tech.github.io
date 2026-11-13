#!/usr/bin/env python3
"""Collect public AI topic discovery signals for DAVYLAB Topic Studio.

Public metadata only: Hacker News (Algolia) and GitHub Search.
No article text, accounts, private data, or authentication tokens.
Snapshot is updated only when at least one upstream returns valid current items.
IMPORTANT: HN points/comments and GitHub stars are different metrics, never market-share data.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
import ipaddress
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

DEST = Path(__file__).resolve().parents[1] / "data" / "hotspot-signals.json"
HN_URL = "https://hn.algolia.com/api/v1/search_by_date"
GH_URL = "https://api.github.com/search/repositories"
MAX_AGE_DAYS = 31
HN_SEARCHES = ("AI agent", "LLM", "open source AI", "AI coding")
USER_AGENT = "DAVYLAB-TopicStudio-PublicMetadata/1.0 (+https://chenzhe223-tech.github.io/topic-studio/)"

def safe_url(value: object) -> str:
    if not isinstance(value, str) or len(value) > 1700:
        return ""
    try:
        u = urlsplit(value.strip())
        host = (u.hostname or "").strip(".").lower()
        if u.scheme not in ("http", "https") or not host or u.username or u.password:
            return ""
        if host in ("localhost", "localhost.localdomain") or host.endswith((".local", ".internal", ".test")):
            return ""
        try:
            if not ipaddress.ip_address(host).is_global:
                return ""
        except ValueError:
            pass
        return value.strip().split("#", 1)[0]
    except (ValueError, TypeError):
        return ""

def clean(v: object, limit: int = 170) -> str:
    return re.sub(r"\s+", " ", v).strip()[:limit] if isinstance(v, str) else ""

def valid_date(value: object, now: datetime) -> str:
    try:
        if isinstance(value, (int, float)):
            dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
        else:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        if now - timedelta(days=MAX_AGE_DAYS) <= dt <= now + timedelta(hours=2):
            return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
    except (ValueError, OverflowError, OSError, TypeError):
        pass
    return ""

def as_count(value: object, maximum: int = 10_000_000) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        n = int(value)
        return n if 0 <= n <= maximum else None
    except (ValueError, TypeError):
        return None

def build_hn(hits: object, now: datetime) -> list[dict]:
    if not isinstance(hits, list):
        raise ValueError("HN API hits must be list")
    out = []
    for row in hits:
        if not isinstance(row, dict):
            continue
        object_id = clean(str(row.get("objectID", "")), 30)
        if not object_id.isdigit():
            continue
        title = clean(row.get("title"), 180)
        published = valid_date(row.get("created_at_i") or row.get("created_at"), now)
        if len(title) < 9 or not published:
            continue
        discussion = f"https://news.ycombinator.com/item?id={object_id}"
        original = safe_url(row.get("url")) or discussion
        out.append({
            "id": f"hn-{object_id}", "kind": "hackernews",
            "title": title, "summary": "", "url": original,
            "discussion_url": discussion, "published": published,
            "source": "Hacker News", "hn_points": as_count(row.get("points")),
            "hn_comments": as_count(row.get("num_comments")),
            "github_stars": None,
        })
    return out

def build_github(repos: object, now: datetime) -> list[dict]:
    if not isinstance(repos, list):
        raise ValueError("GitHub search items must be list")
    out = []
    for row in repos:
        if not isinstance(row, dict):
            continue
        repo_id = as_count(row.get("id"), 2**63-1)
        url = safe_url(row.get("html_url"))
        if not repo_id or not url or urlsplit(url).hostname != "github.com":
            continue
        title = clean(row.get("full_name"), 150)
        description = clean(row.get("description"), 220)
        published = valid_date(row.get("created_at"), now)
        if not title or not published:
            continue
        out.append({
            "id": f"gh-{repo_id}", "kind": "github",
            "title": title, "summary": description, "url": url,
            "discussion_url": "", "published": published,
            "source": "GitHub public repositories",
            "hn_points": None, "hn_comments": None,
            "github_stars": as_count(row.get("stargazers_count")),
        })
    return out

def build_snapshot(hn_groups: object, gh_rows: object, now: datetime) -> dict:
    seen = set()
    data = []
    groups = hn_groups if isinstance(hn_groups, list) else []
    for records in groups:
        for item in build_hn(records, now):
            if item["id"] not in seen:
                seen.add(item["id"])
                data.append(item)
    for item in build_github(gh_rows or [], now):
        if item["id"] not in seen:
            seen.add(item["id"])
            data.append(item)
    data.sort(key=lambda x: (x["published"], x["id"]), reverse=True)
    return {
        "schema_version": 1,
        "status": "ok" if data else "empty",
        "synced_at": now.isoformat(timespec="seconds"),
        "window_days": MAX_AGE_DAYS,
        "sources": ["Hacker News Algolia public search", "GitHub public repository search"],
        "engagement_note": "HN points/comments are per-story public counts; GitHub stars are cumulative repository stars, NOT daily growth. Neither measures WeChat readers or universal popularity.",
        "count": len(data),
        "items": data[:160],
    }

def fetch_json(url: str) -> object:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urlopen(req, timeout=16) as response:
        if response.status != 200:
            raise RuntimeError("HTTP " + str(response.status))
        if response.headers.get("Content-Length") and int(response.headers["Content-Length"]) > 2_000_000:
            raise ValueError("Oversized metadata response")
        return json.load(response)

def fetch_signals(now: datetime) -> tuple[list[list[dict]], list[dict], list[str]]:
    since = int((now - timedelta(days=21)).timestamp())
    hn = []
    warnings = []
    for query in HN_SEARCHES:
        qs = urlencode({"query":query,"tags":"story","numericFilters":f"created_at_i>{since}",
                        "hitsPerPage":35})
        try:
            data = fetch_json(HN_URL + "?" + qs)
            records = data.get("hits")
            if not isinstance(records, list):
                raise ValueError("HN missing hits array")
            hn.append(records)
        except Exception as e:
            warnings.append("HN " + query + ": " + str(e)[:130])
        time.sleep(0.35)
    since_date = (now - timedelta(days=21)).date().isoformat()
    # Query only *newly created* public AI-topic projects: stars are cumulative, not velocity.
    qs = urlencode({"q":f"topic:ai created:>={since_date}","sort":"stars","order":"desc","per_page":40})
    gh = []
    try:
        data = fetch_json(GH_URL + "?" + qs)
        rows = data.get("items")
        if not isinstance(rows, list):
            raise ValueError("GitHub missing items array")
        gh = rows
    except Exception as e:
        warnings.append("GitHub: " + str(e)[:130])
    return hn, gh, warnings

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",type=Path,help="offline fixture containing hn_groups and github_items")
    parser.add_argument("--output",type=Path,default=DEST)
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    warnings = []
    if args.input:
        fixture = json.loads(args.input.read_text(encoding="utf-8"))
        groups = fixture.get("hn_groups", [])
        github = fixture.get("github_items", [])
    else:
        groups, github, warnings = fetch_signals(now)
    snapshot = build_snapshot(groups, github, now)
    snapshot["warnings"] = warnings
    snapshot["collection_method"] = "offline_fixture" if args.input else "public_API_without_authentication"
    if not snapshot["items"]:
        print("No current valid public signals: last-good snapshot preserved.",file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True,exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temporary.replace(args.output)
    print(f"Saved {snapshot['count']} public metadata signals to {args.output} ; warnings={len(warnings)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
