#!/usr/bin/env python3
"""Run Horizon and enrich the daily report with bilingual explanations."""
from __future__ import annotations
import datetime as dt
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'radar/data/latest.json'
CONFIG=ROOT/'radar/config/horizon.json'
DATA_DIR=ROOT/'radar/horizon-data'
HORIZON_DIR=Path(os.environ.get('HORIZON_DIR','/tmp/Horizon'))
TZ=ZoneInfo('Asia/Shanghai')

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
            print(f'[deepseek-retry] attempt {attempt+1}/3 failed: {type(exc).__name__}')
            if attempt < 2:
                time.sleep(2 ** (attempt+1))
    raise RuntimeError(f'DeepSeek JSON request failed after 3 attempts ({type(last_error).__name__})') from last_error

def ensure_story_fallback(report):
    """Populate source-linked cards without pretending fallback stories are AI-scored."""
    current=report.get('top5')
    if isinstance(current,list) and len(current)>=5:
        return
    cards=list(current) if isinstance(current,list) else []
    seen={x.get('source_url') for x in cards}
    for item in report.get('news',[]):
        url=item.get('url') or item.get('link') or ''
        if not url or url in seen:
            continue
        cards.append({
            'title_zh':item.get('title_zh') or item.get('title') or '',
            'title_en':item.get('title_en') or item.get('title') or '',
            'what_zh':item.get('summary_zh') or item.get('summary') or '',
            'what_en':item.get('summary_en') or item.get('summary') or '',
            'why_zh':item.get('why_it_matters_zh') or '',
            'why_en':item.get('why_it_matters_en') or '',
            'source_url':url,
            'source':item.get('source') or '',
            'published':item.get('published') or '',
            'original_title':item.get('title') or '',
            'fallback':True,
        })
        seen.add(url)
        if len(cards)>=5:
            break
    report['top5']=cards[:5]
    report['top5_status']='ai_curated' if all(not x.get('fallback') for x in cards[:5]) and len(cards)>=5 else ('source_fallback' if cards else 'unavailable')

def localize(report):
    key=os.environ.get('DEEPSEEK_API_KEY')
    if not key:
        report['localization']={'status':'unavailable','message':'DEEPSEEK_API_KEY is not configured.'}
        ensure_story_fallback(report)
        return
    news=report.get('news',[])[:12]; skills=report.get('skills',[])[:6]
    cfg=json.loads(CONFIG.read_text(encoding='utf-8')) if CONFIG.exists() else {}
    model=(cfg.get('ai') or {}).get('model') or 'deepseek-chat'
    payload={
        'news':[{'title':x.get('title',''),'summary':x.get('summary',''),'source':x.get('source',''),'url':x.get('url','')} for x in news],
        'skills':[{'name':x.get('name',''),'description':x.get('description',''),'topics':x.get('topics',[])[:5]} for x in skills]
    }
    translation_prompt=(
        'You are a careful bilingual AI editor. Translate and summarize only what the source supports. '
        'Do not invent facts, metrics, quotes or dates. Keep each field concise (one or two sentences). '
        'Return news array in input order with title_zh, summary_zh, why_it_matters_zh, title_en, summary_en, why_it_matters_en; '
        'and skills array in input order with description_zh and description_en. '
        'Return JSON schema: {"news":[{"title_zh":"","summary_zh":"","why_it_matters_zh":"","title_en":"","summary_en":"","why_it_matters_en":""}],"skills":[{"description_zh":"","description_en":""}]}. Input: '
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
        translated_news=True
    except Exception as exc:
        print(f'[localize-warning] translation {type(exc).__name__}; source text retained.')

    # A separate, compact selection request prevents long translation output from
    # truncating the five-story JSON object. Source indices are validated below.
    selection_payload={'news':[{'index':i,'title':x.get('title',''),'summary':x.get('summary',''),'source':x.get('source',''),'url':x.get('url','')} for i,x in enumerate(news)]}
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
    try:
        selected=_deepseek_json(key,model,selection_prompt,selection_payload,6000)
        top5=[]
        for entry in selected.get('top5',[])[:5]:
            try:
                idx=int(entry.get('source_index',-1))
                if idx<0 or idx>=len(news) or any(x.get('url')==news[idx].get('url') for x in top5): continue
                scores=entry.get('scores') or {}
                normalized={k:max(1,min(10,int(scores.get(k,5)))) for k in ('innovation','practicality','feasibility','impact','opportunity')}
                top5.append({**entry,'source_url':news[idx].get('url',''),'source':news[idx].get('source',''),'published':news[idx].get('published',''),'original_title':news[idx].get('title',''),'scores':normalized,'total_score':sum(normalized.values())})
            except (TypeError,ValueError): continue
        if len(top5) == 5:
            report['top5']=top5
            editorial=selected.get('editorial') or {}
            if editorial: report['editorial']={k:v for k,v in editorial.items() if isinstance(v,str) and v.strip()}
            selection_ok=True
        else:
            report.pop('top5',None)
            print(f'[localize-warning] selection returned {len(top5)} valid source-backed stories; exactly five required.')
    except Exception as exc:
        report.pop('top5',None)
        print(f'[localize-warning] selection {type(exc).__name__}; UI will show source-backed fallback stories.')

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
            if result.returncode!=0: report['ai_analysis']={'status':'unavailable','message':'AI 分析本次未完成，基础新闻与 Skill 榜单仍正常展示。'}
            elif not summary_path.exists(): report['ai_analysis']={'status':'empty','message':'Horizon 本次没有生成可发布的中文摘要；基础日报已保留。'}
            else:
                summary=summary_path.read_text(encoding='utf-8').strip()
                report['ai_analysis']={'status':'ok','provider':'DeepSeek via Horizon','generated_at':dt.datetime.now(TZ).isoformat(),'summary_markdown':summary[:30000],'summary_markdown_en':summary_en_path.read_text(encoding='utf-8').strip()[:30000] if summary_en_path.exists() else '','summary_source':'Horizon daily digest; source URLs are included where available.'}
        except subprocess.TimeoutExpired: report['ai_analysis']={'status':'unavailable','message':'AI 分析运行超时，基础新闻与 Skill 榜单已保留。'}
        except Exception as exc: report['ai_analysis']={'status':'unavailable','message':'AI 分析暂时不可用，基础新闻与 Skill 榜单已保留。'}; print(f'[horizon-warning] {type(exc).__name__}')
    localize(report)
    ensure_story_fallback(report)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 0
if __name__=='__main__': raise SystemExit(main())
