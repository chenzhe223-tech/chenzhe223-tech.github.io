"""DAVYLAB News Engine P1: deterministic triage and unverified research outlines.

No network calls, paid services or production publication.
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

TRUSTED = {"github.blog", "blog.google", "huggingface.co", "simonwillison.net", "techcrunch.com"}
STOP = {"the", "and", "for", "with", "from", "new", "announces", "launches", "release", "released", "ai"}

def tokens(title):
    return {x for x in re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", title.casefold()) if len(x) >= 3 and x not in STOP}

def similarity(a, b):
    x, y = tokens(a), tokens(b)
    return len(x & y) / len(x | y) if x and y else 0.0

def valid_story(s):
    if not isinstance(s, dict) or not isinstance(s.get("title"), str) or len(s["title"].strip()) < 8:
        return False
    url = s.get("canonical_url") or s.get("url") or ""
    if not isinstance(url, str) or urlsplit(url).scheme != "https" or not urlsplit(url).hostname:
        return False
    try:
        stamp = dt.datetime.fromisoformat(s["published_at"].replace("Z", "+00:00"))
        return stamp.tzinfo is not None
    except (KeyError, TypeError, ValueError):
        return False

def rank(s, now):
    """Score is triage priority, NOT a credibility or fact-check verdict."""
    if not valid_story(s):
        return 0
    stamp = dt.datetime.fromisoformat(s["published_at"].replace("Z", "+00:00"))
    age = (now - stamp.astimezone(dt.timezone.utc)).total_seconds() / 3600
    if age < -6 or age > 168:
        return 0
    domain = urlsplit(s.get("canonical_url") or s["url"]).hostname.lower().removeprefix("www.")
    return min(100, max(0, 40 - int(max(0, age) / 6)) + (25 if domain in TRUSTED else 10) + (15 if len(tokens(s["title"])) >= 3 else 5) + (10 if s.get("source") else 0))

def research(discovery, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if not isinstance(discovery, dict) or discovery.get("schema_version") != 1 or not isinstance(discovery.get("stories"), list):
        raise ValueError("unsupported discovery schema")
    valid = sorted((s for s in discovery["stories"] if valid_story(s)), key=lambda s: (s["published_at"], s["title"]), reverse=True)
    groups = []
    for story in valid:
        group = next((g for g in groups if any(similarity(story["title"], member["title"]) >= 0.62 for member in g)), None)
        if group is None:
            groups.append([story])
        else:
            group.append(story)
    candidates = []
    for group in groups:
        lead = sorted(group, key=lambda s: (-rank(s, now), s["title"]))[0]
        urls = list(dict.fromkeys(s.get("canonical_url") or s["url"] for s in group))
        domains = sorted({urlsplit(u).hostname.removeprefix("www.") for u in urls})
        candidates.append({
            "id": lead.get("id") or lead.get("canonical_url") or lead["url"],
            "title": lead["title"], "score": rank(lead, now),
            "source_urls": urls, "source_domains": domains,
            "cross_source_status": "multi_domain_candidate_unverified" if len(domains) > 1 else "single_domain_unverified",
            "verification_status": "requires_primary_source_and_fact_check",
            "editorial_status": "research_candidate",
            "outline": [
                {"heading": "事件与时间线", "instruction": "核对原始公告与实际发布日期，禁止把抓取时间当发布时间"},
                {"heading": "关键事实与数字", "instruction": "逐条提供原始证据和URL；未核实事实不得写入正文"},
                {"heading": "背景与影响", "instruction": "区分事实、观点、推测与限制条件"},
                {"heading": "读者启示", "instruction": "给出可操作的观察问题，避免无依据结论"}
            ]
        })
    candidates.sort(key=lambda c: (-c["score"], c["title"]))
    return {"schema_version": 1, "generated_at": now.isoformat(), "status": "draft_research_only", "candidates": candidates, "rejected_count": len(discovery["stories"]) - len(valid)}

def gateway_request(candidate):
    """Request payload only: an approved caller may send; never self-invoke or verify."""
    return {"task": "research_outline", "candidate_id": candidate["id"], "title": candidate["title"],
            "source_urls": candidate["source_urls"], "verification_status": "unverified",
            "instructions": "仅根据来源URL生成待核验提纲；禁止编造、禁止宣称已核验。"}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="news-engine/data/latest.json")
    p.add_argument("--out", default="news-engine/data/research.json")
    args = p.parse_args()
    result = research(json.loads(Path(args.input).read_text(encoding="utf-8")))
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".tmp")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(target)
    print(json.dumps({"candidates": len(result["candidates"]), "rejected": result["rejected_count"]}))
