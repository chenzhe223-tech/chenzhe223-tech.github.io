/**
 * DAVYLAB News Engine P2: read-only, bounded, source-linked historical lookup.
 * The caller supplies P0's approved latest issue loader and record normalizer.
 * NO user URLs, external crawler, billing, persistence, generated news or writes.
 */
export const P2_VERSION="2.0.0";
export const P2_ROUTES=Object.freeze(["/api/v2/history","/api/v2/news","/api/v2/search","/api/v2/topics","/api/v2/openapi.json"]);
export const P2_CATEGORIES=Object.freeze(["agents","models","research","products","business","safety","creative","other"]);
const ORIGINS=Object.freeze([
 "https://chenzhe223-tech.github.io/radar/data/",
 "https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/radar/data/"
]);
const MAX_DAYS=30,MAX_REPORT_BYTES=1800000,MAX_HISTORY_BYTES=120000;
const P2_HEADERS={
 "access-control-allow-origin":"*",
 "access-control-allow-methods":"GET, HEAD, OPTIONS",
 "access-control-allow-headers":"Content-Type, Accept",
 "x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer",
 "x-robots-tag":"noindex",
 "content-type":"application/json; charset=utf-8"
};
export const P2_OPENAPI={
 openapi:"3.0.3",info:{title:"DAVYLAB News Engine P2 Historical Read-only API",version:P2_VERSION,
 description:"Quality-approved already-published AI Radar archives, up to 30 indexed issues; not live internet search, independently verified research or social popularity."},
 paths:{
  "/api/v2/openapi.json":{get:{summary:"Machine-readable P2 contract."}},
  "/api/v2/history":{get:{summary:"List indexed published issue dates; listing does not validate every archive."}},
  "/api/v2/news":{get:{summary:"Cross-issue classified source-linked news; days(1-30), from,to,stream,region,category,source,q,sort,limit,offset."}},
  "/api/v2/search":{get:{summary:"Search up to 30 published issues; requires q with at least 2 characters; same filters as news."}},
  "/api/v2/topics":{get:{summary:"Explainable deterministic editorial candidate scoring, not true social engagement metrics."}}
 }
};
function send(data,status=200,method="GET"){
 return new Response(method==="HEAD"?null:JSON.stringify(data),{
  status,headers:{...P2_HEADERS,"cache-control":status>=400?"no-store":"public, max-age=90, stale-while-revalidate=120"}
 });
}
function bad(code,message,method,status=400){
 return send({schema_version:P2_VERSION,error:{code,message},publishable:false},status,method);
}
function param(url,k,def="",max=100){
 const entries=url.searchParams.getAll(k);
 if(entries.length>1)throw Error("duplicate query parameter: "+k);
 const value=entries.length?entries[0]:def;
 if(value.length>max)throw Error("query parameter too long: "+k);
 return value;
}
function num(url,key,def,max,min=0){
 const str=param(url,key,String(def),5);
 if(!/^\d+$/.test(str))throw Error("invalid "+key);
 const n=Number(str);
 if(n<min)throw Error("invalid "+key);
 return Math.min(n,max);
}
function isDate(x){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x||""))return false;
 return !Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
}
function rangeParams(url){
 const days=num(url,"days",7,MAX_DAYS,1);
 const from=param(url,"from","",10),to=param(url,"to","",10);
 if((from&&!isDate(from))||(to&&!isDate(to))||(from&&to&&from>to))
  throw Error("invalid from/to date range");
 return {days,from,to};
}
function ensureParams(url,route){
 const allowed=new Set(route==="/api/v2/history"?["days","from","to"]:
  ["days","from","to","stream","region","category","source","q","sort","limit","offset"]);
 for(const key of url.searchParams.keys())if(!allowed.has(key))throw Error("unsupported query parameter: "+key);
}
function trustedPath(path){
 return path==="history.json"||/^archive\/\d{4}-\d{2}-\d{2}\.json$/.test(path);
}
async function trustedJson(path,maxBytes=MAX_REPORT_BYTES){
 if(!trustedPath(path))throw Error("untrusted upstream path");
 let lastError;
 for(const base of ORIGINS){
  try{
   const res=await fetch(base+path,{headers:{"accept":"application/json"},
    cf:{cacheEverything:true,cacheTtl:300},signal:AbortSignal.timeout(8500)});
   if(!res.ok)throw Error("origin HTTP "+res.status);
   if(Number(res.headers.get("content-length")||0)>maxBytes)throw Error("archive exceeds byte limit");
   const raw=await res.text();
   if(raw.length>maxBytes)throw Error("archive exceeds byte limit");
   const data=JSON.parse(raw);
   if(!data||typeof data!=="object")throw Error("archive format invalid");
   return data;
  }catch(err){lastError=err}
 }
 throw lastError||Error("trusted published origin unavailable");
}
async function issueHistory(latestDate){
 const h=await trustedJson("history.json",MAX_HISTORY_BYTES);
 if(!Array.isArray(h.days)||h.days.length>400)throw Error("history index invalid");
 const dates=new Set([latestDate]);
 for(const item of h.days){
  const day=String(item||"").replace(/\.json$/,"");
  if(isDate(day)&&day<=latestDate)dates.add(day);
 }
 return [...dates].sort().reverse().slice(0,MAX_DAYS);
}
function officialArchive(report,date){
 return report&&report.report_date===date&&
 report.quality_gate?.status==="PASS"&&
 Array.isArray(report.top5)&&report.top5.length<=50&&
 Array.isArray(report.news)&&report.news.length<=250&&
 Array.isArray(report.china_ai_news)&&report.china_ai_news.length<=250&&
 Array.isArray(report.xnews_voices)&&report.xnews_voices.length<=100;
}
function canonical(original){
 try{
  const url=new URL(original);
  url.hash="";
  for(const key of [...url.searchParams.keys()]){
   if(/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key))url.searchParams.delete(key);
  }
  return url.href.replace(/\/$/,"");
 }catch{return ""}
}
function category(item){
 const v=[item.title,item.title_original,item.summary].join(" ").toLowerCase();
 if(/安全|攻击|隐私|合规|监管|privacy|safety|security|cyber|alignment|governance|red.team/.test(v))return "safety";
 if(/研究|论文|科学|基准|评测|benchmark|research|scientific|paper|arxiv|nature|science journal/.test(v))return "research";
 if(/agent|智能体|自动化|orchestrat|workflow|multi.agent|mcp\b/.test(v))return "agents";
 if(/融资|股价|股票|营收|商业|投资|上市|市场|估值|funding|revenue|market|stock|invest/.test(v))return "business";
 if(/视频|生图|图像|动画|影视|创作|设计|creative|image|video|animation|design/.test(v))return "creative";
 if(/模型|推理|参数|训练|语言模型|gemini|claude|gpt-|llm|reasoning|inference|model/.test(v))return "models";
 if(/产品|应用|工具|开发|发布|coding|code|product|app|tool|software|release/.test(v))return "products";
 return "other";
}
function score(item,keyword,latestDate){
 const age=Math.max(0,Math.round((Date.parse(latestDate+"T00:00:00Z")-Date.parse(item.issue_date+"T00:00:00Z"))/86400000));
 const title=item.title.toLowerCase(),summary=item.summary.toLowerCase(),q=keyword.toLowerCase();
 const timeliness=Math.max(0,30-Math.min(30,age*2));
 const traceability=(item.source_url.startsWith("https://")?10:0)+(item.source&&item.source!=="Unknown publisher"?7:0)+(item.published_at?3:0);
 const actionable=/指南|上线|发布|实践|应用|工具|效率|生产|部署|突破|如何|launch|release|workflow|agent|developer|tool|api|product|use case|study|open.source/i.test(title+" "+summary)?20:8;
 const match=q?(title.includes(q)?20:summary.includes(q)?12:item.title_original.toLowerCase().includes(q)?16:4):10;
 const editorial=Math.max(0,Math.min(10,Math.round(item.relevance_score/10)));
 const parts={timeliness,traceability,practicality:actionable,topic_match:match,editorial_priority:editorial};
 return {total:Object.values(parts).reduce((a,b)=>a+b,0),parts,
  method:"deterministic_rule_v2_not_social_heat",age_days:age};
}
async function loadScope(url,latest,normalizeRecords){
 const scope=rangeParams(url);
 const index=await issueHistory(latest.report_date);
 const days=index.slice(0,scope.days).filter(day=>(!scope.from||day>=scope.from)&&(!scope.to||day<=scope.to));
 const reports=new Array(days.length);
 let cursor=0;
 // Up to 5 parallel official archive requests; no new scheduled jobs, database or KV.
 await Promise.all(Array.from({length:Math.min(5,days.length)},async()=>{
  while(cursor<days.length){
   const i=cursor++,date=days[i];
   try{
    const data=date===latest.report_date?latest:await trustedJson("archive/"+date+".json");
    if(!officialArchive(data,date))throw Error("unapproved archive");
    reports[i]=data;
   }catch{reports[i]=null}
  }
 }));
 const scanned=days.filter((_,i)=>reports[i]!==null);
 const missing=days.filter((_,i)=>reports[i]===null);
 const all=new Map();
 for(let i=0;i<reports.length;i++){
  const d=reports[i];if(!d)continue;
  for(const row of normalizeRecords(d)){
   if(!row||row.publishable!==false||!row.source_url.startsWith("https://"))continue;
   const key=canonical(row.source_url);
   if(!key)continue;
   const prev=all.get(key);
   if(prev){
    if(!prev.issue_dates.includes(d.report_date))prev.issue_dates.push(d.report_date);
    if(d.report_date>prev.latest_seen)prev.latest_seen=d.report_date;
    if(d.report_date<prev.first_seen)prev.first_seen=d.report_date;
   }else{
    all.set(key,{...row,first_seen:d.report_date,latest_seen:d.report_date,issue_dates:[d.report_date]});
   }
  }
 }
 const rows=[...all.values()].map(x=>({...x,issue_count:x.issue_dates.length,
  topic_category:category(x),editorial_score:score(x,"",latest.report_date)}));
 return {rows,scope,index,scanned,missing,selected:days};
}
function filters(url,rows,latestDate,search,topicMode=false){
 const streams=["all","top5","china","overseas","more"];
 const stream=param(url,"stream","all",18),region=param(url,"region","all",10),
  categoryParam=param(url,"category","all",20),
  source=param(url,"source","",95).toLowerCase(),q=param(url,"q","",100).trim().toLowerCase(),
  sort=param(url,"sort",topicMode?"score":search?"relevance":"latest",12);
 if(!streams.includes(stream)||!["all","china","global"].includes(region)||
    !["all",...P2_CATEGORIES].includes(categoryParam)||!["latest","score","relevance"].includes(sort))
  throw Error("unsupported stream / region / category / sort");
 if(search&&q.length<2)throw Error("q must be at least two characters");
 const limit=num(url,"limit",20,50,1),offset=num(url,"offset",0,500);
 const picked=rows.filter(x=>
  (stream==="all"||x.stream===stream)&&
  (region==="all"||x.region===region)&&
  (categoryParam==="all"||x.topic_category===categoryParam)&&
  (!source||x.source.toLowerCase().includes(source))&&
  (!q||[x.title,x.title_original,x.summary,x.source].some(y=>y.toLowerCase().includes(q)))
 ).map(x=>({...x,editorial_score:score(x,q,latestDate)}));
 picked.sort((a,b)=>
  sort==="latest"?(b.latest_seen.localeCompare(a.latest_seen)||b.editorial_score.total-a.editorial_score.total):
  (b.editorial_score.total-a.editorial_score.total||b.latest_seen.localeCompare(a.latest_seen)));
 return {data:picked.slice(offset,offset+limit),total:picked.length,limit,offset,
  filters:{stream,region,category:categoryParam,source,q,sort}};
}
function topics(url,rows,latestDate){
 const selection=filters(url,rows,latestDate,false,true);
 const cards=selection.data.map(x=>({
  id:x.id,title:x.title,source:x.source,source_url:x.source_url,
  first_seen:x.first_seen,latest_seen:x.latest_seen,issue_dates:x.issue_dates,
  topic_category:x.topic_category,stream:x.stream,
  selection_score:x.editorial_score.total,score_breakdown:x.editorial_score.parts,
  score_type:x.editorial_score.method,
  suggested_format:x.topic_category==="research"?"science_article":x.stream==="overseas"?"news_brief":"explainer",
  verification_status:"requires_independent_fact_check",
  publishable:false
 }));
 return {...selection,data:cards,selection_method:"deterministic_editorial_rule_v2_no_model_no_social_metrics"};
}
export async function handleP2(request,{loadLatest,normalizeRecords}){
 const method=request.method,url=new URL(request.url);
 if(!P2_ROUTES.includes(url.pathname))return bad("not_found","Unknown API endpoint",method,404);
 if(url.pathname==="/api/v2/openapi.json"&&(method==="GET"||method==="HEAD"))return send(P2_OPENAPI,200,method);
 if(method!=="GET"&&method!=="HEAD")return bad("method_not_allowed","Only GET / HEAD / OPTIONS",method,405);
 let latest,scope;
 try{
  ensureParams(url,url.pathname);
  scope=rangeParams(url);
  // Reject bad parameters before making network requests.
  if(url.pathname!=="/api/v2/history")filters(url,[],new Date().toISOString().slice(0,10),url.pathname==="/api/v2/search");
  latest=await loadLatest();
  const base={schema_version:P2_VERSION,engine:"DAVYLAB News Engine",
   source_type:"published_ai_radar_archives",latest_issue_date:latest.report_date,
   latest_only:false,worldwide_search:false,model_inference:"disabled",publishable:false};
  if(url.pathname==="/api/v2/history"){
   const index=await issueHistory(latest.report_date);
   const dates=index.slice(0,scope.days).filter(x=>(!scope.from||x>=scope.from)&&(!scope.to||x<=scope.to));
   return send({...base,available_dates:dates,history_window_days:MAX_DAYS,
    indexed_dates:index.length,listed_issues:dates.length,
    note:"Listing only; individual archive quality gates are checked when news or topics are requested."},200,method);
  }
  const archive=await loadScope(url,latest,normalizeRecords);
  const selected=url.pathname==="/api/v2/topics"?
   topics(url,archive.rows,latest.report_date):
   filters(url,archive.rows,latest.report_date,url.pathname==="/api/v2/search");
  const meta={...base,history_window_days:MAX_DAYS,requested_days:scope.days,
   scanned_issues:archive.scanned.length,attempted_issues:archive.selected.length,
   missing_issues:archive.missing,partial:archive.missing.length>0,
   deduplicated_records:archive.rows.length};
  if(!archive.scanned.length)return bad("source_unavailable","No quality-approved historical archive accessible",method,503);
  return send({...meta,...selected},200,method);
 }catch(err){
  const msg=String(err?.message||"Unable to load approved history").slice(0,140);
  const invalid=/query|parameter|invalid|unsupported|duplicate|q must|from\/to/.test(msg);
  return bad(invalid?"invalid_query":"source_unavailable",invalid?msg:"Quality-approved historical source unavailable",method,invalid?400:503);
 }
}
