'use strict';
/* Isolated browser regression. The task exists only in Playwright's temporary guest
 * context: no remote task, publication, copyright permission, or image is created. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const writeDir=fs.mkdtempSync(path.join(os.tmpdir(),'worldtoon-review-browser-'));
function zipStoreEntries(buffer){
 const out=new Map();let pos=0;
 while(pos+30<=buffer.length&&buffer.readUInt32LE(pos)===0x04034b50){
  const size=buffer.readUInt32LE(pos+18),nameLen=buffer.readUInt16LE(pos+26),extraLen=buffer.readUInt16LE(pos+28);
  const begin=pos+30+nameLen+extraLen;
  const name=buffer.subarray(pos+30,pos+30+nameLen).toString('utf8');
  assert.ok(begin+size<=buffer.length,'ZIP entry must fit inside the exported file');
  out.set(name,buffer.subarray(begin,begin+size));pos=begin+size;
 }
 return out;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1180,height:800}});
 try{
  await page.goto('https://worldtoon.chenzhe223.workers.dev/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>typeof window.wtDirector==='object'&&typeof wfMode==='function'&&typeof wfProductionPreflight==='function',{timeout:45000});
  const setup=await page.evaluate(()=>{
   const p=emptyProject();
   p.id='qa-literary-review-satantango';
   p.title='读懂｜撒旦探戈｜Satantango：故事、哲学与人生';
   p.sourceTitle='撒旦探戈 | Satantango';
   p.category='诺奖文学导读';
   p.description='测试用的旧简介：主人公马宁、主角费宁出现于候选摘要。编辑漫画使用不同的原创读者。';
   p.characters='主人公马宁、主角费宁';
   p.sourceURLs='https://example.org/literature/source-for-later-research';
   p.fiction='原创文学导读，不使用原著人物与独特桥段。';
   p.disclosure='原创文学评论，不代表原著授权。';
   p.storySourceSelection={adaptation:'literary_review',rights:'copyrighted',source:'https://example.org/literature/source-for-later-research'};
   p.literaryReviewGuide={schema:'davylab.worldtoon.literary-review.v1'};
   p.handoff={mode:'hotspot',phase:'task_ready',taskId:'WT-ghost-failed-attempt'};
   const c=wtDirector.ensure(p);
   const storyboard=wtDirector.localStoryboard(p);
   p.panels=storyboard.map((x,i)=>({...p.panels[i],...x}));
   c.drafted=true;c.reviewed=true;
   const issues=wtDirector.checks(p);
   if(issues.length)return {ready:false,issues};
   c.approval={lock_hash:wtDirector.digest(p),approved_at:new Date().toISOString(),author_approved:true};
   data.projects.unshift(p);ui.selected=p.id;
   persist();nav('handoff');
   return {ready:true,mode:wfMode(p),directorApproved:wtDirector.approved(p),preflight:wfProductionPreflight(p),visiblePhase:wfPhase(p)};
  });
  assert.equal(setup.ready,true,'fixture requires a fully valid locked director bible: '+JSON.stringify(setup.issues));
  assert.equal(setup.directorApproved,true);
  assert.equal(setup.mode,'literary_review','the old hotspot flag must not override editorial review');
  assert.equal(setup.preflight.ready,true,'book synopsis names must not be treated as comic cast conflicts');
  assert.equal(setup.visiblePhase,'not_started','prior failed task must not be shown as generated');
  assert.equal(await page.locator('#wfMode').inputValue(),'literary_review');
  assert.equal(await page.locator('#wfMode').isDisabled(),true,'review mode cannot switch back to hotspot in the production UI');
  assert.match(await page.locator('.wf-step').first().innerText(),/文学导读|作品与作者资料/);
  assert.match(await page.locator('body').innerText(),/生产预检通过/);
  const wait=page.waitForEvent('download',{timeout:60000});
  await page.locator('[data-wf="task"]').click();
  const download=await wait;
  const output=path.join(writeDir,'review-task.zip');
  await download.saveAs(output);
  const entries=zipStoreEntries(fs.readFileSync(output));
  assert.ok(entries.has('task.json'),'actual ZIP must contain a task definition');
  assert.ok(entries.has('production-bible.json'),'actual ZIP must contain the visual/character bible');
  assert.ok(entries.has('render_jobs.json'),'actual ZIP must contain 10 isolated render jobs');
  assert.ok(entries.has('production_state.json'),'real job status must be clearly not generated');
  assert.ok(entries.has('00_START_HERE.md'),'complete exported ZIP must explain the user-visible startup step');
  assert.ok(entries.has('ChatGPT_复制粘贴开工指令.txt'),'complete exported ZIP must include an explicit start-now message');
  const startup=entries.get('ChatGPT_复制粘贴开工指令.txt').toString('utf8');
  assert.match(startup,/请立即执行/,'start command must explicitly authorize execution');
  assert.match(startup,/与 ZIP 一起发送|同时附有 WORLD_TOON 任务 ZIP/);
  assert.match(entries.get('00_START_HERE.md').toString('utf8'),/同一条用户消息中上传整个 ZIP/);
  assert.equal(await page.locator('[data-wf="copy"]').count(),1,'startup-copy action remains visible beside ZIP download');
  assert.match(await page.locator('.wf-launch-guide').innerText(),/同一条消息/,'UI warns against attachment-only submission');
  await page.evaluate(()=>{window.__wtCopiedCommand='';copyText=async value=>{window.__wtCopiedCommand=String(value)};});
  await page.locator('[data-wf="copy"]').click();
  await page.waitForFunction(()=>!!window.__wtCopiedCommand,{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__wtCopiedCommand),startup,'UI copy button must paste the exact same command as the ZIP');
  const task=JSON.parse(entries.get('task.json').toString('utf8'));
  const bible=JSON.parse(entries.get('production-bible.json').toString('utf8'));
  const jobs=JSON.parse(entries.get('render_jobs.json').toString('utf8'));
  assert.equal(task.startup_command_file,'ChatGPT_复制粘贴开工指令.txt');
  assert.equal(task.requires_explicit_user_message,true);
  assert.equal(task.attachment_alone_starts_production,false);
  assert.ok(startup.includes(task.task_id),'startup command must mention exact task id');
  assert.equal(task.mode,'literary_review');
  assert.equal(task.adaptation.source_selection.adaptation,'literary_review');
  assert.equal(task.adaptation.literary_review.no_plot_reenactment,true);
  assert.equal(task.research_required,true);
  assert.equal(task.expected_image_count,10);
  assert.equal(jobs.jobs.length,10);
  assert.equal(bible.literary_review.mode,'editorial_criticism_not_plot_adaptation');
  assert.ok(!bible.conflicts.some(x=>x.code==='NAME_CONFLICT_REVIEW_REQUIRED'),'original novel names cannot block reviewer-reader cast');
  assert.notEqual(task.task_id,'WT-ghost-failed-attempt','old failed task identity must be regenerated');
  assert.equal(await page.evaluate(()=>!!selected().handoff.directTaskExportedAt),true,'only a downloaded task is marked exported');
  console.log('WORLD/TOON literary review browser PASS: locked three-axis Satantango task, real download ZIP, 10 independent jobs, no novel-cast false positives');
 }finally{
  await browser.close();
  fs.rmSync(writeDir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1});
