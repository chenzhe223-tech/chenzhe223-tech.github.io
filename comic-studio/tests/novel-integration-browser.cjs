'use strict';
/* Browser acceptance is an isolated guest fixture. No real user file is ever uploaded, published, or billed. */
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'worldtoon-novel-distill-'));
function unzipStored(bytes){
 const result=new Map();let pos=0;
 while(pos+30<=bytes.length&&bytes.readUInt32LE(pos)===0x04034b50){
  const len=bytes.readUInt16LE(pos+26),ex=bytes.readUInt16LE(pos+28),size=bytes.readUInt32LE(pos+18);
  const name=bytes.subarray(pos+30,pos+30+len).toString('utf8'),start=pos+30+len+ex;
  assert.ok(start+size<=bytes.length,'ZIP file entry must fit declared size');
  result.set(name,bytes.subarray(start,start+size));pos=start+size;
 }
 return result;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1130,height:820}});
 page.on('dialog',x=>x.accept());
 try{
  page.on('pageerror',err=>console.warn('NOVEL_BROWSER_JS_ERROR',String(err.message||err).slice(0,250)));
  page.on('response',resp=>{if(/novel-(?:core|studio)\./.test(resp.url()))console.log('NOVEL_ASSET',resp.status(),resp.url())});
  await page.goto('https://worldtoon.chenzhe223.workers.dev/',{waitUntil:'domcontentloaded',timeout:60000});
  let loaded=false,diagnostics={};
  for(let attempt=0;attempt<8;attempt++){
   await page.waitForTimeout(2500);
   diagnostics=await page.evaluate(()=>({core:!!window.WTNovelCore,studio:!!window.WTNovelStudio,director:!!window.wtDirector,
    scripts:[...document.scripts].filter(x=>x.src.includes('novel-')).map(x=>x.src)}));
   if(diagnostics.core&&diagnostics.studio&&diagnostics.director){loaded=true;break}
   if(attempt===0||attempt===4)console.warn('NOVEL_ASSET_WAIT',JSON.stringify(diagnostics));
   await page.reload({waitUntil:'domcontentloaded',timeout:30000});
  }
  assert.equal(loaded,true,'novel parser and studio must load from deployed Worker: '+JSON.stringify(diagnostics));
  const initial=await page.evaluate(()=>{
   const p=emptyProject();p.id='qa-book-to-comic-local-20261121';
   p.title='世界文学·章节研究测试';p.sourceTitle='编辑原创测试小说';
   p.category='世界文学导读';p.handoff={mode:'hotspot',phase:'not_started'};
   data.projects.unshift(p);ui.selected=p.id;persist();nav('director/'+p.id);
   return p.id;
  });
  await page.locator('[data-director-step="2"]').click();
  const novel=page.locator('.wt-novel-studio');
  assert.equal(await novel.count(),1,'novel parser integrated into creator director');
  await novel.locator('summary').first().click();
  assert.match(await novel.innerText(),/小说蒸馏/);
  const content=Array.from({length:6},(_,i)=>{
   const title='第'+(i+1)+'章 '+['开端','守望','孤独','选择','风雨','归途'][i];
   return title+'\n'+('这是原创回归测试文本，母亲和孩子面对家庭、自由、孤独与希望的选择。编辑在书页旁做出没有结论的笔记。\n').repeat(22);
  }).join('\n\n');
  const contentHash=crypto.createHash('sha256').update(content).digest('hex');
  await novel.locator('[data-novel-file]').setInputFiles({name:'creative-fixture.txt',mimeType:'text/plain',buffer:Buffer.from(content)});
  await page.waitForFunction(id=>window.WTNovelStudio?._drafts?.get(id)?.skill?.provenance?.chapter_count===6,initial,{timeout:25000});
  const pre=await page.evaluate(id=>{
   const x=WTNovelStudio._drafts.get(id);return {chapters:x.skill.provenance.chapter_count,sha:x.skill.provenance.sha256,source:x.skill.distillation.semantic_status,chars:x.skill.provenance.char_count,sourceFile:x.file.name};
  },initial);
  assert.equal(pre.chapters,6);
  assert.equal(pre.sha,contentHash);
  assert.equal(pre.source,'not_performed','the index never fabricates an AI model run');
  assert.ok(pre.chars>2500,'all novel text processed');
  await page.locator('[data-novel-share]').check();
  assert.equal(await page.locator('[data-novel-keep]').isChecked(),true);
  await page.locator('[data-novel-action="apply"]').click();
  await page.waitForFunction(id=>!!data.projects.find(p=>p.id===id)?.novelSkill,initial,{timeout:20000});
  const applied=await page.evaluate(async id=>{
   const p=data.projects.find(x=>x.id===id);
   const blob=await getMedia(p.novelSkill.private_source_ref.slice(6));
   return {mode:p.storySourceSelection.adaptation,sourceHash:p.novelSkill.provenance.sha256,
    panels:p.panels.length,scenes:p.panels.map(x=>x.scene),copiedBlob:blob?.size||0,
    sourceLicense:p.storySourceSelection.license_attested,
    complete:p.novelSkill.qa.ready_for_publication,
    semantic:p.novelSkill.distillation.semantic_status};
  },initial);
  assert.equal(applied.mode,'literary_review','book rights default to original criticism');
  assert.equal(applied.panels,9);
  assert.equal(applied.sourceHash,contentHash);
  assert.ok(applied.scenes.every(x=>/CH\d{3}/.test(x)),'nine storyboard slots reference actual chapter anchors');
  assert.equal(applied.copiedBlob,Buffer.byteLength(content),'source only stored locally in IndexedDB');
  assert.equal(applied.complete,false);
  assert.equal(applied.semantic,'not_performed');
  const handoff=await page.evaluate(id=>{
   const p=data.projects.find(x=>x.id===id),c=wtDirector.ensure(p);
   c.reviewed=true;c.drafted=true;
   const errors=wtDirector.checks(p);
   if(errors.length)return {errors};
   c.approval={lock_hash:wtDirector.digest(p),approved_at:new Date().toISOString(),author_approved:true};
   persist();ui.selected=id;nav('handoff');
   return {errors,ready:wtDirector.approved(p),gate:wfProductionPreflight(p)};
  },initial);
  assert.deepEqual(handoff.errors,[],'chapter storyboard must be editable and lockable: '+JSON.stringify(handoff.errors));
  assert.equal(handoff.ready,true);
  assert.equal(handoff.gate.ready,true,'locally hashed manuscript is an accepted research lead');
  const downloading=page.waitForEvent('download',{timeout:40000});
  await page.locator('[data-wf="task"]').click();
  const downloaded=await downloading;const filepath=path.join(output,'novel-task.zip');
  await downloaded.saveAs(filepath);const zip=unzipStored(fs.readFileSync(filepath));
  assert.ok(zip.has('novel-skill.json'),'offline chapter index accompanies production task');
  assert.ok(zip.has('NOVEL_DISTILLATION.md'),'real semantic analysis requested in ChatGPT handoff');
  assert.ok(zip.has('source/private-novel-original.txt'),'explicitly authorized manuscript included only in user-downloaded ZIP');
  assert.ok(zip.has('render_jobs.json')&&zip.has('production-bible.json'),'original 10 isolated images and visual bible remain');
  const fullSource=zip.get('source/private-novel-original.txt');
  assert.equal(crypto.createHash('sha256').update(fullSource).digest('hex'),contentHash);
  const task=JSON.parse(zip.get('task.json').toString('utf8'));
  const skill=JSON.parse(zip.get('novel-skill.json').toString('utf8'));
  assert.equal(task.novel_source_skill.includes_private_source,true);
  assert.equal(task.novel_source_skill.source_sha256,contentHash);
  assert.equal(task.novel_source_skill.semantic_status,'not_performed');
  assert.equal(task.novel_source_skill.private_source_file,'source/private-novel-original.txt');
  assert.equal(task.mode,'literary_review');
  assert.ok(!('private_source_ref' in skill),'exported metadata never exposes local IndexedDB identifiers');
  assert.match(zip.get('NOVEL_DISTILLATION.md').toString('utf8'),/AI 深度语义蒸馏/);
  assert.match(zip.get('ChatGPT_复制粘贴开工指令.txt').toString('utf8'),/novel-skill\.json/);
  assert.equal(task.expected_image_count,10);
  console.log('WORLD/TOON BOOK-TO-COMIC PASS: local TXT parsing, 6/6 original chapters, 9 anchored director frames, opt-in source sha, real ZIP and research-required task');
 }finally{await browser.close();fs.rmSync(output,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
