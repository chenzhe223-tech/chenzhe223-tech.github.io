/* WORLD/TOON 3.0 — authenticated independent final approval UI.
 * Author must review each item. GitHub Actions, not this form, decides ready_for_workbuddy.
 */
'use strict';
(function(){
 const labels=[
  '漫画画格、独立封面与原图尺寸完整；不含九宫格拼图',
  '已逐张确认原创画面质量与人物造型一致',
  '中文对白、排版、错别字及文字可读性复核',
  '事实与虚构故事的边界及免责声明清楚',
  '热点来源与真实事件日期经过核查',
  '绘画、照片、模型素材及角色的授权与使用权合规',
  '已用手机连续阅读全篇，画面和人物未被裁切',
  '画格排序、剧情连续性及封面都经作者最终确认'
 ];
 function view(p){
  const h=p?.handoff||{},checked=h.finalChecklist||[],total=checked.filter(Boolean).length,
        staged=(h.stagedFiles||[]).length,uploaded=(h.stageUploaded||[]).length;
  const canSign=!!h.repoQueuedAt&&staged>0&&uploaded===staged;
  return '<section class="box wt3-final-review"><div class="kicker">PUBLICATION GATE / OWNER ONLY</div>'+
   '<h2>作者终审 · 向 GitHub 提交验收</h2>'+
   '<p class="minor">素材提交不等于发表。创意首图审批、来源核验和版权审校完成后，作者才可签署最终授权。GitHub Actions 独立验收后才进入 WorkBuddy 正式发表队列。</p>'+
   '<p><strong>GitHub 暂存进度：'+uploaded+'/'+staged+' 文件</strong> · '+(canSign?'可以进行最终复核':'尚未完成正式素材暂存，终审提交不可用')+'</p>'+
   '<div class="wt3-qa-list">'+labels.map((label,i)=>'<label><input type="checkbox" data-wt3-qa="'+i+'" '+(checked[i]?'checked':'')+'><span>'+label+'</span></label>').join('')+'</div>'+
   '<div class="field"><label>已核验来源 URL（研究型任务必填，一行一条）</label>'+
    '<textarea id="wt3-sources" rows="2" placeholder="https://原始研究或官方资料">'+(typeof e==='function'?e(h.verifiedSources||''):h.verifiedSources||'')+'</textarea></div>'+
   '<label class="wt3-sign"><input type="checkbox" id="wt3-author-consent"><span>我以作品作者身份独立确认本次出版授权；此授权不代表作品已经成功发表。</span></label>'+
   '<div class="buttons"><button type="button" class="button dark" data-wt3-final="submit" '+(canSign?'':'disabled')+'>提交最终作者授权与 GitHub QA</button>'+
    '<button type="button" class="button" data-archive="refresh">刷新仓库验收</button></div>'+
   '<p class="minor">八项人工复核：'+total+'/8 · '+(h.finalApprovalCommit?'已提交验收 Commit：'+String(h.finalApprovalCommit).slice(0,12):'尚未提交最终验收')+'</p></section>';
 }
 const before=publish;
 publish=function(){return view(selected())+before()};
 document.addEventListener('change',ev=>{
  const i=ev.target?.dataset?.wt3Qa,p=selected();
  if(i!=null&&p){p.handoff={...p.handoff,finalChecklist:[...(p.handoff?.finalChecklist||Array(8).fill(false))]};
   p.handoff.finalChecklist[Number(i)]=!!ev.target.checked;setChange(p,'作者更新终审检查项');}
  if(ev.target?.id==='wt3-sources'&&p){p.handoff={...p.handoff,verifiedSources:ev.target.value.slice(0,8000)};
   setChange(p,'更新作者确认的来源 URL')}
 },true);
 document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-wt3-final]');if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();const p=selected();
  try{
   if(!p||!p.handoff?.repoQueuedAt||!p.handoff?.taskId)throw Error('工单尚未正式入仓');
   const h=p.handoff,files=h.stagedFiles||[],count=p.panels?.length||9;
   if(files.length<7||files.length!==h.stageUploaded?.length)throw Error('请先完整上传全部原始素材');
   if(h.finalChecklist?.length!==8||h.finalChecklist.some(x=>x!==true))throw Error('请先逐项完成全部8项终审');
   if(!document.querySelector('#wt3-author-consent')?.checked)throw Error('需要作者主动确认最终出版授权');
   if(!confirm('你确认拥有此漫画的最终出版权，并已完成全部事实、版权、中文和画风审校？确认后将写入正式 GitHub 作者授权清单；不能由创作者或 WorkBuddy 代签。'))return;
   const sha={};
   for(const file of files){
     if(file.sha256)sha[file.path]=file.sha256;
     else if(typeof file.text==='string')sha[file.path]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file.text))),x=>x.toString(16).padStart(2,'0')).join('');
   }
   const original=h.importManifest||{};
   const panels=Array.from({length:count},(_,i)=>'panels/'+String(i+1).padStart(2,'0')+'.png');
   const qa={...(original.qa||{}),
     nine_images:count===9,panel_count_checked:true,size_checked:true,visual_reviewed:true,
     chinese_text_reviewed:true,fiction_disclosed:true,sources_checked:true,
     rights_checked:true,phone_previewed:true};
   const sources=(document.querySelector('#wt3-sources')?.value||h.verifiedSources||'')
      .split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   if(sources.some(s=>!/^https?:\/\//.test(s)))throw Error('核验来源必须为完整的 HTTPS/HTTP URL');
   b.disabled=true;b.textContent='正在提交 GitHub QA…';
   const response=await wtArchiveApi('final-approval',{method:'POST',
     body:JSON.stringify({task_id:h.taskId,author_confirmed:true,approval_scope:'final_comic_publication',
       reviewed_checks:h.finalChecklist,
       manifest:{assets:{cover:'cover.png',panels,caption:'caption.md',sources:'sources.md'},
         sha256:sha,qa,verified_sources:sources.length?sources:(original.verified_sources||[]),
         image_provenance:original.image_provenance||null}})});
   if(!response.commit||response.status!=='submitted_for_independent_github_actions_qa')throw Error('GitHub 作者终审回执无效');
   h.finalApprovalCommit=response.commit;h.importStatus='最终作者已签署 · 等待 GitHub Actions 独立验收';
   setChange(p,'作者终审已真实入仓，GitHub QA 尚待复核：'+response.commit.slice(0,12));render();
   if(typeof wtArchiveRefresh==='function')void wtArchiveRefresh({silent:true});
   notify('作者审核提交成功；出版状态以 GitHub Actions 真实验收为准');
  }catch(error){notify('终审未完成：'+String(error.message||error).slice(0,150))}
  finally{if(document.contains(b)){b.disabled=false;b.textContent='提交最终作者授权与 GitHub QA'}}
 },true);
})();
