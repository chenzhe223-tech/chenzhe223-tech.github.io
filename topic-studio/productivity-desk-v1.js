/* DAVYLAB Productivity Desk V1 — source-to-brief-to-topic, topic-to-experiment-to-review.
   Uses existing public AI Radar/XNews metadata and user's current local records only.
   No invented analytics, remote write, automatic approval or publication.
*/
(function(){
"use strict";
const el=id=>document.getElementById(id);
if(!el("section-research")||!el("section-growth")||typeof topics==="undefined"||typeof growth==="undefined")return;
const esc=v=>typeof safe==="function"?safe(v):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plain=(v,n=250)=>String(v??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n);
const validUrl=s=>{try{const x=new URL(String(s));return ["http:","https:"].includes(x.protocol)?x.href:""}catch{return""}};
const canonical=s=>{try{const u=new URL(String(s));return u.origin+u.pathname.replace(/\/$/,"")+u.search}catch{return""}};
const SRC_LIMIT=6,BRIEF_STORE="davylab-topic-research-briefs-v1";
const issueTypes={
 "保存价值":{type:"AI 实测",question:"读者会因为可复现的步骤而收藏吗？",measure:"真实收藏数（仅平台实际提供时记录）或 7 日阅读/分享"},
 "转发价值":{type:"认知反差",question:"具体问题与结论是否帮助读者理解并愿意分享？",measure:"7 日真实分享/转发量"},
 "产品实践":{type:"开源项目",question:"真实操作过程是否比单纯介绍功能更有说服力？",measure:"7 日阅读和真实反馈；记录是否完成可重复操作"},
 "深度系列":{type:"论文解读",question:"连续主题是否提高读者关注与后续内容兴趣？",measure:"7/30 日复盘与可追溯的新增订阅（若有）"}
};
let currentSources=[];
function bySource(id){return currentSources.find(x=>x.key===id)}
function sourceItems(){
 const seen=new Set(),out=[];
 const feed=typeof feedCache!=="undefined"&&Array.isArray(feedCache)?feedCache:[];
 for(const x of feed){
  if(!x||typeof x!=="object")continue;
  const link=validUrl(x.url),key=canonical(link);
  if(!link||seen.has(key))continue;seen.add(key);
  out.push({key:String(out.length),title:plain(x.title||"公开信息",170),summary:plain(x.summary||x.angle,240),date:String(x.published||"").slice(0,10),source:plain(x.source||"未知来源",90),url:link,entry:x});
 }
 return out;
}
function tokens(text){
 const str=plain(text,160).toLowerCase();
 const keywords=["agent","智能体","工作流","自动化","skill","mcp","供应链","采购","成本","财务","产品","ai","模型","教程","设计","创作","学习","出海","商业","安全","隐私","编程","开发","图像","视频","论文","机器人","ai radar"];
 const found=keywords.filter(k=>str.includes(k));
 const words=str.split(/[\s,，、：:；;|/]+/).filter(t=>t.length>=2&&t.length<=28);
 return [...new Set([...found,...words])].slice(0,12);
}
function evidence(query){
 const all=sourceItems(),tags=tokens(query);
 const scored=all.map(x=>{
  const text=(x.title+" "+x.summary+" "+x.source).toLowerCase();
  const match=tags.reduce((sum,k)=>sum+(text.includes(k)?(x.title.toLowerCase().includes(k)?2:1):0),0);
  const delta=x.date&&Number.isFinite(Date.parse(x.date))?Math.floor((Date.now()-Date.parse(x.date))/86400000):999;
  return{...x,match,delta};
 });
 const direct=scored.filter(x=>x.match>0).sort((a,b)=>b.match-a.match||b.date.localeCompare(a.date));
 const selected=direct.length?direct.slice(0,SRC_LIMIT):scored.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,SRC_LIMIT);
 return{selected,directCount:direct.length,total:all.length,matched:direct.length>0};
}
function researchHtml(){
 const node=document.createElement("section");node.className="productivity-desk research-productivity";node.id="researchEvidenceDesk";
 node.innerHTML='<div class="pd-head"><div><div class="pd-kicker">SOURCE INTELLIGENCE / 来源先行</div><h2>赛道证据工作台</h2><p>从真实公开来源开始，筛出与当前赛道相关的线索，形成可审阅的研究简报，再转入选题池。</p></div><span class="pd-indicator">待核实线索 · 非市场热度</span></div>'+
 '<div class="pd-tools"><label class="pd-label" for="pdResearchQuery">本次研究关键词</label><input id="pdResearchQuery" maxlength="120" placeholder="例如：Agent 自动化 / AI 实操 / 开源工具" autocomplete="off"><button id="pdFindSources" type="button" class="pd-primary">查找相关来源</button><button id="pdBuildBrief" type="button">形成研究简报</button></div>'+
 '<div class="pd-kpis"><div><strong id="pdSourcesMatched">—</strong><span>关键词匹配线索</span></div><div><strong id="pdSourcesTotal">—</strong><span>可访问来源记录</span></div><div><strong id="pdBenchCount">—</strong><span>已记录对标账号</span></div></div>'+
 '<div class="pd-list-head"><strong>来源与选题机会</strong><span id="pdSourceStatus">等待来源索引</span></div>'+
 '<div id="pdSourceList" class="pd-source-list" aria-live="polite"></div>'+
 '<div class="pd-brief"><div class="pd-list-head"><strong>研究简报（可修改）</strong><span>生成规则框架，不代表已完成事实核查</span></div><textarea id="pdResearchBrief" rows="8" placeholder="选择领域并点击“形成研究简报”，根据已加载的来源自动整理公开线索、编辑假设与核查任务。"></textarea><div class="pd-actions"><button id="pdCopyBrief" type="button">复制简报</button><button id="pdSaveBrief" type="button">保存本机研究档案</button><button id="pdDownloadBrief" type="button">导出 Markdown</button><span id="pdBriefStatus" role="status">内容可修改，未自动发布</span></div></div>'+
 '<div class="pd-history"><div class="pd-list-head"><strong>已保存的研究档案</strong><span>当前浏览器 · 点击继续编辑</span></div><div id="pdBriefArchive" class="pd-brief-archive" aria-live="polite"></div></div>';
 el("section-research").querySelector(".hero")?.insertAdjacentElement("afterend",node);
}
function growthHtml(){
 const node=document.createElement("section");node.className="productivity-desk growth-productivity";node.id="growthSprintDesk";
 node.innerHTML='<div class="pd-head"><div><div class="pd-kicker">EDITORIAL GROWTH / 实验闭环</div><h2>从选题到增长实验</h2><p>用真实选题提出可检验的假设，跟踪 7/30 日后台数据；不以预测值冒充增长成果。</p></div><span class="pd-indicator">本机数据 · 不自动发布</span></div>'+
 '<div class="pd-kpis"><div><strong id="pdGrowthReady">—</strong><span>可启动选题</span></div><div><strong id="pdGrowthLive">—</strong><span>待跟进实验</span></div><div><strong id="pdGrowthReviewDue">—</strong><span>到期复盘节点</span></div></div>'+
 '<div class="pd-workflow"><div class="pd-workstep"><span class="pd-step-num">01</span><label for="pdGrowthTopic">选择已有选题</label><select id="pdGrowthTopic"><option value="">选择选题池中的文章或贴图</option></select></div>'+
 '<div class="pd-workstep"><span class="pd-step-num">02</span><label for="pdGrowthHypothesis">本次验证重点</label><select id="pdGrowthHypothesis"><option>保存价值</option><option>转发价值</option><option>产品实践</option><option>深度系列</option></select></div>'+
 '<div class="pd-workstep"><span class="pd-step-num">03</span><label for="pdGrowthSignal">观察指标（可修改）</label><input id="pdGrowthSignal" maxlength="180" value="7 日阅读与分享；30 日复盘" placeholder="例如：7 日真实分享量"></div></div>'+
 '<div class="pd-actions"><button id="pdCreateExperiment" class="pd-primary" type="button">从选题创建实验</button><button id="pdCopyExperiment" type="button">复制执行卡</button><button id="pdExportExperiment" type="button">导出执行卡</button><span id="pdGrowthStatus" role="status">创建后进入现有实验池，等待真实数据验证</span></div>'+
 '<div class="pd-list-head"><strong>最近关联的选题实验</strong><span>计划 / 研究 / 写作中不代表已发表</span></div><div id="pdExperimentList" class="pd-experiment-list" aria-live="polite"></div>';
 el("section-growth").querySelector(".hero")?.insertAdjacentElement("afterend",node);
}
function renderSources(){
 const host=el("pdSourceList");if(!host)return;
 const q=plain(el("pdResearchQuery")?.value||el("researchNiche")?.value,120);
 const match=evidence(q);currentSources=match.selected;
 el("pdSourcesMatched").textContent=match.directCount;
 el("pdSourcesTotal").textContent=match.total;
 el("pdBenchCount").textContent=typeof benchmarks!=="undefined"&&Array.isArray(benchmarks)?benchmarks.length:0;
 const status=el("pdSourceStatus");
 status.textContent=match.total===0?"目前没有已加载的公开线索；请先更新 AI Radar / XNews":match.matched?"已按关键词匹配，排序仅代表编辑相关性":"无直接匹配；展示最近的公开记录供人工判断";
 if(!currentSources.length){host.innerHTML='<div class="pd-empty">目前没有可核验来源，无法生成证据型选题。请先在「选题发现」刷新 AI Radar 或 XNews，或从来源库打开一手资料。</div>';return}
 host.innerHTML=currentSources.map((a,i)=>{
 const already=topics.some(t=>canonical(t.sourceUrl)===canonical(a.url));
 return'<article class="pd-source"><div class="pd-source-meta"><span>'+(a.match>0?"关键词匹配":"相关性待判断")+'</span><span>'+esc(a.source)+' · '+esc(a.date||"日期待核实")+'</span></div><h3>'+esc(a.title)+'</h3><p>'+esc(a.summary||"原始文章或项目，请打开来源核验正文。")+'</p><div class="pd-actions"><a href="'+esc(a.url)+'" target="_blank" rel="noopener noreferrer">查看原文</a><button type="button" data-pd-source-add="'+i+'">'+(already?"查看已有选题":"转为候选选题")+'</button></div></article>';
 }).join("");
 host.querySelectorAll("[data-pd-source-add]").forEach(button=>button.addEventListener("click",()=>{
   const item=currentSources[Number(button.dataset.pdSourceAdd)];if(!item)return;
   const saved=topics.find(t=>canonical(t.sourceUrl)===canonical(item.url));
   if(saved){window.DAVYLABTopicPool?.reveal?.(item.url);return}
   const x={...item.entry,angle:plain(item.entry.angle||"研究问题："+item.title,220),summary:item.summary,
    source:item.source,url:item.url,origin:item.entry.origin,category:item.entry.category||"AI 创造机会雷达"};
   if(typeof addFeed==="function"){addFeed(x);renderSources();window.DAVYLABTopicPool?.reveal?.(item.url)}
 }));
}
function briefText(){
 const niche=plain(el("pdResearchQuery")?.value||el("researchNiche")?.value,120)||"尚未指定领域";
 const audience=plain(el("researchAudience")?.value,120)||"对 AI 感兴趣的非程序员读者";
 const goal=plain(el("researchGoal")?.value,120)||"建立长期系列";
 const match=evidence(niche);
 const sources=match.selected;
 return [
 "# DAVYLAB｜赛道研究简报（编辑草稿）","",
 "赛道："+niche,"目标读者："+audience,"目标："+goal,
 "研究阶段：素材发现，尚未独立核验；不是市场规模、竞争强度或粉丝增长预测。",
 "","## 1. 当前公开信息线索",
 sources.length?sources.map((x,i)=>(i+1)+". "+x.title+"（"+x.source+"，"+(x.date||"日期待核实")+"）\n   原文："+x.url).join("\n"):"暂无可用的公开线索；必须先补充原文来源。",
 "","## 2. 待验证的读者问题",
 "- 普通读者在这一领域最想解决哪一个具体问题？需要访谈/评论/实际案例验证。",
 "- 哪些说法可以从上面原始出处复查？哪些是编辑推测？",
 "- DAVYLAB 是否有真实产品、实验、成本或工作场景可提供差异化？不能编造经历。",
 "","## 3. 候选编辑角度",
 ...sources.slice(0,3).map((s,i)=>(i+1)+". "+s.title+" —— 从普通人的实际场景重新解释；事实以原文为准。"),
 "","## 4. 对标与风险",
 "- 当前已保存对标记录："+(typeof benchmarks!=="undefined"?benchmarks.length:0)+"（仅手工观察记录，不代表实际全网竞品数量）。",
 "- 不确定的日期、功能、公司数据和原作者论点均标待核实；不要搬运他人正文。",
 "","## 5. 下一步执行",
 "1. 打开来源、核查发布日期和原文。",
 "2. 从具体读者痛点中选一个切入角度。",
 "3. 在赛道研究中转为候选选题；入池仍为未批准草稿。",
 "4. 完成文章制作并经作者批准后，按智能排期准备公众号草稿。",
 "5. 已发表后在增长实验室录入真实 7/30 日数据。"
 ].join("\n");
}
function download(filename,body){
 const blob=new Blob([body],{type:"text/markdown;charset=utf-8"}),href=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function copy(content,feedback){
 if(!content.trim()){feedback.textContent="先填写内容";return}
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(content).then(()=>feedback.textContent="已复制").catch(()=>feedback.textContent="无法自动复制，请手动选择文本")}
 else feedback.textContent="浏览器不支持自动复制，请手动选择文本";
}
function growthTopics(){return topics.filter(t=>t&&t.title&&t.status!=="published").slice().sort((a,b)=>{
 const as=typeof score==="function"?score(a):60,bs=typeof score==="function"?score(b):60;
 return bs-as||String(b.createdAt||"").localeCompare(String(a.createdAt||""));
 });}
function renderSprint(){
 const select=el("pdGrowthTopic");if(!select)return;
 const value=select.value;
 const candidates=growthTopics();
 select.innerHTML='<option value="">从选题池中选择未发布内容</option>'+candidates.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title.slice(0,80))+' · '+esc(t.format||"文章")+'</option>').join("");
 if(candidates.some(t=>t.id===value))select.value=value;
 const unfinished=growth.experiments.filter(e=>e.status!=="published");
 const due=typeof dueGrowthReviews==="function"?dueGrowthReviews():[];
 el("pdGrowthReady").textContent=candidates.length;
 el("pdGrowthLive").textContent=unfinished.length;
 el("pdGrowthReviewDue").textContent=due.length;
 const list=el("pdExperimentList");
 const connected=growth.experiments.filter(e=>e.sourceTopicId).slice().sort((a,b)=>String(b.createdAt||b.date||"").localeCompare(String(a.createdAt||a.date||""))).slice(0,5);
 list.innerHTML=connected.length?connected.map(e=>'<article class="pd-experiment"><div><strong>'+esc(e.title)+'</strong><p>'+esc(e.experimentQuestion||"已关联选题，等待补充假设")+'</p></div><span>'+esc(e.status==="published"?"已录入发表状态":"待核验")+'</span><button type="button" data-pd-edit="'+esc(e.id)+'">继续编辑</button></article>').join(""):'<div class="pd-empty">还没有与选题直接关联的实验。先从左侧选择现有选题，再创建首个可复盘实验。</div>';
 list.querySelectorAll("[data-pd-edit]").forEach(button=>button.addEventListener("click",()=>{
  const editor=[...document.querySelectorAll("#viralExperimentList [data-viral-edit]")].find(x=>x.dataset.viralEdit===button.dataset.pdEdit);
  if(editor){editor.click();el("viralExperimentForm")?.scrollIntoView({behavior:"smooth",block:"center"});}
  else el("pdGrowthStatus").textContent="未找到实验编辑入口，请从下方实验池打开。";
 }));
}
function selectedTopic(){return topics.find(t=>t.id===el("pdGrowthTopic")?.value)}
function growthCard(){
 const t=selectedTopic();if(!t)return"";
 const mode=el("pdGrowthHypothesis").value,idea=issueTypes[mode]||issueTypes["保存价值"];
 const criterion=plain(el("pdGrowthSignal")?.value,200)||idea.measure;
 const median=typeof growth!=="undefined"?growth.target?.medianViews:"";
 return [
 "# DAVYLAB｜选题增长实验执行卡（未发布）","",
 "选题："+t.title,"形式："+(t.format||"文章"),"计划日期："+(t.plannedDate||"未排期"),
 "关联选题 ID："+t.id,"来源："+(t.sourceUrl||"自有选题/未填写来源"),
 "验证方向："+mode,"可证伪假设："+idea.question,"核心观测指标："+criterion,
 "本机历史阅读中位数："+(median!==null&&median!==undefined&&median!==""?median+"（用户手填，待核验）":"暂无真实记录，不能凭空设置"),
 "","## 可执行任务",
 "1. 核实文章证据、准确表述读者问题，确认内容和视觉方案。",
 "2. 设计两种备选标题，比较表达差异；这不是公众号真实随机 A/B 测试。",
 "3. 内容获得作者批准后，按现有公众号流程发表。",
 "4. 发布后第 7 天记录真实阅读、分享和可归因净增订阅；没有真实数据的字段保持空白。",
 "5. 第 30 天再次复盘，仅根据真实数据判断假设是否得到支持。",
 "","说明：执行卡和实验记录不代表已测试成功或已发布。"
 ].join("\n");
}
function createExperiment(){
 const t=selectedTopic(),status=el("pdGrowthStatus");
 if(!t){status.textContent="先选择选题池中的一条未发布内容。";return}
 if(growth.experiments.some(e=>e.sourceTopicId===t.id&&e.status!=="published")){status.textContent="这条选题已有待跟进实验，请到下方实验池继续完善，避免重复创建。";return}
 const kind=el("pdGrowthHypothesis").value,def=issueTypes[kind]||issueTypes["保存价值"];
 const metric=plain(el("pdGrowthSignal")?.value,180)||def.measure;
 const record={id:typeof growthId==="function"?growthId():"ex_"+Date.now(),
   title:t.title,sourceTopicId:t.id,sourceUrl:t.sourceUrl||"",type:def.type,
   status:"planned",date:t.plannedDate|| (typeof todayLocal==="function"?todayLocal():new Date().toISOString().slice(0,10)),
   views:null,shares:null,follows:null,createdAt:new Date().toISOString(),
   experimentQuestion:def.question,successMetric:metric,
   note:"【待验证假设】"+def.question+"\n【观测指标】"+metric+"\n【来源】"+(t.sourceUrl||"作者已有选题，需补充资料")};
 growth.experiments.unshift(record);
 if(typeof saveGrowth==="function")saveGrowth();
 renderSprint();status.textContent="已创建计划中实验；不会更改文章批准/发表状态。";
 const input=el("viralTitle");if(input)input.value=t.title;
 if(typeof toast==="function")toast("选题已连接到本机增长实验池");
}
function storedBriefs(){
 try{const raw=JSON.parse(localStorage.getItem(BRIEF_STORE)||"[]");return Array.isArray(raw)?raw:[]}catch{return[]}
}
function renderSavedBriefs(){
 const box=el("pdBriefArchive");if(!box)return;
 const list=storedBriefs().slice(0,40);
 if(!list.length){box.innerHTML='<div class="pd-empty">还没有保存的研究简报。生成后点击“保存本机研究档案”，下一次就能继续编辑。</div>';return}
 box.innerHTML=list.map(item=>'<article class="pd-saved"><div><strong>'+esc(plain(item.topic,100)||"未命名研究")+'</strong><small>'+esc(String(item.updatedAt||"").slice(0,16).replace("T"," "))+' · 本机草稿</small></div><div class="pd-actions"><button type="button" data-pd-load="'+esc(item.id)+'">继续编辑</button><button type="button" data-pd-remove="'+esc(item.id)+'">删除</button></div></article>').join("");
 box.querySelectorAll("[data-pd-load]").forEach(button=>button.addEventListener("click",()=>{
  const found=storedBriefs().find(x=>x.id===button.dataset.pdLoad);if(!found)return;
  el("pdResearchQuery").value=found.topic||"";
  el("pdResearchBrief").value=found.body||"";
  el("pdResearchBrief").dataset.briefId=found.id;
  el("pdBriefStatus").textContent="已打开已保存的研究简报，可修改后再次保存。";
  el("pdResearchBrief").scrollIntoView({behavior:"smooth",block:"center"});
 }));
 box.querySelectorAll("[data-pd-remove]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.pdRemove;
  if(!confirm("确认从当前浏览器删除这份研究简报？请先确认已备份。"))return;
  const next=storedBriefs().filter(x=>x.id!==id);
  try{localStorage.setItem(BRIEF_STORE,JSON.stringify(next))}catch{el("pdBriefStatus").textContent="删除失败：本机存储不可写";return}
  if(el("pdResearchBrief").dataset.briefId===id)delete el("pdResearchBrief").dataset.briefId;
  renderSavedBriefs();
  el("pdBriefStatus").textContent="已删除该本地研究档案；编辑框内容暂时保留。";
 }));
}
function initResearch(){
 researchHtml();
 el("pdResearchQuery").value=el("researchNiche")?.value||"";
 el("pdFindSources").addEventListener("click",renderSources);
 el("researchNiche")?.addEventListener("change",()=>{if(!el("pdResearchQuery").value)el("pdResearchQuery").value=el("researchNiche").value;renderSources()});
 el("pdResearchQuery").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();renderSources()}});
 el("pdBuildBrief").addEventListener("click",()=>{
  if(!el("pdResearchQuery").value.trim()&&!el("researchNiche")?.value.trim()){el("pdBriefStatus").textContent="请先选择要研究的赛道或关键词";return}
  el("pdResearchBrief").value=briefText();
  delete el("pdResearchBrief").dataset.briefId;
  el("pdBriefStatus").textContent="已生成编辑框架和真实来源清单；需进一步查原文核实。";
 });
 el("pdCopyBrief").addEventListener("click",()=>copy(el("pdResearchBrief").value,el("pdBriefStatus")));
 el("pdDownloadBrief").addEventListener("click",()=>{
  const value=el("pdResearchBrief").value;if(!value.trim()){el("pdBriefStatus").textContent="先形成研究简报";return}
  download("DAVYLAB_赛道研究简报_"+new Date().toISOString().slice(0,10)+".md",value);
  el("pdBriefStatus").textContent="已导出编辑草稿；未发布。";
 });
 el("pdSaveBrief").addEventListener("click",()=>{
  const value=el("pdResearchBrief").value.trim();if(!value){el("pdBriefStatus").textContent="先生成或填写简报内容";return}
  try{
   let data=storedBriefs();
   const editing=el("pdResearchBrief").dataset.briefId;
   const existing=editing?data.find(x=>x.id===editing):null;
   const saved={id:existing?.id||"r_"+Date.now(),topic:plain(el("pdResearchQuery").value||el("researchNiche")?.value,120),body:value,updatedAt:new Date().toISOString(),status:"draft"};
   data=data.filter(x=>x.id!==saved.id);data.unshift(saved);
   localStorage.setItem(BRIEF_STORE,JSON.stringify(data.slice(0,40)));
   el("pdResearchBrief").dataset.briefId=saved.id;
   renderSavedBriefs();
   el("pdBriefStatus").textContent="已保存本机档案（最多40篇）；可以从下方继续编辑。";
  }catch{el("pdBriefStatus").textContent="本地存储失败，请复制或导出研究简报。"}
 });
 renderSources();renderSavedBriefs();
}
function initGrowth(){
 growthHtml();
 el("pdGrowthHypothesis").addEventListener("change",()=>{const kind=issueTypes[el("pdGrowthHypothesis").value];el("pdGrowthSignal").value=kind.measure});
 el("pdCreateExperiment").addEventListener("click",createExperiment);
 el("pdCopyExperiment").addEventListener("click",()=>copy(growthCard(),el("pdGrowthStatus")));
 el("pdExportExperiment").addEventListener("click",()=>{
   const body=growthCard();if(!body){el("pdGrowthStatus").textContent="请先选择选题";return}
   download("DAVYLAB_增长实验执行卡_"+new Date().toISOString().slice(0,10)+".md",body);
   el("pdGrowthStatus").textContent="已导出实验执行卡，不代表已发布。";
 });
 renderSprint();
}
initResearch();initGrowth();
const oldSaveTopics=saveTopics;
saveTopics=function(){oldSaveTopics();renderSprint();renderSources()};
const oldSaveGrowth=saveGrowth;
saveGrowth=function(){oldSaveGrowth();renderSprint()};
const oldSection=changeSection;
changeSection=function(section){oldSection(section);if(section==="growth")renderSprint();if(section==="research"){renderSources();renderSavedBriefs()}};
const oldOpportunityRender=window.renderOpportunityRadar;
if(typeof oldOpportunityRender==="function"){
 window.renderOpportunityRadar=function(){oldOpportunityRender();if(el("pdSourceList"))renderSources()};
}
window.DAVYLABProductivity={version:"1.0.0",renderSources,renderSprint,briefText,growthCard,createExperiment};
})();