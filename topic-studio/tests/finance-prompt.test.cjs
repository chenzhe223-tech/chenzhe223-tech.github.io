"use strict";
const assert=require("node:assert/strict");
const engine=require("../ai-production-prompt.js");
const finance={id:"test-1",title:"某公司披露季度业绩",sourceUrl:"https://www.sec.gov/Archives/edgar/data/test",sourceName:"SEC",summary:"官方公告链接待进一步核验",format:"贴图",origin:"finance"};
assert.equal(engine.financeStyles.length,6);
assert.equal(new Set(engine.financeStyles.map(x=>x.id)).size,6);
for(const style of engine.financeStyles){
 assert.match(style.background,/^#[a-f\d]{6}$/i);
 assert.match(style.primary,/^#[a-f\d]{6}$/i);
 const p=engine.build(finance,{mode:"finance",platform:"chatgpt",style:style.id,posterCount:2});
 assert.equal(p.mode,"finance");assert.equal(p.posterCount,2);assert.equal(p.style,style.id);
 assert.ok(p.text.includes("100～300字"));assert.ok(p.text.includes("不是长篇文章"));
 assert.ok(p.text.includes("第2张"));assert.ok(p.text.includes("真正独立"));
 assert.ok(!p.text.includes("完整文章：产出"));
 assert.ok(p.text.includes("不构成投资建议"));
}
assert.equal(engine.build(finance,{mode:"finance",posterCount:99}).posterCount,3);
assert.equal(engine.build(finance,{mode:"finance",posterCount:0}).posterCount,1);
assert.equal(engine.build(finance,{mode:"planning"}).mode,"planning");
assert.equal(engine.build(finance,{mode:"production"}).mode,"production");
console.log("PASS finance modes, six visual styles, 1-3 independent posters, original modes retained");
