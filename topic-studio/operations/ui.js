(function(){
"use strict";
const O=window.DAVYLABOperations; if(!O)throw Error("DAVYLAB_OPERATIONS_CORE_MISSING");
const KEY="davylab-operations-preview-v1";
const $=id=>document.getElementById(id);
const empty=()=>({assets:[],tasks:[],metrics:[],releaseDates:{}});
let state;
try{const a=JSON.parse(localStorage.getItem(KEY)||"null");state=a&&Array.isArray(a.assets)&&Array.isArray(a.tasks)&&Array.isArray(a.metrics)&&a.releaseDates&&typeof a.releaseDates==="object"?a:empty()}catch{state=empty()}
function save(){localStorage.setItem(KEY,JSON.stringify(state));render()}
function el(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x}
function message(id,txt){$(id).textContent=txt}
function choices(id){const x=$(id),v=x.value;x.replaceChildren();for(const a of state.assets){const opt=el("option",a.title+" ("+a.id+")");opt.value=a.id;x.append(opt)}if(state.assets.some(a=>a.id===v))x.value=v;}
function render(){
$("assetCount").textContent=String(state.assets.length);
$("pendingCount").textContent=String(state.tasks.filter(t=>t.status==="awaiting_user").length);
$("publishedCount").textContent=String(state.assets.filter(a=>a.phase==="published").length);
for(const id of ["taskAsset","reviewAsset","compareAsset","metricAsset","utmAsset"])choices(id);
$("assets").replaceChildren();
for(const a of state.assets){
const row=el("div",undefined,"row"),body=el("div"),name=el("strong",a.title||a.id),desc=el("div",a.id+" · "+a.kind,"muted"),tag=el("span",a.phase,"tag");
body.append(name,desc);row.append(body,tag);$("assets").append(row);
}
$("tasks").replaceChildren();
for(const t of state.tasks){const a=state.assets.find(x=>x.id===t.assetId);
const row=el("div",undefined,"row"),body=el("div");
body.append(el("strong",(a?.title||t.assetId)+" · "+t.platform),el("div",t.updatedAt.slice(0,10),"muted"));
row.append(body,el("span",t.status,"tag"));$("tasks").append(row);}
}
$("addForm").addEventListener("submit",e=>{e.preventDefault();try{
const a=O.makeAsset({topicId:$("topicId").value.trim(),kind:$("kind").value,title:$("title").value});
if(state.assets.some(x=>x.id===a.id))throw Error("同一选题及类型已经登记，禁止重复");
state.assets.unshift(a);save();message("assetMessage","草稿登记完成；尚未批准或发布");
}catch(err){message("assetMessage",err.message)}});
$("importTopics").addEventListener("click",()=>{try{
const topics=JSON.parse(localStorage.getItem("davylab-topic-studio-v1")||"[]");
if(!Array.isArray(topics))throw Error("原选题池格式无效");
let added=0,skipped=0;
for(const t of topics.slice(0,1000)){
if(!t||typeof t.id!=="string"||!t.title){skipped++;continue}
const kind=String(t.format||"").includes("贴图")?"post":"article";
let a;try{a=O.makeAsset({topicId:t.id,kind,title:t.title,sourceUrl:typeof t.sourceUrl==="string"?t.sourceUrl:"",visualPlan:t.visualPlan||null})}catch{skipped++;continue}
if(state.assets.some(x=>x.id===a.id)){skipped++;continue}
state.assets.push(a);added++;
}
save();message("assetMessage","只读导入 "+added+" 条；跳过 "+skipped+" 条。全部以 draft 登记，原选题池完全未修改。");
}catch(err){message("assetMessage",err.message)}});
$("demo").addEventListener("click",()=>{$("topicId").value="demo-"+Date.now();$("title").value="虚构示例：AI 学习实践";message("assetMessage","已填入虚构示例，点击登记草稿才会保存")});
$("taskForm").addEventListener("submit",e=>{e.preventDefault();try{state.tasks=O.upsertTask(state.tasks,{assetId:$("taskAsset").value,platform:$("platform").value,status:$("taskState").value});save();message("taskMessage","状态已保存（仅本机模拟，无发布动作）")}catch(err){message("taskMessage",err.message)}});
$("metricForm").addEventListener("submit",e=>{e.preventDefault();try{
const assetId=$("metricAsset").value,day=$("ageDay").value,pubDay=$("pubDay").value;
if(!assetId)throw Error("请先登记内容资产");
const m=O.metric({assetId,platform:"wechat",day,views:Number($("views").value),source:"manual"});
state.releaseDates[assetId]=pubDay;
state.metrics=state.metrics.filter(x=>!(x.assetId===assetId&&x.platform==="wechat"&&x.day===day));
state.metrics.push(m);save();message("metricMessage","已记录人工输入值；未经后台独立校验");
}catch(err){message("metricMessage",err.message)}});
$("compare").addEventListener("click",()=>{try{const a=$("reviewAsset").value,b=$("compareAsset").value;
if(!a||!b||a===b)throw Error("请选择两篇不同内容");
const r=O.sameAge(state.metrics,a,b,Number($("reviewAge").value),state.releaseDates);
const fmt=x=>x.value===null?"未采集":x.value.toLocaleString("zh-CN");
message("reviewResult","本篇 "+fmt(r.current)+" · 对比篇 "+fmt(r.previous)+" · 同龄比 "+(r.ratio===null?"无法计算":r.ratio.toFixed(2)+" 倍")+"。仅供手动指标对比。");
}catch(err){message("reviewResult",err.message)}});
$("generateUrl").addEventListener("click",()=>{try{const a=$("utmAsset").value;if(!a)throw Error("请先登记内容资产");
const u=new URL($("originUrl").value);if(u.protocol!=="https:")throw Error("只接受 HTTPS 产品地址");
const q=O.utm({campaign:a});for(const [k,v] of new URLSearchParams(q))u.searchParams.set(k,v);
$("urlResult").replaceChildren(el("code",u.href));}catch(err){message("urlResult",err.message)}});
$("export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
const u=URL.createObjectURL(blob),link=document.createElement("a");link.href=u;link.download="davylab-operations-preview.json";link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);message("generalMessage","已导出本浏览器测试数据")});
$("clear").addEventListener("click",()=>{if(!confirm("确认只清除本页的预览数据？不会操作原选题池。"))return;state=empty();localStorage.removeItem(KEY);render();message("generalMessage","已清理本页预览数据")});
render();
})();