"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../ai-production-prompt.js");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert(html.includes('id="promptMode"')&&html.includes('id="promptPlatform"'),"Mode/platform selector must be present");
assert(html.includes('id="promptManifestPreview"'),"Manifest preview must be present");
assert(html.includes("DAVYLABProductionPrompt.build(t"),"Topic card prompt must call production engine");
assert(html.includes('ai-production-prompt.js?v='),"Production module must be loaded");

const topic={
 id:"vibe-coding-case",title:"Vibe Coding 爆火",angle:"普通人如何借助 AI 将创意变成实际可用的小工具",
 summary:"解释概念、优势、边界和真实工作方式，不编造未经验证的个人案例",
 updatedAt:"2026-11-17T12:00:00Z",sourceName:"参考信息待核实",sourceUrl:"https://example.com/source-for-testing-only",
 column:"DAVYLAB 的 AI 实验室",format:"文章",wordCount:"2200字",
 targetAudience:"没有编程基础的 AI 学习者",
 writingStyle:"第一人称学习者，讲清楚技术边界",
 notes:"保留真实实践案例，数据尚待核查",
 revisionHistory:[{at:"2026-11-17",note:"标题改为Vibe Coding 爆火"}],
 specialRequirements:"不要伪造产品截图",
 visualPlan:{version:1,name:"极简产品风",preset:"minimal",
 background:"#F6F8FB",primary:"#264769",accent:"#55A7C4",text:"#17212C",
 mood:"清晰专业",texture:"苹果式极简几何",typography:"精炼产品标题",
 composition:"一个产品核心界面为主，四周留白",details:"只使用真实已验证的界面",
 avoid:"假截图、虚构产品能力",artDirection:"保留应用结构",extra:"封面禁止渐变",
 reviewStatus:"draft",assetStatus:"not_generated"}
};
for(const platform of ["chatgpt","claude","gemini","other"]){
 const full=engine.build(topic,{platform});
 assert.equal(full.mode,"production");
 assert.equal(full.platform,platform);
 assert.equal(full.manifest.length,8);
 for(const fragment of [
  "Vibe Coding 爆火","2200字","没有编程基础的 AI 学习者","第一人称学习者","选题最后更新",
  "极简产品风","#F6F8FB","#264769","#55A7C4","#17212C",
  "一个产品核心界面为主，四周留白","封面禁止渐变","不要伪造产品截图",
  "事实研究 → 文章创作 → 真实生图 → 图文排版 → 素材打包 → QA 验收 → ZIP 下载",
  "01_公众号完整成稿.md","02_公众号排版预览.html","03_使用说明.txt","04_事实核查与来源.md",
  "images/00_封面.jpg","images/01_正文配图.jpg","images/02_正文配图.jpg","images/03_正文配图.jpg",
  "900×383","1080px","ZIP 真正存在","可解压","真实下载链接","BLOCKED","图片状态"
 ]){
  assert(full.text.includes(fragment),"Missing P0 requirement: "+fragment+" in "+platform);
 }
 assert(!full.text.includes("先输出 1 张封面与 2–4 张正文插图规划。"),"Old planning-only prompt must not remain");
 assert(full.text.includes(engine.PLATFORMS[platform].note),"Platform capability gate must be included");
}
const defaultResult=engine.build(topic);
assert.equal(defaultResult.mode,"production");
assert.equal(defaultResult.platform,"chatgpt");
const plan=engine.build(topic,{mode:"planning",platform:"gemini"});
assert.equal(plan.mode,"planning");
assert.equal(plan.manifest.length,0);
assert.equal(plan.requiresFullCapability,false);
assert.deepEqual(plan.capabilityRequirements,engine.planningRequired);
assert.equal(plan.deliverables.length,5);
for(const text of ["【B｜内容策划模式｜独立交付标准】","事实研究及选题分析","备选标题","文章大纲","配图策划","编辑建议","风险","生图提示词","极简产品风","#264769","作者修改记录"]){
 assert(plan.text.includes(text),"Planning mode must preserve "+text);
}
for(const forbidden of ["【交付目标｜必须实际执行】","实际压缩上述根目录为","images/00_封面.jpg","只有所有核心项 PASS"]){
 assert(!plan.text.includes(forbidden),"Planning mode must exclude production requirement "+forbidden);
}
assert(!plan.capabilityRequirements.includes("ZIP 创建、解压验证、下载链接"));
assert(engine.build(topic,{mode:"production"}).text.includes("ZIP 真正存在"));
assert(engine.build(topic,{mode:"planning"}).text.includes("不要声称已生成图片"));

assert(plan.text.includes("PLAN_ONLY")&&plan.text.includes("不要声称已生成图片"));
assert(!plan.text.includes("【交付目标｜必须实际执行】"));
const unstyled=engine.build({...topic,visualPlan:undefined});
assert(!unstyled.text.includes("【已保存的配图视觉方案｜必须遵守】"));
assert(unstyled.text.includes("未保存专属配图方案"));
const unknownVersion=engine.build({...topic,visualPlan:{version:999,name:"不应该出现"}});
assert(!unknownVersion.text.includes("不应该出现"));
assert.throws(()=>engine.build(null),/有效选题/);
console.log("PASS: Vibe Coding production prompt, 4 target AI gates, style inheritance, real ZIP contract, planning fallback");

// Dual-mode UI acceptance contract: generator must be isolated from delivery statuses.
for(const id of ["generatePrompt","promptInstructionStatus","promptAssetStatus","promptQaStatus","promptMode","promptPlatform"]){
 assert(html.includes('id="'+id+'"'),"Missing independent UI control: "+id);
}
assert(html.includes('data-prompt-mode="production"')&&html.includes('data-prompt-mode="planning"'),"Visible A/B mode choices required");
assert(html.includes('let promptTopicId=')&&html.includes('promptDrafts=new Map()'),"Prompt drafts must remain session-scoped");
assert(html.includes('promptSourceVersions'),"Saved topic visual changes must invalidate stale prompts");
assert(html.includes('promptAssetStatus").textContent="素材生产未确认"'),"Generation must not claim external assets complete");
assert(html.includes('promptQaStatus").textContent="素材验收未通过"'),"Generation must not claim external QA success");


/* Continuity: synthetic sources only; no private article data in the repository. */
{
 const series={seriesId:"qa-s",seriesName:"智能体测试系列",mode:"series",version:1};
 const first={id:"qa-1",title:"工具调用",status:"published",publishedArticleUrl:"https://example.com/qa-article",continuity:{...series,order:1},continuityMemory:{state:"published",body:"已讲解工具调用原理。",covered:"工具调用",examples:"预约示例",questions:"执行失败怎么办"}};
 const second={id:"qa-2",title:"执行恢复",status:"ready",continuity:{...series,order:2,newValue:"恢复策略"},continuityMemory:{state:"final",body:"解释重试和检查点。"}};
 const third={id:"qa-3",title:"质量评估",status:"inbox",continuity:{...series,order:3,refs:["t:qa-1"],newValue:"评估机制",avoid:"不重复预约示例"}};
 const topics=[first,second,third],pubs=[{id:"qa-p",title:first.title,url:first.publishedArticleUrl,linkedTopicId:first.id,publishedAt:"2026-11-01",summary:"测试摘要"}],reviews=[{url:first.publishedArticleUrl,checkpoint:7,reads:100,shares:2,follows:0,reviewDate:"2026-11-08"}];
 const ctx=engine.resolveContinuity(third,topics,pubs,reviews);
 assert.equal(ctx.items.length,2);assert.equal(ctx.items[0].body,"已讲解工具调用原理。");assert.equal(ctx.items[0].reviewMetrics[0].reads,100);assert.equal(ctx.items[1].status,"ready");
 const p=engine.build(third,{continuityContext:ctx}).text;
 for(const x of ["连续创作上下文","评估机制","预约示例","独立可读","连续性 QA","ZIP 真正存在"])assert(p.includes(x),x);
 assert(!engine.build(third,{mode:"finance",continuityContext:ctx}).text.includes("连续创作上下文"));
 assert(engine.build(third,{mode:"planning",continuityContext:ctx}).text.includes("连续性 QA"));
 assert(!engine.build({...third,continuity:{mode:"independent"}},{continuityContext:engine.resolveContinuity({...third,continuity:{mode:"independent"}},topics,pubs)}).text.includes("连续创作上下文"));
 const cyclic={...first,continuity:{...first.continuity,refs:["t:qa-3"]}};
 assert(engine.validateContinuity(cyclic,[cyclic,second,third]).some(x=>x.includes("循环")));
 const dup={...third,continuity:{...third.continuity,order:2}};
 assert(engine.validateContinuity(dup,[first,second,dup]).some(x=>x.includes("重复")));
 const missing={id:"qa-4",title:"缺失",continuity:{mode:"followup",refs:["t:missing"],newValue:"新增价值"}};
 assert.equal(engine.resolveContinuity(missing,topics,pubs).missing.length,1);
 const summaryOnly={...second,continuityMemory:undefined};assert.equal(engine.resolveContinuity({...third,continuity:{...third.continuity,refs:[]}},[first,summaryOnly,third],pubs).items[0].evidence,"仅有摘要/选题资料，未取得原文");
 const long={...first,continuityMemory:{state:"published",body:"头".repeat(3000)+"尾".repeat(3000)}};
 assert(engine.resolveContinuity(second,[long,second],pubs).items[0].body.includes("中间省略，非全文"));
 console.log("Continuity synthetic regression passed");
}


/* Drive contract tests use an in-memory API double, never a user's Google account. */
(async()=>{
 const drive=require("../google-drive-sync.js");
 assert.equal(drive.SCOPE,"https://www.googleapis.com/auth/drive.file");
 const files=new Map();let seq=0,mismatch=false;
 const hash=async s=>require("node:crypto").createHash("sha256").update(s).digest("hex");
 const request=async(raw,opt={})=>{
  const u=new URL(raw),id=u.pathname.split("/").pop(),method=opt.method||"GET";
  if(method==="GET"&&u.searchParams.has("q")){
   const q=u.searchParams.get("q");let arr=[...files.values()];
   for(const m of q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g))arr=arr.filter(f=>f.appProperties?.[m[1]]===m[2]);
   const parent=q.match(/'([^']+)' in parents/);if(parent)arr=arr.filter(f=>f.parents?.includes(parent[1]));
   if(q.includes("mimeType = 'application/vnd.google-apps.folder'"))arr=arr.filter(f=>f.mimeType==="application/vnd.google-apps.folder");
   return {files:arr};
  }
  if(method==="POST"||method==="PATCH"){
   const meta=opt.json||opt.multipart.metadata;
   const f={...(method==="PATCH"?files.get(id):{}),...meta,id:method==="PATCH"?id:"mock"+(++seq),modifiedTime:"2026-11-27T00:00:00Z"};
   if(opt.multipart)f.body=opt.multipart.text;
   files.set(f.id,f);return {...f};
  }
  const f=files.get(id);if(!f)throw Error("mock missing id");
  if(opt.asText)return mismatch?"incorrect bytes":f.body;
  return {...f,webViewLink:"https://drive.google.com/open?id="+id};
 };
 const client=drive.makeClient({request,hash,now:()=>new Date("2026-11-27T00:00:00Z")});
 const base={topic:{id:"synthetic-drive",title:"测试 / 选题",continuity:{mode:"series",seriesId:"s1",seriesName:"测试系列",order:2}},mode:"production",platform:"gemini",text:"完整指令\n包含中文与排版信息",strategy:"update"};
 const a=await client.sync(base);
 assert.equal(a.action,"created");assert(a.path.includes("系列连载 / 测试系列 / 02_"));assert.equal(files.get(a.id).body,base.text);
 const b=await client.sync({...base,text:"手动编辑后的完整指令"});
 assert.equal(a.id,b.id);assert.equal(b.action,"updated");assert.equal(files.get(a.id).body,"手动编辑后的完整指令");
 const c=await client.sync({...base,strategy:"version"});assert.notEqual(c.id,a.id);assert(c.name.includes("2026-11-27"));assert.equal(files.get(a.id).body,"手动编辑后的完整指令");
 const d=await client.sync({...base,platform:"claude"});assert.notEqual(d.id,a.id);
 const e=await client.sync({...base,mode:"finance",variant:"style:2"});assert(e.path.includes("财经资讯"));
 assert.equal(drive.plan({...base.topic,continuity:{mode:"followup"}},"production","chatgpt").category,"热门文章续写");
 assert.equal(drive.plan({id:"free",title:"普通选题"},"planning","chatgpt").category,"独立文章");
 mismatch=true;await assert.rejects(()=>client.sync(base),/回读核验未通过/);
 console.log("Drive archive mock regression passed: create, update, history, classification, isolation, readback failure.");
})().catch(e=>{console.error(e);process.exitCode=1});
