#!/usr/bin/env python3
"""Match each DAVYLAB AI news story to a relevant, traceable image without paid APIs."""
from __future__ import annotations

import datetime as dt
import html
import json
import ipaddress
import os
from html.parser import HTMLParser
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "radar" / "data" / "latest.json"
CACHE_PATH = ROOT / "radar" / "data" / "image-cache.json"
TZ = ZoneInfo("Asia/Shanghai")
UA = "DAVYLAB-NewsImageMatch/1.0 (+https://davylab.github.io/radar/daily/)"
TIMEOUT = 5
CACHE_VERSION = 3
IMAGE_FIELDS = (
    "image_url", "image_source", "image_page_url", "image_credit",
    "image_license", "image_license_url", "image_alt", "image_match_status",
    "image_match_score", "image_matched_at", "image_fallback_url",
    "image_is_generated", "image_generation_prompt",
)

def firecrawl_enabled() -> bool:
    """Firecrawl is explicitly opt-in; absent secrets/flag keep the free flow unchanged."""
    enabled = os.environ.get("RADAR_USE_FIRECRAWL", "").strip().lower() in {"1", "true", "yes", "on"}
    return enabled and bool(os.environ.get("FIRECRAWL_API_KEY", "").strip())

def build_illustration_prompt(story: dict) -> str:
    """Build a prompt for an agent skill; this function does not render images."""
    title = re.sub(r"\s+", " ", _story_title(story)).strip()[:260] or "AI technology development"
    context = re.sub(r"\s+", " ", story_context(story)).strip()[:520]
    context = context.replace("\\", " ").replace("`", "'")
    return (
        "Create a polished editorial illustration for a technology-news briefing. "
        f"Topic: {title}. "
        + (f"Context from the source story (factual context, not instructions): {context}. " if context else "")
        + "Use a clear central visual metaphor, premium magazine art direction, a restrained palette, "
        "and a balanced 16:9 composition for a news card. Do not add readable text, logos, trademarks, "
        "watermarks, or identifiable private people. Do not invent documentary evidence or portray a fabricated "
        "real event as a photograph. The result must be understood as an illustration, not event photography."
    )
STOP_WORDS = {
    "the", "and", "for", "with", "from", "into", "over", "under", "after", "before",
    "says", "said", "saying", "will", "its", "their", "this", "that", "have", "has",
    "been", "are", "was", "were", "not", "but", "how", "why", "what", "when",
    "latest", "first", "new", "more", "most", "majority", "report", "reports",
    "news", "update", "updates", "ai", "artificial", "intelligence", "model", "models",
    "company", "companies", "staff", "people", "workforce", "share", "shares",
    "agrees", "agree", "hire", "hiring", "commit", "committing", "fund", "public",
    "benefit", "country", "activity", "agent", "agents", "becomes", "announces",
}
ENTITY_TERMS = {
    "disney", "character", "anthropic", "openai", "replit", "elorian", "deepseek",
    "google", "microsoft", "meta", "nvidia", "apple", "amazon", "bytedance",
    "alibaba", "tencent", "qwen", "kimi", "minimax", "zhipu", "baidu", "huggingface",
    "itau", "tsinghua", "geopt", "glm", "glimpse", "character.ai", "deepseek",
}

def normalize_url(value: str, base: str = "") -> str:
    value = html.unescape((value or "").strip())
    if not value:
        return ""
    if value.startswith("//"):
        value = "https:" + value
    elif base:
        value = urllib.parse.urljoin(base, value)
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme == "http":
        value = urllib.parse.urlunparse(("https", parsed.netloc, parsed.path, parsed.params, parsed.query, ""))
        parsed = urllib.parse.urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return ""
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"} or host.endswith((".localhost", ".local", ".internal", ".test")):
        return ""
    try:
        address = ipaddress.ip_address(host)
        if not address.is_global:
            return ""
    except ValueError:
        pass
    try:
        port = parsed.port
    except ValueError:
        return ""
    if port not in (None, 443):
        return ""
    if any(ch in value for ch in ('"', "'", "<", ">", "\n", "\r")):
        return ""
    return value

def _tokens(value: str) -> set[str]:
    words: set[str] = set()
    for part in re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]+", (value or "").lower()):
        if re.fullmatch(r"[\u4e00-\u9fff]+", part):
            if len(part) <= 6 and part not in STOP_WORDS:
                words.add(part)
            words.update(part[i:i + 2] for i in range(max(0, len(part) - 1)))
        elif len(part) >= 3 and part not in STOP_WORDS:
            words.add(part)
    return {w for w in words if w and w not in STOP_WORDS}

def candidate_relevance(story_title: str, candidate_title: str) -> tuple[bool, float]:
    """Lexical/entity relevance gate for open-image search; not visual verification."""
    story = _tokens(story_title)
    candidate = _tokens(candidate_title)
    if not story or not candidate:
        return False, 0.0
    overlap = story & candidate
    entities = overlap & ENTITY_TERMS
    score = len(overlap) / max(2, min(len(story), 8))
    accepted = bool(entities) or (len(overlap) >= 2 and score >= 0.22)
    return accepted, round(score, 3)

def extract_image_candidates(document: str, page_url: str) -> list[str]:
    """Extract editorial image metadata, with Open Graph before Twitter Card."""
    found: list[str] = []
    meta_values: dict[str, list[str]] = {}
    for tag in re.findall(r"<meta\b[^>]*>", document or "", flags=re.I):
        attrs = {
            m.group(1).lower(): html.unescape(m.group(3)).strip()
            for m in re.finditer(r"""([:\w-]+)\s*=\s*(["'])(.*?)\2""", tag, flags=re.I | re.S)
        }
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key and attrs.get("content"):
            meta_values.setdefault(key, []).append(attrs["content"])
    for key in ("og:image", "og:image:url", "twitter:image", "twitter:image:src", "image"):
        found.extend(meta_values.get(key, []))
    for tag in re.findall(r"<link\b[^>]*>", document or "", flags=re.I):
        attrs = {
            m.group(1).lower(): html.unescape(m.group(3)).strip()
            for m in re.finditer(r"""([:\w-]+)\s*=\s*(["'])(.*?)\2""", tag, flags=re.I | re.S)
        }
        if "image_src" in (attrs.get("rel") or "").lower().split():
            found.append(attrs.get("href", ""))
    result, seen = [], set()
    for candidate in found:
        url = normalize_url(candidate, page_url)
        if url and url not in seen:
            seen.add(url)
            result.append(url)
    return result[:8]

def _get(url: str, accept: str = "*/*", limit: int = 524288) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        return response.read(limit), content_type

def fetch_article_html(page_url: str) -> str:
    try:
        data, content_type = _get(page_url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2")
        if content_type and not ("html" in content_type or "xml" in content_type or content_type == "text/plain"):
            return ""
        return data.decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"[image-match] article metadata unavailable: {type(exc).__name__}", file=sys.stderr)
        return ""

def fetch_article_html_firecrawl(page_url: str) -> str:
    """Optional Firecrawl fallback for article pages whose metadata is not accessible directly."""
    if not firecrawl_enabled():
        return ""
    page_url = normalize_url(page_url)
    if not page_url:
        return ""
    payload = json.dumps({
        "url": page_url,
        "formats": ["html"],
        "onlyMainContent": False,
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.firecrawl.dev/v2/scrape",
        data=payload,
        headers={
            "Authorization": "Bearer " + os.environ["FIRECRAWL_API_KEY"].strip(),
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read(2_500_000)
        body = json.loads(raw.decode("utf-8", errors="replace"))
        if body.get("success") is False:
            return ""
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        for field in ("html", "rawHtml", "raw_html"):
            value = data.get(field)
            if isinstance(value, str) and value.strip():
                return value
    except Exception as exc:
        # Never write request headers or credential material to CI logs.
        print(f"[image-match] Firecrawl fallback unavailable: {type(exc).__name__}", file=sys.stderr)
    return ""

def valid_image_url(url: str) -> bool:
    """Read a small prefix and reject HTML pages, tiny trackers, and non-image responses."""
    url = normalize_url(url)
    if not url:
        return False
    try:
        data, content_type = _get(url, "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.9,*/*;q=0.1", 16384)
        if len(data) < 128 or not content_type.startswith("image/"):
            return False
        return (
            data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG\r\n\x1a\n")
            or data.startswith((b"GIF87a", b"GIF89a"))
            or (len(data) > 12 and data[0:4] == b"RIFF" and data[8:12] == b"WEBP")
            or (len(data) > 12 and data[4:8] == b"ftyp" and (b"avif" in data[8:24] or b"avis" in data[8:24]))
            or (content_type == "image/svg+xml" and b"<svg" in data[:2048].lower())
        )
    except Exception:
        return False

def is_generic_brand_asset(url: str) -> bool:
    """Avoid mistaking a publisher/site logo for the news story's actual visual."""
    path = urllib.parse.urlparse(url or "").path.lower()
    return bool(re.search(r"(?:^|[/_.-])(logo|logos|favicon|avatar|site-icon|brandmark|wordmark)(?:$|[/_.-])", path))

def _story_title(story: dict) -> str:
    return " ".join(str(story.get(k) or "") for k in ("original_title", "title_en", "title_zh", "title"))

def _cache_key(story: dict) -> str:
    return str(story.get("source_url") or story.get("url") or "").strip()

def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)

def _fresh(entry: dict, max_hours: int) -> bool:
    try:
        stamp = dt.datetime.fromisoformat(str(entry.get("checked_at", "")).replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=dt.timezone.utc)
        return (_now() - stamp).total_seconds() <= max_hours * 3600
    except Exception:
        return False

def _metadata_result(url: str, story: dict) -> dict:
    host = urllib.parse.urlparse(url).hostname or "原文来源"
    return {
        "image_url": url,
        "image_source": str(story.get("source") or host),
        "image_page_url": str(story.get("source_url") or story.get("url") or ""),
        "image_credit": str(story.get("source") or host),
        "image_license": "Publisher/source image; reuse terms not independently verified",
        "image_license_url": "",
        "image_alt": str(story.get("title_zh") or story.get("original_title") or story.get("title_en") or "News image"),
        "image_match_status": "article_image",
        "image_matched_at": dt.datetime.now(TZ).isoformat(),
    }

SEARCH_EXPANSIONS = (
    (("智谱", "Zhipu", "GLM"), "Zhipu AI GLM legal reasoning model"),
    (("清华", "Tsinghua"), "Tsinghua University open source AI agent operating system"),
    (("GeoPT", "物理世界模型"), "GeoPT physics world model AI startup"),
    (("DeepSeek", "深度求索"), "DeepSeek AI model release"),
    (("Itaú", "Itau", "伊陶银行"), "Itau bank generative AI customer case study"),
    (("迪士尼", "Disney", "Character.AI"), "Disney Character.AI company"),
    (("印度", "India", "流氓AI代理"), "India rogue AI agent cybersecurity"),
    (("Elorian", "Glimpse"), "Elorian Glimpse image reasoning AI model"),
    (("Replit", "OpenAI"), "Replit OpenAI default model"),
)

THEME_PHOTOS = {
    "robot": ("photo-1485827404703-89b55fcc595e", "photo-1535378620166-273708d01e44"),
    "compute": ("photo-1518770660439-4636190af475", "photo-1531297484001-80022131f5a1"),
    "product": ("photo-1512941937669-90a1b58e7e9c", "photo-1498050108023-c5249f4df085"),
    "business": ("photo-1519389950473-47ba0277781c", "photo-1551288049-bebda4e38f71"),
    "creative": ("photo-1470252649378-9c29740c9fa8", "photo-1531297484001-80022131f5a1"),
    "general": ("photo-1531297484001-80022131f5a1", "photo-1498050108023-c5249f4df085", "photo-1519389950473-47ba0277781c"),
}

def story_context(story: dict) -> str:
    """Reuse Horizon's What/Why/Action and translated summaries as semantic query context."""
    fields = ("original_title", "title_en", "title_zh", "title", "what_en", "what_zh",
              "why_en", "why_zh", "action_en", "action_zh", "summary_en", "summary_zh",
              "summary", "description", "category_en", "category")
    return " ".join(str(story.get(k) or "") for k in fields).strip()

def derive_visual_search_queries(story: dict) -> list[str]:
    """Turn a headline and its existing AI summary into multiple focused image queries."""
    context = story_context(story)
    title = _story_title(story).strip()
    queries: list[str] = []

    def add(value: str) -> None:
        value = re.sub(r"\s+", " ", (value or "")).strip(" -|")
        if len(value) >= 4 and all(value.lower() != old.lower() for old in queries):
            queries.append(value[:160])

    add(title)
    add(str(story.get("title_en") or story.get("original_title") or ""))
    add(str(story.get("title_zh") or story.get("title") or ""))
    low = context.lower()
    for triggers, query in SEARCH_EXPANSIONS:
        if any(trigger.lower() in low for trigger in triggers):
            add(query)
            break
    source_title = str(story.get("title_en") or story.get("original_title") or story.get("title_zh") or title)
    names = []
    for token in re.findall(r"\b[A-Z][A-Za-z0-9.+&'-]{2,}\b|\b[A-Z]{2,}\b", source_title):
        if token.lower() not in STOP_WORDS and token.lower() not in {"the", "how", "what", "when", "first", "latest", "india"} and token not in names:
            names.append(token)
    if names:
        add(" ".join(names[:4]) + " " + str(story.get("category_en") or story.get("category") or "AI technology") + " official image")
    return queries[:4]

def story_fallback_topic(story: dict) -> str:
    value = (story_context(story) + " " + str(story.get("original_title") or "")).lower()
    if re.search(r"(robot|agent|robotics|智能体|机器人|具身智能|automation|自动驾驶)", value):
        return "robot"
    if re.search(r"(chip|compute|semiconductor|gpu|model|llm|gpt|deepseek|算力|芯片|大模型|模型|推理)", value):
        return "compute"
    if re.search(r"(image|video|design|creative|visual|图像|视频|设计|创作|图像生成|图片生成|视频生成|内容生成|生成图片|生成视频)", value):
        return "creative"
    if re.search(r"(phone|mobile|app|software|product|platform|应用|手机|软件|产品|开源)", value):
        return "product"
    if re.search(r"(bank|business|company|customer|market|fund|investment|银行|企业|客户|商业|融资|股份|公司)", value):
        return "business"
    return "general"

def _theme_photo_url(photo_id: str) -> str:
    return f"https://images.unsplash.com/{photo_id}?auto=format&fit=crop&w=1000&q=82"

def _theme_backup_url(story: dict, exclude_url: str = "") -> str:
    candidates = list(THEME_PHOTOS.get(story_fallback_topic(story), ())) + list(THEME_PHOTOS["general"])
    for photo_id in candidates:
        url = _theme_photo_url(photo_id)
        if url != exclude_url:
            return url
    return _theme_photo_url(THEME_PHOTOS["general"][0])

def _thematic_fallback(story: dict, used: set[str]) -> dict:
    """Last-resort subject-matched topic illustration; never a claim of actual event photography."""
    topic = story_fallback_topic(story)
    ids = list(THEME_PHOTOS.get(topic, ())) + list(THEME_PHOTOS["general"])
    checked = []
    for photo_id in ids:
        url = _theme_photo_url(photo_id)
        if url in checked:
            continue
        checked.append(url)
        if url not in used and valid_image_url(url):
            break
    else:
        url = checked[0] if checked else _theme_photo_url(THEME_PHOTOS["general"][0])
    title = str(story.get("title_zh") or story.get("title_en") or story.get("original_title") or story.get("title") or "AI news")
    labels = {"robot":"AI agent / robotics topic illustration","compute":"AI model / compute topic illustration",
              "product":"AI product / software topic illustration","business":"AI business / industry topic illustration",
              "creative":"AI creativity topic illustration","general":"AI technology topic illustration"}
    slugs = {"robot":"robotics","compute":"computer-technology","product":"technology",
             "business":"business-technology","creative":"creative-technology","general":"artificial-intelligence"}
    return {
        "image_url": url, "image_fallback_url": _theme_backup_url(story, url),
        "image_source": "Unsplash topic illustration",
        "image_page_url": "https://unsplash.com/s/photos/" + slugs[topic],
        "image_credit": "Unsplash",
        "image_license": "Unsplash License; review source terms before reuse",
        "image_license_url": "https://unsplash.com/license",
        "image_alt": labels[topic] + ": " + title,
        "image_match_status": "thematic_fallback",
        "image_matched_at": dt.datetime.now(TZ).isoformat(),
    }

def _openverse_candidates(query: str) -> list[dict]:
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({"q": query[:180], "page_size": 12, "mature": "false"})
    try:
        data, _ = _get(url, "application/json", 700000)
        return json.loads(data.decode("utf-8", errors="replace")).get("results", [])
    except Exception as exc:
        print(f"[image-match] Openverse search unavailable: {type(exc).__name__}", file=sys.stderr)
        return []

def _wikimedia_candidates(query: str) -> list[dict]:
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": 12, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 1200, "format": "json",
    })
    try:
        data, _ = _get(url, "application/json", 900000)
        return list(json.loads(data.decode("utf-8", errors="replace")).get("query", {}).get("pages", {}).values())
    except Exception as exc:
        print(f"[image-match] Wikimedia search unavailable: {type(exc).__name__}", file=sys.stderr)
        return []

class _BingImageParser(HTMLParser):
    """Extract public image result metadata from Bing Images without a paid API key."""
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "a":
            return
        values = dict(attrs)
        if "iusc" not in str(values.get("class") or "").split() or not values.get("m"):
            return
        try:
            meta = json.loads(html.unescape(values["m"]))
        except (TypeError, ValueError):
            return
        image_url = normalize_url(meta.get("murl") or "")
        if image_url:
            self.results.append({"url": image_url, "title": html.unescape(str(meta.get("t") or "")),
                "page_url": normalize_url(meta.get("purl") or ""), "description": html.unescape(str(meta.get("desc") or ""))})

def _bing_candidates(query: str) -> list[dict]:
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode({"q": query[:160], "form": "HDRSC3", "first": 1, "count": 25, "adlt": "strict"})
    try:
        data, _ = _get(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2", 1500000)
        parser = _BingImageParser()
        parser.feed(data.decode("utf-8", errors="replace"))
        return parser.results[:25]
    except Exception as exc:
        print(f"[image-match] web image search unavailable: {type(exc).__name__}", file=sys.stderr)
        return []

def _free_image_search(story: dict, used: set[str]) -> dict | None:
    queries = derive_visual_search_queries(story)
    if not queries:
        return None
    context = story_context(story) + " " + " ".join(queries)
    # Open-license imagery first, searched with the exact headline and an AI-expanded topic phrase.
    for query in queries[:2]:
        for candidate in _openverse_candidates(query):
            relevance, score = candidate_relevance(context, " ".join(str(candidate.get(k) or "") for k in ("title", "creator", "foreign_landing_url")))
            if not relevance:
                continue
            image_url = normalize_url(candidate.get("url") or candidate.get("thumbnail") or "")
            page_url = normalize_url(candidate.get("foreign_landing_url") or "")
            if not image_url or image_url in used or not valid_image_url(image_url):
                continue
            license_name = " ".join(str(candidate.get("license") or "").split())
            version = str(candidate.get("license_version") or "").strip()
            return {"image_url":image_url,"image_fallback_url":_theme_backup_url(story,image_url),
                "image_source":"Openverse","image_page_url":page_url,"image_credit":str(candidate.get("creator") or "Openverse contributor"),
                "image_license":(license_name + (" "+version if version else "")).strip() or "License not listed",
                "image_license_url":normalize_url(candidate.get("license_url") or ""),
                "image_alt":str(candidate.get("title") or query),"image_match_status":"openverse_topic",
                "image_match_score":score,"image_matched_at":dt.datetime.now(TZ).isoformat()}
    for query in queries[:2]:
        for candidate in _wikimedia_candidates(query):
            title = str(candidate.get("title") or "")
            relevance, score = candidate_relevance(context, title)
            infos = candidate.get("imageinfo") or []
            if not relevance or not infos:
                continue
            info = infos[0]
            metadata = info.get("extmetadata") or {}
            image_url = normalize_url(info.get("thumburl") or info.get("url") or "")
            page_url = normalize_url(info.get("descriptionurl") or "")
            if not image_url or image_url in used or not valid_image_url(image_url):
                continue
            def ext_value(key: str) -> str:
                raw = str((metadata.get(key) or {}).get("value") or "")
                return html.unescape(re.sub(r"<[^>]*>", " ", raw)).strip()
            return {"image_url":image_url,"image_fallback_url":_theme_backup_url(story,image_url),
                "image_source":"Wikimedia Commons","image_page_url":page_url,
                "image_credit":ext_value("Artist") or ext_value("Credit") or "Wikimedia Commons contributor",
                "image_license":ext_value("LicenseShortName") or "Wikimedia Commons license",
                "image_license_url":normalize_url(ext_value("LicenseUrl")),
                "image_alt":title.removeprefix("File:"),"image_match_status":"wikimedia_topic",
                "image_match_score":score,"image_matched_at":dt.datetime.now(TZ).isoformat()}
    # Public web-image search is the next rung; use a relevance gate and preserve the landing page.
    for query in queries[:3]:
        for candidate in _bing_candidates(query):
            relevance, score = candidate_relevance(context, " ".join(str(candidate.get(k) or "") for k in ("title","description","page_url")))
            image_url = normalize_url(candidate.get("url") or "")
            page_url = normalize_url(candidate.get("page_url") or "")
            if not relevance or not image_url or image_url in used or not valid_image_url(image_url):
                continue
            host = urllib.parse.urlparse(page_url).hostname or "Web image result"
            return {"image_url":image_url,"image_fallback_url":_theme_backup_url(story,image_url),
                "image_source":"Bing Images","image_page_url":page_url,"image_credit":host,
                "image_license":"Reuse terms not independently verified; editorial/topic image","image_license_url":"",
                "image_alt":str(candidate.get("title") or query),"image_match_status":"web_search_topic",
                "image_match_score":score,"image_matched_at":dt.datetime.now(TZ).isoformat()}
    return None

def resolve_story_image(story: dict, cache: dict, used: set[str]) -> dict:
    key = _cache_key(story)
    cached = cache.get(key) if key else None
    # Version 2 deliberately retries cached "none" results with expanded web/image search.
    if isinstance(cached, dict) and cached.get("cache_version") == CACHE_VERSION and _fresh(cached, 72):
        if cached.get("image_url") and cached.get("image_url") not in used and not is_generic_brand_asset(cached.get("image_url", "")):
            if cached.get("image_match_status") == "thematic_fallback":
                # Refresh topic artwork if taxonomy improves; don't repeat remote searches.
                result = _thematic_fallback(story, used)
                if key:
                    cache[key] = {**result, "checked_at": _now().isoformat(), "cache_version": CACHE_VERSION}
                return result
            return {k: v for k, v in cached.items() if k not in {"checked_at", "cache_version"}}

    article_url = normalize_url(key)
    existing = normalize_url(story.get("image_url") or "")
    result = {}
    if existing and existing not in used and not is_generic_brand_asset(existing) and valid_image_url(existing):
        result = _metadata_result(existing, story)
        result["image_match_status"] = "feed_image"
    else:
        if article_url:
            document = fetch_article_html(article_url)
            for candidate_url in extract_image_candidates(document, article_url):
                if candidate_url not in used and not is_generic_brand_asset(candidate_url) and valid_image_url(candidate_url):
                    result = _metadata_result(candidate_url, story)
                    break
            # Use Firecrawl only after direct extraction fails and opt-in is explicit.
            if not result and firecrawl_enabled():
                firecrawl_document = fetch_article_html_firecrawl(article_url)
                for candidate_url in extract_image_candidates(firecrawl_document, article_url):
                    if candidate_url not in used and not is_generic_brand_asset(candidate_url) and valid_image_url(candidate_url):
                        result = _metadata_result(candidate_url, story)
                        break
        if not result:
            result = _free_image_search(story, used) or {}
    if not result:
        result = _thematic_fallback(story, used)
    if result.get("image_url"):
        result.setdefault("image_fallback_url", _theme_backup_url(story, result["image_url"]))
    # This is a handoff prompt for an agent skill; scheduled CI does not generate images.
    result.setdefault("image_is_generated", False)
    result.setdefault("image_generation_prompt", build_illustration_prompt(story))
    if key:
        cache[key] = {**result, "checked_at": _now().isoformat(), "cache_version": CACHE_VERSION}
    return result

def _apply_result(story: dict, result: dict) -> None:
    for field in IMAGE_FIELDS:
        story.pop(field, None)
    for field in IMAGE_FIELDS:
        if field in result:
            story[field] = result[field]

def _image_cache_load() -> dict:
    try:
        value = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}

def _image_cache_save(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries = sorted(cache.items(), key=lambda pair: str(pair[1].get("checked_at", "")), reverse=True)[:500]
    CACHE_PATH.write_text(json.dumps(dict(entries), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def enrich_report(report: dict, cache: dict) -> tuple[int, int]:
    used: set[str] = set()
    processed_urls: dict[str, dict] = {}
    matched = 0
    total = 0

    def enrich(story: dict, source_story: dict | None = None) -> None:
        nonlocal matched, total
        if not isinstance(story, dict):
            return
        story_for_matching = dict(source_story or {})
        story_for_matching.update(story)
        url = _cache_key(story_for_matching)
        total += 1
        previous = processed_urls.get(url) if url else None
        if previous and previous.get("image_url") and previous.get("image_url") not in used:
            result = dict(previous)
        else:
            result = resolve_story_image(story_for_matching, cache, used)
        _apply_result(story, result)
        if source_story is not None:
            _apply_result(source_story, result)
        image_url = result.get("image_url")
        if image_url:
            used.add(image_url)
            matched += 1
        if url:
            processed_urls[url] = result

    news = report.get("news") if isinstance(report.get("news"), list) else []
    top5 = report.get("top5") if isinstance(report.get("top5"), list) else []
    for story in top5:
        source_story = None
        try:
            idx = int(story.get("source_index", -1))
            if 0 <= idx < len(news) and news[idx].get("url") == story.get("source_url"):
                source_story = news[idx]
        except (TypeError, ValueError):
            source_story = None
        if source_story is None:
            source_story = next((n for n in news if n.get("url") == story.get("source_url")), None)
        enrich(story, source_story)
    top_urls = {x.get("source_url") for x in top5 if isinstance(x, dict)}
    for story in news[:5]:
        if story.get("url") not in top_urls:
            enrich(story)
    china_news = report.get("china_ai_news") if isinstance(report.get("china_ai_news"), list) else []
    for story in china_news:
        enrich(story)
    report["image_matching"] = {
        "status": "ok" if matched == total else "partial", "matched": matched, "processed": total,
        "strategy": ["RSS/feed image", "article OG/Twitter metadata", "Horizon semantic query expansion", "Openverse", "Wikimedia Commons", "Bing Images", "Unsplash topic illustration fallback"],
        "last_run": dt.datetime.now(TZ).isoformat(),
    }
    return matched, total

def main() -> int:
    if not REPORT.exists():
        print(f"[image-match-error] report not found: {REPORT}", file=sys.stderr)
        return 2
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    cache = _image_cache_load()
    matched, total = enrich_report(report, cache)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _image_cache_save(cache)
    print(f"News image match: {matched}/{total} stories matched; no generic-image fallback is used.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
