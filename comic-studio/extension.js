/* WORLD/TOON 2.0 — Live news, character bible, AI-assisted creation, private sync.
 * No hidden generation or publication. AI generation is explicitly user initiated.
 */
'use strict';
let wtSource='all',wtSourceCounts=[],wtCategory='全部',wtQuery='',wtNews=[],wtLastFetch=0,wtFetching=false,wtNewsError='',wtAiBusy=false,wtCatalogRequested=false,wtVisibleCount=12,wtCatalogLocal=false,wtInitRetries=0;
let wtRankSort='overall',wtRankFocus='all',wtRankMin=60;
let wtConfig=null,wtSession=null,wtSyncTimer=null,wtCloudBusy=false,wtSyncedAt='',wtCloudError='',wtStatus='未登录';
let wtSelectedCharacter='',wtPreviewImage='',wtRemoteRev=null;
const wtCategories=['全部','国际政治','文化','娱乐','体育','人物','旅行','AI 科技','经典故事','历史脑洞','科技社区','机器人','商业财经','科学','环境','健康','航空航天'];
const wtJson=async(res)=>{const body=await res.json().catch(()=>({error:'服务器响应无法解析'}));if(!res.ok)throw Error(body.error||body.message||`请求失败 ${res.status}`);return body;};
const wtTime=v=>{try{return new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};

const wtNewsSymbols={'国际政治':'WORLD','文化':'CULTURE','娱乐':'CINEMA','体育':'SPORT','人物':'PEOPLE','旅行':'TRAVEL','AI 科技':'A.I.','经典故事':'BOOK','历史脑洞':'HISTORY','科技社区':'DEV','机器人':'ROBOT','商业财经':'MARKET','科学':'SCIENCE','环境':'EARTH','健康':'HEALTH','航空航天':'SPACE'};
function wtNewsPicture(n,i){
 const image=safeURL(n.image||''),kind=wtNewsSymbols[n.category]||'WORLD';
 return '<div class="wt-news-media '+(image?'has-photo':'is-fallback')+'">'+
  (image?'<img data-wt-news-image src="'+e(image)+'" alt="'+e(n.title)+'的新闻来源配图" loading="'+(i<3?'eager':'lazy')+'" decoding="async" referrerpolicy="no-referrer">':'')+
  '<div class="wt-news-fallback"><span class="wt-news-fallback-index">WORLD / TOON · '+(n.evergreen?'LIBRARY':'NEWSWIRE')+'</span><strong>'+e(kind)+'</strong><span>'+e(n.category||'全球热点')+' · '+(n.evergreen?'在创作台匹配视觉素材':'无可用来源图片')+'</span></div>'+
  (image?'<span class="wt-news-image-label">来源媒体配图 · 请核对</span>':'')+'</div>';
}
function wtRankControlOptions(){
 const sorts=[['overall','综合评分 ↓'],['heat','热度 ↓'],['impact','影响力 ↓'],['drawability','可画性 ↓'],['conflict','冲突/反转 ↓'],['novelty','新奇 ↓'],['credibility','来源追溯 ↓'],['latest','最新发布']];
 const filters=[['all','全部达标'],['heat70','热度 ≥70'],['heat80','热度 ≥80'],['impact70','影响力 ≥70'],['impact80','影响力 ≥80'],['drawability70','可画性 ≥70'],['drawability80','可画性 ≥80'],['conflict70','冲突 ≥70'],['conflict80','冲突 ≥80'],['novelty70','新奇 ≥70'],['credibility70','追溯 ≥70']];
 const option=(entries,value)=>entries.map(([k,label])=>'<option value="'+k+'"'+(k===value?' selected':'')+'>'+label+'</option>').join('');
 return '<label>排序<select id="wtRankSort" aria-label="按评分维度排序">'+option(sorts,wtRankSort)+'</select></label>'+
        '<label>优先维度<select id="wtRankFocus" aria-label="按评价维度筛选">'+option(filters,wtRankFocus)+'</select></label>'+
        '<label>综合门槛<select id="wtRankMin" aria-label="最低综合评分">'+option([['60','≥60 分'],['70','≥70 分'],['80','≥80 分'],['90','≥90 分']],String(wtRankMin))+'</select></label>';
}
function wtRankBadge(item){
 const r=item._rating||wtEditorialRank.evaluate(item);
 return '<div class="wt-rankline" aria-label="'+e(wtEditorialRank.format(r))+'">'+
 '<div class="wt-rankprimary"><span>综合</span><strong>'+r.overall+'</strong><small>/100</small></div>'+
 '<div><span>热度</span><b>'+r.heat+'</b></div>'+
 '<div><span>影响力</span><b>'+r.impact+'</b></div>'+
 '<div><span>可画性</span><b>'+r.drawability+'</b></div>'+ 
 '<div><span>冲突</span><b>'+r.conflict+'</b></div><div><span>新奇</span><b>'+r.novelty+'</b></div><div><span>追溯</span><b>'+r.credibility+'</b></div></div>';
}
function wtLive(){
 if(!wtCatalogRequested&&!wtFetching){wtCatalogRequested=true;setTimeout(()=>wtFetchNews(),0)}
 const base=wtNews.map((n,i)=>({...n,_sourceIndex:i}));
 const pool=base.filter(n=>wtSource==='all'||n.cache_source===wtSource);
 const categories=new Map();for(const x of pool)categories.set(x.category,(categories.get(x.category)||0)+1);
 const filtered=pool.filter(n=>wtCategory==='全部'||n.category===wtCategory);
 const judged=wtEditorialRank.decorate(filtered);
 const result=wtEditorialRank.select(judged,{sort:wtRankSort,focus:wtRankFocus,minimum:wtRankMin,query:wtQuery});
 const allMatched=result.items,items=allMatched.slice(0,wtVisibleCount);
 const sourceDefs=[['all','综合精选'],['news','全球热点'],['hackernews','科技社区'],['arxiv','AI 前沿'],['classics','经典故事'],['history','历史故事']];
 const total=wtSourceCounts.reduce((n,x)=>n+Number(x.count||0),0);
 const count=id=>id==='all'?total:Number(wtSourceCounts.find(x=>x.id===id)?.count||0);
 const sourceTabs=sourceDefs.map(([id,label])=>'<button type="button" class="'+(wtSource===id?'active':'')+'" data-wt="source" data-value="'+id+'"><strong>'+label+'</strong><span>'+(wtSourceCounts.length?(count(id)?count(id)+' 条':'待更新'):'—')+'</span></button>').join('');
 const filters=['全部',...wtCategories.filter(c=>categories.has(c))].map(c=>'<button type="button" class="'+(c===wtCategory?'active':'')+'" data-wt="category" data-value="'+e(c)+'">'+e(c)+(c==='全部'?'':' · '+categories.get(c))+'</button>').join('');
 const cacheTime=wtLastFetch?wtTime(wtLastFetch):'尚未建立缓存';
 const freshness=wtSourceCounts.filter(x=>x.ready).map(x=>Date.parse(x.collectedAt||0)).filter(Number.isFinite);
 const lastSourceUpdate=freshness.length?wtTime(Math.max(...freshness)):'尚无素材';
 const unavailable=wtSourceCounts.filter(x=>!x.ready).map(x=>x.id).join('、');
 const sourceStatus=wtSourceCounts.length?'后台最近更新 '+lastSourceUpdate+(unavailable?' · 待初始化 '+unavailable:''):'等待首次后台采集';
 const brief=wtSource==='all'?'跨新闻、科技、文学与历史的统一素材池':'当前阅读 '+sourceDefs.find(x=>x[0]===wtSource)?.[1];
 const top=wtSource==='all'&&wtCategory==='全部'&&!wtQuery&&allMatched.length
  ?'<section class="wt-featured"><div class="wt-featured-head"><strong>今日值得画</strong><span>来自已缓存素材 · 规则评分推荐</span></div><div class="wt-featured-grid">'+allMatched.slice(0,3).map((n,i)=>
   '<article class="wt-featured-card"><span class="wt-featured-rank">0'+(i+1)+' · '+e(n.category)+' · '+n._rating.overall+'分</span><strong>'+e(n.title)+'</strong><button type="button" data-wt="create-news" data-index="'+n._sourceIndex+'">制作漫画草稿 ↗</button></article>').join('')+'</div></section>':'';
 const cards=items.map((n,i)=>'<article class="wt-news-card">'+wtNewsPicture(n,i)+
  '<div class="wt-news-card-body"><div class="wt-status"><span class="wt-chip">'+e(n.category)+'</span><span class="wt-chip wt-unverified">待核验</span>'+
  '<span class="wt-chip">'+(n.evergreen?'经典常青':e(n.published?wtTime(n.published):'日期待核实'))+'</span></div>'+
  '<h3>'+e(n.title)+'</h3>'+(n.summary?'<p class="wt-news-summary">'+e(n.summary)+'</p>':'')+
  '<p class="minor wt-news-source">'+e(n.source||'原始来源待确认')+'</p>'+
  '<div class="wt-catalog-score">综合预评分 <strong>'+n._rating.overall+'</strong><span>/100 · '+e(n._rating.method==='evergreen_rule_estimate'?'长期故事价值':'新闻选题价值')+'</span></div>'+
  '<div class="buttons"><a href="'+e(safeURL(n.url))+'" target="_blank" rel="noopener noreferrer" class="button">核对原始来源</a>'+
  '<button type="button" class="button dark" data-wt="create-news" data-index="'+n._sourceIndex+'">创作漫画</button>'+
  '<button type="button" class="button" data-wt="save-news" data-index="'+n._sourceIndex+'">收藏选题</button></div></div></article>').join('');
 const isEmpty=!wtNews.length;
 const message=wtFetching&&isEmpty?'正在读取后台素材缓存…':isEmpty?'后台素材库尚未初始化。请查看最近更新时间，稍后重新读取；不会因点击分类而现场采集。':
  '当前分类没有达到所选评分与关键词条件的素材。试试清空搜索或切换其他已缓存来源。';
 const empty='<div class="box wt-rank-empty"><h3>'+(isEmpty?'素材库正在准备':'暂无匹配的漫画素材')+'</h3><p>'+message+'</p>'+
 '<div class="buttons"><button type="button" class="button" data-wt="clear-filters">恢复全部筛选</button><button type="button" class="button" data-wt="reload-cache">重新读取缓存</button></div></div>';
 return heroHeader('DISCOVERY / BY DAVYLAB','素材发现','打开即读 · 后台更新 · 经典故事、全球热点与 AI 研究统一筛选。选题均需事实及版权核验。')+
 '<section class="wt-source-panel wt-catalog-sources"><div class="wt-source-head"><strong>探索故事</strong><span>'+e(sourceStatus)+'</span></div><div class="wt-source-tabs">'+sourceTabs+'</div>'+
 '<p class="minor">'+e(brief)+' · 分类切换不重新集采'+(wtCatalogLocal?' · 当前为本机上次成功缓存':'')+'</p></section>'+
 top+
 '<section class="box wt-catalog-toolbar"><div class="wt-catalog-search"><label class="wt-catalog-query">搜索素材<input id="wtSearch" type="search" placeholder="标题、作者、人物、历史事件…" value="'+e(wtQuery)+'"></label>'+
 '<button type="button" class="button" data-wt="reload-cache">⟳ 更新列表</button></div>'+
 '<div class="wt-filters wt-catalog-filters">'+filters+'</div>'+
 '<details class="wt-catalog-advanced"><summary>排序和高级筛选 <span>综合评分不低于60分</span></summary><div class="wt-rank-controls">'+wtRankControlOptions()+'</div></details>'+
 '<div class="wt-rank-summary"><strong>'+allMatched.length+'</strong> 条匹配 · 本地缓存 '+pool.length+' 条 · '+e(sourceStatus)+'</div>'+
 (wtNewsError?'<p class="wt-error">'+e(wtNewsError)+'</p>':'')+'</section>'+
 '<section class="wt-catalog-results"><div class="wt-catalog-heading"><h2>漫画选题</h2><span>六维规则预评估 · 未经事实核验</span></div>'+
 '<div class="wt-news">'+(cards||empty)+'</div>'+
 (allMatched.length>items.length?'<div class="wt-catalog-more"><button type="button" class="button" data-wt="more">查看更多 · 尚有 '+(allMatched.length-items.length)+' 条</button></div>':'')+'</section>';
}
document.addEventListener('error',ev=>{const img=ev.target;if(!img?.matches?.('img[data-wt-news-image]'))return;const box=img.closest('.wt-news-media');if(box){box.classList.remove('has-photo');box.classList.add('is-fallback');img.remove()}},true);
function wtCharacters(){const cards=(data.characters||[]).map(c=>'<article class="wt-character">'+(c.portrait?'<img src="'+e(c.portrait)+'" alt="'+e(c.name)+'的原创定妆照" style="display:block;width:100%;height:190px;object-fit:cover;border-radius:10px;margin-bottom:13px">':'<div style="min-height:110px;background:#e7e9df;border-radius:9px;display:grid;place-items:center;color:#66736b;margin-bottom:13px">NO REFERENCE PORTRAIT</div>')+'<span class="wt-chip">'+e(c.type||'虚构角色')+'</span><h3>'+e(c.name)+'</h3><p>'+e(c.description||'未填写角色外形')+'</p><p class="minor">服饰：'+e(c.costume||'待设定')+' · 配色：'+e(c.colors||'待设定')+'</p><p class="minor">固定识别特征：'+e(c.traits||'待设定')+'</p><div class="buttons"><label class="button" style="cursor:pointer">上传定妆照<input type="file" accept="image/png,image/jpeg,image/webp" data-wt-character-image="'+e(c.id)+'" hidden></label><button class="button" data-wt="char-edit" data-id="'+e(c.id)+'">编辑档案</button><button class="button" data-wt="char-prompt" data-id="'+e(c.id)+'">复制参考提示</button><button class="button" data-wt="char-delete" data-id="'+e(c.id)+'">移除</button></div></article>').join('');return heroHeader('06 / THE CAST','角色一致性档案','记录原创角色的外貌、服饰与性格，为角色上传定妆照以提高跨格一致性。','<button class="button dark" data-wt="char-new">＋ 新建角色档案</button>')+'<div class="wt-ai"><strong>定妆照与参考图</strong><p>一位角色一张固定视觉参考；单次生成可引用多位角色的图片与第 1 格画风图。只能上传有权使用的原创或授权素材，不得借此模拟真实人士的私人行为。</p></div><div class="wt-grid">'+(cards||'<div class="box">角色档案尚为空，添加第一位原创虚构角色。</div>')+'</div>';}
function wtAccount(){const heading=heroHeader('ACCOUNT / PRIVATE CLOUD','登录与多端同步','邮箱账户 · 私有作品与图片存储 · 冲突保护 · 本地优先。未登录不会上传作品。');const foot='<section class="box"><h2>数据与备份</h2><p>本地草稿保存在当前浏览器；登录后可以手动或在编辑时同步至私有云端。请在大改前导出完整 ZIP 备份。</p><a href="#/settings" class="button">前往数据管理 ↗</a></section>';if(wtSession?.access_token){return heading+'<section class="box"><div class="kicker">PRIVATE CLOUD / SIGNED IN</div><h2>'+e(wtSession.user?.email||'已登录')+'</h2><p class="wt-note">'+e(wtStatus)+(wtRemoteRev===null?' · 尚未建立云端版本基线':' · 云端修订 '+wtRemoteRev)+(wtSyncedAt?' · 最近同步 '+e(wtSyncedAt):'')+'</p>'+(wtCloudError?'<p class="wt-error">'+e(wtCloudError)+'</p>':'')+'<div class="buttons"><button class="button dark" data-wt="sync-pull">从云端恢复到本机</button><button class="button" data-wt="sync-push">将本机备份至云端</button><button class="button" data-wt="signout">退出登录</button></div><p class="wt-note">新设备请先从云端恢复。同步采用版本冲突保护，避免不同设备静默覆盖。云端图像只能由所属用户读取。</p></section>'+foot;}return heading+'<section class="box"><div class="kicker">SECURE SIGN IN</div><h2>登录你的私人漫画工作室</h2><form id="wtLogin" autocomplete="on"><div class="fields"><div class="field"><label for="wtEmail">邮箱地址</label><input id="wtEmail" type="email" name="email" autocomplete="email" required placeholder="you@example.com"></div><div class="field"><label for="wtPassword">账户密码</label><input id="wtPassword" type="password" name="password" autocomplete="current-password" minlength="8" required placeholder="至少 8 位"></div></div><div class="buttons" style="margin-top:18px"><button class="button dark" type="submit" name="mode" value="login">登录</button><button class="button" type="submit" name="mode" value="signup">注册账户</button></div></form><p class="wt-note">仅主动注册、登录时发送邮箱密码到 Supabase Auth。新账户可能需要邮件确认；未登录期间不会上传本机作品。</p>'+(wtCloudError?'<p class="wt-error">'+e(wtCloudError)+'</p>':'')+'<p class="minor">'+e(wtStatus)+'</p></section>'+foot;}
function wtCharModal(c){modal(`<div class="kicker">CHARACTER BIBLE / BY DAVYLAB</div><h2>${c?'编辑':'创建'}原创角色</h2><form id="wtCharacterForm" data-id="${e(c?.id||'')}"><div class="fields"><div class="field"><label>角色名称</label><input name="name" maxlength="80" required value="${e(c?.name||'')}"></div><div class="field"><label>类型</label><select name="type"><option>虚构角色</option><option>拟人化角色</option><option>抽象象征</option></select></div><div class="field wide"><label>外形及发型</label><textarea name="description" maxlength="1800">${e(c?.description||'')}</textarea></div><div class="field"><label>固定服饰</label><input name="costume" value="${e(c?.costume||'')}"></div><div class="field"><label>代表色彩</label><input name="colors" value="${e(c?.colors||'')}"></div><div class="field wide"><label>不可改变的识别特征</label><textarea name="traits">${e(c?.traits||'')}</textarea></div><div class="field wide"><label>人物背景与性格</label><textarea name="personality">${e(c?.personality||'')}</textarea></div></div><div class="stepactions"><button class="button" type="button" data-action="modal-close">取消</button><button class="button dark">保存角色</button></div></form>`);}
function wtCharBible(){return (data.characters||[]).map(c=>`${c.name}: ${c.description}; 固定服饰 ${c.costume}; 色彩 ${c.colors}; 识别特征 ${c.traits}; 性格 ${c.personality}`).join('\n')||'纯原创虚构角色，无现实名人肖像';}
function wtStudioAI(){const p=selected();if(!p)return '';const ready=!!wtConfig?.aiEnabled&&!!wtSession?.access_token;const disabled=ready&&!wtAiBusy?'':' disabled';const status=!wtConfig?.aiEnabled?'AI 模型费用尚未获批，暂未开启自动生成':!wtSession?.access_token?'请先登录账户，才可以调用模型':'角色档案与首格定妆照将帮助保持画风一致';return '<section class="box" style="margin-top:12px;margin-bottom:16px"><div class="kicker">AI WRITER & ART DIRECTOR</div><h2>AI 编剧与画面生成 <span class="wt-chip">'+(ready?'已连接':'待启用')+'</span></h2><p class="wt-note">'+e(status)+'。自动编剧生成九格文字初稿；绘图仅生成第 '+(ui.panel+1)+' 格。所有作品仍需人工核验事实和图片。</p><div class="buttons"><button class="button dark" data-wt="ai-script"'+disabled+'>✦ AI 九格编剧</button><button class="button" data-wt="ai-image"'+disabled+'>生成当前画格</button><button class="button" data-wt="ai-image-ref"'+disabled+'>参考首格生图</button><a class="button" href="#/characters">角色档案 ↗</a><a class="button" href="#/account">登录与同步 ↗</a></div></section>';}
const wtOriginalStudio=studio;studio=function(){return (typeof wfHint==='function'?wfHint():'')+wtOriginalStudio()};
function wtRestoreCatalog(){
 try{
  const saved=JSON.parse(localStorage.getItem('worldtoon_catalog_cache_v2')||'null');
  if(saved&&Array.isArray(saved.items)&&saved.items.length&&Date.now()-saved.savedAt<7*24*3600000){
   wtNews=saved.items;wtSourceCounts=saved.stats||[];wtLastFetch=saved.lastUpdated||saved.savedAt;wtCatalogLocal=true;
  }
 }catch{}
}
async function wtFetchNews(){
 if(wtFetching)return;wtFetching=true;wtCatalogRequested=true;wtNewsError='';render();
 try{
  const result=await wtJson(await fetch('/api/comic/catalog?source=all&limit=250',{cache:'no-store'}));
  wtSourceCounts=result.stats||[];
  if(Array.isArray(result.items)&&result.items.length){
   wtNews=result.items;wtLastFetch=result.lastUpdated||Date.now();wtCatalogLocal=false;
   try{localStorage.setItem('worldtoon_catalog_cache_v2',JSON.stringify({items:wtNews,stats:wtSourceCounts,lastUpdated:wtLastFetch,savedAt:Date.now()}))}catch{}
  }else if(!wtNews.length){wtNews=[];wtNewsError='后台素材库首次预热中，缓存创建后会自动显示；没有现场采集或伪造素材。';}
  if(wtNews.length)wtInitRetries=0;
  if((result.warnings||[]).length)wtNewsError=(result.warnings||[]).join('；');
 }catch(err){wtNewsError='云端缓存暂不可用：'+err.message+(wtNews.length?' · 已恢复本机上次保存的素材':'');wtCatalogLocal=!!wtNews.length}
 finally{
  wtFetching=false;render();
  if(!wtNews.length&&wtInitRetries<8){
   wtInitRetries++;
   setTimeout(()=>{if(location.hash.startsWith('#/live')&&!wtFetching)wtFetchNews()},8000);
  }
 }
}
async function wtSaveNews(i){let x=wtNews[Number(i)];if(!x)return;let found=data.topics.find(z=>z.source===x.url);if(found){notify('这条原始来源已在选题池');return;}const eventRaw=x.eventDate||x.occurrence_date||x.occurredAt||'';const date=String(eventRaw||x.published||'').slice(0,10);let t={id:uid(),title:x.title,category:x.category,summary:`原始来源：${x.source}。${x.evergreen?'经典/历史线索待核验，请检查权利与史料':'新闻线索尚未完成事实核验，请阅读全文后改编'}。`,source:x.url,evergreen:x.evergreen===true,rightsStatus:x.rights_status||'unknown',sourceId:x.source_id||'',eventDate:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'',eventDateBasis:eventRaw?'source_event':'published_candidate',heat:Math.max(1,Math.round(wtEditorialRank.evaluate(x).heat/20)),impact:Math.max(1,Math.round(wtEditorialRank.evaluate(x).impact/20)),story:Math.max(1,Math.round(wtEditorialRank.evaluate(x).drawability/20)),ranking:wtEditorialRank.evaluate(x),stage:'待核验',createdAt:now(),publishedAt:x.published,sourceName:x.source,newsImage:x.image||'',verified:false};data.topics.unshift(t);persist();notify('已加入选题池，待核验后创作');}

async function wtDraftFromNews(i){
 const x=wtNews[Number(i)];if(!x)return;
 await wtSaveNews(i);
 const t=data.topics.find(z=>z.source===x.url);if(!t)throw Error('选题尚未保存');
 const existing=data.projects.find(z=>!z.deleted&&z.topicId===t.id);
 if(existing){ui.selected=existing.id;nav('studio/'+existing.id+'/0');notify('已打开这条选题的现有漫画草稿');return}
 const p=emptyProject(t);
 p.factNotes='【待核验】来自 '+(x.source||'未知来源')+' 的新闻或研究线索；请先核对原文、事件日期及事实边界。';
 p.fiction='原创架空角色及情节，不复现或指控现实人物。';
 p.sourceURLs=x.url;p.sourceTitle=x.title;p.status='草稿';p.evergreen=x.evergreen===true;p.sourceId=x.source_id||'';p.rightsStatus=x.rights_status||'unknown';
 data.projects.unshift(p);ui.selected=p.id;persist();
 nav('studio/'+p.id+'/0');notify('已创建未核验漫画草稿，可运行四 Skill 分镜制作');
}

async function wtLoadConfig(){try{wtConfig=await wtJson(await fetch('/api/config',{cache:'no-store'}));return wtConfig}catch(err){wtCloudError=err.message;return null}}
async function wtAuthFetch(path,opts={}){if(!wtConfig)await wtLoadConfig();if(!wtConfig?.supabaseUrl||!wtConfig?.supabaseKey)throw Error('云端账户尚未配置');let url=wtConfig.supabaseUrl+path;const headers={'apikey':wtConfig.supabaseKey,...opts.headers};if(wtSession?.access_token)headers.Authorization='Bearer '+wtSession.access_token;return fetch(url,{...opts,headers});}
function wtSaveSession(){if(wtSession){localStorage.setItem('worldtoon_auth_session',JSON.stringify(wtSession))}else localStorage.removeItem('worldtoon_auth_session')}
async function wtRefreshSession(){if(!wtSession?.refresh_token)return false;const r=await wtAuthFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refresh_token:wtSession.refresh_token})});if(!r.ok){wtSession=null;wtSaveSession();return false}wtSession=await r.json();wtSession.expires_at=wtSession.expires_at||Math.floor(Date.now()/1000)+Number(wtSession.expires_in||3600);wtSaveSession();return true;}
async function wtEnsureToken(){if(!wtSession?.access_token)throw Error('请先登录账户');if(wtSession.expires_at&&wtSession.expires_at*1000<Date.now()+120000)await wtRefreshSession();if(!wtSession?.access_token)throw Error('登录已过期，请重新登录');return wtSession.access_token;}
async function wtAuthForm(form,mode){let email=form.elements.email.value.trim(),password=form.elements.password.value;wtStatus='认证中';wtCloudError='';render();try{let path=mode==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';let out=await wtJson(await wtAuthFetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}));if(!out.access_token){wtStatus='注册申请已提交，请查收确认邮件后登录';return;}out.expires_at=out.expires_at||Math.floor(Date.now()/1000)+Number(out.expires_in||3600);wtSession=out;wtSaveSession();wtStatus='已登录';notify('账户登录成功');}catch(err){wtCloudError=err.message;wtStatus='认证失败'}finally{render()}}
async function wtCloudRequest(path,opts={}){let token=await wtEnsureToken();let response=await wtAuthFetch(path,{...opts,headers:{...opts.headers,Authorization:'Bearer '+token}});if(response.status===401){await wtRefreshSession();response=await wtAuthFetch(path,{...opts,headers:{...opts.headers,Authorization:'Bearer '+wtSession?.access_token}})}return response;}
function wtCloudDoc(){return {...data,version:3,characters:data.characters||[]}}
async function wtPush(force=false){if(wtCloudBusy)return;wtCloudBusy=true;wtCloudError='';wtStatus='正在同步';render();try{await wtEnsureToken();const id=wtSession.user.id;const existing=await wtJson(await wtCloudRequest('/rest/v1/worldtoon_workspaces?select=revision&user_id=eq.'+encodeURIComponent(id),{headers:{Accept:'application/json'}}));const prior=Number(existing?.[0]?.revision)||0;if(prior&&!force&&(wtRemoteRev===null||wtRemoteRev!==prior))throw Error('云端已有较新版本或此设备尚未拉取，请先备份本机并检查云端，避免覆盖。');await wtUploadImages();const payload=wtCloudDoc();const revision=prior+1;let path,method,headers={'Content-Type':'application/json',Prefer:'return=representation'},body;if(prior){path='/rest/v1/worldtoon_workspaces?user_id=eq.'+encodeURIComponent(id)+'&revision=eq.'+prior+'&select=revision';method='PATCH';body={payload,revision,updated_at:new Date().toISOString()};}else{path='/rest/v1/worldtoon_workspaces?on_conflict=user_id&select=revision';method='POST';headers.Prefer='resolution=ignore-duplicates,return=representation';body={user_id:id,payload,revision,updated_at:new Date().toISOString()};}const result=await wtJson(await wtCloudRequest(path,{method,headers,body:JSON.stringify(body)}));if(!Array.isArray(result)||result.length!==1||Number(result[0].revision)!==revision)throw Error('检测到另一设备同时编辑，未覆盖云端资料；请备份本机并先拉取最新版本。');wtRemoteRev=revision;wtSyncedAt=new Date().toLocaleString('zh-CN');wtStatus='已同步';}catch(err){wtCloudError=err.message;wtStatus='同步失败';}finally{wtCloudBusy=false;render();}}
async function wtUploadImages(){if(!wtSession)return;let seen=new Set();for(let p of [...data.projects,{panels:(data.characters||[]).map(c=>({image:c.portrait})),cover:''}]){for(let src of [...p.panels.map(a=>a.image),p.cover]){if(!src?.startsWith('media:')||seen.has(src))continue;seen.add(src);let key=src.slice(6);let blob=await getMedia(key);if(!blob)continue;let resp=await wtCloudRequest('/storage/v1/object/worldtoon-private/'+encodeURIComponent(wtSession.user.id)+'/'+encodeURIComponent(key),{method:'POST',headers:{'content-type':blob.type||'image/png','x-upsert':'true'},body:blob});if(!resp.ok)throw Error('第 '+seen.size+' 张图片云端备份失败：'+resp.status);}}}
async function wtDownloadMedia(key){if(!wtSession)return null;try{let r=await wtCloudRequest('/storage/v1/object/authenticated/worldtoon-private/'+encodeURIComponent(wtSession.user.id)+'/'+encodeURIComponent(key));return r.ok?await r.blob():null}catch{return null}}
async function wtPull(){if(wtCloudBusy)return;wtCloudBusy=true;wtCloudError='';wtStatus='正在拉取';render();try{await wtEnsureToken();let list=await wtJson(await wtCloudRequest('/rest/v1/worldtoon_workspaces?select=payload,updated_at,revision&user_id=eq.'+encodeURIComponent(wtSession.user.id),{headers:{Accept:'application/json'}}));if(!list?.length){wtStatus='云端为空；可上传本机资料';return}let remote=list[0].payload;if(!Array.isArray(remote.projects)||!Array.isArray(remote.topics))throw Error('云端数据格式不正确');let localHasEdits=JSON.stringify(remote)!==JSON.stringify(data);if(localHasEdits&&!confirm('云端资料将覆盖当前本机工作区。请先导出完整 ZIP 备份。确认拉取吗？')){wtStatus='已取消拉取';return;}data={...remote,characters:remote.characters||[]};wtRemoteRev=list[0].revision;persist();ui.selected=data.projects[0]?.id||'';wtSyncedAt=new Date().toLocaleString('zh-CN');wtStatus='已拉取';notify('云端工作区已恢复');}catch(err){wtCloudError=err.message;wtStatus='拉取失败'}finally{wtCloudBusy=false;render();}}
function wtScheduleSync(){if(!wtSession||wtCloudBusy)return;clearTimeout(wtSyncTimer);wtSyncTimer=setTimeout(()=>wtPush(),3500)}
async function wtCallAI(path,payload){await wtEnsureToken();let resp=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+wtSession.access_token},body:JSON.stringify(payload)});return wtJson(resp);}
async function wtScript(){if(wtAiBusy)return;let p=selected();if(!p)return;if(!p.sourceURLs?.trim()||!p.factNotes?.trim()){notify('请先补充来源及核验事实，避免凭空编造新闻细节');nav('studio/'+p.id+'/0');return;}if(p.panels.some(v=>v.scene?.trim())&&!confirm('AI 编剧将替换现有九格分镜文字（不删除图片），继续吗？'))return;wtAiBusy=true;render();try{let out=await wtCallAI('/api/ai/script',{title:p.title,description:p.description,sourceTitle:p.sourceTitle,sourceURLs:p.sourceURLs,factNotes:p.factNotes,fiction:p.fiction,tone:p.tone,characters:wtCharBible()+'\n'+p.characters});if(!Array.isArray(out.panels)||out.panels.length!==9)throw Error('模型没有返回完整九格，请稍后重试');p.panels.forEach((v,i)=>{let next=out.panels[i];v.title=String(next.title||v.title).slice(0,120);v.scene=String(next.scene||'').slice(0,2000);v.caption=String(next.caption||'').slice(0,800);v.dialogue=String(next.dialogue||'').slice(0,800);v.prompt=String(next.prompt||'').slice(0,1600)});p.fiction=out.fiction||p.fiction;p.status='草稿';p.checks=Array(6).fill(false);p.reviewedAt=null;p.publishedAt=null;setChange(p,'AI 生成九格初稿（尚未人工核验）');ui.stage=2;notify('九格脚本已生成，逐格复核后再发布');}catch(err){notify('AI 编剧未完成：'+err.message)}finally{wtAiBusy=false;render();}}
async function wtImage(useReference=false){if(wtAiBusy)return;const p=selected();if(!p)return;const panel=p.panels[ui.panel];if(!panel?.scene?.trim()){notify('请先填写当前分镜画面描述');return;}if(!confirm('将调用单张 AI 图像生成模型，可能消耗免费额度或产生费用。确认执行？'))return;wtAiBusy=true;render();try{let sources=(data.characters||[]).filter(c=>c.portrait).sort((a,b)=>(Number(panel.scene.includes(b.name||'不存在'))-Number(panel.scene.includes(a.name||'不存在')))).slice(0,3).map(c=>({source:c.portrait,label:c.name}));if(useReference&&p.panels[0].image)sources.unshift({source:p.panels[0].image,label:'第一格画风'});sources=sources.slice(0,4);const references=[];for(const entry of sources){let blob;try{blob=await getImageBlob(entry.source)}catch{continue}const bmp=await createImageBitmap(blob);const ratio=Math.min(1,480/bmp.width,480/bmp.height);let canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*ratio));canvas.height=Math.max(1,Math.round(bmp.height*ratio));canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.58));if(!jpeg||jpeg.size>175000)continue;let bytes=new Uint8Array(await jpeg.arrayBuffer());let parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));references.push({data:btoa(parts.join('')),type:'image/jpeg',label:entry.label});}const out=await wtCallAI('/api/ai/image',{title:p.title,scene:panel.scene,visualNotes:panel.prompt||'',characters:wtCharBible()+'\n'+p.characters,references});if(!out.image)throw Error('模型没有返回有效图片');const bin=atob(out.image),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const key=uid();await putMedia(key,new Blob([bytes],{type:'image/png'}));panel.image='media:'+key;markDirty(p);setChange(p,'生成第 '+(ui.panel+1)+' 格画面（引用 '+references.length+' 张定妆/风格图）');notify('画面已生成并保存为草稿，请审校角色一致性');}catch(err){notify('AI 生图未完成：'+err.message)}finally{wtAiBusy=false;render();}}
document.addEventListener('change',async ev=>{const input=ev.target;if(!input?.matches?.('[data-wt-character-image]'))return;const c=(data.characters||[]).find(x=>x.id===input.dataset.wtCharacterImage);const file=input.files?.[0];if(!c||!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){notify('定妆照需为 JPG、PNG 或 WebP，文件小于 8 MB');return;}try{const key=uid();await putMedia(key,file);c.portrait='media:'+key;persist();render();notify('角色定妆照已保存；登录后可同步至私有云端');}catch(err){notify('定妆照保存失败：'+err.message);}},true);
// Intercept only extension controls; keep v1 editor event handling intact.
document.addEventListener('click',async ev=>{let btn=ev.target.closest('[data-wt]');if(!btn)return;ev.preventDefault();ev.stopImmediatePropagation();let action=btn.dataset.wt,id=btn.dataset.id,val=btn.dataset.value;try{switch(action){case'source':wtSource=val;wtCategory='全部';wtVisibleCount=12;render();break;case'category':wtCategory=val;wtVisibleCount=12;render();break;case'news-refresh':case'reload-cache':await wtFetchNews();break;case'clear-filters':wtCategory='全部';wtQuery='';wtRankMin=60;wtRankFocus='all';wtVisibleCount=12;render();break;case'more':wtVisibleCount=Math.min(250,wtVisibleCount+12);render();break;case'save-news':await wtSaveNews(btn.dataset.index);break;case'create-news':await wtDraftFromNews(btn.dataset.index);break;case'char-new':wtCharModal();break;case'char-edit':wtCharModal((data.characters||[]).find(x=>x.id===id));break;case'char-delete':if(confirm('从角色档案中移除该角色？')){data.characters=data.characters.filter(x=>x.id!==id);persist();render()}break;case'char-prompt':{let c=data.characters.find(c=>c.id===id);copyText(`${c.name} / 角色圣经：${c.description}；固定服饰：${c.costume}；色彩：${c.colors}；唯一识别特征：${c.traits}；性格：${c.personality}。每张分镜保持外貌一致，避免模拟真实人物。`);break}case'sync-pull':await wtPull();break;case'sync-push':if(confirm('把当前本机作品上传并覆盖你的云端版本？'))await wtPush(true);break;case'signout':wtSession=null;wtRemoteRev=null;wtSaveSession();wtStatus='已退出';render();break;case'ai-script':await wtScript();break;case'ai-image':await wtImage(false);break;case'ai-image-ref':await wtImage(true);break;}}catch(err){notify('操作异常：'+err.message)}},true);
document.addEventListener('submit',ev=>{if(ev.target.id==='wtCharacterForm'){ev.preventDefault();ev.stopImmediatePropagation();let c=data.characters.find(c=>c.id===ev.target.dataset.id);if(!c){c={id:uid()};data.characters.push(c)}Object.assign(c,Object.fromEntries(new FormData(ev.target).entries()));persist();closeModal();render();notify('角色档案已保存')}if(ev.target.id==='wtLogin'){ev.preventDefault();ev.stopImmediatePropagation();let sub=ev.submitter?.value||'login';let form=ev.target;const email=form.elements.email.value, password=form.elements.password.value;wtAuthForm({elements:{email:{value:email},password:{value:password}}},sub)}},true);
document.addEventListener('change',ev=>{const x=ev.target;if(!['wtRankSort','wtRankFocus','wtRankMin'].includes(x.id))return;ev.stopImmediatePropagation();if(x.id==='wtRankSort')wtRankSort=x.value;if(x.id==='wtRankFocus')wtRankFocus=x.value;if(x.id==='wtRankMin')wtRankMin=Math.max(60,Number(x.value)||60);wtVisibleCount=12;render()},true);
document.addEventListener('input',ev=>{if(ev.target.id==='wtSearch'){wtQuery=ev.target.value;let root=document.querySelector('.wt-news');if(root){let caret=ev.target.selectionStart;render();let next=document.getElementById('wtSearch');next?.focus();next?.setSelectionRange(caret,caret)}}},true);
render();
(async()=>{wtRestoreCatalog();await wtLoadConfig();try{wtSession=JSON.parse(localStorage.getItem('worldtoon_auth_session')||'null');if(wtSession){await wtEnsureToken();wtStatus='已登录，等待首次同步操作'}}catch{wtSession=null;wtSaveSession();}if(location.hash.startsWith('#/live'))wtFetchNews();render()})();
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/live')&&!wtNews.length&&!wtFetching)wtFetchNews();});
