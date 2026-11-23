/* Offline API contract: no third-party packages or real network calls. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {pathToFileURL}=require("node:url");
(async()=>{
 const worker=(await import(pathToFileURL(require("node:path").resolve("news-engine/public-api-worker.mjs")).href)).default;
 const report=JSON.parse(fs.readFileSync("radar/data/latest.json","utf-8"));
 const realFetch=globalThis.fetch;
 const valid=x=>new Response(JSON.stringify(x),{status:200,headers:{"content-type":"application/json"}});
 let calls=0;
 globalThis.fetch=async(url)=>{calls++;assert.ok(String(url).includes("latest.json"),"allowlisted only");return valid(report)};
 async function probe(path,method="GET"){
  const r=await worker.fetch(new Request("https://news.invalid"+path,{method}));
  return {status:r.status,headers:r.headers,json:method==="HEAD"?null:await r.json()};
 }
 try{
  let r=await probe("/");
  assert.equal(r.status,200);
  assert.equal(r.json.mode,"published_read_only");
  assert.ok(!JSON.stringify(r.json).includes("secret"));
  r=await probe("/api/v1/health");
  assert.equal(r.status,200);
  assert.equal(r.json.issue_date,report.report_date);
  assert.equal(r.json.latest_only,true);
  assert.equal(r.json.model_inference,"disabled");
  assert.equal(r.json.write_endpoints,false);
  r=await probe("/api/v1/news?stream=overseas&limit=40");
  assert.equal(r.status,200);
  assert.equal(r.json.total,report.xnews_voices.filter(x=>x.source_kind==="news_engine_rss_discovery").length);
  assert.equal(r.json.data.length,r.json.total);
  assert.ok(r.json.data.every(x=>x.stream==="overseas"&&x.source_url.startsWith("https://")));
  assert.ok(r.json.data.every(x=>x.publishable===false&&x.external_copy_allowed===false));
  assert.ok(r.json.data.every(x=>!Object.hasOwn(x,"image_url")&&!Object.hasOwn(x,"body")));
  assert.equal(r.headers.get("access-control-allow-origin"),"*");
  assert.match(r.headers.get("cache-control"),/max-age/);
  r=await probe("/api/v1/news?stream=china&limit=2&offset=1");
  assert.equal(r.status,200);
  assert.equal(r.json.data.length,2);
  assert.ok(r.json.data.every(x=>x.region==="china"));
  r=await probe("/api/v1/news?stream=all&limit=500");
  assert.equal(r.status,200);
  assert.ok(r.json.data.length<=50);
  assert.equal(new Set(r.json.data.map(x=>x.source_url)).size,r.json.data.length);
  r=await probe("/api/v1/search?q="+encodeURIComponent(report.xnews_voices[0].title.split(" ")[0]));
  assert.equal(r.status,200);
  assert.ok(r.json.total>=1);
  assert.ok(r.json.filters.q.length>=2);
  r=await probe("/api/v1/topics?limit=5");
  assert.equal(r.status,200);
  assert.equal(r.json.data.length,5);
  assert.equal(r.json.selection_method,"deterministic_no_model");
  assert.ok(r.json.data.every(x=>!x.publishable&&x.source_url.startsWith("https://")));
  for(const url of ["/api/v1/search", "/api/v1/news?stream=piracy",
                    "/api/v1/news?limit=three", "/api/v1/news?limit=1&limit=2",
                    "/api/v1/search?q="+("x".repeat(110))]) {
    r=await probe(url);assert.equal(r.status,400,url);
  }
  r=await probe("/api/v1/news","POST");assert.equal(r.status,405);
  r=await probe("/api/v1/search","PUT");assert.equal(r.status,405);
  r=await probe("/api/v1/bad");assert.equal(r.status,404);
  r=await probe("/api/v1/openapi.json");assert.equal(r.status,200);
  assert.ok(r.json.paths["/api/v1/search"]);
  r=await probe("/api/v1/news","HEAD");assert.equal(r.status,200);assert.equal(r.json,null);
  const preflight=await worker.fetch(new Request("https://news.invalid/api/v1/news",{method:"OPTIONS"}));
  assert.equal(preflight.status,204);
  let fallbackCalls=0;
  globalThis.fetch=async()=>{fallbackCalls++;if(fallbackCalls===1)throw Error("first origin unavailable");return valid(report)};
  r=await probe("/api/v1/health");assert.equal(r.status,200);assert.equal(fallbackCalls,2);
  globalThis.fetch=async()=>{throw Error("both origin down")};
  r=await probe("/api/v1/news");assert.equal(r.status,503);assert.equal(r.json.error.code,"source_unavailable");
  globalThis.fetch=async()=>valid({...report,quality_gate:{status:"FAIL"}});
  r=await probe("/api/v1/news");assert.equal(r.status,503);
  const malicious=JSON.parse(JSON.stringify(report));
  malicious.xnews_voices.unshift({title:"private origin",url:"http://localhost/admin",source:"X",published:"2026-11-23"});
  globalThis.fetch=async()=>valid(malicious);
  r=await probe("/api/v1/news?stream=overseas");assert.equal(r.status,200);
  assert.ok(!r.json.data.some(x=>x.source_url.includes("localhost")));
  console.log(JSON.stringify({result:"PASS",source_issue:report.report_date,tested:"HTTP methods, bounded pagination, data provenance, four endpoints, openapi, CORS, SSL source guard, bad input, dual-origin fallback, quality fail-closed",real_fetch:false}));
 }finally{globalThis.fetch=realFetch;}
})().catch(e=>{console.error(e);process.exitCode=1});
