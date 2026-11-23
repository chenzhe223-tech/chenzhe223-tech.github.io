/**
 * DAVYLAB News Engine Public API P0
 *
 * Public, read-only, cacheable API for news already published by AI Radar.
 * Does NOT search the open web, start a crawler, run inference, publish content,
 * or expose unlicensed media. No secrets, bindings, billable AI or cron jobs.
 */
const VERSION = "1.0.0";
const TRUSTED = [
  "https://chenzhe223-tech.github.io/radar/data/latest.json",
  "https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/radar/data/latest.json",
];
const ENGINE = "DAVYLAB News Engine";
const STREAMS = Object.freeze(["top5", "china", "overseas", "more"]);
const MAX_BYTES = 1800000;
const MAX_RECORDS = 250;
const HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "Content-Type, Accept",
  "access-control-max-age": "600",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex",
  "content-type": "application/json; charset=utf-8",
};
const OPENAPI = {
  openapi: "3.0.3",
  info: {title: "DAVYLAB News Engine Read-only API",version: VERSION,
    description: "Search and recommend from the latest already-published AI Radar issue only. All entries require independent fact checking before reuse."},
  paths: {
    "/api/v1/health": {get:{summary:"Upstream status, issue date and provenance"}},
    "/api/v1/news": {get:{summary:"Read issue stories. Query: stream, limit, offset, q, source, region."}},
    "/api/v1/search": {get:{summary:"Search the already-published issue (q required), not the live web."}},
    "/api/v1/topics": {get:{summary:"Deterministic, non-AI topic recommendations from current issue."}},
  },
};
function reply(obj, code = 200, method = "GET") {
  return new Response(method === "HEAD" ? null : JSON.stringify(obj),{
    status:code,
    headers:{...HEADERS,"cache-control":code>=400?"no-store":"public, max-age=60, stale-while-revalidate=120"}
  });
}
function error(code, message, method) {
  return reply({schema_version:VERSION,error:{code,message},publishable:false},code==="invalid_query"?400:code==="method_not_allowed"?405:code==="not_found"?404:503,method);
}
function isHttps(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password &&
      !u.hash && u.hostname !== "localhost" && !u.hostname.endsWith(".local") &&
      !(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname)) &&
      !u.hostname.startsWith("[");
  } catch { return false; }
}
function todayShanghai() {
  return new Intl.DateTimeFormat("en-CA",{
    year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Shanghai"
  }).format(new Date());
}
async function loadReport() {
  let last;
  for(const url of TRUSTED) {
    try {
      const res=await fetch(url,{
        redirect:"follow",
        headers:{"accept":"application/json"},
        cf:{cacheTtl:120,cacheEverything:true},
        signal:AbortSignal.timeout(8500)
      });
      if (!res.ok) throw new Error("origin status "+res.status);
      const length=Number(res.headers.get("content-length")||0);
      if(length>MAX_BYTES) throw new Error("origin exceeds response budget");
      const text=await res.text();
      if(text.length>MAX_BYTES) throw new Error("origin exceeds response budget");
      const d=JSON.parse(text);
      if(!d||typeof d!=="object"||
         !/^\d{4}-\d{2}-\d{2}$/.test(d.report_date||"")||
         !Array.isArray(d.top5)||!Array.isArray(d.news)||
         !Array.isArray(d.china_ai_news)||!Array.isArray(d.xnews_voices)||
         d.top5.length>50||d.news.length>MAX_RECORDS||
         d.china_ai_news.length>MAX_RECORDS||d.xnews_voices.length>100||
         d.quality_gate?.status!=="PASS")
        throw new Error("published Radar data does not meet safe contract");
      return d;
    }catch(e){last=e;}
  }
  throw last||new Error("No published Radar data");
}
function normalize(story, stream, issueDate, i) {
  if(!story||typeof story!=="object") return null;
  const original=String(story.source_url||story.url||"");
  if(!isHttps(original))return null;
  const title=String(story.title_zh||story.title||story.title_en||"").trim().slice(0,280);
  if(!title)return null;
  const summary=String(story.summary_zh||story.summary||story.summary_en||"").trim().slice(0,550);
  const source=String(story.source||"Unknown publisher").trim().slice(0,110);
  const published=String(story.published||"").slice(0,48);
  const rawScore=Number(story.total_score ?? story.research_score ?? 0);
  const score=Number.isFinite(rawScore)?Math.max(0,Math.min(100,rawScore)):0;
  return {
    id:stream+"-"+i+"-"+issueDate,
    issue_date:issueDate,
    stream,
    region:stream==="china"?"china":"global",
    title,
    title_original:String(story.title_en||story.title||title).slice(0,280),
    summary,
    source,
    source_url:original,
    published_at:published,
    relevance_score:score,
    ranking_basis:stream==="overseas"?"news_engine_source_research":stream==="top5"?"radar_editorial_selection":"published_issue",
    verification_status:"requires_independent_fact_check",
    content_rights:"original_link_only",
    publishable:false,
    external_copy_allowed:false
  };
}
function records(d) {
  const all=[];
  const groups=[["top5",d.top5],["china",d.china_ai_news],
                ["overseas",d.xnews_voices.filter(x=>x.source_kind==="news_engine_rss_discovery")],
                ["more",d.news]];
  const seen=new Set();
  for(const [stream,items] of groups) {
    for(let i=0;i<items.length;i++){
      const item=normalize(items[i],stream,d.report_date,i);
      if(!item||seen.has(item.source_url))continue;
      seen.add(item.source_url);
      all.push(item);
    }
  }
  return all;
}
function param(url,name,defaultVal="",maxLength=90) {
  const values=url.searchParams.getAll(name);
  if(values.length>1)throw new Error("duplicated "+name);
  const v=values.length?values[0]:defaultVal;
  if(v.length>maxLength)throw new Error("query too long: "+name);
  return v;
}
function integer(url,name,defaultVal,max) {
  const v=param(url,name,String(defaultVal),5);
  if(!/^\d+$/.test(v))throw new Error("invalid "+name);
  return Math.min(Number(v),max);
}
function filterRows(url,rows,isSearch) {
  const stream=param(url,"stream","all",18);
  if(stream!=="all"&&!STREAMS.includes(stream))throw new Error("invalid stream");
  const region=param(url,"region","all",10);
  if(!["all","china","global"].includes(region))throw new Error("invalid region");
  const source=param(url,"source","",95).toLocaleLowerCase();
  const q=param(url,"q","",100).trim().toLocaleLowerCase();
  if(isSearch && q.length<2)throw new Error("q must be at least two characters");
  const limit=integer(url,"limit",20,50);
  const offset=integer(url,"offset",0,200);
  let filtered=rows.filter(item=>
    (stream==="all"||item.stream===stream)&&
    (region==="all"||item.region===region)&&
    (!source||item.source.toLocaleLowerCase().includes(source))&&
    (!q||[item.title,item.title_original,item.summary,item.source].some(v=>v.toLocaleLowerCase().includes(q)))
  );
  filtered.sort((a,b)=>b.published_at.localeCompare(a.published_at)||b.relevance_score-a.relevance_score);
  return {data:filtered.slice(offset,offset+limit),total:filtered.length,limit,offset,filters:{stream,region,source,q}};
}
function topics(url,rows) {
  const limit=integer(url,"limit",10,30);
  const stream=param(url,"stream","all",18);
  if(stream!=="all"&&!STREAMS.includes(stream))throw new Error("invalid stream");
  const candidates=rows.filter(x=>stream==="all"||stream===x.stream).sort((a,b)=>
    (b.relevance_score+(b.stream==="top5"?20:0))-(a.relevance_score+(a.stream==="top5"?20:0))||
    b.published_at.localeCompare(a.published_at)
  ).slice(0,limit).map(item=>({
    title:item.title,
    source:item.source,
    source_url:item.source_url,
    issue_date:item.issue_date,
    selection_score:Math.min(100,item.relevance_score+(item.stream==="top5"?20:0)),
    score_type:"rule_based_from_published_issue",
    suggested_format:item.stream==="china"?"science_article":item.stream==="overseas"?"news_brief":"explainer",
    verification_status:"requires_independent_fact_check",
    publishable:false
  }));
  return {data:candidates,total:candidates.length,limit,selection_method:"deterministic_no_model"};
}
export default {
  async fetch(request) {
    const method=request.method;
    if(method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
    if(method!=="GET"&&method!=="HEAD")return error("method_not_allowed","Read-only GET/HEAD/OPTIONS API",method);
    const url=new URL(request.url);
    if(url.pathname==="/api/v1/openapi.json")return reply(OPENAPI,200,method);
    if(url.pathname==="/"||url.pathname==="/api/v1")
      return reply({name:ENGINE,version:VERSION,mode:"published_read_only",
        description:"Indexes the latest already published AI Radar edition. No live web search or AI inference.",
        endpoints:Object.keys(OPENAPI.paths).concat("/api/v1/openapi.json"),
        docs:"https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/blob/main/news-engine/NEWS_API.md"},200,method);
    if(!["/api/v1/health","/api/v1/news","/api/v1/search","/api/v1/topics"].includes(url.pathname))
      return error("not_found","Unknown API endpoint",method);
    let d;
    try{d=await loadReport();}catch{
      return error("source_unavailable","No quality-approved source data is currently accessible; original Radar is unaffected",method);
    }
    const base={schema_version:VERSION,engine:ENGINE,source_type:"published_ai_radar_issue",
      issue_date:d.report_date,generated_at:d.generated_at||null,
      is_today:d.report_date===todayShanghai(),publishable:false};
    const all=records(d);
    try {
      if(url.pathname==="/api/v1/health"){
        const live=base.is_today;
        return reply({...base,status:live?"ok":"stale_issue",
          total_records:all.length,source_quality_gate:"PASS",
          upstream:"DAVYLAB AI Radar (published JSON)",model_inference:"disabled",
          latest_only:true,worldwide_search:false,write_endpoints:false},200,method);
      }
      if(url.pathname==="/api/v1/topics")
        return reply({...base,...topics(url,all)},200,method);
      const selection=filterRows(url,all,url.pathname==="/api/v1/search");
      return reply({...base,...selection},200,method);
    }catch(e) {
      return error("invalid_query",String(e.message||"Invalid query").slice(0,110),method);
    }
  }
};
