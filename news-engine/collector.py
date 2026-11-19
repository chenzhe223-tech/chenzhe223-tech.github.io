"""DAVYLAB News Engine P0: bounded RSS discovery, no external dependencies."""
from __future__ import annotations
import datetime as dt
import argparse
import html
import time
import urllib.error
import hashlib
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

MAX_BYTES = 2_000_000
MAX_ITEMS_PER_SOURCE = 80
HISTORY_DAYS = 90
USER_AGENT = "DAVYLAB-NewsEngine/0.1 (+https://chenzhe223-tech.github.io/radar/daily/)"
SOURCES = [
    {"name": "GitHub Blog", "url": "https://github.blog/ai-and-ml/feed/"},
    {"name": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/"},
    {"name": "Hugging Face", "url": "https://huggingface.co/blog/feed.xml"},
    {"name": "Simon Willison", "url": "https://simonwillison.net/atom/everything/"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
]
ATOM = "{http://www.w3.org/2005/Atom}"
def canonical_url(value):
    if not safe_url(value): return ""
    u = urllib.parse.urlsplit(value)
    query = urllib.parse.urlencode([(k,v) for k,v in urllib.parse.parse_qsl(u.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in {"fbclid","gclid"}])
    return urllib.parse.urlunsplit(("https",u.netloc.lower(),u.path.rstrip("/") or "/",query,""))
def normalized_title(value):
    return re.sub(r"[^\w\u4e00-\u9fff]+","",html.unescape(value).casefold())
def load_history(path):
    if not path.exists(): return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data,dict) or data.get("schema_version") != 1 or not isinstance(data.get("seen"),dict):
        raise ValueError("invalid history schema; refusing overwrite")
    return data["seen"]
def save_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temp.replace(path)
def recent_history(value,cutoff):
    try:
        date=dt.datetime.fromisoformat(value.replace("Z","+00:00"))
        return bool(date.tzinfo and date>=cutoff)
    except (ValueError,TypeError): return False

def safe_url(value):
    if not isinstance(value, str) or any(c.isspace() for c in value):
        return ""
    try:
        u = urllib.parse.urlsplit(value)
        if u.scheme != "https" or not u.hostname or u.username or u.password:
            return ""
        return value
    except ValueError:
        return ""

def fetch(url, retries=2, sleep=time.sleep):
    if not safe_url(url):
        raise ValueError("source URL must be HTTPS")
    last_error=None
    for attempt in range(retries+1):
        try:
            request=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"application/rss+xml,application/atom+xml,application/xml"})
            with urllib.request.urlopen(request,timeout=12) as response:
                if response.status!=200: raise ValueError("non-200 HTTP response")
                if not safe_url(response.geturl()): raise ValueError("unsafe redirect")
                data=response.read(MAX_BYTES+1)
                if len(data)>MAX_BYTES: raise ValueError("feed exceeds size limit")
                return data
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,OSError) as exc:
            last_error=exc
            if isinstance(exc,urllib.error.HTTPError) and exc.code not in {408,429,500,502,503,504}: break
            if attempt<retries: sleep(min(2**attempt,4))
    raise last_error

def parse(payload, source, now):
    if len(payload) > MAX_BYTES:
        raise ValueError("oversized XML")
    # HTML snippets such as <!DOCTYPE html> are often embedded in safe RSS CDATA.
    # Check declarations only outside CDATA and XML comments; never relax the DTD ban.
    declarations = re.sub(rb"<!\[CDATA\[.*?\]\]>|<!--.*?-->", b"", payload, flags=re.DOTALL).upper()
    if b"<!DOCTYPE" in declarations or b"<!ENTITY" in declarations:
        raise ValueError("DTD or entity declaration prohibited")
    root = ET.fromstring(payload)
    if root.tag == "rss":
        rows = [(n.findtext("title"), n.findtext("link"), n.findtext("pubDate")) for n in root.findall("./channel/item")]
    elif root.tag == ATOM + "feed":
        rows = []
        for n in root.findall(ATOM + "entry"):
            links = [a.get("href") for a in n.findall(ATOM + "link") if a.get("rel", "alternate") == "alternate"]
            rows.append((n.findtext(ATOM + "title"), links[0] if links else "", n.findtext(ATOM + "published") or n.findtext(ATOM + "updated")))
    else:
        raise ValueError("unsupported feed root")
    cutoff = now - dt.timedelta(days=7)
    results = []
    for title, url, stamp in rows[:MAX_ITEMS_PER_SOURCE]:
        if not title or not canonical_url(url) or not stamp:
            continue
        try:
            published = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00")) if re.match(r"^\d{4}-\d{2}-\d{2}T",stamp) else parsedate_to_datetime(stamp)
            if not published.tzinfo:
                continue
            published = published.astimezone(dt.timezone.utc)
        except (ValueError, TypeError, OverflowError, IndexError):
            continue
        if not cutoff <= published <= now + dt.timedelta(hours=6):
            continue
        canonical = canonical_url(url)
        results.append({"id": hashlib.sha256(canonical.encode()).hexdigest()[:20], "title": re.sub(r"\s+", " ", html.unescape(title)).strip()[:240], "url": url, "canonical_url": canonical, "source": source, "published_at": published.isoformat(), "verification_status": "source_not_independently_verified", "editorial_status": "discovered"})
    return results

def collect(sources=SOURCES, http_get=fetch, now=None, history=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    history=dict((history.get("seen",{}) if history.get("schema_version")==1 else history) or {}) if history else {}
    cutoff=now-dt.timedelta(days=HISTORY_DAYS)
    history={k:v for k,v in history.items() if isinstance(v,str) and recent_history(v,cutoff)}
    stories, seen, diagnostics = [], set(), []
    for source in sources:
        name, url = source["name"], source["url"]
        try:
            items = parse(http_get(url), name, now)
            accepted=0
            for item in items:
                keys=["url:"+item["canonical_url"],"title:"+normalized_title(item["title"])]
                if any(k in history or k in seen for k in keys): continue
                seen.update(keys)
                for k in keys: history[k]=now.isoformat()
                stories.append(item)
                accepted+=1
            diagnostics.append({"source":name,"status":"ok","parsed":len(items),"accepted":accepted})
        except (ValueError, ET.ParseError, OSError, TimeoutError) as exc:
            diagnostics.append({"source": name, "status": "error", "error_type": type(exc).__name__, "detail": str(exc)[:140] if isinstance(exc, ValueError) else ""})
    stories.sort(key=lambda x: x["published_at"], reverse=True)
    return {"generated_at": now.isoformat(), "stories": stories, "diagnostics": diagnostics, "schema_version": 1}, {"schema_version":1,"seen":history}

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",default="news-engine/data/latest.json")
    p.add_argument("--history",default="news-engine/data/history.json")
    args=p.parse_args()
    output,history_path=Path(args.out),Path(args.history)
    result,history=collect(history=load_history(history_path))
    save_json(history_path,history)
    save_json(output,result)
    print(json.dumps({"stories":len(result["stories"]),"diagnostics":result["diagnostics"]},ensure_ascii=False))
