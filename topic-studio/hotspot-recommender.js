/* DAVYLAB Topic Studio · Evidence-first Top 10 niches.
 * Ranking is an editorial heuristic, NOT a measured universal social hot list.
 * No user account, cloud write, paid model call, or WeChat publication.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id),engine=window.DAVYLABHotspotRanker,section=$("section-research");
if(!section||!engine)return;
const SNAP="./data/hotspot-signals.json",CACHE="davylab-hotspot-signals-lastgood-v1",SELECTED="davylab-selected-niche-v1";
const state={days:14,mode:"balanced",snapshot:null,ranked:[],selectedId:"",loading:false,stats:null};
const esc=v=>typeof safe==="function"?safe(String(v??"")):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const compact=(v,n=170)=>String(v??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n);
const dateString=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Shanghai"}).format(d):"日期待核实"};
const reduced=()=>Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
const snapTo=id=>$(id)?.scrollIntoView({behavior:reduced()?"instant":"smooth",block:"center"});
function build(){
 const root=document.createElement("section");root.id="hotspotTop10";root.className="hotspot-workbench";
 root.setAttribute("aria-labelledby","hotspotTitle");
 root.innerHTML=[
 '<div class="hotspot-heading"><div><div class="hotspot-eyebrow">DAVYLAB / HOTSPOT INTELLIGENCE</div>',
 '<h2 id="hotspotTitle">基于真实热点，推荐 10 个可写赛道</h2>',
 '<p>综合 AI Radar、XNews、Hacker News 和公开 GitHub 项目，按证据与读者价值生成可选择的内容方向。</p></div>',
 '<button type="button" id="hotspotReload">重新读取公开快照</button></div>',
 '<div class="hotspot-summary"><div><span>近期有效线索</span><strong id="hotspotSignalCount">—</strong></div>',
 '<div><span>采集渠道</span><strong id="hotspotChannelCount">—</strong></div>',
 '<div><span>有依据的方案</span><strong id="hotspotDirectionCount">— / 10</strong></div>',
 '<div><span>公开快照时间</span><strong id="hotspotCollected">待加载</strong></div></div>',
 '<div class="hotspot-controls"><label>观察窗口 <select id="hotspotRange"><option value="7">最近 7 天</option>',
 '<option value="14" selected>最近 14 天</option><option value="30">最近 30 天</option></select></label>',
 '<label>排序偏好 <select id="hotspotMode"><option value="balanced">综合推荐</option>',
 '<option value="discussion">讨论信号优先</option><option value="practical">实操价值优先</option></select></label>',
 '<div class="hotspot-method">推荐分依据：时效 / 来源覆盖 / 可观测讨论 / 读者适配 / 原文可追溯</div></div>',
 '<div id="hotspotStatus" class="hotspot-status" role="status" aria-live="polite">正在读取采集结果…</div>',
 '<div class="hotspot-subhead"><h3>TOP 10 · 赛道推荐</h3><span>编辑推荐指数，不是全网热搜排名或流量预测</span></div>',
 '<div id="hotspotCards" class="hotspot-cards" aria-live="polite"><div class="hotspot-empty">正在分析有原文来源支撑的候选方向…</div></div>',
 '<div id="hotspotSelected" class="hotspot-selected" hidden aria-live="polite"></div>',
 '<p class="hotspot-footnote">数据边界：HN points / comments 来自对应的公开讨论，GitHub stars 为项目累计数，不是日增长；不能当成微信公众号阅读或全网热度。原文细节、发布时间及数据口径均需人工复核。采用方案不会自动批准或发表文章。</p>'
 ].join("");
 section.querySelector(".hero")?.insertAdjacentElement("afterend",root);
 $("hotspotRange").addEventListener("change",()=>{state.days=Number($("hotspotRange").value);compute()});
 $("hotspotMode").addEventListener("change",()=>{state.mode=$("hotspotMode").value;compute()});
 $("hotspotReload").addEventListener("click",()=>load(true));
 $("hotspotCards").addEventListener("click",e=>{
  const b=e.target.closest("button[data-hotspot-action]");if(!b)return;
  const x=state.ranked[Number(b.dataset.index)];if(!x)return;
  if(b.dataset.hotspotAction==="choose")choose(x,true);
  else if(b.dataset.hotspotAction==="pilot")pilot(x);
  else if(b.dataset.hotspotAction==="add")addTopic(x);
 });
 try{const saved=JSON.parse(localStorage.getItem(SELECTED)||"null");if(saved?.id)state.selectedId=saved.id}catch{}
}
function sourceRows(){
 const rows=[],feed=typeof feedCache!=="undefined"&&Array.isArray(feedCache)?feedCache:[];
 for(const x of feed)if(x?.url)rows.push({...x,kind:"news",origin:x.origin||"radar",tags:[x.category||"",x.type||""]});
 for(const x of window.DAVYLABXNews?.getItems?.()||[])if(x?.original_url)
  rows.push({title:x.title,summary:x.summary,url:x.original_url,published:x.date,source:"XNews",origin:"xnews",tags:x.tags||[],kind:"news",discussion_url:x.xnews_url||""});
 return [...rows,...(state.snapshot?.items||[])];
}
function meta(e){
 const nums=[];
 if(e.hnPoints!==null)nums.push("HN "+e.hnPoints+" 分");
 if(e.hnComments!==null)nums.push(e.hnComments+" 评论");
 if(e.githubStars!==null)nums.push("GitHub 累计 "+e.githubStars+" stars");
 return [e.source,dateString(e.published),...nums].filter(Boolean).join(" · ");
}
function partText(p){
 const b=p.breakdown;
 return "时效 "+b.freshness+" / 来源 "+b.channelCoverage+" / 讨论 "+b.observableDiscussion+
  " / 读者 "+b.readerFit+" / 追溯 "+b.sourceTrace;
}
function render(){
 const cards=$("hotspotCards");
 if(!state.ranked.length){
  cards.innerHTML='<div class="hotspot-empty">近期有效原文来源不足，暂不能生成有依据的 10 个方案。先检查 AI Radar / XNews 与热点采集任务，不会凭空补齐“热门赛道”。</div>';
  $("hotspotSelected").hidden=true;
 }else{
  cards.innerHTML=state.ranked.map((p,i)=>{
   const first=p.evidence[0],selected=p.id===state.selectedId;
   const links=p.evidence.map(e=>'<li><a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">'+esc(e.title)+'</a>'+
    '<small>'+esc(meta(e))+'</small>'+(e.discussionUrl&&e.discussionUrl!==e.url?
     '<a href="'+esc(e.discussionUrl)+'" target="_blank" rel="noopener noreferrer">原讨论</a>':"")+'</li>').join("");
   return '<article class="hotspot-card'+(selected?" is-selected":"")+'">'+
    '<div class="hotspot-card-top"><span class="hotspot-rank">'+String(i+1).padStart(2,"0")+'</span>'+
    '<span class="hotspot-kind">'+esc(p.kind)+'</span><span class="hotspot-score"><b>'+p.score+'</b>/100</span></div>'+
    '<h3>'+esc(p.name)+'</h3><p class="hotspot-promise">'+esc(p.promise)+'</p>'+
    '<p class="hotspot-audience"><b>适合</b> '+esc(p.audience)+'</p>'+
    '<div class="hotspot-facts"><span>'+p.evidenceCount+' 条有据线索</span><span>'+p.channels.length+' 个渠道</span>'+
    '<span>最新 '+Math.max(0,p.latestDays)+' 天前</span></div>'+
    '<div class="hotspot-bar"><i style="width:'+Math.min(100,Math.max(0,p.score))+'%"></i></div>'+
    '<div class="hotspot-key-source"><strong>代表来源</strong><a href="'+esc(first.url)+'" target="_blank" rel="noopener noreferrer">'+esc(first.title)+'</a></div>'+
    '<details class="hotspot-details"><summary>展开证据与评分细则</summary><p>建议实践：'+esc(p.action)+'</p>'+
    '<p class="hotspot-score-detail">'+esc(partText(p))+'</p><ol>'+links+'</ol>'+
    '<p>信息状态：公开元数据，尚未独立逐篇核验；不是微信阅读量数据。</p></details>'+
    '<div class="hotspot-actions"><button type="button" class="hotspot-select" data-index="'+i+'" data-hotspot-action="choose">'+(selected?"已选择 · 继续调整":"选择此方案")+'</button>'+
    '<button type="button" data-index="'+i+'" data-hotspot-action="pilot">生成5篇试水</button>'+
    '<button type="button" data-index="'+i+'" data-hotspot-action="add">线索入池</button></div></article>';
  }).join("");
  const chosen=state.ranked.find(x=>x.id===state.selectedId);
  if(chosen){
   $("hotspotSelected").hidden=false;
   $("hotspotSelected").innerHTML='<div><b>当前选中：'+esc(chosen.name)+'</b><p>'+esc(chosen.action)+'</p>'+
    '<small>已填入下方赛道研究表单，可按需修改；来源待核实，选题仍处于草稿阶段。</small></div>'+
    '<strong>'+chosen.score+' / 100</strong>';
  }else $("hotspotSelected").hidden=true;
 }
 $("hotspotSignalCount").textContent=state.stats?.sourceCount??0;
 $("hotspotChannelCount").textContent=state.stats?.domains??0;
 $("hotspotDirectionCount").textContent=state.ranked.length+" / 10";
 $("hotspotCollected").textContent=state.snapshot?.synced_at?dateString(state.snapshot.synced_at):"无外部快照";
 const age=state.snapshot?.synced_at?(Date.now()-Date.parse(state.snapshot.synced_at))/3600000:Infinity;
 $("hotspotStatus").textContent=(state.snapshot?age>48?"公开讨论快照超过 48 小时，请注意时效。":"已合并公开讨论快照。":"当前仅使用已加载的 AI Radar / XNews，额外公开讨论快照未就绪。")+
  " 本次按最近 "+state.days+" 天分析 "+(state.stats?.sourceCount||0)+" 条去重线索。"+
  (state.stats?.warning||"")+(state.snapshot?.warnings?.length?" 部分来源失败，详情见公开采集记录。":"");
}
function compute(){
 const output=engine.rank(sourceRows(),{days:state.days,mode:state.mode});
 state.stats=output;state.ranked=output.recommendations;
 render();
}
function choose(p,scroll){
 state.selectedId=p.id;
 const fields={researchNiche:p.name,researchAudience:p.audience,seriesTheme:p.name,pdResearchQuery:p.name};
 for(const [id,value] of Object.entries(fields))if($(id))$(id).value=value;
 const note=$("researchContext");
 if(note)note.value="【公开热点编辑推荐 · 事实待核实】\n读者价值："+p.promise+"\n建议实践："+p.action+
   "\n推荐指数："+p.score+"/100；来源渠道："+p.channels.join("、")+"；已采集的代表线索：\n"+
   p.evidence.map(e=>e.title+"\n"+e.url).join("\n")+
   "\n请选择 DAVYLAB 自己确实完成的案例，不得将计划写成实测。";
 try{localStorage.setItem(SELECTED,JSON.stringify({id:p.id,name:p.name,selectedAt:new Date().toISOString()}))}catch{}
 window.DAVYLABProductivity?.renderSources?.();
 render();
 if(scroll){snapTo("researchNiche");if(typeof toast==="function")toast("已选赛道并填入研究表单，可继续修改");}
}
function pilot(p){
 choose(p,false);
 const headlines=[
  "看懂"+p.name+"：究竟发生了什么？",
  "普通人该怎样判断"+p.name+"的真实价值？",
  p.name+"：一个可复现的试用计划",
  p.name+"有哪些风险和常见误解？",
  "复盘"+p.name+"：哪些结论已经核实？"
 ];
 const rows=headlines.map((heading,i)=>{
  const e=p.evidence[i%p.evidence.length];
  const note=i===2?"实验尚未实际执行，需记录完整步骤、截图与验收结果":
   "请核验原文后再发表："+(e?.title||"待补来源")+" "+(e?.url||"");
  return String(i+1).padStart(2,"0")+"｜"+heading+"｜"+note;
 });
 if($("seriesTheme"))$("seriesTheme").value=p.name;
 if($("seriesCount"))$("seriesCount").value="5";
 if($("seriesPaste"))$("seriesPaste").value=rows.join("\n");
 $("seriesParse")?.click();
 snapTo("seriesPreview");
 if(typeof toast==="function")toast("已生成 5 篇试水选题的可编辑预览，审核后可入池");
}
function addTopic(p){
 const original=p.evidence[0];if(!original)return;
 const saved=typeof topics!=="undefined"&&topics.find(t=>t.sourceUrl===original.url);
 if(saved){window.DAVYLABTopicPool?.reveal?.(original.url);return}
 if(typeof topics==="undefined"||typeof uid!=="function"||typeof saveTopics!=="function")return;
 topics.unshift({id:uid(),title:p.name+"："+original.title.slice(0,52),
  angle:p.promise,summary:"编辑实践："+p.action+"。信息来自公开元数据，内容尚未核实。",
  sourceUrl:original.url,sourceTitle:original.title,sourceName:original.source,
  origin:"hotspot-ranked",factCheckStatus:"待核实",column:"AI 创造机会雷达",
  format:"文章",status:"inbox",plannedDate:"",createdAt:new Date().toISOString(),
  scores:{reader:4,timely:4,practical:4,distinct:3,brand:4}});
 saveTopics();
 window.DAVYLABTopicPool?.reveal?.(original.url);
}
async function load(force){
 if(state.loading)return;
 state.loading=true;$("hotspotReload").disabled=true;
 let data=null;
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  let response;
  try{response=await fetch(SNAP+(force?"?v="+Date.now():""),{cache:force?"no-store":"default",signal:controller.signal})}
  finally{clearTimeout(timer)}
  if(!response.ok)throw Error("HTTP "+response.status);
  const json=await response.json();
  if(json.schema_version!==1||!Array.isArray(json.items)||!json.items.length||!Number.isFinite(Date.parse(json.synced_at)))
   throw Error("Invalid public snapshot");
  if(Date.parse(json.synced_at)>Date.now()+7200000)throw Error("Future collection timestamp");
  data=json;
  try{localStorage.setItem(CACHE,JSON.stringify({schema_version:1,synced_at:json.synced_at,items:json.items.slice(0,160),warnings:json.warnings||[]}))}catch{}
 }catch{
  try{const backup=JSON.parse(localStorage.getItem(CACHE)||"null");
   if(backup?.schema_version===1&&Array.isArray(backup.items))data=backup}catch{}
 }
 state.snapshot=data;state.loading=false;$("hotspotReload").disabled=false;compute();
}
build();
const oldDraw=window.renderOpportunityRadar;
if(typeof oldDraw==="function")
 window.renderOpportunityRadar=function(){oldDraw();compute()};
window.DAVYLABHotspotRecommendation={
 version:"1.0.0",refresh:()=>load(true),getOptions:()=>state.ranked.slice(),
 choose:id=>{const p=state.ranked.find(x=>x.id===id);if(p)choose(p,false);return Boolean(p)},
 status:()=>({count:state.ranked.length,signals:state.snapshot?.items?.length||0,updated:state.snapshot?.synced_at||""})
};
compute();
load(false);
})();
