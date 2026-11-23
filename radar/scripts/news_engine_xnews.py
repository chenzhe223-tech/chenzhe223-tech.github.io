"""DAVYLAB News Engine -> optional Radar overseas-reading adapter.

Preserves the existing xnews_voices JSON contract and all unrelated Radar gates.
The active path uses five owned public RSS/Atom feeds via News Engine P0/P1;
the old third-party XNews parser is used only on explicit failure as rollback.
News is discovery-only: no content rewriting, image republishing, or AI spend.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import ipaddress
import os
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
MIN_HEALTHY_SOURCES = 3
MAX_STORIES = 48
MAX_PER_SOURCE = 12
ACCEPT = "application/rss+xml,application/atom+xml,application/xml"

CONFIG_PATH = ROOT / "radar" / "config" / "news-engine-xnews.json"


def _config():
    """Fail closed on invalid flags; no path can authorize inference/publication."""
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        if (data.get("schema_version") != 1 or data.get("provider") not in
                {"news_engine", "legacy", "disabled"} or
                data.get("read_only") is not True or
                data.get("allow_ai_inference") is not False or
                data.get("allow_auto_publish") is not False or
                data.get("require_human_fact_check") is not True):
            raise ValueError("unsafe switch config")
        return data
    except (OSError, ValueError, TypeError):
        return {"provider": "legacy", "legacy_fallback_on_failure": True}


def _provider():
    return os.environ.get("RADAR_XNEWS_PROVIDER") or _config()["provider"]


def _module(name: str):
    path = ROOT / "news-engine" / (name + ".py")
    spec = importlib.util.spec_from_file_location("davylab_embedded_" + name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("News Engine module not installed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _public_https(value: str) -> bool:
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or
                parsed.password or parsed.fragment or any(c.isspace() for c in value)):
            return False
        hostname = parsed.hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith((".localhost", ".local")):
            return False
        try:
            return ipaddress.ip_address(hostname).is_global
        except ValueError:
            return True
    except (ValueError, TypeError):
        return False


def _legacy(http_get, now):
    """Only the pre-existing failure path; never a normal publication dependency."""
    try:
        from radar.scripts.xnews_sources import collect_xnews_articles
    except ModuleNotFoundError:
        from xnews_sources import collect_xnews_articles
    fallback = os.environ.get("RADAR_NEWS_ENGINE_LEGACY_FALLBACK")
    if fallback is None:
        fallback = "1" if _config().get("legacy_fallback_on_failure", True) else "0"
    if fallback != "1":
        return [], "unavailable"
    try:
        return collect_xnews_articles(http_get, now=now)
    except Exception:
        return [], "unavailable"


def collect_news_engine_articles(http_get, *, now: dt.datetime):
    """Collect a diverse original-source candidate pool for Radar to dedupe before picking six.

    HTTP calls use the existing Radar read-only transport, with bounded timeouts.
    No full text, external image, model call, or unverified claim is copied.
    """
    if now.tzinfo is None:
        raise ValueError("now must have timezone")
    mode = _provider()
    if mode == "legacy":
        return _legacy(http_get, now)
    if mode != "news_engine":
        return [], "disabled"
    try:
        collector = _module("collector")
        research = _module("research")
        def fetch(url):
            return http_get(url, ACCEPT, timeout=8)
        raw, _ = collector.collect(http_get=fetch, now=now.astimezone(dt.timezone.utc), history={})
        diagnostics = raw.get("diagnostics", [])
        healthy = sum(d.get("status") == "ok" and d.get("coverage") == "active"
                      for d in diagnostics)
        if healthy < MIN_HEALTHY_SOURCES:
            print(f"[news-engine-xnews] insufficient live sources: {healthy}/{len(diagnostics)}; fallback")
            return _legacy(http_get, now)
        candidates = research.research(raw, now=now.astimezone(dt.timezone.utc)).get("candidates", [])
        original = {story["id"]: story for story in raw.get("stories", [])}
        results, per_source = [], {}
        for candidate in candidates:
            story = original.get(candidate.get("id"))
            if not story or not _public_https(story.get("url", "")):
                continue
            publisher = story.get("source", "").strip()
            if per_source.get(publisher, 0) >= MAX_PER_SOURCE:
                continue
            title = story.get("title", "").strip()
            if len(title) < 8:
                continue
            published = story.get("published_at", "")
            # Deliberately do not label an English original headline as translated Chinese.
            results.append({
                "title": title,
                "title_en": title,
                "title_zh": "",
                "url": story["canonical_url"],
                "source_url": story["canonical_url"],
                "source": f"DAVYLAB News Engine · {publisher}",
                "source_kind": "news_engine_rss_discovery",
                "summary": f"来源：{publisher}；发布于 {published[:10]}。仅为待核验新闻线索，请以原始报道为准。",
                "summary_zh": f"来源：{publisher}；发布于 {published[:10]}。仅为待核验新闻线索，请以原始报道为准。",
                "summary_en": f"Source: {publisher}, {published[:10]}. Discovery only; verify the original report.",
                "published": published,
                "verification_status": "source_not_independently_verified",
                "research_score": candidate.get("score"),
                "cross_source_status": candidate.get("cross_source_status"),
                "publishable": False,
            })
            per_source[publisher] = per_source.get(publisher, 0) + 1
            if len(results) >= MAX_STORIES:
                break
        if results:
            print(f"[news-engine-xnews] 5-source read-only selection: {len(results)}; active_sources={healthy}")
            return results, "ok"
        return [], "no_recent"
    except Exception as exc:
        print(f"[news-engine-xnews] safe rollback after {type(exc).__name__}")
        return _legacy(http_get, now)
