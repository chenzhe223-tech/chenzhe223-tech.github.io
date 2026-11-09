"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const base = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(base, "index.html"), "utf8");
const engine = fs.readFileSync(path.join(base, "opportunity-engine.js"), "utf8");
const radar = JSON.parse(fs.readFileSync(path.join(base, "..", "radar", "data", "latest.json"), "utf8"));
const ids = new Set([...html.matchAll(/\bid="([A-Za-z][A-Za-z0-9_-]+)"/g)].map(x => x[1]));
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x => x[1]);
assert(scripts.length >= 2, "Missing page scripts");
scripts.forEach((code, i) => new vm.Script(code, {filename:"index-inline-"+i+".js"}));
new vm.Script(engine, {filename:"opportunity-engine.js"});
for (const id of [...engine.matchAll(/\$op\(["']([^"']+)["']\)/g)].map(x => x[1])) {
  if (id === "opRetry" || id === "opGrowthJump") continue;
  assert(ids.has(id), "Engine references missing DOM id: "+id);
}
const inline = scripts.join("\n");
for (const id of [...inline.matchAll(/\$\(["']([A-Za-z0-9_-]+)["']\)/g)].map(x => x[1])) {
  assert(ids.has(id), "Page code references missing DOM id: "+id);
}
for (const name of ["discover","research","library","calendar","published","workflow","growth"]) {
  assert(ids.has("section-"+name),"Missing section "+name);
}
assert(html.includes('class="section active" id="section-discover"'), "Discover section is not initially active");
assert(html.includes('src="./opportunity-engine.js"'), "Engine is not loaded");
assert(Array.isArray(radar.news) && radar.news.length > 0, "Radar has no genuine news");
assert(Array.isArray(radar.china_ai_news), "Missing China news list");
assert(Array.isArray(radar.skills), "Missing skill list");

const nodes = new Map(), registry = {add:[],week:[],prompt:[]};
function node(id) {
 if (nodes.has(id)) return nodes.get(id);
 const e = {
  id,innerHTML:"",textContent:"",value:"",hidden:false,events:{},
  classList:{toggle(){},add(){},remove(){}},setAttribute(){},focus(){},scrollIntoView(){},
  querySelectorAll(selector) {
   const desc = {"[data-op-add]":["op-add","opAdd","add"],"[data-week-add]":["week-add","weekAdd","week"],"[data-op-prompt]":["op-prompt","opPrompt","prompt"]}[selector];
   if (!desc) return [];
   const matches = [...this.innerHTML.matchAll(new RegExp("data-"+desc[0]+'="(\\d+)"',"g"))];
   return matches.map(m=>{
    const btn = {dataset:{[desc[1]]:m[1]},addEventListener(event,fn){if(event==="click"){this.click=fn;registry[desc[2]].push(this);}}};
    return btn;
   });
  },
  addEventListener(event,fn){this.events[event]=fn;}
 };
 nodes.set(id,e);return e;
}
const feed = [
 {type:"news",title:"<img src=x onerror=alert(1)> Agent 发布",summary:"给普通人的 Agent 工作流",angle:"怎样应用 AI Agent",source:"Example News",url:"https://example.org/agent",published:new Date().toISOString()},
 {type:"skills",title:"AI 工具教程",summary:"如何部署",angle:"一步步使用开源 Skill",source:"GitHub",url:"https://github.com/example/skill",published:new Date().toISOString()},
 {type:"china",title:"AI 行业实践",summary:"普通人如何使用 AI",angle:"真实业务中的机会",source:"Example China",url:"https://example.org/china",published:new Date().toISOString()},
 {type:"news",title:"unsafe",summary:"unsafe",angle:"bad",source:"bad",url:"javascript:alert(1)",published:new Date().toISOString()}
];
const win = {},savedTopics=[],settings=new Map();
const env = {
 document:{getElementById:node,querySelectorAll(){return[]}},
 window:win,URL,location:{href:"https://chenzhe223-tech.github.io/topic-studio/"},
 localStorage:{getItem:k=>settings.get(k)||null,setItem:(k,v)=>settings.set(k,v)},
 feedCache:feed,radarData:{report_date:"2026-11-08"},
 radarTheme:x=>x.type==="skills"?"products":x.type==="china"?"business":"agents",
 topics:savedTopics,
 addFeed(x){savedTopics.push({sourceUrl:x.url})},
 showPrompt(){},changeSection(){},toast(){},loadRadar(){}
};
vm.runInNewContext(engine,env,{filename:"opportunity-engine.js"});
const list=node("opportunityList").innerHTML;
assert.equal((list.match(/class="opportunity-card"/g)||[]).length,3,"Expected 3 safe cards");
assert(list.includes("&lt;img") && !list.includes('<img src=x onerror'), "Unescaped user content");
assert(!list.includes(">unsafe<"), "Unsafe source URL should not render");
assert((node("opportunityTrackSummary").innerHTML.match(/data-op-track/g)||[]).length>=1,"Niche summary is empty");
assert((node("opportunityWeekPlan").innerHTML.match(/data-week-add/g)||[]).length===3,"Weekly plan is empty");
assert(registry.add.length>=1,"Add buttons have no click handlers");
registry.add[0].click();
assert.equal(savedTopics.length,1,"Add to pool did not call addFeed");
node("opportunityLens").events.click({target:{closest(){return {dataset:{lens:"products"}};}}});
assert.equal(node("opportunityCount").textContent,"1 条可选","Lens filter failed");
feed.splice(0);win.renderOpportunityRadar();
assert(node("opportunityList").innerHTML.includes("正在准备选题素材"),"Empty state not rendered");
assert(node("opportunityWeekPlan").innerHTML.includes("加载新闻后"),"Weekly plan did not reset when empty");

// Smart calendar mobile layout guardrails (interactive behavior is also browser-tested).
const calendarScript = fs.readFileSync(path.join(base, "smart-schedule.js"), "utf8");
new vm.Script(calendarScript, {filename:"smart-schedule.js"});
for (const id of ["smartStartDate","smartScheduleWindow","smartScheduleFilter","smartAutoAssign","smartScheduleStats","smartPlanNow","calendarList"]) {
  assert(ids.has(id), "Missing smart calendar control: "+id);
}
assert(html.includes('role="switch" aria-label="新建选题自动排期"'), "Missing compact calendar switch");
assert(html.includes("#section-calendar .smart-controls>label:nth-child(3){grid-column:1/-1}"), "Calendar filter must span full mobile row");
assert(html.includes(".smart-autotoggle{grid-column:1/-1"), "Auto assign switch must span full mobile row");
assert(html.includes("#section-calendar .smart-schedule-stats{display:grid!important;grid-template-columns:repeat(3"), "Calendar stats must have three equal columns on mobile");
assert(calendarScript.includes("一三五日"), "Missing compact poster schedule statistic");


// Desktop navigation disclosure: clicking More must expand/collapse resource links.
assert(ids.has("desktopMoreToggle") && ids.has("desktopSources"), "Desktop More controls are missing");
assert(!html.includes('class="mobile-more"'), "Legacy inert desktop More button was not removed");
const desktopMoreScript = scripts.find(code=>code.includes("desktopMoreToggle")&&code.includes("desktopSources"));
assert(desktopMoreScript, "Desktop More interaction script is missing");
const desktopBtn = {
 attrs:{"aria-expanded":"false"},events:{},classes:new Set(),
 getAttribute(k){return this.attrs[k]},
 setAttribute(k,v){this.attrs[k]=v},
 addEventListener(k,v){this.events[k]=v},
 classList:{toggle(){}}
};
const desktopSources = {hidden:true};
vm.runInNewContext(desktopMoreScript,{document:{getElementById(id){return id==="desktopMoreToggle"?desktopBtn:id==="desktopSources"?desktopSources:null;}}});
assert.equal(desktopSources.hidden,true, "Desktop resources must start collapsed");
desktopBtn.events.click();
assert.equal(desktopBtn.attrs["aria-expanded"],"true", "Desktop More did not open");
assert.equal(desktopSources.hidden,false, "Desktop resources are not shown");
desktopBtn.events.click();
assert.equal(desktopBtn.attrs["aria-expanded"],"false", "Desktop More did not close");
assert.equal(desktopSources.hidden,true, "Desktop resources did not hide");
assert(html.includes('id="mobileMoreToggle"'),"Mobile More must remain available");

process.stdout.write("PASS: JS syntax, DOM references, 3 opportunity cards, XSS escape, filter, save, weekly plan, empty state; Radar "+radar.report_date+"\n");