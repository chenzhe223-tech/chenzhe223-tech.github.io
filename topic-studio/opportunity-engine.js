/* DAVYLAB Topic Studio · editorial opportunities engine (no fabricated popularity metrics) */
(function () {
"use strict";
const $op = id => document.getElementById(id);
const root = $op("opportunityList");
if (!root) return;
const KEY = "davylab-discover-preferences-v1";
const lensNames = {all:"全部方向",agents:"Agent / 自动化",products:"工具与实战",models:"模型与研究",business:"商业与行业",creative:"内容与创作",safety:"安全与治理"};
let stored = {};
try { stored = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) {}
const state = {lens:lensNames[stored.lens]?stored.lens:"all",goal:"growth",q:"",limit:6};
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function url(v){try{const u=new URL(String(v||""),location.href);return ["http:","https:"].includes(u.protocol)?u.href:"#";}catch(_){return "#";}}
function note(){try{localStorage.setItem(KEY,JSON.stringify({lens:state.lens}));}catch(_){}}
function items(){return typeof feedCache!=="undefined" && Array.isArray(feedCache) ? feedCache : [];}
function theme(x){if(typeof radarTheme==="function")return radarTheme(x);return"other";}
function days(x){if(!x.published)return 999;const n=Date.parse(x.published);return Number.isFinite(n)?Math.max(0,(Date.now()-n)/86400000):999;}
function relevance(x){const s=[x.title,x.summary,x.why,x.angle].join(" ").toLowerCase();
let v=0;if(/普通人|初学|入门|小白|beginner|guide|tutorial|实践|实战|how to|一步步/.test(s))v+=9;
if(/agent|智能体|自动化|skill|workflow|coding|工具|应用|部署|app|open source|开源/.test(s))v+=10;
if(/免费|效率|工作|案例|方法|生产力|企业|行业|实践|实用|workflow|效率/.test(s))v+=8;
return Math.min(25,v);}
function readerFit(x){
const s=[x.title,x.summary,x.why,x.angle].join(" ").toLowerCase();
let v=0;
if(/普通人|非程序员|生活|工作日|厨房|烘焙|鸡肉|蛋糕|食谱|家庭|学习|写作|办公|采购|设计|视频|图片|动图|gif|效率|上手|入门|小白/.test(s))v+=13;
if(/如何|怎样|怎么|教程|指南|案例|操作|方法|新功能|实用|复现|分享|收藏|生产力/.test(s))v+=5;
if(/湿实验室|vllm|sglang|gpu|jdk|llama\.cpp|推理框架|算力基础设施|内核|compiler|编译器/.test(s))v-=12;
return v;
}
function rank(x){
const d=days(x);
const fresh=d<=1?25:d<=3?20:d<=7?12:d<=14?5:0;
const useful=relevance(x);
const evidence=(url(x.url)!=="#"?10:0)+(x.published?5:0)+(x.source?5:0);
const focus=theme(x)===state.lens?12:state.lens==="all"?8:0;
const originality=x.type==="skills"?-10:10;
return Math.max(0,Math.min(95,fresh+useful+evidence+focus+originality+readerFit(x)));
}
function audience(x){const t=theme(x);return({agents:"想提升工作效率的普通人",products:"想用 AI 做工具的初学者",models:"想读懂前沿 AI 的学习者",business:"关注 AI 时代职业机会的人",creative:"做内容与设计的创作者",safety:"担心隐私和风险的 AI 用户"})[t]||"关注 AI 的普通读者";}
function tag(x){const d=days(x);return d<=3?"近期素材":d<=7?"本周素材":"历史参考";}
function sampleTitle(x){return String(x.title||"新话题").trim().slice(0,64);}
function isAIRelevant(x){
 if(x.type==="skills")return true;
 const title=String(x.title||"").toLowerCase();
 const summary=String(x.summary||"").toLowerCase();
 const words=/\bai\b|artificial intelligence|人工智能|智能体|大模型|语言模型|世界模型|deepseek|openai|anthropic|claude|codex|chatgpt|gpt-|llama|llm|qwen|kimi|minimax|mcp|agent|推理|机器学习|生成式|cerebras|nvidia.*(芯片|推理|训练)|智能工具|智能助手/i;
 const weak=/(特斯拉|tesla|供应链|工厂|房地产|spy|间谍|监视)/i;
 if(weak.test(title)&&!words.test(title))return false;
 return words.test(title) || (words.test(summary) && /计算|科技|软件|公司|模型|技术|产品|agent|research|chip/i.test(title));
}
function readData(){
let seen=new Set(),list=[];
for(const x of items()){
if(!x||!x.title||!x.url||url(x.url)==="#"||!isAIRelevant(x))continue;
const key=String(x.url).trim().toLowerCase();
if(seen.has(key))continue;seen.add(key);
if(state.lens!=="all"&&theme(x)!==state.lens)continue;
if(state.q&&!([x.title,x.summary,x.why,x.source,x.angle].join(" ").toLowerCase().includes(state.q)))continue;
list.push(x);
}
return list.sort((a,b)=>rank(b)-rank(a)||String(b.published||"").localeCompare(String(a.published||"")));
}


function renderTracks(){
const el=$op("opportunityTrackSummary");if(!el)return;
const keys=["agents","products","models","business","creative","safety"];
const rows=keys.map(key=>{
 const members=items().filter(x=>theme(x)===key&&url(x.url)!=="#");
 return {key,total:members.length,recent:members.filter(x=>days(x)<=7).length};
}).filter(x=>x.total).sort((a,b)=>b.recent-a.recent||b.total-a.total);
if(!rows.length){el.innerHTML='<span class="op-track-loading">暂未收到可分类的真实新闻素材。</span>';return;}
el.innerHTML=rows.slice(0,3).map(x=>
 '<button type="button" class="op-track-card" data-op-track="'+x.key+'"><strong>'+esc(lensNames[x.key])+'</strong><span class="op-track-num">'+x.total+' 条</span><span class="op-track-sub">近 7 天 '+x.recent+' 条 · 点选查看</span></button>'
).join("");
el.querySelectorAll("[data-op-track]").forEach(btn=>btn.addEventListener("click",()=>{
state.lens=btn.dataset.opTrack;state.q="";state.limit=6;
const input=$op("opportunitySearch");if(input)input.value="";
note();draw();$op("opportunityLens")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}));
}
function renderWeekPlan(){
 const el=$op("opportunityWeekPlan");if(!el)return;
 const all=readData(),used=new Set();
 const options=[
  {label:"第1篇 · 前沿扫盲",type:"news",why:"让新读者迅速理解一项变化"},
  {label:"第2篇 · 工具实操",type:"skills",why:"用可复现步骤争取收藏"},
  {label:"第3篇 · 行业启发",type:"china",why:"联系真实工作场景，引发讨论"}
 ];
 const found=[];
 for(const o of options){let x=all.find(a=>a.type===o.type&&!used.has(a.url));if(!x)x=all.find(a=>!used.has(a.url));if(!x)continue;used.add(x.url);found.push({...o,x});}
 if(!found.length){el.innerHTML='<p>加载新闻后会给出 3 篇来源明确的编辑组合。</p>';return;}
 el.innerHTML=found.map((p,i)=>'<div class="op-week-row"><div><strong>'+esc(p.label)+'</strong><span>'+esc(p.why)+'</span><p>'+esc(p.x.angle||p.x.title)+'</p><small>来源：'+esc(p.x.source)+' · '+esc(String(p.x.published||"日期待核实").slice(0,10))+'</small></div><button type="button" data-week-add="'+items().indexOf(p.x)+'">入池</button></div>').join('')+'<button type="button" class="btn small" id="opGrowthJump">查看 7/30 日增长复盘 →</button>';
 el.querySelectorAll('[data-week-add]').forEach(b=>b.addEventListener('click',()=>{const x=items()[Number(b.dataset.weekAdd)];if(x&&typeof addFeed==='function'){addFeed(x);draw();}}));
 $op('opGrowthJump')?.addEventListener('click',()=>{if(typeof changeSection==='function')changeSection('growth')});
}

function draw(){
const all=items(),filtered=readData(),count=$op("opportunityCount"),stamp=$op("opportunityUpdated");
const report=typeof radarData!=="undefined" && radarData ? String(radarData.report_date||"") : "";
if(count)count.textContent=filtered.length+" 条可选";
renderTracks();renderWeekPlan();
const xnewsCount=all.filter(x=>x.origin==="xnews").length;
if(stamp)stamp.textContent=report ? "来源：DAVYLAB AI Radar（"+report+"）"+(xnewsCount?" + XNews 海外精选（"+xnewsCount+"条）":"")+" · 非全网热度榜" : (xnewsCount?"来源：XNews 海外精选（"+xnewsCount+"条） · AI Radar 当前不可用；非真实热度榜":"等待 AI Radar 数据；建议排序不代表真实阅读量");
$op("opportunityLens")?.querySelectorAll("[data-lens]").forEach(b=>{const active=b.dataset.lens===state.lens;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
if(!all.length){if($op("opportunityShowMore"))$op("opportunityShowMore").hidden=true;root.innerHTML='<div class="op-empty"><strong>正在准备选题素材</strong><p>若长时间没有内容，请点击「重新获取」。不会用假新闻占位。</p><button type="button" class="btn" id="opRetry">重新获取</button></div>';$op("opRetry")?.addEventListener("click",()=>{if(typeof loadRadar==="function")loadRadar()});return;}
if(!filtered.length){if($op("opportunityShowMore"))$op("opportunityShowMore").hidden=true;root.innerHTML='<div class="op-empty"><strong>当前方向没有匹配的素材</strong><p>切换赛道或清空搜索，可以继续查找。</p></div>';return;}
root.innerHTML=filtered.slice(0,state.limit).map((x,j)=>{
const index=all.indexOf(x),d=days(x),already=typeof topics!=="undefined"&&topics.some(t=>t.sourceUrl===x.url);
const cite=(x.published?String(x.published).slice(0,10):"日期待核实");
return '<article class="opportunity-card"><div class="op-card-top"><span class="op-type">'+esc(lensNames[theme(x)]||"AI 新闻")+'</span><span class="op-fresh '+(d>7?"old":"")+'">'+tag(x)+'</span></div><h3>'+esc(sampleTitle(x))+'</h3><p class="op-angle">编辑切入：'+esc(x.angle||"先读原文，再判断对普通人有什么价值")+'</p><div class="op-micro"><span>适合：'+esc(audience(x))+'</span><span>'+esc(x.source||"来源待核实")+' · '+esc(cite)+'</span></div><div class="op-card-bottom"><span class="op-rank" title="根据时效、内容匹配、来源完整性计算；非真实热度或涨粉预测">编辑优先级 '+rank(x)+'/100</span><div class="op-actions"><a href="'+url(x.url)+'" target="_blank" rel="noopener noreferrer">读原文</a><button type="button" data-op-prompt="'+index+'">创作指令</button><button type="button" class="op-add" data-op-add="'+index+'" '+(already?"disabled":"")+'>'+(already?"已收藏":"收进选题池")+'</button></div></div></article>';
}).join("");
root.querySelectorAll("[data-op-add]").forEach(btn=>btn.addEventListener("click",()=>{
const x=items()[Number(btn.dataset.opAdd)];if(!x||typeof addFeed!=="function")return;addFeed(x);draw();
}));
root.querySelectorAll("[data-op-prompt]").forEach(btn=>btn.addEventListener("click",()=>{
const x=items()[Number(btn.dataset.opPrompt)];if(!x||typeof showPrompt!=="function")return;
showPrompt({title:x.angle||x.title,angle:x.angle||"",summary:x.summary||"",sourceTitle:x.title,sourceUrl:x.url,sourceName:x.source,column:x.category||"AI 创造机会雷达",format:"文章"});changeSection("library");$op("promptBox")?.scrollIntoView({behavior:"smooth",block:"center"});if(typeof toast==="function")toast("已生成创作指令，来源待核实");
}));
const more=$op("opportunityShowMore");if(more){more.hidden=filtered.length<=state.limit;more.textContent="继续看更多（剩余 "+Math.max(0,filtered.length-state.limit)+" 条）";}
}
$op("opportunityLens")?.addEventListener("click",e=>{const b=e.target.closest("[data-lens]");if(!b)return;state.lens=b.dataset.lens;state.limit=6;note();draw();});
$op("opportunitySearch")?.addEventListener("input",e=>{state.q=e.target.value.trim().toLowerCase();state.limit=6;draw();});
$op("opportunityShowMore")?.addEventListener("click",()=>{state.limit+=6;draw();});
$op("opportunityRefresh")?.addEventListener("click",()=>{if(typeof loadRadar==="function")loadRadar();});
$op("opportunityResearch")?.addEventListener("click",()=>{
 const niche=state.lens==="all"?"普通人如何用好 AI":lensNames[state.lens];
 const field=$op("researchNiche");if(field&&!field.value.trim())field.value=niche;
 const audience=$op("researchAudience");if(audience&&!audience.value.trim())audience.value="对 AI 感兴趣、没有编程背景的普通读者";
 const context=$op("researchContext");
 const sources=readData().slice(0,3).map(x=>String(x.title||"")+" · "+String(x.url||""));
 if(context&&!context.value.trim()&&sources.length)context.value="本周已读取的来源线索（请逐项核查）：\n"+sources.join("\n");
 if(typeof changeSection==="function"){changeSection("research");field?.focus({preventScroll:true});}
});
$op("researchJumpDiscover")?.addEventListener("click",()=>{if(typeof changeSection==="function")changeSection("discover");$op("opportunityLens")?.scrollIntoView({behavior:"smooth",block:"start"});});
window.selectOpportunityLens=function(lens){state.lens=lensNames[lens]?lens:"all";state.limit=6;state.q="";const input=$op("opportunitySearch");if(input)input.value="";note();draw();if(typeof changeSection==="function")changeSection("discover");};
document.querySelectorAll("[data-jump-lens]").forEach(b=>b.addEventListener("click",()=>window.selectOpportunityLens(b.dataset.jumpLens)));
window.renderOpportunityRadar=draw;
draw();
})();