/* WORLD/TOON · Personal Design Studio + AI Character Bible · DAVYLAB */
'use strict';
const WT_UI_DEFAULT={
  layout:'standard',palette:'editorial',motion:'subtle',navPosition:'left',
  collapsed:[],labels:{},
  groups:[
    {id:'discover',name:'发现与选题',items:['dashboard','live','ai-briefing','radar']},
    {id:'create',name:'创作与作品',items:['studio','characters','library']},
    {id:'manage',name:'出版与管理',items:['handoff','publish','account','settings']}
  ]
};
const WT_UI_LABELS={dashboard:'总览',live:'全球热点', 'ai-briefing':'AI 前沿简报',radar:'选题池',
  studio:'创作工作台',characters:'角色档案',library:'漫画书架',handoff:'制作交接',publish:'出版中心',account:'登录与同步',settings:'数据管理'};
const WT_UI_ICONS={dashboard:'◫',live:'◉','ai-briefing':'✳',radar:'◎',studio:'✦',characters:'♧',library:'▦',handoff:'⇄',publish:'↗',account:'♙',settings:'⚙'};
const WT_UI_ROUTE=Object.keys(WT_UI_LABELS);
const wtUiSafe=(x)=>e(String(x||'').slice(0,90));
function wtVisualSettings(){
  if(!data.settings||typeof data.settings!=='object')data.settings={};
  let s=data.settings.visual;
  if(!s||typeof s!=='object'){s=structuredClone(WT_UI_DEFAULT);data.settings.visual=s}
  if(!['standard','wide','compact'].includes(s.layout))s.layout='standard';
  if(!['editorial','noir','warm','sage'].includes(s.palette))s.palette='editorial';
  if(!['none','subtle','lively'].includes(s.motion))s.motion='subtle';
  if(!['left','top'].includes(s.navPosition))s.navPosition='left';
  if(!Array.isArray(s.collapsed))s.collapsed=[];
  if(!s.labels||typeof s.labels!=='object')s.labels={};
  if(!Array.isArray(s.groups)||!s.groups.length)s.groups=structuredClone(WT_UI_DEFAULT.groups);
  const available=new Set(WT_UI_ROUTE),seen=new Set(),clean=[];
  for(const g of s.groups.slice(0,8)){
    if(!g||typeof g!=='object')continue;
    let items=Array.isArray(g.items)?g.items.filter(x=>available.has(x)&&!seen.has(x)):[];
    items.forEach(x=>seen.add(x));
    clean.push({id:String(g.id||'group').slice(0,45),name:String(g.name||'导航分组').slice(0,22),items});
  }
  if(!clean.length)clean.push({id:'discover',name:'导航',items:[]});
  for(const x of WT_UI_ROUTE)if(!seen.has(x)){const g=x==='handoff'?(clean.find(g=>g.id==='manage')||clean[clean.length-1]):clean[0];if(x==='handoff'&&g.items.includes('publish'))g.items.splice(g.items.indexOf('publish'),0,x);else g.items.push(x)}
  s.groups=clean;
  return s;
}
const wtVisualSave=()=>{persist();wtVisualApply();wtVisualDrawPanel()};
function wtVisualNav(){
  const nav=document.getElementById('mainnav');
  if(!nav)return;
  const s=wtVisualSettings();
  const frag=document.createDocumentFragment();
  let index=0;
  for(let i=0;i<s.groups.length;i++){
    const g=s.groups[i];
    const wrap=document.createElement('div');wrap.className='wt-nav-group';
    const isCollapsed=s.collapsed.includes(g.id)&&!g.items.includes(ui.route);
    const head=document.createElement('button');head.type='button';head.className='wt-nav-group-title';
    head.dataset.uiToggle=g.id;head.setAttribute('aria-expanded',String(!isCollapsed));
    head.innerHTML='<span class="wt-nav-group-dot">●</span><span></span><span class="wt-nav-caret">'+(isCollapsed?'＋':'−')+'</span>';
    head.children[1].textContent=g.name;
    const list=document.createElement('div');list.className='wt-nav-items';list.hidden=isCollapsed;
    for(const route of g.items){
      index++;
      const link=document.createElement('a');link.href='#/'+route;link.dataset.route=route;
      link.classList.toggle('active',ui.route===route);
      const ico=document.createElement('span');ico.className='nav-ico';ico.textContent=WT_UI_ICONS[route];
      const name=document.createElement('span');name.className='wt-nav-text';name.textContent=s.labels[route]||WT_UI_LABELS[route];
      const small=document.createElement('small');small.textContent=String(index).padStart(2,'0');
      link.append(ico,name,small);list.append(link);
    }
    wrap.append(head,list);frag.append(wrap);
  }
  nav.replaceChildren(frag);
}
function wtVisualApply(){
  const s=wtVisualSettings();
  document.body.dataset.wtLayout=s.layout;
  document.body.dataset.wtPalette=s.palette;
  document.body.dataset.wtMotion=s.motion;
  document.body.dataset.wtNav=s.navPosition;
  wtVisualNav();
}
const wtVisualOriginalRender=render;
render=function(){wtVisualOriginalRender();wtVisualApply()};
function wtVisualDrawPanel(){
  const root=document.getElementById('wtVisualPanel');
  if(!root||root.hidden)return;
  const s=wtVisualSettings();
  const dropdown=(name,options)=>'<select class="wt-ui-input" data-ui-option="'+name+'">'+
    options.map(([val,label])=>'<option value="'+val+'" '+(s[name]===val?'selected':'')+'>'+label+'</option>').join('')+'</select>';
  const groupOptions=(route)=>s.groups.map((g,i)=>'<option value="'+i+'" '+(g.items.includes(route)?'selected':'')+'>'+wtUiSafe(g.name)+'</option>').join('');
  const groups=s.groups.map((g,gi)=>'<div class="wt-ui-group-config">'+
    '<div class="wt-ui-group-top"><strong>一级目录 '+(gi+1)+'</strong><button data-ui="group-up" data-group="'+gi+'" '+(gi===0?'disabled':'')+' title="上移分组">↑</button><button data-ui="group-down" data-group="'+gi+'" '+(gi===s.groups.length-1?'disabled':'')+' title="下移分组">↓</button></div>'+
    '<label>分组名称<input class="wt-ui-input" maxlength="22" data-ui-group-name="'+gi+'" value="'+wtUiSafe(g.name)+'"></label>'+
    '<div class="wt-ui-list">'+g.items.map((route,ri)=>'<div class="wt-ui-row"><span class="wt-ui-route-icon">'+WT_UI_ICONS[route]+'</span>'+
      '<input aria-label="菜单名称" maxlength="22" class="wt-ui-input" data-ui-route-label="'+route+'" value="'+wtUiSafe(s.labels[route]||WT_UI_LABELS[route])+'">'+
      '<select aria-label="所属一级目录" data-ui-move-route="'+route+'">'+groupOptions(route)+'</select>'+
      '<button title="上移" aria-label="上移" data-ui="route-up" data-route="'+route+'" '+(ri===0?'disabled':'')+'>↑</button>'+
      '<button title="下移" aria-label="下移" data-ui="route-down" data-route="'+route+'" '+(ri===g.items.length-1?'disabled':'')+'>↓</button></div>').join('')+'</div></div>').join('');
  root.innerHTML='<div class="wt-ui-panel-head"><div><small>PERSONAL DESIGN STUDIO</small><h2>视觉与动效</h2><p>调整布局、配色与两级导航。设置自动保存至工作区，并随账号数据同步。</p></div><button data-ui="close" class="wt-ui-x" aria-label="关闭">×</button></div>'+
    '<div class="wt-ui-controls">'+
    '<label>页面布局'+dropdown('layout',[['standard','经典杂志'],['wide','宽屏画廊'],['compact','紧凑工作台']])+'</label>'+
    '<label>色彩风格'+dropdown('palette',[['editorial','编辑部暖纸'],['noir','经典黑白'],['warm','暖砂琥珀'],['sage','鼠尾草绿']])+'</label>'+
    '<label>动效级别'+dropdown('motion',[['subtle','舒缓克制'],['lively','流畅生动'],['none','关闭动效']])+'</label>'+
    '<label>导航位置'+dropdown('navPosition',[['left','左侧导航'],['top','顶部导航']])+'</label></div>'+
    '<div class="wt-ui-config-title"><h3>导航结构</h3><p>一级分组和二级页面都可重命名、上下移动；还可以修改页面所属分组。</p></div>'+
    groups+'<div class="wt-ui-footer"><button data-ui="reset" class="button">恢复默认布局</button><button data-ui="close" class="button dark">完成</button></div>';
}
function wtVisualOpen(){
  const panel=document.getElementById('wtVisualPanel'),backdrop=document.getElementById('wtVisualBackdrop');
  panel.hidden=false;backdrop.hidden=false;document.body.classList.add('wt-ui-open');wtVisualDrawPanel();
  panel.querySelector('[data-ui=close]')?.focus();
}
function wtVisualClose(){
  document.getElementById('wtVisualPanel').hidden=true;
  document.getElementById('wtVisualBackdrop').hidden=true;
  document.body.classList.remove('wt-ui-open');
  document.getElementById('wtVisualToggle')?.focus();
}
(function wtVisualMount(){
  const btn=document.createElement('button');btn.type='button';btn.className='button wt-ui-toolbar';btn.id='wtVisualToggle';
  btn.innerHTML='◩ <span>视觉与动效</span>';
  const tools=document.querySelector('.right-tools');
  if(tools)tools.insertBefore(btn,tools.querySelector('#topNew'));
  const backdrop=document.createElement('div');backdrop.id='wtVisualBackdrop';backdrop.className='wt-ui-backdrop';backdrop.hidden=true;
  const panel=document.createElement('aside');panel.id='wtVisualPanel';panel.className='wt-ui-panel';panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','视觉与动效设置');panel.setAttribute('aria-modal','true');panel.hidden=true;
  document.body.append(backdrop,panel);btn.addEventListener('click',wtVisualOpen);backdrop.addEventListener('click',wtVisualClose);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!panel.hidden)wtVisualClose()});
  panel.addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-ui]');if(!btn)return;
    const s=wtVisualSettings(),act=btn.dataset.ui,g=Number(btn.dataset.group),route=btn.dataset.route;
    if(act==='close'){wtVisualClose();return}
    if(act==='reset'){if(confirm('恢复初始布局及导航设置？不会删除作品或角色。')){data.settings.visual=structuredClone(WT_UI_DEFAULT);wtVisualSave()}return}
    if(act==='group-up'||act==='group-down'){
      const to=g+(act==='group-up'?-1:1);if(to>=0&&to<s.groups.length){[s.groups[g],s.groups[to]]=[s.groups[to],s.groups[g]];wtVisualSave()}return}
    if(act==='route-up'||act==='route-down'){
      const group=s.groups.find(z=>z.items.includes(route));if(!group)return;
      const i=group.items.indexOf(route),j=i+(act==='route-up'?-1:1);
      if(j>=0&&j<group.items.length){[group.items[i],group.items[j]]=[group.items[j],group.items[i]];wtVisualSave()}
    }
  });
  panel.addEventListener('change',ev=>{
    const t=ev.target,s=wtVisualSettings();
    if(t.dataset.uiOption){s[t.dataset.uiOption]=t.value;wtVisualSave()}
    else if(t.dataset.uiGroupName!==undefined){
      const i=Number(t.dataset.uiGroupName);if(s.groups[i]){s.groups[i].name=t.value.trim().slice(0,22)||'导航分组';wtVisualSave()}
    }else if(t.dataset.uiRouteLabel){
      const route=t.dataset.uiRouteLabel;if(WT_UI_LABELS[route]){s.labels[route]=t.value.trim().slice(0,22)||WT_UI_LABELS[route];wtVisualSave()}
    }else if(t.dataset.uiMoveRoute){
      const route=t.dataset.uiMoveRoute,to=Number(t.value);
      if(s.groups[to]){for(const g of s.groups)g.items=g.items.filter(x=>x!==route);s.groups[to].items.push(route);wtVisualSave()}
    }
  });
  document.addEventListener('click',ev=>{const btn=ev.target.closest('[data-ui-toggle]');if(!btn)return;
    const s=wtVisualSettings(),id=btn.dataset.uiToggle;if(s.collapsed.includes(id))s.collapsed=s.collapsed.filter(x=>x!==id);else s.collapsed.push(id);
    persist();wtVisualNav();
  });
  wtVisualApply();
})();
const wtOriginalCharacters=wtCharacters;
wtCharacters=function(){
  const p=selected();
  const active=!!(wtConfig?.aiEnabled&&wtSession?.access_token);
  const note=active?'已连接，可依据当前作品生成原创人物卡':'需要登录并在管理端启用 AI 模型，才可进行真实 AI 自动生成';
  const button='<button type="button" class="button dark" data-persona="prepare">✦ AI 生成角色档案</button>';
  return wtOriginalCharacters()+
    '<section class="wt-ai wt-persona-entry"><div class="kicker">CHARACTER CREATION ENGINE</div><h2>AI 原创角色设计</h2><p>'+wtUiSafe(note)+'</p>'+
    '<p class="minor">以当前漫画“'+wtUiSafe(p?.title||'未选择作品')+'”为创作背景，生成外貌、服装、代表色、性格与跨格固定特征；生成后可逐项编辑。</p><div class="buttons">'+button+
    '<a class="button" href="#/account">账户与 AI 状态 ↗</a></div></section>';
};
function wtPersonaPrepare(){
  const p=selected();
  modal('<div class="kicker">AI / CAST DESIGN</div><h2>自动生成原创角色</h2>'+
    '<p class="minor">角色以虚构人物为主，禁止将真实人物的未经证实行为生成成“人物设定”。生成属于草稿，可修改、删除。</p>'+
    '<form id="wtPersonaForm"><div class="fields">'+
    '<div class="field wide"><label>创作背景</label><textarea name="concept" required maxlength="2000">'+wtUiSafe(p?.description||p?.title||'一部原创时事讽刺漫画')+'</textarea></div>'+
    '<div class="field"><label>角色数量</label><select name="count"><option value="2">2 位</option><option value="3" selected>3 位</option><option value="4">4 位</option><option value="1">1 位</option></select></div>'+
    '<div class="field"><label>视觉调性</label><select name="style"><option>杂志式原创漫画</option><option>温暖手绘</option><option>黑色幽默</option><option>未来科幻</option></select></div></div>'+
    '<p class="wt-note">'+(!wtConfig?.aiEnabled?'当前 AI 推理尚未启用，需审批费用后才能生成。':!wtSession?.access_token?'请先登录账户后再生成。':'每次点击均为单次 AI 调用，可能产生模型费用。')+'</p>'+
    '<div class="stepactions"><button type="button" data-action="modal-close" class="button">取消</button>'+
    '<button class="button dark" type="submit" '+(!wtConfig?.aiEnabled||!wtSession?.access_token?'disabled':'')+'>确认生成角色草稿</button></div></form>');
}
async function wtPersonaGenerate(form){
  if(wtAiBusy)return;
  if(!wtConfig?.aiEnabled||!wtSession?.access_token){notify('AI 服务尚未启用或未登录');return}
  if(!confirm('即将调用 AI 生成原创角色草稿，可能占用模型额度或产生费用。继续吗？'))return;
  const values=Object.fromEntries(new FormData(form).entries());
  wtAiBusy=true;
  const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=true;
  try{
    const p=selected();
    const out=await wtCallAI('/api/ai/characters',{title:String(p?.title||'原创时事漫画').slice(0,150),concept:String(values.concept||'').slice(0,2000),style:String(values.style||'').slice(0,70),count:Math.min(4,Math.max(1,Number(values.count)||2))});
    if(!Array.isArray(out.characters)||!out.characters.length)throw Error('模型未返回有效角色档案');
    if(!Array.isArray(data.characters))data.characters=[];
    let added=0;
    for(const c of out.characters.slice(0,4)){
      if(!c||typeof c!=='object'||!String(c.name||'').trim())continue;
      data.characters.push({id:uid(),name:String(c.name).slice(0,80),type:['虚构角色','拟人化角色','抽象象征'].includes(c.type)?c.type:'虚构角色',
        description:String(c.description||'').slice(0,1800),costume:String(c.costume||'').slice(0,400),colors:String(c.colors||'').slice(0,220),
        traits:String(c.traits||'').slice(0,950),personality:String(c.personality||'').slice(0,1200),portrait:'',origin:'ai-draft',createdAt:now()});added++;
    }
    persist();closeModal();nav('characters');notify('新增 '+added+' 个 AI 角色草稿，可逐个编辑或上传定妆照');
  }catch(err){notify('角色生成失败：'+String(err.message||err).slice(0,140))}
  finally{wtAiBusy=false;if(submit?.isConnected)submit.disabled=false}
}
document.addEventListener('click',ev=>{const t=ev.target.closest('[data-persona]');if(!t)return;ev.preventDefault();ev.stopImmediatePropagation();if(t.dataset.persona==='prepare')wtPersonaPrepare()},true);
document.addEventListener('submit',ev=>{if(ev.target?.id!=='wtPersonaForm')return;ev.preventDefault();ev.stopImmediatePropagation();wtPersonaGenerate(ev.target)},true);
