"""Evidence-aware Skill discovery ranking and durable recommendation history."""
from __future__ import annotations
import datetime as dt
import difflib
import hashlib
import json
import math
import re
import urllib.parse
from pathlib import Path

STOP={"the","and","for","with","from","this","that","into","your","using","use","skill","skills","agent","agents","ai","open","source","tool","tools","project","github","claude","codex","mcp"}
def canonical_project_id(value: str) -> str:
    raw=(value or "").strip()
    if not raw: return ""
    if "/" in raw and "://" not in raw:
        raw="https://github.com/"+raw
    try:
        p=urllib.parse.urlsplit(raw if "://" in raw else "https://github.com/"+raw)
        host=(p.hostname or "").lower().removeprefix("www.")
        if host=="github.com":
            parts=[x for x in p.path.strip("/").split("/") if x]
            if len(parts)>=2:
                owner,repo=parts[0].lower(),re.sub(r"\.git$","",parts[1].lower())
                if owner and repo: return f"github.com/{owner}/{repo}"
        if host: return urllib.parse.urlunsplit(("https",host,p.path.rstrip("/").lower(),"",""))
    except Exception:
        return ""
    return ""
def project_tokens(item: dict) -> set[str]:
    value=" ".join(str(item.get(k) or "") for k in ("name","description","description_zh","description_en","daily_theme","category","aliases"))
    value=re.sub(r"https?://\S+"," ",value.lower())
    return {x for x in re.findall(r"[a-z0-9][a-z0-9+_.-]{1,}|[\u4e00-\u9fff]{2,}",value) if x not in STOP}
def similarity(a: dict,b: dict) -> float:
    ta,tb=project_tokens(a),project_tokens(b)
    if not ta or not tb: return 0.0
    jac=len(ta&tb)/max(1,len(ta|tb))
    containment=len(ta&tb)/max(1,min(len(ta),len(tb)))
    seq=difflib.SequenceMatcher(None," ".join(sorted(ta))," ".join(sorted(tb))).ratio()
    # Require substantial overlap, not just shared generic AI vocabulary.
    return max(jac, containment, seq*0.7)
def identify_duplicate(item: dict, history: list[dict], semantic_threshold: float=0.68) -> dict|None:
    identity=canonical_project_id(str(item.get("url") or item.get("repository_url") or item.get("name") or ""))
    aliases={str(x).strip().lower() for x in (item.get("aliases") or []) if str(x).strip()}
    name=str(item.get("name") or "").strip().lower()
    for old in history:
        old_identity=canonical_project_id(str(old.get("url") or old.get("repository_url") or old.get("name") or ""))
        if identity and old_identity and identity==old_identity:
            return {"kind":"canonical_id","history_date":old.get("_history_date"),"name":old.get("name"),"url":old.get("url") or old.get("repository_url")}
        old_aliases={str(x).strip().lower() for x in (old.get("aliases") or []) if str(x).strip()}
        old_name=str(old.get("name") or "").strip().lower()
        if name and (name==old_name or name in old_aliases or old_name in aliases or aliases&old_aliases):
            return {"kind":"name_or_alias","history_date":old.get("_history_date"),"name":old.get("name"),"url":old.get("url") or old.get("repository_url")}
        # Avoid treating a shared owner/company as a duplicate; require substantial capability overlap.
        score=similarity(item,old)
        if score>=semantic_threshold:
            return {"kind":"functional_similarity","score":round(score,3),"history_date":old.get("_history_date"),"name":old.get("name"),"url":old.get("url") or old.get("repository_url")}
    return None
def load_recommendation_history(archive_dir: Path,today: str,window_days: int=90) -> dict:
    if not archive_dir.exists(): return {"status":"unavailable","records":[],"files_read":0,"coverage_days":0,"errors":["archive directory missing"]}
    try: current=dt.date.fromisoformat(today)
    except ValueError: return {"status":"unavailable","records":[],"files_read":0,"coverage_days":0,"errors":["invalid current date"]}
    lower=current-dt.timedelta(days=window_days)
    paths=[]
    errors=[]
    for path in sorted(archive_dir.glob("*.json")):
        try: day=dt.date.fromisoformat(path.stem)
        except ValueError: continue
        if lower<=day<current: paths.append((day,path))
    records=[]
    seen_days=set()
    for day,path in paths:
        try:
            doc=json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(doc,dict): raise ValueError("archive root must be object")
            items=doc.get("skills") or []
            if not isinstance(items,list): raise ValueError("skills must be list")
            for item in items:
                if not isinstance(item,dict): continue
                if not (item.get("name") or item.get("url") or item.get("repository_url")): continue
                record=dict(item); record["_history_date"]=day.isoformat()
                records.append(record)
            seen_days.add(day)
        except Exception as exc:
            errors.append({"path":path.name,"error":type(exc).__name__})
    if errors:
        status="unavailable"
    elif not paths:
        status="unavailable"
        errors.append({"path":str(archive_dir),"error":"no historical archive files in requested window"})
    else:
        status="complete" if (current-lower).days<=len(seen_days) else "partial"
    return {"status":status,"records":records,"files_read":len(seen_days),"coverage_days":len(seen_days),"window_days":window_days,"window_start":lower.isoformat(),"window_end":(current-dt.timedelta(days=1)).isoformat(),"errors":errors}
def _clamp(v: float,lo: float=0,hi: float=100)->float: return max(lo,min(hi,v))
def score_candidate(item: dict, today: str) -> dict:
    stars=max(0,int(item.get("stars") or 0))
    # GitHub search currently gives a cumulative count, not a trustworthy historical delta.
    # Do not infer stars/week from updated_at.
    heat=_clamp(math.log10(stars+1)/5*25,0,25)
    updated=str(item.get("updated") or "")
    age_days=None
    try: age_days=max(0,(dt.date.fromisoformat(today)-dt.date.fromisoformat(updated[:10])).days)
    except Exception: pass
    maintenance=10 if age_days is not None and age_days<=30 else 8 if age_days is not None and age_days<=90 else 5 if age_days is not None and age_days<=365 else 2
    text=" ".join(str(item.get(k) or "") for k in ("name","description","topics","daily_theme")).lower()
    trend_terms=("agent","skill","coding","mcp","multimodal","eval","security","browser","workflow","research","data","automation")
    trend=_clamp(8+min(12,sum(1 for x in trend_terms if x in text)*1.5),0,20)
    usefulness=20 if len(str(item.get("description") or ""))>=120 else 16 if len(str(item.get("description") or ""))>=70 else 8 if item.get("description") else 0
    quality=15 if item.get("license") and item.get("readme_verified",True) and item.get("evidence_verified") else 7 if item.get("license") else 0
    novelty=10 if item.get("novelty_status")=="new" else 4
    total=round(heat+trend+usefulness+quality+novelty+maintenance,1)
    confidence="high" if item.get("evidence_verified") and item.get("license") and item.get("readme_verified",True) else "medium" if item.get("license") else "low"
    return {**item,"canonical_id":canonical_project_id(str(item.get("url") or item.get("name") or "")),
      "stars_total":stars,"stars_delta_7d":None,"stars_delta_30d":None,
      "heat_score":round(heat,1),"trend_score":round(trend,1),"relevance_score":round(trend,1),
      "usefulness_score":round(usefulness,1),"quality_score":round(quality,1),
      "novelty_score":round(novelty,1),"maintenance_score":round(maintenance,1),
      "total_score":total,"age_since_update_days":age_days,
      "growth_data_status":"暂无可靠历史 Stars 快照，未推算近期增长",
      "confidence_level":confidence,"evidence_checked_at":item.get("evidence_checked_at"),
      "maturity_level":"持续维护" if age_days is not None and age_days<=90 else "维护状态待确认",
      "compatibility_status":"文档及仓库元数据已核验；未执行安装测试",
      "security_status":"未完成专项安全审计",
      "recommendation_type":"成熟实用" if stars>=1000 and age_days is not None and age_days<=90 else "趋势观察（未验证增长）" if age_days is not None and age_days<=30 else "维护状态观察",
      "user_feedback":[]}
def build_radar(candidates: list[dict],archive_dir: Path,today: str,limit: int=10) -> dict:
    history=load_recommendation_history(archive_dir,today,90)
    if history["status"]=="unavailable":
        return {"status":"history_unavailable","history":{"status":history["status"],"files_read":history["files_read"],"coverage_days":history["coverage_days"],"window_days":90,"errors":history["errors"]},"selected":[],"excluded":[]}
    selected=[]; excluded=[]; selected_today=[]
    # Rank only evidence-verified candidates, and never fabricate historical growth.
    ranked=sorted(candidates,key=lambda x:float(x.get("total_score") or 0),reverse=True)
    for item in ranked:
        hit=identify_duplicate(item,history["records"])
        if not hit: hit=identify_duplicate(item,selected_today)
        material_update=(item.get("material_update_verified") is True
            and bool(item.get("re_recommendation_reason"))
            and str(item.get("material_update_evidence_url") or "").startswith(("https://","http://")))
        if hit and not material_update:
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":"duplicate","match":hit})
            continue
        if hit and material_update:
            item["recommendation_history_match"]=hit
            item["novelty_status"]="material_update"
        if item.get("quality_status")!="PASS":
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":item.get("quality_status") or "not_verified"})
            continue
        if hit and material_update:
            item["novelty_status"]="material_update"
        selected.append(item); selected_today.append(item)
        if len(selected)>=limit: break
    return {"status":"PASS" if history["status"] in ("complete","partial") else "history_unavailable",
      "history":{"status":history["status"],"files_read":history["files_read"],"coverage_days":history["coverage_days"],"window_days":90,"window_start":history.get("window_start"),"window_end":history.get("window_end"),"errors":history["errors"],"records":len(history["records"])},
      "selected":selected,"excluded":excluded}
