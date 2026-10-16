#!/usr/bin/env python3
"""Run Horizon and enrich the daily report with bilingual explanations."""
from __future__ import annotations
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'radar/data/latest.json'
CONFIG=ROOT/'radar/config/horizon.json'
DATA_DIR=ROOT/'radar/horizon-data'
HORIZON_DIR=Path(os.environ.get('HORIZON_DIR','/tmp/Horizon'))
TZ=ZoneInfo('Asia/Shanghai')

def localize(report):
    key=os.environ.get('DEEPSEEK_API_KEY')
    if not key:return
    news=report.get('news',[])[:20]; skills=report.get('skills',[])[:10]
    payload={'news':[{'title':x.get('title',''),'summary':x.get('summary',''),'source':x.get('source',''),'url':x.get('url','')} for x in news], 'skills':[{'name':x.get('name',''),'description':x.get('description',''),'topics':x.get('topics',[])[:8]} for x in skills]}
    prompt=('You are a careful bilingual AI editor for ordinary creators. Do not invent facts or exaggerate. Preserve array order. Return valid JSON with: news items containing title_zh, summary_zh, why_it_matters_zh, title_en, summary_en, why_it_matters_en; skills items containing description_zh and description_en; and top5 containing exactly five selected news items by importance and actionable relevance. Each top5 item must include source_index (zero-based index into the input news array), title_zh, title_en, category_zh, category_en, what_zh, what_en, why_zh, why_en, action_zh, action_en, audience_zh, audience_en, scores (five 1-10 integer scores: innovation, practicality, feasibility, impact, opportunity), score_reason_zh, score_reason_en, and confidence (high/medium/low). Score the same five dimensions for every story: innovation, practicality, feasibility, impact, opportunity. Rank based on evidence, relevance to AI builders and creators, and whether the opportunity can realistically be acted on; avoid hype. Action must be a concrete next step, not generic advice. Exactly five different source indices when at least five news items exist. If fewer than five, return only available distinct items. Schema: {"news":[{"title_zh":"","summary_zh":"","why_it_matters_zh":"","title_en":"","summary_en":"","why_it_matters_en":""}],"skills":[{"description_zh":"","description_en":""}],"top5":[{"source_index":0,"title_zh":"","title_en":"","category_zh":"","category_en":"","what_zh":"","what_en":"","why_zh":"","why_en":"","action_zh":"","action_en":"","audience_zh":"","audience_en":"","scores":{"innovation":7,"practicality":7,"feasibility":7,"impact":7,"opportunity":7},"score_reason_zh":"","score_reason_en":"","confidence":"medium"}]}. Input: ')
    try:
        cfg=json.loads(CONFIG.read_text(encoding='utf-8')) if CONFIG.exists() else {}
        model=(cfg.get('ai') or {}).get('model') or 'deepseek-chat'
        body=json.dumps({'model':model,'temperature':0.2,'max_tokens':8000,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':'Return only valid JSON. Be accurate, restrained, and source-faithful.'},{'role':'user','content':prompt+json.dumps(payload,ensure_ascii=False)}]},ensure_ascii=False).encode()
        req=urllib.request.Request('https://api.deepseek.com/chat/completions',data=body,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
        with urllib.request.urlopen(req,timeout=100) as response: result=json.loads(response.read().decode())
        localized=json.loads(result['choices'][0]['message']['content'])
        for item,trans in zip(news,localized.get('news',[])):
            for field in ('title_zh','summary_zh','why_it_matters_zh','title_en','summary_en','why_it_matters_en'):
                if isinstance(trans.get(field),str) and trans[field].strip():item[field]=trans[field].strip()
        for item,trans in zip(skills,localized.get('skills',[])):
            for field in ('description_zh','description_en'):
                if isinstance(trans.get(field),str) and trans[field].strip():item[field]=trans[field].strip()
        top5=[]
        for entry in localized.get('top5',[])[:5]:
            try:
                idx=int(entry.get('source_index',-1))
                if idx<0 or idx>=len(news) or any(x.get('url')==news[idx].get('url') for x in top5): continue
                scores=entry.get('scores') or {}
                normalized={k:max(1,min(10,int(scores.get(k,5)))) for k in ('innovation','practicality','feasibility','impact','opportunity')}
                top5.append({**entry,'source_url':news[idx].get('url',''),'source':news[idx].get('source',''),'original_title':news[idx].get('title',''),'scores':normalized,'total_score':sum(normalized.values())})
            except (TypeError,ValueError): continue
        report['top5']=top5
        report['localization']={'status':'ok','languages':['zh','en'],'translated_news':sum(bool(x.get('title_zh') and x.get('summary_zh')) for x in news),'translated_skills':sum(bool(x.get('description_zh')) for x in skills),'provider':'DeepSeek'}
        print('[localize] Bilingual explanations added.')
    except Exception as exc:
        report['localization']={'status':'fallback','languages':['source'],'message':'Localization unavailable; original source text retained.'}
        print(f'[localize-warning] {type(exc).__name__}; original source text retained.')

def main():
    report=json.loads(REPORT.read_text(encoding='utf-8'))
    if not os.environ.get('DEEPSEEK_API_KEY'):
        report['ai_analysis']={'status':'unavailable','message':'未检测到 DEEPSEEK_API_KEY；基础新闻与 Skill 榜单仍可正常更新。'}
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
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 0
if __name__=='__main__': raise SystemExit(main())
