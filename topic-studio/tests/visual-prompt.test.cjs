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
 sourceName:"参考信息待核实",sourceUrl:"https://example.com/source-for-testing-only",
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
assert(plan.text.includes("PLAN_ONLY")&&plan.text.includes("不要声称已生成图片"));
assert(!plan.text.includes("【交付目标｜必须实际执行】"));
const unstyled=engine.build({...topic,visualPlan:undefined});
assert(!unstyled.text.includes("【已保存的配图视觉方案｜必须遵守】"));
assert(unstyled.text.includes("未保存专属配图方案"));
const unknownVersion=engine.build({...topic,visualPlan:{version:999,name:"不应该出现"}});
assert(!unknownVersion.text.includes("不应该出现"));
assert.throws(()=>engine.build(null),/有效选题/);
console.log("PASS: Vibe Coding production prompt, 4 target AI gates, style inheritance, real ZIP contract, planning fallback");
