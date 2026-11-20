/* WORLD/TOON Visual Pilot · real artwork review before nine-panel production.
 * "Approved" means signed into private GitHub by the authenticated creator, NOT final publication approval.
 */
'use strict';
(function(){
const TYPES={character:'characterImage',panel:'panelImage'};
let busy=false;
const validHash=v=>/^[a-f0-9]{64}$/.test(String(v||''));
function pilot(p){
 const c=p?.creativeDirection||{},images=c.pilot||{},receipt=c.pilotApproval;
 if(!c.approval?.lock_hash)return '';
 const direct=(p.productionAgent||'ChatGPT')==='ChatGPT';
 const queued=direct?!!p.handoff?.taskId:!!p.handoff?.repoQueuedAt;
 const approved=!!(receipt?.local_approved||receipt?.repo_commit);
 const thumb=(key,label)=>images[key]?'<img data-source="'+e(images[key])+'" src="'+e(mediaSrc(images[key]))+'" alt="'+e(label)+'">':
  '<div class="director-pilot-missing">'+label+' · 尚未上传实际图片</div>';
 return '<section class="box director-pilot"><div class="director-pilot-heading"><div><div class="kicker">VISUAL PILOT / FIRST PROOF</div>'+
  '<h2>先看两张真样稿，再批量生成</h2>'+
  '<p class="minor">ChatGPT 先交角色定妆及正式尺寸的第一格原图。审核通过后第一格原图不允许再生成或替换；CSS 示意不等于画质。</p></div>'+
  '<span class="director-status '+(approved?'ready':'')+'">'+(approved?'已批准样稿':'待样稿确认')+'</span></div>'+
  '<div class="director-pilot-grid">'+
  [['character','角色定妆图','characterImage'],['panel','首格试画','panelImage']].map(([type,title,key])=>
   '<article><strong>'+title+'</strong><div class="director-pilot-image">'+thumb(key,title)+'</div>'+
   '<label class="button">上传真实'+title+'<input type="file" data-pilot-upload="'+type+'" accept="image/png" hidden></label></article>').join('')+
  '</div><p class="minor">核对人物的脸、体型、服装、标志道具、背景配色、镜头和中文文字留白。换图后必须重新批准。</p>'+
  '<label class="director-consent"><input type="checkbox" data-pilot-review="1" '+(c.pilotReviewed?'checked':'')+
  (approved?' disabled':'')+'> 我已亲自检查两张实际图片，与锁定的创意圣经一致。</label>'+
  '<div class="buttons"><button type="button" class="button dark" data-pilot-action="approve" '+(busy||!queued||approved?'disabled':'')+'>'+(direct?'本地批准定妆 · 继续全套制作':'批准试画并记录私有仓回执')+'</button>'+
  '<button type="button" class="button" data-pilot-action="bundle" '+(approved?'':'disabled')+'>下载真实样稿续作 ZIP</button>'+
  '<button type="button" class="button" data-pilot-action="copy" '+(approved?'':'disabled')+'>复制继续制作指令</button>'+ 
  '<button type="button" class="button" data-pilot-action="revision" '+(!queued?'disabled':'')+'>试画不满意 · 创建新版本</button></div>'+
  '<p class="minor">'+(!queued?'先导出 ChatGPT 任务包；交回两张真实定妆样稿即可在本地批准。':
   approved?'定妆已获作者批准，可继续制作余下漫画，发表授权另行审核。':
   ''+(direct?'确认后在本机保存锁码及 SHA256，不依赖 GitHub，也不自动发表。':'确认后将锁码与 SHA256 写入私有 GitHub，不自动发表。')+'')+'</p></section>';
}
function shaHex(data){return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('')}
async function upload(p,type,file){
 if(!TYPES[type]||!file)throw Error('请选择真实样稿');
 const c=p.creativeDirection;
 if(!c?.approval?.lock_hash)throw Error('必须先确认创意方向');
 if(file.type!=='image/png'||!file.name.toLowerCase().endsWith('.png')||file.size>12*1024*1024||file.size<40000)throw Error('样稿必须是真实且可验证的 PNG（40KB～12MB）');
 const bytes=new Uint8Array(await file.arrayBuffer()),blob=wfImageFile(file.name,bytes);
 const image=await createImageBitmap(blob),width=image.width,height=image.height;image.close?.();
 const strictV3=!!window.WTStyleV3?.CATALOG?.some(x=>x.style_id===c.styleId);
 if(type==='panel'&&strictV3&&(width<1080||height<1440||Math.abs(width/height-0.75)>0.002))throw Error('V3 首格须为至少 1080×1440 且比例 3:4 的原始 PNG；仅凭尺寸不能证明未经上采样，还需记录实际生成来源');
 if(type==='character'&&strictV3&&(width<1080||height<1440))throw Error('V3 角色定妆图至少 1080×1440');
 if(!strictV3&&(width<640||height<640))throw Error('真实样稿宽高须至少640像素');
 const sha=shaHex(await crypto.subtle.digest('SHA-256',bytes)),key=uid();
 await putMedia(key,blob);
 const old=c.pilot?.[TYPES[type]];
 c.pilot=c.pilot||{};
 c.pilot[TYPES[type]]='media:'+key;
 c.pilot[type+'Sha256']=sha;
 c.pilot[type+'Dimensions']={width,height};
 c.pilotReviewed=false;c.pilotApproval=null;
 setChange(p,'接收并保存真实制作样稿：'+type);
 if(old?.startsWith('media:')){try{await delMedia(old.slice(6))}catch{}}
 render();notify('样稿已保存。核对真实人物与画风后，由作者在此进行定妆确认。');
}
async function approve(p){
 if(busy)return;
 const c=p.creativeDirection,pilot=c?.pilot||{};
 if(!p.handoff?.taskId)throw Error('请先导出任务 ZIP，以生成稳定的 task_id');
 const direct=(p.productionAgent||'ChatGPT')==='ChatGPT';
 if(!direct&&!p.handoff?.repoQueuedAt)throw Error('WorkBuddy 模式需先完成正式派单');
 if(!wtDirector.approved(p))throw Error('导演台创意锁码已变化，请先重新定稿');
 if(!c.pilotReviewed||!validHash(pilot.characterSha256)||!validHash(pilot.panelSha256))throw Error('需要两张真实图片且作者亲自勾选审核');
 if(!confirm('确认角色造型、画风、构图符合锁定的导演方案，并签发本次样稿批准吗？'))return;
 busy=true;render();
 try{
  const receipt={schema:'davylab.worldtoon.pilot-approval.v1',task_id:p.handoff.taskId,lock_hash:c.approval.lock_hash,
   author_approved:true,approved_at:new Date().toISOString(),character_sheet_sha256:pilot.characterSha256,
   pilot_frame_sha256:pilot.panelSha256,character_sheet_dimensions:pilot.characterDimensions,
   pilot_frame_dimensions:pilot.panelDimensions};
  if(direct){
   c.pilotApproval={...receipt,local_approved:true,approval_mode:'owner_local_production_only',publication_approved:false};
   setChange(p,'作者本地批准定妆与首格，ChatGPT 可直接继续全量制作');
   notify('本地定妆已批准；下载带真实图片的续作 ZIP，再交给 ChatGPT');
   return;
  }
  if(!wtSession?.access_token||typeof wtArchiveApi!=='function')throw Error('请先登录平台云端账户');
  const result=await wtArchiveApi('pilot-approval',{method:'POST',body:JSON.stringify(receipt)});
  if(!result?.commit||!result?.path)throw Error('GitHub 未返回有效回执，不能标记样稿已批准');
  c.pilotApproval={...receipt,repo_commit:result.commit,repo_path:result.path};
  setChange(p,'作者批准真实试画并写入 GitHub '+String(result.commit).slice(0,12));
  notify('样稿已完成私有仓确认；可复制继续生产指令');
 }finally{busy=false;render()}
}
function revise(p){
 if(p.productionAgent==='WorkBuddy'&&!p.handoff?.repoQueuedAt)throw Error('WorkBuddy 模式仍需正式派单后才能创建修订版本');
 if(!confirm('试画或剧情不满意？建立独立的新版本会保留旧任务和审批记录，复制现有创作设定供你修改。继续吗？'))return;
 const edition=Math.max(2,Number(p.creativeRevisionNumber||1)+1);
 const token=uid().replace(/[^a-z0-9]/gi,'').toLowerCase().slice(-8).padStart(8,'0');
 const clone=JSON.parse(JSON.stringify(p));
 clone.id=uid();clone.creativeRevision='r'+edition+'-'+token;clone.creativeRevisionNumber=edition;
 clone.createdAt=new Date().toISOString();clone.updatedAt=clone.createdAt;clone.status='草稿';
 clone.archived=false;clone.deleted=false;clone.reviewedAt=null;clone.publishedAt=null;clone.cover='';
 clone.checks=Array(6).fill(false);
 clone.handoff={mode:p.handoff?.mode||'hotspot'};
 clone.activity=[{at:clone.createdAt,detail:'从第'+(edition-1)+'版复制制作方案，等待重新审阅'}];
 clone.panels=(clone.panels||[]).map(x=>({...x,id:uid(),image:''}));
 if(clone.creativeDirection){
  clone.creativeDirection.approval=null;clone.creativeDirection.reviewed=false;
  clone.creativeDirection.pilot=null;clone.creativeDirection.pilotApproval=null;
  clone.creativeDirection.pilotReviewed=false;
 }
 data.projects.unshift(clone);ui.selected=clone.id;persist();
 nav('director/'+clone.id);notify('已创建独立修订版 V'+edition+'；旧任务保留不覆盖。重新确认后可生成新的 ChatGPT 工单。');
}

// Approved-local pilot delivery contains actual PNG bytes, not merely filenames and hashes.
async function exportApprovedBundle(p){
 const c=p.creativeDirection||{},a=c.pilotApproval||{},pilot=c.pilot||{};
 if(!a.author_approved||!(a.local_approved===true||a.repo_commit))throw Error('作者尚未确认真实 Pilot，不能导出续作包');
 if(!wtDirector.approved(p)||a.lock_hash!==c.approval?.lock_hash||a.task_id!==p.handoff?.taskId)
  throw Error('样稿审批与当前任务锁码或 task_id 不一致；请重新完成批准');
 const read=async (source,expected,label,mime='image/png')=>{
  if(!source||!validHash(expected))throw Error(label+'缺少实际文件或 SHA256');
  const blob=await getImageBlob(source);
  if(mime==='image/png'&&blob.type!=='image/png')throw Error(label+'不是原生 PNG');
  if(mime==='portrait'&&!['image/png','image/jpeg','image/webp'].includes(blob.type))throw Error(label+'格式不支持');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const digest=shaHex(await crypto.subtle.digest('SHA-256',bytes));
  if(digest!==expected)throw Error(label+'内容已被替换；拒绝输出错误的参考图');
  return bytes;
 };
 const character=await read(pilot.characterImage,a.character_sheet_sha256,'角色定妆'),first=await read(pilot.panelImage,a.pilot_frame_sha256,'首格正式样稿');
 const task=wfTaskObject(p),bible=wfProductionBible(p,task),jobs=wfSingleImageJobs(p,task,bible);
 bible.evidence_state={character_sheet_sha256:a.character_sheet_sha256,
  pilot_frame_sha256:a.pilot_frame_sha256,pilot_approved:true,
  approved_at:a.approved_at,approval_mode:a.local_approved?'local_only':'repository_confirmed',
  image_generation_model:'unknown',image_generation_version:'unknown',publication_approved:false};
 const files=[
  {name:'character-sheet.png',bytes:character},
  {name:'pilot-01.png',bytes:first},
  {name:'panels/01.png',bytes:first},
  {name:'pilot-approval.json',bytes:enc.encode(JSON.stringify(a,null,2))},
  {name:'production-bible.json',bytes:enc.encode(JSON.stringify(bible,null,2))},
  {name:'render_jobs.json',bytes:enc.encode(JSON.stringify(jobs,null,2))},
  {name:'production_state.json',bytes:enc.encode(JSON.stringify({
   schema:'davylab.worldtoon.production-state.v1',task_id:a.task_id,current_working_version:'pilot-approved',
   accepted:{'panels/01.png':a.pilot_frame_sha256},remaining:jobs.jobs.filter(x=>x.job_id!=='P01').map(x=>x.target),
   package_ready:false,github_delivered:false,publication_approved:false,workbuddy_ready:false
  },null,2))},
  {name:'CONTINUE.md',bytes:enc.encode('WORLD/TOON · 作者已批准的实际图像参考续作包\n\n'+
   '此 ZIP 已包含角色定妆 character-sheet.png、首格 pilot-01.png，且 panels/01.png 与 Pilot 字节完全一致。'+
   '真实生图时每次都附上 character-sheet.png 与获批首格，并核对二者 SHA256；不能仅发送参考文件名。'+
   '依次独立生成 02—09 和 cover.png，每次只提交对应 render_jobs.jobs[i].prompt；禁止整体发送 storyboard、任务 ZIP 全文或其他格。'+
   '渲染结果不得内嵌文字或气泡，中文必须由已锁定分镜独立排版。两次同类拼版错误即停止同路径重试，报告工具限制。'+
   '每个图像保留单独的候选/接受记录，不可替换已经批准的 01 原图。完成全量 QA 后另行生成正式 FINAL ZIP；'+
   '本 ZIP 不是最终成品，也不代表 GitHub 已入仓、WorkBuddy 授权或实际发表。\n')}
 ];
 for(let i=0;i<(c.cast||[]).length;i++){
  const ch=c.cast[i];if(!ch.portraitMedia)continue;
  if(ch.portraitConsent!==true)throw Error('第'+(i+1)+'位角色肖像授权未确认');
  const b=await read(ch.portraitMedia,ch.portraitSha256,'第'+(i+1)+'位角色肖像','portrait');
  files.push({name:'references/portrait-'+String(i+1).padStart(2,'0')+'.'+(ch.portraitExt||'png'),bytes:b});
 }
 saveFile(packZip(files),'WORLD_TOON_已批准真实样稿_续作_'+a.task_id+'.zip');
 notify('已导出真实角色图＋Pilot 原图及 SHA256 续作 ZIP；不是最终交付或发表批准');
}
async function copy(p){
 const a=p.creativeDirection?.pilotApproval;
 if(!(a?.local_approved===true||a?.repo_commit))throw Error('请先由作者确认两张真实定妆样稿');
 const evidence=a.local_approved===true?'作者本地定妆确认（production only，不等于入仓或出版授权）':
  'GitHub 回执：'+a.repo_path+' · '+a.repo_commit;
 const text='WORLD/TOON DIRECT_CHATGPT_LOCAL_V1｜角色定妆已批准，立即继续制作本任务的剩余画格、独立封面、文字和完整可下载 ZIP。无需 GitHub 同步、远端审批或其他阶段确认。\n'+
  'task_id: '+p.handoff.taskId+'\n'+
  '锁定创意码: '+a.lock_hash+'\n'+
  '角色定妆 SHA256: '+a.character_sheet_sha256+'\n'+
  '正式首格 SHA256: '+a.pilot_frame_sha256+'\n'+
  '定妆凭据: '+evidence+'\n'+
  '请先下载“真实样稿续作 ZIP”并将其中两张 PNG 实际附给生图工具；只有文字及 SHA256 无法约束人物造型。严格沿用已批准两张样稿的人物面部、服装、色板与镜头；逐张生成全部正式 PNG 并做中文/事实/人物一致性/手机端与权利 QA。保存真实文件并计算本地 SHA256；不合格图返工。若会话中断，保存 production_state.json，在同一任务断点续作。最终提供一键下载 ZIP，公众号发表仍需作者最终独立批准。';
 await copyText(text);
}
const previous=window.wtCreativeDirector;
window.wtCreativeDirector=function(){
 const base=previous();
 const p=selected();
 if(p?.creativeDirection?.approval?.lock_hash&&location.hash.startsWith('#/director')){
  queueMicrotask(()=>{if(typeof hydrateImages==='function')hydrateImages()});
  return base+pilot(p);
 }
 return base;
};
document.addEventListener('click',ev=>{
 const el=ev.target.closest('[data-pilot-action]');if(!el)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected();if(!p)return;
 Promise.resolve(el.dataset.pilotAction==='approve'?approve(p):el.dataset.pilotAction==='revision'?revise(p):el.dataset.pilotAction==='bundle'?exportApprovedBundle(p):copy(p)).catch(err=>notify('样稿验收：'+String(err.message||err)));
},true);
document.addEventListener('change',ev=>{
 const el=ev.target,p=selected();if(!p||!el)return;
 if(el.dataset.pilotUpload)upload(p,el.dataset.pilotUpload,el.files?.[0]).catch(err=>notify('样稿上传：'+String(err.message||err)));
 if(el.dataset.pilotReview){
  p.creativeDirection.pilotReviewed=!!el.checked;
  p.creativeDirection.pilotApproval=null;setChange(p,'记录样稿复核状态');render();
 }
},true);
window.wtPilot={pilot,upload,approve,copy,revise};
if(location.hash.startsWith('#/director'))queueMicrotask(()=>render());
})();
