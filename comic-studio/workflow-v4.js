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
   const named=!!p&&!!String(p.title||'').trim()&&p.title!=='未命名新作';
   const story=named&&!!String(p.description||p.ideaSeed||'').trim();
   const cast=!!(p?.characterRefs?.length||p?.characters?.trim()||p?.creativeDirection?.cast?.some(x=>x.name&&x.look));
   const board=panels.length>=4&&panels.every(x=>String(x?.scene||'').trim().length>=12);
   const style=!!p?.creativeDirection?.styleId&&!!p?.creativeDirection?.approval?.lock_hash&&
      (typeof wtDirector==='object'?wtDirector.approved(p):p.creativeDirection.approval.author_approved===true);
   const uploaded=Array.isArray(h.stagedFiles)&&h.stagedFiles.length>=panels.length+1&&
      h.stagedFiles.length===(h.stageUploaded||[]).length;
   const qa=!!row&&['ready_for_workbuddy','publishing','published'].includes(row.status);
   const published=verifiedPublished(row);
   const completed=[story,cast,board,style,qa||uploaded,qa,published];
   const missing=completed.indexOf(false);
   const next=missing===-1?6:missing;
   const agent=p?.productionAgent==='WorkBuddy'?'WorkBuddy':'ChatGPT';
   const pending=!!p&&!!h.taskId&&!row;
   const label=published?'已发表':row?.status==='blocked'?'QA 待修复':qa?'交付已验收':h.repoQueuedAt?'生产中':'创作中';
   const statusText=published?'已核验发表回执，作品可归档':
     qa?'GitHub 成品已验收；正式发表仍需独立授权和回执':
     row?.status==='blocked'?'GitHub QA 未通过，请按具体问题修复':
     uploaded?'远程文件已上传，待独立质量验收':
     h.repoQueuedAt?'已派单；正式生图与成品仍需核验':
     !story?'完善故事方案与原创性说明':
     !cast?'选择或确认角色，锁定作品专用角色版本':
     !board?'完善每格场景、对白和镜头':
     !style?'确认预览画风与角色样稿，再进行正式生产':
     '等待真实成品及质量核验';
   return {row,completed,next,agent,pending,label,statusText,uploaded,published};
 }
 function legacyStageBody(p,i,s){
   if(i===0){const prev=ui.stage;ui.stage=0;const body=studioStage(p);ui.stage=prev;return body;}
   if(i===1){
     queueMicrotask(checkDeepSeek); // Read-only service configuration check; never bills the model.
     const model=deepseek.configured===true?'DeepSeek 服务端已连接':
       deepseek.configured===false?'DeepSeek API Key 尚未配置':
       deepseek.loading?'正在核验 DeepSeek 服务端状态':'模型状态将在登录后核验';
     const prev=ui.stage;ui.stage=2;const body=studio();ui.stage=prev;
     return '<div class="wt4-model-status" role="status">'+html(model)+
       ' · 生成内容前仍需作者主动确认可能产生的模型费用</div>'+body;
   }
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
     '<button class="button" data-wt-series-planner="open"'+(p.handoff?.repoQueuedAt?' disabled':'')+'>AI 规划完整系列</button>'+
     '<button class="button" data-wt3-action="series-new"'+(p.seriesId||p.handoff?.repoQueuedAt?' disabled':'')+'>创建原创系列</button>'+
     '<button class="button" data-wt3-action="series-next"'+(!p.seriesId?' disabled':'')+'>接续系列下一章</button>'+
     '<button class="button" data-archive="refresh">同步发表回执</button></div></section>';
 }

 function withEditor(p,index){
   const was=ui.stage;ui.stage=index;
   try{return studioStage(p)}finally{ui.stage=was}
 }
 function sourceHint(p){
   return p.entryType==='hotspot'?'热点改编 · 新闻来源为待核验线索，不是事实认证':
     p.entryType==='idea'?'一句话创作 · AI 生成只在明确确认可能的模型费用后调用':
     '自主创作 · 原创剧情可编辑，作品中的事实性陈述仍需核验';
 }
 function characterSnapshot(c){
   return {characterId:String(c.characterId||c.id||''),version:Math.max(1,Number(c.version)||1),
     originalName:String(c.originalName||c.name||''),gender:String(c.gender||''),age:String(c.age||''),
     profession:String(c.profession||''),description:String(c.description||''),costume:String(c.costume||''),
     traits:String(c.traits||''),personality:String(c.personality||''),colors:String(c.colors||''),
     portrait:String(c.portrait||'')};
 }
 function characterStage(p){
   const ids=Array.isArray(p.characterRefs)?p.characterRefs:[];
   const catalog=Array.isArray(data.characters)?data.characters:[];
   const locked=!!(p.handoff?.repoQueuedAt||p.creativeDirection?.approval?.lock_hash);
   const linked=ids.map(ref=>{
     const original=catalog.find(x=>String(x.characterId||x.id)===String(ref.characterId));
     const snap=ref.snapshot|| (original?characterSnapshot(original):null);
     if(!snap)return '<p class="wt4-warning">角色 '+html(ref.characterId)+' 在资产库中不存在，原始项目引用已保留，需人工修复。</p>';
     const local=p.characterOverrides?.[ref.characterId]||{};
     return '<article class="wt4-character-card"><div class="wt4-character-head"><strong>'+
       html(ref.comicName||snap.originalName||'未命名角色')+'</strong><small>角色资产 '+html(ref.characterId)+
       ' · 版本 v'+html(ref.version||snap.version)+' 已固定</small></div>'+
       '<p>'+html(snap.description||'尚未补充外观')+' · '+html(snap.costume||'服装待设定')+'</p>'+
       '<div class="wt4-char-fields"><label>本作品内的称呼<input data-wt4-character-edit="'+html(ref.characterId)+
       '" data-wt4-char-field="comicName" value="'+html(ref.comicName||snap.originalName)+'"'+(locked?' disabled':'')+'></label>'+
       '<label>本作品专用外观补充<textarea data-wt4-character-edit="'+html(ref.characterId)+
       '" data-wt4-char-field="look"'+(locked?' disabled':'')+'>'+html(local.look||'')+'</textarea></label>'+
       '<label>本作品专用服饰补充<textarea data-wt4-character-edit="'+html(ref.characterId)+
       '" data-wt4-char-field="costume"'+(locked?' disabled':'')+'>'+html(local.costume||'')+'</textarea></label></div>'+
       '<small>作品内的修改不会写回角色档案原型。派单后锁定版本，不支持静默更换。</small></article>';
   }).join('');
   const unlinked=catalog.filter(c=>!ids.some(x=>String(x.characterId)===String(c.characterId||c.id)));
   const options=unlinked.map(c=>'<option value="'+html(c.characterId||c.id)+'">'+
     html(c.originalName||c.name||'角色')+' · '+html(c.gender||'性别未设定')+' · v'+html(c.version||1)+'</option>').join('');
   return '<section class="wt4-character-workspace"><div class="wt4-stage-note"><strong>角色资产库 · Character Bible</strong>'+
    '<p>按角色 ID 和版本引用，项目只保存快照与作品内覆盖项。不会覆盖历史作品或原型；人像参考须确认肖像使用权。</p></div>'+
    '<div class="wt4-char-section"><h3>本作品角色（'+ids.length+'）</h3>'+
    (linked||'<p class="wt4-muted">尚未关联角色。请从库中选择，或确认新角色并建档。</p>')+'</div>'+
    (locked?'<p class="wt4-warning">已正式派单：角色版本锁定，修改请建立新修订作品。</p>':
      '<div class="wt4-char-picker"><label for="wt4-char-asset">复用既有角色</label>'+
      '<select id="wt4-char-asset">'+(options||'<option value="">暂无其他可复用角色</option>')+'</select>'+
      '<button class="button" data-wt4-character-link'+(!options?' disabled':'')+'>关联并锁定当前版本</button></div>'+
      '<form class="wt4-char-create" data-wt4-character-create><h3>确认原创角色并建档</h3>'+
      '<div class="wt4-char-fields"><label>角色名称<input name="name" maxlength="80" required placeholder="例如：黎舟"></label>'+
      '<label>性别 / 性别认同（可自定义）<input name="gender" maxlength="80" placeholder="可留空"></label>'+
      '<label>年龄设定<input name="age" maxlength="80" placeholder="例如：青年"></label>'+
      '<label>职业 / 身份<input name="profession" maxlength="120"></label>'+
      '<label>外观与识别特征<textarea name="description" maxlength="1800" required></textarea></label>'+
      '<label>服装与道具<textarea name="costume" maxlength="700"></textarea></label>'+
      '<label>性格与角色关系<textarea name="personality" maxlength="950"></textarea></label></div>'+
      '<button class="button dark" type="submit">确认建档并加入作品</button></form>')+
    '<p class="wt4-quiet">已有 AI 编剧或导演人物设定可在创意导演台核对。只有作者确认建档，才会成为可复用角色资产。</p></section>';
 }
 function stageBody(p,i,s){
   if(i===0){
     queueMicrotask(checkDeepSeek);
     const was=ui.stage;ui.stage=0;
     let body;try{body=studio()}finally{ui.stage=was}
     return '<div class="wt4-stage-note"><strong>01 · 故事方案</strong><p>'+html(sourceHint(p))+
       '。请先完成标题、创意、来源与事实边界；AI 扩写按钮调用已配置的真实模型，仍需独立确认费用。</p></div>'+body;
   }
   if(i===1)return characterStage(p);
   if(i===2)return '<div class="wt4-stage-note"><strong>03 · 剧情分镜</strong><p>逐格编辑画面、对白和镜头。规则模板不等于 AI 已生成；完整分镜必须经作者确认。</p></div>'+withEditor(p,2);
   if(i===3)return '<div class="wt4-stage-note"><strong>04 · 视觉风格</strong><p>选用真实参考、明确锁定角色和画风；可生成的样张与未经生成的参考必须分别标注。</p></div>'+
     (typeof wtCreativeDirector==='function'?wtCreativeDirector():withEditor(p,1));
   if(i===4)return '<div class="wt4-stage-note"><strong>05 · 正式生成</strong><p>两条生产轨道共用真实生图与 GitHub QA，付费模型未授权时保持关闭。允许逐格补图与失败重试，不允许用占位图顶替正式作品。</p></div>'+
     legacyStageBody(p,3,s)+withEditor(p,3);
   if(i===5)return '<div class="wt4-stage-note"><strong>06 · 审阅精修</strong><p>逐格检查高清尺寸、文字可读性、服装一致性、版权与来源。可返回任意画格编辑，历史的独立审批不会被假造。</p></div>'+
     legacyStageBody(p,4,s)+withEditor(p,4);
   return '<div class="wt4-stage-note"><strong>07 · 导出发布</strong><p>图片与封面必须真实存在；ZIP 下载、Github 成品上传、作者最终批准和 WorkBuddy 发表回执分别验收。</p></div>'+
     legacyStageBody(p,5,s)+legacyStageBody(p,6,s);
 }
 function entryHub(){
   const tab=ui.wt4Entry||'';
   const entries=[['hotspot','热点改编','从全球热点、AI 前沿简报或现有选题池开始','热点与来源'],['idea','一句话创作','写一句灵感，进入真实 AI 扩写和角色设定','灵感输入'],['author','自主创作','自己定义标题、主题与剧情，AI 只做辅助','自由编剧']];
   const cards=entries.map((x,i)=>'<button type="button" class="wt4-entry-card'+(tab===x[0]?' active':'')+
       '" data-wt4-entry="'+x[0]+'" aria-pressed="'+(tab===x[0]?'true':'false')+'"><span class="wt4-entry-index">0'+(i+1)+'</span>'+
       '<strong>'+x[1]+'</strong><span>'+x[2]+'</span><small>'+x[3]+' →</small></button>').join('');
   let body='';
   if(tab==='hotspot'){
     const t=(data.topics||[]).filter(x=>!x.isSample).slice(0,8);
     body='<div class="wt4-entry-panel"><h3>从已有选题开始</h3><p>来源仍需在作品中独立核验，导入不代表获得改编授权。</p>'+
       (t.length?t.map(x=>'<button class="wt4-topic-row" data-wt4-topic="'+html(x.id)+'"><span>'+html(x.title)+
       '</span><small>'+html(x.stage||'待核验')+' · 导入 →</small></button>').join(''):'<p>选题池暂无自建选题，可以先从实时素材中筛选。</p>')+
       '<div class="buttons"><a class="button dark" href="#/live">全球热点与热门素材</a><a class="button" href="#/ai-briefing">AI 前沿简报</a><a class="button" href="#/radar">选题池</a></div></div>';
   }else if(tab==='idea'){
     body='<form class="wt4-entry-panel" data-wt4-create="idea"><label for="wt4-seed">一句话灵感</label>'+
       '<textarea id="wt4-seed" name="seed" required maxlength="1800" placeholder="例如：未来城市的机器人突然拒绝加班"></textarea>'+
       '<p>建立草稿免费；点击真实 DeepSeek 扩写前会单独确认可能产生的模型费用。</p>'+
       '<button class="button dark" type="submit">创建作品并进入 AI 编剧 →</button></form>';
   }else if(tab==='author'){
     body='<form class="wt4-entry-panel" data-wt4-create="author"><div class="wt4-char-fields">'+
       '<label>漫画名称<input name="title" required maxlength="160" placeholder="给作品起一个好名字"></label>'+
       '<label>故事主题<input name="category" maxlength="120" placeholder="历史、科幻、亲子、商业……"></label>'+
       '<label>剧情概要<textarea name="description" required maxlength="5000" placeholder="主角、冲突、转折与结局"></textarea></label></div>'+
       '<button class="button dark" type="submit">保存剧情并进入制作 →</button></form>';
   }
   return '<section class="wt4-entry-hub"><div class="wt4-entry-intro"><span class="kicker">WORLD / TOON · START HERE</span>'+
     '<h1>你的下一部漫画，从这里开始。</h1><p>三种创作方式，一条专业制作流程。先选择入口，后续全部在同一个作品里完成。</p></div>'+
     '<div class="wt4-entry-grid">'+cards+'</div>'+body+'</section>';
 }
 function saveEntry(type,values){
   if(type==='idea'&&!String(values.seed||'').trim())return notify('请先输入创作灵感');
   if(type==='author'&&(!String(values.title||'').trim()||!String(values.description||'').trim()))return notify('请填写漫画名称和剧情概要');
   newProject();const p=selected();
   p.entryType=type;p.handoff={...(p.handoff||{}),mode:'original'};
   if(type==='idea'){p.ideaSeed=String(values.seed).trim();p.description=p.ideaSeed;p.category='原创故事';}
   else {p.title=String(values.title).trim();p.description=String(values.description).trim();p.category=String(values.category||'原创故事').trim()||'原创故事';p.ideaSeed=p.description;}
   setChange(p,'从'+(type==='idea'?'一句话创作':'自主创作')+'入口立项');
   nav('workspace/'+p.id+'/0');
 }
 function linkCharacter(p,c){
   if(!Array.isArray(p.characterRefs))p.characterRefs=[];
   const snapshot=characterSnapshot(c);
   if(!snapshot.characterId||p.characterRefs.some(x=>String(x.characterId)===snapshot.characterId))return false;
   p.characterRefs.push({characterId:snapshot.characterId,version:snapshot.version,
     role:'supporting',comicName:snapshot.originalName,snapshot});
   setChange(p,'作品关联角色 '+snapshot.originalName+' v'+snapshot.version);
   return true;
 }
 function newCharacter(p,values){
   const name=String(values.name||'').trim(),look=String(values.description||'').trim();
   if(!name||!look)return notify('请完整填写角色名称和外观');
   if(!Array.isArray(data.characters))data.characters=[];
   const id=uid(),c={id,characterId:id,version:1,name,originalName:name,
     gender:String(values.gender||'').trim(),age:String(values.age||'').trim(),
     profession:String(values.profession||'').trim(),description:look,
     costume:String(values.costume||'').trim(),personality:String(values.personality||'').trim(),
     traits:'',colors:'',portrait:'',origin:'author_confirmed',originProjectId:p.id,comicNames:[]};
   data.characters.push(c);linkCharacter(p,c);notify('角色资产已建档并与作品版本锁定');
   nav('workspace/'+p.id+'/1');
 }
 function workspace(){
   const candidates=activeProjects().filter(x=>x.id!=='sample-ba-zong-001')
     .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
   const explicit=location.hash.startsWith('#/workspace/')?selected():null;
   const chosen=explicit||(ui.wt4LastId?findProject(ui.wt4LastId):null)||candidates[0]||selected();
   const p=chosen?.id==='sample-ba-zong-001'?null:chosen;
   if(p){ui.wt4LastId=p.id;ui.selected=p.id;} // UI context only; never rewrite the stored project.
   if(!p||p.id==='sample-ba-zong-001')return entryHub()+'<section class="wt4-workspace wt4-empty">'+
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
   const next=(i>0?'<button class="button" data-wt4-step="'+(i-1)+'">← 上一步</button>':'')+(i<6?'<button class="button dark" data-wt4-step="'+(i+1)+'">下一步 →</button>':'');
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
     '<h2>'+html(stageNames[i])+'</h2></div><div class="buttons">'+next+
     '<a class="button" href="#/reader/'+encodeURIComponent(p.id)+'">阅读预览</a></div></div>'+
     '<div class="wt4-work-area">'+stageBody(p,i,s)+'</div></section>'+
     '<footer class="wt4-footer" role="status">保存状态：本机草稿已记录最后修改时间 '+html(p.updatedAt||'未知')+'。云端同步需登录并核验；GitHub 只认可实际入仓的工单和成品。所有审批均需作者独立确认。</footer></div>';
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
   ui.wt4Step=4;
   try{return workspace()}finally{ui.wt4Step=prev}
 }
 window.wt4Production=production;
 const originalDashboard=dashboard;
 dashboard=function(){return entryHub()+overview()}; // Old dashboard implementation remains unchanged for rollback.
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

 document.addEventListener('click',ev=>{
   const entry=ev.target.closest('[data-wt4-entry]');
   if(entry){ev.preventDefault();ui.wt4Entry=entry.dataset.wt4Entry;render();return}
   const topic=ev.target.closest('[data-wt4-topic]');
   if(topic){ev.preventDefault();const t=(data.topics||[]).find(x=>String(x.id)===String(topic.dataset.wt4Topic));
     if(!t)return notify('选题不存在，请刷新选题池');
     newProject(t);const p=selected();p.entryType='hotspot';p.handoff={...(p.handoff||{}),mode:'hotspot'};
     setChange(p,'从热点改编入口导入选题');nav('workspace/'+p.id+'/0');return}
   const link=ev.target.closest('[data-wt4-character-link]');
   if(link){ev.preventDefault();const p=selected(),id=document.querySelector('#wt4-char-asset')?.value;
     if(!p||p.handoff?.repoQueuedAt||p.creativeDirection?.approval?.lock_hash)return notify('角色已锁定，请新建修订版');
     const c=(data.characters||[]).find(x=>String(x.characterId||x.id)===String(id));
     if(!c)return notify('请选择角色资产');
     if(!linkCharacter(p,c))return notify('该角色已关联当前作品');
     nav('workspace/'+p.id+'/1');}
 },true);
 document.addEventListener('submit',ev=>{
   const form=ev.target,mode=form?.dataset?.wt4Create;
   if(mode){ev.preventDefault();ev.stopImmediatePropagation();const values=Object.fromEntries(new FormData(form).entries());saveEntry(mode,values);return}
   if(form?.hasAttribute('data-wt4-character-create')){
     ev.preventDefault();ev.stopImmediatePropagation();const p=selected();
     if(!p||p.handoff?.repoQueuedAt||p.creativeDirection?.approval?.lock_hash)return notify('已锁定创意方案的作品不能直接变更角色');
     newCharacter(p,Object.fromEntries(new FormData(form).entries()));
   }
 },true);
 document.addEventListener('change',ev=>{
   const field=ev.target?.dataset?.wt4CharField,id=ev.target?.dataset?.wt4CharacterEdit;
   if(!field||!id)return;
   const p=selected();if(!p||p.handoff?.repoQueuedAt||p.creativeDirection?.approval?.lock_hash)return notify('已锁定创意方案的作品不能直接变更角色');
   const ref=(p.characterRefs||[]).find(x=>String(x.characterId)===String(id));
   if(!ref)return;
   if(field==='comicName'){ref.comicName=ev.target.value;}
   else if(['look','costume'].includes(field)){
     if(!p.characterOverrides)p.characterOverrides={};
     p.characterOverrides[id]={...(p.characterOverrides[id]||{}),[field]:ev.target.value};
   }
   setChange(p,'更新角色作品内版本覆盖，不修改角色资产库');
 },true);
 window.wt4Workspace=workspace;
 window.WT4Workflow={stageNames,state,verifiedPublished,remote,characterSnapshot,linkCharacter,entryHub,characterStage,saveEntry};
 if(location.hash.startsWith('#/workspace')||location.hash.startsWith('#/production'))queueMicrotask(()=>parseRoute());
})();
