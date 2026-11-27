/* DAVYLAB Content Continuity | native Topic Studio integration. */
(()=>{
"use strict";
const $=id=>document.getElementById(id), api=window.DAVYLABProductionPrompt;
if(!api?.resolveContinuity||!$("ctTopic"))return;
const modes=api.continuityModes, fields={claims:"核心观点",covered:"已覆盖知识点",examples:"已使用案例与类比",questions:"尚未解决的问题",ending:"结尾与下篇预告",sources:"事实来源与日期",feedback:"真实读者反馈"};
let selected="",memoryTarget="",followTarget="";
const find=id=>topics.find(t=>String(t.id)===String(id));
const pubs=()=>allPublishedArticles();
const topicKey=t=>"t:"+String(t.id),pubKey=a=>"p:"+a.url;
const lookup=k=>k.startsWith("t:")?find(k.slice(2)):k.startsWith("p:")?pubs().find(a=>a.url===k.slice(2)):null;
const notice=s=>{$("ctNotice").textContent=s};
const label=k=>{const x=lookup(k);return x?(k.startsWith("p:")?"已发内容 · ":"选题 · ")+x.title:"已移除的关联"};
const option=(v,t)=>new Option(t,v);
function setOptions(el,items,value="",placeholder="请选择"){
 el.replaceChildren(option("",placeholder),...items.map(x=>option(x.key,x.title)));
 if(value&&!items.some(x=>x.key===value))el.add(option(value,"原记录已移除（保留引用）"));
 el.value=value;
}
function records(exclude=""){return [...pubs().filter(a=>a.format!=="贴图").map(a=>({key:pubKey(a),title:"已发 · "+a.title})),...topics.filter(t=>String(t.id)!==exclude&&t.format!=="贴图").map(t=>({key:topicKey(t),title:"选题 · "+t.title}))]}
function seriesList(){const m=new Map();for(const t of topics){const c=t.continuity;if(c?.mode==="series"&&c.seriesId&&c.seriesName)m.set(c.seriesId,c.seriesName)}return [...m].map(([key,title])=>({key,title}))}
function hydrateTopic(){
 const t=find(selected),c=t?.continuity||{};
 $("ctMode").value=modes[c.mode]?c.mode:"independent";
 setOptions($("ctSeries"),seriesList(),c.seriesId||"","新建系列 / 选择已有");
 $("ctSeriesName").value=c.seriesName||"";$("ctOrder").value=c.order||1;
 const refs=Array.isArray(c.refs)?c.refs:[];
 for(let i=0;i<3;i++)setOptions($("ctRef"+i),records(selected),refs[i]||"","不关联");
 $("ctBridge").value=c.bridge||"";$("ctNew").value=c.newValue||"";$("ctAvoid").value=c.avoid||"";
 updateVisibility();renderContext();recommend();
}
function refresh(){
 const t=find(selected);if(!t)selected=topics[0]?String(topics[0].id):"";
 setOptions($("ctTopic"),topics.map(t=>({key:String(t.id),title:t.title})),selected,"请选择选题");
 hydrateTopic();
 setOptions($("ctMemoryTarget"),records(),memoryTarget,"选择要归档的文章");
 setOptions($("ctFollowTarget"),pubs().filter(a=>a.format!=="贴图").map(a=>({key:pubKey(a),title:a.title})),followTarget,"手动选择已发文章");
 renderHot();renderFollow();
}
function openTopic(id){selected=String(id||"");changeSection("continuity");refresh();notice("已打开选题关联配置。")}
function updateVisibility(){const mode=$("ctMode").value;$("ctSeriesFields").hidden=mode!=="series";$("ctRelationFields").hidden=mode==="independent";$("ctSave").disabled=!find(selected);$("ctGenerate").disabled=!find(selected)}
function candidate(){
 const t=find(selected);if(!t)return null;const mode=$("ctMode").value;
 if(mode==="independent")return {...t,continuity:{version:1,mode}};
 const seriesId=$("ctSeries").value||uid(),seriesName=$("ctSeriesName").value.trim(),order=Number($("ctOrder").value);
 return {...t,continuity:{version:1,mode,...(mode==="series"?{seriesId,seriesName,order}:{}),refs:[...new Set([0,1,2].map(i=>$("ctRef"+i).value).filter(Boolean))],bridge:$("ctBridge").value.trim(),newValue:$("ctNew").value.trim(),avoid:$("ctAvoid").value.trim()}};
}
function context(t){return api.resolveContinuity(t,topics,pubs())}
function renderContext(){
 const root=$("ctContext"),t=find(selected);root.replaceChildren();
 if(!t){root.textContent="先选择选题。";return}
 const ctx=context(t);if(ctx.mode==="independent"){root.textContent="独立创作，不引入历史上下文。";return}
 const title=document.createElement("p");title.textContent=(modes[ctx.mode]||"")+" · "+(ctx.seriesName||"非系列")+(ctx.order?" · 第 "+ctx.order+" 篇":"");root.append(title);
 if(ctx.errors.length||ctx.missing.length){const p=document.createElement("p");p.textContent=[...ctx.errors,...ctx.missing.map(()=> "存在无法读取的关联记录")].join("；");p.className="ct-warn";root.append(p)}
 for(const a of ctx.items){const d=document.createElement("details"),h=document.createElement("summary");h.textContent=a.title+" · "+a.evidence;d.append(h);const p=document.createElement("pre");p.textContent=[a.status,a.date,a.url,a.summary,a.body,...Object.entries(fields).map(([k,v])=>a[k]?v+"："+a[k]:"")].filter(Boolean).join("\n\n");d.append(p);root.append(d)}
 if(!ctx.items.length){const p=document.createElement("p");p.textContent="没有已读取的前文资料；生成指令会提示证据缺口。";root.append(p)}
 if(ctx.series.length){const d=document.createElement("details"),h=document.createElement("summary");h.textContent="系列顺序 · "+ctx.series.length+" 篇";d.append(h);for(const a of ctx.series){const p=document.createElement("p");p.textContent="第 "+a.order+" 篇 · "+a.title+" · "+(STATUS[a.status]||a.status||"未发表");d.append(p)}root.append(d)}
}
function save(generate){
 const t=find(selected),next=candidate();if(!t||!next)return;
 const c=next.continuity;const projected=topics.map(x=>x===t?next:x);const errors=api.validateContinuity(next,projected);
 if(c.mode!=="independent"&&c.mode!=="series"&&!c.refs.length)errors.push("请选择至少一篇承接文章");
 if(c.mode!=="independent"&&!c.newValue)errors.push("请填写本篇新增价值");
 const ctx=api.resolveContinuity(next,projected,pubs());if(ctx.missing?.length)errors.push("关联包含自身或已移除的记录，请重新选择");
 if(errors.length){notice(errors.join("；"));return}
 t.continuity=c;saveTopics();hydrateTopic();notice("已保存关联方案，原文及审批状态未变更。");
 if(generate){changeSection("library");$("promptMode").value="production";promptTopicId=t.id;showPrompt(t,true);$("promptBox").scrollIntoView({behavior:"smooth",block:"center"});toast("已生成含连续创作上下文的文章指令")}
}
function grams(s){const a=String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");const set=new Set();for(let i=0;i<a.length-1;i++)set.add(a.slice(i,i+2));return set}
function recommend(){const root=$("ctRelated");root.replaceChildren();const t=find(selected);if(!t)return;const keys=grams(t.title+" "+(t.angle||""));const ranked=records(selected).map(r=>{const a=lookup(r.key),g=grams(a?.title+" "+(a?.summary||a?.angle||""));return {...r,score:[...keys].filter(k=>g.has(k)).length}}).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,5);if(!ranked.length){root.textContent="暂无明显关键词重合的文章，可手动关联。";return}for(const r of ranked){const b=document.createElement("button");b.type="button";b.className="btn small";b.textContent=r.title;b.addEventListener("click",()=>{if($("ctMode").value==="independent")$("ctMode").value="followup";updateVisibility();$("ctRef0").value=r.key;notice("已填入候选关联，需核对并保存。")});root.append(b)}}
function memoryData(k){const x=lookup(k);if(!x)return api.normalizeMemory(null);if(k.startsWith("p:")){const linked=find(x.linkedTopicId)||topics.find(t=>t.publishedArticleUrl===x.url);return api.normalizeMemory(x.continuityMemory||linked?.continuityMemory)}return api.normalizeMemory(x.continuityMemory)}
function hydrateMemory(){const m=memoryData(memoryTarget);$("ctMemoryState").value=m.state;$("ctBody").value=m.body;for(const k of Object.keys(fields))$("ctMem_"+k).value=m[k];$("ctMemoryStatus").textContent=memoryTarget?(m.body?"已归档正文 · "+m.body.length+" 字":"尚未归档原文；只有摘要时不得声称已读全文"):"请选择文章";$("ctMemorySave").disabled=!lookup(memoryTarget)}
function openMemory(k){memoryTarget=k;changeSection("continuity");refresh();hydrateMemory();$("ctMemoryPanel").scrollIntoView({behavior:"smooth",block:"start"})}
function saveMemory(){const x=lookup(memoryTarget);if(!x)return;const m=api.normalizeMemory({state:$("ctMemoryState").value,body:$("ctBody").value,...Object.fromEntries(Object.keys(fields).map(k=>[k,$("ctMem_"+k).value.trim()]))});
 if(m.body.length>200000){notice("正文超过20万字，本次未保存；请拆分归档。");return}
 if(m.state==="published"&&(!memoryTarget.startsWith("p:")&&!x.publishedArticleUrl)){notice("未登记发表的选题不能标为已发表原文。");return}
 if(m.state!=="draft"&&!m.body.trim()){notice("正式稿或发表原文必须实际导入正文。");return}
 if(memoryTarget.startsWith("p:")){const local=publishedArticles.find(a=>a.url===x.url);if(local)local.continuityMemory=m;else publishedArticles.unshift({...x,id:x.id||uid(),storageSource:"local",continuityMemory:m});savePublishedArticles()}
 else{x.continuityMemory=m;saveTopics()}
 hydrateMemory();renderContext();notice("文章记忆已保存；未改变文章发布状态。")}
function reviews(){return Array.isArray(growth?.reviews)?growth.reviews:[]}
function renderHot(){const root=$("ctHot");root.replaceChildren();const checkpoint=Number($("ctCheckpoint").value);const ranked=reviews().filter(r=>r.checkpoint===checkpoint&&pubs().some(a=>a.url===r.url)&&[r.reads,r.shares,r.follows].some(v=>v!=null)).sort((a,b)=>(Number(b[$("ctMetric").value])||0)-(Number(a[$("ctMetric").value])||0)).slice(0,8);if(!ranked.length){root.textContent="当前节点无真实复盘数据；仍可手动选择文章。";return}for(const r of ranked){const b=document.createElement("button");b.type="button";b.className="btn";b.textContent=r.title+" · 阅读 "+(r.reads??"—")+" / 分享 "+(r.shares??"—")+" / 新增 "+(r.follows??"—")+" · "+(r.reviewDate||"未记录日期");b.addEventListener("click",()=>{$("ctFollowTarget").value="p:"+r.url;followTarget="p:"+r.url;renderFollow()});root.append(b)}}
function renderFollow(){const root=$("ctSuggestions");root.replaceChildren();const a=lookup(followTarget);if(!a){root.textContent="选择文章后查看延伸方向。";return}const m=memoryData(followTarget),question=m.questions.trim().split(/\n/)[0];const ideas=[["实践延伸","如何把「"+a.title+"」中的观点应用到真实场景？","给出可操作步骤与边界"],["深度解读",question||"「"+a.title+"」还有哪些值得深入的问题？","回答前文未解决的问题"],["观点更新","重新审视「"+a.title+"」：有哪些新证据？","核查变化与旧观点边界"],["反面与局限","「"+a.title+"」在什么情况下不适用？","补充反例与适用条件"]];for(const [kind,title,value] of ideas){const row=document.createElement("div"),p=document.createElement("p"),b=document.createElement("button");p.textContent=kind+" · "+title;b.type="button";b.className="btn small";b.textContent="创建续写选题";b.addEventListener("click",()=>{const t={id:uid(),title,angle:value,summary:"基于已发文章延伸；方向为规则候选，需编辑与事实核查。",column:a.column||"系列内容",format:"文章",status:"inbox",origin:"continuity",createdAt:new Date().toISOString(),scores:{reader:3,timely:3,practical:3,distinct:3,brand:4},continuity:{version:1,mode:kind==="观点更新"?"update":"followup",refs:[followTarget],bridge:"从原文尚未解决的问题自然延伸",newValue:value,avoid:"避免重复已讲观点、案例及类比"}};topics.unshift(t);saveTopics();openTopic(t.id);notice("已创建待编辑续写选题，未生成或发表文章。")});row.append(p,b);root.append(row)}}
function openFollow(k){followTarget=k;changeSection("continuity");refresh();$("ctHotPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("ctTopic").addEventListener("change",()=>{selected=$("ctTopic").value;hydrateTopic()});$("ctMode").addEventListener("change",updateVisibility);
$("ctSeries").addEventListener("change",()=>{const id=$("ctSeries").value;const list=topics.filter(t=>t.continuity?.seriesId===id&&String(t.id)!==selected);$("ctSeriesName").value=list[0]?.continuity.seriesName||"";$("ctOrder").value=Math.max(0,...list.map(t=>Number(t.continuity.order)||0))+1});
$("ctSave").addEventListener("click",()=>save(false));$("ctGenerate").addEventListener("click",()=>save(true));
$("ctMemoryTarget").addEventListener("change",()=>{memoryTarget=$("ctMemoryTarget").value;hydrateMemory()});$("ctMemorySave").addEventListener("click",saveMemory);
$("ctImport").addEventListener("change",async()=>{const f=$("ctImport").files?.[0];if(!f)return;try{const raw=await f.text();const html=/\.html?$/i.test(f.name);let body=raw;if(html){const doc=new DOMParser().parseFromString(raw,"text/html");doc.querySelectorAll("script,style,link,iframe,object,template").forEach(n=>n.remove());body=doc.body.textContent||""}if($("ctBody").value.trim()&&!confirm("替换当前未保存的正文？"))return;$("ctBody").value=body;notice(html?"已提取 HTML 正文文本，请核对后保存。":"已读取正文文件，请核对来源与状态后保存。")}catch{notice("文件读取失败")}finally{$("ctImport").value=""}});
$("ctFollowTarget").addEventListener("change",()=>{followTarget=$("ctFollowTarget").value;renderFollow()});$("ctCheckpoint").addEventListener("change",renderHot);$("ctMetric").addEventListener("change",renderHot);
window.DAVYLABContinuity={refresh,openTopic,openMemory,openFollow,context};
refresh();hydrateMemory();
})();