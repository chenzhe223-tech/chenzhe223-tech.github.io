"""Deterministic DAVYLAB finance editorial PRIORITY, not factual popularity analytics.

Only headline, synopsis, provenance and publication date are inspected. Scores
rank leads for further verification; they do not measure audience engagement,
investment quality, sentiment, accuracy or actual market movements.
"""
from __future__ import annotations
from datetime import datetime, timezone
import re

WEIGHTS = {"timeliness":25, "readability":15, "value":25, "heat":20, "appeal":15}
VERSION = "finance-priority-v1"
CHINA_TERMS = re.compile(
    r"中国|国内|内地|沪深|上海|深圳|北京|香港|港股|A股|人民币|央行|证监会|上交所|深交所|"
    r"中概股|恒生|China\b|Chinese\b|Beijing\b|Shanghai\b|Shenzhen\b|Hong Kong\b|"
    r"Hang Seng\b|yuan\b|renminbi\b", re.I)
IMPACT_TERMS = re.compile(
    r"利率|降息|加息|央行|通胀|货币|汇率|GDP|财报|业绩|营收|净利|利润|增长|就业|"
    r"投资|成本|关税|财政|监管|并购|IPO|上市|回购|信用|负债|债务|出口|进口|"
    r"rate|inflation|GDP|earnings|profit|revenue|growth|jobs|employment|"
    r"tariff|trade|merger|IPO|listing|buyback|policy|regulat|export|import",re.I)
TOPIC_TERMS = re.compile(
    r"科技|人工智能|芯片|新能源|电动车|半导体|地产|房地产|黄金|原油|石油|银行|"
    r"关税|供应链|出口|美联储|央行|中国|港股|A股|AI\b|chip|semiconductor|"
    r"EV\b|oil|gold|bank|housing|property|China|Fed\b|tariff|supply chain",re.I)
ACTION_TERMS = re.compile(
    r"公布|披露|批准|下调|上调|创纪录|突破|收购|裁员|扩张|增持|减持|首次|"
    r"report|announce|approve|cut|raise|record|surge|drop|acquire|launch|"
    r"expand|first|new|highest|lowest",re.I)
NUMBER = re.compile(r"[0-9]+(?:\.[0-9]+)?\s*(?:%|％|亿元|万亿|亿美元|million|billion|trillion|bps|basis points)?", re.I)

def region_for(title, summary, source_region=None):
    if source_region == "中国": return "中国","china_scope_feed"
    if CHINA_TERMS.search(str(title or "")+" "+str(summary or "")[:150]):return "中国","headline_or_abstract_keyword"
    return "全球","source_or_topic_not_china"

def score(article, now=None):
    now=now or datetime.now(timezone.utc)
    if now.tzinfo is None:raise ValueError("now needs timezone")
    published=datetime.fromisoformat(str(article["published_at"]).replace("Z","+00:00"))
    if published.tzinfo is None:raise ValueError("published_at needs timezone")
    age=max(0,(now-published.astimezone(timezone.utc)).total_seconds()/3600)
    freshness=(100 if age<=6 else 94 if age<=12 else 88 if age<=24 else 76 if age<=48
               else 65 if age<=72 else 47 if age<=168 else 24 if age<=336 else 10)
    title=str(article.get("title","")); abstract=str(article.get("summary",""))
    title_n=len(title.strip()); abstract_n=len(abstract.strip())
    readability=min(95,max(18,42+(22 if 12<=title_n<=100 else 8 if title_n<145 else 0)
                       +(20 if 30<=abstract_n<=210 else 7 if abstract_n else 0)
                       +(8 if (("，" in title or ":" in title or "：" in title) and title_n<=100) else 0)
                       -(15 if title_n>130 else 0)))
    text=title+" "+abstract[:180]
    impact=bool(IMPACT_TERMS.search(text)); hot=bool(TOPIC_TERMS.search(text))
    action=bool(ACTION_TERMS.search(title)); quantified=bool(NUMBER.search(title))
    is_official=article.get("source_type")=="official_primary"
    value=min(96,34+(23 if impact else 0)+(16 if quantified else 0)
              +(12 if is_official else 0)+(10 if abstract_n>=35 else 0))
    # Heat is a NON-ENGAGEMENT proxy. It must never be labelled views/shares/trending.
    heat=min(88,24+(26 if hot else 0)+(14 if impact else 0)
              +(10 if age<=24 else 0)+(7 if action else 0))
    appeal=min(92,28+(22 if quantified else 0)+(19 if action else 0)
                +(14 if 12<=title_n<=95 else 0)+(7 if impact else 0))
    dimensions={"timeliness":int(freshness),"readability":int(readability),"value":int(value),
                "heat":int(heat),"appeal":int(appeal)}
    total=round(sum(dimensions[k]*w for k,w in WEIGHTS.items())/100)
    reasons=[("近24小时新线索" if age<=24 else "历史线索，请核对时效"),
             ("涉及财经政策或经营指标" if impact else "一般财经或行业信息"),
             ("标题出现数字，需核实口径" if quantified else "缺少标题数字，不等于缺乏新闻价值")]
    return {**dimensions,"total":total,"basis":"editorial_heuristic_not_audience_metrics",
            "reasons":reasons[:3]}

def sort_and_rank(articles, now=None):
    now=now or datetime.now(timezone.utc)
    rows=[]
    for item in articles:
        copied=dict(item)
        copied["score"]=score(copied,now)
        rows.append(copied)
    rows.sort(key=lambda a:(-a["score"]["total"],-a["score"]["timeliness"],
                            a["published_at"],a["id"]),reverse=False)
    for i,item in enumerate(rows,1):item["priority_rank"]=i
    return rows
