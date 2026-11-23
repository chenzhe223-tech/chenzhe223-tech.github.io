/* DAVYLAB Science Frontier P0 — metadata discovery, never a claim of scientific fact-check completion.
 * Sources: Crossref journal works (Nature 0028-0836; Science 0036-8075).
 * No full-text scraping, invented Chinese summaries, API secrets, or publication without approval.
 */
(function(){
"use strict";
const root=document.getElementById("scienceDiscovery");
if(!root)return;
const $=id=>root.querySelector("#"+id);
const SOURCE={
 nature:{name:"Nature",issn:"0028-0836"},
 science:{name:"Science",issn:"0036-8075"}
};
const SNAPSHOT="./data/science-discovery.json";
const CACHE="davylab-science-discovery-cache-v1";
const MAX_AGE=12*60*60*1000;
const st={items:[],checked:null,origin:"",sources:[],filter:"all",domain:"all",sort:"recent",query:"",visible:8,loading:false};
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validDoi=d=>/^10\.\d{4,9}\/\S+$/i.test(String(d||"").trim());
const clean=x=>String(x??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
const asDate=v=>{const n=Date.parse(String(v||""));return Number.isFinite(n)&&n<=Date.now()+86400000?new Date(n).toISOString().slice(0,10):""};
function issued(rec){
 const p=rec?.published?.["date-parts"]?.[0]||rec?.issued?.["date-parts"]?.[0]||rec?.["published-online"]?.["date-parts"]?.[0];
 if(!Array.isArray(p)||!Number.isInteger(p[0]))return "";
 return asDate(p[0]+"-"+String(p[1]||1).padStart(2,"0")+"-"+String(p[2]||1).padStart(2,"0"));
}
const fields=[
 ["life","生命医学",/cell|health|disease|protein|genom|medicine|immune|liver|brain|neuron|cancer|patient|virus|microbio|microplastic|biolog|clinical/i],
 ["ai","AI 与计算",/artificial intelligence|machine learning|neural network|language model|algorithm|computer|robot|computational|deep learning/i],
 ["earth","环境与地球",/climate|ocean|carbon|earth|environment|ecosystem|pollut|plastic|atmospher|wildlife|biodivers/i],
 ["space","物理与宇宙",/quantum|physics|galaxy|cosmolog|particle|stellar|black hole|astronom|astrophys|laser/i],
 ["material","材料与能源",/battery|solar|energy|material|polymer|semiconductor|catalys|electrode|hydrogen/i]
];
function classify(text){return fields.find(([, ,re])=>re.test(text))?.[0]||"other"}
function heuristic(title,summary,published){
 const days=Math.max(0,Math.floor((Date.now()-Date.parse(published))/86400000));
 const timely=Math.max(25,95-Math.floor(days/2));
 const readable=title.length<105?75:60;
 const value=summary?75:55;
 const newness=70;
 const visual=60;
 return Math.round(timely*.25+readable*.15+value*.30+newness*.20+visual*.10);
}
function normalize(rec,source){
 if(!rec||typeof rec!=="object"||!SOURCE[source])return null;
 const doi=String(rec.DOI||rec.doi||"").trim().toLowerCase();
 const title=clean(Array.isArray(rec.title)?rec.title[0]:rec.title).slice(0,240);
 const published=rec.published_at?asDate(rec.published_at):issued(rec);
 const journal=clean(Array.isArray(rec["container-title"])?rec["container-title"][0]:rec.journal||rec["container-title"]);
 if(!validDoi(doi)||!title||!published)return null;
 // A journal-record match establishes metadata provenance, NOT peer review or health effects.
 if(journal && journal.toLowerCase()!==SOURCE[source].name.toLowerCase())return null;
 const summary=clean(rec.abstract||rec.summary||"").slice(0,380);
 const domain=classify(title+" "+summary);
 const authors=Array.isArray(rec.author)?rec.author.slice(0,3).map(a=>clean((a.given||"")+" "+(a.family||""))).filter(Boolean).join("、"):clean(rec.authors||"").slice(0,160);
 return {id:doi,doi,title,source,journal:SOURCE[source].name,published,summary,authors,
  domain,priority:heuristic(title,summary,published),
  url:"https://doi.org/"+encodeURI(doi),verified:"metadata_only"};
}
function normalizeSnapshot(raw){
 if(!raw||raw.schema_version!==1||!Array.isArray(raw.articles))throw Error("数据结构不兼容");
 return raw.articles.map(x=>normalize({
  DOI:x.doi,title:x.title,published_at:x.published_at,journal:x.journal,
  abstract:x.abstract||x.summary,authors:x.authors
 },x.source)).filter(Boolean);
}
function unique(items){
 const map=new Map();
 for(const a of items){if(!a)continue;const old=map.get(a.doi);if(!old||a.summary.length>old.summary.length)map.set(a.doi,a)}
 return [...map.values()].sort((a,b)=>b.published.localeCompare(a.published)||a.doi.localeCompare(b.doi)).slice(0,180);
}
function sourceLabel(a){return a.source==="science"?"Science《科学》":"Nature《自然》"}
function status(txt){$("scienceStatus").textContent=txt}
function render(){
 let arr=st.items.filter(a=>(st.filter==="all"||st.filter===a.source)&&(st.domain==="all"||st.domain===a.domain));
 if(st.query){const q=st.query;arr=arr.filter(a=>(a.title+" "+a.summary+" "+a.doi+" "+a.authors).toLowerCase().includes(q))}
 if(st.sort==="score")arr.sort((a,b)=>b.priority-a.priority||b.published.localeCompare(a.published));
 else arr.sort((a,b)=>b.published.localeCompare(a.published)||b.priority-a.priority);
 $("scienceCount").textContent="已收录 "+st.items.length+" 篇 · 匹配 "+arr.length+" 篇";
 const cards=$("scienceList");
 if(!arr.length){
  cards.innerHTML='<div class="science-empty"><strong>当前暂无符合条件的论文</strong><p>请重试筛选或刷新。系统不会用虚构的研究填充结果。</p></div>';
 }else{
  cards.innerHTML=arr.slice(0,st.visible).map(a=>
   '<article class="science-card"><div class="science-meta"><span>'+esc(sourceLabel(a))+'</span><time>'+esc(a.published)+'</time><span>DOI 元数据匹配</span></div>'+
   '<h3>'+esc(a.title)+'</h3>'+
   '<p>'+esc(a.summary||"Crossref 未提供公开摘要：需打开论文核对研究目的、实验方法与局限。")+'</p>'+
   '<div class="science-footnote">研究设计 / 人体证据：待原文核验 · 编辑优先级：'+a.priority+'/100（规则估分，非论文质量评分）</div>'+
   '<div class="science-bottom"><code>'+esc(a.doi)+'</code><div><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">查看论文</a><button type="button" data-science-doi="'+esc(a.doi)+'">加入选题池</button></div></div></article>'
  ).join("");
 }
 $("scienceMore").hidden=arr.length<=st.visible;
 $("scienceMore").textContent="查看更多（剩余 "+Math.max(0,arr.length-st.visible)+" 篇）";
 const time=st.checked?new Date(st.checked).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"暂无";
 $("scienceUpdated").textContent="最近获取："+time+" · "+(st.origin==="live"?"Crossref 实时查询":st.origin==="snapshot"?"仓库每日快照":st.origin==="cache"?"本机缓存":"等待数据");
}
function remember(){
 try{localStorage.setItem(CACHE,JSON.stringify({at:Date.now(),items:st.items,checked:st.checked,sources:st.sources}))}catch{}
}
function fromCache(){
 try{
  const c=JSON.parse(localStorage.getItem(CACHE)||"null");
  if(!c||!Array.isArray(c.items)||Date.now()-c.at>7*86400000)return false;
  const items=unique(c.items.map(x=>normalize({DOI:x.doi,title:x.title,published_at:x.published,journal:x.journal,summary:x.summary,authors:x.authors},x.source)));
  if(!items.length)return false;
  st.items=items;st.checked=c.checked;st.sources=c.sources||[];st.origin="cache";
  status(Date.now()-c.at>MAX_AGE?"当前展示本机旧缓存，建议刷新":"显示本机缓存 · 科学结论仍需核验");
  render();return true;
 }catch{return false}
}
async function snapshot(){
 const resp=await fetch(SNAPSHOT+"?v="+new Date().toISOString().slice(0,10),{cache:"no-store"});
 if(!resp.ok)throw Error("快照 HTTP "+resp.status);
 const data=await resp.json(),items=unique(normalizeSnapshot(data));
 if(!items.length)throw Error("快照尚无可核验论文");
 st.items=unique([...items,...st.items]);st.checked=data.checked_at||null;st.origin="snapshot";st.sources=data.sources||[];
 status("已加载官方 DOI 元数据快照；研究结论尚未逐篇核查");
 remember();render();
}
async function crossref(source){
 const conf=SOURCE[source],start=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
 const u=new URL("https://api.crossref.org/journals/"+conf.issn+"/works");
 u.searchParams.set("filter","from-pub-date:"+start+",type:journal-article");
 u.searchParams.set("rows","60");u.searchParams.set("sort","published");u.searchParams.set("order","desc");
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),16000);
 try{
  const resp=await fetch(u.href,{signal:controller.signal,headers:{Accept:"application/json"}});
  if(!resp.ok)throw Error("HTTP "+resp.status);
  const data=await resp.json();
  return (data?.message?.items||[]).map(x=>normalize(x,source)).filter(Boolean);
 }finally{clearTimeout(timer)}
}
async function refresh(){
 if(st.loading)return;
 st.loading=true;$("scienceRefresh").disabled=true;status("正在向 Crossref 查询 Nature / Science 最新论文…");
 const parts=await Promise.allSettled([crossref("nature"),crossref("science")]);
 const good=parts.flatMap(x=>x.status==="fulfilled"?x.value:[]);
 if(good.length){
  st.items=unique([...good,...st.items]);st.checked=new Date().toISOString();st.origin="live";
  st.sources=parts.map((x,i)=>({name:i?"Science":"Nature",status:x.status==="fulfilled"?"ok":"error"}));
  const failures=parts.filter(x=>x.status==="rejected").length;
  status("本次查到 "+good.length+" 条论文元数据"+(failures?" · "+failures+" 个来源失败，已保留旧数据":"")+"；尚未核查研究结论");
  remember();
 }else status(st.items.length?"实时查询失败，继续显示最近可信来源元数据":"无法获得论文数据。请检查网络或等待数据快照；没有填充虚构论文");
 st.loading=false;$("scienceRefresh").disabled=false;render();
}
function addToPool(doi){
 const a=st.items.find(x=>x.doi===doi);if(!a)return;
 if(typeof topics==="undefined"||typeof saveTopics!=="function"){status("选题池尚未就绪，请重试");return}
 if(topics.some(t=>String(t.sourceDOI||"").toLowerCase()===doi||t.sourceUrl===a.url)){if(typeof toast==="function")toast("论文已在选题池");return}
 const t={id:uid(),title:a.title,angle:"先核验原始论文的研究问题、方法、样本、结论与适用边界，再确定中文科普角度。",
  summary:a.summary||"公开元数据无摘要，必须阅读原始论文后才能撰写科学结论。",
  sourceTitle:a.title,sourceName:a.journal,sourceUrl:a.url,sourceDOI:a.doi,sourcePublishedAt:a.published,
  sourceKind:"scholarly_metadata",origin:"science",column:"科学前沿 · Nature × Science",format:"文章",productionMode:"planning",
  factCheckStatus:"仅论文元数据匹配，内容未核验",status:"inbox",plannedDate:"",createdAt:new Date().toISOString(),
  scores:{reader:3,timely:4,practical:3,distinct:3,brand:4},
  specialRequirements:"严格以 DOI "+a.doi+" 的原始论文为依据。必须先阅读全文或公开可获取的研究摘要；区分人类临床、动物、体外、计算和综述；核实样本量、对照组、研究限制及论文是否撤稿。不得将动物发现直接写成人体事实；未读到全文必须标明。科普为独立意译，引用标注原始 DOI 和许可；AI 辅助声明。仅生成 draft，作者批准后才允许推公众号草稿，不得自动发表。"};
 topics.unshift(t);saveTopics();
 if(typeof toast==="function")toast("已收进科学选题池 · 待论文核验");
 const select=document.getElementById("promptMode");
 if(select){select.value="planning";select.dispatchEvent(new Event("change",{bubbles:true}))}
 if(typeof showPrompt==="function")showPrompt(t);
 if(typeof changeSection==="function")changeSection("library");
 document.getElementById("promptBox")?.scrollIntoView({block:"center",behavior:"smooth"});
}
root.innerHTML=
 '<div class="science-head"><div><span class="science-kicker">SCIENCE FRONTIER · DAVYLAB</span><h2 id="scienceTitle">科学前沿｜Nature × Science</h2><p>直接发现官方登记的真实 DOI 论文；核验研究类型与科学结论后，再转成原创科普。</p></div><button type="button" class="btn small" id="scienceRefresh">刷新论文</button></div>'+
 '<div class="science-status"><span id="scienceStatus" role="status">初始化论文索引…</span><strong id="scienceCount">已收录 0 篇</strong></div>'+
 '<div class="science-tools"><input id="scienceSearch" type="search" placeholder="搜索论文标题、DOI、作者" aria-label="搜索科学论文"><select id="scienceSource" aria-label="选择期刊"><option value="all">全部期刊</option><option value="nature">Nature</option><option value="science">Science</option></select><select id="scienceDomain" aria-label="选择研究领域"><option value="all">全部领域</option><option value="life">生命与医学</option><option value="ai">AI 与计算</option><option value="earth">环境与地球</option><option value="space">物理与宇宙</option><option value="material">材料与能源</option><option value="other">交叉学科</option></select><select id="scienceSort" aria-label="论文排序"><option value="recent">最新发表</option><option value="score">编辑优先级</option></select></div>'+
 '<div class="science-note">DOI、期刊和日期来自 Crossref 元数据。<b>查到论文 ≠ 确认科学结论。</b>摘要可能缺失；临床证据、统计显著性、论文类型及撤稿状态均须逐篇核查。优先级仅为透明的编辑规则评分。</div>'+
 '<div id="scienceList" class="science-grid" aria-live="polite"></div><div class="science-footer"><button type="button" id="scienceMore" hidden>查看更多</button><p>只引用公开论文元数据，不抓取或转载付费全文；选题默认 draft，未经 DAVYLAB 批准不发布。<span id="scienceUpdated"></span></p></div>';
$("scienceSource").addEventListener("change",e=>{st.filter=e.target.value;st.visible=8;render()});
$("scienceDomain").addEventListener("change",e=>{st.domain=e.target.value;st.visible=8;render()});
$("scienceSort").addEventListener("change",e=>{st.sort=e.target.value;render()});
$("scienceSearch").addEventListener("input",e=>{st.query=e.target.value.toLowerCase().trim();st.visible=8;render()});
$("scienceMore").addEventListener("click",()=>{st.visible+=8;render()});
$("scienceRefresh").addEventListener("click",refresh);
root.addEventListener("click",e=>{const button=e.target.closest?.("button[data-science-doi]");if(button)addToPool(button.dataset.scienceDoi)});
window.DAVYLABScience={refresh,getItems:()=>st.items.slice(),getStatus:()=>({count:st.items.length,origin:st.origin,checked:st.checked})};
const hadCache=fromCache();
snapshot().catch(()=>{if(!hadCache)refresh();else status("目前使用本机缓存，快照暂不可用；可点击刷新")});
})();
