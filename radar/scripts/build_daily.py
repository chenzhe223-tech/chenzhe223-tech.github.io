#!/usr/bin/env python3
"""Build Davy Radar daily data from public RSS feeds and GitHub repository search.
No API key is required; GitHub unauthenticated API limits apply.
"""
from __future__ import annotations
import datetime as dt
import difflib
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
    # Core Chinese AI media
    ("量子位", "https://www.qbitai.com/feed"),
    ("机器之心", "https://www.jiqizhixin.com/rss"),
    ("极客公园", "https://www.geekpark.net/rss"),
    # Additional independent publishers to reduce one-source concentration
    ("36氪", "https://36kr.com/feed"),
    ("雷峰网·人工智能", "https://www.leiphone.com/feed/categoryRss/name/ai"),
    ("雷峰网·机器人", "https://www.leiphone.com/feed/categoryRss/name/robot"),
    ("雷峰网·芯片", "https://www.leiphone.com/feed/categoryRss/name/chips"),
    ("爱范儿", "https://www.ifanr.com/feed"),
    # Curated Chinese AI feed used as a supplementary discovery source
    ("AI圈报", "https://chenqiyuan.cn/rss.xml"),
]
CHINA_NEWS_MIN = 6
CHINA_NEWS_TARGET = 8
CHINA_NEWS_MAX = 10
CHINA_NEWS_WINDOW_DAYS = 7

CHINA_AI_TERMS = re.compile(
    r"(人工智能|生成式|大模型|大语言模型|智能体|AI|LLM|模型|机器人|具身智能|算力|芯片|智驾|"
    r"DeepSeek|Qwen|Kimi|GLM|MiniMax|AIGC|多模态|世界模型|AI应用|AI产品|AI手机|AI眼镜|AI PC)", re.I
)
CHINA_ENTITY_TERMS = re.compile(
    r"(中国|国内|国产|本土|DeepSeek|深度求索|通义|千问|Qwen|阿里云|阿里巴巴|腾讯混元|混元|豆包|"
    r"字节跳动|火山引擎|智谱|GLM|Kimi|月之暗面|MiniMax|稀宇|阶跃星辰|StepFun|"
    r"百川智能|百度文心|文心一言|昆仑芯|华为盘古|昇腾|寒武纪|沐曦|摩尔线程|壁仞|"
    r"天数智芯|讯飞星火|科大讯飞|智源研究院|中国人工智能|国产大模型|中国大模型|"
    r"国产芯片|清华|北大|中科院|商汤|燧原|元宝|元器|人形机器人|智驾|小米|荣耀|联想|"
    r"OPPO|vivo|蚂蚁集团|面壁智能|生数科技|零一万物|硅基流动|云知声|银河通用|"
    r"智平方|星动纪元|宇树科技|傅利叶|松延动力|智元机器人|追觅|"
    r"中国团队|中国研究员|中国科学家|中国企业|国产AI)",
    re.I
)
AI_TERMS = re.compile(r"\b(ai|artificial intelligence|llm|large language model|agent|agents|skill|model|openai|anthropic|claude|gpt|gemini|deepseek|hugging face|machine learning|生成式|人工智能|大模型|智能体|开源模型)\b", re.I)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")

HISTORY_DEDUPE_COUNTS = {"global_removed": 0, "china_removed": 0, "matches": []}

def _story_url_key(item: dict) -> str:
    raw = str(item.get("url") or item.get("source_url") or item.get("link") or "").strip()
    try:
        p = urllib.parse.urlsplit(raw)
        if p.scheme not in ("http", "https") or not p.hostname:
            return ""
        host = p.hostname.lower().removeprefix("www.")
        path = re.sub(r"/+", "/", p.path).rstrip("/")
        return urllib.parse.urlunsplit(("https", host, path, "", ""))
    except Exception:
        return ""

def _story_title(item: dict) -> str:
    return clean(str(item.get("title_zh") or item.get("title") or item.get("title_en") or item.get("original_title") or ""))

def _story_tokens(text: str) -> set[str]:
    value = re.sub(r"https?://\S+", " ", (text or "").lower())
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", value)
    words = {x for x in value.split() if len(x) > 1 and x not in {"the","and","for","with","from","this","that","news","update","updates","ai","model","models","company","announces","announced"}}
    # Chinese text commonly has no spaces; add character bigrams to capture paraphrases.
    compact = re.sub(r"\s+", "", value)
    words.update(compact[i:i+2] for i in range(max(0, len(compact)-1)) if re.search(r"[\u4e00-\u9fff]", compact[i:i+2]))
    return words

def _history_stories(today: str) -> list[dict]:
    if not ARCHIVE.exists():
        raise RuntimeError("Historical archive directory missing; cannot certify news freshness.")
    paths = sorted(ARCHIVE.glob("*.json"))
    if not paths:
        raise RuntimeError("No historical archive records; cannot certify news freshness.")
    records = []
    for path in paths:
        if path.stem == today:
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(doc, dict):
                raise ValueError("archive root is not an object")
        except Exception as exc:
            raise RuntimeError(f"Cannot read historical archive {path.name}: {type(exc).__name__}") from exc
        for section in ("news", "top5", "china_ai_news", "china_news", "top_news"):
            values = doc.get(section, [])
            if not isinstance(values, list):
                continue
            for item in values:
                if isinstance(item, dict) and _story_title(item):
                    record = dict(item)
                    record["_history_date"] = path.stem
                    record["_history_section"] = section
                    records.append(record)
    return records

def _duplicate_match(candidate: dict, history: list[dict]) -> dict | None:
    title = _story_title(candidate)
    url = _story_url_key(candidate)
    tokens = _story_tokens(title)
    for old in history:
        old_url = _story_url_key(old)
        if url and old_url and url == old_url:
            return {"kind":"same_url","date":old.get("_history_date"),"title":_story_title(old),"url":old.get("url")}
        old_title = _story_title(old)
        if not title or not old_title:
            continue
        if re.sub(r"[^a-z0-9\\u4e00-\\u9fff]", "", title.lower()) == re.sub(r"[^a-z0-9\\u4e00-\\u9fff]", "", old_title.lower()):
            return {"kind":"same_title","date":old.get("_history_date"),"title":old_title,"url":old.get("url")}
        ratio = difflib.SequenceMatcher(None, title.lower(), old_title.lower()).ratio()
        old_tokens = _story_tokens(old_title)
        overlap = len(tokens & old_tokens) / max(1, min(len(tokens), len(old_tokens)))
        if ratio >= 0.86 or (overlap >= 0.78 and len(tokens & old_tokens) >= 4):
            return {"kind":"near_title_or_event","score":round(max(ratio, overlap),3),"date":old.get("_history_date"),"title":old_title,"url":old.get("url")}
    return None

def filter_historical_duplicates(items: list[dict], section: str, today: str) -> list[dict]:
    history = _history_stories(today)
    kept, matches = [], []
    for item in items:
        match = _duplicate_match(item, history)
        if match:
            matches.append({"section":section,"candidate":_story_title(item),"match":match})
        else:
            kept.append(item)
    HISTORY_DEDUPE_COUNTS["matches"].extend(matches)
    if section == "china_ai_news":
        HISTORY_DEDUPE_COUNTS["china_removed"] += len(matches)
    else:
        HISTORY_DEDUPE_COUNTS["global_removed"] += len(matches)
    if matches:
        print(f"[history-dedupe] section={section} removed={len(matches)}")
    return kept

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
            if medium == "image" or mime.startswith("image/") or re.search(r"\.(?:png|jpe?g|webp|avif)(?:[?#]|$)", candidate, re.I):
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
        r"<img[^>]+(?:src|data-src)=[\"'](https?://[^\"']+)[\"']",
        r"<img[^>]+(?:src|data-src)=[\"'](//[^\"']+)[\"']",
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
    if re.search(r"(芯片|算力|昇腾|寒武纪|摩尔线程|沐曦|昆仑芯|数据中心|GPU|光模块)", value, re.I):
        return "芯片与算力"
    if re.search(r"(机器人|具身智能|人形|智驾|自动驾驶|智能汽车|智能眼镜|AI手机|智能终端)", value, re.I):
        return "具身智能与智能终端"
    if re.search(r"(发布|开源|模型|推理|多模态|训练|参数|基准|benchmark)", value, re.I):
        return "模型与技术进展"
    if re.search(r"(落地|应用|上线|办公|教育|医疗|制造|电商|企业)", value, re.I):
        return "产品与产业应用"
    return "产业与生态"

def rank_diverse_china_items(candidates: list[dict]) -> list[dict]:
    """Deduplicate source-backed stories and prefer source diversity before relaxing caps."""
    unique: list[dict] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for item in candidates:
        raw_url = str(item.get("url") or "")
        url = raw_url.split("#", 1)[0].rstrip("/")
        title_key = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", str(item.get("title") or "").lower())
        if not url or url in seen_urls or (title_key and title_key in seen_titles):
            continue
        item = {**item, "url": url}
        unique.append(item)
        seen_urls.add(url)
        if title_key:
            seen_titles.add(title_key)

    ranked = sorted(unique, key=lambda x: x.get("published", ""), reverse=True)
    if not ranked:
        return []

    def publisher_key(item: dict) -> str:
        host = (urllib.parse.urlparse(str(item.get("url") or "")).hostname or "").lower()
        host = host.removeprefix("www.")
        return host or str(item.get("source") or "unknown")

    selected: list[dict] = []
    selected_urls: set[str] = set()
    # Aim for eight stories, with at most two per publisher initially. Relax to three,
    # then fill from all verified candidates only if the source mix is too small.
    for cap in (2, 3, len(ranked)):
        counts: dict[str, int] = {}
        for item in selected:
            key = publisher_key(item)
            counts[key] = counts.get(key, 0) + 1
        for item in ranked:
            url = item["url"]
            if url in selected_urls:
                continue
            publisher = publisher_key(item)
            if counts.get(publisher, 0) >= cap:
                continue
            selected.append(item)
            selected_urls.add(url)
            counts[publisher] = counts.get(publisher, 0) + 1
            if len(selected) >= CHINA_NEWS_TARGET or len(selected) >= CHINA_NEWS_MAX:
                break
        if len(selected) >= CHINA_NEWS_TARGET or len(selected) >= CHINA_NEWS_MAX:
            break
    return selected[:CHINA_NEWS_MAX]


def collect_china_ai_news(now: dt.datetime) -> tuple[list[dict], int]:
    """Collect recent, source-linked China AI developments; do not synthesize missing stories."""
    candidates: list[dict] = []
    sources_ok = 0
    cutoff = now.astimezone(dt.timezone.utc) - dt.timedelta(days=CHINA_NEWS_WINDOW_DAYS)
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

    candidates = filter_historical_duplicates(candidates, "china_ai_news", now.astimezone(TZ).date().isoformat())
    ranked = rank_diverse_china_items(candidates)
    if len(ranked) < CHINA_NEWS_MIN:
        print(
            f"[china-warning] Only {len(ranked)} verified China AI stories found; "
            f"minimum required is {CHINA_NEWS_MIN}. Add or restore sources rather than inventing stories."
        )
    return ranked, sources_ok

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

def verify_skill_candidate(item: dict) -> dict | None:
    """Verify the featured Skill project has a recognized license and a readable README.

    A GitHub search result alone is not enough to recommend a Skill. Query the live
    repository metadata for its SPDX license, then require its README endpoint to
    return substantive content. If either check cannot be proved, fail closed.
    """
    name = str(item.get("name") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", name):
        return None
    base = "https://api.github.com/repos/" + name
    try:
        metadata = json.loads(http_get(base, "application/vnd.github+json", timeout=8))
        if not metadata.get("full_name") or metadata.get("archived") or metadata.get("fork"):
            return None
        license_info = metadata.get("license") or {}
        license_id = str(license_info.get("spdx_id") or "").strip()
        if not license_id or license_id.upper() in {"NOASSERTION", "OTHER"}:
            print(f"[skill-warning] no recognized license: {name}")
            return None
        readme = http_get(base + "/readme", "application/vnd.github.raw+json", timeout=8)
        if len(readme.strip()) < 80:
            print(f"[skill-warning] README missing or too small: {name}")
            return None
        return {
            **item,
            "name": metadata.get("full_name", name),
            "url": metadata.get("html_url", item.get("url", "")),
            "description": clean(metadata.get("description") or item.get("description") or ""),
            "stars": int(metadata.get("stargazers_count") or item.get("stars") or 0),
            "updated": metadata.get("updated_at") or item.get("updated", ""),
            "license": license_id,
            "license_name": str(license_info.get("name") or license_id),
        }
    except Exception as exc:
        print(f"[skill-warning] repository verification {name}: {type(exc).__name__}")
        return None


def collect_skills() -> list[dict]:
    """Collect a broad Skill candidate pool and rotate the featured pick by daily theme.

    The first item is the site's featured Skill, so it must not be a popularity-only
    leaderboard. We deliberately vary editorial dimensions and avoid repeating a
    featured repository from the previous seven archived reports where possible.
    """
    daily_themes = [
        ("开发提效", ("coding", "development", "debug", "testing", "refactor", "engineering", "workflow")),
        ("设计与前端", ("design", "ui", "ux", "frontend", "web", "visual", "accessibility")),
        ("数据与看板", ("data", "analytics", "dashboard", "visualization", "spreadsheet", "sql", "chart")),
        ("研究与资讯", ("research", "search", "news", "browser", "sources", "summarize", "web")),
        ("内容与表达", ("writing", "content", "documentation", "marketing", "copywriting", "presentation")),
        ("自动化与浏览器", ("automation", "browser", "playwright", "workflow", "computer-use", "scraping")),
        ("产品创意与原型", ("product", "prototype", "idea", "planning", "prd", "productivity", "startup")),
    ]
    # Use the local report date, not UTC, so the editorial theme changes at Beijing midnight.
    today = dt.datetime.now(TZ).date()
    theme_name, theme_terms = daily_themes[today.toordinal() % len(daily_themes)]
    queries = [
        "agent skills AI in:name,description",
        "claude skills in:name,description",
        "agent-skills in:name,description",
        "awesome-copilot in:name,description",
        "AI coding agent skill design UI UX",
        "AI agent skill data analytics dashboard",
        "AI agent skill research news search",
        "AI agent skill writing documentation marketing",
        "AI agent skill browser automation testing",
        "AI agent skill product planning prototype",
    ]
    repos: dict[str, dict] = {}
    for query in queries:
        for r in github_search(query):
            name = r.get("full_name", "")
            description = clean(r.get("description") or "")
            topics = r.get("topics") or []
            combined = (name + " " + description + " " + " ".join(topics)).lower()
            if not name or not any(k in combined for k in ("skill", "skills", "agent", "copilot", "workflow")):
                continue
            if r.get("fork") or r.get("archived"):
                continue
            repos[name.lower()] = {
                "name": r.get("full_name", name),
                "url": r.get("html_url", ""),
                "description": description[:360],
                "stars": int(r.get("stargazers_count") or 0),
                "updated": r.get("updated_at", ""),
                "language": r.get("language") or "Multi-language",
                "topics": topics[:8],
                "daily_theme": theme_name,
                "license": str(((r.get("license") or {}).get("spdx_id")) or ""),
            }
        time.sleep(0.2)

    now = dt.datetime.now(dt.timezone.utc)
    def score(item: dict) -> float:
        try:
            updated = dt.datetime.fromisoformat(item.get("updated", "").replace("Z", "+00:00"))
            days = max(0, (now - updated).total_seconds() / 86400)
        except Exception:
            days = 365
        combined = (item.get("name", "") + " " + item.get("description", "") + " " +
                    " ".join(item.get("topics") or [])).lower()
        theme_hits = sum(1 for term in theme_terms if term in combined)
        # Theme relevance has real weight; stars are only a modest quality signal.
        return theme_hits * 1800 + min(int(item.get("stars") or 0), 100000) * 0.015 + max(0, 120 - days) * 0.8

    ranked = sorted(
        (item for item in repos.values()
         if item.get("license") and item["license"].upper() not in {"NOASSERTION", "OTHER"}),
        key=score,
        reverse=True,
    )

    # Read recent archive picks so the featured Skill doesn't repeat every day.
    recent_picks: list[str] = []
    try:
        archive_files = sorted(ARCHIVE.glob("*.json"), reverse=True)
        for archive_path in archive_files[:8]:
            if archive_path.stem == today.isoformat():
                continue
            try:
                previous = json.loads(archive_path.read_text(encoding="utf-8"))
                previous_skills = previous.get("skills") or []
                if previous_skills and previous_skills[0].get("name"):
                    recent_picks.append(previous_skills[0]["name"].lower())
            except Exception:
                continue
    except Exception:
        pass

    theme_ranked = [
        item for item in ranked
        if any(term in (item.get("name", "") + " " + item.get("description", "") + " " +
                        " ".join(item.get("topics") or [])).lower() for term in theme_terms)
    ]
    # Prefer a theme-relevant project not featured recently, but verify the
    # selected repository's SPDX license and README against the live GitHub API.
    featured = None
    verification_queue = [item for item in theme_ranked if item["name"].lower() not in recent_picks]
    verification_queue += [item for item in ranked if item["name"].lower() not in recent_picks
                           and item["name"].lower() not in {x["name"].lower() for x in verification_queue}]
    for candidate in verification_queue:
        featured = verify_skill_candidate(candidate)
        if featured:
            break

    if featured is None:
        # Search API may be rate-limited. Verify curated candidates live rather than
        # inventing metrics or describing unverified repositories as current.
        fallback_names = (
            "obra/superpowers", "anthropics/skills", "github/awesome-copilot",
            "browser-use/browser-use", "microsoft/playwright-mcp",
            "openai/openai-cookbook", "nextlevelbuilder/ui-ux-pro-max-skill",
        )
        fallback_items = []
        for full_name in fallback_names:
            try:
                payload = json.loads(http_get(
                    "https://api.github.com/repos/" + full_name,
                    "application/vnd.github+json",
                    timeout=8,
                ))
                actual_name = payload.get("full_name", "")
                license_info = payload.get("license") or {}
                license_id = str(license_info.get("spdx_id") or "").strip()
                if (not actual_name or payload.get("archived") or payload.get("fork")
                        or not license_id or license_id.upper() in {"NOASSERTION", "OTHER"}):
                    continue
                if actual_name.lower() in recent_picks and len(fallback_names) > len(recent_picks):
                    continue
                fallback_items.append({
                    "name": actual_name,
                    "url": payload.get("html_url", ""),
                    "description": clean(payload.get("description") or "Open-source AI workflow project"),
                    "stars": int(payload.get("stargazers_count") or 0),
                    "updated": payload.get("updated_at", ""),
                    "language": payload.get("language") or "Multi-language",
                    "topics": (payload.get("topics") or ["agent-skills"])[:8],
                    "daily_theme": theme_name,
                    "license": license_id,
                    "license_name": str(license_info.get("name") or license_id),
                })
            except Exception as exc:
                print(f"[skill-warning] curated metadata {full_name}: {type(exc).__name__}")
        ranked = sorted(fallback_items, key=score, reverse=True)
        for candidate in ranked:
            if candidate["name"].lower() in recent_picks:
                continue
            featured = verify_skill_candidate(candidate)
            if featured:
                break

    if featured is None:
        # No current project could be verified. Return only verified search results
        # and expose a warning; never claim that a repeated pick is new.
        print(f"[skill-warning] no Skill candidate passed live license/README verification for theme {theme_name}; candidate pool={len(ranked)}")
        return []

    featured["daily_theme"] = theme_name
    # Keep the featured pick first for the current page contract; remaining entries
    # are a useful popularity/activity shortlist, with the featured project removed.
    remaining = [item for item in ranked if item["name"].lower() != featured["name"].lower()]
    result = [featured] + remaining[:9]
    print(f"[skill-pick] date={today.isoformat()} theme={theme_name} featured={featured['name']} recent_exclusions={len(recent_picks)} candidates={len(ranked)}")
    return result

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
    recent = filter_historical_duplicates(recent, "global_news", now.astimezone(TZ).date().isoformat())
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
        "historical_dedupe": {
            "status": "ok",
            "global_removed": HISTORY_DEDUPE_COUNTS["global_removed"],
            "china_removed": HISTORY_DEDUPE_COUNTS["china_removed"],
            "matches": HISTORY_DEDUPE_COUNTS["matches"],
            "history_archive_files": len(list(ARCHIVE.glob("*.json"))) if ARCHIVE.exists() else 0,
        },
        "china_sources_ok": china_sources_ok,
        "china_sources_total": len(CHINA_FEEDS),
        "skills": skills,
        "method": {
            "news_sources": "public RSS feeds; links and published timestamps preserved",
            "china_ai_news_sources": "QbitAI, Machine Heart, GeekPark, 36Kr, Leiphone AI/robotics/chips, iFanr and AIquanbao public RSS; filtered for China-related AI entities and timestamps within seven days",
            "china_ai_news_minimum": CHINA_NEWS_MIN,
            "china_ai_news_target": CHINA_NEWS_TARGET,
            "china_ai_news_window_days": CHINA_NEWS_WINDOW_DAYS,
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
    print(f"Built Davy Radar: {len(recent[:20])} global news, {len(china_ai_news)} China AI news (minimum {CHINA_NEWS_MIN}, target {CHINA_NEWS_TARGET}), {len(skills)} skills; feeds {source_success}/{len(FEEDS)} global, {china_sources_ok}/{len(CHINA_FEEDS)} China")

if __name__ == "__main__":
    main()
