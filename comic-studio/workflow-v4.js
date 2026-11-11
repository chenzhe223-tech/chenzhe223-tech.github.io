/* WORLD/TOON 4.0 · Unified production journey.
 * Progressive enhancement over existing modules. No data migration, false QA,
 * silent signing, billing, or publication side effects.
 */
'use strict';
(function(){
 const stageNames=['创意立项','AI 编剧','创意定稿','漫画生产','成品验收','出版交付','作品入架'];
 const html=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const states=['queued','claimed','workbuddy_received','draft_uploaded','blocked','ready_for_workbuddy','publishing','published'];
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
   const director=!!p&&(typeof wtDirector==='object'
     ?wtDirector.approved(p)
     :p.creativeDirection?.approval?.author_approved===true);
   const queued=!!h.repoQueuedAt&&!!h.taskId;
   const uploaded=Array.isArray(h.stagedFiles)&&h.stagedFiles.length>0&&
      h.stagedFiles.length===(h.stageUploaded||[]).length;
   const qa=!!row&&['ready_for_workbuddy','publishing','published'].includes(row.status);
   const published=verifiedPublished(row);
   const completed=[named,story,director,queued,qa,published,published];
   // An existing remote task can precede local state after an account/device switch.
   // Show it as a remotely evidenced state, but do not invent missing approvals.
   let next=0;
   if(published)next=6;
   else if(qa)next=5;
   else if(uploaded||['blocked','draft_uploaded'].includes(row?.status))next=4;
   else if(queued||states.includes(row?.status))next=3;
   else if(director)next=3;
   else if(story)next=2;
   else if(named)next=1;
   const agent=p?.productionAgent==='WorkBuddy'?'WorkBuddy':'ChatGPT';
   const pending=!!p&&h.taskId&&!row;
   const label=published?'已发表':(row?.status==='blocked'?'质量复核待修复':
      queued?'制作中':named?'创作中':'待制作');
   const statusText=published?'已取得真实公众号发表回执':
     qa?'GitHub 已验收，等待实际发表回执':
     row?.status==='blocked'?'GitHub QA 未通过，请按具体原因修复':
     uploaded?'正式文件已上传，等待作者终审与 GitHub QA':
     queued?(agent==='WorkBuddy'?'WorkBuddy 创作流程已派单':'ChatGPT 创作任务已派单'):
     director?'创意已锁定，可以正式派单':story?'剧本草稿待审阅并锁定':'完善立项和剧本';
   return {row,completed,next,agent,pending,label,statusText,uploaded,published};
 }
 function stageBody(p,i,s){
   if(i===0){const prev=ui.stage;ui.stage=0;const body=studioStage(p);ui.stage=prev;return body;}
   if(i===1){const prev=ui.stage;ui.stage=2;const body=studio();ui.stage=prev;return body;}
   if(i===2)return (typeof wtCreativeDirector==='function'?wtCreativeDirector():studio());
   if(i===3){
     const queued=!!p.handoff?.repoQueuedAt,tid=p.handoff?.taskId||'';
     const route=s.agent==='WorkBuddy'?
       'SOP B · GitHub 工单验收 → WorkBuddy 创作 → GitHub 成品验收 → WorkBuddy 发表 → 回执归档':
       'SOP A · ChatGPT 创作 → GitHub 成品验收 → WorkBuddy 发表 → 回执归档';
     const action=queued?
       (s.agent==='ChatGPT'?'<button class="button dark" data-wf="copy">复制当前制作指令</button>':
         '<button class="button dark" data-archive="refresh">同步 WorkBuddy 创作进度</button>'):
       '<button class="button dark" data-wf="task">生成工单并正式派单 →</button>';
     return '<section class="box wt4-stage-card"><h2>生产交接</h2>'+
       '<p>'+route+'</p><div class="wt4-status-lines"><p>任务编号：'+html(tid||'尚未创建')+'</p>'+
       '<p>GitHub 工单：'+(queued?'已确认入仓':'尚未确认')+'</p>'+
       '<p>当前状态：'+html(s.row?.status||p.handoff?.repoError||s.statusText)+'</p></div>'+
       '<div class="buttons">'+action+
       (queued?'<button class="button" data-wt4-step="4">进入成品验收 →</button>':'')+
       '<button class="button" data-wt4-step="1">修改制作 Agent / 剧本</button></div>'+
       '<details class="wt4-advanced"><summary>高级：查看完整任务派单、来源编辑和交接记录</summary>'+
       wtWorkflow()+'</details></section>';
   }
   if(i===4){
     const pack=typeof window.WT3ImportPanel==='function'?window.WT3ImportPanel(p):'';
     const h=p.handoff||{},pilot=p.creativeDirection?.pilotApproval;
     const notice=s.agent==='WorkBuddy'?
       '<p>WorkBuddy 生产任务通过 GitHub 独立队列领取，平台只显示可核验结果。可在生产调度查看执行情况。</p>':
       '<p>ChatGPT 成品 ZIP 将在本地校验，并自动尝试上传到 GitHub；失败可原位续传，无须重新建单。</p>';
     return '<section class="box wt4-stage-card"><h2>成品回传与 QA</h2>'+notice+
       '<div class="wt4-status-lines"><p>真实样稿审批：'+(pilot?.repo_commit?'已保存 GitHub 审批记录':'待作者核对角色定妆和首格试画')+'</p>'+
       '<p>文件上传：'+(h.stageUploaded?.length||0)+' / '+(h.stagedFiles?.length||0)+'</p>'+
       '<p>GitHub 成品 QA：'+html(s.row?.status||'尚未核验')+'</p></div>'+
       (s.agent==='ChatGPT'?pack:'')+
       '<a class="button" href="#/director/'+encodeURIComponent(p.id)+'">查看试制样稿审批</a> '+
       '<button class="button" data-archive="refresh">同步 GitHub 验收状态</button></section>';
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
     '<button class="button" data-wt3-action="series-new"'+(p.seriesId||p.handoff?.repoQueuedAt?' disabled':'')+'>创建原创系列</button>'+
     '<button class="button" data-wt3-action="series-next"'+(!p.seriesId?' disabled':'')+'>接续系列下一章</button>'+
     '<button class="button" data-archive="refresh">同步发表回执</button></div></section>';
 }
 function workspace(){
   const chosen=selected();
   const p=chosen?.id==='sample-ba-zong-001'
      ?activeProjects().find(x=>x.id!=='sample-ba-zong-001')||null:chosen;
   if(p&&p!==chosen)ui.selected=p.id; // Route legacy editors to the same actual project, not demo content.
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
     '<button class="button" data-action="new">＋ 新作</button><a class="button" href="#/archive">生产调度</a></div></header>'+
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
     '<footer class="wt4-footer">自动保存本地草稿；GitHub 只认可实际入仓的工单和成品。创意定稿、样稿审批及出版授权必须由作者独立确认。</footer></div>';
 }
 function overview(){
   const rows=activeProjects().filter(p=>p.id!=='sample-ba-zong-001');
   const localIds=new Set(rows.map(p=>p.handoff?.taskId).filter(Boolean));
   const remoteOnly=((typeof wtArchiveSnapshot==='undefined'?null:wtArchiveSnapshot)?.library?.items||[])
     .filter(r=>r?.task_id&&!localIds.has(r.task_id));
   const cards=rows.slice(0,6).map(p=>{const s=state(p);
     return '<a href="#/workspace/'+encodeURIComponent(p.id)+'" class="wt4-home-item">'+
       '<div><strong>'+html(p.title)+'</strong><small>'+html(s.agent)+' · '+html(s.label)+'</small></div>'+
       '<span>'+html(stageNames[s.next])+' →</span></a>';}).join('');
   return '<section class="wt4-home"><div class="wt4-home-head"><div><div class="kicker">YOUR PRODUCTION</div>'+
     '<h2>继续制作</h2><p>所有作品都有一个当前位置和下一步，不必逐个寻找功能模块。</p></div>'+
     '<a class="button dark" href="#/workspace">进入作品工作空间 →</a></div>'+
     (cards?'<div class="wt4-home-list">'+cards+'</div>':
       '<p class="wt4-home-empty">暂无本地创作，创建作品后将显示进度和下一步。</p>')+
     (remoteOnly.length?'<div class="wt4-remote-hint"><strong>GitHub 中另有 '+remoteOnly.length+' 条工单</strong>'+
       '<p>这些任务已在云端归档，但尚未与当前设备的本地作品关联。请在生产调度中心查看，不会自动创建或覆盖本地草稿。</p>'+
       '<a class="button" href="#/archive">查看云端工单</a></div>':'')+'</section>';
 }
 function production(){
   const prev=ui.wt4Step;
   ui.wt4Step=3;
   try{return workspace()}finally{ui.wt4Step=prev}
 }
 window.wt4Production=production;
 const originalDashboard=dashboard;
 dashboard=function(){return overview()+originalDashboard()};
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