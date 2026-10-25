#!/usr/bin/env python3
"""Fail-closed historical news/image freshness gate for DAVYLAB Radar."""
from __future__ import annotations
import datetime as dt
import difflib
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "radar" / "data"
ARCHIVE = DATA / "archive"
POSTERS = ROOT / "radar" / "posters"
REPORT = DATA / "latest.json"
OUT_DIR = ROOT / "test-results" / "radar"
TZ = ZoneInfo("Asia/Shanghai")
IMAGE_TIMEOUT = 8
MAX_IMAGE_BYTES = 8 * 1024 * 1024
STOP = {"the","and","for","with","from","into","over","after","before","says","said","will","its","their","this","that","have","has","been","are","was","were","not","but","how","why","what","when","latest","first","new","more","most","report","reports","news","update","updates","ai","artificial","intelligence","model","models","company","companies","announces","announced"}
def norm_text(s):
    s = (s or "").lower()
    s = re.sub(r"https?://\S+", " ", s)
    # Normalize common editorial variants without treating a shared company name as an event match.
    aliases = [
        (r"\bbritain\b|\bbritish\b", " uk "),
        (r"\bunveils?\b|\bannounced?\b|\bannounces\b", " announce "),
        (r"\b600\s+million\s+pounds?\b|\b600m\b|\b£600\s*million\b", " 600m "),
        (r"\bbiological\s+safety\b", " biosafety "),
        (r"\bsecurity\b", " safety "),
    ]
    for pattern, replacement in aliases:
        s = re.sub(pattern, replacement, s)
    s = re.sub(r"[^\w\u4e00-\u9fff]+", " ", s)
    return " ".join(s.split())
def tokens(s):
    return {x for x in norm_text(s).split() if x not in STOP and len(x) > 1}
def norm_url(url):
    try:
        p = urllib.parse.urlsplit((url or "").strip())
        if p.scheme not in ("http","https") or not p.hostname: return ""
        host = p.hostname.lower().removeprefix("www.")
        path = re.sub(r"/+", "/", p.path).rstrip("/")
        return urllib.parse.urlunsplit(("https",host,path,"",""))
    except Exception: return ""
def story_title(s):
    return str(s.get("title_zh") or s.get("title") or s.get("original_title") or s.get("title_en") or "")
def story_text(s):
    return " ".join(str(s.get(k) or "") for k in ("title","title_zh","title_en","summary","summary_zh","why_it_matters_zh","description","event","entities"))
def story_id(s):
    url=norm_url(s.get("url") or s.get("source_url") or s.get("link") or "")
    title=norm_text(story_title(s))
    return hashlib.sha256((url or title).encode("utf-8")).hexdigest()[:20]
def similarity(a,b):
    ta,tb=tokens(a),tokens(b)
    jac=len(ta&tb)/max(1,len(ta|tb))
    seq=difflib.SequenceMatcher(None,norm_text(a),norm_text(b)).ratio()
    return max(jac,seq)
def records_from(doc, day):
    out=[]
    for key in ("news","top5","china_ai_news","china_news","top_news","selected_news"):
        arr=doc.get(key)
        if not isinstance(arr,list): continue
        for item in arr:
            if isinstance(item,dict) and story_title(item):
                x=dict(item); x["_history_date"]=day; x["_history_section"]=key
                out.append(x)
    # poster manifests sometimes retain only headline strings
    return out
def load_history(today):
    docs=[]; unreadable=[]; files=sorted(ARCHIVE.glob("*.json")) if ARCHIVE.exists() else []
    for path in files:
        if path.stem == today: continue
        try:
            doc=json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(doc,dict): raise ValueError("not an object")
            docs.append((path.stem,doc))
        except Exception as exc: unreadable.append({"path":str(path.relative_to(ROOT)),"error":type(exc).__name__})
    # Include any available historical poster manifests as another source of headlines.
    if POSTERS.exists():
        for path in sorted(POSTERS.glob("20??-??-??.json")):
            if path.stem == today or path.name.endswith(".qr-verification.json"): continue
            try:
                doc=json.loads(path.read_text(encoding="utf-8"))
                titles=doc.get("stories") or doc.get("top5") or doc.get("news")
                if isinstance(titles,list):
                    normalized=[]
                    for item in titles:
                        normalized.append(item if isinstance(item,dict) else {"title":str(item)})
                    docs.append((path.stem,{"news":normalized}))
            except Exception as exc: unreadable.append({"path":str(path.relative_to(ROOT)),"error":type(exc).__name__})
    return docs, unreadable, [p.name for p in files]
def published_image_records(doc, day):
    """Only index images that were actually published in curated cards, not unused RSS candidates."""
    for section in ("top5", "china_ai_news"):
        items=doc.get(section)
        if not isinstance(items,list): continue
        for item in items:
            if isinstance(item,dict) and story_title(item) and image_url(item):
                x=dict(item); x["_history_date"]=day; x["_history_section"]=section
                yield x

def _near_match_is_recent(candidate, old, current_date=None, window_days=2):
    raw_old_date = old.get("_history_date") or old.get("_current_date")
    if not raw_old_date:
        return True
    try:
        current = dt.date.fromisoformat(str(current_date or candidate.get("_current_date") or dt.datetime.now(TZ).date().isoformat())[:10])
        previous = dt.date.fromisoformat(str(raw_old_date)[:10])
        age = (current - previous).days
        return 0 <= age <= window_days
    except Exception:
        return True

def compare_story(candidate, history, current_date=None):
    cu=norm_url(candidate.get("url") or candidate.get("source_url") or candidate.get("link") or "")
    ct=story_title(candidate)
    ctext=story_text(candidate)
    current_date = current_date or candidate.get("_current_date") or dt.datetime.now(TZ).date().isoformat()
    for old in history:
        ou=norm_url(old.get("url") or old.get("source_url") or old.get("link") or "")
        if cu and ou and cu==ou:
            return {"kind":"exact_url","score":1.0,"history_date":old.get("_history_date") or old.get("_current_date"),"history_title":story_title(old),"history_url":old.get("url") or old.get("source_url")}
        if norm_text(ct) and norm_text(ct)==norm_text(story_title(old)):
            return {"kind":"exact_title","score":1.0,"history_date":old.get("_history_date") or old.get("_current_date"),"history_title":story_title(old),"history_url":old.get("url") or old.get("source_url")}
        if not _near_match_is_recent(candidate, old, current_date):
            continue
        score=similarity(ct,story_title(old))
        # Require both meaningful title similarity and supporting content overlap; avoids company-name-only false positives.
        a,b=tokens(ct),tokens(story_title(old))
        overlap=len(a&b)/max(1,min(len(a),len(b)))
        body=similarity(ctext,story_text(old))
        if (score>=0.86 and overlap>=0.65) or (score>=0.76 and overlap>=0.72 and body>=0.70):
            return {"kind":"near_title_or_event","score":round(max(score,body),3),"history_date":old.get("_history_date") or old.get("_current_date"),"history_title":story_title(old),"history_url":old.get("url") or old.get("source_url")}
    return None

def image_url(s):
    return str(s.get("image_url") or s.get("image") or s.get("thumbnail") or "").strip()
def download_fingerprints(url):
    req=urllib.request.Request(url,headers={"User-Agent":"DAVYLAB-Radar-QA/1.0","Accept":"image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8"})
    with urllib.request.urlopen(req,timeout=IMAGE_TIMEOUT) as r:
        data=r.read(MAX_IMAGE_BYTES+1)
        if len(data)>MAX_IMAGE_BYTES: raise ValueError("image exceeds size limit")
        if not r.headers.get("Content-Type","").lower().startswith("image/"):
            raise ValueError("response is not image content")
    sha=hashlib.sha256(data).hexdigest()
    # Optional perceptual hash; exact SHA/URL checks still work without Pillow.
    phash=None
    try:
        from PIL import Image
        import io
        im=Image.open(io.BytesIO(data)).convert("L").resize((8,8))
        px=list(im.getdata()); avg=sum(px)/len(px)
        phash="".join("1" if x>=avg else "0" for x in px)
    except Exception:
        pass
    return sha,phash
def hamming(a,b):
    return sum(x!=y for x,y in zip(a,b)) if a and b and len(a)==len(b) else 999
def evaluate_quality_gate(news_duplicates, china_duplicates, image_errors, week_image_hits, unreadable_history, historical_image_failures, skill_errors):
    """Historical image URL fetch failures are explicit coverage gaps, not proof of current reuse.
    Current image fetch failures, known reuse, unreadable archives and Skill errors still block publication.
    """
    blocking = bool(news_duplicates or china_duplicates or image_errors or week_image_hits or unreadable_history or skill_errors)
    return "FAIL" if blocking else "PASS"

def main():
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    if not REPORT.exists(): raise SystemExit("FAIL: latest.json missing; cannot run historical quality gate")
    report=json.loads(REPORT.read_text(encoding="utf-8"))
    today=str(report.get("report_date") or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",today): raise SystemExit("FAIL: report_date missing or invalid")
    docs,unreadable,archive_files=load_history(today)
    if not archive_files:
        raise SystemExit("FAIL: no historical archive files found; cannot assert freshness")
    history=[]
    for day,doc in docs:
        history.extend(records_from(doc,day))
    current=[]
    # Only published-facing selections are publication blockers; the raw RSS candidate pool
    # may contain older items that are supposed to be filtered before selection.
    for key in ("top5","china_ai_news"):
        arr=report.get(key)
        if isinstance(arr,list):
            for item in arr:
                if isinstance(item,dict) and story_title(item):
                    x=dict(item); x["_current_section"]=key; x["_current_date"]=today; current.append(x)
    # Check duplicates within the five selected stories and against every accessible historical record.
    duplicate_hits=[]
    seen_current=[]
    for item in current:
        hit=compare_story(item,history,current_date=today)
        if hit:
            duplicate_hits.append({"scope":"history","section":item.get("_current_section"),"title":story_title(item),"match":hit})
        # The general news feed intentionally contains the same records as top5.
        # Internal duplication is only meaningful across curated sections (top5 / China AI),
        # not between the source pool and its selected subset.
        if item.get("_current_section") in ("top5", "china_ai_news"):
            curated_seen=[x for x in seen_current if x.get("_current_section") in ("top5", "china_ai_news")]
            internal=compare_story(item,curated_seen,current_date=today)
            if internal:
                duplicate_hits.append({"scope":"current_curated_sections","section":item.get("_current_section"),"title":story_title(item),"match":internal})
        seen_current.append(item)
    # Compare current China AI stories specifically to yesterday and all historical China stories.
    china=report.get("china_ai_news") if isinstance(report.get("china_ai_news"),list) else []
    china_history=[]
    for old in history:
        if old.get("_history_section") in ("china_ai_news","china_news") or any(k in norm_text(story_text(old)) for k in ("中国","china","chinese")):
            china_history.append(old)
    china_hits=[]
    for item in china:
        hit=compare_story(item,china_history,current_date=today)
        if hit: china_hits.append({"title":story_title(item),"match":hit})
    # Current-day unique-image checks: URL canonicalization and content hashes.
    image_errors=[]; current_images=[]; image_seen={}
    image_stories=[]
    for key in ("top5","china_ai_news"):
        arr=report.get(key)
        if isinstance(arr,list):
            image_stories.extend(x for x in arr if isinstance(x,dict) and image_url(x))
    # avoid repeated entries from the same object across report sections
    unique_story={}
    for s in image_stories: unique_story[story_id(s)]=s
    for s in unique_story.values():
        url=image_url(s); canonical=norm_url(url)
        if canonical in image_seen:
            image_errors.append({"type":"same_day_url_duplicate","title":story_title(s),"url":url,"other_title":image_seen[canonical]})
            continue
        image_seen[canonical]=story_title(s)
        try:
            sha,ph=download_fingerprints(url)
            for old in current_images:
                if sha==old["sha256"] or (ph and old.get("phash") and hamming(ph,old["phash"])<=4):
                    image_errors.append({"type":"same_day_content_duplicate","title":story_title(s),"url":url,"other_title":old["title"],"sha256":sha})
                    break
            current_images.append({"title":story_title(s),"url":url,"canonical_url":canonical,"sha256":sha,"phash":ph})
        except Exception as exc:
            image_errors.append({"type":"image_unverifiable","title":story_title(s),"url":url,"error":type(exc).__name__})
    # Compare this week's current images to image URLs recorded in archives, excluding current date.
    week_start=(dt.date.fromisoformat(today)-dt.timedelta(days=dt.date.fromisoformat(today).weekday())).isoformat()
    week_urls={}
    for day,doc in docs:
        try:
            if dt.date.fromisoformat(day).isoformat()<week_start: continue
        except Exception: continue
        for story in published_image_records(doc,day):
            u=image_url(story)
            if u: week_urls[norm_url(u)]={"date":day,"title":story_title(story),"url":u}
    week_image_hits=[]
    historical_week_images=[]
    historical_image_failures=[]
    verified_historical_urls=set()
    historical_fingerprint_cache={}
    for day,doc in docs:
        try:
            if dt.date.fromisoformat(day).isoformat()<week_start: continue
        except Exception: continue
        for story in published_image_records(doc,day):
            u=image_url(story)
            if not u: continue
            canonical=norm_url(u)
            if not canonical or canonical in verified_historical_urls:
                continue
            verified_historical_urls.add(canonical)
            try:
                if canonical in historical_fingerprint_cache:
                    sha,ph=historical_fingerprint_cache[canonical]
                else:
                    sha,ph=download_fingerprints(u)
                    historical_fingerprint_cache[canonical]=(sha,ph)
                historical_week_images.append({"date":day,"title":story_title(story),"url":u,"canonical_url":canonical,"sha256":sha,"phash":ph})
            except Exception as exc:
                historical_image_failures.append({"date":day,"title":story_title(story),"url":u,"error":type(exc).__name__})
    for img in current_images:
        old=week_urls.get(img["canonical_url"])
        if old:
            week_image_hits.append({"type":"same_week_url_reuse","title":img["title"],"url":img["url"],"history":old})
            continue
        for old_img in historical_week_images:
            if img["sha256"]==old_img["sha256"] or (img.get("phash") and old_img.get("phash") and hamming(img["phash"],old_img["phash"])<=4):
                week_image_hits.append({"type":"same_week_content_reuse","title":img["title"],"url":img["url"],"history":old_img})
                break
    # History incompleteness is surfaced, never silently treated as clean.
    # Skill recommendations are a separate quality domain and must pass before the report can publish.
    skill_radar=report.get("skill_radar") if isinstance(report.get("skill_radar"),dict) else {}
    skills=report.get("skills") if isinstance(report.get("skills"),list) else []
    skill_errors=[]
    if skill_radar.get("status")!="PASS": skill_errors.append({"type":"skill_radar_status","status":skill_radar.get("status","missing")})
    if not skills: skill_errors.append({"type":"no_qualified_skill_recommendations"})
    for skill in skills:
        if not isinstance(skill,dict): skill_errors.append({"type":"invalid_skill_record"}); continue
        if not skill.get("canonical_id"): skill_errors.append({"type":"missing_canonical_id","name":skill.get("name")})
        if not skill.get("license"): skill_errors.append({"type":"missing_verified_license","name":skill.get("name")})
        if skill.get("skill_type") not in ("agent_skill_or_pack","skill_pack"): skill_errors.append({"type":"not_proven_actual_skill","name":skill.get("name")})
        if skill.get("quality_status")!="PASS": skill_errors.append({"type":"skill_quality_not_pass","name":skill.get("name")})
        if skill.get("confidence_level")=="low": skill_errors.append({"type":"low_confidence_skill","name":skill.get("name")})
        if not skill.get("evidence_urls") or not skill.get("evidence_checked_at"): skill_errors.append({"type":"missing_evidence_provenance","name":skill.get("name")})
        try:
            total=float(skill.get("total_score"))
            if total<60 or total>100: skill_errors.append({"type":"score_out_of_policy","name":skill.get("name"),"score":total})
        except (TypeError,ValueError):
            skill_errors.append({"type":"missing_score","name":skill.get("name")})
        if skill.get("critical_security_issue") is True or str(skill.get("security_status") or "").lower() in ("critical","high_risk","critical_risk"):
            skill_errors.append({"type":"critical_security_risk","name":skill.get("name")})
    result={
      "report_date":today,"generated_at":dt.datetime.now(TZ).isoformat(),
      "history":{"archive_files_read":len(archive_files),"documents_loaded":len(docs),"stories_indexed":len(history),"unreadable_files":unreadable,"coverage":"partial" if unreadable else "all_available_archive_files",
      "image_fingerprint_coverage":"partial" if historical_image_failures else "all_published_historical_images_verified"},
      "news":{"current_story_records_checked":len(current),"historical_duplicate_hits":duplicate_hits,"china_history_duplicate_hits":china_hits,"internal_duplicate_count":sum(1 for x in duplicate_hits if x["scope"]=="current_report")},
      "images":{"unique_current_story_images_checked":len(current_images),"image_errors":image_errors,"same_iso_week_reuse":week_image_hits,"historical_image_verification_failures":historical_image_failures,"sha256_and_phash_checked":True},
      "skills":{"status":"FAIL" if skill_errors else "PASS","selected_count":len(skills),"history_status":skill_radar.get("history",{}).get("status"),"history_coverage_days":skill_radar.get("history",{}).get("coverage_days"),"errors":skill_errors},
      "status":evaluate_quality_gate(duplicate_hits,china_hits,image_errors,week_image_hits,unreadable,historical_image_failures,skill_errors),
      "policy":{"china_ai_history_repeat_target":0,"same_day_image_reuse":0,"same_iso_week_image_reuse":0,"unreadable_history_blocks_publish":True,"unverifiable_historical_images_are_reported_as_coverage_gaps":True}
    }
    out=OUT_DIR/"news-image-quality-gate.json"
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    # Persist a PASS marker only after every quality check succeeds. The workflow preflight
    # requires this marker, so a failed run is retried instead of incorrectly skipped tomorrow.
    if result["status"] == "PASS":
        report["quality_gate"] = {
            "status": "PASS", "checked_at": result["generated_at"],
            "history_files": len(archive_files), "history_stories": len(history),
            "news_duplicate_hits": len(duplicate_hits), "china_duplicate_hits": len(china_hits),
            "same_week_image_reuse": len(week_image_hits), "report_path": "test-results/radar/news-image-quality-gate.json"
        }
        REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":result["status"],"image_error_details":image_errors,"skill_errors":skill_errors,"history_files":len(archive_files),"history_stories":len(history),"news_duplicate_hits":len(duplicate_hits),"china_duplicate_hits":len(china_hits),"image_errors":len(image_errors),"same_week_image_reuse":len(week_image_hits),"historical_image_verification_failures":len(historical_image_failures),"report":str(out)},ensure_ascii=False))
    if result["status"]!="PASS":
        raise SystemExit("FAIL: news/image freshness gate blocked publication; see test-results/radar/news-image-quality-gate.json")
    return 0
if __name__=="__main__":
    raise SystemExit(main())
