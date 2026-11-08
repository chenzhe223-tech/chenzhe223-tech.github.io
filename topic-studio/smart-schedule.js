/* DAVYLAB Smart Editorial Schedule — local planning only; never publishes content. */
(function(){
"use strict";
if(typeof topics==="undefined" || typeof saveTopics!=="function" || typeof renderCalendar!=="function")return;
const CONFIG_KEY="davylab-smart-editorial-schedule-v1";
const COLUMNS=["从念头到产品","AI 实战手记","AI 创造机会雷达","普通人的 AI 创造力","产品复盘与实验室"];
const WEEK=["日","一","二","三","四","五","六"];
const POSTER_DAYS=new Set([0,1,3,5]);
const formatDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const today=()=>formatDate(new Date());
function dayNumber(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));if(!m)return NaN;const n=Date.UTC(+m[1],+m[2]-1,+m[3])/86400000;return new Date(n*86400000).toISOString().slice(0,10)===s?n:NaN}
function dayString(n){return new Date(n*86400000).toISOString().slice(0,10)}
function weekday(s){return new Date(dayNumber(s)*86400000).getUTCDay()}
function typeOf(t){const f=String(t.format||"文章");if(/贴图|海报|图文卡|图片|poster/i.test(f))return"poster";if(/视频|播客|音频|video|podcast/i.test(f))return null;return"article"}
function readConfig(){try{const v=JSON.parse(localStorage.getItem(CONFIG_KEY)||"{}");return{anchor:Number.isFinite(dayNumber(v.anchor))?v.anchor:today(),horizon:[14,28,56].includes(v.horizon)?v.horizon:28,autoAssign:v.autoAssign!==false,onlyMissing:v.onlyMissing===true}}catch{return{anchor:today(),horizon:28,autoAssign:true,onlyMissing:false}}}
let config=readConfig();
function persistConfig(){localStorage.setItem(CONFIG_KEY,JSON.stringify(config))}
function eligible(date,type){const delta=dayNumber(date)-dayNumber(config.anchor);return type==="article"?Number.isFinite(delta)&&delta>=0&&delta%2===0:POSTER_DAYS.has(weekday(date))}
function generateSlots(horizon=config.horizon){const start=dayNumber(today()),slots=[];for(let k=0;k<horizon;k++){const d=dayString(start+k);if(eligible(d,"article"))slots.push({date:d,type:"article"});if(eligible(d,"poster"))slots.push({date:d,type:"poster"})}return slots}
function occupied(date,type,exceptId){return topics.some(t=>t.id!==exceptId && t.plannedDate===date && typeOf(t)===type)}
function nextFree(type,exceptId){const first=dayNumber(today());for(let i=0;i<120;i++){const d=dayString(first+i);if(eligible(d,type)&&!occupied(d,type,exceptId))return d}return""}
function pickColumn(){const recent=topics.filter(t=>COLUMNS.includes(t.column)).slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,20);const counts=new Map(COLUMNS.map(c=>[c,recent.filter(t=>t.column===c).length]));const least=Math.min(...counts.values());let choices=COLUMNS.filter(c=>counts.get(c)<=least+1);if(recent.length&&choices.length>1)choices=choices.filter(c=>c!==recent[0].column);return choices[Math.floor(Math.random()*choices.length)]||COLUMNS[0]}
const originalSave=saveTopics,knownIds=new Set(topics.map(t=>t.id));
saveTopics=function(){
 for(const t of topics){
  if(!t||!t.id||knownIds.has(t.id))continue;
  knownIds.add(t.id);
  const fresh=Number.isFinite(Date.parse(t.createdAt))&&Math.abs(Date.now()-Date.parse(t.createdAt))<120000;
  if(!fresh)continue; // imported history is not silently changed
  if(t.origin!=="manual"&&t.origin!=="schedule-suggested"&&!t.columnAssignedAt){if(t.column)t.originalColumn=t.column;t.column=pickColumn();t.columnAssignedAt=new Date().toISOString();t.columnAssignmentMethod="balanced-random"}
  if(t.origin==="manual"&&!t.columnAssignedAt){t.columnAssignedAt=new Date().toISOString();t.columnAssignmentMethod="creation-selection"}
  const type=typeOf(t);
  if(config.autoAssign && !t.plannedDate && type && t.status!=="published"){
   const day=nextFree(type,t.id);
   if(day){t.plannedDate=day;t.scheduleSource="smart-auto"}
  }
 }
 originalSave();
};
const originalOpenDialog=openDialog;
openDialog=function(t){originalOpenDialog(t);if(!t){const col=document.getElementById("topicColumn");if(col)col.value=pickColumn()}};
const ARTICLE_IDEAS=[
 ["把 AI 当作学习搭档：从一个实际问题开始","一句话解释、实用提示词与核验清单"],
 ["AI 帮普通人解决什么问题？列出五个可验证场景","强调可复现，不夸大实际效果"],
 ["不会编程，也能理解 AI Agent 的工作原理","用日常任务拆解智能体的步骤与边界"],
 ["一次 AI 工具对比，应该看哪些指标？","从成本、准确性、隐私和上手门槛出发"],
 ["AI 生成的内容，怎样判断靠不靠谱？","用一手来源核对事实与数字"],
 ["我准备如何建立自己的 AI 学习资料库","写成计划，不虚构已经完成的经验"],
 ["普通人的 AI 工作流：先拆任务，再选工具","用采购、整理资料等日常任务举例"],
 ["为什么 AI 的记忆不等于真正理解？","解释上下文、外部存储与检索的区别"],
 ["AI 能自动完成多少工作？先看权限边界","说明批准、审查和执行的不同阶段"],
 ["读懂一个开源 AI 项目，我会先看什么？","从许可、文档、更新记录和可运行性入手"],
 ["AI 时代更值得培养的三个学习习惯","区分个人观察与可证实的事实"],
 ["从灵感到应用：普通人的最小验证路径","先测试真实需求，再讨论技术方案"],
 ["为什么好的 AI 提问需要具体上下文？","用模糊指令与明确指令做对照"],
 ["AI 工具部署前，普通人该检查什么？","覆盖费用、权限、安全和退出机制"]
];
const POSTER_IDEAS=[
 ["一张图看懂 AI Agent 的五个基本环节","输入、计划、工具、执行、复核"],
 ["AI 提问避坑卡：模糊需求与清晰需求","左右对比，两组可复制提示词"],
 ["新手入门 AI：先搞懂这六个词","语言模型、提示词、上下文、检索、工具、智能体"],
 ["AI 内容事实核查四步法","出处、时间、原始数据、交叉验证"],
 ["AI 学习路线图：从会问到会做","理解、实操、验证、复盘"],
 ["AI 工具权限清单：能做与不能做","明确读、写、发送、发布的边界"],
 ["一图认识 RAG：知识库如何回答问题","检索、取证、生成及引用"],
 ["AI 文章创作流程卡","选题、研究、成稿、图片、核查、审批"],
 ["AI 工具试用评分表","好用、准确、安全、费用、可迁移"],
 ["一张图理解自动化与智能体的区别","固定规则与动态决策的对照"],
 ["普通人的 AI 防骗提醒卡","警惕假链接、密钥泄露和伪造引用"],
 ["一图梳理 AI 文件整理工作流","分类、提取、命名、复核"],
 ["用 AI 做计划：三个可复用的提问框架","目标、约束、输出格式"],
 ["AI 术语速查：模型、插件与 Skill","分清定义、场景及局限"],
 ["内容创作者的 AI 工具选型矩阵","写作、配图、校对、资料管理"]
];
function suggestionPool(type){
 const evergreen=(type==="article"?ARTICLE_IDEAS:POSTER_IDEAS).map(([title,angle])=>({title,angle,from:"编辑建议 · 待核实",sourceUrl:""}));
 const now=Date.now();
 const recent=(Array.isArray(feedCache)?feedCache:[]).filter(x=>x&&x.title&&x.url&&/^(news|china|skills)$/.test(x.type)&&Number.isFinite(Date.parse(x.published))&&now-Date.parse(x.published)>=0&&now-Date.parse(x.published)<=14*86400000)
 .slice(0,20).map(x=>({title:(type==="poster"?"一张图读懂：":"普通人怎么看：")+String(x.title).slice(0,46),angle:"基于近期公开线索整理，需打开原文核实发布日期、内容与使用权限",from:"AI Radar 线索 · 待核实",sourceUrl:x.url}));
 return[...recent,...evergreen].filter(x=>!topics.some(t=>t.title===x.title || (x.sourceUrl&&t.sourceUrl===x.sourceUrl)));
}
function suggest(type,used,index){
 const pool=suggestionPool(type);
 const offset=index%Math.max(pool.length,1);
 for(let i=0;i<pool.length;i++){const x=pool[(offset+i)%pool.length];if(!used.has(x.title)){used.add(x.title);return x}}
 const label=type==="article"?"普通人 AI 应用问答":"AI 知识速查贴图";
 return{title:label+" · 第"+(index+1)+"期",angle:"围绕一个真实问题解释概念和边界，成稿前补充可靠来源",from:"编辑备选 · 待核实",sourceUrl:""}
}
function priority(t){const rank={ready:50,writing:40,shortlist:30,inbox:20};return(rank[t.status]||0)+(typeof score==="function"?score(t):60)/10}
function fillPlan(){
 const backlog=topics.filter(t=>!t.plannedDate&&t.status!=="published"&&typeOf(t)).sort((a,b)=>priority(b)-priority(a)||String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 let count=0;
 for(const slot of generateSlots()){
  if(occupied(slot.date,slot.type))continue;
  const idx=backlog.findIndex(t=>typeOf(t)===slot.type);
  if(idx<0)continue;
  const t=backlog.splice(idx,1)[0];t.plannedDate=slot.date;t.scheduleSource="smart-batch";t.updatedAt=new Date().toISOString();count++;
 }
 if(count)originalSave();else renderSmartSchedule();
 toast(count?"已为 "+count+" 条选题补充排期；未修改现有日期":"没有可填充的未排期选题，请查看空档建议");
}
function acceptSuggestion(date,type,idea){
 if(occupied(date,type)){toast("这个日期已有同类选题，请刷新排期");renderSmartSchedule();return}
 const column=pickColumn();
 topics.unshift({id:uid(),title:idea.title,angle:idea.angle,summary:idea.angle,sourceTitle:idea.from,sourceUrl:idea.sourceUrl||"",sourceName:idea.sourceUrl?"AI Radar":"DAVYLAB 编辑建议",column,format:type==="article"?"文章":"贴图",status:"inbox",plannedDate:date,createdAt:new Date().toISOString(),origin:"schedule-suggested",columnAssignedAt:new Date().toISOString(),columnAssignmentMethod:"balanced-random",scheduleSource:"suggestion",factCheckStatus:"待核实",scores:{reader:3,timely:3,practical:3,distinct:3,brand:4}});
 saveTopics();toast("建议已加入选题池，仍需核实并审核");
}
function renderSmartSchedule(){
 const el=document.getElementById("calendarList"),stats=document.getElementById("smartScheduleStats");if(!el)return;
 const anchor=document.getElementById("smartStartDate"),windowSelect=document.getElementById("smartScheduleWindow"),auto=document.getElementById("smartAutoAssign"),filter=document.getElementById("smartScheduleFilter");
 if(anchor)anchor.value=config.anchor;if(windowSelect)windowSelect.value=String(config.horizon);if(auto)auto.checked=config.autoAssign;if(filter)filter.value=config.onlyMissing?"missing":"all";
 const slots=generateSlots();
 const totals={article:slots.filter(s=>s.type==="article").length,poster:slots.filter(s=>s.type==="poster").length};
 const filled={article:0,poster:0};
 const used={article:new Set(),poster:new Set()},idx={article:0,poster:0};
 const groups=new Map();
 for(const slot of slots){
  const matches=topics.filter(t=>t.plannedDate===slot.date&&typeOf(t)===slot.type);
  if(matches.length)filled[slot.type]++;
  const entry={...slot,matches,idea:matches.length?null:suggest(slot.type,used[slot.type],idx[slot.type])};
  idx[slot.type]++;
  if(!groups.has(slot.date))groups.set(slot.date,[]);groups.get(slot.date).push(entry);
 }
 const gap=totals.article+totals.poster-filled.article-filled.poster;
 if(stats)stats.innerHTML='<span><strong>文章 '+filled.article+'/'+totals.article+'</strong> 隔天一篇</span><span><strong>贴图 '+filled.poster+'/'+totals.poster+'</strong> 周一三五日</span><span><strong>待补 '+gap+'</strong> 个排期位</span>';
 const visible=[...groups].filter(([,entries])=>!config.onlyMissing||entries.some(e=>!e.matches.length));
 if(!visible.length){el.innerHTML='<div class="empty"><strong>排期已覆盖</strong>当前周期没有待补空档。</div>';return}
 const suggestionByKey=new Map();
 el.innerHTML=visible.map(([date,entries])=>{
  const day=dayNumber(date),week=WEEK[weekday(date)],head='<div class="smart-day-label"><strong>'+safe(date.slice(5).replace("-"," / "))+'</strong><span>周'+week+'</span></div>';
  const slotsHTML=entries.map(e=>{
   const label=e.type==="article"?"文章":"贴图",cls=e.type==="article"?"article":"poster",key=date+"|"+e.type;
   if(e.matches.length)return'<div class="smart-slot '+cls+'"><span class="smart-type">'+label+'</span><div class="smart-slot-main">'+e.matches.map(t=>'<strong>'+safe(t.title)+'</strong><small>'+safe(t.column||"未分类")+' · '+safe(STATUS[t.status]||"待编辑")+(t.scheduleSource?" · 智能排期":"")+'</small>').join("")+'</div><button class="btn small" data-smart-edit="'+safe(e.matches[0].id)+'">编辑</button></div>';
   suggestionByKey.set(key,e.idea);
   return'<div class="smart-slot missing '+cls+'"><span class="smart-type">'+label+'</span><div class="smart-slot-main"><small>空档建议 · '+safe(e.idea.from)+'</small><strong>'+safe(e.idea.title)+'</strong></div><button class="btn small primary" data-smart-accept="'+safe(key)+'">采用</button></div>';
  }).join("");
  return'<div class="smart-day">'+head+'<div class="smart-day-slots">'+slotsHTML+'</div></div>'
 }).join("");
 el.querySelectorAll("[data-smart-edit]").forEach(btn=>btn.addEventListener("click",()=>{const t=topics.find(x=>x.id===btn.dataset.smartEdit);if(t)openDialog(t)}));
 el.querySelectorAll("[data-smart-accept]").forEach(btn=>btn.addEventListener("click",()=>{const key=btn.dataset.smartAccept,idea=suggestionByKey.get(key);if(!idea)return;const [d,type]=key.split("|");acceptSuggestion(d,type,idea)}));
}
const priorRenderCalendar=renderCalendar;
renderCalendar=renderSmartSchedule;
const oldFeed=renderFeed;
renderFeed=function(){oldFeed();if(document.querySelector("#section-calendar.active"))renderSmartSchedule()};
document.getElementById("smartPlanNow")?.addEventListener("click",fillPlan);
document.getElementById("smartStartDate")?.addEventListener("change",e=>{if(!Number.isFinite(dayNumber(e.target.value))){toast("请选择正确日期");return}config.anchor=e.target.value;persistConfig();renderSmartSchedule()});
document.getElementById("smartScheduleWindow")?.addEventListener("change",e=>{config.horizon=Number(e.target.value);persistConfig();renderSmartSchedule()});
document.getElementById("smartAutoAssign")?.addEventListener("change",e=>{config.autoAssign=e.target.checked;persistConfig();renderSmartSchedule()});
document.getElementById("smartScheduleFilter")?.addEventListener("change",e=>{config.onlyMissing=e.target.value==="missing";persistConfig();renderSmartSchedule()});
document.getElementById("smartScheduleResetHint")?.addEventListener("click",()=>toast("已排期日期不会随节奏设置改变；需调整时请编辑对应选题。"));
window.DAVYLABSmartSchedule={version:"1.0.0",generateSlots,eligible,typeOf,dayNumber,pickColumn,fillPlan,render:renderSmartSchedule};
renderSmartSchedule();
})();