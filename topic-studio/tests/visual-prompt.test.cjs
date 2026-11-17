"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const from=html.indexOf("function visualPlanPromptLines(t){");
const to=html.indexOf("function copyText(v,ok){",from);
assert(from>=0&&to>from,"Visual plan formatter and article prompt must be available");
const code=html.slice(from,to);
const fields={promptBox:{value:""}};
const context={$:id=>fields[id]};
vm.runInNewContext(code,context,{filename:"visual-plan-prompt.js"});
const topic={
 id:"visual-qa-topic",title:"近期 vibe coding 很火爆",angle:"解释 Vibe Coding 的实际价值",
 visualPlan:{
  version:1,name:"极简产品风",background:"#F6F8FB",primary:"#264769",accent:"#55A7C4",text:"#17212C",
  mood:"清晰专业",texture:"苹果式极简几何",typography:"精炼产品标题",
  composition:"一个产品核心界面为主，四周留白",details:"真实产品界面",avoid:"假截图",
  artDirection:"保留应用结构",extra:"封面禁止渐变",reviewStatus:"draft",assetStatus:"not_generated"
 }
};
context.showPrompt(topic);
for(const value of ["【已保存的配图视觉方案｜必须遵守】","极简产品风","#F6F8FB","#264769","#55A7C4",
 "#17212C","苹果式极简几何","一个产品核心界面为主，四周留白","假截图","保留应用结构","封面禁止渐变"]){
 assert(fields.promptBox.value.includes(value),"Missing saved style field: "+value);
}
assert(fields.promptBox.value.indexOf("【已保存的配图视觉方案")<fields.promptBox.value.indexOf("【配图规划】"),"Saved style must appear before generic planning");
const saved=fields.promptBox.value;
assert(saved.includes("尚不代表封面或正文配图已经生成"),"Prompt must not claim images exist");
context.showPrompt({...topic,visualPlan:undefined});
assert(!fields.promptBox.value.includes("【已保存的配图视觉方案"),"No saved plan should not invent a style");
assert(fields.promptBox.value.includes("【配图规划】"),"Generic planning should remain for unsaved topics");
context.showPrompt({...topic,visualPlan:{version:2,name:"未支持的版本"}});
assert(!fields.promptBox.value.includes("未支持的版本"),"Unknown versions should not be treated as saved plans");
console.log("PASS: saved visual plan propagated to AI prompt, unsaved topic fallback and version gate");
