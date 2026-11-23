/* Real HTTPS smoke. Run against deployed isolated API with READ ONLY requests.
 * Never generates or publishes news. No credentials or paid model calls.
 */
const assert=require("node:assert/strict");
const BASE=process.env.NEWS_API_URL||"https://davylab-news-api.chenzhe223.workers.dev";
async function get(path,method="GET"){
 const r=await fetch(BASE+path,{method,redirect:"error",signal:AbortSignal.timeout(20000)});
 return {status:r.status,json:method==="HEAD"?null:await r.json(),headers:r.headers};
}
(async()=>{
 let r=await get("/api/v1/health");
 assert.equal(r.status,200,"health HTTP");
 assert.equal(r.json.engine,"DAVYLAB News Engine");
 assert.equal(r.json.source_quality_gate,"PASS");
 assert.equal(r.json.latest_only,true);
 assert.equal(r.json.model_inference,"disabled");
 assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.json.issue_date));
 const issue=r.json.issue_date;
 const total=r.json.total_records;
 r=await get("/api/v1/news?stream=overseas&limit=50");
 assert.equal(r.status,200,"news HTTP");
 assert.ok(r.json.total>=3,"real live published News Engine leads");
 assert.ok(r.json.data.every(x=>x.issue_date===issue&&x.stream==="overseas"&&x.publishable===false));
 assert.ok(r.json.data.every(x=>x.source_url.startsWith("https://")&&!x.image_url));
 assert.ok(r.json.data.every(x=>x.verification_status==="requires_independent_fact_check"));
 const keyword=r.json.data[0].title_original.split(/\s+/).find(x=>x.length>3);
 assert.ok(keyword);
 r=await get("/api/v1/search?q="+encodeURIComponent(keyword));
 assert.equal(r.status,200);
 assert.ok(r.json.total>=1,"Search should find known published item");
 r=await get("/api/v1/topics?limit=3");
 assert.equal(r.status,200);
 assert.equal(r.json.data.length,3);
 assert.equal(r.json.selection_method,"deterministic_no_model");
 r=await get("/api/v1/news?stream=bogus");assert.equal(r.status,400);
 r=await get("/api/v1/news","POST");assert.equal(r.status,405);
 r=await get("/api/v1/health","HEAD");assert.equal(r.status,200);
 r=await get("/api/v1/openapi.json");assert.equal(r.status,200);assert.ok(r.json.paths["/api/v1/news"]);
 console.log(JSON.stringify({result:"PASS",service:"DAVYLAB News API P0",
   url:BASE,upstream_issue:issue,upstream_freshness_issue_today:undefined,
   indexed_records:total,scanned:"health/news/search/topics/openapi/HEAD/method-gate/query-guard",
   network:"real HTTPS",writes:false,model_calls:false}));
})().catch(e=>{console.error("LIVE NEWS API FAILED",e);process.exitCode=1});
