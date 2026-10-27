#!/usr/bin/env python3
"""Run Horizon and enrich the daily report with bilingual explanations."""
from __future__ import annotations
import datetime as dt
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'radar/data/latest.json'
CONFIG=ROOT/'radar/config/horizon.json'
DATA_DIR=ROOT/'radar/horizon-data'
HORIZON_DIR=Path(os.environ.get('HORIZON_DIR','/tmp/Horizon'))
TZ=ZoneInfo('Asia/Shanghai')
try:
    from radar.scripts.build_daily import _duplicate_match, _story_url_key, filter_historical_duplicates
except ModuleNotFoundError:
    from build_daily import _duplicate_match, _story_url_key, filter_historical_duplicates

CHINA_NEWS_PUBLIC_TARGET = 8

def remove_top5_duplicates_from_china(report: dict) -> dict:
    """Keep the China AI module distinct from the five editorial highlights.

    Build_daily intentionally collects up to ten candidates as a buffer; after
    removing cross-section duplicates, publish at most eight China AI stories.
    """
    top5 = report.get("top5") if isinstance(report.get("top5"), list) else []
    china = report.get("china_ai_news") if isinstance(report.get("china_ai_news"), list) else []
    today = str(report.get("report_date") or dt.datetime.now(TZ).date().isoformat())
    history = []
    for card in top5:
        if not isinstance(card, dict):
            continue
        history.append({
            "title": card.get("original_title") or card.get("title_en") or card.get("title_zh") or "",
            "title_zh": card.get("title_zh") or "",
            "title_en": card.get("title_en") or "",
            "original_title": card.get("original_title") or "",
            "url": card.get("source_url") or "",
            "_history_date": today,
        })
    kept, removed = [], []
    for story in china:
        if not isinstance(story, dict):
            continue
        match = _duplicate_match(story, history, current_date=today) if history else None
        if match:
            removed.append({
                "title": story.get("title_zh") or story.get("title") or "",
                "url": story.get("url") or "",
                "matched_title": match.get("title"),
                "matched_url": match.get("url"),
                "kind": match.get("kind"),
            })
        else:
            kept.append(story)
    report["china_ai_news"] = kept[:CHINA_NEWS_PUBLIC_TARGET]
    if removed:
        report["cross_section_dedupe"] = {
            "status": "ok" if len(report["china_ai_news"]) >= 6 else "insufficient_unique_china_stories",
            "removed_from_china_ai_news": len(removed),
            "remaining_china_ai_news": len(report["china_ai_news"]),
            "removed": removed,
        }
        print(f"[cross-section-dedupe] removed={len(removed)} overlapping China AI story/stories; remaining={len(report['china_ai_news'])}")
    return report

def _safe_error_detail(exc: Exception) -> str:
    """Return actionable provider diagnostics without exposing credentials."""
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body=exc.read().decode('utf-8','replace')
        except Exception:
            body=''
        body=re.sub(r'(?i)(authorization|api[_-]?key|token)(\s*[:=]\s*)[^,\s}]+',r'\1\2[REDACTED]',body)
        body=re.sub(r'''(?i)Bearer\s+[^\s"']+''', 'Bearer [REDACTED]', body)
        return f'HTTP {exc.code}: {body[:280]}'
    if isinstance(exc, urllib.error.URLError):
        return f'network error: {str(exc.reason)[:180]}'
    return f'{type(exc).__name__}: {str(exc)[:220]}'

def _deepseek_json(key: str, model: str, prompt: str, payload: dict, max_tokens: int = 6000) -> dict:
    body=json.dumps({
        'model':model,'temperature':0.2,'max_tokens':max_tokens,
        'response_format':{'type':'json_object'},
        'thinking':{'type':'disabled'},
        'messages':[
            {'role':'system','content':'Return only valid JSON. Be accurate, restrained, and source-faithful. Never invent facts.'},
            {'role':'user','content':prompt+json.dumps(payload,ensure_ascii=False)}
        ]
    },ensure_ascii=False).encode()
    req=urllib.request.Request(
        'https://api.deepseek.com/chat/completions',data=body,
        headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST'
    )
    last_error=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=60) as response:
                result=json.loads(response.read().decode())
            choices=result.get('choices') or []
            content=(choices[0].get('message') or {}).get('content') if choices else None
            if not isinstance(content,str) or not content.strip():
                raise ValueError('DeepSeek returned empty JSON content')
            try:
                parsed=json.loads(content)
            except json.JSONDecodeError:
                # Recover valid JSON when a provider wraps the object in prose/fences.
                left=content.find('{'); right=content.rfind('}')
                if left >= 0 and right > left:
                    parsed=json.loads(content[left:right+1])
                else:
                    raise
            if not isinstance(parsed,dict):
                raise ValueError('DeepSeek JSON response was not an object')
            return parsed
        except Exception as exc:
            last_error=exc
            print(f'[deepseek-retry] attempt {attempt+1}/3 failed: {_safe_error_detail(exc)}')
            if attempt < 2:
                time.sleep(2 ** (attempt+1))
    raise RuntimeError(f'DeepSeek JSON request failed after 3 attempts ({type(last_error).__name__})') from last_error

def build_selection_pool(global_news, china_news):
    """Combine source-backed global and China AI items for the five-story editorial selection."""
    pool=[]
    seen_urls=set()
    for section,items in (("global_news",global_news),("china_ai_news",china_news)):
        for item in items if isinstance(items,list) else []:
            if not isinstance(item,dict):
                continue
            url=str(item.get("url") or item.get("link") or "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            pool.append({**item,"selection_section":section})
    return pool

def ensure_story_fallback(report):
    """Keep every editorial highlight tied to a canonical URL in the verified source pool."""
    news = report.get("news") if isinstance(report.get("news"), list) else []
    china = report.get("china_ai_news") if isinstance(report.get("china_ai_news"), list) else []
    candidates = [item for item in news + china if isinstance(item, dict)]

    by_key = {}
    for item in candidates:
        raw_url = str(item.get("url") or item.get("link") or item.get("source_url") or "").strip()
        if not raw_url.startswith("https://"):
            continue
        key = _story_url_key({"url": raw_url})
        if key:
            by_key.setdefault(key, item)

    current = report.get("top5") if isinstance(report.get("top5"), list) else []
    cards = []
    seen = set()
    dropped_unbacked = 0
    for card in current:
        if not isinstance(card, dict):
            continue
        raw_url = str(card.get("source_url") or card.get("url") or "").strip()
        key = _story_url_key({"url": raw_url})
        source_item = by_key.get(key)
        if not source_item:
            dropped_unbacked += 1
            continue
        if key in seen:
            continue
        canonical_url = str(source_item.get("url") or source_item.get("link") or source_item.get("source_url") or "").strip()
        if not canonical_url.startswith("https://"):
            dropped_unbacked += 1
            continue

        merged = dict(source_item)
        merged.update(card)
        # Canonical source metadata always wins over a model-supplied URL/source label.
        merged["source_url"] = canonical_url
        merged["source"] = source_item.get("source") or card.get("source") or ""
        merged["published"] = source_item.get("published") or card.get("published") or ""
        merged["title_zh"] = card.get("title_zh") or source_item.get("title_zh") or source_item.get("title") or source_item.get("original_title") or ""
        merged["title_en"] = card.get("title_en") or source_item.get("title_en") or source_item.get("title") or ""
        merged["what_zh"] = card.get("what_zh") or card.get("summary_zh") or source_item.get("what_zh") or source_item.get("summary_zh") or source_item.get("summary") or ""
        merged["what_en"] = card.get("what_en") or card.get("summary_en") or source_item.get("what_en") or source_item.get("summary_en") or source_item.get("summary") or ""
        merged["why_zh"] = card.get("why_zh") or source_item.get("why_zh") or source_item.get("why_it_matters_zh") or ""
        merged["why_en"] = card.get("why_en") or source_item.get("why_en") or source_item.get("why_it_matters_en") or ""
        cards.append(merged)
        seen.add(key)

    # If an AI-selected card is not source-backed, refill only from the verified pool.
    for item in candidates:
        if len(cards) >= 5:
            break
        raw_url = str(item.get("url") or item.get("link") or item.get("source_url") or "").strip()
        if not raw_url.startswith("https://"):
            continue
        key = _story_url_key({"url": raw_url})
        if not key or key in seen:
            continue
        cards.append({
            "title_zh": item.get("title_zh") or item.get("title") or item.get("original_title") or "",
            "title_en": item.get("title_en") or item.get("title") or "",
            "what_zh": item.get("what_zh") or item.get("summary_zh") or item.get("summary") or "",
            "what_en": item.get("what_en") or item.get("summary_en") or item.get("summary") or "",
            "why_zh": item.get("why_zh") or item.get("why_it_matters_zh") or "",
            "why_en": item.get("why_en") or item.get("why_it_matters_en") or "",
            "source_url": raw_url,
            "source": item.get("source") or "",
            "published": item.get("published") or "",
            "original_title": item.get("original_title") or item.get("title") or "",
            "fallback": True,
        })
        seen.add(key)

    report["top5"] = cards[:5]
    if dropped_unbacked:
        print(f"[source-backed-top5] dropped={dropped_unbacked} unverified AI-selected URL(s); refilled from verified candidates.")
    if len(report["top5"]) >= 5:
        report["top5_status"] = "source_fallback" if any(item.get("fallback") for item in report["top5"]) else "ai_curated"
    else:
        report["top5_status"] = "source_fallback" if report["top5"] else "unavailable"
        if isinstance(report.get("localization"), dict):
            report["localization"]["status"] = "partial"

def localize(report):
    key=os.environ.get('DEEPSEEK_API_KEY')
    if not key:
        report['localization']={'status':'unavailable','message':'DEEPSEEK_API_KEY is not configured.'}
        ensure_story_fallback(report)
        return
    news=report.get('news',[])[:12]; skills=report.get('skills',[])[:6]; china_news=report.get('china_ai_news',[])[:10]
    cfg=json.loads(CONFIG.read_text(encoding='utf-8')) if CONFIG.exists() else {}
    model=(cfg.get('ai') or {}).get('model') or 'deepseek-chat'
    payload={
        'news':[{'title':x.get('title',''),'summary':x.get('summary',''),'source':x.get('source',''),'url':x.get('url','')} for x in news],
        'skills':[{'name':x.get('name',''),'description':x.get('description',''),'topics':x.get('topics',[])[:5]} for x in skills],
        'china_ai_news':[{'title':x.get('title',''),'summary':x.get('summary',''),'source':x.get('source',''),'url':x.get('url','')} for x in china_news]
    }
    translation_prompt=(
        'You are a careful bilingual AI editor. Translate and summarize only what the source supports. '
        'Do not invent facts, metrics, quotes or dates. Keep each field concise (one or two sentences). '
        'Return news array in input order with title_zh, summary_zh, why_it_matters_zh, title_en, summary_en, why_it_matters_en; '
        'and skills array in input order with description_zh and description_en. '
        'Also translate every china_ai_news item in input order into title_zh, summary_zh, title_en, summary_en. Chinese titles and summaries are required for Chinese-language display; never copy an English headline into title_zh. '
        'Return JSON schema: {"news":[{"title_zh":"","summary_zh":"","why_it_matters_zh":"","title_en":"","summary_en":"","why_it_matters_en":""}],"skills":[{"description_zh":"","description_en":""}],"china_ai_news":[{"title_zh":"","summary_zh":"","title_en":"","summary_en":""}]}. Input: '
    )
    translated_news=False
    try:
        translated=_deepseek_json(key,model,translation_prompt,payload,6000)
        for item,trans in zip(news,translated.get('news',[])):
            for field in ('title_zh','summary_zh','why_it_matters_zh','title_en','summary_en','why_it_matters_en'):
                if isinstance(trans.get(field),str) and trans[field].strip(): item[field]=trans[field].strip()
        for item,trans in zip(skills,translated.get('skills',[])):
            for field in ('description_zh','description_en'):
                if isinstance(trans.get(field),str) and trans[field].strip(): item[field]=trans[field].strip()
        for item,trans in zip(china_news,translated.get('china_ai_news',[])):
            for field in ('title_zh','summary_zh','title_en','summary_en'):
                if isinstance(trans.get(field),str) and trans[field].strip(): item[field]=trans[field].strip()
        translated_news=True
    except Exception as exc:
        print(f'[localize-warning] translation {type(exc).__name__}; source text retained.')

    # A separate, compact selection request prevents long translation output from
    # truncating the five-story JSON object. Source indices are validated below.
    selection_news=build_selection_pool(news,china_news)
    selection_payload={'news':[{
        'index':i,
        'section':x.get('selection_section','global_news'),
        'title':x.get('title') or x.get('title_zh',''),
        'title_zh':x.get('title_zh',''),
        'summary':x.get('summary') or x.get('summary_zh',''),
        'summary_zh':x.get('summary_zh',''),
        'why_it_matters_zh':x.get('why_it_matters_zh',''),
        'source':x.get('source',''),
        'url':x.get('url') or x.get('link',''),
        'published':x.get('published','')
    } for i,x in enumerate(selection_news)]}
    selection_prompt=(
        'Act as a restrained AI-news editor for ordinary users, builders and creators. Select up to five distinct real stories from the supplied list. '
        'If at least five sources exist, return exactly five, prioritizing recency, evidence and usefulness. Use these category labels in order where evidence supports them: '
        '技术突破/Technical Breakthrough, 产品应用/Product & Application, 行业影响/Industry Impact, 商业动态/Business & Market, 值得关注/Signals to Watch. '
        'Do not invent events, statistics, quotes or facts. Each story must cite its exact source_index from input and include concise Chinese and English text: '
        'title_zh,title_en,category_zh,category_en,what_zh,what_en,why_zh,why_en,editor_judgment_zh,editor_judgment_en,opportunity_risk_zh,opportunity_risk_en,action_zh,action_en,'
        'scores with integer 1-10 values for innovation, practicality, feasibility, impact, opportunity, and confidence high/medium/low. '
        'Use a concrete action only when grounded; otherwise say to read/verify the source. Also return editorial with core_zh,core_en,trend_zh,trend_en,next_question_zh,next_question_en. '
        'Keep each story field concise. Return JSON only, schema: {"top5":[{"source_index":0,"title_zh":"","title_en":"","category_zh":"","category_en":"","what_zh":"","what_en":"","why_zh":"","why_en":"","editor_judgment_zh":"","editor_judgment_en":"","opportunity_risk_zh":"","opportunity_risk_en":"","action_zh":"","action_en":"","scores":{"innovation":7,"practicality":7,"feasibility":7,"impact":7,"opportunity":7},"confidence":"medium"}],"editorial":{"core_zh":"","core_en":"","trend_zh":"","trend_en":"","next_question_zh":"","next_question_en":""}}. Input: '
    )
    selection_ok=False
    last_selection_count=0
    for selection_attempt in range(3):
        try:
            retry_prompt=selection_prompt
            if selection_attempt:
                retry_prompt += (
                    ' IMPORTANT RETRY: Your previous output did not contain exactly five valid distinct source-backed stories. '
                    'Return exactly five objects, source_index must be an integer within the supplied input list matching the input, '
                    'keep every text field to one concise sentence, and do not omit any required field. Input: '
                )
            selected=_deepseek_json(key,model,retry_prompt,selection_payload,10000)
            top5=[]
            for entry in selected.get('top5',[])[:5]:
                try:
                    idx=int(entry.get('source_index',-1))
                    if idx<0 or idx>=len(selection_news) or any(x.get('source_url')==selection_news[idx].get('url') for x in top5): continue
                    scores=entry.get('scores') or {}
                    normalized={k:max(1,min(10,int(scores.get(k,5)))) for k in ('innovation','practicality','feasibility','impact','opportunity')}
                    top5.append({**entry,'source_url':selection_news[idx].get('url') or selection_news[idx].get('link',''),'source':selection_news[idx].get('source',''),'published':selection_news[idx].get('published',''),'original_title':selection_news[idx].get('title') or selection_news[idx].get('title_zh',''),'source_section':selection_news[idx].get('selection_section','global_news'),'scores':normalized,'total_score':sum(normalized.values())})
                except (TypeError,ValueError): continue
            last_selection_count=len(top5)
            if len(top5)==5:
                report['top5']=top5
                editorial=selected.get('editorial') or {}
                if editorial: report['editorial']={k:v for k,v in editorial.items() if isinstance(v,str) and v.strip()}
                selection_ok=True
                break
            print(f'[localize-warning] selection attempt {selection_attempt+1}/3 returned {len(top5)} valid source-backed stories; exactly five required.')
        except Exception as exc:
            print(f'[localize-warning] selection attempt {selection_attempt+1}/3 failed: {type(exc).__name__}.')
    if not selection_ok:
        report.pop('top5',None)
        print(f'[localize-warning] no complete five-story AI selection after 3 attempts; last valid count={last_selection_count}.')
    report['localization']={
        'status':'ok' if translated_news and selection_ok else 'partial',
        'languages':['zh','en'] if translated_news else ['source'],
        'translated_news':sum(bool(x.get('title_zh') and x.get('summary_zh')) for x in news),
        'translated_skills':sum(bool(x.get('description_zh')) for x in skills),
        'top5_count':len(report.get('top5',[])),
        'provider':'DeepSeek'
    }

def main():
    report=json.loads(REPORT.read_text(encoding='utf-8'))
    if not os.environ.get('DEEPSEEK_API_KEY'):
        report['ai_analysis']={'status':'unavailable','message':'未检测到 DEEPSEEK_API_KEY；基础新闻与 Skill 榜单仍可正常更新。'}
        ensure_story_fallback(report)
        remove_top5_duplicates_from_china(report)
        REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); return 0
    if not (HORIZON_DIR/'src'/'main.py').exists():
        report['ai_analysis']={'status':'unavailable','message':'Horizon 运行目录未就绪；基础日报已保留。'}
    else:
        today=dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d')
        summary_path=DATA_DIR/'summaries'/f'horizon-{today}-zh.md'
        summary_en_path=DATA_DIR/'summaries'/f'horizon-{today}-en.md'
        try:
            DATA_DIR.mkdir(parents=True,exist_ok=True)
            cmd=[sys.executable,'-m','src.main','--config',str(CONFIG),'--data-dir',str(DATA_DIR),'--hours','24','--log-level','WARNING']
            result=subprocess.run(cmd,cwd=HORIZON_DIR,check=False,timeout=480,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
            if result.returncode!=0:
                tail='\n'.join((result.stdout or '').splitlines()[-35:])
                tail=re.sub(r'''(?i)Bearer\s+[^\s"']+''', 'Bearer [REDACTED]', tail)
                tail=re.sub(r'(?i)(DEEPSEEK_API_KEY|api[_-]?key)(\s*[:=]\s*)[^\s]+',r'\1\2[REDACTED]',tail)
                print(f'[horizon-error] exit_code={result.returncode}; last_output_begin')
                print(tail[:6000])
                print('[horizon-error] last_output_end')
                report['ai_analysis']={'status':'unavailable','message':'Horizon 分析失败；已记录脱敏后的运行日志，基础新闻仍可发布。'}
            elif not summary_path.exists():
                print(f'[horizon-warning] process returned 0 but expected summary is missing: {summary_path}')
                report['ai_analysis']={'status':'empty','message':'Horizon 本次没有生成可发布的中文摘要；基础日报已保留。'}
            else:
                summary=summary_path.read_text(encoding='utf-8').strip()
                report['ai_analysis']={'status':'ok','provider':'DeepSeek via Horizon','generated_at':dt.datetime.now(TZ).isoformat(),'summary_markdown':summary[:30000],'summary_markdown_en':summary_en_path.read_text(encoding='utf-8').strip()[:30000] if summary_en_path.exists() else '','summary_source':'Horizon daily digest; source URLs are included where available.'}
        except subprocess.TimeoutExpired: report['ai_analysis']={'status':'unavailable','message':'AI 分析运行超时，基础新闻与 Skill 榜单已保留。'}
        except Exception as exc: report['ai_analysis']={'status':'unavailable','message':'AI 分析暂时不可用，基础新闻与 Skill 榜单已保留。'}; print(f'[horizon-warning] {type(exc).__name__}')
    localize(report)
    ensure_story_fallback(report)
    # Final post-AI guard: localization can make a previously missed event match
    # historical Chinese headlines. Remove it before poster generation and refill
    # only from the already history-filtered source-backed news pool.
    today_local=dt.datetime.now(TZ).date().isoformat()
    for _ in range(3):
        current=report.get('top5') if isinstance(report.get('top5'),list) else []
        safe=filter_historical_duplicates(current,'top5',today_local)
        if len(safe)==len(current):
            break
        removed_urls={str(x.get('source_url') or '') for x in current if x not in safe}
        report['top5']=safe
        report['news']=[x for x in report.get('news',[]) if str(x.get('url') or x.get('link') or '') not in removed_urls]
        ensure_story_fallback(report)
        print(f'[skill-history-guard] removed={len(current)-len(safe)} historical duplicate from AI-selected top5; refilled from verified news candidates.')
    final_top5=report.get('top5') if isinstance(report.get('top5'),list) else []
    final_safe=filter_historical_duplicates(final_top5,'top5',today_local)
    if len(final_safe)!=len(final_top5):
        report['top5']=final_safe
        report['top5_status']='unavailable'
        print('[skill-history-guard] unable to replace all duplicate top5 stories; release gate will block publication.')
    if len(report.get('top5') or [])<5:
        report['top5_status']='unavailable'
        if isinstance(report.get('localization'),dict): report['localization']['status']='partial'
    remove_top5_duplicates_from_china(report)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 0
if __name__=='__main__': raise SystemExit(main())
