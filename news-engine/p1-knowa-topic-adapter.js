/* DAVYLAB KNOWA P1 injected adapter. No secrets / bindings / changes to existing knowledge catalogue.
 * The existing KNOWA worker consumes this function as an optional read-only enhancement
 * to its /api/topics route. It does NOT auto-publish articles, edit records, or call paid AI.
 */
async function knowaTopicRadarWithNewsEngine(base){
 const result={...base,items:Array.isArray(base?.items)?base.items.slice():[],sources:Array.isArray(base?.sources)?base.sources.slice():[]};
 const endpoint='https://davylab-news-api.chenzhe223.workers.dev/api/v1/topics?limit=12';
 try{
  const r=await fetch(endpoint,{headers:{accept:'application/json'},signal:AbortSignal.timeout(8500)});
  if(!r.ok)throw Error('News Engine HTTP '+r.status);
  const j=await r.json();
  if(!j||!Array.isArray(j.data)||!/^\d{4}-\d{2}-\d{2}$/.test(String(j.issue_date||''))||j.data.length>30)
   throw Error('News Engine schema invalid');
  const originalCount=result.items.length;
  const seen=new Set(result.items.map(x=>String(x.sourceUrl||'').trim()));
  for(const x of j.data){
   if(!x||x.publishable!==false||!x.title||!x.source_url)continue;
   let u;try{u=new URL(x.source_url)}catch{continue}
   if(u.protocol!=='https:'||!u.hostname||u.username||u.password||seen.has(u.href))continue;
   seen.add(u.href);
   const title=String(x.title).trim().slice(0,180);
   if(title.length<8)continue;
   const hash=Array.from(u.href).reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261);
   const score=Number(x.selection_score);
   result.items.push({
    id:'news-engine:'+hash.toString(36),title,
    category:'AI 技术与产业 · 待核验',mode:'latest',
    summary:'公开媒体新闻线索，非学术论文，未经独立事实核验。'+String(x.summary||'').slice(0,240),
    published:j.issue_date,
    sourceName:'DAVYLAB News Engine · '+String(x.source||'原始媒体').slice(0,75),
    sourceUrl:u.href,
    score:Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):50,
    scoreReason:'来自已发布 AI 日报的新闻选题候选；非真实社交热度，必须查验原文、事实及图片版权',
    verificationStatus:'source_not_independently_verified',
    publishable:false,
    issueDate:j.issue_date
   });
  }
  result.sources.push({name:'DAVYLAB News Engine',status:'ok',count:result.items.length-originalCount,issueDate:j.issue_date});
  result.newsEngine={status:'ok',issueDate:j.issue_date,isToday:j.is_today===true,added:result.items.length-originalCount};
 }catch(err){
  result.sources.push({name:'DAVYLAB News Engine',status:'unavailable',count:0});
  result.newsEngine={status:'unavailable',added:0};
 }
 return result;
}
