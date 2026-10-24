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
    from radar.scripts.skill_radar import ENGINE_VERSION, actual_skill_files, build_radar, canonical_project_id, classify_skill_type, identify_duplicate, infer_skill_category, load_recommendation_history, enrich_growth_metrics, score_candidate
except ModuleNotFoundError:
    from skill_radar import ENGINE_VERSION, actual_skill_files, build_radar, canonical_project_id, classify_skill_type, identify_duplicate, infer_skill_category, load_recommendation_history, enrich_growth_metrics, score_candidate

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
    # Additional English-language coverage for Chinese AI labs and cross-border policy.
    ("动点科技 TechNode", "https://cn.technode.com/feed/"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("Google News China AI", "https://news.google.com/rss/search?q=DeepSeek+OR+Kimi+OR+Qwen+OR+MiniMax+OR+Moonshot+AI+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen"),
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
    r"中国团队|中国研究员|中国科学家|中国企业|国产AI|China|Chinese|Moonshot|Alibaba|Tencent|Huawei)",
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

def _story_title_variants(item: dict) -> list[str]:
    values=[]
    for key in ("title_zh","title_en","title","original_title"):
        value=clean(str(item.get(key) or ""))
        if value and value not in values: values.append(value)
    return values

def _story_tokens(text: str) -> set[str]:
    value = re.sub(r"https?://\S+", " ", (text or "").lower())
    value = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", " ", value)
    # Keep Latin/number tokens, but tokenize Chinese runs as bigrams below.
    words = {
        x for x in value.split()
        if len(x) > 1
        and x not in {"the","and","for","with","from","this","that","news","update","updates","ai","model","models","company","announces","announced"}
        and not re.fullmatch(r"[\u4e00-\u9fff]+", x)
    }
    # Generic Chinese headline phrasing is not evidence that two stories are the
    # same event. Exclude common bigrams and retain distinctive entities/actions.
    generic_cjk = {
        "同一","另一","一条","条中","中国","国ai","ai新","新闻","人工","工智","智能","能体",
        "大模","模型","型发","发布","最新","消息","产品","企业","公司","行业","技术","进展",
        "国产","开源","研究","推出","升级","合作","宣布","发展","全球","世界","功能","测试",
        "上线","接入","应用","芯片","算力","项目","平台","系统","方案","落地","方面"
    }
    compact = re.sub(r"\s+", "", value)
    words.update(
        compact[i:i+2]
        for i in range(max(0, len(compact)-1))
        if re.search(r"[\u4e00-\u9fff]", compact[i:i+2])
        and compact[i:i+2] not in generic_cjk
    )
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

def _near_match_is_recent(old: dict, current_date: str | None, window_days: int = 2) -> bool:
    """Only suppress near-identical events across the last two report dates.

    Exact URL/title matches remain duplicates across the full archive. Older stories
    may share a company or theme with a genuinely new development and should not
    exhaust the daily news pool.
    """
    raw_old_date = old.get("_history_date") or old.get("_current_date")
    if not raw_old_date:
        return True
    try:
        current = dt.date.fromisoformat(str(current_date)[:10]) if current_date else dt.datetime.now(TZ).date()
        previous = dt.date.fromisoformat(str(raw_old_date)[:10])
        age = (current - previous).days
        return 0 <= age <= window_days
    except Exception:
        return True

def _duplicate_match(candidate: dict, history: list[dict], current_date: str | None = None) -> dict | None:
    titles = _story_title_variants(candidate)
    url = _story_url_key(candidate)
    tokens = set().union(*(_story_tokens(x) for x in titles)) if titles else set()
    current_date = current_date or candidate.get("_current_date") or dt.datetime.now(TZ).date().isoformat()
    for old in history:
        old_url = _story_url_key(old)
        if url and old_url and url == old_url:
            return {"kind":"same_url","date":old.get("_history_date") or old.get("_current_date"),"title":_story_title(old),"url":old.get("url")}
        old_titles = _story_title_variants(old)
        for title in titles:
            for old_title in old_titles:
                normalized = lambda value: re.sub(r"\W", "", value.lower())
                if normalized(title) and normalized(title) == normalized(old_title):
                    return {"kind":"same_title","date":old.get("_history_date") or old.get("_current_date"),"title":old_title,"url":old.get("url")}
                if not _near_match_is_recent(old, current_date):
                    continue
                ratio = difflib.SequenceMatcher(None, title.lower(), old_title.lower()).ratio()
                old_tokens = _story_tokens(old_title)
                overlap = len(_story_tokens(title) & old_tokens) / max(1, min(len(_story_tokens(title)), len(old_tokens)))
                shared_tokens = _story_tokens(title) & old_tokens
                has_cjk = bool(re.search(r"[\u4e00-\u9fff]", title + old_title))
                # For Chinese/mixed headlines, require distinctive entity overlap;
                # sequence similarity alone over-collapses generic phrasing.
                near_match = (
                    (ratio >= 0.82 and (not has_cjk or len(shared_tokens) >= 3))
                    or (overlap >= 0.78 and len(shared_tokens) >= 4)
                )
                if near_match:
                    return {"kind":"near_title_or_event","score":round(max(ratio, overlap),3),"date":old.get("_history_date") or old.get("_current_date"),"title":old_title,"url":old.get("url")}
        if _near_match_is_recent(old, current_date):
            old_tokens = set().union(*(_story_tokens(x) for x in old_titles)) if old_titles else set()
            overlap = len(tokens & old_tokens) / max(1, min(len(tokens), len(old_tokens)))
            if overlap >= 0.84 and len(tokens & old_tokens) >= 5:
                return {"kind":"multilingual_title_overlap","score":round(overlap,3),"date":old.get("_history_date") or old.get("_current_date"),"title":_story_title(old),"url":old.get("url")}
    return None

def filter_historical_duplicates(items: list[dict], section: str, today: str) -> list[dict]:
    history = _history_stories(today)
    kept, matches = [], []
    for item in items:
        match = _duplicate_match(item, history, today)
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
    # Keep the freshest of near-identical headlines in the same day's module.
    today = dt.datetime.now(TZ).date().isoformat()
    deduped: list[dict] = []
    for item in ranked:
        prior = [{**old, "_current_date": today} for old in deduped]
        if _duplicate_match(item, prior, today):
            continue
        deduped.append(item)
    ranked = deduped
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
    # Recent-created/pushed searches must not inherit the default cumulative-Stars sort.
    sort = "updated" if re.search(r"\b(created|pushed):>", query) else "stars"
    url = "https://api.github.com/search/repositories?" + urllib.parse.urlencode({
        "q": query, "sort": sort, "order": "desc", "per_page": 30
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
        # Confirm the skill file actually exists in the repository tree; README claims alone are insufficient.
        branch=str(metadata.get("default_branch") or "main")
        tree_url=base+"/git/trees/"+urllib.parse.quote(branch,safe="")+"?recursive=1"
        tree=json.loads(http_get(tree_url,"application/vnd.github+json",timeout=8))
        paths=actual_skill_files(tree)
        if not paths:
            print(f"[skill-warning] no actual SKILL.md file found in repository tree: {name}")
            return None
        if len(paths)>1 or any("/skills/" in "/"+p.lower() for p in paths):
            skill_type="skill_pack"
        else:
            skill_type="agent_skill_or_pack"
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
            "actual_skill_file_count": len(paths),
            "skill_file_paths": paths[:12],
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
    recent_30 = (today - dt.timedelta(days=30)).isoformat()
    recent_7 = (today - dt.timedelta(days=7)).isoformat()
    queries = [
        "agent skills AI in:name,description",
        "claude skills in:name,description",
        "agent-skills in:name,description",
        "awesome-copilot in:name,description",
        f"agent skill created:>{recent_30}",
        f"SKILL.md created:>{recent_30}",
        f"agent skill pushed:>{recent_7}",
        "AI coding agent skill design UI UX",
        "AI agent skill data analytics dashboard",
        "AI agent skill browser automation testing",
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

    # Keep one live-verified, high-utility fallback in the candidate pool so a
    # noisy or exhausted search result set cannot leave the daily report without
    # any usable Skill. It still goes through the same history, license, README,
    # actual-SKILL-file, scoring and rare-value gates as every discovered project.
    fallback_repo = "cloudflare/security-audit-skill"
    if fallback_repo.lower() not in repos:
        try:
            metadata = json.loads(http_get(
                f"https://api.github.com/repos/{fallback_repo}",
                accept="application/vnd.github+json",
                timeout=12,
            ))
            license_data = metadata.get("license") or {}
            spdx = str(license_data.get("spdx_id") or "")
            if (metadata.get("full_name") and metadata.get("html_url")
                    and spdx and spdx.upper() not in {"NOASSERTION", "OTHER"}
                    and not metadata.get("fork") and not metadata.get("archived")):
                full_name = str(metadata["full_name"])
                repos[full_name.lower()] = {
                    "name": full_name,
                    "url": metadata["html_url"],
                    "description": clean(metadata.get("description") or "")[:360],
                    "stars": int(metadata.get("stargazers_count") or 0),
                    "updated": metadata.get("pushed_at") or metadata.get("updated_at", ""),
                    "language": metadata.get("language") or "Multi-language",
                    "topics": metadata.get("topics") or [],
                    "daily_theme": theme_name,
                    "license": spdx,
                }
        except Exception as exc:
            print(f"[skill-warning] curated fallback metadata unavailable: {type(exc).__name__}")

    community_report = collect_hackernews_skill_signals(list(repos.keys()))
    for repo_name, signals in community_report["signals"].items():
        if repo_name in repos:
            repos[repo_name]["community_signals"] = signals
    growth_report = enrich_growth_metrics(list(repos.values()), DATA / "skill-candidates", today.isoformat())
    SKILL_RADAR_DIAGNOSTICS["growth_snapshots"] = {k:v for k,v in growth_report.items() if k!="snapshot_file"}
    SKILL_RADAR_DIAGNOSTICS["growth_snapshots"]["snapshot_file"] = "data/skill-candidates/" + today.isoformat() + ".json"
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
        growth = item.get("stars_delta_7d")
        try: growth_bonus = min(1200, max(0, int(growth or 0)) * 2)
        except (TypeError, ValueError): growth_bonus = 0
        return theme_hits * 1800 + growth_bonus + min(int(item.get("stars") or 0), 100000) * 0.015 + max(0, 120 - days) * 0.8

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
            "growth_snapshots": {k:v for k,v in growth_report.items() if k!="snapshot_file"},
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
            update = verify_material_update(candidate, history["records"]) if release_checks < 4 else None
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

    # Verify the practical security-audit fallback first if it is not in the 90-day
    # recommendation history. The final rank is still determined by evidence-backed
    # quality scores; this only ensures the fallback is actually evaluated.
    fallback_keys = {"cloudflare/security-audit-skill"}
    eligible = [x for x in eligible if str(x.get("name") or "").lower() in fallback_keys] + [
        x for x in eligible if str(x.get("name") or "").lower() not in fallback_keys
    ]

    # Verify every selected candidate's live repository metadata, license and README.
    # The unverified search-result pool is never published as if it passed review.
    verified = []
    verification_failures = []
    for candidate in eligible[:15]:
        result = verify_skill_candidate(candidate)
        if not result:
            verification_failures.append({"name": candidate.get("name"), "url": candidate.get("url"), "reason": "repository/license/README verification failed"})
            continue
        if not result.get("material_update_verified"):
            result["novelty_status"] = "new"
        result["daily_theme"] = infer_skill_category(result)
        result = score_candidate(result, today_text)
        description = str(result.get("description") or "").lower()
        rare_capability_pairs = [
            ("video", "production"), ("persistent", "planning"), ("session", "recovery"),
            ("interactive", "diagram"), ("browser", "automation"), ("data", "dashboard"),
            ("security", "audit"), ("multimodal", "generation"), ("workflow", "automation"),
            ("research", "citation"), ("test", "automation"), ("design", "system"),
            ("api", "integration"), ("spreadsheet", "analysis"), ("audio", "transcription"),
            ("image", "generation"), ("document", "workflow"), ("long-running", "task"),
            ("codebase", "diagram"), ("product", "prototype")
        ]
        rare_pair = next((pair for pair in rare_capability_pairs if all(term in description for term in pair)), None)
        result["rare_value_verified"] = bool(rare_pair and result.get("actual_skill_file_count", 0) > 0 and result.get("evidence_verified") and result.get("readme_verified"))
        result["rare_value_reason"] = (
            f"Distinct documented capability: {' + '.join(rare_pair)}; actual SKILL.md files, README and license verified. "
            "This is a use-case distinction, not a claim of global uniqueness."
            if result["rare_value_verified"] else None
        )
        result["rare_value_evidence_url"] = (result.get("evidence_urls") or ["", ""])[1] if result["rare_value_verified"] else None
        result["quality_status"] = "PASS" if result.get("license") and result.get("readme_verified") and result.get("evidence_verified") else "FAIL"
        verified.append(result)
        if len(verified) >= 8:
            break

    # Keep the established first-item featured Skill contract while returning only
    # evidence-verified projects that passed historical and same-day deduplication.
    radar = build_radar(verified, ARCHIVE, today_text, limit=8)
    selected = radar.get("selected", [])
    if selected:
        selected[0]["daily_theme"] = theme_name
    final_status = radar.get("status", "unknown") if selected else "NO_QUALIFIED_CANDIDATES"
    SKILL_RADAR_DIAGNOSTICS.clear()
    SKILL_RADAR_DIAGNOSTICS.update({
        "status": final_status,
        "engine_version": ENGINE_VERSION,
        "discovery_sources": {"github_repository_search": "available" if repos else "no_candidates", "hacker_news": {k:v for k,v in community_report.items() if k!="signals"}, "github_candidate_count": len(repos)},
        "growth_snapshots": {k:v for k,v in growth_report.items() if k!="snapshot_file"},
        "history": radar.get("history", {}),
        "candidate_count": len(repos),
        "history_duplicate_exclusions": historical_exclusions,
        "verification_failures": verification_failures,
        "selected_count": len(selected),
        "excluded_count": len(historical_exclusions) + len(verification_failures) + len(radar.get("excluded", [])),
        "excluded": radar.get("excluded", []),
        "scoring_model": {
            "weights": {"recent_heat_and_growth":25,"ai_trend_relevance":20,"practical_usefulness":20,"technical_quality":15,"novelty":10,"maintenance":10},
            "growth_data_policy": "7-day and 30-day Stars deltas are populated only when a dated snapshot of the same canonical repository exists in the permitted comparison window; otherwise null. Current run records a daily candidate snapshot."
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
            "china_ai_news_sources": "QbitAI, Machine Heart, GeekPark, 36Kr, Leiphone AI/robotics/chips, iFanr, AIquanbao, TechNode, TechCrunch AI and Google News China-AI RSS; filtered for China-related AI entities and timestamps within seven days",
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
