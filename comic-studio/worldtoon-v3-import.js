/* WORLD/TOON 3.0 secure artifact ingestion: locally stage, validate, then upload to private GitHub.
 * Nothing becomes 'published' without independent GitHub QA and a WorkBuddy receipt.
 */
'use strict';
(function(){
 const safe=s=>typeof e==='function'?e(s):String(s??'');
 const normName=v=>String(v).replace(/\\/g,'/').replace(/^.*?\//,'');
 const readText=b=>new TextDecoder('utf-8',{fatal:false}).decode(b);
 const pending=new Set();
 const panelRe=/(?:^|\/)(?:panels?\/)?(?:panel[-_]?)?(0?[1-9]|[1-5][0-9]|60)\.png$/i;
 function panelNumber(name){
  const m=String(name).replace(/\\/g,'/').match(panelRe);return m?Number(m[1]):0;
 }
 function uiFor(p){
  const h=p?.handoff||{},st=h.importStatus||'尚未导入',n=h.stagedFiles?.length||0;
  return '<div class="wt3-import"><h3>ChatGPT 成品一键导入</h3>'+
   '<p class="minor">支持一份完整 ZIP：cover.png、panels/01.png…、caption.md、sources.md、manifest.json（如有）。自动校验画格、分辨率和 SHA256；上传成功并不代表 QA 或发表批准。</p>'+
   '<label class="button dark">↑ 导入完整素材 ZIP<input type="file" id="wt3-zip" accept=".zip,application/zip" hidden></label>'+
   '<p class="minor">阶段：'+safe(st)+' · 已核对文件 '+n+' 个 · '+safe(h.importDetail||'')+'</p>'+
   '<div class="buttons"><button class="button" type="button" data-wt3-import="resume"'+(!h.stagedFiles?.length?' disabled':'')+'>同步到私有 GitHub / 重试失败项</button>'+
   '<a class="button" href="#/publish">前往出版审核 →</a></div>'+
   '<p class="minor">本地预览 → 仓库暂存 → 实际 QA → 作者最终批准 → WorkBuddy 发表 → 真实回执入书架。</p></div>';
 }
 window.WT3ImportPanel=uiFor;
 function findByName(files,pred){for(const [name,b] of files){if(pred(name))return [name,b]}return null}
 async function validatePNG(bytes,label){
  if(bytes.length<40000||bytes.length>20*1024*1024||
     bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw Error(label+' 不是有效的正式 PNG，或文件大小不合规');
  const blob=new Blob([bytes],{type:'image/png'});let bitmap;
  try{bitmap=await createImageBitmap(blob);if(bitmap.width<1080||bitmap.height<1440)throw Error(label+' 分辨率不足1080×1440')}catch(error){throw Error(label+' 解码/尺寸核验失败：'+error.message)}
  finally{bitmap?.close()}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  return {blob,sha256:digest};
 }
 async function importZip(file){
  if(pending.size)throw Error('已有素材包正在处理，请避免重复导入');
  if(!file||!/.zip$/i.test(file.name))throw Error('请选择 ZIP 压缩包');
  const current=selected();if(!current)throw Error('请先建立或选择一个漫画作品');
  if(current.handoff?.importStatus==='uploading')throw Error('当前正在同步素材，请稍后再试');
  pending.add(current.id);const created=[];
  try{
   current.handoff={...current.handoff,importStatus:'校验压缩包'};
   setChange(current,'开始导入 ChatGPT 素材包');render();
   const files=await wfUnzip(file);const found=new Map();
   for(const [name,b] of files){const i=panelNumber(name);if(i){if(found.has(i))throw Error('第'+i+'张漫画存在重复文件');found.set(i,{name,bytes:b})}}
   if(found.size<4||found.size>60)throw Error('缺少独立漫画画格，数量须为4–60张');
   const n=found.size;
   for(let i=1;i<=n;i++)if(!found.has(i))throw Error('画格不连续：缺少第'+i+'格');
   const cover=findByName(files,name=>/(?:^|\/)cover\.png$/i.test(name));
   if(!cover)throw Error('缺少正式独立封面 cover.png');
   const manifestFile=findByName(files,name=>/(?:^|\/)(?:manifest|delivery)\.json$/i.test(name));
   const taskFile=findByName(files,name=>/(?:^|\/)task\.json$/i.test(name));
   let manifest=null,task=null;
   if(manifestFile){try{manifest=JSON.parse(readText(manifestFile[1]))}catch{throw Error('manifest.json 格式不正确')}}
   if(taskFile){try{task=JSON.parse(readText(taskFile[1]))}catch{throw Error('task.json 格式不正确')}}
   const taskId=String(manifest?.task_id||task?.task_id||current.handoff?.taskId||'');
   if(taskId&&!/^WT-[0-9a-f]{20}$/.test(taskId))throw Error('任务编号格式无效');
   if(current.handoff?.repoQueuedAt&&current.handoff.taskId!==taskId)throw Error('交付包任务编号与当前已派单作品不一致，拒绝覆盖');
   if(manifest?.assets?.panels&&manifest.assets.panels.length!==n)throw Error('素材文件与交付清单中的画格数量不一致');
   if(manifest?.producer&&current.productionAgent&&manifest.producer!==current.productionAgent)throw Error('素材包制作 Agent 与工单不一致');
   const pieces=[],localImages=[];
   for(let i=1;i<=n;i++){
     const file=found.get(i),check=await validatePNG(file.bytes,'第'+i+'格');
     const rel='panels/'+String(i).padStart(2,'0')+'.png';
     if(manifest?.sha256?.[rel]&&manifest.sha256[rel]!==check.sha256)throw Error('画格 SHA256 不匹配：'+rel);
     pieces.push({path:rel,...check});
   }
   const check=await validatePNG(cover[1],'独立封面');
   if(manifest?.sha256?.['cover.png']&&manifest.sha256['cover.png']!==check.sha256)throw Error('封面 SHA256 与清单不匹配');
   pieces.unshift({path:'cover.png',...check});
   if(new Set(pieces.map(x=>x.sha256)).size!==pieces.length)throw Error('发现内容相同的图片，不能用重复图充数');
   if(manifest?.assets?.cover&&manifest.assets.cover!=='cover.png')throw Error('封面文件必须为 cover.png');
   const captionFile=findByName(files,name=>/(?:^|\/)(caption\.md|weixin-caption\.txt)$/i.test(name));
   const sourcesFile=findByName(files,name=>/(?:^|\/)sources\.md$/i.test(name));
   pieces.push({path:'caption.md',text:captionFile?readText(captionFile[1]):'《'+current.title+'》\n'+(current.description||'')+'\n'+(current.disclosure||'原创漫画')+'\nWORLD/TOON · By DAVYLAB'});
   pieces.push({path:'sources.md',text:sourcesFile?readText(sourcesFile[1]):'来源待核验：\n'+(current.sourceURLs||'原创漫画，不涉及真实来源')+'\n'+(current.factNotes||'')});
   const styleFile=findByName(files,name=>/(?:^|\/)style-lock\.json$/i.test(name));
   if(styleFile)pieces.push({path:'style-lock.json',text:readText(styleFile[1])});
   for(const piece of pieces.filter(x=>x.blob)){const key=uid();await putMedia(key,piece.blob);created.push(key);localImages.push('media:'+key)}
   const p=current;
   if(p.panels.length!==n&&p.handoff?.repoQueuedAt)throw Error('已入仓工单的篇幅不可变动，请按已批准数量重新交付');
   if(p.creativeDirection&&p.creativeDirection.approval?.author_approved&&p.panels.length!==n)throw Error('导演台已经锁定篇幅，请先建立新的审批版本');
   p.panels=Array.from({length:n},(_,i)=>({...p.panels[i]||makePanel(i),image:localImages[i+1]}));
   p.cover=localImages[0];p.status='待审核';p.checks=Array(6).fill(false);p.reviewedAt=null;
   p.handoff={...p.handoff,taskId:taskId||p.handoff?.taskId||'',importStatus:'本地校验完成，待远端暂存',
      importedAt:now(),importManifest:manifest||null,importDetail:n+'张漫画 + 独立封面',
      stagedFiles:pieces.map(x=>({path:x.path,sha256:x.sha256||null,text:x.text||null,
       imageKey:x.blob?created[pieces.filter(y=>y.blob).findIndex(y=>y.path===x.path)]:null})),stageUploaded:[]};
   setChange(p,'正式 PNG 素材包导入并校验：'+n+'张画格 + 封面');
   render();notify('素材包导入成功；开始尝试安全暂存到 GitHub');
   if(taskId&&p.handoff.repoQueuedAt)await resume(p);
  }catch(error){
    for(const key of created)await delMedia(key).catch(()=>{});
    current.handoff={...current.handoff,importStatus:'导入失败',importDetail:String(error.message||error).slice(0,180)};
    setChange(current,'素材包导入失败（未批准发表）');render();throw error;
  }finally{pending.delete(current.id)}
 }
 async function resume(p){
  const rows=p.handoff?.stagedFiles||[],tid=p.handoff?.taskId||'';
  if(!/^WT-[0-9a-f]{20}$/.test(tid)||!p.handoff?.repoQueuedAt)throw Error('任务尚未正式 GitHub 派单：保留本地素材，不允许伪称已入仓');
  if(!wtArchiveAuth())throw Error('请先登录仓库管理员账户');
  if(!rows.length)throw Error('没有待同步素材');
  p.handoff.importStatus='uploading';setChange(p,'开始上传真实漫画文件到私有仓库');render();
  let done=new Set(p.handoff.stageUploaded||[]);
  try{
   for(const asset of rows){
    if(done.has(asset.path))continue;
    let payload,contentType;
    if(asset.imageKey){payload=await getMedia(asset.imageKey);if(!payload)throw Error('本地素材已丢失：'+asset.path);contentType='image/png'}
    else {payload=new Blob([asset.text||''],{type:'text/markdown'});contentType='text/markdown'}
    const r=await wtArchiveApi('assets?task_id='+encodeURIComponent(tid)+'&path='+encodeURIComponent(asset.path),
       {method:'PUT',headers:{'content-type':contentType},body:payload});
    if(r.path!==asset.path||r.task_id!==tid)throw Error('远端回执不匹配：'+asset.path);
    if(asset.sha256&&r.sha256!==asset.sha256)throw Error('远端原始文件 SHA256 不一致：'+asset.path);
    done.add(asset.path);p.handoff.stageUploaded=[...done];
    p.handoff.importDetail='已上传 '+done.size+' / '+rows.length+' 文件';
    setChange(p,'GitHub 素材暂存：'+asset.path);
   }
   p.handoff.importStatus='GitHub 文件暂存完成 · 等待质量审核与独立作者授权';
   setChange(p,'所有素材已提交 GitHub 暂存；未生成 QA 通过的 manifest，不会进入发表队列');
   render();notify('真实素材已写入 GitHub；请完成创意试画审核与最终出版审批');
  }catch(error){
   p.handoff.importStatus='GitHub 暂存部分完成 · 可重试';
   p.handoff.importDetail=String(error.message||error).slice(0,150);setChange(p,'GitHub 部分文件上传失败，保留完成记录');
   render();throw error;
  }
 }
 document.addEventListener('change',ev=>{
  if(ev.target?.id==='wt3-zip'&&ev.target.files?.[0]){ev.stopImmediatePropagation();
    importZip(ev.target.files[0]).catch(err=>notify('素材包处理失败：'+String(err.message||err).slice(0,130)));}
 },true);
 document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-wt3-import]');if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  if(b.dataset.wt3Import==='resume'){const p=selected();if(p)resume(p).catch(error=>notify('同步失败：'+String(error.message||error).slice(0,130)))}
 },true);
 window.WT3Import={importZip,resume,panelNumber,validatePNG};
})();