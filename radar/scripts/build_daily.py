#!/usr/bin/env python3
"""Build Davy Radar daily data from public RSS feeds and GitHub repository search.
No API key is required; GitHub unauthenticated API limits apply.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data"
ARCHIVE = DATA / "archive"
TZ = ZoneInfo("Asia/Shanghai")
USER_AGENT = "DavyRadar/1.0 (+https://chenzhe223-tech.github.io/radar/daily/)"
FEEDS = [
    ("OpenAI", "https://openai.com/news/rss.xml"),
    ("Anthropic", "https://www.anthropic.com/news/rss.xml"),
    ("Google AI Blog", "https://blog.google/technology/ai/rss/"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("GitHub Blog", "https://github.blog/feed/"),
    ("Simon Willison", "https://simonwillison.net/atom/everything/"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
]
AI_TERMS = re.compile(r"\b(ai|artificial intelligence|llm|large language model|agent|agents|skill|model|openai|anthropic|claude|gpt|gemini|deepseek|hugging face|machine learning|生成式|人工智能|大模型|智能体|开源模型)\b", re.I)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

def http_get(url: str, accept: str = "*/*", timeout: int = 18) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()

def clean(value: str) -> str:
    value = TAG_RE.sub(" ", value or "")
    value = WS_RE.sub(" ", value).strip()
    return value

def parse_date(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        from email.utils import parsedate_to_datetime
        value = parsedate_to_datetime(raw)
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc).isoformat()
    except Exception:
        try:
            value = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if value.tzinfo is None:
                value = value.replace(tzinfo=dt.timezone.utc)
            return value.astimezone(dt.timezone.utc).isoformat()
        except Exception:
            return ""

def parse_feed(source: str, url: str) -> list[dict]:
    try:
        root = ET.fromstring(http_get(url, "application/rss+xml, application/atom+xml, application/xml, text/xml"))
    except Exception as exc:
        print(f"[feed-warning] {source}: {type(exc).__name__}")
        return []
    entries = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title", ""))
        link = clean(item.findtext("link", ""))
        summary = clean(item.findtext("description", "") or item.findtext("content:encoded", ""))
        published = parse_date(item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date"))
        if title and link:
            entries.append({"title": title, "url": link, "summary": summary[:360], "published": published, "source": source})
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    if not entries:
        for item in root.findall(".//atom:entry", ns):
            title = clean(item.findtext("atom:title", "", ns))
            link_el = item.find("atom:link", ns)
            link = link_el.attrib.get("href", "") if link_el is not None else ""
            summary = clean(item.findtext("atom:summary", "", ns) or item.findtext("atom:content", "", ns))
            published = parse_date(item.findtext("atom:published", "", ns) or item.findtext("atom:updated", "", ns))
            if title and link:
                entries.append({"title": title, "url": link, "summary": summary[:360], "published": published, "source": source})
    return entries

def github_search(query: str) -> list[dict]:
    url = "https://api.github.com/search/repositories?" + urllib.parse.urlencode({
        "q": query, "sort": "stars", "order": "desc", "per_page": 30
    })
    try:
        payload = json.loads(http_get(url, "application/vnd.github+json"))
        return payload.get("items", [])
    except Exception as exc:
        print(f"[github-warning] {query}: {type(exc).__name__}")
        return []

def collect_skills() -> list[dict]:
    queries = [
        "skills AI agent in:name,description",
        "claude skills in:name,description",
        "agent-skills in:name,description",
        "awesome-copilot in:name,description",
    ]
    repos: dict[str, dict] = {}
    for query in queries:
        for r in github_search(query):
            name = r.get("full_name", "")
            description = clean(r.get("description") or "")
            topics = r.get("topics") or []
            combined = (name + " " + description + " " + " ".join(topics)).lower()
            if not name or not any(k in combined for k in ("skill", "skills", "agent", "copilot")):
                continue
            if r.get("fork") or r.get("archived"):
                continue
            repos[name] = {
                "name": name,
                "url": r.get("html_url", ""),
                "description": description[:360],
                "stars": int(r.get("stargazers_count") or 0),
                "updated": r.get("updated_at", ""),
                "language": r.get("language") or "Multi-language",
                "topics": topics[:8],
            }
        time.sleep(0.25)
    now = dt.datetime.now(dt.timezone.utc)
    def score(item: dict) -> float:
        try:
            updated = dt.datetime.fromisoformat(item["updated"].replace("Z", "+00:00"))
            days = max(0, (now - updated).total_seconds() / 86400)
        except Exception:
            days = 365
        # Star count is the strongest public proxy; freshness modestly breaks ties.
        return item["stars"] + max(0, 180 - days) * 0.6
    ranked = sorted(repos.values(), key=score, reverse=True)
    return ranked[:10]

def main() -> None:
    now = dt.datetime.now(TZ)
    news: list[dict] = []
    source_success = 0
    for source, url in FEEDS:
        items = parse_feed(source, url)
        if items:
            source_success += 1
        for item in items:
            if AI_TERMS.search(item["title"] + " " + item["summary"]):
                news.append(item)
    # Deduplicate URLs and near-identical titles, prefer the first successful source.
    unique: dict[str, dict] = {}
    for item in news:
        key = re.sub(r"[^a-z0-9]+", "", item["title"].lower())[:100]
        if item["url"] and key and key not in unique:
            unique[key] = item
    cutoff = now.astimezone(dt.timezone.utc) - dt.timedelta(days=7)
    items = list(unique.values())
    recent = [x for x in items if not x["published"] or dt.datetime.fromisoformat(x["published"].replace("Z", "+00:00")) >= cutoff]
    recent.sort(key=lambda x: x.get("published") or "", reverse=True)
    skills = collect_skills()
    report = {
        "product": "Davy Radar",
        "report_date": now.strftime("%Y-%m-%d"),
        "timezone": "Asia/Shanghai",
        "generated_at": now.isoformat(),
        "status": "ok" if source_success else "partial",
        "sources_ok": source_success,
        "sources_total": len(FEEDS),
        "news": recent[:20],
        "skills": skills,
        "method": {
            "news_sources": "public RSS feeds; links and published timestamps preserved",
            "skill_ranking": "public GitHub repository stars with a modest freshness adjustment; not install counts",
        },
    }
    DATA.mkdir(parents=True, exist_ok=True)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    latest = DATA / "latest.json"
    latest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    archive_file = ARCHIVE / f"{now.strftime('%Y-%m-%d')}.json"
    archive_file.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    history = sorted((p.name for p in ARCHIVE.glob("*.json")), reverse=True)[:30]
    (DATA / "history.json").write_text(json.dumps({"days": history}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built Davy Radar: {len(recent[:20])} news, {len(skills)} skills, feeds {source_success}/{len(FEEDS)}")

if __name__ == "__main__":
    main()
