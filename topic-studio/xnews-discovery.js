/* DAVYLAB Topic Studio · XNews editorial discovery
 * Public, attributed metadata only. Does not copy articles, scrape X, or auto-publish.
 * XNews snapshot comes from a same-origin, scheduled public GitHub Actions job.
 */
(function () {
"use strict";
const root=document.getElementById("xnewsDiscovery");
if(!root || typeof getFeed!=="function" || typeof addFeed!=="function")return;
const SNAPSHOT="./data/xnews-discovery.json",CACHE="davylab-xnews-last-good-v1";
const $x=id=>document.getElementById(id);
const lenses={
 all:"全部主题",agents:"Agent / 自动化",models:"模型与研究",products:"工具与产品",
 business:"商业与市场",creative:"创作与设计",safety:"安全与治理"
};
const state={all:[],filter:"all",query:"",sort:"relevance",visible:6,loaded:false,error:"",meta:null,cached:false};
const html=v=>typeof safe==="function"?safe(v):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const url=v=>{try{const parsed=new URL(String(v||""));if(!["https:","http:"].includes(parsed.protocol))return"#";if(!parsed.hostname||parsed.username||parsed.password)return"#";return parsed.href}catch{return"#"}};
const canonical=v=>url(v).split("#")[0].replace(/\/$/,"").toLowerCase();
const keyTitle=v=>String(v||"").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/gi,"").slice(0,70);
function daysFrom(date){
 if(!/^\d{4}-\d\d-\d\d$/.test(String(date||"")))return 999;
 const n=Date.parse(date+"T00:00:00+08:00");
 return Number.isFinite(n)?Math.max(0,(Date.now()-n)/86400000):999;
}
function lensOf(a){
 const s=[a.title,a.summary,(a.tags||[]).join(" ")].join(" ").toLowerCase();
 if(/agent|智能体|自动化|workflow|multi.agent|多智能体|orchestrat|mcp|自主执行/.test(s))return"agents";
 if(/安全|风险|红队|privacy|safety|security|attack|alignment|安全性|治理|监管/.test(s))return"safety";
 if(/融资|营收|企业经营|创业|创始人|估值|revenue|founder|business|market|商业模式|融资|投资/.test(s))return"business";
 if(/视频|图像|生图|设计|影视|music|video|creative|创作|3d|视觉/.test(s))return"creative";
 if(/gemini|gpt|claude|模型|benchmark|评测|推理|reasoning|研究|paper|算法|token|research/.test(s))return"models";
 if(/产品|应用|工具|coding|开发|代码|app|product|software|release|api|skill/.test(s))return"products";
 return"products";
}
function categoryOf(a){const l=lensOf(a);return l==="agents"||l==="products"?"AI 实战手记":l==="business"?"AI 创造机会雷达":l==="safety"?"产品复盘与实验室":"普通人的 AI 创造力"}
function editorialAngle(a){
 const l=lensOf(a);
 if(l==="agents")return"这些智能体实践能替普通人完成哪一环？原始能力、使用门槛和人工复核边界是什么？";
 if(l==="models")return"这项模型或研究结果对普通人实际有什么意义？优先核对评测条件、适用范围和发布日期。";
 if(l==="business")return"这条商业信号背后有什么真实需求？哪些结论有数据支持，哪些仍只是预测？";
 if(l==="creative")return"这项创作技术的体验与版权边界如何？尝试将概念转化为一个可操作示例。";
 if(l==="safety")return"普通 AI 使用者需要注意什么？核对风险描述与适用条件，给出可执行的防范动作。";
 return"这个工具或产品解决了什么实际问题？如何验证它真实可用，而不只是展示好看？";
}
function internalScore(a){
 const d=daysFrom(a.date),fresh=d<=2?32:d<=7?23:d<=14?14:d<=30?6:0;
 const s=[a.title,a.summary,(a.tags||[]).join(" ")].join(" ").toLowerCase();
 const practical=/如何|指南|step|教程|实际|上手|实操|产品|工具|应用|agent|skill|workflow|效率|工作|开发/.test(s)?20:7;
 const accessible=/研究|理论|framework|benchmark|复杂评测|推理引擎|架构|compiler/.test(s)?5:13;
 const trace=(url(a.original_url)!=="#"?10:0)+(url(a.xnews_url)!=="#"?5:0)+(a.date?5:0);
 const category=Array.isArray(a.tags)&&a.tags.length?7:2;
 return Math.min(100,fresh+practical+accessible+trace+category+5);
}
function normalize(item){
 if(!item||typeof item!=="object")return null;
 const id=String(item.id||"").trim(),title=String(item.title||"").trim();
 if(!/^[a-z0-9][a-z0-9-]{0,100}$/.test(id)||title.length<3)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||"")))return null;
 const sourceUrl=url(item.original_url),chineseUrl=url(item.xnews_url);
 if(sourceUrl==="#"||chineseUrl==="#"||!chineseUrl.startsWith("https://xnews.qiaomu.ai/a/"))return null;
 const out={
 id,title:title.slice(0,150),summary:String(item.summary||"").slice(0,240),
 date:String(item.date),original_url:sourceUrl,xnews_url:chineseUrl,
 tags:Array.isArray(item.tags)?item.tags.map(t=>String(t).slice(0,32)).slice(0,8):[]
 };
 out.lens=lensOf(out);out.priority=internalScore(out);out.angle=editorialAngle(out);
 return out;
}
function ingest(data,cached){
 if(!data||data.schema_version!==1||!Array.isArray(data.articles)||!data.articles.length)throw Error("索引数据结构异常");
 const seen=new Set(),normalized=[];
 for(const raw of data.articles){const a=normalize(raw);if(!a)continue;const key=canonical(a.original_url);if(seen.has(key))continue;seen.add(key);normalized.push(a)}
 if(!normalized.length)throw Error("来源数据没有有效条目");
 state.all=normalized;state.meta=data;state.loaded=true;state.cached=cached;
 return normalized;
}
function toFeed(x){
 return {
   type:"news",origin:"xnews",title:x.title,summary:x.summary,source:"XNews · 向阳乔木（海外精选）",
   url:x.original_url,sourcePageUrl:x.xnews_url,published:x.date,
   category:categoryOf(x),angle:x.angle,why:"编辑辅助线索；以原文核验为准。",
   xnewsUrl:x.xnews_url,imageUrl:"",imageFallbackUrl:"",imageCredit:"",imageAlt:""
 };
}
function combinedFeed(){
 const original=baseGetFeed(),seen=new Set(),out=[];
 for(const item of original){const k=canonical(item.url);if(k==="#"||seen.has(k))continue;seen.add(k);out.push(item)}
 for(const item of state.all.map(toFeed)){const k=canonical(item.url);if(seen.has(k))continue;seen.add(k);out.push(item)}
 return out;
}
const baseGetFeed=getFeed;
getFeed=combinedFeed;
const baseAddFeed=addFeed;
addFeed=function(item){
 if(!item || item.origin!=="xnews")return baseAddFeed(item);
 const sourceUrl=item.url;
 if(topics.some(t=>canonical(t.sourceUrl)===canonical(sourceUrl)||keyTitle(t.sourceTitle)===keyTitle(item.title))){
   toast("这条来源或同题选题已在选题池中");return;
 }
 if(item.requestedFormat==="贴图"){
   topics.unshift({
     id:uid(),title:"一张图看懂："+String(item.title||"海外 AI 观点").slice(0,70),
     angle:"以 XNews 发现的公开观点为线索，一图解释关键概念和现实意义；所有数字、人物与原始观点须回到原文核验。",
     summary:item.summary||"",sourceTitle:item.title||"",sourceUrl:item.url,
     sourcePageUrl:item.xnewsUrl||item.sourcePageUrl||"",
     sourceName:"XNews · 向阳乔木",sourcePublishedAt:item.published||"",
     factCheckStatus:"待核实",origin:"xnews",format:"贴图",
     status:"inbox",plannedDate:"",createdAt:new Date().toISOString(),
     scores:{reader:3,timely:3,practical:3,distinct:3,brand:4}
   });
   saveTopics();
   toast("已加入贴图选题，等待核实与制作");
   return;
 }
 const before=topics.length;
 baseAddFeed(item);
 if(topics.length>before){
   const t=topics[0];
   t.origin="xnews";t.sourceName="XNews · 向阳乔木";t.sourcePageUrl=item.xnewsUrl||item.sourcePageUrl||"";
   t.factCheckStatus="待核实";t.sourcePublishedAt=item.published||"";
   saveTopics();
 }
};
const baseShowPrompt=showPrompt;
showPrompt=function(t){
 baseShowPrompt(t);
 const bilingual=t?.sourcePageUrl||t?.xnewsUrl;
 if(bilingual && $x("promptBox")){
  $x("promptBox").value+="\n\n【XNews 中文阅读】"+bilingual+
   "\n【来源核验约束】XNews 仅作为发现线索和中文阅读参考；全文创作必须重新查阅原始出处并区分原作者事实、译写和 DAVYLAB 自己的分析。不得复制他人长段落或将未核实数字写成定论。";
 }
};
function inPool(a){return topics.some(t=>canonical(t.sourceUrl)===canonical(a.original_url)||keyTitle(t.sourceTitle)===keyTitle(a.title))}
function render(){
 const list=$x("xnewsList"),count=$x("xnewsCount"),status=$x("xnewsStatus"),more=$x("xnewsMore"),date=$x("xnewsUpdated");
 if(!list)return;
 const q=state.query.trim().toLowerCase();
 let items=state.all.filter(a=>(state.filter==="all"||a.lens===state.filter)&&(!q||[a.title,a.summary,(a.tags||[]).join(" ")].join(" ").toLowerCase().includes(q)));
 if(state.sort==="newest")items.sort((a,b)=>b.date.localeCompare(a.date)||b.priority-a.priority);
 else items.sort((a,b)=>b.priority-a.priority||b.date.localeCompare(a.date));
 count.textContent=state.loaded?"匹配 "+items.length+" / "+state.all.length+" 条":"等待数据";
 if(!state.loaded){list.innerHTML='<div class="xnews-empty"><strong>海外精选暂未连接</strong><p>'+html(state.error||"正在读取本地内容镜像…")+'</p><a href="https://xnews.qiaomu.ai/" target="_blank" rel="noopener noreferrer">打开 XNews 阅读站</a></div>';more.hidden=true;return}
 if(!items.length){list.innerHTML='<div class="xnews-empty"><strong>没有找到相关线索</strong><p>可以切换主题或搜索词；AI Radar 的素材不会受到影响。</p></div>';more.hidden=true;return}
 const visible=items.slice(0,state.visible);
 list.innerHTML=visible.map(a=>'<article class="xnews-card">'+
 '<div class="xnews-card-meta"><span class="xnews-lens">'+html(lenses[a.lens]||"海外精选")+'</span><span>'+html(a.date)+' · '+html(daysFrom(a.date)<=7?"近 7 天":"历史收录")+'</span></div>'+
 '<h3>'+html(a.title)+'</h3><p class="xnews-summary">'+html(a.summary||"请打开中文阅读与原始出处核实详情。")+'</p>'+
 '<p class="xnews-angle"><span>建议切入</span>'+html(a.angle)+'</p>'+
 '<div class="xnews-card-footer"><span class="xnews-editorial" title="只根据时效、可读性、原始出处、主题等计算，不是真实流量或热度">编辑优先级 '+a.priority+'/100</span>'+
 '<div class="xnews-actions">'+
 '<a href="'+html(a.xnews_url)+'" target="_blank" rel="noopener noreferrer">中文阅读</a>'+
 '<a href="'+html(a.original_url)+'" target="_blank" rel="noopener noreferrer">原文</a>'+
 '<button type="button" data-x-prompt="'+html(a.id)+'">创作指令</button>'+
 '<button type="button" class="xnews-add" data-x-add="'+html(a.id)+'"'+(inPool(a)?" disabled":"")+'>'+(inPool(a)?"已入池":"加入文章选题")+'</button>'+
 '<button type="button" data-x-poster="'+html(a.id)+'"'+(inPool(a)?" disabled":"")+'>转贴图选题</button></div></div></article>').join("");
 more.hidden=items.length<=state.visible;
 more.textContent="查看剩余 "+Math.max(0,items.length-state.visible)+" 条";
 const synced=state.meta?.synced_at;
 date.textContent="数据镜像 "+(synced?new Date(synced).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"时间未知")+
 (state.cached?" · 本机历史缓存":" · 同源静态快照");
 status.textContent=state.cached?"XNews 同源快照读取失败，展示本机上一次有效数据":"XNews · 海外创始人观点 / 长帖 / AI 视频";
}
function refreshMerged(){
 if(typeof radarData!=="undefined" && radarData)feedCache=getFeed();
 else if(state.all.length)feedCache=getFeed(); // useful even if AI Radar is unavailable
 if(typeof renderFeed==="function" && typeof radarData!=="undefined" && radarData)renderFeed();
 window.renderOpportunityRadar?.();
 render();
}
async function load(noCache=false){
 state.error="";$x("xnewsStatus").textContent="正在读取 XNews 索引…";
 try{
  const res=await fetch(SNAPSHOT+"?t="+(noCache?Date.now():"v1"),{cache:noCache?"no-store":"default"});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json();ingest(data,false);
  try{localStorage.setItem(CACHE,JSON.stringify(data))}catch{}
 }catch(err){
  state.error="XNews 数据暂时不可用（"+String(err.message||err)+"）。";
  try{const last=JSON.parse(localStorage.getItem(CACHE)||"null");ingest(last,true)}catch{state.loaded=false;state.all=[]}
 }
 refreshMerged();
}
root.addEventListener("click",e=>{
 const btn=e.target.closest("button");if(!btn)return;
 const action=btn.dataset.xPoster?"poster":btn.dataset.xAdd?"add":btn.dataset.xPrompt?"prompt":null;
 if(!action)return;
 const id=btn.dataset.xPoster||btn.dataset.xAdd||btn.dataset.xPrompt,a=state.all.find(x=>x.id===id);if(!a)return;
 const entry=toFeed(a);
 if(action==="poster"){entry.requestedFormat="贴图";addFeed(entry);render();return}
 if(action==="add"){addFeed(entry);render();return}
 showPrompt(entry);changeSection("library");$x("promptBox")?.scrollIntoView({behavior:"smooth",block:"center"});
 if(typeof toast==="function")toast("已生成创作指令；请核验原文");
});
root.querySelectorAll("[data-x-lens]").forEach(b=>b.addEventListener("click",()=>{
 state.filter=b.dataset.xLens;state.visible=6;
 root.querySelectorAll("[data-x-lens]").forEach(x=>{x.classList.toggle("active",x===b);x.setAttribute("aria-pressed",String(x===b))});
 render();
}));
$x("xnewsSearch")?.addEventListener("input",e=>{state.query=e.target.value;state.visible=6;render()});
$x("xnewsSort")?.addEventListener("change",e=>{state.sort=e.target.value;render()});
$x("xnewsMore")?.addEventListener("click",()=>{state.visible+=6;render()});
$x("xnewsRefresh")?.addEventListener("click",()=>load(true));
const baseSaveTopics=saveTopics;
saveTopics=function(){baseSaveTopics();if(state.loaded)render()};
window.DAVYLABXNews={source:SNAPSHOT,load,rank:internalScore,lensOf,normalize,getItems:()=>state.all.slice(),status:()=>({count:state.all.length,cached:state.cached,loaded:state.loaded})};
load();
})();