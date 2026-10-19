#!/usr/bin/env python3
"""Match each DAVYLAB AI news story to a relevant, traceable image without paid APIs."""
from __future__ import annotations

import datetime as dt
import html
import json
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
UA = "DAVYLAB-NewsImageMatch/1.0 (+https://chenzhe223-tech.github.io/radar/daily/)"
TIMEOUT = 7
IMAGE_FIELDS = (
    "image_url", "image_source", "image_page_url", "image_credit",
    "image_license", "image_license_url", "image_alt", "image_match_status",
    "image_match_score", "image_matched_at",
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
    if parsed.scheme != "https" or not parsed.hostname:
        return ""
    if parsed.hostname.lower() in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
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

def _openverse_candidates(story_title: str) -> list[dict]:
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({
        "q": story_title[:180], "page_size": 10, "mature": "false",
    })
    try:
        data, _ = _get(url, "application/json", 700000)
        return json.loads(data.decode("utf-8", errors="replace")).get("results", [])
    except Exception as exc:
        print(f"[image-match] Openverse search unavailable: {type(exc).__name__}", file=sys.stderr)
        return []

def _wikimedia_candidates(story_title: str) -> list[dict]:
    terms = [x for x in sorted(_tokens(story_title), key=lambda x: (x not in ENTITY_TERMS, -len(x))) if len(x) >= 3 or x in ENTITY_TERMS]
    query = " ".join(terms[:7]) or story_title[:100]
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": 10, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": 1200, "format": "json",
    })
    try:
        data, _ = _get(url, "application/json", 700000)
        pages = json.loads(data.decode("utf-8", errors="replace")).get("query", {}).get("pages", {})
        return list(pages.values())
    except Exception as exc:
        print(f"[image-match] Wikimedia search unavailable: {type(exc).__name__}", file=sys.stderr)
        return []

def _free_image_search(story: dict, used: set[str]) -> dict | None:
    title = _story_title(story).strip()
    if not title:
        return None
    for candidate in _openverse_candidates(title):
        candidate_title = " ".join(str(candidate.get(k) or "") for k in ("title", "creator", "foreign_landing_url"))
        relevant, score = candidate_relevance(title, candidate_title)
        if not relevant:
            continue
        image_url = normalize_url(candidate.get("url") or candidate.get("thumbnail") or "")
        page_url = normalize_url(candidate.get("foreign_landing_url") or "")
        if not image_url or image_url in used or not valid_image_url(image_url):
            continue
        license_name = " ".join(str(candidate.get("license") or "").split())
        version = str(candidate.get("license_version") or "").strip()
        return {
            "image_url": image_url, "image_source": "Openverse", "image_page_url": page_url,
            "image_credit": str(candidate.get("creator") or "Openverse contributor"),
            "image_license": (license_name + (" " + version if version else "")).strip() or "License not listed",
            "image_license_url": normalize_url(candidate.get("license_url") or ""),
            "image_alt": str(candidate.get("title") or title),
            "image_match_status": "openverse_topic", "image_match_score": score,
            "image_matched_at": dt.datetime.now(TZ).isoformat(),
        }
    for candidate in _wikimedia_candidates(title):
        candidate_title = str(candidate.get("title") or "")
        relevant, score = candidate_relevance(title, candidate_title)
        if not relevant:
            continue
        infos = candidate.get("imageinfo") or []
        if not infos:
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
        license_name = ext_value("LicenseShortName") or "Wikimedia Commons license"
        return {
            "image_url": image_url, "image_source": "Wikimedia Commons", "image_page_url": page_url,
            "image_credit": ext_value("Artist") or ext_value("Credit") or "Wikimedia Commons contributor",
            "image_license": license_name, "image_license_url": normalize_url(ext_value("LicenseUrl")),
            "image_alt": candidate_title.removeprefix("File:"),
            "image_match_status": "wikimedia_topic", "image_match_score": score,
            "image_matched_at": dt.datetime.now(TZ).isoformat(),
        }
    return None

def resolve_story_image(story: dict, cache: dict, used: set[str]) -> dict:
    key = _cache_key(story)
    cached = cache.get(key) if key else None
    if isinstance(cached, dict) and _fresh(cached, 72):
        if cached.get("image_url") and cached.get("image_url") not in used:
            return {k: v for k, v in cached.items() if k != "checked_at"}
        if cached.get("image_match_status") == "none" and _fresh(cached, 24):
            return {"image_match_status": "none", "image_alt": "No reliable matching image found"}

    title = _story_title(story).strip()
    article_url = normalize_url(key)
    existing = normalize_url(story.get("image_url") or "")
    if existing and existing not in used and valid_image_url(existing):
        result = _metadata_result(existing, story)
        result["image_match_status"] = "feed_image"
    else:
        result = {}
        if article_url:
            document = fetch_article_html(article_url)
            for candidate_url in extract_image_candidates(document, article_url):
                if candidate_url not in used and valid_image_url(candidate_url):
                    result = _metadata_result(candidate_url, story)
                    break
        if not result:
            result = _free_image_search(story, used) or {}
    if result:
        if key:
            cache[key] = {**result, "checked_at": _now().isoformat()}
        return result
    result = {"image_match_status": "none", "image_alt": "No reliable matching image found"}
    if key:
        cache[key] = {**result, "checked_at": _now().isoformat()}
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
        "status": "ok" if matched else "partial", "matched": matched, "processed": total,
        "strategy": ["RSS/feed image", "article OG/Twitter/structured image", "Openverse", "Wikimedia Commons"],
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
