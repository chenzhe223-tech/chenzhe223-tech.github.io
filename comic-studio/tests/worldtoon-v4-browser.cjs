/* Real Chromium click-through and ZIP technical-verification test.
 * All artwork produced in this test is a synthetic TEST FIXTURE, never deliverable art.
 * No external model inference, paid services, author approval or publication.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const out=path.join(root,'browser-evidence');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
  let url;try{url=new URL(request.url,'http://127.0.0.1');}catch{response.writeHead(400).end();return;}
  if(url.pathname.startsWith('/api/')){response.writeHead(503,{'Content-Type':'application/json'}).end('{"error":"browser qa: api intentionally not configured"}');return;}
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{response.writeHead(400).end();return;}
  const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(filename!==root&&!filename.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(filename,(err,buf)=>{
    if(err){response.writeHead(404).end('not found');return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'}).end(buf);
  });
});

const KEY='davylab-comic-press-v1';
function png(width,height,r,g,b){
  // Minimal valid native RGB PNG. Fixture only: flat colors, NOT artwork.
  const raw=Buffer.alloc((width*3+1)*height);
  for(let y=0;y<height;y++){
    const off=y*(width*3+1);
    for(let x=0;x<width;x++){
      // Nonart technical fixture: a small pseudo-random patch keeps the native PNG
      // above the existing 40KB upload integrity gate. It is never publishable art.
      const n=(x<230&&y<230)?((Math.imul(x+11,1103515245)^Math.imul(y+29,2654435761)^Math.imul(r+41,16807))>>>0):0;
      raw[off+1+x*3]=n?(n&255):r;raw[off+2+x*3]=n?((n>>>8)&255):g;raw[off+3+x*3]=n?((n>>>16)&255):b;
    }
  }
  const crcTable=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=(n&1)?0xedb88320^(n>>>1):(n>>>1);return n>>>0;});
  const crc32=bytes=>{let c=0xffffffff;for(const v of bytes)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
  const chunk=(type,payload)=>{
    const name=Buffer.from(type),body=Buffer.concat([name,payload]);
    const buf=Buffer.alloc(body.length+8);buf.writeUInt32BE(payload.length,0);
    body.copy(buf,4);buf.writeUInt32BE(crc32(body),buf.length-4);
    return buf;
  };
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function unpackStore(bytes){
  let at=0;const entries=new Map();
  while(at+30<bytes.length&&bytes.readUInt32LE(at)===0x04034b50){
    const method=bytes.readUInt16LE(at+8),size=bytes.readUInt32LE(at+18),nameSize=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28);
    assert.equal(method,0,'ZIP stores original PNG bytes');
    const name=bytes.subarray(at+30,at+30+nameSize).toString('utf8');
    const start=at+30+nameSize+extra,end=start+size;
    assert.ok(end<=bytes.length,'ZIP bounds');
    entries.set(name,bytes.subarray(start,end));at=end;
  }
  return entries;
}
async function test(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[],reports=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('[data-wt4-entry="idea"]').waitFor({timeout:20000});
    assert.equal(await page.locator('.wt4-entry-card').count(),3,'all three creation paths are real button controls');
    const titleAppearance=await page.evaluate(()=>{
      const check=s=>{const el=document.querySelector(s),cs=getComputedStyle(el),r=el.getBoundingClientRect();return {text:el.textContent,color:cs.color,background:cs.backgroundColor,font:cs.font,opacity:cs.opacity,visibility:cs.visibility,display:cs.display,width:r.width,height:r.height}};
      return {heading:check('.wt4-entry-intro h1'),card:check('.wt4-entry-card strong')};
    });
    console.log('Real Chrome heading paint diagnostics:',JSON.stringify(titleAppearance));
    assert.ok(titleAppearance.heading.text.length>0&&titleAppearance.card.text.length>0,'heading and card titles exist in browser DOM');
    await page.screenshot({path:path.join(out,'desktop-entry.png'),fullPage:true});
    await page.locator('[data-wt4-entry="idea"]').click();
    await page.locator('#wt4-seed').fill('一位小邮差发现月亮上的信件正在消失');
    await page.locator('[data-wt4-create="idea"] [type="submit"]').click();
    await page.waitForFunction(()=>location.hash.startsWith('#/workspace/'));
    const idea=await page.evaluate(key=>{
      const store=JSON.parse(localStorage.getItem(key));return store.projects.find(p=>p.ideaSeed?.includes('小邮差'));
    },KEY);
    assert.ok(idea&&idea.id&&idea.handoff.mode==='original','idea project persisted as original');
    assert.ok(!idea.creativeDirection?.approval,'no fabricated approval');
    assert.ok(!idea.handoff?.repoQueuedAt,'creating a local project does not fake GitHub handoff');
    assert.ok((await page.locator('.wt4-step').allTextContents()).join(' ').includes('剧情分镜'));
    assert.equal(await page.locator('.wt4-story-journey').count(),1,'story is one compact integrated stage');
    assert.equal(await page.locator('.wt3-work-panel').count(),1,'exactly one real DeepSeek expansion panel, no legacy duplication');
    assert.equal(await page.locator('#wt3-agent').count(),0,'producer dispatch must not clutter story development');
    assert.equal(await page.locator('.wt3-series').count(),0,'series operations remain in their later dedicated stage');
    assert.equal(await page.locator('.wt4-story-compact').count(),1,'minimal editor is visible in stage one');
    assert.equal(await page.locator('#wt3-seed').inputValue(),'一位小邮差发现月亮上的信件正在消失');
    await page.locator('[data-wt3-action="expand"]').click();
    await page.locator('#wt3-expand-consent').waitFor({state:'visible'});
    const consent=await page.locator('#wt3-expand-consent').textContent();
    assert.match(consent,/可能按 Token 产生费用/,'no unconsented model call');
    await page.locator('[data-wt3-action="expand-cancel"]').click();
    assert.equal(await page.locator('#wt3-expand-consent').isVisible(),false,'cancel model request before fees');
    await page.locator('.wt4-steps [data-wt4-step="1"]').click();
    await page.locator('[data-wt4-character-create] [name="name"]').fill('阿月');
    await page.locator('[data-wt4-character-create] [name="gender"]').fill('自定义身份');
    await page.locator('[data-wt4-character-create] [name="age"]').fill('成年');
    await page.locator('[data-wt4-character-create] [name="profession"]').fill('邮差');
    await page.locator('[data-wt4-character-create] [name="description"]').fill('短黑发与棕色眼睛，右手有星星纹章');
    await page.locator('[data-wt4-character-create] [name="costume"]').fill('米黄色工装外套');
    await page.locator('[data-wt4-character-create] [type="submit"]').click();
    const roleDebug=await page.evaluate(({key,id})=>{
      const store=JSON.parse(localStorage.getItem(key));
      const p=store.projects.find(x=>x.id===id);
      return {formValid:document.querySelector('[data-wt4-character-create]')?.checkValidity(),
        formMissing:[...(document.querySelector('[data-wt4-character-create]')?.elements||[])].filter(x=>!x.validity.valid).map(x=>x.name),
        currentRoute:location.hash,selectedProject:typeof selected==='function'?selected()?.id:null,
        savedProjectId:id,storedName:p?.title,storedRefs:p?.characterRefs?.length||0,
        catalogSize:store.characters?.length||0,toast:document.querySelector('#toast')?.textContent};
    },{key:KEY,id:idea.id});
    console.log('Role creation browser diagnostics:',JSON.stringify(roleDebug));
    assert.ok(roleDebug.storedRefs>0,'submitted author-confirmed character must attach to selected comic: '+JSON.stringify(roleDebug));
    const character=await page.evaluate(({key,id})=>{
      const store=JSON.parse(localStorage.getItem(key)),p=store.projects.find(p=>p.id===id);
      return {role:p.characterRefs[0],original:store.characters.find(x=>x.characterId===p.characterRefs[0].characterId)};
    },{key:KEY,id:idea.id});
    assert.equal(character.original.gender,'自定义身份');
    assert.equal(character.role.snapshot.description,'短黑发与棕色眼睛，右手有星星纹章');
    assert.equal(character.role.version,1);
    // Simulate a clearly labeled AI-character suggestion, without invoking any model.
    await page.evaluate(({key,id})=>{
      const store=JSON.parse(localStorage.getItem(key)),p=store.projects.find(x=>x.id===id);
      store.characters.push({id:'e2e-ai-draft',characterId:'e2e-ai-draft',origin:'ai-draft',
        reviewStatus:'pending_author_confirmation',version:1,originProjectId:id,
        originalName:'星点',name:'星点',description:'圆形发光眼睛和金色眉形',
        costume:'棕色邮差制服与米黄色腰包',traits:'银色邮戳',personality:'沉稳'});
      p.characterRefs.push({characterId:'e2e-ai-draft',role:'supporting',comicName:'星点',pending_author_review:true});
      localStorage.setItem(key,JSON.stringify(store));
    },{key:KEY,id:idea.id});
    await page.reload();
    await page.locator('[data-wt4-confirm-role="e2e-ai-draft"]').waitFor();
    assert.match(await page.locator('.wt4-pending-character').textContent(),/未确认入库/);
    await page.screenshot({path:path.join(out,'desktop-ai-character-review.png'),fullPage:true});
    await page.locator('[data-wt4-confirm-role="e2e-ai-draft"]').click();
    const confirmed=await page.evaluate(key=>{
      const store=JSON.parse(localStorage.getItem(key));
      return store.characters.find(c=>c.characterId==='e2e-ai-draft');
    },KEY);
    assert.equal(confirmed.origin,'author_confirmed_ai','only an explicit author click confirms the AI draft');
    await page.locator('[data-wt4-sync-character-bible]').click();
    const synced=await page.evaluate(({key,id})=>{
      const store=JSON.parse(localStorage.getItem(key));
      return store.projects.find(p=>p.id===id).creativeDirection;
    },{key:KEY,id:idea.id});
    assert.ok(synced.cast.find(x=>x.characterId==='e2e-ai-draft'),'confirmed role reached the exact director cast');
    assert.equal(synced.approval,null,'synchronization cannot set author approval');
    await page.locator('.wt4-steps [data-wt4-step="2"]').click();
    await page.locator('[data-panel-field="scene"][data-panel-index="0"]').fill('月光照亮邮局，一个陌生包裹从天而降，阿月屏住呼吸。');
    await page.reload();
    await page.locator('[data-panel-field="scene"][data-panel-index="0"]').waitFor();
    assert.match(await page.locator('[data-panel-field="scene"][data-panel-index="0"]').inputValue(),/陌生包裹/,'refresh restores storyboard');
    assert.equal(await page.locator('.wt4-step').count(),7);
    await page.screenshot({path:path.join(out,'desktop-storyboard.png'),fullPage:true});
    reports.push({test:'one-sentence → roles → storyboard → refresh',result:'passed',project_id:idea.id});

    await page.goto(base+'#/dashboard');
    await page.locator('[data-wt4-entry="author"]').click();
    await page.locator('[data-wt4-create="author"] [name="title"]').fill('星际邮局');
    await page.locator('[data-wt4-create="author"] [name="category"]').fill('科幻');
    await page.locator('[data-wt4-create="author"] [name="description"]').fill('银河中最后一间邮局需要跨越银河系运送信件');
    await page.locator('[data-wt4-create="author"] [type="submit"]').click();
    const self=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).projects.find(x=>x.title==='星际邮局'),KEY);
    assert.ok(self?.id&&self.entryType==='author'&&self.handoff.mode==='original','self-authored path persisted');
    await page.locator('.wt4-steps [data-wt4-step="1"]').click();
    await page.locator('#wt4-char-asset').selectOption(character.original.characterId);
    await page.locator('[data-wt4-character-link]').click();
    const origBefore=await page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)).characters.find(c=>c.characterId===id),{key:KEY,id:character.original.characterId});
    await page.locator('[data-wt4-char-field="look"]').fill('本作品有一只银色眼罩');
    await page.locator('[data-wt4-char-field="look"]').blur();
    const result=await page.evaluate(({key,id,asset})=>{
      const store=JSON.parse(localStorage.getItem(key));
      return {project:store.projects.find(x=>x.id===id),original:store.characters.find(x=>x.characterId===asset)};
    },{key:KEY,id:self.id,asset:character.original.characterId});
    assert.equal(JSON.stringify(result.original),JSON.stringify(origBefore),'comic-specific role edits never modify library asset');
    assert.equal(result.project.characterRefs[0].version,1);
    assert.match(result.project.characterOverrides[character.original.characterId].look,/银色眼罩/);
    await page.reload();
    await page.locator('[data-wt4-char-field="look"]').waitFor();
    assert.match(await page.locator('[data-wt4-char-field="look"]').inputValue(),/银色眼罩/,'role override survives reload');
    await page.screenshot({path:path.join(out,'desktop-characters.png'),fullPage:true});
    reports.push({test:'self-authored → catalog reuse → immutable origin',result:'passed',project_id:self.id});

    await page.evaluate(key=>{
      const store=JSON.parse(localStorage.getItem(key));
      store.topics.unshift({id:'e2e-topic-20261113',title:'E2E 测试用热点素材（不是真实新闻）',source:'https://example.org/test-only',stage:'待核验',category:'科技'});
      localStorage.setItem(key,JSON.stringify(store));
    },KEY);
    await page.goto(base+'#/dashboard');
    await page.reload();
    await page.locator('[data-wt4-entry="hotspot"]').click();
    await page.locator('[data-wt4-topic="e2e-topic-20261113"]').click();
    const news=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).projects.find(p=>p.topicId==='e2e-topic-20261113'),KEY);
    assert.ok(news?.id&&news.entryType==='hotspot'&&news.handoff.mode==='hotspot');
    assert.ok(news.sourceURLs.includes('example.org'),'source retained but explicitly unverified');
    assert.ok(!news.handoff?.repoQueuedAt,'source draft not an authorized research claim');
    reports.push({test:'hotspot topic import → same workspace',result:'passed',project_id:news.id});

    // Technical export test only. Synthetic single-color fixture PNGs are NOT real comics.
    const images=Array.from({length:9},(_,i)=>png(1080,1440,15+i*17,70+i*8,120+i*9));
    const cover=png(1080,1440,230,210,175);
    const fix={panelUrls:images.map(b=>'data:image/png;base64,'+b.toString('base64')),cover:'data:image/png;base64,'+cover.toString('base64')};
    await page.evaluate(({key,id,fix})=>{
      const store=JSON.parse(localStorage.getItem(key)),p=store.projects.find(x=>x.id===id);
      p.cover=fix.cover;p.panels.forEach((panel,i)=>{panel.image=fix.panelUrls[i]});
      localStorage.setItem(key,JSON.stringify(store));
    },{key:KEY,id:self.id,fix});
    await page.goto(base+'#/workspace/'+self.id+'/6');
    await page.locator('[data-action="zip-formal"]').waitFor();
    // Reject a bad cover rather than upscaling it.
    const bad=png(1024,1536,200,100,45);
    await page.evaluate(({key,id,img})=>{
      const store=JSON.parse(localStorage.getItem(key)),p=store.projects.find(x=>x.id===id);
      p.cover=img;localStorage.setItem(key,JSON.stringify(store));
    },{key:KEY,id:self.id,img:'data:image/png;base64,'+bad.toString('base64')});
    await page.reload();
    await page.locator('[data-action="zip-formal"]').click();
    await page.getByText(/正式素材包尚未导出：正式封面仅有 1024×1536/).waitFor({timeout:10000});
    await page.evaluate(({key,id,img})=>{
      const store=JSON.parse(localStorage.getItem(key)),p=store.projects.find(x=>x.id===id);
      p.cover=img;localStorage.setItem(key,JSON.stringify(store));
    },{key:KEY,id:self.id,img:fix.cover});
    await page.reload();
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('[data-action="zip-formal"]').click()]);
    const zip=fs.readFileSync(await download.path());
    const entries=unpackStore(zip);
    assert.equal(entries.size,13,'9 panels + cover + caption + sources + manifest');
    for(let i=0;i<9;i++)assert.ok(entries.get('panels/'+String(i+1).padStart(2,'0')+'.png').equals(images[i]),'panel original bytes preserved');
    assert.ok(entries.get('cover.png').equals(cover),'cover original bytes preserved');
    const manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
    assert.equal(manifest.ready_for_qa,false);assert.equal(manifest.author_approved,false);
    assert.equal(manifest.github_delivered,false);assert.equal(manifest.published,false);
    assert.equal(manifest.assets.length,10);
    for(const asset of manifest.assets)assert.equal(asset.sha256,crypto.createHash('sha256').update(entries.get(asset.path)).digest('hex'));
    assert.match(entries.get('caption.md').toString(),/星际邮局/);
    assert.match(entries.get('sources.md').toString(),/原创虚构故事/);
    fs.writeFileSync(path.join(out,'synthetic-technical-test-ONLY.zip'),zip);

    // Exercise actual existing ZIP import: reject tampering and then accept the intact
    // technical fixture without remote GitHub publication, QA or author signatures.
    await page.goto(base+'#/workspace/'+self.id+'/5');
    await page.locator('#wt3-zip').waitFor({state:'attached'}); // file input intentionally hidden behind a styled label
    const stamp=Buffer.from('"sha256": "');
    const at=zip.indexOf(stamp);
    assert.ok(at>0,'V4 manifest hashes are present in ZIP');
    const forged=Buffer.from(zip);forged.fill(48,at+stamp.length,at+stamp.length+64); // zeros
    await page.locator('#wt3-zip').setInputFiles({name:'tampered-v4-fixture.zip',mimeType:'application/zip',buffer:forged});
    await page.waitForFunction(({key,id})=>{
      const p=JSON.parse(localStorage.getItem(key)).projects.find(x=>x.id===id);
      return p?.handoff?.importStatus==='导入失败';
    },{key:KEY,id:self.id},{timeout:15000});
    const tamperedFeedback=await page.evaluate(({key,id})=>{
      const p=JSON.parse(localStorage.getItem(key)).projects.find(x=>x.id===id);
      return p.handoff.importDetail;
    },{key:KEY,id:self.id});
    assert.match(tamperedFeedback,/V4 画格原图 SHA256 不匹配/,'tampered PNG/hash bundle is rejected');
    await page.locator('#wt3-zip').setInputFiles({name:'untouched-v4-fixture.zip',mimeType:'application/zip',buffer:zip});
    await page.waitForFunction(({key,id})=>{
      const p=JSON.parse(localStorage.getItem(key)).projects.find(x=>x.id===id);
      return p?.handoff?.importStatus==='本地校验完成，待远端暂存';
    },{key:KEY,id:self.id},{timeout:20000});
    const staged=await page.evaluate(({key,id})=>{
      const p=JSON.parse(localStorage.getItem(key)).projects.find(x=>x.id===id);
      return {status:p.handoff.importStatus,assets:p.handoff.stagedFiles?.length,queuedAt:p.handoff.repoQueuedAt,authorApproved:p.handoff?.authorApproved};
    },{key:KEY,id:self.id});
    assert.equal(staged.assets,12,'9 panels, cover, caption and sources staged locally with genuine SHA checks');
    assert.ok(!staged.queuedAt&&!staged.authorApproved,'local import never claims approval or GitHub upload');
    reports.push({test:'V4 ZIP corrupted-hash rejection + actual existing importer round-trip',result:'passed (synthetic fixture only)'});

    reports.push({test:'independent 9+cover native PNG integrity → ZIP download and unpack',result:'passed (synthetic fixture, not artwork QA)'});

    // A genuinely isolated phone viewport: no side-scrolling, three tappable entries.
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,hasTouch:true});
    const phone=await mobile.newPage();
    phone.on('pageerror',e=>errors.push('mobile: '+e.message));
    await phone.goto(base,{waitUntil:'domcontentloaded'});
    await phone.locator('[data-wt4-entry="author"]').waitFor();
    const geometry=await phone.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth,buttons:[...document.querySelectorAll('.wt4-entry-card')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))}));
    assert.ok(geometry.content<=geometry.viewport+2,'no horizontal overflow at phone width: '+JSON.stringify(geometry));
    assert.equal(geometry.buttons.length,3);
    assert.ok(geometry.buttons.every(x=>x.w>=200&&x.h>=45),'phone entries remain large tap targets');
    await phone.screenshot({path:path.join(out,'mobile-entry.png'),fullPage:true});
    await phone.locator('[data-wt4-entry="author"]').click();
    await phone.locator('[data-wt4-create="author"] [name="title"]').fill('手机端测试作品');
    await phone.locator('[data-wt4-create="author"] [name="description"]').fill('手机端创建作品并能进入七步制作');
    await phone.locator('[data-wt4-create="author"] [type="submit"]').click();
    await phone.locator('.wt4-step').first().waitFor();
    const geometry2=await phone.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth,bodyHeight:document.body.scrollHeight}));
    assert.ok(geometry2.bodyHeight<4000,'mobile story stage must not nest giant legacy editors: '+JSON.stringify(geometry2));
    assert.ok(geometry2.content<=geometry2.viewport+2,'no horizontal workspace overflow on phone: '+JSON.stringify(geometry2));
    await phone.screenshot({path:path.join(out,'mobile-workspace.png'),fullPage:true});
    reports.push({test:'real Chromium mobile tap, create, responsive viewport',result:'passed'});
    await mobile.close();

    // Tablet is a separate real browser context, not an emulated CSS assertion.
    const tablet=await browser.newContext({viewport:{width:820,height:1180},hasTouch:true,deviceScaleFactor:1.5});
    try{
      const pad=await tablet.newPage();
      pad.on('pageerror',e=>errors.push('tablet: '+e.message));
      await pad.goto(base,{waitUntil:'domcontentloaded'});
      await pad.locator('[data-wt4-entry="author"]').waitFor();
      assert.equal(await pad.locator('.wt4-entry-card').count(),3,'tablet has all three creation paths');
      const entryGeom=await pad.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(entryGeom.content<=entryGeom.viewport+2,'tablet portrait homepage overflow: '+JSON.stringify(entryGeom));
      await pad.locator('[data-wt4-entry="author"]').click();
      await pad.locator('[data-wt4-create="author"] [name="title"]').fill('平板端独立验收作品');
      await pad.locator('[data-wt4-create="author"] [name="description"]').fill('测试平板端创建漫画，切换角色与剧情分镜，再旋转屏幕');
      await pad.locator('[data-wt4-create="author"] [type="submit"]').click();
      await pad.locator('.wt4-step').first().waitFor();
      assert.equal(await pad.locator('.wt4-step').count(),7);
      await pad.screenshot({path:path.join(out,'tablet-portrait.png'),fullPage:true});
      const id=await pad.evaluate(()=>location.hash.split('/')[2]);
      await pad.goto(base+'#/workspace/'+id+'/1');
      await pad.locator('.wt4-character-workspace').waitFor();
      await pad.goto(base+'#/workspace/'+id+'/2');
      await pad.locator('[data-panel-index="0"][data-panel-field="scene"]').waitFor();
      await pad.setViewportSize({width:1180,height:820});
      await pad.waitForTimeout(160);
      const landscape=await pad.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth,
        steps:document.querySelectorAll('.wt4-step').length}));
      assert.ok(landscape.content<=landscape.viewport+2,'tablet landscape workspace overflow: '+JSON.stringify(landscape));
      assert.equal(landscape.steps,7,'tablet rotation retains unified seven-step workflow');
      await pad.screenshot({path:path.join(out,'tablet-landscape.png'),fullPage:true});
      reports.push({test:'real Chrome tablet portrait + landscape, three-entry creation and seven-step navigation',result:'passed'});
    }finally{await tablet.close()}

    // Verify real storage-exhaustion behavior: no false "saved" UI and no old-project overwrite.
    const exhausted=await browser.newContext({viewport:{width:1280,height:800}});
    try{
      const storagePage=await exhausted.newPage();
      storagePage.on('pageerror',e=>errors.push('storage-recovery: '+e.message));
      await storagePage.goto(base,{waitUntil:'domcontentloaded'});
      await storagePage.locator('[data-wt4-entry="idea"]').waitFor();
      const before=await storagePage.evaluate(()=>JSON.parse(localStorage.getItem('davylab-comic-press-v1')).projects.length);
      await storagePage.evaluate(()=>{
        const real=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){
          if(key==='davylab-comic-press-v1')throw new DOMException('Storage quota exhausted','QuotaExceededError');
          return real.call(this,key,value);
        };
      });
      await storagePage.locator('[data-wt4-entry="idea"]').click();
      await storagePage.locator('#wt4-seed').fill('断电前未保存的星际列车故事');
      await storagePage.locator('[data-wt4-create="idea"] [type="submit"]').click();
      assert.ok((await storagePage.locator('#toast').textContent()).includes('创建未保存'),'failure message must be truthful');
      assert.ok(!(await storagePage.evaluate(()=>location.hash)).startsWith('#/workspace/'),
        'failed save must not navigate to a misleading draft workspace');
      const after=await storagePage.evaluate(()=>JSON.parse(localStorage.getItem('davylab-comic-press-v1')).projects.length);
      assert.equal(after,before,'no phantom new project after storage failure');
      reports.push({test:'real Chrome quota-exceeded failure preserves original stored projects and blocks false navigation',result:'passed'});
    }finally{await exhausted.close()}

    // A broken cloud-sync scheduling callback must not turn a successful local write into a false failure.
    const syncContext=await browser.newContext({viewport:{width:1280,height:800}});
    try{
      const syncPage=await syncContext.newPage();
      syncPage.on('pageerror',e=>errors.push('sync-resilience: '+e.message));
      await syncPage.goto(base,{waitUntil:'domcontentloaded'});
      await syncPage.locator('[data-wt4-entry="author"]').waitFor();
      await syncPage.evaluate(()=>{
        window.wtScheduleSync=()=>{throw new Error('synthetic sync scheduling failure')};
      });
      await syncPage.locator('[data-wt4-entry="author"]').click();
      await syncPage.locator('[data-wt4-create="author"] [name="title"]').fill('离线同步容错测试');
      await syncPage.locator('[data-wt4-create="author"] [name="description"]').fill('云端任务调度异常时仍应当保存本机原始创作内容');
      await syncPage.locator('[data-wt4-create="author"] [type="submit"]').click();
      await syncPage.waitForFunction(()=>location.hash.startsWith('#/workspace/'));
      const localSaved=await syncPage.evaluate(()=>{
        const id=location.hash.split('/')[2];
        return JSON.parse(localStorage.getItem('davylab-comic-press-v1')).projects.some(p=>p.id===id&&p.title==='离线同步容错测试');
      });
      assert.ok(localSaved,'cloud-sync scheduling error must not roll back a successfully persisted local work');
      assert.equal(await syncPage.locator('[data-wt4-save-status]').getAttribute('data-state'),'saved');
      reports.push({test:'local save remains durable when optional cloud-sync scheduler fails',result:'passed'});
    }finally{await syncContext.close()}

    assert.deepEqual(errors,[],'browser JavaScript execution errors');
    fs.writeFileSync(path.join(out,'qa.json'),JSON.stringify({status:'PASS',environment:'offline local Chrome, no account and no paid model',generated_at:new Date().toISOString(),reports,limitations:['Illustrations are synthetic technical fixtures, never comic QA','No authenticated Supabase/Cloudflare API test','No live deployment verification']},null,2));
    console.log('WORLD/TOON V4 browser E2E PASS:\n'+reports.map(x=>'  - '+x.test+': '+x.result).join('\n'));
    await context.close();
  }finally{
    await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
test().catch(err=>{console.error(err.stack||err);process.exitCode=1;server.close();});
