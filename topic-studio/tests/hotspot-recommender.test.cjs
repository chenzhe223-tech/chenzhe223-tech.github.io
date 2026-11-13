"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ranker=require("../hotspot-ranker.js");
const root=path.resolve(__dirname,"../..");
const raw=JSON.parse(fs.readFileSync(path.join(root,"radar/data/latest.json"),"utf8"));
const xnews=JSON.parse(fs.readFileSync(path.join(root,"topic-studio/data/xnews-discovery.json"),"utf8"));
const hotspot=JSON.parse(fs.readFileSync(path.join(root,"topic-studio/data/hotspot-signals.json"),"utf8"));
const now=new Date(hotspot.synced_at);
const examples=[
 ...(raw.news||[]).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,url:x.url,source:x.source,published:x.published})),
 ...(raw.china_ai_news||[]).map(x=>({title:x.title_zh||x.title,summary:x.summary_zh||x.summary,url:x.url,source:x.source,published:x.published})),
 ...(raw.skills||[]).map(x=>({title:x.name,summary:x.description_zh||x.description,url:x.url,source:"GitHub Skills",published:x.updated})),
 ...xnews.articles.map(x=>({title:x.title,summary:x.summary,url:x.original_url,published:x.date,source:"XNews",origin:"xnews",tags:x.tags})),
 ...hotspot.items
];
const ranked=ranker.rank(examples,{now,days:14,mode:"balanced"});
assert.equal(ranked.recommendations.length,10,"Ten evidence-backed, selectable niches should be available");
assert.ok(ranked.sourceCount>=20,"Source pool unexpectedly thin");
assert.equal(new Set(ranked.recommendations.map(x=>x.id)).size,10);
assert.ok(ranked.recommendations.every((x,i)=>x.rank===i+1&&x.score>=0&&x.score<=100));
assert.ok(ranked.recommendations.every(x=>x.evidence.length>0&&x.evidence[0].url.startsWith("http")));
assert.ok(ranked.recommendations.every((x,i,a)=>i===0||a[i-1].score>=x.score),"Ranking order not monotonic");
assert.ok(ranked.recommendations.every(x=>x.evidenceCount>=1));
assert.ok(ranked.recommendations.every(x=>x.score===Math.min(100,Object.values(x.breakdown).reduce((a,b)=>a+b,0))),"Displayed editorial sub-scores must add to the total");
assert.ok(ranked.recommendations.some(x=>x.channels.includes("Hacker News")||x.channels.includes("GitHub Search")),"No independently collected data used");
for(const mode of ["balanced","discussion","practical"]){
 const alt=ranker.rank(examples,{now,mode,days:14});
 assert.equal(alt.recommendations.length,10);
}
for(const days of [7,14,30])assert.equal(ranker.rank(examples,{now,days}).recommendations.length,10);
const tiny=ranker.rank([],{now,days:7});
assert.equal(tiny.recommendations.length,0,"Empty data must not be fabricated into ten choices");
const unknown=ranker.normalise([{title:"Learning AI memory with agents",url:"https://example.com/test-ai",
  published:now.toISOString(),hn_points:null,hn_comments:undefined,github_stars:null}],now);
assert.equal(unknown[0].hnPoints,null);assert.equal(unknown[0].hnComments,null);
assert.equal(unknown[0].githubStars,null);
const dup=ranker.normalise([
 {title:"Open-source agents from a public article",url:"https://example.org/story?utm_source=a",published:now.toISOString(),source:"Radar"},
 {title:"Open-source agents from a public article",url:"https://example.org/story?utm_source=b",published:now.toISOString(),source:"XNews",origin:"xnews"},
],now);
assert.equal(dup.length,1,"Tracking parameters cannot create fake additional stories");
assert.equal(dup[0].groups?.length,2,"Cross-channel provenance should be preserved");
const zero=ranker.normalise([{title:"AI agents in actual production workflows",url:"https://example.org/zero",published:now.toISOString(),hn_points:0,hn_comments:0},{title:"AI agents in actual production workflows",url:"https://example.org/zero",published:now.toISOString(),source:"HN",hn_points:0,hn_comments:0}],now);
assert.equal(zero[0].hnPoints,0,"Observed zero is not missing data");
assert.equal(zero[0].hnComments,0);
const report={
  status:"pass",
  method:"Deterministic Node.js ranker over committed public AI Radar/XNews/HN/GitHub metadata",
  source_synced_at:hotspot.synced_at,
  generated_at:new Date().toISOString(),
  scope:"Editorial heuristic only; source headlines/metrics not independently verified article-by-article",
  available_sources:ranked.sourceCount,
  recommendations:ranked.recommendations.map(r=>({
    rank:r.rank,id:r.id,name:r.name,score:r.score,editorial_breakdown:r.breakdown,
    evidenceCount:r.evidenceCount,channels:r.channels,
    exampleSources:r.evidence.slice(0,2).map(e=>({title:e.title,url:e.url,source:e.source,published:e.published}))
  })),
  warning:ranked.methodology
};
const reportPath=path.join(root,"topic-studio/qa/hotspot-top10-latest.json");
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n","utf8");
console.log("PASS hotspot Top 10 ranking: provenance, 10 choices, weights, date windows, anti-fake, dedupe");

