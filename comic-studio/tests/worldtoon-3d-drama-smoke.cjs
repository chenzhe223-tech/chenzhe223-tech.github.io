'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
for(const name of ['style-v3.js','creative-director.js','worldtoon-v3.js','app.js','archive.js']){
 assert.doesNotThrow(()=>new vm.Script(read(name)),name+' has valid syntax');
}
const styleCtx={window:{},document:{addEventListener(){}}};
vm.runInNewContext(read('style-v3.js'),styleCtx,{filename:'style-v3.js'});
const atlas=styleCtx.window.WTStyleV3;
assert.equal(atlas.CATALOG.length,25,'four new visual directions added to original 21');
const styleIds=['cinematic-3d-character','stylized-3d-toon','editorial-3d-graphic','dramatic-3d-vertical'];
for(const id of styleIds){
 const entry=atlas.CATALOG.find(s=>s.style_id===id);
 assert.ok(entry,id+' exists');
 assert.equal(entry.category,'3D 与数字角色');
 assert.equal(entry.sample.status,'not_generated','no fictitious finished render');
}
const project={
 id:'p-drama',title:'银行富婆的热搜人生',category:'都市网红短剧',
 plotGenre:'viral-melodrama',dramaSubtype:'rebirth-bank-rich',dramaIntensity:5,
 panels:Array.from({length:9},()=>({title:'',scene:'',caption:'',dialogue:'',prompt:'',image:''})),
 handoff:{mode:'original'},description:'重生之银行富婆和成年男明星的恋爱修罗场'
};
const directorEvents={};
const dirCtx={
 window:{WTStyleV3:atlas},document:{addEventListener(t,fn){if(t==='click')directorEvents.click=fn}},location:{hash:'#/test'},
 queueMicrotask(){},selected:()=>project,persist(){},e:x=>String(x??''),heroHeader:()=>'',
 setChange(){},markDirty(){},render(){},notify(){},now:()=>new Date().toISOString(),
 mediaSrc:x=>x,putMedia:async()=>{},getMedia:async()=>null,
 saveFile(){},packZip(){},enc:new TextEncoder(),safeName:x=>x
};
vm.runInNewContext(read('creative-director.js'),dirCtx,{filename:'creative-director.js'});
const director=dirCtx.window.wtDirector,cast=director.ensure(project).cast;
assert.equal(director.ensure(project).arcId,'viral-melodrama','melodrama arc auto-selected');
const scenes=director.localStoryboard(project);
assert.equal(scenes.length,9,'nine panel local storyboard');
assert.ok(scenes.some(p=>p.scene.includes('银行')&&p.scene.includes('富婆')||p.scene.includes('男演员')),
 'offline draft relates to bank, rich woman, celebrity instead of generic allegory');
cast[0].portraitConsent=true;cast[0].portraitMedia='media:consented-portrait';
cast[0].portraitExt='png';cast[0].portraitSha256='a'.repeat(64);
const brief=director.payload(project);
assert.equal(brief.characters[0].portrait_reference.file,'references/portrait-01.png');
assert.equal(brief.characters[0].portrait_reference.sha256,'a'.repeat(64));
assert.equal(brief.narrative.genre,'viral-melodrama');
const directorUI=dirCtx.window.wtCreativeDirector();
assert.match(directorUI,/电影级 3D 拟人角色/,'visual library displays 3D character style');
directorEvents.click({target:{closest:selector=>({dataset:{directorStep:'2'}})},preventDefault(){}});
const narrativeUI=dirCtx.window.wtCreativeDirector();
assert.match(narrativeUI,/狗血网红爽剧/,'narrative UI offers melodrama arc');
assert.match(read('creative-director.js'),/data-director-portrait-upload/,'upload control and handler');
assert.match(read('creative-director.js'),/data-director-portrait-consent/,'explicit likeness consent');
assert.match(read('creative-director.js'),/references\/portrait-/,'raw photos in private ZIP');
const app=read('app.js');
assert.match(app,/portraitFiles\.push/,'handoff ZIP must carry real portrait bytes');
assert.match(app,/WorkBuddy 自动派单目前不能安全传输真人肖像参考/,'incomplete auto handoff must be blocked');
assert.match(app,/sha256|SHA-256/,'source photo hashing');
assert.match(app,/p\.creativeDirection\?\.cast\|\|\[\]\)\.filter\(ch=>ch\.portraitConsent\)/,'photo is part of local backup');
const engine=read('worldtoon-v3.js');
assert.match(engine,/wt3-plot-genre/,'genre selector visible');
assert.match(engine,/wt3-drama-intensity/,'drama intensity selector visible');
assert.match(engine,/modelIdea=idea/,'genre instructions appended to actual DeepSeek request');
assert.match(engine,/dramaInstructions\(p\)/,'explicit plot hooks are present');
assert.match(engine,/plotGenre:\s*'viral-melodrama'|viral-melodrama/,'viral plot recognizable');
console.log('WORLD/TOON 3D + VIRAL DRAMA PASS: styles, source photos, consent, private handoff, genre and producer gates');
