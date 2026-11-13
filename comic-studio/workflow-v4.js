/* WORLD/TOON 4.0 · Unified production journey.
 * Progressive enhancement over existing modules. No data migration, false QA,
 * silent signing, billing, or publication side effects.
 */
'use strict';
(function(){
 const stageNames=['故事方案','角色设定','剧情分镜','视觉风格','正式生成','审阅精修','导出发布'];
 const html=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const states=['queued','claimed','workbuddy_received','draft_uploaded','blocked','ready_for_workbuddy','publishing','published'];
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
   const story=!!(p?.ideaSeed?.trim()||p?.description?.trim());
   const hasCharacter=!!(p?.characterBible?.characters?.length||(p?.characterRefs||[]).length||String(p?.characters||'').trim());
   const storyboard=panels.some(x=>(x?.scene||'').trim().length>=20);
   // Avoid wtDirector.approved() initializing creativeDirection on untouched work.
   const director=!!p?.creativeDirection?.approval?.lock_hash&&
     (typeof wtDirector==='object'
       ?wtDirector.approved(p)
       :p.creativeDirection?.approval?.author_approved===true);
   const queued=!!h.repoQueuedAt&&!!h.taskId;
   const uploaded=Array.isArray(h.stagedFiles)&&h.stagedFiles.length>0&&
      h.stagedFiles.length===(h.stageUploaded||[]).length;
   const qa=!!row&&['ready_for_workbuddy','publishing','published'].includes(row.status);
   const published=verifiedPublished(row);
   const completed=[named&&story,hasCharacter,storyboard,director,uploaded,qa,published];
   // An existing remote task can precede local state after an account/device switch.
   // Show it as a remotely evidenced state, but do not invent missing approvals.
   let next=0;
   if(published||qa)next=6;
   else if(uploaded||['blocked','draft_uploaded'].includes(row?.status))next=5;
   else if(queued||states.includes(row?.status)||director)next=4;
   else if(storyboard)next=3;
   else if(hasCharacter)next=2;
   else if(named&&story)next=1;
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
   if(i===0){const prev=ui.stage;ui.stage=0;const body=studio();ui.stage=prev;return '<section class="wt4-stage-intro"><h2>故事方案</h2><p>在这里输入灵感、设置来源，使用已有 AI 编剧扩写；收费模型调用必须另行确认。</p></section>'+body;}
   if(i===1){
     const prev=ui.stage;ui.stage=1;const body=studioStage(p);ui.stage=prev;
     const library=Array.isArray(data?.characters)?data.characters.filter(c=>c&&(c.characterId||c.id)):[];
     const options=library.map(c=>'<option value="'+html(c.characterId||c.id)+'">'+
       html(c.originalName||c.name||'未命名角色')+(c.reviewStatus==='pending_approval'?' · 待确认':'')+'</option>').join('');
     const refs=(p.characterRefs||[]).map(r=>{
       const c=library.find(c=>String(c.characterId||c.id)===String(r.characterId));
       return '<span class="wt4-character-tag">'+html(r.comicName||c?.originalName||c?.name||r.characterId)+
         ' <small>V'+html(r.characterVersion||c?.bibleVersion||'1')+'</small></span>';
     }).join('');
     const frozen=!!p.handoff?.repoQueuedAt||!!p.creativeDirection?.approval?.lock_hash;
     return '<section class="wt4-stage-intro"><h2>角色设定 · Character Bible</h2>'+
       '<p>从角色库引用原型，本作品单独保存名称、设定和版本快照。已批准的角色档案不会被未来修改覆盖。</p>'+
       '<div class="wt4-role-picker"><label>角色库<select id="wt4-character-select">'+
       (options||'<option value="">暂无角色档案</option>')+'</select></label>'+
       '<button type="button" class="button" data-wt4-role="link" '+(!options||frozen?'disabled':'')+'>引用角色</button>'+
       '<button type="button" class="button dark" data-wt4-role="lock" '+(!(p.characterRefs||[]).length||frozen?'disabled':'')+'>确认并锁定版本</button>'+
       '<a class="button" href="#/characters">管理角色档案</a></div>'+
       '<div class="wt4-character-tags">'+(refs||'<span class="minor">本作品尚无已引用角色。</span>')+'</div>'+
       '<p class="minor">版本状态：'+html(p.characterBible?.lockedAt?'已锁定 V'+p.characterBible.revision:
          '尚未锁定')+'；AI 新增人物须先由作者保存并确认。</p></section>'+body;
   }
   if(i===2){const prev=ui.stage;ui.stage=2;const body=studioStage(p);ui.stage=prev;
     return '<section class="wt4-stage-intro"><h2>剧情分镜</h2><p>逐格编辑镜头、旁白和对白；返回修改不意味着自动通过审核。</p></section>'+body;
   }
   if(i===3)return (typeof wtCreativeDirector==='function'?wtCreativeDirector():studio());
   if(i===4){
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
       (queued?'<button class="button" data-wt4-step="5">进入成品验收 →</button>':'')+
       '<button class="button" data-wt4-step="0">修改制作 Agent / 剧本</button></div>'+
       '<details class="wt4-advanced"><summary>高级：查看完整任务派单、来源编辑和交接记录</summary>'+
       wtWorkflow()+'</details></section>';
   }
   if(i===5){
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
   if(i===6)return '<section class="wt4-stage-intro"><h2>导出发布</h2><p>素材导出、GitHub QA、作者审批和发表回执是不同步骤。</p></section>'+publish();
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
   if(!p||p.id==='sample-ba-zong-001')return creationEntries();
   const s=state(p),i=Number.isInteger(ui.wt4Step)&&ui.wt4Step>=0&&ui.wt4Step<7?ui.wt4Step:s.next;
   const done=s.completed.filter(Boolean).length;
   const options=activeProjects().filter(x=>x.id!=='sample-ba-zong-001')
     .map(x=>'<option value="'+html(x.id)+'"'+(x.id===p.id?' selected':'')+'>'+html(x.title)+'</option>').join('');
   const steps=stageNames.map((title,idx)=>'<button type="button" class="wt4-step'+(i===idx?' current':'')+
     (s.completed[idx]?' done':'')+'" data-wt4-step="'+idx+'" aria-current="'+(i===idx?'step':'false')+'">'+
     '<span class="wt4-step-number">'+(s.completed[idx]?'✓':String(idx+1).padStart(2,'0'))+'</span>'+
     '<span>'+title+'</span></button>').join('');
   const prev=i>0?'<button class="button" data-wt4-step="'+(i-1)+'">← 上一步</button>':'';
   const next=i<6?'<button class="button dark" data-wt4-step="'+(i+1)+'">下一步 →</button>':'';
   return '<div class="wt4-workspace"><header class="wt4-head"><div class="kicker">WORLD/TOON / PROJECT JOURNEY</div>'+
     '<div class="wt4-head-top"><div><h1>'+html(p.title)+'</h1>'+
     '<p>'+html(p.seriesTitle?(p.seriesTitle+' · 第'+(p.seriesEpisode||1)+'章'):p.category||'原创漫画')+
     ' · '+html(s.agent)+' 制作 · '+(p.panels?.length||9)+' 格</p></div>'+
     '<span class="wt4-label">'+html(s.label)+'</span></div>'+
     '<div class="wt4-project-bar"><label for="wt4-project">切换作品</label><select id="wt4-project">'+options+'</select>'+
     '<button class="button" data-action="new">＋ 新作</button><button class="button" data-visual-open>视觉素材</button><a class="button" href="#/archive">生产调度</a></div></header>'+
     '<section class="wt4-progress" aria-label="作品进度"><div class="wt4-progress-head"><strong>制作路线</strong>'+
     '<span>当前：'+html(stageNames[s.next])+' · 已确认 '+done+'/7 项</span></div>'+
     '<div class="wt4-steps">'+steps+'</div><p class="wt4-stage-status">'+html(s.statusText)+
     (s.pending?' · 已建立本地工单但 GitHub 目录尚未核实':'')+'</p></section>'+
     '<section class="wt4-taskbar"><div><span class="wt4-task-eyebrow">NEXT BEST ACTION</span>'+
     '<strong>'+html(stageNames[s.next])+'</strong><p>'+html(s.statusText)+'</p></div>'+
     '<button class="button dark" data-wt4-step="'+s.next+'">继续制作 →</button></section>'+
     '<section class="wt4-editor"><div class="wt4-editor-header"><div><span>STAGE '+String(i+1).padStart(2,'0')+' / 07</span>'+
     '<h2>'+html(stageNames[i])+'</h2></div><div class="buttons">'+prev+next+
     '<a class="button" href="#/reader/'+encodeURIComponent(p.id)+'">阅读预览</a></div></div>'+
     '<div class="wt4-work-area">'+stageBody(p,i,s)+'</div></section>'+
     '<footer class="wt4-footer">自动保存本地草稿；GitHub 只认可实际入仓的工单和成品。创意定稿、样稿审批及出版授权必须由作者独立确认。</footer></div>';
 }
 function creationEntries(){
   return '<section class="wt4-create" aria-label="选择创作方式"><div class="wt4-create-head"><div class="kicker">START / WORLD TOON</div><h1>你想如何开始漫画创作？</h1><p>三种入口，一个项目，七步完成漫画创作。</p></div>'+
   '<div class="wt4-create-grid">'+
   '<article class="wt4-entry"><span>01 / DISCOVERY</span><h2>热点改编</h2><p>从全球热点、AI 前沿简报及选题池直接选择素材。</p><div class="wt4-entry-links"><a class="button dark" href="#/live">全球热点</a><a class="button" href="#/ai-briefing">AI 简报</a><a class="button" href="#/radar">选题池</a></div></article>'+
   '<article class="wt4-entry"><span>02 / ONE LINE</span><h2>一句话创作</h2><p>输入灵感，随后由现有 AI 编剧扩写；模型调用需先确认费用。</p><form id="wt4-idea-form"><label for="wt4-idea">一句话灵感</label><textarea id="wt4-idea" name="idea" required minlength="8" maxlength="1800" rows="3" placeholder="例如：一枚芯片试图通过五个国家的海关"></textarea><button class="button dark" type="submit">创建故事方案</button></form></article>'+
   '<article class="wt4-entry"><span>03 / ORIGINAL</span><h2>自主创作</h2><p>由你决定漫画名称、主题和剧情，AI 只提供辅助。</p><form id="wt4-original-form"><label for="wt4-title">漫画名称</label><input id="wt4-title" name="title" required maxlength="120" placeholder="输入作品名称"><label for="wt4-theme">主题与剧情</label><textarea id="wt4-theme" name="theme" maxlength="1800" rows="2" placeholder="故事设定、人物关系与主要冲突"></textarea><button class="button dark" type="submit">创建原创项目</button></form></article>'+
   '</div></section>';
 }
 function overview(){
   const rows=activeProjects().filter(p=>p.id!=='sample-ba-zong-001')
     .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
   const localIds=new Set(rows.map(p=>p.handoff?.taskId).filter(Boolean));
   const remoteOnly=((typeof wtArchiveSnapshot==='undefined'?null:wtArchiveSnapshot)?.library?.items||[])
     .filter(r=>r?.task_id&&!localIds.has(r.task_id));
   const cards=rows.slice(0,6).map(p=>{const s=state(p);
     return '<a href="#/workspace/'+encodeURIComponent(p.id)+'" class="wt4-home-item">'+
       '<div><strong>'+html(p.title)+'</strong><small>'+html(s.agent)+' · '+html(s.label)+'</small></div>'+
       '<span>'+html(stageNames[s.next])+' →</span></a>';}).join('');
   return creationEntries()+'<section class="wt4-home"><div class="wt4-home-head"><div><div class="kicker">YOUR PRODUCTION</div>'+
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
 dashboard=function(){return overview()+'<details class="wt4-legacy"><summary>历史工作台与高级入口</summary>'+originalDashboard()+'</details>'};
 document.addEventListener('click',ev=>{
   const role=ev.target.closest('[data-wt4-role]');
   if(role){
     ev.preventDefault();ev.stopImmediatePropagation();
     const p=selected(),api=window.WTCharacterContinuity;
     if(!p||!api){notify('角色服务暂不可用');return}
     try{
       if(role.dataset.wt4Role==='link'){
         const characterId=document.querySelector('#wt4-character-select')?.value;
         const result=api.linkExisting(data,p,characterId);
         if(!result.ok)throw Error(result.reason==='character_awaits_author_review'?'请先在角色库确认 AI 角色草稿':
           result.reason==='approved_work_requires_new_revision'?'作品已锁定，需先建立新的创意修订版本':'请选择可用的角色档案');
         if(result.linked)setChange(p,'引用已有角色：'+result.characterId);
       }else if(role.dataset.wt4Role==='lock'){
         const bible=api.lockProjectBible(data,p);
         setChange(p,'确认角色圣经 V'+bible.revision);
       }
       render();
     }catch(error){notify('角色操作未完成：'+error.message)}
     return;
   }
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
 document.addEventListener('submit',ev=>{
   if(!['wt4-idea-form','wt4-original-form'].includes(ev.target?.id))return;
   ev.preventDefault();
   const f=ev.target,original=f.id==='wt4-original-form';
   const idea=String(f.elements?.idea?.value||'').trim();
   const title=String(f.elements?.title?.value||'').trim();
   const theme=String(f.elements?.theme?.value||'').trim();
   if(original&&!title){notify('请输入漫画名称');return;}
   if(!original&&(idea.length<8||idea.length>1800)){notify('一句话创意需要 8–1800 字');return;}
   newProject();
   const p=selected();if(!p)return;
   p.creationPath=original?'original':'one_line';
   p.title=original?title:'灵感 · '+idea.slice(0,40);
   if(original){p.description=theme;p.fiction='原创虚构';}
   else{p.ideaSeed=idea;p.fiction='原创虚构';}
   setChange(p,'从创作入口建立草稿：'+p.creationPath);
   nav('workspace/'+p.id+'/0');
 },true);
 window.wt4Workspace=workspace;
 window.WT4Workflow={stageNames,state,verifiedPublished,remote,creationEntries};
 if(location.hash.startsWith('#/workspace')||location.hash.startsWith('#/production'))queueMicrotask(()=>parseRoute());
})();
