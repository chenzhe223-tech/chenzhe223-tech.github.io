/* WORLD/TOON 3.0 / By DAVYLAB — author-approved story and shelf UX.
 * No automatic purchases, model calls, author approvals or publication claims.
 */
'use strict';
(function(){
 const h=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const supported=['已发表','制作中','待制作'];
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
   ?(sharedArchive().articles||[]).filter(a=>wxLink(a.url))
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
   // Other genuine publications are shown with their original format label.
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
    const src=url?placeholder+'<img '+(url.startsWith('media:')?'data-wt3-media="'+h(url.slice(6))+'" ':'')+
     'src="'+h(url.startsWith('media:')?'':url)+'" alt="'+h((publication?.title||r?.title||p?.title||'')+(publication?'公众号发表封面':'漫画封面'))+
     '" loading="lazy">':placeholder;
    const name=h(publication?.title||r?.title||p?.title||'未命名作品'),series=h(p?.seriesTitle||r?.series?.id||''),episode=p?.seriesEpisode||r?.series?.episode||null;
    const published=isDone(r);
    const href=publication?h(publication.url):published?h(r.receipt.url):p?'#/reader/'+encodeURIComponent(p.id):tid?'https://github.com/chenzhe223-tech/worldtoon/tree/main/tasks/'+encodeURIComponent(tid):'#/studio';
    const meta=publication?'公众号发表档案 · '+h(publication.format||'文章'):h(r?.category||p?.category||'原创漫画');
    const desc=publication?'发表于 '+h(publication.publishedAt||'')+' · '+h(publication.format||'公众号内容')+
       (publication.task_id?' · 漫画工单待核对':''):h(p?.subtitle||(r?.status==='blocked'?'制作进度需复核':p?.description||''));
    return '<article class="wt3-book"><a href="'+href+'"'+(published||publication||(!p&&tid)?' target="_blank" rel="noopener noreferrer"':'')+' class="wt3-cover" aria-label="'+name+'">'+src+'</a>'+
     '<div class="wt3-book-info"><small>'+meta+(series?' · '+series:'')+(episode?' · 第'+episode+'章':'')+'</small><h3>'+name+'</h3>'+
     '<p>'+desc+'</p>'+
     '<span>'+h(state)+(publication?' · '+h(publication.format||'公众号内容'):r?.panel_count?' · '+r.panel_count+'格':p?.panels?.length?' · '+p.panels.length+'格':'')+'</span></div></article>';
   }).join('');
   queueMicrotask(()=>{if(ui.route!=='library')return;
     document.querySelectorAll('.wt3-shelf .wt3-cover img').forEach(img=>{
       img.addEventListener('error',()=>img.remove(),{once:true});
     });
     document.querySelectorAll('.wt3-shelf img[data-wt3-media]').forEach(async img=>{
       try{const url=await resolveImage('media:'+img.dataset.wt3Media);
         if(url&&img.isConnected)img.src=url;
       }catch{img.alt='本地封面暂不可用'}});
   });
   return '<div class="wt3-shelf">'+heroHeader('WORLD/TOON / COMIC LIBRARY','漫画书架','已发表内容与公众号发表档案同源；正式漫画仍经 GitHub 验收与 WorkBuddy 回执核对。','<button type="button" class="button dark" data-action="new">＋ 新作</button><button type="button" class="button" data-archive="refresh">⟳ 同步书架</button>')+
    '<div class="wt3-shelf-meta">GitHub 真实归档：'+(wtArchiveSnapshot?rows.length+' 部':'尚未同步')+
    ' · 公众号共享发表档案：'+(sharedArchive()?.status==='synced'?sharedRows().length+' 篇':'尚未同步')+
    ' · 仅核验漫画才标记为漫画成品'+(wtArchiveError?'<p class="wt3-error">私有仓库同步：'+h(wtArchiveError)+'</p>':'')+'</div>'+
    '<div class="toolbar"><div class="tabbar wt3-tabs">'+tabs+'</div><input class="search" id="librarySearch" value="'+h(ui.search||'')+'" placeholder="搜索漫画、系列或题材" aria-label="搜索漫画"></div>'+
    (cat==='已发表'&&sharedRows().length?'<p class="wt3-shelf-note">公众号已发表文章和贴图来自共享发表档案；只有通过 GitHub 验收与回执核对的作品才标记为正式漫画。</p>':'')+
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
  data.projects.unshift(v);ui.selected=v.id;persist();nav('director/'+v.id);
  notify('新续章已创建；人物画风作为参考锁定，仍须作者审阅新剧情');
 }
 const originalStudio=studio;
 studio=function(){
  const p=selected(),base=originalStudio();if(!p)return base;
  const locked=!!p.handoff?.repoQueuedAt,agent=p.productionAgent||'ChatGPT',count=p.panels?.length||9;
  const setting='<section class="box wt3-work-panel"><div class="kicker">WORLD/TOON 3.0 / STORY ENGINE</div><h2>一条创意，开启一部漫画</h2>'+
   '<p class="minor">编剧 → 创意导演台 → 生产 Agent → 交付验收 → 作品书架。真实 DeepSeek 模型仅在确认付费调用且服务端密钥可用时运行。</p>'+
   '<div class="wt3-controls"><div class="field wt3-seed"><label>一句话构思</label><textarea id="wt3-seed" rows="2" placeholder="例如：一个古代县令穿越到 AI 时代，发现机器人更会断案">'+h(p.ideaSeed||'')+'</textarea></div>'+
   '<div class="field"><label>制作 Agent</label><select id="wt3-agent" '+(locked?'disabled':'')+'><option value="ChatGPT"'+(agent==='ChatGPT'?' selected':'')+'>ChatGPT 创作 · WorkBuddy 发表</option><option value="WorkBuddy"'+(agent==='WorkBuddy'?' selected':'')+'>WorkBuddy 创作与发表</option></select></div>'+
   '<div class="field"><label>漫画篇幅 · 4–60 格</label><input id="wt3-count" type="number" min="4" max="60" value="'+count+'" '+(locked?'disabled':'')+'></div></div>'+
   '<div class="buttons"><button type="button" class="button dark" data-wt3-action="expand">DeepSeek 扩写并推荐篇幅</button>'+
   '<button type="button" class="button" data-wt3-action="resize" '+(locked?'disabled':'')+'>应用篇幅</button>'+
   '<button type="button" class="button" data-wt3-action="director">进入创意导演台</button></div>'+
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
   if(op==='resize'){resize(p,document.querySelector('#wt3-count')?.value);return}
   if(op==='series-new'){seriesNew(p);return}
   if(op==='series-next'){seriesContinue(p);return}
   if(op==='director'){nav('director/'+p.id);return}
   if(op==='expand'){
     if(p.handoff?.repoQueuedAt)throw Error('已派单作品不能被AI覆盖');
     const idea=document.querySelector('#wt3-seed')?.value?.trim()||'';
     if(idea.length<8||idea.length>1800)throw Error('请输入8–1800字的漫画构思');
     if(!confirm('将调用真实 DeepSeek API 生成可编辑编剧草稿。可能产生按 Token 计费的费用；确认本次请求吗？'))return;
     b.disabled=true;b.textContent='正在生成剧本…';p.ideaSeed=idea;setChange(p,'作者发起 DeepSeek 剧本扩写');
     const response=await wtArchiveApi('deepseek-expand',{method:'POST',body:JSON.stringify({idea,title:p.title,category:p.category,
       panel_count:p.panels.length,series_bible:p.seriesBible||null,previous_summary:p.seriesEpisode>1?p.description:''})});
     const x=response.story;if(!x||!Array.isArray(x.panels)||x.panels.length<4||x.panels.length>60)throw Error('DeepSeek 未返回完整的分镜结构');
     if(p.handoff?.repoQueuedAt)throw Error('该作品已经派单，拒绝覆盖');
     p.title=String(x.title||p.title).slice(0,180);p.subtitle=String(x.subtitle||'').slice(0,240);
     p.description=String(x.summary||p.description).slice(0,4000);
     p.fiction=String(x.fictionalization||'原创架空故事，情节和对白均属虚构').slice(0,1600);
     p.panels=x.panels.map((a,i)=>({id:uid(),title:String(a.title||'第'+(i+1)+'格').slice(0,100),
       scene:String(a.scene||'').slice(0,1700),caption:String(a.caption||'').slice(0,550),
       dialogue:String(a.dialogue||'').slice(0,550),prompt:String(a.visual_prompt||'').slice(0,1200),image:''}));
     const c=wtDirector.ensure(p);c.drafted=true;c.reviewed=false;c.approval=null;
     if(x.world)c.world=String(x.world).slice(0,600);
     if(x.theme)c.thesis=String(x.theme).slice(0,600);
     if(Array.isArray(x.characters)&&x.characters.length>=2)c.cast=x.characters.slice(0,12).map(v=>({
       role:String(v.role||'主要角色'),name:String(v.name||'待命名'),look:String(v.look||'').slice(0,450),
       clothes:String(v.clothes||'').slice(0,450),symbol:String(v.symbol||'').slice(0,200),nature:String(v.nature||'').slice(0,450)}));
     c.storyboardProvenance={method:'verified_model_response',provider:'deepseek',model:response.model||'deepseek-flash',
       at:now(),author_reviewed:false,analysis:String(x.reasoning||'').slice(0,600)};
     p.characters=wtDirector.castText(c);setChange(p,'DeepSeek 正式 API 返回可编辑的 '+p.panels.length+'格漫画剧本');
     nav('director/'+p.id);notify('DeepSeek 结构化剧本已生成；请在导演台逐格审阅和锁定');
   }
  }catch(error){notify('操作未完成：'+String(error.message||error).slice(0,130))}
  finally{if(document.contains(b)){b.disabled=false;if(b.dataset.wt3Action==='expand')b.textContent='DeepSeek 扩写并推荐篇幅'}}
 },true);
 document.addEventListener('change',ev=>{
  if(ev.target?.id==='wt3-agent'){const p=selected();if(p&&!p.handoff?.repoQueuedAt){p.productionAgent=ev.target.value==='WorkBuddy'?'WorkBuddy':'ChatGPT';setChange(p,'切换 SOP 生产者：'+p.productionAgent);render()}}
  if(ev.target?.id==='wt3-seed'){const p=selected();if(p&&!p.handoff?.repoQueuedAt){p.ideaSeed=ev.target.value.slice(0,1800);setChange(p,'保存漫画一句话构思')}}
 },true);
 window.WT3={kind,resize,shelf,seriesNew,seriesContinue};
 library=shelf;
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/library')&&Date.now()-wtArchiveLastSync>60000&&!wtArchiveBusy)void wtArchiveRefresh({silent:true})});
 queueMicrotask(()=>{if(location.hash.startsWith('#/library'))void wtArchiveRefresh({silent:true})});
})();