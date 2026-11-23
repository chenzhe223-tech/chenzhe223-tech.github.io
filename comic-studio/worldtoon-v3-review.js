/* WORLD/TOON 3.0 — authenticated independent final approval UI.
 * Author must review each item. GitHub Actions, not this form, decides ready_for_workbuddy.
 */
'use strict';
(function(){
 const labels=[
  '逐张检查单幅连续场景：封面及所有画格均非九宫格、非拼版、非画中画',
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
  const checkedCount=labels.reduce((n,_,i)=>n+(checked[i]===true?1:0),0);
  return '<section class="box wt3-final-review"><div class="kicker">PUBLICATION GATE / OWNER ONLY</div>'+
   '<h2>作者终审 · 向 GitHub 提交验收</h2>'+
   '<p class="minor">素材提交不等于发表。创意首图审批、来源核验和版权审校完成后，作者才可签署最终授权。GitHub Actions 独立验收后才进入 WorkBuddy 正式发表队列。</p>'+
   '<p><strong>GitHub 暂存进度：'+uploaded+'/'+staged+' 文件</strong> · '+(canSign?'可以进行最终复核':'尚未完成正式素材暂存，终审提交不可用')+'</p>'+
   '<section class="wt3-qa-panel" aria-label="八项作品质量复核">'+
     '<div class="wt3-qa-toolbar"><div class="wt3-qa-toolbar-title"><strong>作品质量复核</strong><span>已确认 <b data-wt3-qa-count>'+checkedCount+'</b> / '+labels.length+'</span></div>'+
     '<div class="wt3-qa-actions">'+
     '<button type="button" class="button" data-wt3-qa-action="clear" '+(checkedCount===0?'disabled':'')+'>清空</button></div></div>'+
     '<p class="wt3-qa-hint">确认前请先实际检查画面、事实、版权与手机阅读效果。逐项确认必须对应真实完成的检查，不能用一键全选代替视觉复核。</p>'+
     '<div class="wt3-qa-list" role="group" aria-label="八项终审项目">'+labels.map((label,i)=>
       '<label class="wt3-qa-item'+(checked[i]===true?' is-checked':'')+'"><input type="checkbox" data-wt3-qa="'+i+'" '+(checked[i]===true?'checked':'')+'><span>'+label+'</span></label>').join('')+'</div></section>'+
   '<div class="field"><label>已核验来源 URL（研究型任务必填，一行一条）</label>'+
    '<textarea id="wt3-sources" rows="2" placeholder="https://原始研究或官方资料">'+(typeof e==='function'?e(h.verifiedSources||''):h.verifiedSources||'')+'</textarea></div>'+
   '<label class="wt3-sign"><input type="checkbox" id="wt3-author-consent"><span>我以作品作者身份独立确认本次出版授权；此授权不代表作品已经成功发表。</span></label>'+
   '<div class="buttons"><button type="button" class="button dark" data-wt3-final="submit" '+(canSign?'':'disabled')+'>提交最终作者授权与 GitHub QA</button>'+
    '<button type="button" class="button" data-archive="refresh">刷新仓库验收</button></div>'+
   '<p class="minor wt3-review-progress">八项人工复核：<b data-wt3-qa-count>'+checkedCount+'</b>/8 · '+(h.finalApprovalCommit?'已提交验收 Commit：'+String(h.finalApprovalCommit).slice(0,12):'尚未提交最终验收')+'</p></section>';
 }
 const before=publish;
 publish=function(){return view(selected())+before()};
 function reflectChecklist(p){
   const root=document.querySelector('.wt3-final-review');if(!root)return;
   const checks=p?.handoff?.finalChecklist||[];
   const n=labels.reduce((total,_,i)=>total+(checks[i]===true?1:0),0);
   root.querySelectorAll('[data-wt3-qa-count]').forEach(el=>el.textContent=String(n));
   root.querySelectorAll('[data-wt3-qa]').forEach(input=>{
     const active=checks[Number(input.dataset.wt3Qa)]===true;
     input.checked=active;input.closest('.wt3-qa-item')?.classList.toggle('is-checked',active);
   });
   const select=root.querySelector('[data-wt3-qa-action="select-all"]');
   const clear=root.querySelector('[data-wt3-qa-action="clear"]');
   if(select)select.disabled=n===labels.length;
   if(clear)clear.disabled=n===0;
 }
 document.addEventListener('change',ev=>{
  const i=ev.target?.dataset?.wt3Qa,p=selected();
  if(i!=null&&p){p.handoff={...p.handoff,finalChecklist:[...(p.handoff?.finalChecklist||Array(8).fill(false))]};
   p.handoff.finalChecklist[Number(i)]=!!ev.target.checked;setChange(p,'作者更新终审检查项');reflectChecklist(p);}
  if(ev.target?.id==='wt3-sources'&&p){p.handoff={...p.handoff,verifiedSources:ev.target.value.slice(0,8000)};
   setChange(p,'更新作者确认的来源 URL')}
 },true);
 document.addEventListener('click',async ev=>{
  const bulk=ev.target.closest('[data-wt3-qa-action]');
  if(bulk){
    ev.preventDefault();ev.stopImmediatePropagation();
    const p=selected();if(!p)return;
    const selectAll=false;
    if(bulk.dataset.wt3QaAction!=='clear')return;
    p.handoff={...p.handoff,finalChecklist:Array(labels.length).fill(selectAll)};
    setChange(p,selectAll?'作者批量确认终审检查项':'作者清空终审检查项');
    reflectChecklist(p);return;
  }
  const b=ev.target.closest('[data-wt3-final]');if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();const p=selected();
  try{
   if(!p||!p.handoff?.repoQueuedAt||!p.handoff?.taskId)throw Error('工单尚未正式入仓');
   const h=p.handoff,files=h.stagedFiles||[],count=p.panels?.length||9;
   if(files.length<7||files.length!==h.stageUploaded?.length)throw Error('请先完整上传全部原始素材');
   if(h.finalChecklist?.length!==8||h.finalChecklist.some(x=>x!==true))throw Error('请先逐项完成全部8项终审');
   const images=files.filter(x=>x.path?.endsWith('.png')&&x.sha256);
   if(images.length!==count+1||images.some(x=>h.frameScopeQA?.[x.path]!==x.sha256))throw Error('尚未逐张确认独立单场景、非拼版及本格分镜一致性；请返回成品回传完成单张 QA');
   const pilotSHA=p.creativeDirection?.pilotApproval?.pilot_frame_sha256;
   if(p.creativeDirection?.approval?.author_approved&&!pilotSHA)throw Error('缺少真实首格 Pilot 的作者批准哈希；先到导演台确认样稿');
   if(pilotSHA&&images.find(x=>x.path==='panels/01.png')?.sha256!==pilotSHA)throw Error('正式 01.png 与作者批准的 Pilot SHA256 不同；不能重绘或重新编码首格');
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
     rights_checked:true,phone_previewed:true,
     single_scene_verified:true,no_contact_sheet:true,target_story_match:true};
   const sources=(document.querySelector('#wt3-sources')?.value||h.verifiedSources||'')
      .split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   if(sources.some(s=>!/^https?:\/\//.test(s)))throw Error('核验来源必须为完整的 HTTPS/HTTP URL');
   b.disabled=true;b.textContent='正在提交 GitHub QA…';
   const response=await wtArchiveApi('final-approval',{method:'POST',
     body:JSON.stringify({task_id:h.taskId,author_confirmed:true,approval_scope:'final_comic_publication',
       reviewed_checks:h.finalChecklist,
       manifest:{assets:{cover:'cover.png',panels,caption:'caption.md',sources:'sources.md'},
         sha256:sha,qa,verified_sources:sources.length?sources:(original.verified_sources||[]),
         image_provenance:original.image_provenance||null,
         image_scope_evidence:Object.fromEntries(images.map(x=>[x.path,x.sha256]))}})});
   if(!response.commit||response.status!=='submitted_for_independent_github_actions_qa')throw Error('GitHub 作者终审回执无效');
   h.finalApprovalCommit=response.commit;h.importStatus='最终作者已签署 · 等待 GitHub Actions 独立验收';
   setChange(p,'作者终审已真实入仓，GitHub QA 尚待复核：'+response.commit.slice(0,12));render();
   if(typeof wtArchiveRefresh==='function')void wtArchiveRefresh({silent:true});
   notify('作者审核提交成功；出版状态以 GitHub Actions 真实验收为准');
  }catch(error){notify('终审未完成：'+String(error.message||error).slice(0,150))}
  finally{if(document.contains(b)){b.disabled=false;b.textContent='提交最终作者授权与 GitHub QA'}}
 },true);
 // The review module loads after the bundled 4.0 workspace. Repaint direct
 // deep links once so the independent author sign-off is not visually missing.
 if(['workspace','production','publish'].includes(ui.route))
   queueMicrotask(()=>parseRoute());
})();


/* WORLD/TOON V4 runtime, embedded in an allowed first-party asset */
/* WORLD/TOON 4.0 · Unified production journey.
 * Progressive enhancement over existing modules. No data migration, false QA,
 * silent signing, billing, or publication side effects.
 */
'use strict';
(function(){
 const stageNames=['创意立项','AI 编剧','创意定稿','漫画生产','成品验收','出版交付','作品入架'];
 const html=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const states=['queued','claimed','workbuddy_received','draft_uploaded','blocked','ready_for_workbuddy','publishing','published'];
 const deletable=p=>typeof wtCanDeleteUnmade==='function'&&wtCanDeleteUnmade(p);
 const deepseek={checked:false,loading:false,configured:null};
 function checkDeepSeek(){
   if(deepseek.checked||deepseek.loading||typeof wtArchiveApi!=='function')return;
   if(typeof wtSession==='undefined'||!wtSession?.access_token)return;
   deepseek.loading=true;
   wtArchiveApi('deepseek-status').then(r=>{
     deepseek.checked=true;deepseek.configured=r?.configured===true;
   }).catch(()=>{deepseek.checked=true;deepseek.configured=null;}).finally(()=>{
     deepseek.loading=false;
     // Never re-render an active screenplay form after a read-only model probe:
     // re-rendering can discard typed seed text or interrupt the consent UI.
     const node=document.querySelector('.wt4-model-status');
     if(node)node.textContent=(deepseek.configured===true?'DeepSeek 服务端已连接':
       deepseek.configured===false?'DeepSeek API Key 尚未配置':'暂时无法核验 DeepSeek 登录或服务端状态')+
       ' · 生成内容前仍需作者主动确认可能产生的模型费用';
   });
 }

 function remote(p){
   const tid=p?.handoff?.taskId||p?.handoff?.repoTaskId||'';
   const rows=(typeof wtArchiveSnapshot==='undefined'?null:wtArchiveSnapshot)?.library?.items||[];
   return tid?rows.find(x=>x.task_id===tid)||null:null;
 }
 function verifiedPublished(r){
   return r?.status==='published'&&r.receipt?.status==='published'&&
     /^https:\/\/mp\.weixin\.qq\.com\/s\//.test(r.receipt?.url||'');
 }
 function state(p){
   const row=remote(p),h=p?.handoff||{},panels=p?.panels||[];
   const named=!!p&&!!p.title?.trim()&&p.title!=='未命名新作';
   const story=panels.some(x=>(x?.scene||'').trim().length>=20)||
     (!!p?.ideaSeed&&!!p?.description?.trim());
   // Avoid wtDirector.approved() initializing creativeDirection on untouched work.
   const director=!!p?.creativeDirection?.approval?.lock_hash&&
     (typeof wtDirector==='object'
       ?wtDirector.approved(p)
       :p.creativeDirection?.approval?.author_approved===true);
   const queued=!!h.repoQueuedAt&&!!h.taskId;
   const agent=typeof wfProducer==='function'?wfProducer(p):'ChatGPT';
   const direct=agent!=='WorkBuddy';
   const localExported=direct&&!!h.directTaskExportedAt;
   const uploaded=Array.isArray(h.stagedFiles)&&h.stagedFiles.length>0&&
      h.stagedFiles.length===(h.stageUploaded||[]).length;
   const qa=!!row&&['ready_for_workbuddy','publishing','published'].includes(row.status);
   const published=verifiedPublished(row);
   const completed=[named,story,director,queued||localExported,qa,published,published];
   // An existing remote task can precede local state after an account/device switch.
   // Show it as a remotely evidenced state, but do not invent missing approvals.
   let next=0;
   if(published)next=6;
   else if(qa)next=5;
   else if(uploaded||localExported||['blocked','draft_uploaded'].includes(row?.status))next=4;
   else if(queued||states.includes(row?.status))next=3;
   else if(director)next=3;
   else if(story)next=2;
   else if(named)next=1;
   const pending=!!p&&h.taskId&&!row&&!direct;
   const label=published?'已发表':(row?.status==='blocked'?'质量复核待修复':
      (queued||localExported)?'制作中':named?'创作中':'待制作');
   const statusText=published?'已取得真实公众号发表回执':
     direct&&h.importedAt?'完整素材包已本地导入，等待人工视觉 QA 和独立出版审核':
     localExported?'AI 任务 ZIP 已导出，等待全量漫画回传；无需 GitHub 同步':
     qa?'GitHub 已验收，等待实际发表回执':
     row?.status==='blocked'?'GitHub QA 未通过，请按具体原因修复':
     uploaded?'正式文件已上传，等待作者终审与 GitHub QA':
     queued?(agent==='WorkBuddy'?'WorkBuddy 创作流程已派单':'ChatGPT 创作任务已派单'):
     director?'创意已锁定，可直接导出制作任务 ZIP':story?'剧本草稿待审阅并锁定':'完善立项和剧本';
   return {row,completed,next,agent,pending,label,statusText,uploaded,published};
 }
 function stageBody(p,i,s){
   if(i===0){const prev=ui.stage;ui.stage=0;const body=studioStage(p);ui.stage=prev;return body;}
   if(i===1){
     queueMicrotask(checkDeepSeek); // Read-only service configuration check; never bills the model.
     const model=deepseek.configured===true?'DeepSeek 服务端已连接':
       deepseek.configured===false?'DeepSeek API Key 尚未配置':
       deepseek.loading?'正在核验 DeepSeek 服务端状态':'模型状态将在登录后核验';
     const prev=ui.stage;ui.stage=2;const body=studio();ui.stage=prev;
     return '<div class="wt4-model-status" role="status">'+html(model)+
       ' · 生成内容前仍需作者主动确认可能产生的模型费用</div>'+
       (typeof window.WTNovelStudio?.panel==='function'?window.WTNovelStudio.panel(p):'')+body;
   }
   if(i===2)return (typeof wtCreativeDirector==='function'?wtCreativeDirector():studio());
   if(i===3){
     const queued=!!p.handoff?.repoQueuedAt,tid=p.handoff?.taskId||'';
     const direct=s.agent!=='WorkBuddy',localExported=!!p.handoff?.directTaskExportedAt;
     const isHub=['ChatGPT','WorkBuddy'].includes(s.agent);
     const route=isHub?'P0 · 创意锁定 → AI Task Hub 入仓 → '+html(s.agent)+' 按任务编号领取 → 全量制作与验收':
       '手动制作 · 导出 ZIP 和启动指令 → 交给 '+html(s.agent)+' 制作并回传';
     const action=isHub?
       (queued&&p.handoff?.hubVerified?
        '<a class="button" href="https://github.com/chenzhe223-tech/ai-task-sync/tree/main/tasks/'+encodeURIComponent(tid)+'" target="_blank" rel="noopener noreferrer">查看 Hub 任务 ↗</a>':
        '<button class="button dark" data-wf="task">派发到 AI Task Hub →</button>'):
       '<button class="button dark" data-wf="task">下载 '+html(s.agent)+' 制作任务 ZIP</button><button class="button" data-wf="copy">复制开工指令</button>';
     return '<section class="box wt4-stage-card"><h2>生产交接</h2>'+
       '<p>'+route+'</p><label class="wf-producer-label">选择 AI 制作平台 <select id="wf-producer" '+(p.handoff?.repoQueuedAt||p.handoff?.directTaskExportedAt?'disabled':'')+'>'+wfProducerOptions(p)+'</select></label><div class="wt4-status-lines"><p>任务编号：'+html(tid||'尚未创建')+'</p>'+
       '<p>生产同步：'+(['ChatGPT','WorkBuddy'].includes(s.agent)?'AI Task Hub · '+(p.handoff?.hubVerified?'已核验入仓':'尚未核验入仓'):'手动任务包，不入 Hub')+'</p>'+
       '<p>当前状态：'+html(direct?(localExported?'任务包已导出，等待所选 AI 平台完整素材':'导演台定稿后即可下载任务 ZIP'):(s.row?.status||p.handoff?.repoError||s.statusText))+'</p></div>'+
       '<div class="buttons">'+action+
       ((queued||localExported)?'<button class="button" data-wt4-step="4">进入成品回传 →</button>':'')+
       '<button class="button" data-wt4-step="1">修改制作 Agent / 剧本</button></div>'+
       '<details class="wt4-advanced"><summary>高级：查看完整任务派单、来源编辑和交接记录</summary>'+
       wtWorkflow()+'</details></section>';
   }
   if(i===4){
     const pack=typeof window.WT3ImportPanel==='function'?window.WT3ImportPanel(p):'';
     const h=p.handoff||{},pilot=p.creativeDirection?.pilotApproval;
     const direct=s.agent!=='WorkBuddy';
     const notice=!direct?
       '<p>WorkBuddy 生产任务通过 GitHub 独立队列领取，平台只显示可核验结果。可在生产调度查看执行情况。</p>':
       '<p>'+html(s.agent)+' 成品 ZIP 经本地文件检查与人工视觉 QA 后再确认完成；目前 GitHub 自动上传暂停。</p>';
     return '<section class="box wt4-stage-card"><h2>成品回传与 QA</h2>'+notice+
       '<div class="wt4-status-lines"><p>真实样稿审批：'+((pilot?.local_approved||pilot?.repo_commit)?'已由作者批准定妆':'待作者核对真实定妆和首格试画')+'</p>'+
       '<p>文件上传：'+(h.stageUploaded?.length||0)+' / '+(h.stagedFiles?.length||0)+'</p>'+
       '<p>验收状态：'+(direct?'本地文件与人工视觉 QA；未申请正式发表':html(s.row?.status||'尚未核验'))+'</p></div>'+
       (s.agent==='ChatGPT'?pack:'')+
       '<a class="button" href="#/director/'+encodeURIComponent(p.id)+'">查看试制样稿审批</a> '+
       (direct?'':'<button class="button" data-archive="refresh">同步 GitHub 验收状态</button>')+'</section>';
   }
   if(i===5)return publish();
   const chapters=p.seriesId?activeProjects().filter(x=>x.seriesId===p.seriesId)
     .sort((a,b)=>(Number(a.seriesEpisode)||0)-(Number(b.seriesEpisode)||0)):[];
   const list=chapters.length?'<div class="wt4-series-chapters"><h3>系列章节 · '+html(p.seriesTitle||p.title)+'</h3>'+
     chapters.map(x=>'<a class="wt4-series-chapter" href="#/workspace/'+encodeURIComponent(x.id)+'">'+
       '<span>第 '+(Number(x.seriesEpisode)||1)+' 章 · '+html(x.title)+'</span>'+
       '<small>'+html(state(x).published?'已发表':'制作中')+' →</small></a>').join('')+'</div>':'';
   return '<section class="box wt4-stage-card"><h2>作品归档与续作</h2>'+
     '<p>'+html(s.published?'已核验发表，可到书架查看。':'尚无可核实的正式发表回执，不能提前标记已发表。')+'</p>'+
     list+'<div class="buttons"><a class="button dark" href="#/library">打开漫画书架</a>'+
     '<button class="button" data-wt-series-planner="open"'+(p.handoff?.repoQueuedAt?' disabled':'')+'>AI 规划完整系列</button>'+
     '<button class="button" data-wt3-action="series-new"'+(p.seriesId||p.handoff?.repoQueuedAt?' disabled':'')+'>创建原创系列</button>'+
     '<button class="button" data-wt3-action="series-next"'+(!p.seriesId?' disabled':'')+'>接续系列下一章</button>'+
     '<button class="button" data-archive="refresh">同步发表回执</button></div></section>';
 }
 function workspace(){
   const candidates=activeProjects().filter(x=>x.id!=='sample-ba-zong-001')
     .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
   const explicit=location.hash.startsWith('#/workspace/')?selected():null;
   const chosen=explicit||(ui.wt4LastId?findProject(ui.wt4LastId):null)||candidates[0]||selected();
   const p=chosen?.id==='sample-ba-zong-001'?null:chosen;
   if(p){ui.wt4LastId=p.id;ui.selected=p.id;} // UI context only; never rewrite the stored project.
   if(!p||p.id==='sample-ba-zong-001')return '<section class="wt4-workspace wt4-empty">'+
      '<div class="kicker">WORLD/TOON / NEW PROJECT</div><h1>开始一部好漫画</h1>'+
      '<p>从一句话、热门选题或已有系列进入。创建后在同一工作空间完成整个生产流程。</p>'+
      '<div class="buttons"><button class="button dark" data-action="new">＋ 创建作品</button>'+
      '<a class="button" href="#/live">从素材发现选题</a><a class="button" href="#/library">查看已有作品</a></div></section>';
   const s=state(p),i=Number.isInteger(ui.wt4Step)&&ui.wt4Step>=0&&ui.wt4Step<7?ui.wt4Step:s.next;
   const done=s.completed.filter(Boolean).length;
   const options=activeProjects().filter(x=>x.id!=='sample-ba-zong-001')
     .map(x=>'<option value="'+html(x.id)+'"'+(x.id===p.id?' selected':'')+'>'+html(x.title)+'</option>').join('');
   const steps=stageNames.map((title,idx)=>'<button type="button" class="wt4-step'+(i===idx?' current':'')+
     (s.completed[idx]?' done':'')+'" data-wt4-step="'+idx+'" aria-current="'+(i===idx?'step':'false')+'">'+
     '<span class="wt4-step-number">'+(s.completed[idx]?'✓':String(idx+1).padStart(2,'0'))+'</span>'+
     '<span>'+title+'</span></button>').join('');
   const next=i<6?'<button class="button" data-wt4-step="'+(i+1)+'">查看下一阶段 →</button>':'';
   return '<div class="wt4-workspace"><header class="wt4-head"><div class="kicker">WORLD/TOON / PROJECT JOURNEY</div>'+
     '<div class="wt4-head-top"><div><h1>'+html(p.title)+'</h1>'+
     '<p>'+html(p.seriesTitle?(p.seriesTitle+' · 第'+(p.seriesEpisode||1)+'章'):p.category||'原创漫画')+
     ' · '+html(s.agent)+' 制作 · '+(p.panels?.length||9)+' 格</p></div>'+
     '<span class="wt4-label">'+html(s.label)+'</span></div>'+
     '<div class="wt4-project-bar"><label for="wt4-project">切换作品</label><select id="wt4-project">'+options+'</select>'+
     '<button class="button" data-action="new">＋ 新作</button>'+
     (deletable(p)?'<button type="button" class="button" data-action="delete-unmade" data-id="'+html(p.id)+'">删除未制作</button>':'')+
     '<button class="button" data-visual-open>视觉素材</button><a class="button" href="#/archive">生产调度</a></div></header>'+
     '<section class="wt4-progress" aria-label="作品进度"><div class="wt4-progress-head"><strong>制作路线</strong>'+
     '<span>当前：'+html(stageNames[s.next])+' · 已确认 '+done+'/7 项</span></div>'+
     '<div class="wt4-steps">'+steps+'</div><p class="wt4-stage-status">'+html(s.statusText)+
     (s.pending?' · 已建立本地工单但 GitHub 目录尚未核实':'')+'</p></section>'+
     '<section class="wt4-taskbar"><div><span class="wt4-task-eyebrow">NEXT BEST ACTION</span>'+
     '<strong>'+html(stageNames[s.next])+'</strong><p>'+html(s.statusText)+'</p></div>'+
     '<button class="button dark" data-wt4-step="'+s.next+'">继续制作 →</button></section>'+
     '<section class="wt4-editor"><div class="wt4-editor-header"><div><span>STAGE '+String(i+1).padStart(2,'0')+' / 07</span>'+
     '<h2>'+html(stageNames[i])+'</h2></div><div class="buttons">'+next+
     '<a class="button" href="#/reader/'+encodeURIComponent(p.id)+'">阅读预览</a></div></div>'+
     '<div class="wt4-work-area">'+stageBody(p,i,s)+'</div></section>'+
     '<footer class="wt4-footer">自动保存本地草稿；ChatGPT 直达制作无需 GitHub 同步；正式入仓与公众号发表需独立 QA 和作者授权。</footer></div>';
 }
 let overviewExpanded=false;
 function overview(){
   const rows=activeProjects().filter(p=>p.id!=='sample-ba-zong-001')
     .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
   const localIds=new Set(rows.map(p=>p.handoff?.taskId).filter(Boolean));
   const remoteOnly=((typeof wtArchiveSnapshot==='undefined'?null:wtArchiveSnapshot)?.library?.items||[])
     .filter(r=>r?.task_id&&!localIds.has(r.task_id));
   const cards=rows.slice(0,6).map(p=>{const s=state(p);
     return '<div class="wt4-home-entry"><a href="#/workspace/'+encodeURIComponent(p.id)+'" class="wt4-home-item">'+
       '<div><strong>'+html(p.title)+'</strong><small>'+html(s.agent)+' · '+html(s.label)+'</small></div>'+
       '<span>'+html(stageNames[s.next])+' →</span></a>'+
       (deletable(p)?'<button type="button" class="button wt4-delete-unmade" data-action="delete-unmade" data-id="'+html(p.id)+'">删除</button>':'')+
       '</div>';}).join('');
   return '<details class="wt4-home wt4-home-collapsed" data-wt4-overview '+(overviewExpanded?'open':'')+'>'+
     '<summary class="wt4-home-summary"><span class="wt4-home-summary-text"><strong>继续制作</strong>'+
     '<small>'+rows.length+' 部作品 · 点击展开管理草稿</small></span>'+
     '<span class="wt4-home-chevron" aria-hidden="true">⌄</span></summary>'+
     '<div class="wt4-home-content"><div class="wt4-home-head"><p>仅未制作草稿可删除；已交付和已发表作品受保护。</p>'+
     '<a class="button" href="#/workspace">进入作品工作空间 →</a></div>'+
     (cards?'<div class="wt4-home-list">'+cards+'</div>':
       '<p class="wt4-home-empty">暂无本地创作，创建作品后将显示进度和下一步。</p>')+
     (remoteOnly.length?'<div class="wt4-remote-hint"><strong>GitHub 中另有 '+remoteOnly.length+' 条工单</strong>'+
       '<p>这些任务已在云端归档，但尚未与当前设备的本地作品关联。请在生产调度中心查看，不会自动创建或覆盖本地草稿。</p>'+
       '<a class="button" href="#/archive">查看云端工单</a></div>':'')+'</div></details>';
 }
 function production(){
   const prev=ui.wt4Step;
   ui.wt4Step=3;
   try{return workspace()}finally{ui.wt4Step=prev}
 }
 window.wt4Production=production;
 const originalDashboard=dashboard;
 dashboard=function(){return overview()+originalDashboard()};
 document.addEventListener('toggle',ev=>{
   if(ev.target?.matches?.('[data-wt4-overview]'))overviewExpanded=ev.target.open;
 },true);
 document.addEventListener('click',ev=>{
   const b=ev.target.closest('[data-wt4-step]');if(!b)return;
   ev.preventDefault();ev.stopImmediatePropagation();
   const p=selected();if(!p)return;
   const i=Number(b.dataset.wt4Step);
   if(Number.isInteger(i)&&i>=0&&i<7)nav('workspace/'+p.id+'/'+i);
 },true);
 document.addEventListener('change',ev=>{
   if(ev.target?.id!=='wt4-project')return;
   const id=ev.target.value;if(!findProject(id))return;
   ui.selected=id;nav('workspace/'+id); // No project data mutation.
 },true);
 window.wt4Workspace=workspace;
 window.WT4Workflow={stageNames,state,verifiedPublished,remote};
 if(location.hash.startsWith('#/workspace')||location.hash.startsWith('#/production'))queueMicrotask(()=>parseRoute());
})();

/* Accessible novel entrypoint */
/* WORLD/TOON · By DAVYLAB — P0 visible novel distillation entry.
   Reuse existing projects and WTNovelStudio: do not upload or export source automatically. */
'use strict';
(function(){
  const priorDashboard=dashboard;
  function creationCards(){
    return '<section class="wt-entry-launch" aria-label="开始漫画创作">'+
      '<div class="wt-entry-eyebrow">CREATE / 开始创作</div>'+
      '<h2>从这里，开始一部漫画</h2>'+
      '<p>选择一种创作方式，随后进入统一的作品制作流程。</p>'+
      '<div class="wt-entry-grid">'+
        '<a class="wt-entry-card" href="#/live"><span class="wt-entry-symbol">◉</span><strong>热点改编</strong><small>从新闻和全球热点选题</small><span class="wt-entry-arrow">→</span></a>'+
        '<button type="button" class="wt-entry-card" data-wt-idea-start><span class="wt-entry-symbol">✦</span><strong>一句话创作</strong><small>输入灵感，AI 扩写完整剧情</small><span class="wt-entry-arrow">→</span></button>'+
        '<button type="button" class="wt-entry-card wt-entry-novel" data-wt-novel-start><span class="wt-entry-symbol">▤</span><strong>文学漫绘</strong><small>世界文学导读与原创漫画表达</small><span class="wt-entry-arrow">→</span></button>'+
        '<a class="wt-entry-card" href="#/workspace"><span class="wt-entry-symbol">▧</span><strong>自主创作</strong><small>自行定义故事与人物</small><span class="wt-entry-arrow">→</span></a>'+
      '</div></section>';
  }
  dashboard=function(){return creationCards()+priorDashboard()};

  // The visible entry creates a draft only on an explicit Start action.
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-wt-novel-start]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    newProject();
    const p=selected();
    if(!p)return;
    p.creationSource='novel';
    p.title='未命名小说导读';
    persist();
    nav('novel');
  },true);
  if(location.hash==='#/dashboard')queueMicrotask(()=>render());
})();


/* Dedicated Novel Studio · preserves original text parser, provenance and permissions. */
(function(){
 'use strict';
 let step=0;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const project=()=>typeof selected==='function'?selected():null;
 function page(){
   const projects=activeProjects().filter(p=>p.creationSource==='novel'||p.novelSkill).filter(p=>!p.deleted);
   let p=project();
   if(!p||p.id==='sample-ba-zong-001'||!(p.creationSource==='novel'||p.novelSkill)){
      p=projects[0]||null;
   }
   if(p&&p.id!==ui.selected)ui.selected=p.id;
   const available=!!p?.novelSkill;
   const current=available?Math.min(2,Math.max(0,step)):0;
   return '<div class="wt-novel-page">'+
    '<div class="wt-novel-page-top"><div><div class="kicker">WORLD/TOON / NOVEL STUDIO</div>'+
    '<h1>让好文学，拥有新的画面。</h1>'+
    '<p>先导入作品，再理解内容，最后选择适合的漫画表达。</p></div>'+
    '</div>'+
    '<div class="wt-novel-progress">'+
     ['01 导入作品','02 理解小说','03 改编漫画'].map((n,i)=>
       '<button type="button" data-novel-step="'+i+'" class="'+(i===current?'active':'')+'" '+(i>0&&!available?'disabled':'')+'>'+n+'</button>').join('')+
    '</div>'+
    (!p?'<section class="wt-novel-focus"><div class="wt-novel-kicker">STEP 01 · BEGIN</div><h2>从你想解读的小说开始</h2>'+
     '<p>创建一个本地草稿，再上传 TXT、MD、EPUB 或文字层 PDF。</p>'+
     '<button class="button dark" type="button" data-wt-novel-start>＋ 开始小说项目</button>'+
     (projects.length?'<p>已有 '+projects.length+' 个小说项目</p>':'')+'</section>':
     '<div class="wt-novel-project-control"><label>当前作品 <select data-novel-project>'+projects.map(v=>
       '<option value="'+esc(v.id)+'"'+(v.id===p.id?' selected':'')+'>'+esc(v.title)+'</option>').join('')+'</select></label>'+
       '<button type="button" class="button" data-wt-novel-start>＋ 新建小说项目</button></div>'+
       (current===0?importStep(p):current===1?understandStep(p):adaptStep(p)))+
    '</div>';
 }
 function importStep(p){
   const title=p.title==='未命名小说导读'?'':p.title;
   const panel=window.WTNovelStudio?.panel?.(p)||'<p>解析模块尚未加载，请刷新页面。</p>';
   return '<section class="wt-novel-focus"><div class="wt-novel-kicker">STEP 01 · IMPORT</div>'+
    '<h2>选择一本想要解读的作品</h2><p>填写书名并上传合法持有的文本。平台不会仅凭书名生成未经核实的小说剧情。</p>'+
    '<label class="wt-novel-title-label">小说名称<input data-novel-title maxlength="180" placeholder="例如：简爱、素食者、百年孤独" value="'+esc(title)+'"></label>'+
    '<div class="wt-novel-import-panel">'+panel.replace('<details class="wt-novel-studio"','<details open class="wt-novel-studio"')+'</div>'+
    '<div class="wt-novel-hint">🔒 本地处理原稿。是否附带原稿交给外部 AI，由你另行明确授权。</div>'+
    (p.novelSkill?'<div class="wt-novel-main-action"><button class="button dark" data-novel-step="1">查看作品结构 →</button></div>':'')+
    '</section>';
 }
 function understandStep(p){
   const skill=p.novelSkill;
   if(!skill)return importStep(p);
   const chapters=skill.chapter_index||[],themes=skill.themes||[],cast=skill.cast_candidates||[];
   const count=skill.provenance?.chapter_count||chapters.length;
   return '<section class="wt-novel-focus"><div class="wt-novel-kicker">STEP 02 · UNDERSTAND</div>'+
     '<h2>从结构线索，走向故事理解</h2>'+
     '<p>已索引 '+count+' 章／段。以下是本地算法得到的统计候选，不是 AI 已核验的情节与人物关系。</p>'+
     '<div class="wt-novel-summary-grid"><article><span>章节索引</span><strong>'+count+'</strong></article>'+
     '<article><span>主题候选</span><strong>'+themes.length+'</strong></article>'+
     '<article><span>人物候选</span><strong>'+cast.length+'</strong></article></div>'+
     '<h3>主题线索</h3><div class="wt-novel-tags">'+(themes.length?themes.slice(0,12).map(x=>'<span>'+esc(x.name)+'</span>').join(''):'<span>尚无可靠主题线索</span>')+'</div>'+
     '<h3>人物线索（待核实）</h3><p>'+esc(cast.slice(0,10).map(x=>x.name).join('、')||'没有可靠候选，需阅读原文核对')+'</p>'+
     '<details class="wt-novel-chapter-list"><summary>展开章节索引 · '+count+' 段</summary>'+
      chapters.map(x=>'<div><b>'+esc(x.chapter_id)+' · '+esc(x.title)+'</b><small>'+esc(x.locator)+'</small></div>').join('')+'</details>'+
     '<div class="wt-novel-caution">目前仅完成结构蒸馏。真正的剧情梳理、人物关系和文学解读，需要 AI 阅读原文或可靠资料后独立核验。</div>'+
     '<div class="wt-novel-actions-bottom"><button class="button" data-novel-step="0">← 修改来源</button>'+
     '<button class="button dark" data-novel-step="2">选择漫画表达 →</button></div></section>';
 }
 function adaptStep(p){
   const mode=p.storySourceSelection?.adaptation||'literary_review';
   return '<section class="wt-novel-focus"><div class="wt-novel-kicker">STEP 03 · ADAPT</div>'+
      '<h2>选择这本书的漫画表达方式</h2>'+
      '<p>已建立可追溯的章节资料索引。先核查具体故事与版权，再进入人物和分镜制作。</p>'+
      '<div class="wt-novel-choice"><article><strong>文学导读与主题解读</strong><p>适合没有剧情改编许可的作品，以原创评论、读者体验和主题探索为主。</p>'+
      '<small>不直接复刻受版权保护的原著独特桥段</small></article>'+
      '<article><strong>授权剧情改编</strong><p>使用原书人物与剧情；仅适用于公版作品或已取得有效授权的情况。</p>'+
      '<small>需要作者核实授权来源和实际原文内容</small></article></div>'+
      '<p class="wt-novel-mode">当前创作边界：'+(mode==='faithful'?'已声明有改编许可，独立核验仍未完成':'文学导读，不声称拥有剧情改编权')+'</p>'+
      '<div class="wt-novel-actions-bottom"><button class="button" data-novel-step="1">← 返回作品理解</button>'+
      '<a class="button dark" href="#/workspace/'+encodeURIComponent(p.id)+'/1">进入漫画编剧向导 →</a></div>'+
      '<div class="wt-novel-caution">进入向导不代表事实、语义或版权核验已通过；正式绘图前仍须完成角色、场景和授权审核。</div></section>';
 }
 window.WTNovelPage=page;
 document.addEventListener('click',ev=>{
   const node=ev.target.closest('[data-novel-step]');if(!node)return;
   ev.preventDefault();ev.stopImmediatePropagation();
   const next=Number(node.dataset.novelStep);
   if(next>0&&!project()?.novelSkill)return;
   step=next;render();
 },true);
 document.addEventListener('change',ev=>{
   const node=ev.target;
   if(node.matches('[data-novel-project]')){
     if(findProject(node.value)){ui.selected=node.value;step=0;render();}
   }
   if(node.matches('[data-novel-title]')){
     const p=project();if(!p)return;
     p.title=node.value.trim()||'未命名小说导读';p.sourceTitle=p.title;
     setChange(p,'更新小说作品名称');render();
   }
 },true);
})();


/* WORLD/TOON · By DAVYLAB — editorial one-line AI creative flow */
(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const ideap=()=>typeof selected==='function'?selected():null;
 const isIdea=p=>!!p&&p.creationSource==='one-line'&&!p.deleted;
 const hasResult=p=>!!p?.creativeDirection?.storyboardProvenance?.method&&p.creativeDirection.storyboardProvenance.method==='verified_model_response'&&Array.isArray(p.panels)&&p.panels.some(x=>String(x.scene||'').length>30);
 function page(){
  const all=activeProjects().filter(isIdea).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  let p=ideap();if(!isIdea(p))p=all[0]||null;
  if(p)ui.selected=p.id;
  const done=hasResult(p),locked=!!p?.handoff?.repoQueuedAt||!!p?.handoff?.directTaskExportedAt||!!p?.panels?.some(x=>x.image);
  return '<div class="wt-idea-page">'+
   '<header class="wt-idea-head"><div><div class="kicker">WORLD/TOON / IDEA STUDIO</div><h1>一句灵感，开启一部漫画。</h1>'+
   '<p>先输入创意，AI 扩写剧情与分镜；审阅后再进入漫画制作。</p></div>'+
   '</header>'+
   '<div class="wt-idea-steps"><span class="current">01 写下灵感</span><span class="'+(done?'current':'')+'">02 AI 编剧</span><span>03 审阅与制作</span></div>'+
   (!p?'<section class="wt-idea-editor"><h2>把故事的第一句话写下来</h2><p>新建草稿后，即可调用已接入的 DeepSeek 编剧能力。</p><button class="button dark" data-wt-idea-start>＋ 开始创作</button></section>':
     '<div class="wt-idea-projects"><label>当前创作 <select data-wt-idea-project>'+all.map(x=>
      '<option value="'+esc(x.id)+'"'+(p.id===x.id?' selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select></label>'+
      '<button class="button" data-wt-idea-start>＋ 新建灵感</button></div>'+
     '<section class="wt-idea-editor">'+
      '<div class="wt-idea-eyebrow">YOUR IDEA / 灵感输入</div>'+
      '<h2>你想讲一个什么故事？</h2>'+
      '<label for="wt3-seed" class="wt-idea-label">一句话创意</label>'+
      '<textarea id="wt3-seed" rows="4" maxlength="1800" '+(locked?'disabled':'')+' placeholder="例如：一个古代县令穿越到 AI 时代，发现机器人更会断案">'+esc(p.ideaSeed||'')+'</textarea>'+
      '<p class="wt-idea-guide">建议包含一个主人公、一个冲突或一个意外转折。至少输入 8 个字。</p>'+
      '<div class="wt-idea-config"><label>剧情类型<select id="wt3-plot-genre" '+(locked?'disabled':'')+'>'+
      '<option value="general"'+(p.plotGenre!=='viral-melodrama'?' selected':'')+'>自由原创</option>'+
      '<option value="viral-melodrama"'+(p.plotGenre==='viral-melodrama'?' selected':'')+'>都市反转短剧</option></select></label>'+
      '<label>漫画篇幅<select id="wt3-count" '+(locked?'disabled':'')+'>'+
       [6,9,12,18].map(x=>'<option value="'+x+'"'+(p.panels?.length===x?' selected':'')+'>'+x+' 格</option>').join('')+'</select></label></div>'+
      (p.plotGenre==='viral-melodrama'?'<div class="wt-idea-extras"><label>故事方向<select id="wt3-drama-subtype"><option value="rebirth-bank-rich">重生逆袭</option><option value="celebrity-romance">娱乐圈</option></select></label><input type="hidden" id="wt3-drama-intensity" value="'+(p.dramaIntensity||4)+'"></div>':'')+
      '<div class="wt-idea-actions"><button type="button" class="button dark" data-wt3-action="expand" '+(locked?'disabled':'')+'>✦ AI 扩写故事与分镜</button>'+
      (done?'<a class="button" href="#/director/'+encodeURIComponent(p.id)+'">进入创意导演台 →</a>':'')+'</div>'+
      '<div class="wt3-expand-consent" id="wt3-expand-consent" hidden><p><strong>确认调用 DeepSeek</strong> · 将真实发送本次原创构思给模型，可能按 Token 产生费用；只有明确确认后才调用。</p>'+
      '<div class="buttons"><button type="button" class="button dark" data-wt3-action="expand-confirm">确认生成</button><button type="button" class="button" data-wt3-action="expand-cancel">取消</button></div></div>'+
      '<p class="wt3-expand-feedback" id="wt3-expand-feedback" role="status" aria-live="polite" hidden></p>'+
      (done?'<div class="wt-idea-results"><div class="wt-idea-result-head"><div><span class="wt-idea-eyebrow">AI STORY DRAFT · 待作者审核</span><h2>'+esc(p.title)+'</h2></div><span>'+p.panels.length+' 格分镜草稿</span></div>'+
       '<p>'+esc(p.description||'模型已返回结构化剧本，可在导演台逐格检查。')+'</p>'+
       '<div class="wt-idea-panel-grid">'+p.panels.map((v,i)=>'<article><b>'+String(i+1).padStart(2,'0')+' · '+esc(v.title)+'</b><small>'+esc(v.scene||'待补全')+'</small></article>').join('')+'</div>'+
       '<a class="button dark" href="#/director/'+encodeURIComponent(p.id)+'">审核人物与完整分镜 →</a>'+
       '<p class="wt-idea-review-note">模型草稿不代表已批准、已生图或已完成版权核查。</p></div>':'')+
      '</section>')+
   '</div>';
 }
 window.WTIdeaPage=page;
 document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-wt-idea-start]');if(!b)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  newProject();const p=ideap();if(!p)return;
  p.creationSource='one-line';p.title='未命名灵感作品';p.handoff={...p.handoff,mode:'original'};
  p.plotGenre='general';persist();nav('idea');
 },true);
 document.addEventListener('change',ev=>{
  if(ev.target.matches('[data-wt-idea-project]')){
   const p=findProject(ev.target.value);if(p&&isIdea(p)){ui.selected=p.id;render();}
  }
  if(ev.target?.id==='wt3-count'){
   const p=ideap();if(!isIdea(p)||p.panels?.some(x=>x.image)||p.handoff?.repoQueuedAt)return;
   const n=Number(ev.target.value);if(![6,9,12,18].includes(n))return;
   p.panels=Array.from({length:n},(_,i)=>p.panels[i]||makePanel(i));
   p.format=n+'格漫画';
   if(p.creativeDirection){p.creativeDirection.reviewed=false;p.creativeDirection.approval=null;p.creativeDirection.drafted=false;p.creativeDirection.storyboardProvenance=null}
   setChange(p,'设置灵感漫画篇幅 '+n+' 格');render();
  }
 },true);
 if(location.hash.startsWith('#/idea'))queueMicrotask(()=>parseRoute());
})();