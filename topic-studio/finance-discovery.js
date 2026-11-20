/* DAVYLAB · 全球财经资讯发现（公开元数据，未经独立核验） */
/* Production bootstrap: activate first verified feed sync after new workflow registration. */
/* v2 release: request first production China/World ranked snapshot through the verified Actions job. */
(function(){
"use strict";
const root=document.getElementById("financeDiscovery");
if(!root)return;
const $=id=>document.getElementById(id);
const url="./data/finance-discovery.json",cacheKey="davylab-finance-discovery-v1";
const state={items:[],snapshot:null,cached:false,filter:"all",region:"all",sort:"total",query:"",visible:6};
const scoreNames={timeliness:"及时",readability:"可读",value:"价值",heat:"热点",appeal:"吸睛"};
const clampScore=x=>Number.isFinite(Number(x))?Math.max(0,Math.min(100,Math.round(Number(x)))):null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeLink=v=>{try{let u=new URL(String(v||""));return u.protocol==="https:"&&!u.username&&!u.password?u.href:""}catch{return""}};
const category=t=>/^[\u4e00-\u9fa5\d\s/·-]+$/.test(String(t||""))?t:"全球财经";
function normalize(a){
 if(!a||!String(a.id||"").startsWith("fin-")||!safeLink(a.url)||!a.title)return null;
 let parsed=Date.parse(a.published_at||"");
 if(!Number.isFinite(parsed))return null;
 return {id:String(a.id).slice(0,64),title:String(a.title).slice(0,170),summary:String(a.summary||"").slice(0,210),
  url:safeLink(a.url),source:String(a.source||"原始来源").slice(0,90),category:category(a.category),
  published_at:new Date(parsed).toISOString(),source_type:a.source_type==="media_report"?"media_report":"official_primary",
  region:a.region==="中国"?"中国":"全球",region_basis:String(a.region_basis||""),
  score:a.score&&a.score.basis==="editorial_heuristic_not_audience_metrics"?{
   total:clampScore(a.score.total),timeliness:clampScore(a.score.timeliness),readability:clampScore(a.score.readability),
   value:clampScore(a.score.value),heat:clampScore(a.score.heat),appeal:clampScore(a.score.appeal),
   reasons:Array.isArray(a.score.reasons)?a.score.reasons.slice(0,3).map(s=>String(s).slice(0,75)):[]}:null,
  verification:"待核实"};
}
function ageLabel(iso){let d=(Date.now()-Date.parse(iso))/86400000;return d<=3&&d>=0?"近72小时":d<=14?"近14天":"历史线索"}
function filteredAndSorted(){
 let items=state.items.filter(x=>(state.filter==="all"||x.category===state.filter)
  &&(state.region==="all"||x.region===state.region)
  &&[x.title,x.summary,x.source].join(" ").toLowerCase().includes(state.query));
 const key=state.sort==="recent"?"recent":state.sort;
 return items.sort((a,b)=>{
  if(key==="recent")return Date.parse(b.published_at)-Date.parse(a.published_at);
  const v=(b.score?.[key]??-1)-(a.score?.[key]??-1);
  return v||Date.parse(b.published_at)-Date.parse(a.published_at)||a.id.localeCompare(b.id);
 });
}
function render(){
 const wrap=$("financeList"),date=$("financeUpdated");
 const items=filteredAndSorted();
 const china=state.items.filter(x=>x.region==="中国").length;
 $("financeCount").textContent="已收录 "+state.items.length+" 条 · 中国 "+china+" 条 · 匹配 "+items.length+" 条";
 if(state.snapshot){
  let checked=state.snapshot.checked_at?new Date(state.snapshot.checked_at).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"未成功同步";
  const errors=(state.snapshot.sources||[]).filter(x=>x.status==="error").length;
  date.textContent="最近抓取 "+checked+" · "+errors+" 个来源异常"+(state.cached?" · 本机上次缓存":"");
  const fresh=items.filter(x=>{const age=Date.now()-Date.parse(x.published_at);return age>=0&&age<=72*3600*1000}).length;
  $("financeStatus").textContent=fresh?"近72小时有 "+fresh+" 条资讯线索（未经核验）":"当前筛选没有近72小时新资讯；请核对发布日期";
 }
 if(!items.length){
  wrap.innerHTML='<div class="finance-empty"><strong>当前条件下没有财经资讯</strong><p>可切换中国/全球区域或清除关键词。系统不会用模拟行情填充空白。</p><a target="_blank" rel="noopener noreferrer" href="https://www.federalreserve.gov/newsevents.htm">查看官方原始资讯</a></div>';
  $("financeMore").hidden=true;return;
 }
 const scorePills=a=>Object.entries(scoreNames).map(([key,name])=>'<span class="finance-score-item" title="'+esc(name+'：编辑算法估算，不是受众行为数据')+'">'+esc(name)+' <b>'+esc(a.score?.[key]??"—")+'</b></span>').join("");
 wrap.innerHTML=items.slice(0,state.visible).map((a,i)=>'<article class="finance-card">'+
  '<div class="finance-card-meta"><span class="finance-region '+(a.region==="中国"?"is-china":"")+'">'+esc(a.region)+'</span><span>'+esc(a.category)+'</span><time>'+esc(a.published_at.slice(0,10))+' · '+esc(ageLabel(a.published_at))+'</time></div>'+
  '<div class="finance-priority"><strong class="finance-rank">#'+(i+1)+'</strong><span>'+(a.score?'综合优先级 <b>'+esc(a.score.total)+'</b>/100':'待评分 · 按发布时间')+'</span><small>编辑推荐度 ≠ 真实流量</small></div>'+
  '<h3>'+esc(a.title)+'</h3><p>'+esc(a.summary||"原始来源未提供摘要；请打开原文进行核查。")+'</p>'+
  '<div class="finance-scores" aria-label="财经五维编辑估分">'+scorePills(a)+'</div>'+
  (a.score?.reasons?.length?'<div class="finance-why">理由：'+esc(a.score.reasons.slice(0,2).join("；"))+'</div>':"")+
  '<div class="finance-card-footer"><small>'+esc(a.source)+' · '+(a.source_type==="media_report"?"媒体报道":"官方公告")+' · 待核实</small><div><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">查看原文</a><button type="button" data-fin-id="'+esc(a.id)+'">加入财经选题</button></div></div></article>').join("");
 $("financeMore").hidden=items.length<=state.visible;
 $("financeMore").textContent="加载更多（剩余 "+Math.max(0,items.length-state.visible)+" 条）";
}
async function load(){
 $("financeStatus").textContent="正在核对最新财经来源…";
 try{
  const response=await fetch(url+"?daily="+new Date().toISOString().slice(0,10)+"&t="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=await response.json();
  if(!data||![1,2].includes(data.schema_version)||!Array.isArray(data.articles))throw Error("来源数据格式异常");
  state.snapshot=data;state.items=data.articles.map(normalize).filter(Boolean);
  state.cached=false;
  if(state.items.length)localStorage.setItem(cacheKey,JSON.stringify(data));
 }catch(e){
  try{
   const saved=JSON.parse(localStorage.getItem(cacheKey)||"null");
   if(!saved||!Array.isArray(saved.articles))throw Error("no cache");
   state.snapshot=saved;state.items=saved.articles.map(normalize).filter(Boolean);state.cached=true;
   $("financeStatus").textContent="抓取快照不可用，已回退本机旧数据（不代表今天更新）";
  }catch{state.snapshot=null;state.items=[];$("financeStatus").textContent="尚无可信财经快照（不能显示模拟数据）"}
 }
 render();
}
function add(a){
 const canonical=u=>String(u||"").split("#")[0].replace(/\/$/,"").toLowerCase();
 let found=topics.find(t=>canonical(t.sourceUrl)===canonical(a.url));
 if(found){toast("这条来源已经在选题池中");return found}
 const item={id:uid(),title:a.title,angle:"根据原始来源核验关键事实、财经数字及口径，输出短财经快报和独立海报；如为媒体报道不得称为官方披露。",summary:a.summary,
   sourceUrl:a.url,sourceName:a.source,sourceTitle:a.title,sourcePublishedAt:a.published_at,sourceKind:a.source_type,financeRegion:a.region,financePriorityScore:a.score?.total??null,origin:"finance",
   column:"全球财经资讯",format:"贴图",productionMode:"finance",factCheckStatus:"待核实",status:"inbox",plannedDate:"",
   createdAt:new Date().toISOString(),scores:{reader:3,timely:4,practical:3,distinct:3,brand:4}};
 topics.unshift(item);saveTopics();renderTopics();toast("已加入财经选题池，等待原始资料核验");return item;
}
root.addEventListener("click",e=>{
 const btn=e.target.closest("button[data-fin-id]");if(!btn)return;
 const a=state.items.find(x=>x.id===btn.dataset.finId);if(!a)return;
 const t=add(a);
 const mode=$("promptMode");if(mode){mode.value="finance";mode.dispatchEvent(new Event("change",{bubbles:true}))}
 showPrompt(t);changeSection("library");$("promptBox")?.scrollIntoView({block:"center",behavior:"smooth"});
});
$("financeRefresh")?.addEventListener("click",load);
$("financeSearch")?.addEventListener("input",e=>{state.query=e.target.value.toLowerCase().trim();state.visible=6;render()});
$("financeCategory")?.addEventListener("change",e=>{state.filter=e.target.value;state.visible=6;render()});
$("financeRegion")?.addEventListener("change",e=>{state.region=e.target.value;state.visible=6;render()});
$("financeSort")?.addEventListener("change",e=>{state.sort=e.target.value;state.visible=6;render()});
$("financeMore")?.addEventListener("click",()=>{state.visible+=6;render()});
window.DAVYLABFinance={load,getItems:()=>state.items.slice(),getRankedItems:()=>filteredAndSorted().slice(),status:()=>({count:state.items.length,china:state.items.filter(a=>a.region==="中国").length,cached:state.cached,checked_at:state.snapshot?.checked_at||null})};
load();
})();