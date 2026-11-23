#!/usr/bin/env python3
"""DAVYLAB science discovery snapshot from public Crossref metadata.

No paywalled-text scraping. DOI metadata are not scientific fact checks.
Run: python3 topic-studio/scripts/fetch_science.py
"""
from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

JOURNALS = {
    "nature": {"name": "Nature", "issn": "0028-0836"},
    "science": {"name": "Science", "issn": "0036-8075"},
}
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "science-discovery.json"
UA = "DAVYLAB-ScienceDiscovery/1.0 (+https://chenzhe223-tech.github.io/topic-studio/)"
DOI_PATTERN = re.compile(r"^10\.\d{4,9}/\S+$", re.I)
HTML_TAGS = re.compile(r"<[^>]+>")
SPACES = re.compile(r"\s+")
GROUPS = [
    ("life", re.compile(r"cell|health|disease|protein|genom|medicine|immune|liver|brain|neuron|cancer|patient|virus|microbio|microplastic|biolog|clinical", re.I)),
    ("ai", re.compile(r"artificial intelligence|machine learning|neural network|language model|algorithm|computer|robot|computational|deep learning", re.I)),
    ("earth", re.compile(r"climate|ocean|carbon|earth|environment|ecosystem|pollut|plastic|atmospher|wildlife|biodivers", re.I)),
    ("space", re.compile(r"quantum|physics|galaxy|cosmolog|particle|stellar|black hole|astronom|astrophys|laser", re.I)),
    ("material", re.compile(r"battery|solar|energy|material|polymer|semiconductor|catalys|electrode|hydrogen", re.I)),
]


def tidy(value: Any, limit: int = 1000) -> str:
    return SPACES.sub(" ", html.unescape(HTML_TAGS.sub(" ", str(value or "")))).strip()[:limit]


def date_string(value: Any, now: datetime | None = None) -> str:
    """Crossref publishes date-parts at different precisions."""
    now = now or datetime.now(timezone.utc)
    try:
        parts = value["date-parts"][0]
        year, month, day = int(parts[0]), int(parts[1] if len(parts) > 1 else 1), int(parts[2] if len(parts) > 2 else 1)
        d = datetime(year, month, day, tzinfo=timezone.utc)
        if d > now + timedelta(days=1):
            return ""
        return d.strftime("%Y-%m-%d")
    except (ValueError, TypeError, IndexError, KeyError):
        return ""


def domain_for(text: str) -> str:
    return next((name for name, regex in GROUPS if regex.search(text)), "other")


def normalize(item: dict[str, Any], source: str, now: datetime | None = None) -> dict[str, Any] | None:
    if source not in JOURNALS:
        return None
    doi = str(item.get("DOI") or "").strip().lower()
    if not DOI_PATTERN.fullmatch(doi):
        return None
    titles = item.get("title") or []
    title = tidy(titles[0] if isinstance(titles, list) and titles else titles, 240)
    j = item.get("container-title") or []
    journal = tidy(j[0] if isinstance(j, list) and j else j, 120)
    if journal and journal.casefold() != JOURNALS[source]["name"].casefold():
        return None
    published = date_string(item.get("published") or item.get("published-online") or item.get("issued") or {}, now)
    if not title or not published:
        return None
    abstract = tidy(item.get("abstract") or "", 380)
    authors = "、".join(
        tidy(" ".join(filter(None, (author.get("given"), author.get("family")))), 80)
        for author in (item.get("author") or [])[:3]
        if isinstance(author, dict)
    )
    d = domain_for(title + " " + abstract)
    return {
        "doi": doi,
        "title": title,
        "source": source,
        "journal": JOURNALS[source]["name"],
        "published_at": published,
        "authors": authors,
        "summary": abstract,
        "domain": d,
        "url": "https://doi.org/" + urllib.parse.quote(doi, safe="/"),
        "verification": "crossref_metadata_only",
    }


def fetch_journal(source: str, today: datetime) -> list[dict[str, Any]]:
    conf = JOURNALS[source]
    params = urllib.parse.urlencode({
        "filter": "from-pub-date:" + (today - timedelta(days=90)).strftime("%Y-%m-%d") + ",type:journal-article",
        "rows": "60", "sort": "published", "order": "desc",
    })
    url = f"https://api.crossref.org/journals/{conf['issn']}/works?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                payload = json.load(response)
            items = payload.get("message", {}).get("items", [])
            if not isinstance(items, list):
                raise ValueError("Crossref metadata items is not an array")
            normalized = [normalize(item, source, today) for item in items if isinstance(item, dict)]
            return [record for record in normalized if record is not None]
        except (TimeoutError, urllib.error.URLError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"Crossref query failed for {source}: {last_error}")


def load_previous() -> list[dict[str, Any]]:
    if not OUTPUT.exists():
        return []
    try:
        data = json.loads(OUTPUT.read_text("utf-8"))
        if data.get("schema_version") != 1:
            return []
        return [r for r in data.get("articles", []) if isinstance(r, dict)]
    except (OSError, json.JSONDecodeError):
        return []


def merge(current: list[dict[str, Any]], previous: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for record in previous + current:
        doi = str(record.get("doi") or "").lower()
        if not DOI_PATTERN.fullmatch(doi) or record.get("source") not in JOURNALS:
            continue
        row = {**record, "doi": doi}
        old = best.get(doi)
        if old is None or len(str(row.get("summary") or "")) >= len(str(old.get("summary") or "")):
            best[doi] = row
    return sorted(best.values(), key=lambda r: (r.get("published_at", ""), r["doi"]), reverse=True)[:180]


def run() -> int:
    now = datetime.now(timezone.utc)
    current: list[dict[str, Any]] = []
    source_states = []
    for source in JOURNALS:
        try:
            found = fetch_journal(source, now)
            if not found:
                raise ValueError("No valid DOI metadata returned")
            current.extend(found)
            source_states.append({"name": source, "status": "ok", "count": len(found)})
        except Exception as exc:
            source_states.append({"name": source, "status": "error", "count": 0, "detail": str(exc)[:180]})
            print(f"WARNING [{source}] {exc}", file=sys.stderr)
    if not current:
        print("ERROR: Neither journal returned validated records; retain last snapshot.", file=sys.stderr)
        return 1
    data = {
        "schema_version": 1,
        "checked_at": now.isoformat(timespec="seconds"),
        "sources": source_states,
        "articles": merge(current, load_previous()),
        "notes": "Crossref bibliographic metadata only. Journal article category does not establish original research or peer-review status. Full study and any retractions require independent inspection.",
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Science snapshot updated: {len(data['articles'])} unique DOIs; " +
          ", ".join(s["name"] + "=" + s["status"] for s in source_states))
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
