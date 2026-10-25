"""Evidence-aware Skill discovery ranking and durable recommendation history."""
from __future__ import annotations
import datetime as dt
import difflib
import hashlib
import json
import math
import re
import urllib.parse

ENGINE_VERSION = "2026.10.25.1"
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
def infer_skill_category(item: dict) -> str:
    text=" ".join([str(item.get("name") or ""),str(item.get("description") or ""), " ".join(str(x) for x in (item.get("topics") or []))]).lower()
    rules=[
        ("安全与评估",("security","safety","vulnerability","red team","evaluation","benchmark","evals","guardrail")),
        ("多模态与创作",("video","image","audio","music","creative","montage","animation","media","design","ui/ux","slides","presentation","storyboard")),
        ("数据与分析",("data","analytics","sql","database","dashboard","spreadsheet","query","visualization","bi ")),
        ("研究与知识管理",("research","scientific","paper","literature","knowledge","search","citation","academic")),
        ("软件工程与测试",("coding","code review","architecture","frontend","backend","software","programming","debugging","testing","test automation","developer","devtools")),
        ("办公与业务自动化",("office","document","email","calendar","marketing","sales","crm","finance","invoice","customer support")),
        ("Agent 工作流与规划",("agent","planning","orchestration","workflow","memory","context","multi-agent","task")),
        ("个人效率与知识管理",("adhd","productivity","focus","habit","personal workflow","task management","time management")),
    ]
    for category,keywords in rules:
        if any(k in text for k in keywords): return category
    return "通用 Agent 技能"

def actual_skill_files(tree_payload: dict) -> list[str]:
    tree=tree_payload.get("tree") if isinstance(tree_payload,dict) else []
    if not isinstance(tree,list): return []
    return sorted({str(entry.get("path") or "") for entry in tree
        if isinstance(entry,dict) and str(entry.get("path") or "").rsplit("/",1)[-1].lower()=="skill.md"})
def classify_skill_type(name: str, description: str, readme: str) -> str|None:
    """Accept projects that contain/install actual Agent Skill files, not merely related tools or tutorials."""
    text=(str(readme or "")+" "+str(description or "")).lower()
    repo=(name or "").lower()
    explicit_paths=(
        "skill.md" in text or ".claude/skills/" in text or ".codex/skills/" in text
        or ".agents/skills/" in text or bool(re.search(r"(?:^|[\s`])skills/[a-z0-9_.-]+",text))
    )
    explicit_install=bool(re.search(r"\b(install|installation|copy|add to)\b",text))
    explicit_skill_phrase=("agent skills" in text or "skill files" in text or "skills directory" in text or "skill folder" in text)
    if explicit_paths:
        return "skill_pack" if ("awesome" in repo or "collection" in repo or "catalog" in repo or "pack" in repo) else "agent_skill_or_pack"
    if explicit_skill_phrase and explicit_install:
        return "skill_pack" if ("awesome" in repo or "collection" in repo or "catalog" in repo or "pack" in repo) else "agent_skill_or_pack"
    return None
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
def enrich_growth_metrics(candidates: list[dict],snapshot_dir: Path,today: str) -> dict:
    """Compare directly observed GitHub Stars with prior daily snapshots; never infer growth from update dates."""
    try:
        current=dt.date.fromisoformat(today)
    except ValueError:
        return {"status":"unavailable","snapshot_file":None,"error":"invalid current date","candidate_count":len(candidates)}
    lower=current-dt.timedelta(days=35)
    snapshots=[]
    errors=[]
    if snapshot_dir.exists():
        for path in sorted(snapshot_dir.glob("*.json")):
            try:
                day=dt.date.fromisoformat(path.stem)
            except ValueError:
                continue
            if not (lower<=day<current):
                continue
            try:
                doc=json.loads(path.read_text(encoding="utf-8"))
                if not isinstance(doc,dict) or not isinstance(doc.get("candidates"),list):
                    raise ValueError("invalid candidate snapshot schema")
                snapshots.append((day,doc["candidates"]))
            except Exception as exc:
                errors.append({"file":path.name,"error":type(exc).__name__})
    # If any relevant historical snapshot is corrupt, do not claim a trustworthy growth comparison.
    by_id:dict[str,list[tuple[dt.date,int]]]={}
    for day,items in snapshots:
        for old in items:
            if not isinstance(old,dict): continue
            cid=str(old.get("canonical_id") or canonical_project_id(str(old.get("url") or old.get("name") or "")))
            try: stars=int(old.get("stars_total"))
            except (TypeError,ValueError): continue
            if cid: by_id.setdefault(cid,[]).append((day,stars))
    for item in candidates:
        cid=canonical_project_id(str(item.get("url") or item.get("name") or ""))
        try: current_stars=max(0,int(item.get("stars") if item.get("stars") is not None else item.get("stars_total") or 0))
        except (TypeError,ValueError): current_stars=0
        item["canonical_id"]=cid
        item["stars_total"]=current_stars
        item["stars_delta_7d"]=None
        item["stars_delta_30d"]=None
        item["growth_baseline_7d_date"]=None
        item["growth_baseline_30d_date"]=None
        item["growth_data_status"]="no historical candidate snapshot in 7-day/30-day comparison windows"
        if errors:
            item["growth_data_status"]="historical candidate snapshot unreadable; growth comparison withheld"
            continue
        history=sorted(by_id.get(cid,[]),key=lambda x:x[0])
        for window,field,date_field,max_lag in ((7,"stars_delta_7d","growth_baseline_7d_date",3),(30,"stars_delta_30d","growth_baseline_30d_date",5)):
            target=current-dt.timedelta(days=window)
            eligible=[(day,stars) for day,stars in history if target-dt.timedelta(days=max_lag)<=day<=target]
            if not eligible: continue
            baseline_day,baseline_stars=max(eligible,key=lambda x:x[0])
            item[field]=current_stars-baseline_stars
            item[date_field]=baseline_day.isoformat()
        if item["stars_delta_7d"] is not None or item["stars_delta_30d"] is not None:
            item["growth_data_status"]="directly observed daily GitHub Stars snapshots; baseline dates recorded"
    snapshot_dir.mkdir(parents=True,exist_ok=True)
    snapshot_file=snapshot_dir/f"{today}.json"
    payload={
        "snapshot_date":today,
        "checked_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "source":"GitHub repository search API",
        "metrics_policy":"Stars are direct observed cumulative counts; deltas are calculated only against dated prior snapshots of the same canonical repository.",
        "candidate_count":len(candidates),
        "candidates":[
            {"canonical_id":canonical_project_id(str(x.get("url") or x.get("name") or "")),
             "name":x.get("name"),"url":x.get("url"),
             "stars_total":int(x.get("stars") if x.get("stars") is not None else x.get("stars_total") or 0),
             "repository_updated_at":x.get("updated"),"created_at":x.get("created_at"),
             "pushed_at":x.get("pushed_at"),"community_signals":x.get("community_signals"),
             "source":"GitHub repository search API","observed_at":dt.datetime.now(dt.timezone.utc).isoformat()}
            for x in candidates
        ],
    }
    # One file per China-local day makes retries idempotent and prevents unbounded duplicate records.
    snapshot_file.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return {"status":"unavailable" if errors else "observed" if snapshots else "baseline_started",
            "snapshot_file":str(snapshot_file),"historical_snapshots_read":len(snapshots),
            "historical_errors":errors,"candidate_count":len(candidates),
            "candidates_with_7d_delta":sum(x.get("stars_delta_7d") is not None for x in candidates),
            "candidates_with_30d_delta":sum(x.get("stars_delta_30d") is not None for x in candidates)}

def _clamp(v: float,lo: float=0,hi: float=100)->float: return max(lo,min(hi,v))
def score_candidate(item: dict, today: str) -> dict:
    stars=max(0,int(item.get("stars") or 0))
    # GitHub search currently gives a cumulative count, not a trustworthy historical delta.
    # Do not infer stars/week from updated_at.
    community=item.get("community_signals") if isinstance(item.get("community_signals"),dict) else {}
    community_count=max(0,int(community.get("count_7d") or 0))
    growth7=item.get("stars_delta_7d")
    try: growth7=int(growth7) if growth7 is not None else None
    except (TypeError,ValueError): growth7=None
    growth_component=(math.log1p(max(0,growth7))/math.log1p(5000)*8) if growth7 is not None else 0
    heat=_clamp(math.log10(stars+1)/5*12 + growth_component + min(5,community_count*1.5),0,25)
    updated=str(item.get("updated") or "")
    age_days=None
    activity_date=str(item.get("pushed_at") or updated)[:10]
    try: age_days=max(0,(dt.date.fromisoformat(today)-dt.date.fromisoformat(activity_date)).days)
    except Exception: pass
    maintenance=10 if age_days is not None and age_days<=30 else 8 if age_days is not None and age_days<=90 else 5 if age_days is not None and age_days<=365 else 2
    text=" ".join(str(item.get(k) or "") for k in ("name","description","topics","daily_theme")).lower()
    trend_terms=("agent","skill","coding","mcp","multimodal","eval","security","browser","workflow","research","data","automation")
    trend=_clamp(6+min(10,sum(1 for x in trend_terms if x in text)*1.25)+min(4,community_count*1.0),0,20)
    usefulness=20 if len(str(item.get("description") or ""))>=120 else 16 if len(str(item.get("description") or ""))>=70 else 8 if item.get("description") else 0
    quality=15 if item.get("license") and item.get("readme_verified",True) and item.get("evidence_verified") else 7 if item.get("license") else 0
    novelty=10 if item.get("novelty_status")=="new" else 4
    total=round(heat+trend+usefulness+quality+novelty+maintenance,1)
    confidence="high" if item.get("evidence_verified") and item.get("license") and item.get("readme_verified",True) and item.get("security_status")=="PASS" else "medium" if item.get("license") and item.get("readme_verified",True) else "low"
    today_text=today
    repo_name=str(item.get("name") or "")
    short_name=repo_name.split("/")[-1] if "/" in repo_name else repo_name
    aliases=list(dict.fromkeys([repo_name,short_name,*[str(x) for x in (item.get("aliases") or [])]]))
    return {**item,"canonical_id":canonical_project_id(str(item.get("url") or item.get("name") or "")),
      "aliases":aliases,"discovered_at":item.get("discovered_at") or today_text,
      "first_recommended_at":item.get("first_recommended_at") or today_text,
      "last_recommended_at":today_text,"last_release_at":item.get("last_release_at"),
      "recommendation_history":item.get("recommendation_history") or [],
      "rejection_reason":item.get("rejection_reason"),"re_recommendation_reason":item.get("re_recommendation_reason"),
      "stars_total":stars,"stars_delta_7d":item.get("stars_delta_7d"),"stars_delta_30d":item.get("stars_delta_30d"),
      "growth_baseline_7d_date":item.get("growth_baseline_7d_date"),"growth_baseline_30d_date":item.get("growth_baseline_30d_date"),
      "growth_component":round(growth_component,2),
      "community_signals":community,"community_count_7d":community_count,
      "community_evidence_urls":community.get("evidence_urls",[]),
      "heat_data_status":"GitHub cumulative Stars plus exact-match Hacker News discussions; Stars growth not available",
      "heat_score":round(heat,1),"trend_score":round(trend,1),"relevance_score":round(trend,1),
      "usefulness_score":round(usefulness,1),"quality_score":round(quality,1),
      "novelty_score":round(novelty,1),"maintenance_score":round(maintenance,1),
      "total_score":total,"age_since_update_days":age_days,
      "growth_data_status":item.get("growth_data_status") or "暂无可靠历史 Stars 快照，未推算近期增长",
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
    selected=[]; excluded=[]; selected_today=[]; category_counts={}; owner_counts={}
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
        if item.get("critical_security_issue") is True or str(item.get("security_status") or "").lower() in {"critical","high_risk","critical_risk"}:
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":"critical_security_risk"})
            continue
        if item.get("quality_status")!="PASS":
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":item.get("quality_status") or "not_verified"})
            continue
        try:
            score=float(item.get("total_score"))
        except (TypeError,ValueError):
            score=0
        if score<60 or score>100:
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":"score_below_60_or_invalid","score":score})
            continue
        # Verified installable Skills do not require an extra rare-value label to be recommended.
        # Diversify by the candidate's actual capability category, not the shared daily theme label.
        category=infer_skill_category(item)
        try:
            owner=urllib.parse.urlsplit(str(item.get("url") or "")).path.strip("/").split("/")[0].lower()
        except Exception:
            owner=""
        if category_counts.get(category,0)>=2:
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":"category_saturation","category":category})
            continue
        if owner and owner_counts.get(owner,0)>=2:
            excluded.append({"name":item.get("name"),"url":item.get("url"),"reason":"developer_saturation","owner":owner})
            continue
        item["daily_theme"]=category
        if hit and material_update:
            item["novelty_status"]="material_update"
        selected.append(item); selected_today.append(item)
        category_counts[category]=category_counts.get(category,0)+1
        if owner: owner_counts[owner]=owner_counts.get(owner,0)+1
        if len(selected)>=limit: break
    return {"status":"PASS" if history["status"] in ("complete","partial") else "history_unavailable",
      "history":{"status":history["status"],"files_read":history["files_read"],"coverage_days":history["coverage_days"],"window_days":90,"window_start":history.get("window_start"),"window_end":history.get("window_end"),"errors":history["errors"],"records":len(history["records"])},
      "selected":selected,"excluded":excluded}
