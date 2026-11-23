/* DAVYLAB Science Frontier P0 — metadata discovery, never a claim of scientific fact-check completion.
 * Sources: Crossref journal works (Nature 0028-0836; Science 0036-8075).
 * No full-text scraping, invented Chinese summaries, API secrets, or publication without approval.
 */
(function(){
"use strict";
const root=document.getElementById("scienceDiscovery");
if(!root)return;
const $=id=>root.querySelector("#"+id);
const Search=window.DAVYLABScienceSearch;
if(!Search){console.error("DAVYLABScienceSearch helper not loaded");return;}
const SOURCE={
 nature:{name:"Nature",issn:"0028-0836"},
 science:{name:"Science",issn:"0036-8075"}
};
const SNAPSHOT="./data/science-discovery.json";
const CACHE="davylab-science-discovery-cache-v1";
const MAX_AGE=12*60*60*1000;
const st={items:[],checked:null,origin:"",sources:[],filter:"all",domain:"all",sort:"recent",query:"",visible:8,loading:false,onlineItems:[],onlineQuery:"",onlineLoading:false,scope:"local",searchSerial:0};
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
 // Journal article metadata can also describe news, editorials and corrections.
 // Keep likely original research only; precise publication type still requires manual verification.
 const summary=clean(rec.abstract||rec.summary||"").slice(0,380);
 if(/^(?:author correction|publisher correction|correction|retraction|retracted|addendum|editorial|in science journals)\b/i.test(title))return null;
 if(source==="nature"&&!doi.startsWith("10.1038/s41586-"))return null;
 if(source==="science"&&(!doi.startsWith("10.1126/science.")||(summary.length<280&&rec.research_candidate!==true)))return null;
 const domain=fields.some(([key])=>key===rec.domain)?rec.domain:classify(title+" "+summary);
 const authors=Array.isArray(rec.author)?rec.author.slice(0,3).map(a=>clean((a.given||"")+" "+(a.family||""))).filter(Boolean).join("、"):clean(rec.authors||"").slice(0,160);
 return {id:doi,doi,title,source,journal:SOURCE[source].name,published,summary,authors,
  domain,priority:heuristic(title,summary,published),
  url:"https://doi.org/"+encodeURI(doi),verified:"metadata_only"};
}
function normalizeSnapshot(raw){
 if(!raw||raw.schema_version!==1||!Array.isArray(raw.articles))throw Error("数据结构不兼容");
 return raw.articles.map(x=>normalize({
  DOI:x.doi,title:x.title,published_at:x.published_at,journal:x.journal,
  abstract:x.abstract||x.summary,authors:x.authors,domain:x.domain,research_candidate:x.research_candidate
 },x.source)).filter(Boolean);
}
function unique(items){
 const map=new Map();
 for(const a of items){if(!a)continue;const old=map.get(a.doi);if(!old||a.summary.length>old.summary.length)map.set(a.doi,a)}
 return [...map.values()].sort((a,b)=>b.published.localeCompare(a.published)||a.doi.localeCompare(b.doi)).slice(0,180);
}
function sourceLabel(a){return a.source==="science"?"Science《科学》":"Nature《自然》"}
function status(txt){$("scienceStatus").textContent=txt}
function searchedItems(){
 const isOnline=st.scope==="online",base=isOnline&&st.onlineQuery===st.query?st.onlineItems:(!isOnline?st.items:[]);
 let arr=base.filter(a=>(st.filter==="all"||st.filter===a.source)&&(st.domain==="all"||st.domain===a.domain));
 if(st.query)arr=arr.map(a=>({a,match:Search.matchScore(a,st.query)})).filter(x=>x.match>0).sort((x,y)=>y.match-x.match).map(x=>x.a);
 if(st.sort==="score")arr.sort((a,b)=>(st.query?Search.matchScore(b,st.query)-Search.matchScore(a,st.query):0)||b.priority-a.priority||b.published.localeCompare(a.published));
 else if(!st.query)arr.sort((a,b)=>b.published.localeCompare(a.published)||b.priority-a.priority);
 return arr;
}
function render(){
 const arr=searchedItems(),scopeName=st.scope==="online"?"在线历史检索":"已采集快照";
 $("scienceCount").textContent="已采集 "+st.items.length+" 篇 · 在线结果 "+st.onlineItems.length+" 篇 · "+scopeName+"匹配 "+arr.length+" 篇";
 const cards=$("scienceList");
 if(!arr.length){
  cards.innerHTML='<div class="science-empty"><strong>'+(st.query?"当前范围未找到相关论文":"当前暂无符合条件的论文")+'</strong><p>'+(st.scope==="local"&&st.query?"已采集范围有限，可点击「在线搜索历史论文」查找更多年份。":st.scope==="online"?"可尝试更宽泛的英文关键词，或切换回「已采集」。":"请调整筛选条件。系统不会以虚构研究填充结果。")+'</p></div>';
 }else{
  cards.innerHTML=arr.slice(0,st.visible).map(a=>
   '<article class="science-card"><div class="science-meta"><span>'+esc(sourceLabel(a))+'</span><time>'+esc(a.published)+'</time><span>'+(st.scope==="online"?"Crossref 在线 DOI":"已采集 DOI 元数据")+'</span></div>'+
   '<h3>'+esc(a.title)+'</h3>'+
   '<p>'+esc(a.summary||"仅展示元数据。原文摘要、研究方法、样本和局限需要打开论文核查。")+'</p>'+
   '<div class="science-footnote">研究类型及有效性：待原文核验 · 编辑优先级 '+a.priority+'/100（非科学质量评分）</div>'+
   '<div class="science-bottom"><code>'+esc(a.doi)+'</code><div><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">查看论文</a><button type="button" data-science-doi="'+esc(a.doi)+'">加入选题池</button></div></div></article>'
  ).join("");
 }
 $("scienceMore").hidden=arr.length<=st.visible;
 $("scienceMore").textContent="查看更多（剩余 "+Math.max(0,arr.length-st.visible)+" 篇）";
 $("scienceClear").hidden=!st.query&&!st.onlineItems.length;
 const trans=Search.translate(st.query);
 $("scienceSearchHint").textContent=!st.query?"支持中文与英文关键词、DOI；模糊匹配已采集论文。在线检索会查询 Nature / Science 的历史 DOI 元数据。":
  trans.unknownChinese?"部分中文词暂不在术语映射表内，请补充英文关键词以提高在线检索准确性。":
  trans.translated!==trans.query?"搜索词映射："+trans.translated+" · 词语映射仅供检索，不代表自动译文已核验。":"支持英文关键词模糊匹配；按回车在线检索历史论文。";
 const time=st.checked?new Date(st.checked).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit"}):"暂无";
 $("scienceUpdated").textContent="最近采集："+time+" · "+(st.origin==="live"?"Crossref 更新":st.origin==="snapshot"?"仓库快照":st.origin==="cache"?"本机缓存":"等待数据")+"；在线搜索不自动写入快照。";
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

async function searchOnline(){
 const original=st.query.trim(),term=Search.onlineTerm(original);
 if(!original){status("请先输入论文关键词、作者或 DOI");return}
 if(!term){status("未能将该中文词映射到学术检索词。请使用对应英文关键词或 DOI 重试");return}
 if(st.onlineLoading)return;
 const serial=++st.searchSerial;
 st.onlineLoading=true;$("scienceOnline").disabled=true;
 status("正在检索 Nature 与 Science 的历史论文 DOI（不仅限于已采集数据）…");
 const lookup=async source=>{
  const u=new URL("https://api.crossref.org/journals/"+SOURCE[source].issn+"/works");
  u.searchParams.set("query.bibliographic",term);
  u.searchParams.set("filter","type:journal-article");
  u.searchParams.set("rows","45");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetch(u.href,{signal:controller.signal,headers:{Accept:"application/json"}});
   if(!response.ok)throw Error("Crossref HTTP "+response.status);
   const result=await response.json();
   const records=Array.isArray(result?.message?.items)?result.message.items:[];
   return records.map(rec=>{
    const candidates=normalize(rec,source);
    if(!candidates)return null;
    const relevance=Search.matchScore({title:candidates.title,summary:clean(rec.abstract||"").slice(0,1800),doi:candidates.doi,authors:candidates.authors},original);
    if(relevance<=0)return null;
    return {...candidates,summary:"",relevance};
   }).filter(Boolean);
  }finally{clearTimeout(timer)}
 };
 const queries=await Promise.allSettled([lookup("nature"),lookup("science")]);
 if(serial!==st.searchSerial)return;
 const candidates=queries.flatMap(x=>x.status==="fulfilled"?x.value:[]),fail=queries.filter(x=>x.status==="rejected").length;
 const dedup=new Map();
 for(const a of candidates){const b=dedup.get(a.doi);if(!b||a.relevance>b.relevance)dedup.set(a.doi,a)}
 st.onlineItems=[...dedup.values()].sort((a,b)=>b.relevance-a.relevance||b.published.localeCompare(a.published));
 st.onlineQuery=original;st.scope="online";st.visible=8;$("scienceScope").value="online";
 st.onlineLoading=false;$("scienceOnline").disabled=false;
 status(st.onlineItems.length?"在线检索找到 "+st.onlineItems.length+" 篇相关 DOI 论文"+(fail?"；有 "+fail+" 个期刊查询失败":"")+"，内容仍需逐篇核查":
  fail===2?"两本期刊的在线查询都失败，已采集论文仍可正常使用":"在线检索没有可确认的研究候选；可换英文关键词或调整范围");
 render();
}

function addToPool(doi){
 const a=[...st.items,...st.onlineItems].find(x=>x.doi===doi);if(!a)return;
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
 '<form class="science-search-bar" id="scienceSearchForm" role="search"><input id="scienceSearch" type="search" autocomplete="off" maxlength="180" placeholder="输入微塑料、肝脏、AI、microplastic 或 DOI…" aria-label="搜索科学研究"><button class="science-search-submit" id="scienceOnline" type="submit">在线搜索历史论文</button><button class="science-search-clear" id="scienceClear" type="button" hidden>清除</button></form>'+
 '<div class="science-search-hint" id="scienceSearchHint">支持中文、英文与 DOI 模糊搜索；在线搜索不受已采集列表限制。</div>'+
 '<div class="science-tools"><select id="scienceScope" aria-label="数据搜索范围"><option value="local">已采集论文</option><option value="online">在线检索结果</option></select><select id="scienceSource" aria-label="选择期刊"><option value="all">全部期刊</option><option value="nature">Nature</option><option value="science">Science</option></select><select id="scienceDomain" aria-label="选择研究领域"><option value="all">全部领域</option><option value="life">生命与医学</option><option value="ai">AI 与计算</option><option value="earth">环境与地球</option><option value="space">物理与宇宙</option><option value="material">材料与能源</option><option value="other">交叉学科</option></select><select id="scienceSort" aria-label="论文排序"><option value="recent">最新发表</option><option value="score">编辑优先级</option></select></div>'+
 '<div class="science-note">DOI、期刊和日期来自 Crossref 元数据。<b>查到论文 ≠ 确认科学结论。</b>摘要可能缺失；临床证据、统计显著性、论文类型及撤稿状态均须逐篇核查。优先级仅为透明的编辑规则评分。</div>'+
 '<div id="scienceList" class="science-grid" aria-live="polite"></div><div class="science-footer"><button type="button" id="scienceMore" hidden>查看更多</button><p>只引用公开论文元数据，不抓取或转载付费全文；选题默认 draft，未经 DAVYLAB 批准不发布。<span id="scienceUpdated"></span></p></div>';
$("scienceSource").addEventListener("change",e=>{st.filter=e.target.value;st.visible=8;render()});
$("scienceDomain").addEventListener("change",e=>{st.domain=e.target.value;st.visible=8;render()});
$("scienceSort").addEventListener("change",e=>{st.sort=e.target.value;render()});
$("scienceSearch").addEventListener("input",e=>{const next=e.target.value.trim();if(next!==st.query){st.searchSerial++;st.onlineLoading=false;$("scienceOnline").disabled=false;}st.query=next;st.visible=8;if(st.onlineQuery!==st.query){st.scope="local";st.onlineItems=[];st.onlineQuery="";$("scienceScope").value="local";}render()});
$("scienceSearchForm").addEventListener("submit",e=>{e.preventDefault();searchOnline()});
$("scienceScope").addEventListener("change",e=>{st.scope=e.target.value;st.visible=8;render()});
$("scienceClear").addEventListener("click",()=>{st.searchSerial++;st.onlineLoading=false;$("scienceOnline").disabled=false;st.query="";st.onlineQuery="";st.onlineItems=[];st.scope="local";st.visible=8;$("scienceSearch").value="";$("scienceScope").value="local";render();status("已清空搜索条件，显示采集论文。")});
$("scienceMore").addEventListener("click",()=>{st.visible+=8;render()});
$("scienceRefresh").addEventListener("click",refresh);
root.addEventListener("click",e=>{const button=e.target.closest?.("button[data-science-doi]");if(button)addToPool(button.dataset.scienceDoi)});
window.DAVYLABScience={refresh,searchOnline,getItems:()=>st.items.slice(),getOnlineItems:()=>st.onlineItems.slice(),getStatus:()=>({count:st.items.length,online:st.onlineItems.length,scope:st.scope,origin:st.origin,checked:st.checked})};
// Shareable deep-link QA: ?scienceQuery=微塑料&scienceOnline=1#scienceTitle
const params=new URLSearchParams(window.location.search);
const initialQuery=String(params.get("scienceQuery")||"").slice(0,180).trim();
if(initialQuery){
 st.query=initialQuery;$("scienceSearch").value=initialQuery;
 window.DAVYLABEditorialWorkspace?.setSource?.("science",false);
 render();
}
const hadCache=fromCache();
const initialized=snapshot().catch(()=>{if(!hadCache)return refresh();status("目前使用本机缓存，快照暂不可用；可点击刷新")});
if(initialQuery&&params.get("scienceOnline")==="1")initialized.finally(()=>searchOnline());
})();
