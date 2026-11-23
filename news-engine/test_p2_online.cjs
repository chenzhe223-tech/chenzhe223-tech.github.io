/* Read-only post-deployment P2 real HTTPS acceptance */
const assert=require("node:assert/strict");
const BASE="https://davylab-news-api.chenzhe223.workers.dev";
async function get(path,method="GET"){
 const res=await fetch(BASE+path,{method,signal:AbortSignal.timeout(45000)});
 const body=method==="HEAD"?null:await res.json();
 return {status:res.status,body,headers:res.headers};
}
(async()=>{
 let r=await get("/api/v2/history?days=14");
 assert.equal(r.status,200);
 assert.equal(r.body.schema_version,"2.0.0");
 assert.ok(r.body.available_dates.length>=2,"At least two real published issue dates must be accessible");
 const days=r.body.available_dates.slice(0,2);
 assert.notEqual(days[0],days[1]);
 r=await get("/api/v2/news?days=2&limit=40");
 assert.equal(r.status,200);
 assert.equal(r.body.scanned_issues,2,"Both real latest+archive issues must pass the quality gate");
 assert.equal(r.body.partial,false,"Recent two issues must be complete, no silent missing archives");
 assert.ok(r.body.deduplicated_records>=25);
 assert.ok(r.body.data.every(x=>x.publishable===false&&x.external_copy_allowed===false&&x.source_url.startsWith("https://")));
 assert.ok(r.body.data.every(x=>!x.image_url&&!x.body&&x.editorial_score.total<=100&&x.issue_dates.length>=1));
 const priorDate=days[1];
 r=await get("/api/v2/news?days=2&from="+priorDate+"&to="+priorDate+"&limit=5");
 assert.equal(r.status,200);
 assert.equal(r.body.scanned_issues,1);
 assert.ok(r.body.data.every(x=>x.issue_date===priorDate),"Historical date filter must return prior issue records");
 r=await get("/api/v2/search?days=2&q="+encodeURIComponent("AI")+"&limit=5");
 assert.equal(r.status,200);
 assert.ok(r.body.total>=1,"Search should find recent published AI articles");
 r=await get("/api/v2/topics?days=2&limit=5");
 assert.equal(r.status,200);
 assert.equal(r.body.data.length,5);
 assert.equal(r.body.filters.sort,"score");
 assert.equal(r.body.selection_method,"deterministic_editorial_rule_v2_no_model_no_social_metrics");
 assert.ok(r.body.data.every(x=>x.publishable===false&&x.score_breakdown));
 r=await get("/api/v2/openapi.json");assert.equal(r.status,200);assert.equal(r.body.info.version,"2.0.0");
 r=await get("/api/v1/news?stream=overseas&limit=3");
 assert.equal(r.status,200);assert.equal(r.body.data.length,3);
 r=await get("/api/v1/health");
 assert.equal(r.status,200);assert.equal(r.body.latest_only,true);
 r=await get("/api/v2/search");assert.equal(r.status,400);
 r=await get("/api/v2/news","POST");assert.equal(r.status,405);
 r=await get("/api/v2/news","HEAD");assert.equal(r.status,200);
 console.log(JSON.stringify({result:"PASS",service:BASE,latest:days[0],prior:priorDate,
  tested:"P2 2-issue real archive scan/history/category/date/search/topics/score/rights/methods plus P1 compatibility",
  model_calls:0,published_content_copied:false,read_only:true}));
})().catch(err=>{console.error("P2 PRODUCTION FAILED",err);process.exitCode=1});
