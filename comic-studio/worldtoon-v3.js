/* WORLD/TOON 3.0 / By DAVYLAB — author-approved story and shelf UX.
 * No automatic purchases, model calls, author approvals or publication claims.
 */
'use strict';
(function(){
 const h=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const supported=['已发表','制作中','待制作'];
 const plotGenres=[
  {id:'general',name:'通用创作 · AI 自由编剧'},
  {id:'viral-melodrama',name:'狗血网红爽剧 · 重生 / 豪门 / 娱乐圈'}
 ];
 const melodramaSubtypes=[
  {id:'rebirth-bank-rich',name:'重生银行富婆 · 养成明星与身份大反转',
   prompt:'重生归来成为金融圈富婆，投资或合约支持成年男明星，旧恋人和豪门关系纠缠，直播热搜与银行职场双线逆袭。人物均为成年原创虚构角色；人物关系写得幽默反差，不涉及强迫或色情场景。'},
  {id:'celebrity-contract',name:'娱乐圈合约恋爱 · 假戏真做',
   prompt:'成年女企业家与成年演员签订合作合约，意外被短视频媒体炒成恋爱绯闻；在名利、真感情与职业理想之间不断反转。'},
  {id:'wealth-revenge',name:'豪门真假千金 · 逆袭打脸',
   prompt:'成年女主被误解身份，借专业实力反转豪门与网红社交圈中的地位，每集留下夸张但逻辑自洽的身份反转钩子。'},
  {id:'bank-influencer',name:'银行职场网红 · 权力与流量修罗场',
   prompt:'架空银行中一名成年女高管面对直播带货、网红风波与资本局面，用聪明的选择反转职场偏见。'}
 ];
 const findSubtype=id=>melodramaSubtypes.find(x=>x.id===id)||melodramaSubtypes[0];
 const dramaInstructions=p=>{
   if(p.plotGenre!=='viral-melodrama')return '';
   const tone=Math.max(1,Math.min(5,Number(p.dramaIntensity||4))),preset=findSubtype(p.dramaSubtype);
   return '【作者选择的网红狗血短剧创作要求】'+preset.prompt+
    '。狗血强度'+tone+'/5；节奏要快，首格强钩子，反差与反转明确；每2–3格设置一个情节悬念；高潮做身份、权力或情感逆袭，最后留下一集钩子。现代都市、富婆、成年男明星、网红热搜与商业职场关系可适度夸张，但需有因果，不要流水账或同一反转重复。角色是原创虚构成年人，不使用可识别真人传闻，不冒充事实报道。';
 };

 const expandUI={pending:null,busy:false,projectId:null,message:'',kind:'info'};
 function showExpandStatus(kind,message,projectId){
   expandUI.kind=kind;expandUI.message=String(message||'');expandUI.projectId=projectId||expandUI.projectId;
   const node=document.querySelector('#wt3-expand-feedback');
   if(node){node.textContent=expandUI.message;node.dataset.state=kind;node.hidden=!expandUI.message;}
 }
 function showExpandConsent(on){
   const node=document.querySelector('#wt3-expand-consent');
   if(node)node.hidden=!on;
 }

 const remote=()=>wtArchiveSnapshot?.library?.items||[];
 // Same read-only WeChat archive as the Production Desk. Publication records
 // are evidence of a WeChat article, NOT independent proof of a finished comic.
 const sharedArchive=()=>wtArchiveSnapshot?.shared_publications?.status==='synced'
    ?wtArchiveSnapshot.shared_publications:wtSharedStandalone;
 const wxLink=url=>/^https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+(?:[?#].*)?$/.test(String(url||''));
 const publicationCover=raw=>{
   try{
     const u=new URL(String(raw||''));
     if(!['http:','https:'].includes(u.protocol)||!/(^|\.)qpic\.cn$/i.test(u.hostname))return '';
     u.protocol='https:';return u.href;
   }catch{return ''}
 };
 const sharedRows=()=>sharedArchive()?.status==='synced'
   ?(sharedArchive().articles||[]).filter(a=>a?.format==='贴图'&&wxLink(a.url))
   :[];
 const isDone=r=>r?.status==='published'&&r.receipt?.status==='published'&&/^https:\/\/mp\.weixin\.qq\.com\/s\//.test(r.receipt.url||'');
 const kind=(p,r)=>{
   if(isDone(r))return '已发表';
   if(r&&r.status==='queued')return p?.handoff?.importStatus||p?.panels?.some(x=>x.image?.startsWith('media:'))?'制作中':'待制作';
   if(r)return '制作中';
   if(p?.handoff?.repoQueuedAt||p?.handoff?.taskId||p?.panels?.some(x=>x.image?.startsWith('media:')))return '制作中';
   return '待制作';
 };
 const cover=(r,p)=>{
  if(isDone(r)&&r.cover)return '/api/archive/cover?task_id='+encodeURIComponent(r.task_id);
  if(p?.cover&&/^(media:|assets\/|https:)/.test(p.cover))return p.cover;
  return '';
 };
 function shelf(){
   const rows=remote(),map=new Map(),locals=data.projects.filter(p=>!p.deleted&&!p.archived&&p.id!=='sample-ba-zong-001');
   for(const r of rows)map.set(r.task_id,{r,p:null});
   for(const p of locals){
     const id=p.handoff?.taskId||p.handoff?.repoTaskId;
     if(id&&map.has(id))map.get(id).p=p;
     else map.set(id||'local-'+p.id,{r:null,p});
   }
   const items=[...map.values()].map(x=>({...x,state:kind(x.p,x.r)}));
   // Deduplicate verified comics against their own WeChat publication records.
   // Only genuine WeChat image-post records (贴图) appear on this shelf; articles remain in the shared publication archive.
   const verifiedUrls=new Set(items.filter(x=>isDone(x.r)).map(x=>x.r.receipt.url));
   const seenPublications=new Set(verifiedUrls);
   for(const pub of sharedRows()){
     if(seenPublications.has(pub.url))continue;
     seenPublications.add(pub.url);
     items.push({r:null,p:null,publication:pub,state:'已发表'});
   }
   const cat=ui.filter&&supported.includes(ui.filter)?ui.filter:'已发表';
   const q=(ui.search||'').trim().toLowerCase();
   const shown=items.filter(x=>x.state===cat&&(!q||[x.p?.title,x.r?.title,x.p?.category,x.r?.category,x.p?.seriesTitle,x.publication?.title,x.publication?.column,x.publication?.format].join(' ').toLowerCase().includes(q)))
      .sort((a,b)=>String(b.publication?.publishedAt||b.r?.receipt?.published_at||b.r?.created_at||b.p?.updatedAt||'').localeCompare(String(a.publication?.publishedAt||a.r?.receipt?.published_at||a.r?.created_at||a.p?.updatedAt||'')));
   const tabs=supported.map(t=>'<button type="button" data-wt3-tab="'+t+'" class="'+(t===cat?'active':'')+'">'+t+' <span>'+items.filter(x=>x.state===t).length+'</span></button>').join('');
   const cards=shown.map(({r,p,state,publication})=>{
    const tid=r?.task_id||p?.handoff?.taskId||'',url=publication?publicationCover(publication.coverUrl):cover(r,p);
    const placeholder='<div class="wt3-placeholder"><span>WORLD<br>TOON</span></div>';
    // Keep the authentic image (recorded in the GitHub publication archive).
    // No guessed or unrelated cover is ever substituted.
    const src=url?placeholder+'<img '+(url.startsWith('media:')?'data-wt3-media="'+h(url.slice(6))+'" ':'')+
     (url.startsWith('media:')?'':'src="'+h(url)+'" ')+
     (publication?'data-wt3-wechat-cover="1" ':'')+
     'referrerpolicy="no-referrer" decoding="async" alt="'+h((publication?.title||r?.title||p?.title||'')+(publication?'公众号发表封面':'漫画封面'))+
     '" loading="lazy">':placeholder;
    const name=h(publication?.title||r?.title||p?.title||'未命名作品'),series=h(p?.seriesTitle||r?.series?.id||''),episode=p?.seriesEpisode||r?.series?.episode||null;
    const published=isDone(r);
    const href=publication?h(publication.url):published?h(r.receipt.url):p?'#/reader/'+encodeURIComponent(p.id):tid?'https://github.com/chenzhe223-tech/worldtoon/tree/main/tasks/'+encodeURIComponent(tid):'#/studio';
    // Avoid repeating format and status in three different lines of every card.
    const meta=publication?h(publication.format||'公众号内容'):h(r?.category||p?.category||'原创漫画');
    const desc=publication?('发布于 '+h(publication.publishedAt||'日期待同步')+
       (publication.task_id?' · 漫画工单待核对':'')):h(p?.subtitle||(r?.status==='blocked'?'制作进度需复核':p?.description||''));
    return '<article class="wt3-book"><a href="'+href+'"'+(published||publication||(!p&&tid)?' target="_blank" rel="noopener noreferrer"':'')+' class="wt3-cover" aria-label="'+name+'">'+src+'</a>'+
     '<div class="wt3-book-info"><small class="wt3-book-category">'+meta+(series?' · '+series:'')+(episode?' · 第'+episode+'章':'')+'</small><h3>'+name+'</h3>'+
     '<p class="wt3-book-description">'+desc+'</p>'+
     '<span class="wt3-book-state">'+h(state)+(publication?'':r?.panel_count?' · '+r.panel_count+'格':p?.panels?.length?' · '+p.panels.length+'格':'')+'</span></div></article>';
   }).join('');
   queueMicrotask(()=>{if(ui.route!=='library')return;
     document.querySelectorAll('.wt3-shelf .wt3-cover img').forEach(img=>{
       // WeChat's /0 original and /640 resized variant refer to the same asset.
       // Try the alternate URL only once; never invent an unrelated image.
       img.addEventListener('error',()=>{
         if(!img.isConnected)return;
         if(img.dataset.wt3WechatCover==='1'&&img.dataset.wt3Retry!=='1'){
           img.dataset.wt3Retry='1';
           try{
             const u=new URL(img.currentSrc||img.src);
             if(u.hostname.toLowerCase().endsWith('.qpic.cn')&&u.pathname.endsWith('/0')){
               u.pathname=u.pathname.slice(0,-2)+'/640';img.src=u.href;return;
             }
           }catch{}
         }
         img.remove();
       });
     });
     document.querySelectorAll('.wt3-shelf img[data-wt3-media]').forEach(async img=>{
       try{const url=await resolveImage('media:'+img.dataset.wt3Media);
         if(url&&img.isConnected)img.src=url;
       }catch{img.alt='本地封面暂不可用'}});
   });
   return '<div class="wt3-shelf">'+heroHeader('WORLD/TOON / COMIC LIBRARY','漫画书架','只展示公众号贴图与已核验漫画，正式漫画仍经 GitHub 验收与 WorkBuddy 回执核对。','<button type="button" class="button dark" data-action="new">＋ 新作</button><button type="button" class="button" data-archive="refresh">⟳ 同步书架</button>')+
    '<div class="wt3-shelf-meta">GitHub 真实归档：'+(wtArchiveSnapshot?rows.length+' 部':'尚未同步')+
    ' · 公众号已发表贴图：'+(sharedArchive()?.status==='synced'?sharedRows().length+' 篇':'尚未同步')+
    ' · 仅核验漫画才标记为漫画成品'+(wtArchiveError?'<p class="wt3-error">私有仓库同步：'+h(wtArchiveError)+'</p>':'')+'</div>'+
    '<div class="toolbar"><div class="tabbar wt3-tabs">'+tabs+'</div><input class="search" id="librarySearch" value="'+h(ui.search||'')+'" placeholder="搜索漫画、系列或题材" aria-label="搜索漫画"></div>'+
    (cat==='已发表'&&sharedRows().length?'<p class="wt3-shelf-note">本栏目仅展示公众号已发表贴图；普通图文文章留在公众号发表档案，正式漫画仍需 GitHub 验收和 WorkBuddy 回执。</p>':'')+
    (cards?'<div class="wt3-books">'+cards+'</div>':'<div class="empty"><b>这一分类暂无作品</b><p>可同步公众号发表档案；未完成漫画在制作中或待制作查看。</p></div>')+'</div>';
 }
 function resize(p,n){
  if(!p||p.handoff?.repoQueuedAt)throw Error('已入仓工单不能直接修改分镜长度；请新建版本');
  n=Number(n);if(!Number.isInteger(n)||n<4||n>60)throw Error('请设置4–60格');
  if(n===p.panels.length)return;
  if(n<p.panels.length&&p.panels.slice(n).some(x=>x.image||x.scene)&&!confirm('减少篇幅将删除超出数量的分镜信息，确认吗？'))return;
  const original=p.panels.slice(0,n);
  while(original.length<n)original.push(makePanel(original.length));
  p.panels=original;p.format=n+'格漫画';
  if(p.creativeDirection){p.creativeDirection.approval=null;p.creativeDirection.reviewed=false;p.creativeDirection.drafted=false}
  ui.panel=Math.min(ui.panel,n-1);ui.reader=Math.min(ui.reader,n-1);
  markDirty(p);setChange(p,'调整漫画篇幅：'+n+'格');render();
 }
 function seriesNew(p){
  if(!p||p.handoff?.repoQueuedAt)throw Error('已派单作品不能修改系列身份；请创建新的作品');
  const name=prompt('输入系列名称',p.title.replace(/：漫画改编$/,''));if(!name?.trim())return;
  p.seriesId='S-'+crypto.randomUUID().replaceAll('-','').slice(0,16);
  p.seriesTitle=name.trim().slice(0,90);p.seriesEpisode=1;
  p.seriesBible={title:p.seriesTitle,world:p.creativeDirection?.world||'',style_id:p.creativeDirection?.styleId||'',
    characters:structuredClone(p.creativeDirection?.cast||[]),story_arc:p.description||'',continuity:'角色造型、服饰、画风和重要道具在后续章节保持一致',created_at:now()};
  setChange(p,'建立原创漫画系列：'+p.seriesTitle);render();
 }
 function seriesContinue(p){
  if(!p)throw Error('未选择作品');
  if(!p.seriesId)throw Error('请先创建系列');
  const nextEpisode=Math.max(Number(p.seriesEpisode)||1,...data.projects.filter(x=>x.seriesId===p.seriesId).map(x=>Number(x.seriesEpisode)||0))+1;
  const v=emptyProject();
  v.title=p.seriesTitle+' · 第'+nextEpisode+'章';
  v.subtitle='承接《'+p.title+'》';
  v.category=p.category;v.productionAgent=p.productionAgent||'ChatGPT';v.tone=p.tone;
  v.seriesId=p.seriesId;v.seriesTitle=p.seriesTitle;v.seriesEpisode=nextEpisode;
  v.previousTaskId=p.handoff?.taskId||null;
  v.seriesBible=structuredClone(p.seriesBible||{});v.description='接续上一章《'+p.title+'》：'+(p.description||'')+'。请延续人物关系、道具和已建立的故事世界，创作新的冲突与结局。';
  v.characters=p.characters;v.fiction=p.fiction;v.disclosure=p.disclosure;
  if(p.creativeDirection){
    v.creativeDirection=structuredClone(p.creativeDirection);
    v.creativeDirection.approval=null;v.creativeDirection.reviewed=false;v.creativeDirection.drafted=false;
    v.creativeDirection.storyboardProvenance=null;
    v.creativeDirection.thesis=v.description;
  }
  v.panels=Array.from({length:p.panels.length},(_,i)=>makePanel(i));
  data.projects.unshift(v);ui.selected=v.id;persist();nav('workspace/'+v.id+'/1');
  notify('新续章已创建；人物画风作为参考锁定，仍须作者审阅新剧情');
 }
 const originalStudio=studio;
 studio=function(){
  const p=selected(),base=originalStudio();if(!p)return base;
  const locked=!!p.handoff?.repoQueuedAt,agent=p.productionAgent||'ChatGPT',count=p.panels?.length||9;
  const setting='<section class="box wt3-work-panel"><div class="kicker">WORLD/TOON 3.0 / STORY ENGINE</div><h2>一条创意，开启一部漫画</h2>'+
   '<p class="minor">编剧 → 创意导演台 → 生产 Agent → 交付验收 → 作品书架。DeepSeek 使用 Cloudflare Worker 的安全服务端密钥，同一平台账号多端共享，不在浏览器保存明文密钥。</p>'+
   '<details class="wt3-deepseek-setup"><summary>首次配置 DeepSeek API · 一次保存，多设备通用</summary>'+
   '<div class="wt3-deepseek-instructions"><p>1. 到 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">DeepSeek 控制台</a>创建 API Key，并确保账户有可用额度。</p>'+
   '<p>2. 到 <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare 控制台</a> → Workers & Pages → worldtoon → Settings → Variables and Secrets → Add。</p>'+
   '<p>3. 类型选择 <b>Secret</b>；名称填写 <code>WORLDTOON_DEEPSEEK_API_KEY</code>；Value 粘贴密钥，点击 Deploy。</p>'+
   '<p>4. 回到平台并登录同一个账号，刷新后使用“DeepSeek 扩写”；不需要其他设备再输入密钥。</p>'+
   '<p class="minor">密钥不要保存在 GitHub、前端 localStorage、聊天或普通明文变量。每次模型调用可能产生费用，仍需人工确认。</p></div></details>'+
   '<div class="wt3-controls"><div class="field wt3-seed"><label>一句话构思</label><textarea id="wt3-seed" rows="2" placeholder="例如：一个古代县令穿越到 AI 时代，发现机器人更会断案">'+h(p.ideaSeed||'')+'</textarea></div>'+
   '<div class="field"><label>制作 Agent</label><select id="wt3-agent" '+(locked?'disabled':'')+'><option value="ChatGPT"'+(agent==='ChatGPT'?' selected':'')+'>ChatGPT 创作 · WorkBuddy 发表</option><option value="WorkBuddy"'+(agent==='WorkBuddy'?' selected':'')+'>WorkBuddy 创作与发表</option></select></div>'+
   '<div class="field"><label>漫画篇幅 · 4–60 格</label><input id="wt3-count" type="number" min="4" max="60" value="'+count+'" '+(locked?'disabled':'')+'></div></div>'+
   '<div class="wt3-drama-controls"><div class="field"><label>剧情类型 · DeepSeek 按此扩写</label><select id="wt3-plot-genre" '+(locked?'disabled':'')+'>'+plotGenres.map(x=>
     '<option value="'+h(x.id)+'"'+((p.plotGenre||'general')===x.id?' selected':'')+'>'+h(x.name)+'</option>').join('')+'</select></div>'+
   (p.plotGenre==='viral-melodrama'?'<div class="field"><label>狗血剧情主题</label><select id="wt3-drama-subtype" '+(locked?'disabled':'')+'>'+melodramaSubtypes.map(x=>
     '<option value="'+h(x.id)+'"'+((p.dramaSubtype||'rebirth-bank-rich')===x.id?' selected':'')+'>'+h(x.name)+'</option>').join('')+'</select></div>'+
     '<div class="field"><label>狗血反转强度 · 1–5</label><select id="wt3-drama-intensity" '+(locked?'disabled':'')+'>'+[1,2,3,4,5].map(n=>
       '<option value="'+n+'"'+(Number(p.dramaIntensity||4)===n?' selected':'')+'>'+n+' / 5'+(n===4?' · 推荐':'')+'</option>').join('')+'</select></div>':'')+'</div>'+
   (p.plotGenre==='viral-melodrama'?'<p class="wt3-drama-tip">已启用：重生 / 网红 / 银行富婆 / 娱乐圈剧情要求。AI 扩写将把剧种、强度、反转节奏写入真实请求，同时保留用户输入的原创构思。</p>':'')+
   '<div class="buttons"><button type="button" class="button dark" data-wt3-action="expand" '+(expandUI.busy?'disabled':'')+'>DeepSeek 扩写并推荐篇幅</button>'+
   '<button type="button" class="button" data-wt3-action="resize" '+(locked?'disabled':'')+'>应用篇幅</button>'+
   '<button type="button" class="button" data-wt3-action="director">进入创意导演台</button></div>'+
   '<div class="wt3-expand-consent" id="wt3-expand-consent" '+(expandUI.pending?.projectId===p.id?'':'hidden')+'>'+
   '<p><strong>确认本次 AI 扩写</strong> · 将调用真实 DeepSeek API，可能按 Token 产生费用。确认后才开始请求，不会自动重复计费。</p>'+
   '<div class="buttons"><button type="button" class="button dark" data-wt3-action="expand-confirm">确认并开始生成</button>'+
   '<button type="button" class="button" data-wt3-action="expand-cancel">取消</button></div></div>'+
   '<p class="wt3-expand-feedback" id="wt3-expand-feedback" role="status" aria-live="polite" '+
   (expandUI.projectId===p.id&&expandUI.message?'data-state="'+h(expandUI.kind)+'"':'hidden')+'>'+
   (expandUI.projectId===p.id?h(expandUI.message):'')+'</p>'+
   '<div class="wt3-series"><h3>系列与续章</h3><p class="minor">'+h(p.seriesTitle||'尚未创建系列')+(p.seriesId?' · 第'+(p.seriesEpisode||1)+'章':'')+'</p>'+
   '<div class="buttons"><button type="button" class="button" data-wt3-action="series-new" '+(locked?'disabled':'')+'>设为新系列首章</button>'+
   '<button type="button" class="button" data-wt3-action="series-next" '+(!p.seriesId?'disabled':'')+'>接续创作下一章</button></div></div>'+
   (typeof window.WT3ImportPanel==='function'?window.WT3ImportPanel(p):'')+'</section>';
  const needle='<div class="editor-header"';
  return base.includes(needle)?base.replace(needle,setting+'<div class="editor-header"'):setting+base;
 };
 const originalHandoff=wtWorkflow;
 wtWorkflow=function(){
  const p=selected(),agent=p?.productionAgent||'ChatGPT';
  const sop='<section class="box wt3-sop"><h3>制作路线 · 双 SOP</h3><p>当前路线：<strong>'+h(agent)+'</strong> · 创意和发表均需独立作者授权。</p>'+
  '<div class="wt3-sop-grid"><span>SOP A · 平台 → ChatGPT → GitHub 成品验收 → WorkBuddy 发表 → 回执归档</span>'+
  '<span>SOP B · 平台 → GitHub 工单验收 → WorkBuddy 创作 → GitHub 成品验收 → WorkBuddy 发表 → 回执归档</span></div></section>';
  return sop+originalHandoff();
 };
 document.addEventListener('click',async ev=>{
  const tab=ev.target.closest('[data-wt3-tab]');if(tab){ev.preventDefault();ui.filter=tab.dataset.wt3Tab;render();return}
  const b=ev.target.closest('[data-wt3-action]');if(!b)return;
  ev.preventDefault();const p=selected();if(!p)return;
  try{
   const op=b.dataset.wt3Action;
   if(expandUI.busy&&['expand','expand-confirm'].includes(op)){
     showExpandStatus('loading','正在生成分镜，请勿重复请求或重复计费。',p.id);return;
   }
   if(op==='resize'){resize(p,document.querySelector('#wt3-count')?.value);return}
   if(op==='series-new'){seriesNew(p);return}
   if(op==='series-next'){seriesContinue(p);return}
   if(op==='director'){nav('director/'+p.id);return}
   if(op==='expand'){
     if(expandUI.busy)throw Error('DeepSeek 正在处理，请勿重复提交');
     if(p.handoff?.repoQueuedAt)throw Error('已派单作品不能被AI覆盖');
     const idea=document.querySelector('#wt3-seed')?.value?.trim()||'';
     if(idea.length<8||idea.length>1800)throw Error('请输入8–1800字的漫画构思');
     expandUI.pending={projectId:p.id,idea};expandUI.projectId=p.id;
     showExpandConsent(true);
     showExpandStatus('confirm','请在下方确认本次真实模型调用及可能的 Token 费用。',p.id);
     return;
   }
   if(op==='expand-cancel'){
     expandUI.pending=null;showExpandConsent(false);
     showExpandStatus('info','已取消：没有调用模型，也不会产生本次请求费用。',p.id);return;
   }
   if(op==='expand-confirm'){
     if(expandUI.busy)throw Error('DeepSeek 正在处理，请勿重复提交');
     const pending=expandUI.pending;
     if(!pending||pending.projectId!==p.id)throw Error('请先输入构思并确认调用');
     if(p.handoff?.repoQueuedAt)throw Error('已派单作品不能被AI覆盖');
     const idea=document.querySelector('#wt3-seed')?.value?.trim()||'';
     if(idea!==pending.idea)throw Error('创意内容发生变化，请重新点击扩写以确认');
     const modelIdea=idea+(p.plotGenre==='viral-melodrama'?'\\n'+dramaInstructions(p):'');
     if(modelIdea.length>1800)throw Error('构思与剧情预设合计不可超过1800字，请适当缩短构思');
     expandUI.busy=true;expandUI.projectId=p.id;expandUI.pending=null;
     showExpandConsent(false);
     b.disabled=true;b.textContent='AI 剧本生成中…';
     const first=document.querySelector('[data-wt3-action="expand"]');if(first)first.disabled=true;
     showExpandStatus('loading','正在连接 DeepSeek 并生成分镜，请不要重复提交。模型响应可能需要约一分钟。',p.id);
     p.ideaSeed=idea;setChange(p,'作者确认真实 DeepSeek 剧本扩写请求');
     const response=await wtArchiveApi('deepseek-expand',{method:'POST',body:JSON.stringify({idea:modelIdea,title:p.title,category:p.plotGenre==='viral-melodrama'?'原创网红短剧 / '+findSubtype(p.dramaSubtype).name:p.category,
       genre:p.plotGenre||'general',drama_subtype:p.dramaSubtype||'',drama_intensity:Number(p.dramaIntensity||4),
       panel_count:p.panels.length,series_bible:p.seriesBible||null,previous_summary:p.seriesEpisode>1?p.description:''})});
     if(response.method!=='verified_model_response')throw Error('没有收到可验证的真实模型响应，拒绝用模板内容冒充结果');
     const x=response.story;if(!x||!Array.isArray(x.panels)||x.panels.length<4||x.panels.length>60)throw Error('DeepSeek 未返回完整的分镜结构');
     if(p.handoff?.repoQueuedAt)throw Error('该作品已经派单，拒绝覆盖');
     p.title=String(x.title||p.title).slice(0,180);p.subtitle=String(x.subtitle||'').slice(0,240);
     p.description=String(x.summary||p.description).slice(0,4000);
     p.fiction=String(x.fictionalization||'原创架空故事，情节和对白均属虚构').slice(0,1600);
     p.panels=x.panels.map((a,i)=>({id:uid(),title:String(a.title||'第'+(i+1)+'格').slice(0,100),
       scene:String(a.scene||'').slice(0,1700),caption:String(a.caption||'').slice(0,550),
       dialogue:String(a.dialogue||'').slice(0,550),prompt:String(a.visual_prompt||'').slice(0,1200),image:''}));
     const c=wtDirector.ensure(p);c.drafted=true;c.reviewed=false;c.approval=null;
     if(p.plotGenre==='viral-melodrama')c.arcId='viral-melodrama';
     if(x.world)c.world=String(x.world).slice(0,600);
     if(x.theme)c.thesis=String(x.theme).slice(0,600);
     if(Array.isArray(x.characters)&&x.characters.length>=2)c.cast=x.characters.slice(0,12).map(v=>({
       role:String(v.role||'主要角色'),name:String(v.name||'待命名'),look:String(v.look||'').slice(0,450),
       clothes:String(v.clothes||'').slice(0,450),symbol:String(v.symbol||'').slice(0,200),nature:String(v.nature||'').slice(0,450)}));
     c.storyboardProvenance={method:'verified_model_response',provider:'deepseek',model:response.model||'deepseek-flash',
       at:now(),author_reviewed:false,analysis:String(x.reasoning||'').slice(0,600)};
     p.characters=wtDirector.castText(c);setChange(p,'DeepSeek 正式 API 返回可编辑的 '+p.panels.length+'格漫画剧本');
     showExpandStatus('success','真实模型生成成功：'+p.panels.length+' 格分镜已保存，正在进入创意导演台。',p.id);
     nav('director/'+p.id);notify('DeepSeek 结构化剧本已生成；请在导演台逐格审阅和锁定');
   }
  }catch(error){
    const msg='操作未完成：'+String(error.message||error).slice(0,250);
    if(['expand','expand-confirm','expand-cancel'].includes(b.dataset.wt3Action)){
      expandUI.pending=null;showExpandConsent(false);showExpandStatus('error',msg,p.id);
    }
    notify(msg);
  }finally{
    if(b.dataset.wt3Action==='expand-confirm')expandUI.busy=false;
    if(document.contains(b)){b.disabled=false;if(b.dataset.wt3Action==='expand-confirm')b.textContent='确认并开始生成'}
    const first=document.querySelector('[data-wt3-action="expand"]');if(first)first.disabled=expandUI.busy;
  }
 },true);
 document.addEventListener('change',ev=>{
  if(['wt3-plot-genre','wt3-drama-subtype','wt3-drama-intensity'].includes(ev.target?.id)){
    const p=selected();if(!p||p.handoff?.repoQueuedAt){notify('已派单任务不可改写本版剧情设定');return}
    const seed=document.querySelector('#wt3-seed');if(seed)p.ideaSeed=seed.value.slice(0,1800);
    if(ev.target.id==='wt3-plot-genre'){
      p.plotGenre=ev.target.value==='viral-melodrama'?'viral-melodrama':'general';
      if(p.plotGenre==='viral-melodrama'){
        p.dramaSubtype=p.dramaSubtype||'rebirth-bank-rich';p.dramaIntensity=p.dramaIntensity||4;
        if(!p.topicId&&!p.sourceURLs){p.handoff={...p.handoff,mode:'original'};
          if(p.category==='AI 科技')p.category='都市网红短剧';}
      }
      if(p.creativeDirection){p.creativeDirection.arcId=p.plotGenre==='viral-melodrama'?'viral-melodrama':'twist';
        p.creativeDirection.reviewed=false;p.creativeDirection.approval=null;}
    }else if(ev.target.id==='wt3-drama-subtype'){
      p.dramaSubtype=melodramaSubtypes.some(x=>x.id===ev.target.value)?ev.target.value:'rebirth-bank-rich';
    }else{p.dramaIntensity=Math.max(1,Math.min(5,Number(ev.target.value)||4))}
    expandUI.pending=null;
    if(expandUI.projectId===p.id)showExpandStatus('info','剧情设定已更新。请重新点击 DeepSeek 扩写并确认本次调用。',p.id);
    setChange(p,'保存 DeepSeek 剧情选项：'+p.plotGenre);render();return;
  }
  if(ev.target?.id==='wt3-agent'){const p=selected();if(p&&!p.handoff?.repoQueuedAt){p.productionAgent=ev.target.value==='WorkBuddy'?'WorkBuddy':'ChatGPT';setChange(p,'切换 SOP 生产者：'+p.productionAgent);render()}}
  if(ev.target?.id==='wt3-seed'){const p=selected();if(p&&!p.handoff?.repoQueuedAt){p.ideaSeed=ev.target.value.slice(0,1800);setChange(p,'保存漫画一句话构思')}}
 },true);
 window.WT3={kind,resize,shelf,seriesNew,seriesContinue};
 library=shelf;
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/library')&&Date.now()-wtArchiveLastSync>60000&&!wtArchiveBusy)void wtArchiveRefresh({silent:true})});
 queueMicrotask(()=>{if(location.hash.startsWith('#/library'))void wtArchiveRefresh({silent:true})});
})();

/* WORKFLOW_V4_EMBED — generated from workflow-v4.js for the Worker static allowlist. */
/* WORLD/TOON 4.0 · Unified production journey.
 * Progressive enhancement over existing modules. No data migration, false QA,
 * silent signing, billing, or publication side effects.
 */
'use strict';
(function(){
 const stageNames=['创意立项','AI 编剧','创意定稿','漫画生产','成品验收','出版交付','作品入架'];
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
   const story=panels.some(x=>(x?.scene||'').trim().length>=20)||
     (!!p?.ideaSeed&&!!p?.description?.trim());
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
