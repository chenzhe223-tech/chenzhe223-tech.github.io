/* WORLD/TOON 2.0 — Live news, character bible, AI-assisted creation, private sync.
 * No hidden generation or publication. AI generation is explicitly user initiated.
 */
'use strict';
let wtSource='all',wtSourceCounts=[],wtCategory='全部',wtQuery='',wtNews=[],wtLastFetch=0,wtFetching=false,wtNewsError='',wtAiBusy=false,wtCatalogRequested=false,wtVisibleCount=12,wtCatalogLocal=false,wtInitRetries=0;
let wtRankSort='overall',wtRankFocus='all',wtRankMin=60;
let wtConfig=null,wtSession=null,wtSyncTimer=null,wtCloudBusy=false,wtSyncedAt='',wtCloudError='',wtStatus='未登录';
let wtSelectedCharacter='',wtPreviewImage='',wtRemoteRev=null;
const wtCategories=['全部','国际政治','文化','娱乐','体育','人物','旅行','AI 科技','经典故事','世界文学','诺奖文学','世界学术活动','历史脑洞','科技社区','机器人','商业财经','科学','环境','健康','航空航天'];
const wtJson=async(res)=>{const body=await res.json().catch(()=>({error:'服务器响应无法解析'}));if(!res.ok)throw Error(body.error||body.message||`请求失败 ${res.status}`);return body;};
const wtTime=v=>{try{return new Date(v).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'}};

const wtNewsSymbols={'国际政治':'WORLD','文化':'CULTURE','娱乐':'CINEMA','体育':'SPORT','人物':'PEOPLE','旅行':'TRAVEL','AI 科技':'A.I.','经典故事':'BOOK','世界文学':'LITERATURE','诺奖文学':'NOBEL','世界学术活动':'ACADEMY','历史脑洞':'HISTORY','科技社区':'DEV','机器人':'ROBOT','商业财经':'MARKET','科学':'SCIENCE','环境':'EARTH','健康':'HEALTH','航空航天':'SPACE'};
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
 const sourceDefs=[['all','综合精选'],['news','全球热点'],['hackernews','科技社区'],['arxiv','AI 前沿'],['classics','经典故事'],['literary_series','世界文学系列'],['nobel_literature','诺奖作家作品'],['academic_events','世界学术活动'],['history','历史故事']];
 const total=wtSourceCounts.reduce((n,x)=>n+Number(x.count||0),0);
 const count=id=>id==='all'?total:Number(wtSourceCounts.find(x=>x.id===id)?.count||0);
 const sourceTabs=sourceDefs.map(([id,label])=>'<button type="button" class="'+(wtSource===id?'active':'')+'" data-wt="source" data-value="'+id+'"><strong>'+label+'</strong><span>'+(wtSourceCounts.length?(count(id)?count(id)+' 条':'待更新'):'—')+'</span></button>').join('');
 const filters=['全部',...wtCategories.filter(c=>categories.has(c))].map(c=>'<button type="button" class="'+(c===wtCategory?'active':'')+'" data-wt="category" data-value="'+e(c)+'">'+e(c)+(c==='全部'?'':' · '+categories.get(c))+'</button>').join('');
 const cacheTime=wtLastFetch?wtTime(wtLastFetch):'尚未建立缓存';
 const freshness=wtSourceCounts.filter(x=>x.ready).map(x=>Date.parse(x.collectedAt||0)).filter(Number.isFinite);
 const lastSourceUpdate=freshness.length?wtTime(Math.max(...freshness)):'尚无素材';
 const unavailable=wtSourceCounts.filter(x=>!x.ready).map(x=>x.id).join('、');
 const sourceStatus=wtSourceCounts.length?'后台最近更新 '+lastSourceUpdate+(unavailable?' · 待初始化 '+unavailable:''):'等待首次后台采集';
 const brief=wtSource==='all'?'跨新闻、科研活动、诺奖文学、世界经典与历史的统一选题池':'当前阅读 '+sourceDefs.find(x=>x[0]===wtSource)?.[1];
 const serialPicks=allMatched.filter(x=>x.serializable===true&&Array.isArray(x.series_episodes)&&x.series_episodes.length>=3);
 const serialTop=(wtSource==='all'||['literary_series','nobel_literature','academic_events'].includes(wtSource))&&serialPicks.length&&wtCategory==='全部'&&!wtQuery
  ?'<section class="wt-featured wt-series-featured"><div class="wt-featured-head"><strong>系列漫画优选</strong><span>可追溯来源与原创分集纲要 · 规则预评分</span></div><div class="wt-featured-grid">'+serialPicks.slice(0,3).map(x=>
   '<article class="wt-featured-card"><span class="wt-featured-rank">'+e(x.category)+' · '+x._rating.overall+'分</span><strong>'+e(x.title)+'</strong><p class="wt-series-brief">'+e(x.series_episodes.slice(0,3).join(' / '))+'</p><button type="button" data-wt="create-news" data-index="'+x._sourceIndex+'">规划漫画系列 ↗</button></article>').join('')+'</div></section>':'';
 const top=wtSource==='all'&&wtCategory==='全部'&&!wtQuery&&allMatched.length
  ?'<section class="wt-featured"><div class="wt-featured-head"><strong>今日值得画</strong><span>来自已缓存素材 · 规则评分推荐</span></div><div class="wt-featured-grid">'+allMatched.slice(0,3).map((n,i)=>
   '<article class="wt-featured-card"><span class="wt-featured-rank">0'+(i+1)+' · '+e(n.category)+' · '+n._rating.overall+'分</span><strong>'+e(n.title)+'</strong><button type="button" data-wt="create-news" data-index="'+n._sourceIndex+'">制作漫画草稿 ↗</button></article>').join('')+'</div></section>':'';
 const cards=items.map((n,i)=>'<article class="wt-news-card">'+wtNewsPicture(n,i)+
  '<div class="wt-news-card-body"><div class="wt-status"><span class="wt-chip">'+e(n.category)+'</span><span class="wt-chip wt-unverified">待核验</span>'+
  '<span class="wt-chip">'+(n.eventDate?'活动日期 '+e(n.eventDate):n.evergreen?'经典常青':e(n.published?wtTime(n.published):'日期待核实'))+'</span></div>'+
  '<h3>'+e(n.title)+'</h3>'+(n.summary?'<p class="wt-news-summary">'+e(n.summary)+'</p>':'')+
  (n.series_episodes?.length>=3?'<div class="wt-series-outline"><b>连载建议 · '+n.series_episodes.length+' 个篇章</b><span>'+e(n.series_episodes.slice(0,3).join(' → '))+'</span></div>':'')+
  '<p class="minor wt-news-source">'+e(n.source||'原始来源待确认')+(n.author?' · '+e(n.author):'')+'</p>'+
  (n.rights_status==='copyright_permission_required'?'<p class="wt-rights-warning">著作权提醒：需要取得原作改编授权；可先做书评或原创主题解读。</p>':'')+
  '<div class="wt-catalog-score">综合预评分 <strong>'+n._rating.overall+'</strong><span>/100 · '+e(n._rating.method==='evergreen_rule_estimate'?'长期故事价值':n._rating.method==='event_rule_estimate'?'学术活动策划价值':'新闻选题价值')+'</span></div>'+
  '<div class="buttons"><a href="'+e(safeURL(n.url))+'" target="_blank" rel="noopener noreferrer" class="button">核对原始来源</a>'+
  '<button type="button" class="button dark" data-wt="create-news" data-index="'+n._sourceIndex+'">创作漫画</button>'+
  '<button type="button" class="button" data-wt="save-news" data-index="'+n._sourceIndex+'">收藏选题</button></div></div></article>').join('');
 const isEmpty=!wtNews.length;
 const message=wtFetching&&isEmpty?'正在读取后台素材缓存…':isEmpty?'后台素材库尚未初始化。请查看最近更新时间，稍后重新读取；不会因点击分类而现场采集。':
  '当前分类没有达到所选评分与关键词条件的素材。试试清空搜索或切换其他已缓存来源。';
 const empty='<div class="box wt-rank-empty"><h3>'+(isEmpty?'素材库正在准备':'暂无匹配的漫画素材')+'</h3><p>'+message+'</p>'+
 '<div class="buttons"><button type="button" class="button" data-wt="clear-filters">恢复全部筛选</button><button type="button" class="button" data-wt="reload-cache">重新读取缓存</button></div></div>';
 return heroHeader('DISCOVERY / BY DAVYLAB','素材发现','打开即读 · 后台更新 · 全球热点、世界文学名著、诺奖作家作品与学术活动专题。高分是规则预评估，正式改编仍需核验来源及版权。')+
 '<section class="wt-source-panel wt-catalog-sources"><div class="wt-source-head"><strong>探索故事</strong><span>'+e(sourceStatus)+'</span></div><div class="wt-source-tabs">'+sourceTabs+'</div>'+
 '<p class="minor">'+e(brief)+' · 分类切换不重新集采'+(wtCatalogLocal?' · 当前为本机上次成功缓存':'')+'</p></section>'+
 top+serialTop+
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
function wtCharacters(){
 const p=selected(),ids=window.WTCharacterContinuity;
 const cards=(data.characters||[]).map(c=>{
  const nativeName=c.originalName||c.name||'未命名角色';
  const display=ids?.displayName(data,c.characterId||c.id,p?.id)||nativeName;
  return `<article class="wt-character">${c.portrait?`<img src="${e(c.portrait)}" alt="${e(display)}的原创定妆照" style="display:block;width:100%;height:190px;object-fit:cover;border-radius:10px;margin-bottom:13px">`:'<div style="min-height:110px;background:#e7e9df;border-radius:9px;display:grid;place-items:center;color:#66736b;margin-bottom:13px">NO REFERENCE PORTRAIT</div>'}<span class="wt-chip">${e(c.type||'虚构角色')}</span><h3>${e(display)}</h3><p class="minor">原生名：${e(nativeName)}${display!==nativeName?' · 本作漫画名：'+e(display):''}</p><p>${e(c.description||'未填写角色外形')}</p><p class="minor">服饰：${e(c.costume||'待设定')} · 配色：${e(c.colors||'待设定')}</p><p class="minor">固定识别特征：${e(c.traits||'待设定')}</p><div class="buttons"><label class="button" style="cursor:pointer">上传定妆照<input type="file" accept="image/png,image/jpeg,image/webp" data-wt-character-image="${e(c.id)}" hidden></label><button class="button" data-wt="char-edit" data-id="${e(c.id)}">编辑档案</button><button class="button" data-wt="char-prompt" data-id="${e(c.id)}">复制参考提示</button><button class="button" data-wt="char-delete" data-id="${e(c.id)}">移除</button></div></article>`;
 }).join('');
 return heroHeader('06 / THE CAST','角色一致性档案','当前工作区可跨漫画复用角色身份；每部作品可使用自己的漫画名。','<button class="button dark" data-wt="char-new">＋ 新建角色档案</button>')+'<div class="wt-ai"><strong>定妆照与参考图</strong><p>一位角色一张固定视觉参考；单次生成可引用多位角色的图片与第 1 格画风图。只能上传有权使用的原创或授权素材，不得借此模拟真实人士的私人行为。</p></div><div class="wt-grid">'+(cards||'<div class="box">角色档案尚为空，添加第一位原创虚构角色。</div>')+'</div>';
}
function wtAccount(){const heading=heroHeader('ACCOUNT / PRIVATE CLOUD','登录与多端同步','邮箱账户 · 私有作品与图片存储 · 冲突保护 · 本地优先。未登录不会上传作品。');const foot='<section class="box"><h2>数据与备份</h2><p>本地草稿保存在当前浏览器；登录后可以手动或在编辑时同步至私有云端。请在大改前导出完整 ZIP 备份。</p><a href="#/settings" class="button">前往数据管理 ↗</a></section>';if(wtSession?.access_token){return heading+'<section class="box"><div class="kicker">PRIVATE CLOUD / SIGNED IN</div><h2>'+e(wtSession.user?.email||'已登录')+'</h2><p class="wt-note">'+e(wtStatus)+(wtRemoteRev===null?' · 尚未建立云端版本基线':' · 云端修订 '+wtRemoteRev)+(wtSyncedAt?' · 最近同步 '+e(wtSyncedAt):'')+'</p>'+(wtCloudError?'<p class="wt-error">'+e(wtCloudError)+'</p>':'')+'<div class="buttons"><button class="button dark" data-wt="sync-pull">从云端恢复到本机</button><button class="button" data-wt="sync-push">将本机备份至云端</button><button class="button" data-wt="signout">退出登录</button></div><p class="wt-note">新设备请先从云端恢复。同步采用版本冲突保护，避免不同设备静默覆盖。云端图像只能由所属用户读取。</p></section>'+foot;}return heading+'<section class="box"><div class="kicker">SECURE SIGN IN</div><h2>登录你的私人漫画工作室</h2><form id="wtLogin" autocomplete="on"><div class="fields"><div class="field"><label for="wtEmail">邮箱地址</label><input id="wtEmail" type="email" name="email" autocomplete="email" required placeholder="you@example.com"></div><div class="field"><label for="wtPassword">账户密码</label><input id="wtPassword" type="password" name="password" autocomplete="current-password" minlength="8" required placeholder="至少 8 位"></div></div><div class="buttons" style="margin-top:18px"><button class="button dark" type="submit" name="mode" value="login">登录</button><button class="button" type="submit" name="mode" value="signup">注册账户</button></div></form><p class="wt-note">仅主动注册、登录时发送邮箱密码到 Supabase Auth。新账户可能需要邮件确认；未登录期间不会上传本机作品。</p>'+(wtCloudError?'<p class="wt-error">'+e(wtCloudError)+'</p>':'')+'<p class="minor">'+e(wtStatus)+'</p></section>'+foot;}
function wtCharModal(c){
 const p=selected(),ids=window.WTCharacterContinuity,nativeName=c?.originalName||c?.name||'';
 const comicName=c&&p?ids?.displayName(data,c.characterId||c.id,p.id)||nativeName:'';
 modal(`<div class="kicker">CHARACTER BIBLE / BY DAVYLAB</div><h2>${c?'编辑':'创建'}原创角色</h2><form id="wtCharacterForm" data-id="${e(c?.id||'')}" data-project-id="${e(p?.id||'')}"><div class="fields"><div class="field"><label>原生角色名</label><input name="originalName" maxlength="80" required value="${e(nativeName)}"></div>${p?`<div class="field"><label>本作品漫画名</label><input name="comicName" maxlength="80" value="${e(comicName)}"><small>只影响《${e(p.title||'当前作品')}》，不会更改其他漫画中的角色名。</small></div>`:''}<div class="field"><label>类型</label><select name="type"><option>虚构角色</option><option>拟人化角色</option><option>抽象象征</option></select></div><div class="field wide"><label>外形及发型</label><textarea name="description" maxlength="1800">${e(c?.description||'')}</textarea></div><div class="field"><label>固定服饰</label><input name="costume" value="${e(c?.costume||'')}"></div><div class="field"><label>代表色彩</label><input name="colors" value="${e(c?.colors||'')}"></div><div class="field wide"><label>不可改变的识别特征</label><textarea name="traits">${e(c?.traits||'')}</textarea></div><div class="field wide"><label>人物背景与性格</label><textarea name="personality">${e(c?.personality||'')}</textarea></div></div><div class="stepactions"><button class="button" type="button" data-action="modal-close">取消</button><button class="button dark">保存角色</button></div></form>`);
}
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
  const result=await wtJson(await fetch('/api/comic/catalog?source=all&limit=500',{cache:'no-store'}));
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
async function wtSaveNews(i){let x=wtNews[Number(i)];if(!x)return;let found=data.topics.find(z=>z.source===x.url);if(found){notify('这条原始来源已在选题池');return;}const eventRaw=x.eventDate||x.occurrence_date||x.occurredAt||'';const date=String(eventRaw||x.published||'').slice(0,10);let t={id:uid(),title:x.title,category:x.category,seriesEpisodes:Array.isArray(x.series_episodes)?x.series_episodes.slice(0,8):[],storyBeats:Array.isArray(x.story_beats)?x.story_beats.slice(0,8):[],editorialBasis:x.editorial_basis||'',eventEndDate:x.event_end_date||'',summary:`原始来源：${x.source}。${x.evergreen?'经典/历史线索待核验，请检查权利与史料':'新闻线索尚未完成事实核验，请阅读全文后改编'}。`,source:x.url,evergreen:x.evergreen===true,rightsStatus:x.rights_status||'unknown',sourceId:x.source_id||'',eventDate:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'',eventDateBasis:eventRaw?'source_event':'published_candidate',heat:Math.max(1,Math.round(wtEditorialRank.evaluate(x).heat/20)),impact:Math.max(1,Math.round(wtEditorialRank.evaluate(x).impact/20)),story:Math.max(1,Math.round(wtEditorialRank.evaluate(x).drawability/20)),ranking:wtEditorialRank.evaluate(x),stage:'待核验',createdAt:now(),publishedAt:x.published,sourceName:x.source,newsImage:x.image||'',verified:false};data.topics.unshift(t);persist();notify('已加入选题池，待核验后创作');}

async function wtDraftFromNews(i){
 const x=wtNews[Number(i)];if(!x)return;
 await wtSaveNews(i);
 const t=data.topics.find(z=>z.source===x.url);if(!t)throw Error('选题尚未保存');
 const existing=data.projects.find(z=>!z.deleted&&z.topicId===t.id);
 if(existing){ui.selected=existing.id;nav('studio/'+existing.id+'/0');notify('已打开这条选题的现有漫画草稿');return}
 const p=emptyProject(t);
 p.factNotes='【待核验】来自 '+(x.source||'未知来源')+' 的新闻、文学或研究线索；请先核对原文、活动日期、史实及版权。'+(Array.isArray(x.series_episodes)&&x.series_episodes.length?' 原创连载建议：'+x.series_episodes.join(' / '):'');
 p.fiction='原创架空角色及情节，不复现或指控现实人物。';
 p.sourceURLs=x.url;p.sourceTitle=x.title;p.status='草稿';p.evergreen=x.evergreen===true;p.sourceId=x.source_id||'';p.rightsStatus=x.rights_status||'unknown';
 data.projects.unshift(p);ui.selected=p.id;persist();
 nav('director/'+p.id);notify('已建立漫画草稿，进入创意导演台选择画风、角色与九格剧情');
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
async function wtUploadImages(){if(!wtSession)return;let seen=new Set();for(let p of [...data.projects,{panels:(data.characters||[]).map(c=>({image:c.portrait})),cover:''}]){for(let src of [...(p.panels||[]).map(a=>a.image),p.cover,p.creativeDirection?.pilot?.characterImage,p.creativeDirection?.pilot?.panelImage]){if(!src?.startsWith('media:')||seen.has(src))continue;seen.add(src);let key=src.slice(6);let blob=await getMedia(key);if(!blob)continue;let resp=await wtCloudRequest('/storage/v1/object/worldtoon-private/'+encodeURIComponent(wtSession.user.id)+'/'+encodeURIComponent(key),{method:'POST',headers:{'content-type':blob.type||'image/png','x-upsert':'true'},body:blob});if(!resp.ok)throw Error('第 '+seen.size+' 张图片云端备份失败：'+resp.status);}}}
async function wtDownloadMedia(key){if(!wtSession)return null;try{let r=await wtCloudRequest('/storage/v1/object/authenticated/worldtoon-private/'+encodeURIComponent(wtSession.user.id)+'/'+encodeURIComponent(key));return r.ok?await r.blob():null}catch{return null}}
async function wtPull(){if(wtCloudBusy)return;wtCloudBusy=true;wtCloudError='';wtStatus='正在拉取';render();try{await wtEnsureToken();let list=await wtJson(await wtCloudRequest('/rest/v1/worldtoon_workspaces?select=payload,updated_at,revision&user_id=eq.'+encodeURIComponent(wtSession.user.id),{headers:{Accept:'application/json'}}));if(!list?.length){wtStatus='云端为空；可上传本机资料';return}let remote=list[0].payload;if(!Array.isArray(remote.projects)||!Array.isArray(remote.topics))throw Error('云端数据格式不正确');let localHasEdits=JSON.stringify(remote)!==JSON.stringify(data);if(localHasEdits&&!confirm('云端资料将覆盖当前本机工作区。请先导出完整 ZIP 备份。确认拉取吗？')){wtStatus='已取消拉取';return;}data={...remote,characters:remote.characters||[]};wtRemoteRev=list[0].revision;persist();ui.selected=data.projects[0]?.id||'';wtSyncedAt=new Date().toLocaleString('zh-CN');wtStatus='已拉取';notify('云端工作区已恢复');}catch(err){wtCloudError=err.message;wtStatus='拉取失败'}finally{wtCloudBusy=false;render();}}
function wtScheduleSync(){if(!wtSession||wtCloudBusy)return;clearTimeout(wtSyncTimer);wtSyncTimer=setTimeout(()=>wtPush(),3500)}
async function wtCallAI(path,payload){await wtEnsureToken();let resp=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+wtSession.access_token},body:JSON.stringify(payload)});return wtJson(resp);}
async function wtScript(){if(wtAiBusy)return;let p=selected();if(!p)return;if(!p.sourceURLs?.trim()||!p.factNotes?.trim()){notify('请先补充来源及核验事实，避免凭空编造新闻细节');nav('studio/'+p.id+'/0');return;}if(p.panels.some(v=>v.scene?.trim())&&!confirm('AI 编剧将替换现有九格分镜文字（不删除图片），继续吗？'))return;wtAiBusy=true;render();try{let out=await wtCallAI('/api/ai/script',{title:p.title,description:p.description,sourceTitle:p.sourceTitle,sourceURLs:p.sourceURLs,factNotes:p.factNotes,fiction:p.fiction,tone:p.tone,characters:wtCharBible()+'\n'+p.characters});if(!Array.isArray(out.panels)||out.panels.length!==9)throw Error('模型没有返回完整九格，请稍后重试');p.panels.forEach((v,i)=>{let next=out.panels[i];v.title=String(next.title||v.title).slice(0,120);v.scene=String(next.scene||'').slice(0,2000);v.caption=String(next.caption||'').slice(0,800);v.dialogue=String(next.dialogue||'').slice(0,800);v.prompt=String(next.prompt||'').slice(0,1600)});p.fiction=out.fiction||p.fiction;p.status='草稿';p.checks=Array(6).fill(false);p.reviewedAt=null;p.publishedAt=null;setChange(p,'AI 生成九格初稿（尚未人工核验）');ui.stage=2;notify('九格脚本已生成，逐格复核后再发布');}catch(err){notify('AI 编剧未完成：'+err.message)}finally{wtAiBusy=false;render();}}
async function wtImage(useReference=false){if(wtAiBusy)return;const p=selected();if(!p)return;const panel=p.panels[ui.panel];if(!panel?.scene?.trim()){notify('请先填写当前分镜画面描述');return;}if(!confirm('将调用单张 AI 图像生成模型，可能消耗免费额度或产生费用。确认执行？'))return;wtAiBusy=true;render();try{let sources=(data.characters||[]).filter(c=>c.portrait).sort((a,b)=>(Number(panel.scene.includes(b.name||'不存在'))-Number(panel.scene.includes(a.name||'不存在')))).slice(0,3).map(c=>({source:c.portrait,label:c.name}));if(useReference&&p.panels[0].image)sources.unshift({source:p.panels[0].image,label:'第一格画风'});sources=sources.slice(0,4);const references=[];for(const entry of sources){let blob;try{blob=await getImageBlob(entry.source)}catch{continue}const bmp=await createImageBitmap(blob);const ratio=Math.min(1,480/bmp.width,480/bmp.height);let canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*ratio));canvas.height=Math.max(1,Math.round(bmp.height*ratio));canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);const jpeg=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.58));if(!jpeg||jpeg.size>175000)continue;let bytes=new Uint8Array(await jpeg.arrayBuffer());let parts=[];for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));references.push({data:btoa(parts.join('')),type:'image/jpeg',label:entry.label});}const out=await wtCallAI('/api/ai/image',{title:p.title,scene:panel.scene,visualNotes:panel.prompt||'',characters:wtCharBible()+'\n'+p.characters,references});if(!out.image)throw Error('模型没有返回有效图片');const bin=atob(out.image),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const key=uid();await putMedia(key,new Blob([bytes],{type:'image/png'}));panel.image='media:'+key;markDirty(p);setChange(p,'生成第 '+(ui.panel+1)+' 格画面（引用 '+references.length+' 张定妆/风格图）');notify('画面已生成并保存为草稿，请审校角色一致性');}catch(err){notify('AI 生图未完成：'+err.message)}finally{wtAiBusy=false;render();}}
document.addEventListener('change',async ev=>{const input=ev.target;if(!input?.matches?.('[data-wt-character-image]'))return;const c=(data.characters||[]).find(x=>x.id===input.dataset.wtCharacterImage);const file=input.files?.[0];if(!c||!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){notify('定妆照需为 JPG、PNG 或 WebP，文件小于 8 MB');return;}try{const key=uid();await putMedia(key,file);c.portrait='media:'+key;persist();render();notify('角色定妆照已保存；登录后可同步至私有云端');}catch(err){notify('定妆照保存失败：'+err.message);}},true);
// Intercept only extension controls; keep v1 editor event handling intact.
document.addEventListener('click',async ev=>{let btn=ev.target.closest('[data-wt]');if(!btn)return;ev.preventDefault();ev.stopImmediatePropagation();let action=btn.dataset.wt,id=btn.dataset.id,val=btn.dataset.value;try{switch(action){case'source':wtSource=val;wtCategory='全部';wtVisibleCount=12;render();break;case'category':wtCategory=val;wtVisibleCount=12;render();break;case'news-refresh':case'reload-cache':await wtFetchNews();break;case'clear-filters':wtCategory='全部';wtQuery='';wtRankMin=60;wtRankFocus='all';wtVisibleCount=12;render();break;case'more':wtVisibleCount=Math.min(500,wtVisibleCount+12);render();break;case'save-news':await wtSaveNews(btn.dataset.index);break;case'create-news':await wtDraftFromNews(btn.dataset.index);break;case'char-new':wtCharModal();break;case'char-edit':wtCharModal((data.characters||[]).find(x=>x.id===id));break;case'char-delete':if(confirm('从角色档案中移除该角色？')){data.characters=data.characters.filter(x=>x.id!==id);persist();render()}break;case'char-prompt':{let c=data.characters.find(c=>c.id===id);copyText(`${c.name} / 角色圣经：${c.description}；固定服饰：${c.costume}；色彩：${c.colors}；唯一识别特征：${c.traits}；性格：${c.personality}。每张分镜保持外貌一致，避免模拟真实人物。`);break}case'sync-pull':await wtPull();break;case'sync-push':if(confirm('把当前本机作品上传并覆盖你的云端版本？'))await wtPush(true);break;case'signout':wtSession=null;wtRemoteRev=null;wtSaveSession();wtStatus='已退出';render();break;case'ai-script':await wtScript();break;case'ai-image':await wtImage(false);break;case'ai-image-ref':await wtImage(true);break;}}catch(err){notify('操作异常：'+err.message)}},true);
document.addEventListener('submit',ev=>{if(ev.target.id==='wtCharacterForm'){ev.preventDefault();ev.stopImmediatePropagation();if(!Array.isArray(data.characters))data.characters=[];let c=data.characters.find(x=>x.id===ev.target.dataset.id);if(!c){const id=uid();c={id,characterId:id,comicNames:[]};data.characters.push(c)}window.WTCharacterContinuity?.normalizeWorkspace(data);const values=Object.fromEntries(new FormData(ev.target).entries());const nativeName=String(values.originalName||values.name||'').trim();delete values.originalName;delete values.comicName;delete values.name;Object.assign(c,values,{name:nativeName,originalName:nativeName});if(ev.target.dataset.projectId)window.WTCharacterContinuity?.setComicName(data,c.characterId,ev.target.dataset.projectId,ev.target.elements.comicName?.value||nativeName);persist();closeModal();render();notify('角色档案已保存')}if(ev.target.id==='wtLogin'){ev.preventDefault();ev.stopImmediatePropagation();let sub=ev.submitter?.value||'login';let form=ev.target;const email=form.elements.email.value, password=form.elements.password.value;wtAuthForm({elements:{email:{value:email},password:{value:password}}},sub)}},true);
document.addEventListener('change',ev=>{const x=ev.target;if(!['wtRankSort','wtRankFocus','wtRankMin'].includes(x.id))return;ev.stopImmediatePropagation();if(x.id==='wtRankSort')wtRankSort=x.value;if(x.id==='wtRankFocus')wtRankFocus=x.value;if(x.id==='wtRankMin')wtRankMin=Math.max(60,Number(x.value)||60);wtVisibleCount=12;render()},true);
document.addEventListener('input',ev=>{if(ev.target.id==='wtSearch'){wtQuery=ev.target.value;let root=document.querySelector('.wt-news');if(root){let caret=ev.target.selectionStart;render();let next=document.getElementById('wtSearch');next?.focus();next?.setSelectionRange(caret,caret)}}},true);
render();
(async()=>{wtRestoreCatalog();if(window.WTCharacterContinuity){const before=JSON.stringify(data.characters||[]);window.WTCharacterContinuity.normalizeWorkspace(data);if(JSON.stringify(data.characters||[])!==before)persist()}await wtLoadConfig();try{wtSession=JSON.parse(localStorage.getItem('worldtoon_auth_session')||'null');if(wtSession){await wtEnsureToken();wtStatus='已登录，等待首次同步操作'}}catch{wtSession=null;wtSaveSession();}if(location.hash.startsWith('#/live'))wtFetchNews();render()})();
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/live')&&!wtNews.length&&!wtFetching)wtFetchNews();});

/* WORLD_TOON_STORY_DISCOVERY_V1 — canonical story-discovery-ui.js embedded for Worker allowlist. */
/* WORLD/TOON / Story-to-comic discovery editor · no hidden paid calls.
 * Source-led, copyright-aware, and integrated with existing project workspace.
 * Embedded in extension.js to honor the deployed Worker static allowlist.
 */
(function(){
 const story={type:'drama',query:'',items:[],selected:null,chosen:new Set(),mode:'original',busy:false,loaded:false,error:'',warnings:[],when:'',synopsis:'',rightsURL:'',rightsConsent:false,sourceAge:''};
 const html=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,'');
 const scrub=v=>String(v||'').trim().slice(0,1800);
 const isProtected=x=>x?.rights!=='public_domain_us';
 const limitedSource=x=>/^(https:\/\/)[\w.-]+\//.test(String(x?.source||''))?x.source:'';
 const flowCard=x=>window.WTDiscoveryFlow?.card(x)||{identityLabel:'作品身份待核对',heatLabel:'未核实热度',heatEvidenceDate:'',publishedDate:String(x?.published||'').slice(0,10),sourceName:x?.source_name||'公开资料',rightsLabel:x?.rights==='public_domain_us'?'公版候选（按地区核对）':'版权待核实'};
 function originalTopicChoices(x){
  const label=String(x?.genre||x?.type||'').slice(0,80);
  const domain=/玄幻|仙侠|修仙|妖/.test(label)?'架空修行世界':
    /古风|历史|权谋/.test(label)?'原创古代城邦':
    /家庭|伦理|亲情/.test(label)?'虚构家庭与社区':
    /职场|银行|商战|总裁|都市/.test(label)?'架空都市职场':
    /悬疑|推理|脑洞/.test(label)?'原创悬疑小镇':'原创当代城市';
  return [
   {id:'concept-identity',title:'原创方向 A · 身份反转',summary:domain+'中，一位平凡主人公意外获得新责任，通过自己的决定重新赢得信任。角色、冲突与结局均须重新创作。',basis:'AI 制作前的通用原创主题建议 · 不是原剧剧情',tags:['身份反转','成长']},
   {id:'concept-choice',title:'原创方向 B · 价值抉择',summary:domain+'里，两名观点不同的成年人因一个公共难题结伴行动，在利益与原则之间作出艰难选择。',basis:'通用原创主题建议 · 非原著章节或原剧集数',tags:['价值抉择','人物冲突']},
   {id:'concept-mystery',title:'原创方向 C · 悬念与误会',summary:domain+'出现一桩出人意料的误会，几位原创人物从不同角度寻找线索，最终发现问题根源并完成反转。',basis:'通用原创主题建议 · 不依赖受保护的具体故事',tags:['悬念','反转']}
  ];
 }
 function beatOptions(x){
  if(Array.isArray(x?.beats)&&x.beats.length)return x.beats;
  const paragraphs=story.synopsis.split(/\n+/).map(v=>v.trim()).filter(v=>v.length>=15).slice(0,8);
  if(paragraphs.length)return paragraphs.map((v,i)=>({id:'author-'+i,title:'作者提供的第 '+(i+1)+' 段',summary:v.slice(0,240),basis:'用户主动提供的可用剧情摘要（非自动抓取原文）',tags:[]}));
  // Book descriptions can contain attributable plot hints. Extract only their own
  // sentences, labeled as metadata-derived choices, never invent chapter numbers.
  if(x?.source_kind==='book_metadata'&&String(x.summary||'').length>50){
    const parts=String(x.summary).split(/[。！？；.!?]/).map(v=>v.trim()).filter(v=>v.length>=23).slice(0,6);
    return parts.map((v,i)=>({id:'meta-'+i,title:'书目简介线索 '+(i+1),summary:v.slice(0,200),basis:'Google Books 公开图书简介 · 非原著章节',tags:[]}));
  }
  // Discovery metadata is not permission to invent missing source episodes.
  // Only in the independent-original mode, offer visibly original themes.
  if(story.mode==='original'&&x?.title)return originalTopicChoices(x);
  return [];
 }
 function quick(id,label){return '<button type="button" class="button story-chip" data-story-quick="'+html(id)+'">'+html(label)+'</button>'}
 function identityLabel(x){
  const card=flowCard(x),rank=x?.rank_snapshot?(' · #'+html(x.rank_snapshot)):'';
  return html(card.identityLabel)+(card.heatEvidenceDate?' · '+html(card.heatEvidenceDate):'')+rank;
 }
 function bookResult(x,i){return '<article class="story-result" role="listitem">'+
  '<div><span class="story-type">'+html(x.type==='drama'?'短剧／网络线索':x.type==='classic'?'经典文学':'网络小说／书目')+'</span>'+
  '<span class="story-rank">'+identityLabel(x)+'</span>'+
  '<h3>'+html(x.title)+'</h3><p>'+html(x.summary||'仅检索到书目／报道线索，请查看来源并提供剧情摘要。')+'</p>'+
  '<small>'+html(flowCard(x).sourceName)+' · '+html(x.author||x.genre||'')+
  (flowCard(x).publishedDate?' · 来源日期 '+html(flowCard(x).publishedDate):' · 来源日期待核')+' · '+html(flowCard(x).heatLabel)+' · '+html(flowCard(x).rightsLabel)+'</small></div>'+
  '<div class="story-actions"><a target="_blank" rel="noopener noreferrer" href="'+html(limitedSource(x))+'">查看来源 ↗</a>'+
  '<button type="button" class="button dark" data-story-select="'+i+'">选择剧情 →</button></div></article>';
 }
 function selection(){
  const x=story.selected;if(!x)return '';
  const beats=beatOptions(x);
  return '<section class="story-selected"><div class="story-selected-head"><div><div class="kicker">STORY SELECTION / 分段选取</div><h3>'+html(x.title)+'</h3>'+
  '<p>'+html(x.summary||'已找到题名，暂缺足够原著剧情，请手动输入有权使用的剧情摘要。')+'</p></div>'+
  '<button class="button" data-story-back="1">返回结果</button></div>'+
  '<p class="story-rights '+(isProtected(x)?'warning':'')+'"><strong>'+html(isProtected(x)?'受版权保护／权利待核实':'公版候选')+'：</strong>'+html(x.rights_note||'请核对原作、版本和目标出版地区的版权与改编许可。')+'</p>'+
  (x.source_kind==='web_search_lead'?'<p class="story-note">此结果仅为公开报道线索，不代表剧名已核实。进入漫画制作前请查看实际作品资料。</p>':'')+
  (!Array.isArray(x.beats)||!x.beats.length?'<label class="story-paste">可补充更准确、你有权使用的剧情简介（每段一行）<textarea id="story-synopsis" rows="4" placeholder="请粘贴你有权使用的剧情概要；不可直接粘贴受保护作品的大段原文。">'+html(story.synopsis)+'</textarea></label>'+
   '<button type="button" class="button" data-story-parse="1">从概要提取可选片段</button><p class="story-note">仅按你输入的段落拆分，不伪造原著章节。未核实剧情时，原创模式仅提供独立主题方向，不声称是原剧内容。</p>':'')+
  '<div class="story-beats">'+(beats.length?beats.map((b,i)=>
   '<label class="story-beat"><input type="checkbox" data-story-beat="'+html(b.id)+'" '+(story.chosen.has(String(b.id))?'checked':'')+'>'+
   '<span><strong>'+String(i+1).padStart(2,'0')+' · '+html(b.title)+'</strong><small>'+html(b.summary)+'</small><em>'+html(b.basis||'资料概要 · 非具体集数')+'</em></span></label>').join(''):
   '<div class="story-none">暂缺可核实的原作剧情。忠实改编请补充有权使用的剧情概要；原创模式可选择独立主题方向。</div>')+'</div>'+
  '<div class="story-production-choices"><div><label for="story-adaptation">改编方式</label><select id="story-adaptation">'+
  '<option value="original"'+(story.mode==='original'?' selected':'')+'>全新原创故事（仅取抽象主题，不复刻人物）</option>'+
  '<option value="faithful"'+(story.mode==='faithful'?' selected':'')+'>忠实改编（须确认公版或有效授权）</option></select></div>'+
  (isProtected(x)&&story.mode==='faithful'?'<div class="story-proof"><label for="story-rights-url">改编授权依据 URL（必填）</label>'+
   '<input id="story-rights-url" type="url" placeholder="https://... 已获得的有效授权证明" value="'+html(story.rightsURL)+'">'+
   '<label><input type="checkbox" id="story-rights-consent" '+(story.rightsConsent?'checked':'')+'>我有此作品的改编权，且会在终审上传有效授权证据。</label></div>':'')+
  '</div><div class="story-selection-foot"><span id="story-selected-count">已选择 '+story.chosen.size+' 段</span>'+
  '<button type="button" class="button dark" data-story-create="1">建立漫画草稿，进入 AI 编剧 →</button></div>'+
  '<p class="story-note">建稿不会自动购买模型服务或发起出版。你可以在导演台编辑剧情，最终生产仍经过样稿、GitHub QA 与作者终审。</p></section>';
 }
 function block(){
  return '<section class="story-discovery" id="storyDiscovery"><div class="story-discovery-head"><div>'+
   '<div class="kicker">WORLD/TOON · STORY SOURCE DESK</div><h2>红果热剧 · 网络小说 · 世界名著</h2>'+
   '<p>先查来源与作品身份，再核对版权并选择可用剧情，最后进入现有编剧 → 导演 → 生产工作台。所有榜单显示来源与日期，未核实热度会明确标记。</p></div>'+
   '<span>来源 → 身份/版权 → 剧情候选 → 工作台</span></div>'+
   '<ol class="story-flow-steps"><li>搜索来源</li><li>核对作品身份与权利</li><li>选择剧情弧线或原创灵感</li><li>进入编剧与生产 SOP</li></ol>'+
   '<form id="story-search-form" class="story-search-form"><label for="story-query">作品名 / 原著名 / 关键词</label><div class="story-search-fields">'+
   '<select id="story-type" aria-label="搜索类别"><option value="drama"'+(story.type==='drama'?' selected':'')+'>红果短剧 / 网剧</option>'+
   '<option value="novel"'+(story.type==='novel'?' selected':'')+'>小说 / 世界名著</option><option value="all"'+(story.type==='all'?' selected':'')+'>全网综合</option></select>'+
   '<input id="story-query" maxlength="90" placeholder="输入：他过分野、简爱、Jane Eyre…" value="'+html(story.query)+'">'+
   '<button class="button dark" type="submit" '+(story.busy?'disabled':'')+'>'+(story.busy?'正在核查…':'搜索作品与剧情')+'</button></div></form>'+
   '<div class="story-quick">'+quick('他过分野','《他过分野》')+quick('简爱','《简·爱》')+
   '<button type="button" class="button story-chip" data-story-hot="1">查看带日期的第三方短剧榜单快照 / 网络题名线索</button></div>'+
   (story.error?'<div class="story-error" role="alert"><strong>'+html(window.WTDiscoveryFlow?.errorState(/timeout|超时|abort/i.test(story.error)?'timeout':'failure').title||'搜索失败')+'</strong><p>'+html(story.error)+'</p><small>来源失败状态不会替换成推测剧情或模拟热度。</small></div>':'')+
   (story.warnings.length?'<p class="story-note">部分来源暂不可用：'+html(story.warnings.join('；'))+'</p>':'')+
   (story.loaded?'<div class="story-results-top"><strong>'+story.items.length+' 条候选资料</strong><small>查询时间 '+html(story.when||'')+(story.sourceAge?' · '+html(story.sourceAge):'')+' · 源自公开书目与报道、已核对精选资料；非原著全文</small></div>':'')+
   (story.selected?selection():(story.loaded?'<div class="story-results" role="list">'+(story.items.length?story.items.map(bookResult).join(''):'<div class="story-none"><strong>'+html(window.WTDiscoveryFlow?.errorState('empty').title||'没有匹配结果')+'</strong><p>'+html(window.WTDiscoveryFlow?.errorState('empty').message||'试试原名、作者名，或切换小说／短剧分类。')+'</p></div>')+'</div>':''))+
   '</section>';
 }
 async function search(q,type,force){
  if(story.busy)return;
  story.busy=true;story.error='';story.warnings=[];story.query=q;story.type=type;story.selected=null;story.chosen.clear();
  render();
  const key='wt-story-cache-'+type+'-'+q.toLowerCase();let fromCache=false;
  try{
   let obj=null;
   if(!force){try{const old=JSON.parse(localStorage.getItem(key)||'null');if(old&&Date.now()-old.savedAt<900000){obj=old.doc;fromCache=true}}catch{}}
   if(!obj){
    const u='/api/comic/story-search?type='+encodeURIComponent(type)+'&q='+encodeURIComponent(q);
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),18000);
    try{
     const res=await fetch(u,{signal:abort.signal,cache:'no-store'});
     obj=await res.json().catch(()=>({error:'服务器返回格式异常'}));
     story.warnings=obj.warnings||[];
     if(!res.ok||obj.error)throw Error(obj.error||'剧情搜索请求失败 HTTP '+res.status);
    }finally{clearTimeout(timeout)}
    if(!obj||!Array.isArray(obj.items))throw Error('剧情搜索接口未返回有效列表');
    try{localStorage.setItem(key,JSON.stringify({doc:obj,savedAt:Date.now()}))}catch{}
   }
   story.items=obj.items.slice(0,35);story.warnings=obj.warnings||[];
   story.loaded=true;story.when=String(obj.searched_at||'').replace('T',' ').slice(0,16);
   story.sourceAge=fromCache?'15 分钟内缓存':'实时检索 / 带日期精选快照';
  }catch(err){
   story.error='检索未完成：'+String(err.message||err).slice(0,240);
   story.items=[];story.loaded=true;
  }finally{story.busy=false; if(ui.route==='live')render()}
 }
 function choose(i){
  const x=story.items[Number(i)];if(!x)return;
  story.selected=x;story.mode=x.rights==='public_domain_us'?'faithful':'original';
  story.chosen.clear();story.synopsis='';story.rightsURL='';story.rightsConsent=false;render();
 }
 function createProjectFromStory(){
  const x=story.selected;if(!x)throw Error('请先选择作品');
  const beats=beatOptions(x).filter(b=>story.chosen.has(String(b.id)));
  if(!beats.length)throw Error('请至少勾选一段已核对的剧情或自行提供概要');
  const faithful=story.mode==='faithful',protectedWork=isProtected(x);
  const rightsURL=story.rightsURL.trim();
  if(protectedWork&&faithful&&(!story.rightsConsent||!/^https:\/\/[\w.-]+\//.test(rightsURL)))
   throw Error('忠实改编受保护作品，须由作者确认权限并填写可核对的授权依据链接');
  const srcTitle=x.title,summary=beats.map(b=>b.summary).join('；').slice(0,1000);
  const abstract=beats.map(b=>(Array.isArray(b.tags)&&b.tags.length?b.tags.join('、'):b.title)).join('；').slice(0,650);
  const p=emptyProject();
  p.title=faithful?'《'+srcTitle+'》：'+beats[0].title+'（漫画改编）':'原创漫画 · '+(x.genre||'成长与关系')+'新篇';
  p.category=x.type==='drama'?'娱乐':'文化';
  p.sourceTitle=srcTitle;p.sourceURLs=limitedSource(x);
  p.storySourceSelection={
   source_id:x.id||'',title:srcTitle,type:x.type,source:x.source,source_name:x.source_name,
   source_kind:x.source_kind,rights:x.rights||'unknown',rights_note:x.rights_note||'',
   adaptation:faithful?'faithful':'original',selected_beats:beats.map(b=>({id:b.id,title:b.title,
    summary:faithful?b.summary:'',basis:b.basis})),license_url:faithful?rightsURL:'',
   license_attested:faithful&&story.rightsConsent,source_checked_at:now(),
   search_date:x.verified_on||x.snapshot_date||'',requires_independent_author_review:true
  };
  p.handoff={mode:faithful?'hotspot':'original'};
  p.description=faithful?summary:'本作仅借鉴公开题材的抽象主题（'+abstract+'），请创造不同人物、地点、关系、关键事件和结局，不照搬《'+srcTitle+'》的原剧情及对白。';
  p.ideaSeed=faithful?('根据已核对的原著剧情片段创作分镜：'+summary):
   ('请创作完全独立原创漫画，抽象主题为：'+abstract+'。角色姓名、独特世界设定、事件因果、关键转折和对白均必须新创，不得重现《'+srcTitle+'》的具体桥段。');
  p.fiction=faithful?'依据列出的公开资料进行分镜改编，保留所选原著事件线；所有补充情节须显著标注原创，尊重原作与合法改编权。':
   '只提炼普遍主题进行独立原创创作，禁止仅替换人物名字、背景仍复制受保护作品的独特表达。';
  p.factNotes='选题来源：'+(x.source_name||'公开资料')+'\n网址：'+x.source+'\n'+
   '资料类型：'+(x.source_kind||'unknown')+'\n'+
   '本次选择：'+beats.map(b=>b.title+'（'+b.basis+'）').join('；')+'\n'+
   '版权：'+(x.rights_note||'待核查')+'\n未自动获取原著全文，剧情仍须由作者核对。';
  p.disclosure=faithful?'本漫画为所选作品的改编草稿；出版前须核实各发行地区原著及版本的版权与改编许可。':'本漫画为独立原创虚构作品，与所参考短剧／小说原有角色、具体情节及对白无关联。';
  p.panels=Array.from({length:Math.max(4,Math.min(60,beats.length*3))},(_,i)=>makePanel(i));
  p.status='草稿';p.plotGenre=x.type==='drama'?'viral-melodrama':'general';
  data.projects.unshift(p);ui.selected=p.id;ui.wt4LastId=p.id;persist();
  nav('workspace/'+p.id+'/1');notify('剧情已选，创建 '+p.panels.length+' 格建议篇幅的漫画草稿；请在 AI 编剧中继续扩写');
 }
 const baseLive=wtLive;
 wtLive=function(){
  if(!story.loaded&&!story.busy&&ui.route==='live')
   Promise.resolve().then(()=>{if(ui.route==='live'&&!story.loaded&&!story.busy)void search('','drama',false)});
  const existing=baseLive(),headEnd=existing.indexOf('</section>');
  return headEnd>=0?existing.slice(0,headEnd+10)+block()+existing.slice(headEnd+10):block()+existing;
 };
 document.addEventListener('submit',ev=>{
  if(ev.target?.id!=='story-search-form')return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const q=document.querySelector('#story-query')?.value?.trim()||'',type=document.querySelector('#story-type')?.value||'drama';
  if(q&&q.length<2){story.error='请输入至少两个字符';render();return}
  void search(q,type,true);
 },true);
 document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-story-quick],[data-story-hot],[data-story-select],[data-story-back],[data-story-parse],[data-story-create]');
  if(!el)return;ev.preventDefault();ev.stopImmediatePropagation();
  try{
   if(el.dataset.storyQuick!==undefined){
    const q=el.dataset.storyQuick;void search(q,q==='简爱'?'novel':'drama',true);
   }else if(el.dataset.storyHot!==undefined)void search('','drama',true);
   else if(el.dataset.storySelect!==undefined)choose(el.dataset.storySelect);
   else if(el.dataset.storyBack!==undefined){story.selected=null;story.chosen.clear();render()}
   else if(el.dataset.storyParse!==undefined){
    story.synopsis=document.querySelector('#story-synopsis')?.value||'';
    if(!beatOptions(story.selected).length)throw Error('请先填写至少 15 字的剧情概要，每段一行');
    story.chosen.clear();render();
   }else if(el.dataset.storyCreate!==undefined){
    story.rightsURL=document.querySelector('#story-rights-url')?.value||story.rightsURL;
    story.rightsConsent=!!document.querySelector('#story-rights-consent')?.checked;
    createProjectFromStory();
   }
  }catch(e){story.error=String(e.message||e);notify(story.error);render()}
 },true);
 document.addEventListener('input',ev=>{
  const x=ev.target;
  if(x?.id==='story-query')story.query=String(x.value||'').slice(0,90);
  if(x?.id==='story-synopsis')story.synopsis=String(x.value||'').slice(0,4800);
  if(x?.id==='story-rights-url')story.rightsURL=String(x.value||'').slice(0,500);
 },true);
 document.addEventListener('change',ev=>{
  const x=ev.target;
  if(x?.dataset?.storyBeat!==undefined){if(x.checked)story.chosen.add(x.dataset.storyBeat);
   else story.chosen.delete(x.dataset.storyBeat);
   const n=document.querySelector('#story-selected-count');if(n)n.textContent='已选择 '+story.chosen.size+' 段';return}
  if(x?.id==='story-adaptation'){story.mode=x.value==='faithful'?'faithful':'original';render();return}
  if(x?.id==='story-type')story.type=x.value;
 },true);
 window.WTStoryDiscovery={state:()=>({items:story.items,selected:story.selected,mode:story.mode,chosen:[...story.chosen],
  loaded:story.loaded,error:story.error}),search,choose,createProjectFromStory,beatOptions,block};
 if(ui.route==='live')Promise.resolve().then(()=>{if(ui.route==='live')render()});
})();
