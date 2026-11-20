#!/usr/bin/env python3
"""Independent overseas editorial leads supplement XNews when its curator is quiet."""
from __future__ import annotations
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import sys
import sync_finance as rss
DEST=Path(__file__).resolve().parents[1]/"data"/"overseas-discovery.json"
SOURCES=[
 ("Simon Willison 技术观点","https://simonwillison.net/atom/everything/","海外技术观点"),
 ("GitHub AI 官方博客","https://github.blog/ai-and-ml/feed/","海外AI观点"),
 ("Hugging Face 博客","https://huggingface.co/blog/feed.xml","海外AI观点"),
]
def compile_snapshot(fetch=rss.download,now=None,previous=None):
 now=now or datetime.now(timezone.utc)
 entries=[];checks=[]
 for source in SOURCES:
  try:
   rows=rss.parse_feed(fetch(source[1]),source,now)
   checks.append({"source":source[0],"status":"ok" if rows else "no_recent_items","count":len(rows)})
   for item in rows:
    entries.append({"id":"ext-"+item["id"][4:],"title":item["title"],
     "summary":item["summary"],"date":item["published_at"][:10],
     "original_url":item["url"],"source":source[0],"source_kind":"independent_original",
     "tags":[source[2]],"verification":"original_source_metadata_not_independently_verified"})
  except Exception as e: checks.append({"source":source[0],"status":"error","count":0,"detail":str(e)[:120]})
 if all(x["status"]=="error" for x in checks):raise RuntimeError("All overseas primary feeds unavailable")
 for old in (previous or {}).get("articles",[]):
  if isinstance(old,dict) and old.get("source_kind")=="independent_original":
   entries.append(old)
 unique={}
 for a in entries:
  if rss.safe_url(a.get("original_url")):
   unique.setdefault(a["original_url"].lower().split("#")[0],a)
 data=sorted(unique.values(),key=lambda a:a.get("date",""),reverse=True)[:100]
 return {"schema_version":1,"source":"independent_public_overseas_original_sources",
  "checked_at":now.isoformat(timespec="seconds"),"count":len(data),
  "articles":data,"sources":checks,
  "note":"Original public metadata only; NOT XNews translated articles."}
def main():
 p=argparse.ArgumentParser();p.add_argument("--output",type=Path,default=DEST);args=p.parse_args()
 try:
  previous=json.loads(args.output.read_text(encoding="utf8")) if args.output.exists() else None
  data=compile_snapshot(previous=previous)
  if not data["articles"]:raise ValueError("No valid content, preserve last good")
  args.output.parent.mkdir(parents=True,exist_ok=True)
  tmp=args.output.with_suffix(".tmp")
  tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8");tmp.replace(args.output)
  print("Overseas sources:",data["count"],data["sources"]);return 0
 except Exception as e:
  print("Overseas sync failed, last good preserved:",e,file=sys.stderr);return 1
if __name__=="__main__":raise SystemExit(main())
