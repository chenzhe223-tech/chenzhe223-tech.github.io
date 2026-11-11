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
 function bookResult(x,i){return '<article class="story-result" role="listitem">'+
  '<div><span class="story-type">'+html(x.type==='drama'?'短剧／网络线索':x.type==='classic'?'经典文学':'网络小说／书目')+'</span>'+
  (x.rank_snapshot?'<span class="story-rank">第三方榜单 '+html(x.verified_on||x.snapshot_date||'')+' · #'+x.rank_snapshot+'</span>':'')+
  '<h3>'+html(x.title)+'</h3><p>'+html(x.summary||'仅检索到书目／报道线索，请查看来源并提供剧情摘要。')+'</p>'+
  '<small>'+html(x.source_name||'公开资料')+' · '+html(x.author||x.genre||'')+' · '+html(x.rights==='public_domain_us'?'公版候选（按地区核对）':'版权待核实')+'</small></div>'+
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
   '<p>先查作品与来源，再选剧情片段，最后进入同一个漫画工作空间。热度展示仅作线索，不冒充红果官方数据。</p></div>'+
   '<span>STORY → PANELS</span></div>'+
   '<form id="story-search-form" class="story-search-form"><label for="story-query">作品名 / 原著名 / 关键词</label><div class="story-search-fields">'+
   '<select id="story-type" aria-label="搜索类别"><option value="drama"'+(story.type==='drama'?' selected':'')+'>红果短剧 / 网剧</option>'+
   '<option value="novel"'+(story.type==='novel'?' selected':'')+'>小说 / 世界名著</option><option value="all"'+(story.type==='all'?' selected':'')+'>全网综合</option></select>'+
   '<input id="story-query" maxlength="90" placeholder="输入：他过分野、简爱、Jane Eyre…" value="'+html(story.query)+'">'+
   '<button class="button dark" type="submit" '+(story.busy?'disabled':'')+'>'+(story.busy?'正在核查…':'搜索作品与剧情')+'</button></div></form>'+
   '<div class="story-quick">'+quick('他过分野','《他过分野》')+quick('简爱','《简·爱》')+
   '<button type="button" class="button story-chip" data-story-hot="1">查看红果热点快照 / 网络新线索</button></div>'+
   (story.error?'<div class="story-error" role="alert">'+html(story.error)+'</div>':'')+
   (story.warnings.length?'<p class="story-note">部分来源暂不可用：'+html(story.warnings.join('；'))+'</p>':'')+
   (story.loaded?'<div class="story-results-top"><strong>'+story.items.length+' 条候选资料</strong><small>查询时间 '+html(story.when||'')+(story.sourceAge?' · '+html(story.sourceAge):'')+' · 源自公开书目与报道、已核对精选资料；非原著全文</small></div>':'')+
   (story.selected?selection():(story.loaded?'<div class="story-results" role="list">'+(story.items.length?story.items.map(bookResult).join(''):'<div class="story-none">没有找到可核实的候选作品。试试原名、作者名，或切换小说／短剧分类。</div>')+'</div>':''))+
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
     if(!res.ok)throw Error(obj.error||'剧情搜索请求失败 HTTP '+res.status);
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
