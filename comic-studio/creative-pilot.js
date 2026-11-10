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
 const queued=!!p.handoff?.repoQueuedAt;
 const thumb=(key,label)=>images[key]?'<img data-source="'+e(images[key])+'" src="'+e(mediaSrc(images[key]))+'" alt="'+e(label)+'">':
  '<div class="director-pilot-missing">'+label+' · 尚未上传实际图片</div>';
 return '<section class="box director-pilot"><div class="director-pilot-heading"><div><div class="kicker">VISUAL PILOT / FIRST PROOF</div>'+
  '<h2>先看两张真样稿，再批量生成</h2>'+
  '<p class="minor">ChatGPT 先交角色定妆及正式尺寸的第一格原图。审核通过后第一格原图不允许再生成或替换；CSS 示意不等于画质。</p></div>'+
  '<span class="director-status '+(receipt?.repo_commit?'ready':'')+'">'+(receipt?.repo_commit?'已批准样稿':'待样稿确认')+'</span></div>'+
  '<div class="director-pilot-grid">'+
  [['character','角色定妆图','characterImage'],['panel','首格试画','panelImage']].map(([type,title,key])=>
   '<article><strong>'+title+'</strong><div class="director-pilot-image">'+thumb(key,title)+'</div>'+
   '<label class="button">上传真实'+title+'<input type="file" data-pilot-upload="'+type+'" accept="image/png" hidden></label></article>').join('')+
  '</div><p class="minor">核对人物的脸、体型、服装、标志道具、背景配色、镜头和中文文字留白。换图后必须重新批准。</p>'+
  '<label class="director-consent"><input type="checkbox" data-pilot-review="1" '+(c.pilotReviewed?'checked':'')+
  (receipt?.repo_commit?' disabled':'')+'> 我已亲自检查两张实际图片，与锁定的创意圣经一致。</label>'+
  '<div class="buttons"><button type="button" class="button dark" data-pilot-action="approve" '+(busy||!queued||receipt?.repo_commit?'disabled':'')+'>批准试画并记录私有仓回执</button>'+
  '<button type="button" class="button" data-pilot-action="copy" '+(receipt?.repo_commit?'':'disabled')+'>复制继续制作指令</button>'+ 
  '<button type="button" class="button" data-pilot-action="revision" '+(!queued?'disabled':'')+'>试画不满意 · 创建新版本</button></div>'+
  '<p class="minor">'+(!queued?'先正式派单；ChatGPT 提交两张试画后，在这里进行作者审核。':
   receipt?.repo_commit?'创作样稿已获得 GitHub 私有仓确认，可按回执继续剩余画格。':
   '两张样稿上传后，点击批准会把锁码和图片 SHA256 写入私有 GitHub，不会自动发表。')+'</p></section>';
}
function shaHex(data){return Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('')}
async function upload(p,type,file){
 if(!TYPES[type]||!file)throw Error('请选择真实样稿');
 const c=p.creativeDirection;
 if(!c?.approval?.lock_hash)throw Error('必须先确认创意方向');
 if(file.type!=='image/png'||!file.name.toLowerCase().endsWith('.png')||file.size>12*1024*1024||file.size<40000)throw Error('样稿必须是与私有 GitHub 文件完全一致的真实 PNG（40KB～12MB）');
 const bytes=new Uint8Array(await file.arrayBuffer()),blob=wfImageFile(file.name,bytes);
 const image=await createImageBitmap(blob),width=image.width,height=image.height;image.close?.();
 const strictV3=!!window.WTStyleV3?.CATALOG?.some(x=>x.style_id===c.styleId);
 if(type==='panel'&&strictV3&&(width!==1080||height!==1440))throw Error('V3 首格真实预览必须是正式模型原生 1080×1440 PNG；不得将低分辨率图放大、裁切或重新渲染代替');
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
 render();notify('样稿已保存。确认实际视觉效果后，再同步私有仓审核回执。');
}
async function approve(p){
 if(busy)return;
 const c=p.creativeDirection,pilot=c?.pilot||{};
 if(!p.handoff?.taskId||!p.handoff?.repoQueuedAt)throw Error('请先正式派单，获得 task_id');
 if(!wtDirector.approved(p))throw Error('导演台创意锁码已变化，请先重新定稿');
 if(!c.pilotReviewed||!validHash(pilot.characterSha256)||!validHash(pilot.panelSha256))throw Error('需要两张真实图片且作者亲自勾选审核');
 if(!wtSession?.access_token||typeof wtArchiveApi!=='function')throw Error('请先登录平台云端账户，签署 GitHub 私有仓审核回执');
 if(!confirm('确认角色造型、画风、构图符合锁定的导演方案，并签发本次样稿批准吗？'))return;
 busy=true;render();
 try{
  const receipt={schema:'davylab.worldtoon.pilot-approval.v1',task_id:p.handoff.taskId,lock_hash:c.approval.lock_hash,
   author_approved:true,approved_at:new Date().toISOString(),character_sheet_sha256:pilot.characterSha256,
   pilot_frame_sha256:pilot.panelSha256,character_sheet_dimensions:pilot.characterDimensions,
   pilot_frame_dimensions:pilot.panelDimensions};
  const result=await wtArchiveApi('pilot-approval',{method:'POST',body:JSON.stringify(receipt)});
  if(!result?.commit||!result?.path)throw Error('GitHub 未返回有效回执，不能标记样稿已批准');
  c.pilotApproval={...receipt,repo_commit:result.commit,repo_path:result.path};
  setChange(p,'作者批准真实试画并写入 GitHub '+String(result.commit).slice(0,12));
  notify('样稿已完成私有仓确认；可复制继续生产指令');
 }finally{busy=false;render()}
}
function revise(p){
 if(!p.handoff?.repoQueuedAt)throw Error('未正式派单的作品可以直接返回前面步骤修改，无需新建修订版');
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

async function copy(p){
 const c=p.creativeDirection,a=c?.pilotApproval;
 if(!a?.repo_commit)throw Error('尚无已确认的 GitHub 样稿审核回执');
 const text='WORLD/TOON · 样稿已由作者正式批准。请继续当前任务的余下画格制作。\n'+
  'task_id: '+p.handoff.taskId+'\n'+
  '批准创意锁码: '+a.lock_hash+'\n'+
  '已批准角色定妆图 SHA256: '+a.character_sheet_sha256+'\n'+
  '已批准首格试画 SHA256: '+a.pilot_frame_sha256+'\n'+
  '审核凭据：'+a.repo_path+' · commit '+a.repo_commit+'\n'+
  '请先自行读取并验证 GitHub 审核回执与 tasks/<task_id>/task.json 的创意锁码一致。继续时必须沿用两张已批准的样稿、固定人物外观和服装、色板、镜头、九格剧情；生成九张独立画格及封面，做角色一致性/手机阅读/权利 QA。未经作者最终出版审核不能发表。';
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
 Promise.resolve(el.dataset.pilotAction==='approve'?approve(p):el.dataset.pilotAction==='revision'?revise(p):copy(p)).catch(err=>notify('样稿验收：'+String(err.message||err)));
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
