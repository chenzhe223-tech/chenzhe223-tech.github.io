/* P2 offline acceptance tests: only official published fixture data, no network. */
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
(async()=>{
 const root=path.resolve("news-engine/public-api-worker.mjs");
 const worker=(await import(pathToFileURL(root).href)).default;
 const latest=JSON.parse(fs.readFileSync("radar/data/latest.json","utf8"));
 const prior=JSON.parse(fs.readFileSync("radar/data/archive/2026-11-22.json","utf8"));
 const index=JSON.parse(fs.readFileSync("radar/data/history.json","utf8"));
 assert.equal(latest.quality_gate.status,"PASS");
 assert.equal(prior.quality_gate.status,"PASS");
 assert.ok(index.days.includes("2026-11-22.json"));
 const storedFetch=globalThis.fetch;
 let called=[];
 const valid=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
 const mocked=async url=>{
  const v=String(url);called.push(v);
  assert.ok(/^(https:\/\/chenzhe223-tech\.github\.io\/radar\/data\/|https:\/\/raw\.githubusercontent\.com\/chenzhe223-tech\/chenzhe223-tech\.github\.io\/main\/radar\/data\/)/.test(v),
   "Only allowlisted published source origins may be requested");
  if(v.endsWith("latest.json"))return valid(latest);
  if(v.endsWith("history.json"))return valid(index);
  if(v.endsWith("archive/2026-11-22.json"))return valid(prior);
  return new Response("not found",{status:404});
 };
 async function probe(url,method="GET"){
  const resp=await worker.fetch(new Request("https://davylab-news-api.invalid"+url,{method}));
  return {status:resp.status,headers:resp.headers,data:method==="HEAD"?null:await resp.json()};
 }
 try{
  globalThis.fetch=mocked;
  let r=await probe("/api/v2/history?days=14");
  assert.equal(r.status,200);
  assert.equal(r.data.available_dates[0],latest.report_date);
  assert.ok(r.data.available_dates.includes(prior.report_date));
  assert.ok(r.data.available_dates.length<=14);
  assert.equal(r.data.latest_only,false);
  r=await probe("/api/v2/news?days=2&limit=50&sort=score");
  assert.equal(r.status,200);
  assert.equal(r.data.schema_version,"2.0.0");
  assert.equal(r.data.scanned_issues,2);
  assert.equal(r.data.partial,false);
  assert.ok(r.data.deduplicated_records>=20);
  assert.ok(r.data.total>0);
  assert.ok(r.data.data.every(x=>x.publishable===false&&x.verification_status==="requires_independent_fact_check"));
  assert.ok(r.data.data.every(x=>!("body" in x)&&!("image_url" in x)&&Array.isArray(x.issue_dates)));
  assert.ok(r.data.data.every(x=>x.editorial_score.method.includes("not_social_heat")&&x.editorial_score.total<=100));
  assert.ok(r.data.data.every(x=>Number.isInteger(x.issue_count)&&x.issue_count>=1));
  for(let i=1;i<r.data.data.length;i++)assert.ok(r.data.data[i-1].editorial_score.total>=r.data.data[i].editorial_score.total);
  r=await probe("/api/v2/news?days=2&stream=china&region=china&limit=3&category=all");
  assert.equal(r.status,200);
  assert.ok(r.data.data.every(x=>x.stream==="china"&&x.region==="china"));
  const sample=prior.top5[0].title_zh||prior.top5[0].title;
  const needle=(sample.match(/[A-Za-z]{4,}/)||[])[0]||"OpenAI";
  r=await probe("/api/v2/search?days=2&q="+encodeURIComponent(needle)+"&limit=10");
  assert.equal(r.status,200);
  assert.ok(r.data.total>=1,"Historic match must be searchable");
  assert.ok(r.data.data.some(x=>x.title.toLowerCase().includes(needle.toLowerCase())||
   x.title_original.toLowerCase().includes(needle.toLowerCase())||
   x.summary.toLowerCase().includes(needle.toLowerCase())));
  r=await probe("/api/v2/topics?days=2&limit=8");
  assert.equal(r.status,200);
  assert.equal(r.data.data.length,8);
  assert.equal(r.data.filters.sort,"score");
  assert.equal(r.data.selection_method,"deterministic_editorial_rule_v2_no_model_no_social_metrics");
  assert.ok(r.data.data.every(x=>x.publishable===false&&x.selection_score<=100&&x.source_url.startsWith("https://")));
  assert.ok(r.data.data.every(x=>Object.values(x.score_breakdown).reduce((a,b)=>a+b,0)===x.selection_score));
  r=await probe("/api/v2/news?days=14&limit=5");
  assert.equal(r.status,200);
  assert.equal(r.data.partial,true);
  assert.equal(r.data.scanned_issues,2);
  assert.ok(r.data.missing_issues.length>0);
  r=await probe("/api/v2/news?days=2&from=2026-11-22&to=2026-11-22");
  assert.equal(r.status,200);assert.equal(r.data.scanned_issues,1);
  assert.ok(r.data.data.every(x=>x.issue_date==="2026-11-22"));
  for(const path of ["/api/v2/search?days=2", "/api/v2/news?days=0",
   "/api/v2/news?days=20&days=15","/api/v2/topics?category=unlicensed",
   "/api/v2/news?from=2026-11-25&to=2026-11-20",
   "/api/v2/news?from=2026-02-30","/api/v2/news?sort=expensive",
   "/api/v2/search?q=x","/api/v2/news?url=https://evil.example/",
   "/api/v2/news?limit=0"]){
   r=await probe(path);assert.equal(r.status,400,path);
  }
  r=await probe("/api/v2/search","POST");assert.equal(r.status,405);
  r=await probe("/api/v2/news","HEAD");assert.equal(r.status,200);assert.equal(r.data,null);
  r=await probe("/api/v2/openapi.json");assert.equal(r.status,200);
  assert.equal(r.data.info.version,"2.0.0");
  assert.ok(r.data.paths["/api/v2/topics"]);
  r=await probe("/api/v1/health");
  assert.equal(r.status,200);assert.equal(r.data.latest_only,true);
  r=await probe("/api/v1/news?stream=overseas&limit=5");
  assert.equal(r.status,200);assert.ok(r.data.data.length>=3);
  globalThis.fetch=async url=>{
   if(String(url).endsWith("history.json"))throw Error("official source offline");
   return mocked(url);
  };
  r=await probe("/api/v2/news?days=2");
  assert.equal(r.status,503);
  r=await probe("/api/v1/news");
  assert.equal(r.status,200,"P0 latest-only unaffected by history-index outage");
  console.log(JSON.stringify({result:"PASS",p2:"history/news/search/topics/OpenAPI",v1:"backward-compatible",
   test:"14 date inventory, two quality approved historical issues, explicit partials, no invented sources, 5 score factors, CORS, rights, failure isolation",
   archive_issue:prior.report_date,latest_issue:latest.report_date,real_network:false}));
 }finally{globalThis.fetch=storedFetch}
})().catch(e=>{console.error("P2 OFFLINE FAILED",e);process.exitCode=1});
