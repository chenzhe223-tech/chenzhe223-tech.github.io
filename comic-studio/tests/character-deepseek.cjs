/* WORLD/TOON free DeepSeek character generation contract. No real model, DB or paid API calls. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'..','worker.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','personalize.js'),'utf8');
assert.match(ui,/characterAiEnabled/);
assert.match(ui,/DeepSeek 角色引擎已就绪/);
assert.match(script,/@cf\/deepseek-ai\/deepseek-r1-distill-qwen-32b/);
assert.match(script,/2026-11-20T00:00:00Z/);
function setup(date){
 const calls=[],counters=new Map();
 class FixedDate extends Date{static now(){return Date.parse(date)}}
 const mockFetch=async u=>{if(String(u).endsWith('/auth/v1/user'))return Response.json({id:'test-owner'});throw Error('Unexpected network request: '+u)};
 const ctx={Date:FixedDate,Response,Request,URL,Headers,FormData,Blob,Uint8Array,TextEncoder,TextDecoder,crypto:globalThis.crypto,
  fetch:mockFetch,AbortSignal,atob,btoa,console,Promise,setTimeout,clearTimeout};
 vm.createContext(ctx);
 vm.runInContext(script.replace('export default {','globalThis.__worker = {'),ctx,{filename:'worker.js'});
 const DB={prepare:()=>({bind:(key)=>({first:async()=>{const n=counters.get(key)||0;if(n>= (key.includes(':characters')? (key.startsWith('__worldtoon_global__')?5:2):2))return null;counters.set(key,n+1);return {uses:n+1};}})})};
 const AI={run:async(model,body)=>{calls.push(model);return {response:'<think>这里出现无关的 {"fake":true} 推理草稿</think>\n'+JSON.stringify({characters:[
 {name:'沙丘钟表师',type:'虚构角色',description:'圆框眼镜与银白卷发',costume:'苔绿风衣',colors:'#455b45 / #e7ccad',traits:'三角鼻尖、左眼单片镜、铜制怀表',personality:'谨慎且幽默'},
 {name:'小风筝',type:'虚构角色',description:'橙色短发和雀斑',costume:'暖黄工作背心',colors:'暖黄和橘红',traits:'翘起短发、右脸雀斑、旧机械包',personality:'好奇且大胆'}]})}}};
 return {worker:ctx.__worker,calls,env:{AI,DB,AI_ENABLED:'false'}};
}
function req(){return new Request('https://worldtoon.chenzhe223.workers.dev/api/ai/characters',{method:'POST',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({title:'原创漫画',concept:'一个虚构蒸汽城市的两位冒险者',count:2,style:'温暖手绘'})})}
(async()=>{
 const live=setup('2026-11-10T01:00:00Z');
 const config=await live.worker.fetch(new Request('https://worldtoon.chenzhe223.workers.dev/api/config'),live.env,{});
 const flags=await config.json();assert.equal(flags.aiEnabled,false);assert.equal(flags.characterAiEnabled,true);
 let res=await live.worker.fetch(req(),live.env,{});
 assert.equal(res.status,200);let out=await res.json();
 assert.equal(out.characters.length,2);assert.equal(out.freeTier,true);assert.equal(out.requiresHumanReview,true);
 assert.equal(out.model,'deepseek-r1-distill-qwen-32b');
 assert.equal(live.calls[0],'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
 res=await live.worker.fetch(req(),live.env,{});assert.equal(res.status,200);
 res=await live.worker.fetch(req(),live.env,{});assert.equal(res.status,429,'no unlimited free requests');
 const past=setup('2026-11-21T00:00:00Z');
 res=await past.worker.fetch(req(),past.env,{});assert.equal(res.status,200);
 out=await res.json();assert.equal(out.modelFallback,true);assert.equal(out.model,'gemma-4-26b-a4b-it');
 assert.equal(past.calls[0],'@cf/google/gemma-4-26b-a4b-it');
 console.log('PASS: DeepSeek free characters, JSON, quota, 2026-11-20 fallback, other AI remains disabled');
})().catch(e=>{console.error(e);process.exit(1)});
