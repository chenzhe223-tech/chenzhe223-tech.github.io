"use strict";
/* Offline DOM-contract regression for DAVYLAB XNews discovery. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"xnews-discovery.js"),"utf8");
const fixtureJson=JSON.parse(fs.readFileSync(path.join(root,"data","xnews-discovery.json"),"utf8"));
function fixture(){
  const nodes={},messages=[],topics=[],storage=new Map();
  const ids=["xnewsDiscovery","xnewsStatus","xnewsCount","xnewsList","xnewsMore","xnewsUpdated","xnewsSearch","xnewsSort","xnewsRefresh","promptBox"];
  for(const id of ids)nodes[id]={innerHTML:"",textContent:"",value:"",hidden:false,handlers:{},addEventListener(e,f){this.handlers[e]=f},querySelectorAll(){return[]},scrollIntoView(){}};
  let payload=fixtureJson,failure=false;
  const env={
    document:{getElementById:id=>nodes[id]||null},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
    fetch:async()=>{if(failure)throw Error("simulated outage");return{ok:true,json:async()=>payload}},
    URL,Date,window:{renderOpportunityRadar(){messages.push("op")}},
    topics,radarData:{news:[]},feedCache:[],
    renderFeed(){messages.push("radar")},saveTopics(){messages.push("save")},
    getFeed(){return[{type:"news",title:"DAVYLAB Radar",url:"https://example.org/radar"}]},
    addFeed(x){topics.unshift({id:"topic",title:x.angle,sourceTitle:x.title,sourceUrl:x.url,status:"inbox",origin:"radar"})},
    showPrompt(x){nodes.promptBox.value="Title: "+x.title},
    changeSection(x){messages.push("section:"+x)},
    safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))},
    toast(x){messages.push(x)}
  };
  vm.createContext(env);
  vm.runInContext(source,env,{filename:"xnews-discovery.js",timeout:2000});
  return{nodes,topics,env,api:env.window.DAVYLABXNews,fail(v){failure=v},respond(v){payload=v}};
}
async function run(){
  const f=fixture();
  await f.api.load(true);
  assert.equal(f.api.status().loaded,true);
  assert.equal(f.api.getItems().length,fixtureJson.count);
  assert.equal((f.nodes.xnewsList.innerHTML.match(/class="xnews-card"/g)||[]).length,Math.min(9,fixtureJson.count));
  assert.ok(f.nodes.xnewsList.innerHTML.includes("中文阅读"));
  assert.ok(f.nodes.xnewsList.innerHTML.includes("原文"));
  const merged=f.env.getFeed();
  assert.equal(merged.length,fixtureJson.count+1);
  assert.equal(merged.filter(x=>x.origin==="xnews").length,fixtureJson.count);
  const item=merged.find(x=>x.origin==="xnews");
  f.env.addFeed(item);
  assert.equal(f.topics.length,1);
  assert.equal(f.topics[0].origin,"xnews");
  assert.equal(f.topics[0].sourcePageUrl,item.xnewsUrl);
  assert.equal(f.topics[0].factCheckStatus,"待核实");
  f.env.addFeed(item);
  assert.equal(f.topics.length,1);
  f.env.showPrompt(item);
  assert.ok(f.nodes.promptBox.value.includes("【XNews 中文阅读】"));
  f.fail(true);await f.api.load(true);
  assert.equal(f.api.status().cached,true);
  assert.equal(f.api.getItems().length,fixtureJson.count);
  f.fail(false);
  f.respond({schema_version:1,synced_at:new Date().toISOString(),articles:[{
    id:"html-injection-test",title:"<img src=x onerror=alert(1)>",
    summary:"<script>alert(1)</script>",date:"2026-11-12",
    original_url:"https://example.com/test",xnews_url:"https://xnews.qiaomu.ai/a/html-injection-test",tags:["test"]
  }]});
  await f.api.load(true);
  const rendered=f.nodes.xnewsList.innerHTML;
  assert.ok(rendered.includes("&lt;img"));
  assert.ok(!rendered.includes("<img src=x"));
  assert.ok(rendered.includes("&lt;script&gt;"));
  console.log("PASS XNews UI integration, merged feed, adoption, duplicates, prompts, fallback, XSS escape");
}
run().catch(err=>{console.error(err);process.exitCode=1});
