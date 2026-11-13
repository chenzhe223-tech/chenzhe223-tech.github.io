"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ranker=require("../hotspot-ranker.js");
const root=path.resolve(__dirname,"../..");
const raw=JSON.parse(fs.readFileSync(path.join(root,"../radar/data/latest.json"),"utf8"));
const xnews=JSON.parse(fs.readFileSync(path.join(root,"data/xnews-discovery.json"),"utf8"));
const hotspot=JSON.parse(fs.readFileSync(path.join(root,"data/hotspot-signals.json"),"utf8"));
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
console.log("PASS hotspot Top 10 ranking: provenance, 10 choices, weights, date windows, anti-fake, dedupe");
