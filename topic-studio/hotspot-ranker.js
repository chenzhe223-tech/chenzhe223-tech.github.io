/* DAVYLAB hotspot ranker — pure, testable editorial scoring.
 * A recommendation score is NOT internet-wide popularity, WeChat traffic or a market forecast.
 * Source records are verified public METADATA only; links must be checked before publication.
 * UMD: Node test via require(), browser via window.DAVYLABHotspotRanker.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.DAVYLABHotspotRanker=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const version="1.0.0";
const lanes=[
 {id:"agent-workflows",name:"智能体进入真实工作流",audience:"想把重复工作交给 AI 的普通职场人",promise:"讲清楚哪些任务可以自动执行、哪些必须人工确认",action:"用同一项真实任务对比手动流程、AI 流程和人工验收",fit:15,pattern:/agent|智能体|agentic|workflow|工作流|自动化|orchestrat|autonomous|调度/ig},
 {id:"multi-agent",name:"多智能体协作与任务分工",audience:"搭建专业 Agent 的非程序员学习者",promise:"解释多人协作式 AI 何时有效、何时徒增成本",action:"设计一个双 Agent 与单 Agent 的可复现实验",fit:14,pattern:/multi.agent|多智能体|multiagent|coordina|协作|worker|manager agent|delegat|agent team/ig},
 {id:"coding",name:"AI 编程与真实应用交付",audience:"不懂代码但想做应用的人",promise:"从生成网页走向调试、测试和真正部署",action:"选择一个开源功能进行可复现的完成度对照",fit:15,pattern:/coding|code|代码|编程|cursor|claude code|codex|vibe.cod|devtool|developer tool|ide|git diff/ig},
 {id:"personal-software",name:"普通人的个人软件机会",audience:"有想法但没有软件团队的创作者",promise:"挖掘非技术人员也能构建的真实生产力工具",action:"把一个实际工作痛点拆成最小工具和验收清单",fit:15,pattern:/personal software|个人软件|nocode|no.code|non.engineer|非工程师|app builder|one.person|indie|独立开发|应用制作/ig},
 {id:"skills",name:"Skill 与 AI 工具技能化",audience:"想复用开源技能而不是反复写提示词的人",promise:"从技能文件到原生应用能力的落地路径",action:"验证一个公开 Skill 的输入输出、依赖和失败处理",fit:15,pattern:/skill|mcp|plugin|插件|开源技能|tool calling|工具调用|tool use/ig},
 {id:"models",name:"大模型新能力与评测真相",audience:"不知道该选择哪家 AI 模型的普通用户",promise:"把模型榜单、价格和适用任务讲明白",action:"用相同任务做小样本评测并说明边界",fit:12,pattern:/gemini|gpt[\s-]?\d|claude|deepseek|llm|大模型|模型评测|benchmark|token|inference|推理模型|openai|anthropic/ig},
 {id:"safety",name:"AI 安全、隐私与可靠性",audience:"用 AI 处理真实资料的个人和企业",promise:"理解幻觉、泄露、提示词攻击与人工审查",action:"用脱敏样例做数据边界与越权测试",fit:14,pattern:/security|safety|alignment|cyber|红队|安全|隐私|prompt inject|注入|越狱|risk|风险|jailbreak|verified|verify/ig},
 {id:"research",name:"AI 科研与可验证发现",audience:"关注科学突破又不想被标题带偏的读者",promise:"区分真实科研成果、模型辅助和未经证实的发现",action:"逐项核对论文、实验条件和同行验证",fit:12,pattern:/science|scientif|科研|论文|research|paper|math|mathematic|biology|genomic|protein|physics|考古|arxiv/ig},
 {id:"robotics",name:"具身智能与机器人走向现实",audience:"对机器人改变生活和工作感兴趣的人",promise:"看清演示视频与实际部署之间的距离",action:"研究真实机器人演示的测试环境与成功率口径",fit:12,pattern:/robot|机器人|具身|physical ai|embodied|gr00t|humanoid|自动驾驶|robotic/ig},
 {id:"open-source",name:"开源 AI 项目深度实测",audience:"希望用免费工具解决实际问题的学习者",promise:"把热门仓库还原成能否安装、能否用、怎么用",action:"选择开源项目记录安装、许可和失败场景",fit:15,pattern:/github|open.source|开源|repository|repo|hugging.face|self.host|自托管|docker|license|开源项目/ig},
 {id:"business",name:"AI 创业与商业模式验证",audience:"准备把 AI 工具做成产品的创作者",promise:"从真实付费价值、获客和成本看商业机会",action:"拆解公开案例与可核实的业务指标",fit:14,pattern:/AI startup|AI创业|AI 创业|AI business|AI 商业|AI SaaS|创业|business model|商业模式|moneti|付费|融资|营收|revenue|用户增长|saas/ig},
 {id:"content",name:"AI 创作、内容和视觉表达",audience:"公众号作者与独立内容创作者",promise:"把 AI 生成变为稳定、可检查的原创内容流程",action:"同一主题做两种视觉方案与可读性验证",fit:14,pattern:/image|video|design|visual|画图|设计|漫画|海报|生图|视频|内容创作|imagegen|visual generation|motion|animation/ig},
 {id:"memory",name:"Agent 记忆、检索和知识管理",audience:"需要让 AI 长期理解项目背景的人",promise:"解释记忆/RAG/知识库的工作机理和局限",action:"比较无记忆与可检索上下文的真实任务结果",fit:15,pattern:/memory|记忆|rag|retriev|知识库|long.context|上下文|context window|向量|vector|持久化/ig},
 {id:"education",name:"普通人的 AI 学习方法",audience:"没有编程基础又持续学习 AI 的人",promise:"把新术语和前沿技术拆成能照做的课程",action:"将新闻转成三层讲解、练习题和实际操作",fit:15,pattern:/education|learning app|学习工具|学习方法|AI 学习|学(?:习|院|校)|教育|课程|academy|teach|tutorial|beginner|小白|教师|学生/ig},
 {id:"infrastructure",name:"AI 算力、芯片与使用成本",audience:"做采购成本分析和 AI 产品选择的职场人",promise:"理解芯片、算力、推理费用对实际工具成本的影响",action:"对官方公开价格和实际使用量做透明测算",fit:14,pattern:/chip|gpu|芯片|算力|hardware|计算成本|compute|inference cost|api price|token pric|cost|成本|英伟达|nvidia/ig},
 {id:"enterprise",name:"AI 进入传统企业与专业行业",audience:"来自工程、采购、财务和运营行业的人",promise:"把行业经验与自动化工具结合起来，而不是空谈取代",action:"选取实际流程定义输入、审批和可审计结果",fit:15,pattern:/enterprise|retail|procurement|采购|造价|财务|传统行业|企业应用|企业工作流|企业采购|医疗|法律|行业场景|business operations|customer support/ig},
 {id:"verification",name:"AI 可验证工程与质量验收",audience:"希望 AI 产出可信赖软件与结果的人",promise:"把测试、回归、验收和形式化证明解释清楚",action:"制定一套失败不可降标的测试矩阵",fit:15,pattern:/formal verification|lean|proof|verification|verified|test|qa|质量|测试|验收|质量保障|代码审查|checkwash/ig},
];
const MAX_DAYS=30;
function clean(v,n=220){return String(v??"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n)}
function safeUrl(v){
 try{const u=new URL(String(v||""));if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return"";
  if(u.hostname==="localhost"||u.hostname.endsWith(".local"))return"";
  if(/^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname))return"";
  u.hash="";for(const k of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/.test(k))u.searchParams.delete(k);
  return u.href.replace(/\/$/,"");
 }catch{return""}
}
function sourceGroup(x){
 if(x.kind==="hackernews")return"Hacker News";
 if(x.kind==="github")return"GitHub Search";
 if(x.origin==="xnews"||/XNews/.test(String(x.source)))return"XNews";
 return"AI Radar";
}
function normalise(input,now=new Date()){
 const seen=new Map();
 for(const r of Array.isArray(input)?input:[]){
  if(!r||typeof r!=="object")continue;
  const link=safeUrl(r.url||r.original_url),title=clean(r.title||r.name,185);
  if(!link||title.length<6)continue;
  let date="",days=MAX_DAYS+1;
  const iso=r.published||r.date||r.updated||"";
  if(iso){const d=new Date(iso);if(Number.isFinite(d.getTime())){date=d.toISOString();days=Math.floor((now.getTime()-d.getTime())/86400000);}}
  if(days < -1 || days>MAX_DAYS)continue;
  const scoreValue=(v)=>(v===null||v===undefined||v==="")?null:(Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=10000000?Number(v):null);
  const record={
    title,summary:clean(r.summary||r.description||r.why,340),
    url:link,originalUrl:link,source:clean(r.source||"公开来源",80),
    group:sourceGroup(r),published:date,days,
    hnPoints:scoreValue(r.hn_points),hnComments:scoreValue(r.hn_comments),
    githubStars:scoreValue(r.github_stars),discussionUrl:safeUrl(r.discussion_url),
    tags:Array.isArray(r.tags)?r.tags.map(x=>clean(x,40)).slice(0,8):[],
  };
  if(!seen.has(link)){seen.set(link,record);continue}
  const old=seen.get(link);
  old.groups=[...new Set([...(old.groups||[old.group]),record.group])];
  old.hnPoints=Math.max(old.hnPoints??0,record.hnPoints??0)||old.hnPoints||record.hnPoints;
  old.hnComments=Math.max(old.hnComments??0,record.hnComments??0)||old.hnComments||record.hnComments;
  old.githubStars=Math.max(old.githubStars??0,record.githubStars??0)||old.githubStars||record.githubStars;
  old.discussionUrl=old.discussionUrl||record.discussionUrl;
  old.published=old.days<=record.days?old.published:record.published;
  old.days=Math.min(old.days,record.days);
  if(record.summary.length>old.summary.length)old.summary=record.summary;
  old.tags=[...new Set([...old.tags,...record.tags])].slice(0,12);
 }
 return [...seen.values()];
}
function laneMatches(lane,record){
 const title=record.title+" "+record.tags.join(" "),body=record.summary;
 lane.pattern.lastIndex=0;const t=(title.match(lane.pattern)||[]).length;
 lane.pattern.lastIndex=0;const b=(body.match(lane.pattern)||[]).length;
 return Math.min(8,t*3+b);
}
function freshness(days){
 return days<0?0:days<=1?30:days<=3?25:days<=7?20:days<=14?12:days<=21?7:days<=30?3:0;
}
function engagement(evidence){
 // Monotonic capped evidence score; NOT a cross-platform equivalence of HN and GitHub.
 const hn=evidence.filter(x=>x.hnPoints!==null||x.hnComments!==null);
 const gh=evidence.filter(x=>x.githubStars!==null);
 const maxHn=hn.length?Math.max(...hn.map(x=>Math.log1p((x.hnPoints||0))*2+Math.log1p((x.hnComments||0))*1.5)):0;
 const maxGh=gh.length?Math.max(...gh.map(x=>Math.log1p(x.githubStars||0)*2.3)):0;
 return Math.min(20,Math.round(Math.max(maxHn,maxGh)));
}
function scoreLane(lane,evidence,mode="balanced"){
 const latest=Math.min(...evidence.map(x=>x.days<0?31:x.days));
 const channels=new Set(evidence.flatMap(x=>x.groups||[x.group]));
 const totals=evidence.length;
 const dates=evidence.map(x=>x.days).filter(d=>d>=0).sort((a,b)=>a-b);
 const representativeAge=dates[Math.min(2,dates.length-1)]??31;
 const f=Math.round(freshness(latest)*.55+freshness(representativeAge)*.45);
 const breadth=Math.min(25,Math.min(13,channels.size*3)+Math.min(12,Math.round(4*Math.log2(1+totals))));
 const signals=engagement(evidence);
 const useful=lane.fit||12;
 const trace=Math.min(10,evidence.filter(x=>x.url&&x.published).length*3+Math.min(channels.size,2));
 const multiplier=mode==="discussion"?{fresh:0.75,breadth:1,signals:1.75,utility:.65,trace:.5}:
  mode==="practical"?{fresh:.7,breadth:.8,signals:.5,utility:1.9,trace:1}:{
  fresh:1,breadth:1,signals:1,utility:1.25,trace:1};
 const weighted={freshness:Math.round(f*multiplier.fresh),channelCoverage:Math.round(breadth*multiplier.breadth),observableDiscussion:Math.round(signals*multiplier.signals),readerFit:Math.round(useful*multiplier.utility),sourceTrace:Math.round(trace*multiplier.trace)};
 const total=Math.min(100,Object.values(weighted).reduce((sum,n)=>sum+n,0));
 return{total,parts:weighted,raw:{freshness:f,channelCoverage:breadth,observableDiscussion:signals,readerFit:useful,sourceTrace:trace},
        days:latest,count:totals,channels:[...channels]};
}
function rank(raw,options={}){
 const now=options.now instanceof Date?options.now:new Date();
 const mode=["balanced","discussion","practical"].includes(options.mode)?options.mode:"balanced";
 const days=Number(options.days||14);
 const age=[7,14,30].includes(days)?days:14;
 const signals=normalise(raw,now).filter(x=>x.days<=age);
 const lanesFound=[];
 for(const lane of lanes){
  const matched=signals.map(r=>({...r,relevance:laneMatches(lane,r)}))
   .filter(r=>r.relevance>0)
   .sort((a,b)=>b.relevance-a.relevance||a.days-b.days);
  if(!matched.length)continue;
  const chosen=matched.slice(0,8);
  const scored=scoreLane(lane,chosen,mode);
  lanesFound.push({id:lane.id,name:lane.name,audience:lane.audience,promise:lane.promise,
    action:lane.action,mode,score:scored.total,breakdown:scored.parts,
    evidenceCount:matched.length,channels:scored.channels,latestDays:scored.days,
    evidence:chosen.slice(0,4),kind:"赛道方向",sourceVerified:false});
 }
 lanesFound.sort((a,b)=>b.score-a.score||b.evidenceCount-a.evidenceCount||a.id.localeCompare(b.id));
 const result=lanesFound.slice(0,10);
 // When fewer than 10 distinct evidenced lanes exist, offer source-specific topical
 // options, explicitly labelled "单来源专题" (NOT fabricated long-term niche demand).
 if(result.length<10){
  const used=new Set(result.flatMap(x=>x.evidence.slice(0,1).map(e=>e.url)));
  const extra=signals.slice().sort((a,b)=>a.days-b.days||engagement([b])-engagement([a]));
  for(const s of extra){
   if(result.length===10)break;
   if(used.has(s.url))continue;used.add(s.url);
   const title="新闻专题｜"+s.title.slice(0,44);
   result.push({id:"story-"+result.length+"-"+s.url,name:title,
     audience:"关注 AI 新动态的非程序员读者",promise:"将一条可核查的热点解释为普通人能理解的问题",
     action:"核查原文、厘清技术边界并撰写一篇独立解读",mode,
     score:Math.min(80,Math.round(freshness(s.days)*.8+engagement([s])*.5+17)),
     breakdown:{freshness:freshness(s.days),channelCoverage:3,observableDiscussion:engagement([s]),readerFit:12,sourceTrace:s.published?4:1},
     evidenceCount:1,channels:s.groups||[s.group],latestDays:s.days,evidence:[s],kind:"单来源专题 · 待进一步验证",sourceVerified:false});
  }
 }
 result.sort((a,b)=>b.score-a.score||b.evidenceCount-a.evidenceCount||a.name.localeCompare(b.name,"zh-CN"));
 return{recommendations:result.map((r,i)=>({...r,rank:i+1})),available:signals.length,domains:new Set(signals.flatMap(x=>x.groups||[x.group])).size,
    periodDays:age,mode,generatedAt:now.toISOString(),sourceCount:signals.length,expected:10,
    warning:result.length<10?"有效来源不足，只展示有真实链接的候选，不补造假热点。":"",
    methodology:"编辑推荐分（0–100，规则计算）= 时效 + 来源渠道覆盖 + 可观测平台讨论信号 + 读者适配 + 原文可追溯；不是全网热度或公众号涨粉预测。Hacker News points/comments 与 GitHub stars 为不同平台指标。"};
}
return {version,lanes:lanes.map(({pattern,...r})=>r),rank,normalise,scoreLane,laneMatches};
});
