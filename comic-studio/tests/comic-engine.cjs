'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'..','comic-engine.js'),'utf8');
const root=path.join(__dirname,'..');
const actions=[];
const ctx={
 window:{},console,location:{hash:'#/dashboard'},
 document:{addEventListener:(type,fn)=>actions.push(type)},
 studio:()=>'<main>original editor</main>',
 selected:()=>null,
 data:{characters:[]},render:()=>{},
 e:x=>String(x),notify:()=>{},setChange:()=>{},
 saveFile:()=>{},packZip:()=>{},getImageBlob:async()=>{},
 createImageBitmap:async()=>{},confirm:()=>true,
};
vm.runInNewContext(script,ctx);
const engine=ctx.window.wtComicEngine;
assert.ok(engine,'Skill engine available');
assert.deepEqual(Array.from(engine.STEPS,x=>x.name),
 ['baoyu-comic','scenario-storyboards','agent-comic-kit','TT_AutoManga']);
const p={id:'safe-test',title:'架空城市的机械人大赛',sourceTitle:'机器人大赛',
 sourceURLs:'https://example.org/source',tone:'高端杂志插画',format:'九格短篇',
 panels:Array.from({length:9},(_,i)=>({id:String(i+1),title:'第 '+(i+1)+' 格',image:''})),
 characters:'',disclosure:'虚构',factNotes:'待核验'};
const boards=engine.storyboard(p);
assert.equal(boards.length,9,'Exactly nine panels');
assert.equal(new Set(boards.map(x=>x.shot)).size,9,'Diverse shots');
assert.ok(boards.every(x=>x.prompt.includes('fictional allegory')),'Disclose fiction');
assert.ok(boards.every(x=>x.prompt.includes('bubble space')),'Lettering space');
assert.ok(boards.every(x=>!x.image),'Do not invent final image assets');
const exported=engine.bundleEntries(p);
assert.equal(exported.filter(x=>x.name.startsWith('production/prompts/')).length,9);
assert.ok(exported.some(x=>x.name==='production/characters.md'));
assert.ok(exported.some(x=>x.name==='production/storyboard.json'));
const changed={...p,panels:p.panels.map(x=>({...x}))};
changed.panels[0].scene='原创摄影棚画面已由作者锁定';
assert.equal(engine.storyboard(changed)[0].scene,changed.panels[0].scene,'Preserve edits');
assert.ok(ctx.studio().includes('original editor'),'Maintain existing studio');
assert.ok(actions.includes('click'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('comic-engine.js'),'Load executable engine on platform');
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
assert.ok(worker.includes("'/api/comic/discover'"),'Discovery endpoint routed');
assert.ok(worker.includes('comic-engine\\\\.js')||worker.includes('comic-engine\\.js'),'Worker serves skill engine');
assert.ok(worker.includes('Promise.allSettled(tasks.map'),'Sources fail independently');
const extension=fs.readFileSync(path.join(root,'extension.js'),'utf8');
assert.ok(extension.includes("data-wt=\"create-news\""),'One click to create comic project');
assert.ok(extension.includes('wtDraftFromNews'),'Create draft on original existing model');
assert.ok(extension.includes('wtSourceCounts'),'Surface failed sources');
console.log('WORLD/TOON four-skill & discovery integration QA passed.');
