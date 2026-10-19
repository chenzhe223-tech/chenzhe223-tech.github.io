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
# Chinese-language sources for a separately curated China AI development stream.
CHINA_FEEDS = [
    ("量子位", "https://www.qbitai.com/feed"),
    ("机器之心", "https://www.jiqizhixin.com/rss"),
    ("极客公园", "https://www.geekpark.net/rss"),
]
CHINA_AI_TERMS = re.compile(
    r"(人工智能|生成式|大模型|智能体|AI|LLM|模型|机器人|具身智能|算力|芯片|智驾|"
    r"DeepSeek|Qwen|Kimi|GLM|MiniMax|AI应用|AI产品)", re.I
)
CHINA_ENTITY_TERMS = re.compile(
    r"(中国|国内|国产|DeepSeek|深度求索|通义|千问|Qwen|阿里云|腾讯混元|混元|豆包|"
    r"字节跳动|火山引擎|智谱|GLM|Kimi|月之暗面|MiniMax|稀宇|阶跃星辰|StepFun|"
    r"百川智能|百度文心|文心一言|昆仑芯|华为盘古|昇腾|寒武纪|沐曦|摩尔线程|壁仞|"
    r"天数智芯|讯飞星火|科大讯飞|智源研究院|中国人工智能|国产大模型|中国大模型|"
    r"国产芯片|清华|北大|中科院|商汤|燧原|元宝|元器|人形机器人|智驾)",
    re.I
)
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

def normalize_image_url(value: str) -> str:
    value = (value or "").strip()
    if value.startswith("//"):
        value = "https:" + value
    if value.startswith("http://"):
        value = "https://" + value[len("http://"):]
    try:
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme == "https" and parsed.netloc and not any(ch in value for ch in ('"', "'", "<", ">", "\n")):
            return value
    except Exception:
        pass
    return ""

def feed_image(item: ET.Element, raw_html: str = "") -> str:
    # Prefer editorial thumbnails/enclosures provided by the source feed.
    thumbnails: list[str] = []
    media_images: list[str] = []
    for node in item.iter():
        local = node.tag.rsplit("}", 1)[-1].lower() if isinstance(node.tag, str) else ""
        candidate = node.attrib.get("url") or node.attrib.get("href") or ""
        if local == "enclosure":
            mime = node.attrib.get("type", "").lower()
            if mime.startswith("image/") and candidate:
                thumbnails.append(candidate)
        elif local == "thumbnail" and candidate:
            thumbnails.append(candidate)
        elif local == "content" and candidate:
            mime = node.attrib.get("type", "").lower()
            medium = node.attrib.get("medium", "").lower()
            if medium == "image" or mime.startswith("image/") or re.search(r"\\.(?:png|jpe?g|webp|avif)(?:[?#]|$)", candidate, re.I):
                media_images.append(candidate)
        elif local == "image" and candidate:
            thumbnails.append(candidate)
    for candidate in thumbnails + media_images:
        normalized = normalize_image_url(candidate)
        if normalized:
            return normalized

    # Some RSS feeds only include HTML in description/content:encoded.
    html = raw_html or ""
    patterns = [
        r"""<img[^>]+(?:src|data-src)=['"](https?://[^'"]+)['"]""",
        r"""<img[^>]+(?:src|data-src)=['"](//[^'"]+)['"]""",
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.I)
        if match:
            normalized = normalize_image_url(match.group(1))
            if normalized:
                return normalized
    return ""

def parse_feed(source: str, url: str, timeout: int = 18) -> list[dict]:
    try:
        root = ET.fromstring(http_get(url, "application/rss+xml, application/atom+xml, application/xml, text/xml", timeout=timeout))
    except Exception as exc:
        print(f"[feed-warning] {source}: {type(exc).__name__}")
        return []
    entries = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title", ""))
        link = clean(item.findtext("link", ""))
        raw_summary = item.findtext("description", "") or item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded", "")
        image_url = feed_image(item, raw_summary)
        summary = clean(raw_summary)
        published = parse_date(item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date"))
        if title and link:
            entry = {"title": title, "url": link, "summary": summary[:360], "published": published, "source": source}
            if image_url:
                entry["image_url"] = image_url
            entries.append(entry)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    if not entries:
        for item in root.findall(".//atom:entry", ns):
            title = clean(item.findtext("atom:title", "", ns))
            link_el = item.find("atom:link", ns)
            link = link_el.attrib.get("href", "") if link_el is not None else ""
            raw_summary = item.findtext("atom:summary", "", ns) or item.findtext("atom:content", "", ns)
            image_url = feed_image(item, raw_summary)
            summary = clean(raw_summary)
            published = parse_date(item.findtext("atom:published", "", ns) or item.findtext("atom:updated", "", ns))
            if title and link:
                entry = {"title": title, "url": link, "summary": summary[:360], "published": published, "source": source}
                if image_url:
                    entry["image_url"] = image_url
                entries.append(entry)
    return entries

def classify_china_topic(text: str) -> str:
    value = text.lower()
    if re.search(r"(芯片|算力|昇腾|寒武纪|摩尔线程|沐曦|昆仑芯|数据中心)", value, re.I):
        return "芯片与算力"
    if re.search(r"(机器人|具身智能|人形|智驾|自动驾驶|智能汽车)", value, re.I):
        return "具身智能与智能终端"
    if re.search(r"(发布|开源|模型|推理|多模态|训练|参数|基准|benchmark)", value, re.I):
        return "模型与技术进展"
    if re.search(r"(落地|应用|上线|办公|教育|医疗|制造|电商|企业)", value, re.I):
        return "产品与产业应用"
    return "产业与生态"

def collect_china_ai_news(now: dt.datetime) -> tuple[list[dict], int]:
    """Collect recent, source-linked China AI developments; do not synthesize missing stories."""
    candidates: list[dict] = []
    sources_ok = 0
    cutoff = now.astimezone(dt.timezone.utc) - dt.timedelta(days=7)
    for source, url in CHINA_FEEDS:
        items = parse_feed(source, url, timeout=12)
        if items:
            sources_ok += 1
        for item in items:
            title = item.get("title", "")
            summary = item.get("summary", "")
            combined = title + " " + summary
            if not CHINA_AI_TERMS.search(combined) or not CHINA_ENTITY_TERMS.search(combined):
                continue
            published = item.get("published", "")
            try:
                stamp = dt.datetime.fromisoformat(published.replace("Z", "+00:00"))
                if stamp.tzinfo is None:
                    stamp = stamp.replace(tzinfo=dt.timezone.utc)
                if stamp < cutoff or stamp > now.astimezone(dt.timezone.utc) + dt.timedelta(hours=6):
                    continue
            except Exception:
                # Unknown timestamps are omitted from this time-sensitive module.
                continue
            if not item.get("url", "").startswith("https://"):
                continue
            item["category"] = classify_china_topic(combined)
            item["published"] = stamp.astimezone(dt.timezone.utc).isoformat()
            item["region"] = "China"
            candidates.append(item)

    unique: dict[str, dict] = {}
    for item in candidates:
        url = item["url"].split("#", 1)[0].rstrip("/")
        title_key = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", item["title"].lower())
        key = url or title_key
        if key and key not in unique:
            unique[key] = item
    ranked = sorted(unique.values(), key=lambda x: x.get("published", ""), reverse=True)
    return ranked[:8], sources_ok

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
    if ranked:
        return ranked[:10]

    # Search API can be rate-limited independently of the repository API. Fall
    # back to a small curated list and query each repo's live metadata directly.
    print("[skill-warning] Repository search returned no results; trying curated repository metadata.")
    fallback_names = ("anthropics/skills", "obra/superpowers", "github/awesome-copilot")
    fallback_items = []
    for full_name in fallback_names:
        try:
            payload = json.loads(http_get(
                "https://api.github.com/repos/" + full_name,
                "application/vnd.github+json",
                timeout=8,
            ))
            if payload.get("full_name", "").lower() != full_name.lower() or payload.get("archived") or payload.get("fork"):
                continue
            fallback_items.append({
                "name": payload["full_name"],
                "url": payload["html_url"],
                "description": clean(payload.get("description") or "Public open-source Agent Skill project"),
                "stars": int(payload.get("stargazers_count") or 0),
                "updated": payload.get("updated_at", ""),
                "language": payload.get("language") or "Multi-language",
                "topics": (payload.get("topics") or ["agent-skills"])[:8],
            })
        except Exception as exc:
            print(f"[skill-warning] curated metadata {full_name}: {type(exc).__name__}")
    if fallback_items:
        return sorted(fallback_items, key=score, reverse=True)[:10]

    # Last resort: one known public repository, with unverified metrics omitted.
    # Do not fabricate popularity or activity numbers when GitHub is unavailable.
    return [{
        "name": "anthropics/skills",
        "url": "https://github.com/anthropics/skills",
        "description": "Public repository for Agent Skills. GitHub API was unavailable, so current popularity and update metadata were not verified.",
        "stars": None,
        "updated": "",
        "language": "Python",
        "topics": ["agent-skills"],
    }]

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
    china_ai_news, china_sources_ok = collect_china_ai_news(now)
    report = {
        "product": "Davy Radar",
        "report_date": now.strftime("%Y-%m-%d"),
        "timezone": "Asia/Shanghai",
        "generated_at": now.isoformat(),
        "status": "ok" if source_success else "partial",
        "sources_ok": source_success,
        "sources_total": len(FEEDS),
        "news": recent[:20],
        "china_ai_news": china_ai_news,
        "china_sources_ok": china_sources_ok,
        "china_sources_total": len(CHINA_FEEDS),
        "skills": skills,
        "method": {
            "news_sources": "public RSS feeds; links and published timestamps preserved",
            "china_ai_news_sources": "QbitAI, 36Kr and GeekPark public RSS; filtered for China-related AI entities and timestamps within seven days",
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
    print(f"Built Davy Radar: {len(recent[:20])} global news, {len(china_ai_news)} China AI news, {len(skills)} skills; feeds {source_success}/{len(FEEDS)} global, {china_sources_ok}/{len(CHINA_FEEDS)} China")

if __name__ == "__main__":
    main()
