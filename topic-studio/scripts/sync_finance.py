#!/usr/bin/env python3
"""DAVYLAB finance discovery: public official RSS/Atom metadata, never invented market data."""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
from html.parser import HTMLParser
import pathlib
import re
import sys
import xml.etree.ElementTree as ET
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from finance_rank import WEIGHTS, VERSION, region_for, sort_and_rank
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

DEST = pathlib.Path(__file__).resolve().parents[1] / "data" / "finance-discovery.json"
# Official first-party sources. A source failure must not delete valid items from the others.
SOURCES = [
    ("美联储 · Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", "宏观政策"),
    ("美国证券交易委员会 · SEC", "https://www.sec.gov/news/pressreleases.rss", "资本市场"),
    ("欧洲央行 · ECB", "https://www.ecb.europa.eu/rss/press.html", "宏观政策"),
    ("美国劳工统计局 · BLS", "https://www.bls.gov/feed/bls_latest.rss", "经济数据"),
    ("美国经济分析局 · BEA", "https://apps.bea.gov/rss/rss.xml", "经济数据"),
    ("CNBC · 全球财经报道", "https://www.cnbc.com/id/10000664/device/rss/rss.html", "企业与市场", "media_report"),
    ("CNBC · 全球新闻分析", "https://www.cnbc.com/id/100727362/device/rss/rss.html", "全球市场", "media_report"),
    ("中国新闻网 · 财经新闻", "https://www.chinanews.com.cn/rss/finance.xml", "中国财经", "media_report", "中国"),
    ("南华早报 · 中国经济", "https://www.scmp.com/rss/318421/feed", "中国经济", "media_report", "中国"),
    ("FT中文网 · 财经焦点", "https://www.ftchinese.com/rss/news", "中国财经", "media_report"),
    ("英为财情 · 中文经济新闻", "https://cn.investing.com/rss/news_14.rss", "全球市场", "media_report"),
]
ATOM = "{http://www.w3.org/2005/Atom}"
MAX_BYTES, MAX_AGE = 2_000_000, 30

class StripTags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.parts = []
    def handle_data(self, value):
        self.parts.append(value)

def clean(value, limit=230):
    parser = StripTags()
    parser.feed(str(value or "")[:4000])
    return re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()[:limit]

def safe_url(value):
    try:
        parsed = urlsplit(str(value or "").strip())
        return (value.strip() if parsed.scheme == "https" and parsed.hostname
                and not parsed.username and not parsed.password
                and not any(ch.isspace() for ch in value) else "")
    except (ValueError, TypeError, AttributeError):
        return ""

def iso_date(value):
    raw = str(value or "").strip()
    if not raw: return None
    try:
        parsed = parsedate_to_datetime(raw)
    except (ValueError, TypeError, IndexError):
        try: parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError: return None
    if parsed.tzinfo is None: return None
    return parsed.astimezone(timezone.utc)

def parse_feed(raw, source, now=None):
    now = now or datetime.now(timezone.utc)
    if len(raw) > MAX_BYTES: raise ValueError("Feed exceeds size limit")
    # RSS may embed literal HTML <!DOCTYPE ...> safely inside CDATA. Mask only
    # well-formed CDATA spans before rejecting active XML declarations.
    xml_outside_cdata = re.sub(rb"<!\[CDATA\[[\s\S]*?\]\]>", b"", raw)
    if re.search(rb"<!\s*(DOCTYPE|ENTITY)", xml_outside_cdata, re.I):
        raise ValueError("DTD and entities prohibited")
    root = ET.fromstring(raw)
    if root.tag not in ("rss", ATOM + "feed", "{http://purl.org/rss/1.0/}RDF", "RDF"):
        raise ValueError("Not RSS/Atom")
    label, _, default_category = source[:3]
    source_type = source[3] if len(source) > 3 else "official_primary"
    source_region = source[4] if len(source) > 4 else None
    if root.tag == ATOM + "feed":
        nodes = root.findall(ATOM + "entry")
    else:
        nodes = root.findall("./channel/item") or root.findall("{http://purl.org/rss/1.0/}item")
    data = []
    for node in nodes[:60]:
        is_atom = node.tag == ATOM + "entry"
        title = clean(node.findtext(ATOM+"title" if is_atom else "title"), 170)
        if is_atom:
            link = next((el.get("href") for el in node.findall(ATOM+"link")
                         if el.get("rel", "alternate") == "alternate" and el.get("href")), "")
            stamp = node.findtext(ATOM+"published") or node.findtext(ATOM+"updated")
            summary = node.findtext(ATOM+"summary") or node.findtext(ATOM+"content")
        else:
            link = node.findtext("link")
            stamp = node.findtext("pubDate") or node.findtext("{http://purl.org/dc/elements/1.1/}date")
            summary = node.findtext("description")
        url, published = safe_url(link), iso_date(stamp)
        if not title or not url or not published: continue
        if published < now-timedelta(days=MAX_AGE) or published > now+timedelta(hours=6): continue
        key = hashlib.sha256(url.split("#",1)[0].encode("utf8")).hexdigest()[:18]
        region,region_basis=region_for(title,summary,source_region)
        data.append({
            "id":"fin-"+key, "title":title, "summary":clean(summary, 210),
            "url":url, "source":label, "category":default_category,
            "published_at":published.isoformat(timespec="seconds"),
            "verification":"media_report_metadata_not_independently_verified" if source_type=="media_report" else "official_source_metadata_not_independently_fact_checked",
            "source_type":source_type, "region":region, "region_basis":region_basis,
            "language":"source_original", "content_type":"finance",
        })
    return data

def download(url):
    req = Request(url, headers={"User-Agent":"DAVYLAB-TopicStudio/1.0 (contact: github.com/chenzhe223-tech)", "Accept":"application/rss+xml,application/atom+xml,application/xml,text/xml"})
    with urlopen(req, timeout=18) as response:
        if response.status != 200: raise ValueError("HTTP "+str(response.status))
        data = response.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES: raise ValueError("response exceeds limit")
        return data

def compile_snapshot(fetch=download, now=None, existing=None):
    now=now or datetime.now(timezone.utc)
    all_items, diag=[],[]
    for source in SOURCES:
        try:
            parsed=parse_feed(fetch(source[1]),source,now)
            diag.append({"source":source[0],"status":"ok" if parsed else "no_recent_items","count":len(parsed)})
            all_items.extend(parsed)
        except Exception as e:
            diag.append({"source":source[0],"status":"error","count":0,"detail":str(e)[:160]})
    successful = sum(d["status"]!="error" for d in diag)
    if successful == 0: raise RuntimeError("All finance feeds unavailable; preserving last good snapshot")
    previous=(existing or {}).get("articles",[])
    old=[x for x in previous if isinstance(x,dict) and safe_url(x.get("url")) and iso_date(x.get("published_at"))]
    combined=all_items + old
    unique={}
    for item in combined:
        day=iso_date(item.get("published_at"))
        if day and day >= now-timedelta(days=MAX_AGE):
            unique.setdefault(item["url"].split("#",1)[0].lower(),item)
    recent=list(unique.values())
    if not recent and existing and existing.get("articles"):
        # No current verified dates: preserve cache but explicitly label stale.
        recent=[a for a in existing["articles"][:150] if isinstance(a,dict) and a.get("published_at") and a.get("id")]
    for item in recent:
        if item.get("region") not in ("中国","全球"):
            item["region"],item["region_basis"]=region_for(item.get("title"),item.get("summary"))
    ranked=sort_and_rank(recent,now)
    # Prevent high-volume international feeds from drowning out China coverage.
    china=[a for a in ranked if a.get("region")=="中国"][:45]
    chosen={a["id"]:a for a in china}
    for item in ranked:
        if len(chosen)>=150:break
        chosen.setdefault(item["id"],item)
    articles=sort_and_rank(list(chosen.values()),now)
    return {
        "schema_version":2, "source":"DAVYLAB official public feeds and openly available media RSS",
        "checked_at":now.isoformat(timespec="seconds"),"count":len(articles),
        "latest_published_at":max((a["published_at"] for a in articles),default=None),
        "china_count":sum(a.get("region")=="中国" for a in articles),
        "rank_method":VERSION,"rank_weights":WEIGHTS,
        "rank_disclaimer":"Five editorial relevance scores are heuristic estimates. Heat is topic relevance, NOT real traffic, views, shares, or verified popularity.",
        "fresh_within_72h":sum(iso_date(a.get("published_at")) is not None and iso_date(a["published_at"]) >= now-timedelta(hours=72) for a in articles),
        "status":"ok" if articles else "empty","sources":diag,"articles":articles,
        "disclaimer":"Original RSS metadata only. China vs global is source-scoped or keyword-derived. Editorial ranking is a heuristic, not popularity analytics. No fabricated traffic, market data or investment advice."
    }

def main():
    args=argparse.ArgumentParser()
    args.add_argument("--output",type=pathlib.Path,default=DEST)
    opt=args.parse_args()
    try:
        old=json.loads(opt.output.read_text(encoding="utf8")) if opt.output.exists() else None
        result=compile_snapshot(existing=old)
        if not result["count"]: raise ValueError("No valid finance stories, preserving previous valid snapshot")
        opt.output.parent.mkdir(parents=True,exist_ok=True)
        temp=opt.output.with_suffix(".tmp")
        temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
        temp.replace(opt.output)
        print("Finance refreshed:",result["count"],"sources:",result["sources"])
        return 0
    except Exception as err:
        print("Finance sync failed, snapshot preserved:",err,file=sys.stderr)
        return 1
if __name__=="__main__": raise SystemExit(main())
