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
assert.ok(extension.includes('wtNews.map((n,i)=>({...n,_sourceIndex:i}))')&&extension.includes('const filtered=pool.filter('),'Category filtering must retain original record index');
const visualScript=fs.readFileSync(path.join(root,'comic-visuals.js'),'utf8');
vm.runInNewContext(visualScript,ctx);
const visual=ctx.window.wtVisualStudio;
assert.ok(visual);
assert.equal(visual.suggestedQuery({title:'郑和下西洋'}),'ship');
assert.equal(visual.suggestedQuery({title:'唐朝城墙'}),'Chinese art');
const cc0={id:'met-1',title:'Historical Ship',source:'The Met Open Access',
 license:'CC0',source_url:'https://www.metmuseum.org/art/collection/search/1',image:'https://example.org/ship.jpg'};
const draft={...p,visualReferences:[cc0],panels:p.panels.map(x=>({...x}))};
const firstPrompt=engine.storyboard(draft)[0].prompt;
assert.ok(firstPrompt.includes(cc0.title)&&firstPrompt.includes(cc0.source_url),'Studio prompt must include latest museum reference');
draft.panels[0].prompt=firstPrompt;
draft.visualReferences=[{...cc0,id:'met-2',title:'Another Museum Artifact',source_url:'https://www.metmuseum.org/art/collection/search/2'}];
const refreshed=engine.storyboard(draft)[0].prompt;
assert.ok(refreshed.includes('Another Museum Artifact')&&!refreshed.includes('Historical Ship'),'Museum references should update, not accumulate stale rights data');
assert.throws(()=>engine.bundleEntries(draft),/尚未分类或指定应用对象/,'legacy references must be classified before production handoff');
const scoped={...p,visualReferences:[],panels:p.panels.map(x=>({...x}))};
visual.addReference(scoped,{...cc0,id:'wardrobe-ref',rights_verified:true},{assetType:'clothing',scope:'panel',targetId:'1'});
assert.equal(scoped.visualReferences[0].assetType,'clothing','visual assets need a usable material category');
assert.deepEqual({...scoped.visualReferences[0].appliesTo},{scope:'panel',targetId:'1',characterName:''});
assert.equal(visual.validateApplication(scoped.visualReferences[0],{scope:'panel',targetId:'1'}).ok,true);
assert.equal(visual.validateApplication(scoped.visualReferences[0],{scope:'project',targetId:'project'}).ok,false,'a clothing reference cannot be applied as a project-wide visual rule');
const scopedBoards=engine.storyboard(scoped);
assert.ok(scopedBoards[0].prompt.includes('Historical Ship'));
assert.ok(!scopedBoards[1].prompt.includes('Historical Ship'),'panel-specific assets must not leak to every panel');
assert.ok(engine.bundleEntries(scoped).some(x=>x.name==='production/visual-references.json'&&x.bytes.includes('"assetType": "clothing"')),'handoff must preserve asset type and target');
visual.addReference(scoped,{id:'self-art',title:'作者自制场景图',source:'作者原创',source_url:'https://assets.example/art.png',image:'https://assets.example/art.png',license:'作者确认自有',rightsStatus:'author_self_owned',userAttested:true},{assetType:'interior',scope:'project',targetId:'project'});
assert.equal(scoped.visualReferences[1].rightsStatus,'author_self_owned','creator-owned assets can be classified without pretending they are museum CC0');
visual.addReference(scoped,{id:'licensed-art',title:'授权服饰样图',source:'授权方样图',source_url:'https://assets.example/licensed.png',image:'https://assets.example/licensed.png',license:'作者确认已授权',rightsStatus:'author_authorized',licenseEvidenceUrl:'https://rights.example/license/123'},{assetType:'clothing',scope:'character',targetId:'林晚',characterName:'林晚'});
assert.equal(scoped.visualReferences[2].license_evidence_url,'https://rights.example/license/123');
assert.throws(()=>engine.bundleEntries({...scoped,visualReferences:[{...scoped.visualReferences[2],rightsStatus:'unknown',license_evidence_url:''}]}),/缺少 CC0/,'unsupported licenses must be blocked at packaging');
assert.equal(Array.from(visual.referencesForPanel(scoped,0),x=>x.id).join(','),'wardrobe-ref,self-art','only targeted and project-wide licensed references should be sent for this panel');
assert.equal(Array.from(visual.referencesForPanel(scoped,1),x=>x.id).join(','),'self-art','panel-specific references must not spread to another panel');
console.log('WORLD/TOON four-skill & discovery integration QA passed.');
