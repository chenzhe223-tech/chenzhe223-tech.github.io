"use strict";
/* No browser dependency: verify the publication-critical discovery layout contract. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"discover-layout-v3.css"),"utf8");
const nav=fs.readFileSync(path.join(root,"discover-layout-v3.js"),"utf8");
const xnews=fs.readFileSync(path.join(root,"xnews-discovery.js"),"utf8");
const opportunity=fs.readFileSync(path.join(root,"opportunity-engine.js"),"utf8");

const count=fragment=>html.split(fragment).length-1;
for(const id of [
 "section-discover","opportunityTitle","opportunityList","opportunityLens",
 "xnewsDiscovery","xnewsTitle","xnewsList","xnewsSearch","xnewsRefresh",
 "discoverSources","discoverMaterials","discoverIdeas","discoverToolbox",
 "feedList","radarSearch","ideaInput","analyzeIdeas","sourceStatus",
 "opportunityUpdated","topicList","topicForm"
]){
 assert.equal(count('id="'+id+'"'),1,"Missing or duplicate ID: "+id);
}
const start=html.indexOf('id="section-discover"');
const end=html.indexOf('id="section-research"');
assert.ok(start>=0&&end>start,"Discovery section is before research section");
const section=html.slice(start,end);
const ordered=["discover-index","opportunity-hub","xnews-hub","discover-toolbox"];
let prev=-1;
for(const name of ordered){
 const pos=section.indexOf('class="'+name);
 assert.ok(pos>=0&&pos>prev,"Unordered discovery module: "+name);
 prev=pos;
}
assert.ok(section.indexOf("discover-tools-grid")<section.indexOf('id="discoverMaterials"'));
assert.ok(section.indexOf('id="discoverMaterials"')<section.indexOf('id="discoverIdeas"'));
for(const id of ["opportunityTitle","xnewsTitle","discoverMaterials","discoverIdeas"]){
 assert.ok(html.includes('data-discover-target="'+id+'"'));
}
assert.ok(html.includes('href="./discover-layout-v3.css?v=20261113-a"'));
assert.ok(html.includes('src="./discover-layout-v3.js?v=20261113-a"'));
assert.match(css,/#section-discover\.section\.active/);
assert.match(css,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)!important/);
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
assert.match(css,/#section-discover \.discover-tools-grid>\.discover-detail\[open\]/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.ok(xnews.includes("visible:6"));
assert.ok(xnews.includes("state.visible+=6"));
for(const [name,source] of [["navigation",nav],["XNews",xnews],["opportunities",opportunity]]){
 new vm.Script(source,{filename:name});
}
console.log("PASS discovery layout: 12-grid, order, IDs, mobile widths, controls, JS syntax, six-card density");
