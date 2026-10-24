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
try:
    from radar.scripts.skill_radar import build_radar, canonical_project_id, classify_skill_type, identify_duplicate, load_recommendation_history, score_candidate
except ModuleNotFoundError:
    from skill_radar import build_radar, canonical_project_id, classify_skill_type, identify_duplicate, load_recommendation_history, score_candidate

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
SKILL_RADAR_DIAGNOSTICS: dict = {"status": "not_run"}

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

def collect_hackernews_skill_signals(repo_names: list[str]) -> dict:
    """Collect independent 7-day Hacker News evidence; match only exact owner/repo mentions."""
    now_epoch=int(dt.datetime.now(dt.timezone.utc).timestamp())
    cutoff=now_epoch-7*86400
    queries=("agent skills","Claude Code skills","Codex skills")
    indexed={name.lower():{"source":"Hacker News Algolia","count_7d":0,"evidence_urls":[],"checked_at":dt.datetime.now(TZ).isoformat()} for name in repo_names}
    successful=0
    for query in queries:
        url="https://hn.algolia.com/api/v1/search_by_date?"+urllib.parse.urlencode({
            "query":query,"tags":"story","numericFilters":f"created_at_i>{cutoff}","hitsPerPage":100
        })
        try:
            payload=json.loads(http_get(url,"application/json",timeout=8))
            successful+=1
            for hit in payload.get("hits",[]):
                haystack=" ".join(str(hit.get(k) or "") for k in ("title","url","story_text")).lower()
                story_url=str(hit.get("url") or "")
                object_id=str(hit.get("objectID") or "")
                for name in repo_names:
                    if name.lower() in haystack:
                        rec=indexed[name.lower()]
                        if story_url and story_url not in rec["evidence_urls"]:
                            rec["evidence_urls"].append(story_url)
                        elif object_id:
                            hn_url="https://news.ycombinator.com/item?id="+object_id
                            if hn_url not in rec["evidence_urls"]: rec["evidence_urls"].append(hn_url)
        except Exception as exc:
            print(f"[skill-community-warning] source=HackerNews query={query!r} error={type(exc).__name__}")
    for rec in indexed.values():
        rec["count_7d"]=len(rec["evidence_urls"])
        rec["status"]="observed" if rec["count_7d"] else "no_exact_match"
    return {"status":"ok" if successful else "unavailable","queries_succeeded":successful,"query_count":len(queries),"signals":indexed,"window_days":7}

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
        readme_text=readme.decode("utf-8",errors="replace") if isinstance(readme,bytes) else str(readme)
        skill_type=classify_skill_type(name,str(metadata.get("description") or item.get("description") or ""),readme_text)
        if not skill_type:
            print(f"[skill-warning] repository does not prove it contains installable Agent Skill files: {name}")
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
            "forks_total": int(metadata.get("forks_count") or 0),
            "pushed_at": metadata.get("pushed_at"),
            "created_at": metadata.get("created_at"),
            "open_issues_total": int(metadata.get("open_issues_count") or 0),
            "evidence_verified": True,
            "readme_verified": True,
            "evidence_checked_at": dt.datetime.now(TZ).isoformat(),
            "evidence_urls": [metadata.get("html_url", item.get("url", "")), base + "/readme"],
            "quality_status": "PASS",
            "skill_type": skill_type,
        }
    except Exception as exc:
        print(f"[skill-warning] repository verification {name}: {type(exc).__name__}")
        return None


def verify_material_update(candidate: dict, history_records: list[dict]) -> dict | None:
    """Permit a repeat only when a real release after the last recommendation proves a material change."""
    canonical=canonical_project_id(str(candidate.get("url") or candidate.get("name") or ""))
    if not canonical or not candidate.get("name"):
        return None
    prior_dates=[]
    for old in history_records:
        old_id=canonical_project_id(str(old.get("url") or old.get("repository_url") or old.get("name") or ""))
        if old_id==canonical and old.get("_history_date"):
            prior_dates.append(str(old["_history_date"]))
    if not prior_dates:
        return None
    last_recommended=max(prior_dates)
    api_url="https://api.github.com/repos/"+str(candidate["name"])+"/releases?per_page=3"
    try:
        releases=json.loads(http_get(api_url,"application/vnd.github+json",timeout=8))
    except Exception as exc:
        print(f"[skill-update-warning] release evidence unavailable for {candidate.get('name')}: {type(exc).__name__}")
        return None
    if not isinstance(releases,list):
        return None
    material_terms=re.compile(r"\b(security fix|security update|cve-\d{4}-\d+|breaking change|major release|new feature|now supports|support for|migration|critical bug fix|performance improvement)\b",re.I)
    for release in releases:
        if not isinstance(release,dict) or release.get("draft") or release.get("prerelease"):
            continue
        published=str(release.get("published_at") or "")[:10]
        if not published or published<=last_recommended:
            continue
        title=str(release.get("name") or release.get("tag_name") or "")
        body=str(release.get("body") or "")
        evidence=(title+"\n"+body).strip()
        if len(body.strip())<80 or not material_terms.search(evidence):
            continue
        return {
            "material_update_verified":True,
            "re_recommendation_reason":(title or "Verified material release")+" — release published after last recommendation",
            "material_update_evidence_url":str(release.get("html_url") or api_url),
            "last_release_at":published,
            "release_evidence_source":str(release.get("html_url") or api_url),
            "novelty_status":"material_update",
        }
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

    community_report = collect_hackernews_skill_signals(list(repos.keys()))
    for repo_name, signals in community_report["signals"].items():
        if repo_name in repos:
            repos[repo_name]["community_signals"] = signals
    SKILL_RADAR_DIAGNOSTICS["discovery_sources"] = {
        "github_repository_search": "available" if repos else "no_candidates",
        "hacker_news": {k:v for k,v in community_report.items() if k!="signals"},
        "github_candidate_count": len(repos),
    }

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

    today_text = today.isoformat()
    history = load_recommendation_history(ARCHIVE, today_text, 90)
    if history["status"] == "unavailable":
        SKILL_RADAR_DIAGNOSTICS.clear()
        SKILL_RADAR_DIAGNOSTICS.update({
            "status": "history_unavailable",
            "history": {k:v for k,v in history.items() if k!="records"},
            "selected_count": 0,
            "excluded_count": 0,
            "message": "Skill recommendation history could not be verified; no fresh Skill was selected.",
            "discovery_sources": {"github_repository_search": "available" if repos else "no_candidates", "hacker_news": {k:v for k,v in community_report.items() if k!="signals"}, "github_candidate_count": len(repos)}
        })
        print(f"[skill-error] history unavailable; refusing to recommend without history check: {history.get('errors')}")
        return []

    # Exclude all projects present in accessible 90-day history before spending API calls.
    eligible = []
    historical_exclusions = []
    release_checks = 0
    for candidate in ranked:
        hit = identify_duplicate(candidate, history["records"])
        if hit:
            update = verify_material_update(candidate, history["records"]) if release_checks < 8 else None
            if release_checks < 8:
                release_checks += 1
            if update:
                candidate.update(update)
                candidate["history_duplicate_match"] = hit
                eligible.append(candidate)
            else:
                historical_exclusions.append({"name": candidate.get("name"), "url": candidate.get("url"), "reason": "90-day history duplicate; no verified material release", "match": hit})
        else:
            eligible.append(candidate)

    # Verify every selected candidate's live repository metadata, license and README.
    # The unverified search-result pool is never published as if it passed review.
    verified = []
    verification_failures = []
    for candidate in eligible[:60]:
        result = verify_skill_candidate(candidate)
        if not result:
            verification_failures.append({"name": candidate.get("name"), "url": candidate.get("url"), "reason": "repository/license/README verification failed"})
            continue
        if not result.get("material_update_verified"):
            result["novelty_status"] = "new"
        result = score_candidate(result, today_text)
        result["quality_status"] = "PASS" if result.get("license") and result.get("readme_verified") and result.get("evidence_verified") else "FAIL"
        verified.append(result)
        if len(verified) >= 15:
            break

    # Keep the established first-item featured Skill contract while returning only
    # evidence-verified projects that passed historical and same-day deduplication.
    radar = build_radar(verified, ARCHIVE, today_text, limit=10)
    selected = radar.get("selected", [])
    if selected:
        selected[0]["daily_theme"] = theme_name
    final_status = radar.get("status", "unknown") if selected else "NO_QUALIFIED_CANDIDATES"
    SKILL_RADAR_DIAGNOSTICS.clear()
    SKILL_RADAR_DIAGNOSTICS.update({
        "status": final_status,
        "discovery_sources": {"github_repository_search": "available" if repos else "no_candidates", "hacker_news": {k:v for k,v in community_report.items() if k!="signals"}, "github_candidate_count": len(repos)},
        "history": radar.get("history", {}),
        "candidate_count": len(repos),
        "history_duplicate_exclusions": historical_exclusions,
        "verification_failures": verification_failures,
        "selected_count": len(selected),
        "excluded_count": len(historical_exclusions) + len(verification_failures) + len(radar.get("excluded", [])),
        "excluded": radar.get("excluded", []),
        "scoring_model": {
            "weights": {"recent_heat_and_growth":25,"ai_trend_relevance":20,"practical_usefulness":20,"technical_quality":15,"novelty":10,"maintenance":10},
            "growth_data_policy": "No historical Stars snapshots are available; 7-day and 30-day growth remain null rather than estimated from cumulative Stars."
        },
        "limitations": ["Only accessible archived recommendation days can be checked; incomplete 90-day coverage is explicitly reported.", "Repository metadata and README were checked; installation and dedicated security audits were not performed."]
    })
    if not selected:
        print(f"[skill-warning] no candidates passed evidence, freshness and duplicate gates; pool={len(repos)} verified={len(verified)} historical_exclusions={len(historical_exclusions)}")
        return []
    print(f"[skill-pick] date={today_text} theme={theme_name} selected={len(selected)} verified={len(verified)} historical_exclusions={len(historical_exclusions)} history={history['status']} coverage_days={history['coverage_days']}")
    return selected

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
        "skill_radar": SKILL_RADAR_DIAGNOSTICS,
        "method": {
            "news_sources": "public RSS feeds; links and published timestamps preserved",
            "china_ai_news_sources": "QbitAI, Machine Heart, GeekPark, 36Kr, Leiphone AI/robotics/chips, iFanr and AIquanbao public RSS; filtered for China-related AI entities and timestamps within seven days",
            "china_ai_news_minimum": CHINA_NEWS_MIN,
            "china_ai_news_target": CHINA_NEWS_TARGET,
            "china_ai_news_window_days": CHINA_NEWS_WINDOW_DAYS,
            "skill_ranking": "evidence-verified GitHub repositories ranked by weighted heat, trend relevance, practical usefulness, technical quality, novelty and maintenance; current cumulative Stars are not treated as historical growth",
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
