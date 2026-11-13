/* WORLD/TOON Visual Research: licensed museum images, as references only. */
'use strict';
(function(){
let query='',busy=false,items=[],warning='',searched=false,counts=[],lastAutoProject='';
const presets=[['interior','空间布置'],['clothing','人物着装'],['accessory','装饰配饰'],['architecture','建筑场景'],['ancient ship','交通工具'],['color palette','色彩与纹样']];
const assetTypes=[['interior','空间布置'],['clothing','人物着装'],['accessory','装饰品与配饰'],['architecture','建筑结构'],['prop','手持道具'],['palette','色彩与纹样'],['portrait-style','人物造型灵感']];
let pendingPin=-1;
function suggestedQuery(p){
 const x=String([p?.title,p?.sourceTitle,p?.description,p?.category].filter(Boolean).join(' ')).slice(0,1500);
 if(/郑和|船|海洋|航海|ship|ocean|sea/i.test(x))return 'ship';
 if(/唐|三国|宋朝|秦朝|丝绸|中国|China|Chinese|东亚/i.test(x))return 'Chinese art';
 if(/Rome|Roman|罗马/i.test(x))return 'Roman';
 if(/Greece|Greek|希腊/i.test(x))return 'Greek';
 if(/建筑|寺庙|宫殿|castle|architecture/i.test(x))return 'architecture';
 if(/机器人|发明|科技|scientific|机器|instrument/i.test(x))return 'scientific instrument';
 if(/旅行|风景|山水|landscape/i.test(x))return 'landscape';
 if(/服装|fashion|costume|衣着|传统服饰/i.test(x))return 'clothing';
 return 'portrait';
}
function refList(p){return Array.isArray(p.visualReferences)?p.visualReferences:[]}
function panel(p){
 const refs=refList(p);
 const pins=refs.map(r=>'<article class="heritage-pin"><span class="heritage-pin-title">'+e(r.title)+'</span><span class="minor">'+e(r.assetTypeLabel||r.assetType||'素材类别待标')+' · '+e(r.appliesTo?.scope==='panel'?'第 '+r.appliesTo.targetId+' 格':r.appliesTo?.scope==='character'?'角色 '+(r.appliesTo.characterName||r.appliesTo.targetId):'本作品通用参考')+' · '+e(r.source)+' · '+e(r.license||'授权需复核')+'</span><button type="button" class="button" data-visual="unpin" data-id="'+e(r.id)+'">移除</button></article>').join('');
 const gallery=items.map((r,i)=>'<article class="heritage-art">'+
 '<div class="heritage-art-thumb"><img loading="lazy" referrerpolicy="no-referrer" src="'+e(r.image)+'" alt="'+e(r.title)+'视觉参考"></div>'+
 '<div class="heritage-art-copy"><strong>'+e(r.title)+'</strong><span class="minor">'+e(r.artist||'作者未标注')+' · '+e(r.date||'年代未标注')+'</span>'+
 '<span class="heritage-license">CC0 · 公有领域</span>'+
 '<div class="buttons"><a class="button" rel="noopener noreferrer" target="_blank" href="'+e(r.source_url)+'">馆藏记录</a>'+
  '<button type="button" class="button dark" data-visual="pin" data-index="'+i+'">选择应用对象</button></div></div></article>').join('');
 const helper=searched?(items.length?'找到 '+items.length+' 项 CC0 图片 · '+counts.map(x=>x.id+' '+x.count+(x.ok?'':'（不可用）')).join('、'):'无可用图片，请尝试其他英文关键词。'):'进入作品后自动按主题匹配 CC0 馆藏；也可以手动修改关键词。仅作为创作参考，不直接复制为漫画画格。';
 return '<section class="box heritage-visual-panel" aria-label="视觉素材库"><div class="kicker">VISUAL REFERENCES / OPEN CULTURE</div>'+
  '<div class="heritage-header"><div><h2>创作视觉素材库</h2><p class="minor">按空间布置、人物着装、配饰道具、建筑和色彩选材；每项素材都要指定作用位置，避免所有参考套用到每一格。</p></div><span class="wt-chip">本作已选 '+refs.length+' 项</span></div>'+
 '<form id="wtVisualSearch" class="heritage-search"><input id="wtVisualInput" name="q" type="search" required minlength="2" maxlength="100" placeholder="建议英文：ancient ship, portrait, architecture…" value="'+e(query)+'"><button class="button dark" type="submit"'+(busy?' disabled':'')+'>'+(busy?'检索中…':'搜索馆藏')+'</button></form>'+
 '<div class="buttons"><button type="button" class="button" data-visual="own">＋ 登记自有 / 授权素材</button></div>'+
 '<div class="heritage-presets">'+presets.map(([q,l])=>'<button type="button" data-visual="preset" data-query="'+e(q)+'">'+e(l)+'</button>').join('')+'</div>'+
 (refs.length?'<div class="heritage-pins">'+pins+'</div>':'')+
 '<p class="minor">'+e(helper)+'</p>'+
 (warning?'<p class="wt-error">'+e(warning)+'</p>':'')+
 (gallery?'<div class="heritage-grid">'+gallery+'</div>':'')+
 '<p class="heritage-footnote">图片用于原创设计参考，不代表真实历史场景。选入参考不会直接写入成品画格；公众人物和受版权保护的现代作品须单独核查。</p></section>';
}
async function search(q){
 if(busy)return;
 query=String(q||'').trim().slice(0,100);
 if(query.length<2){notify('请输入至少两个字符的搜索词');return}
 busy=true;warning='';render();
 try{
  const res=await fetch('/api/comic/visuals?q='+encodeURIComponent(query),{cache:'no-store'});
  const body=await res.json();
  if(!res.ok)throw Error(body.error||'馆藏接口暂不可用');
  items=(body.items||[]).filter(x=>x.license==='CC0'&&x.rights_verified===true&&/^https:\/\//.test(x.source_url));
  counts=body.counts||[];warning=(body.warnings||[]).join('；');searched=true;
 }catch(err){items=[];counts=[];searched=true;warning=String(err.message||err).slice(0,150)}
 finally{busy=false;render()}
}
function validateApplication(reference,target={}){
 const scope=String(target.scope||reference?.appliesTo?.scope||''),type=String(reference?.assetType||'');
 const compatible={interior:['project','panel','location'],clothing:['panel','character','outfit'],accessory:['panel','character','outfit'],architecture:['project','panel','location'],prop:['panel','character','object'],palette:['project','panel'], 'portrait-style':['character','panel']};
 if(!compatible[type])return {ok:false,reason:'素材类别未分类'};
 if(!compatible[type].includes(scope))return {ok:false,reason:'素材类别与应用对象不匹配'};
 if(scope==='panel'&&!String(target.targetId||reference?.appliesTo?.targetId||''))return {ok:false,reason:'需指定画格'};
 if(['character','outfit','object'].includes(scope)&&!String(target.targetId||reference?.appliesTo?.targetId||''))return {ok:false,reason:'需指定目标角色或道具'};
 return {ok:true,reason:''};
}
function addReference(p,item,policy={}){
 const cc0=item?.license==='CC0'&&item?.rights_verified===true;
 const selfOwned=item?.rightsStatus==='author_self_owned'&&item?.userAttested===true;
 const authorized=item?.rightsStatus==='author_authorized'&&/^https:\/\/[\w.-]+\//.test(String(item?.licenseEvidenceUrl||''));
 if(!p||!item||(!cc0&&!selfOwned&&!authorized))throw Error('素材需为已确认 CC0、自有或有可核验授权依据的内容');
 const arr=refList(p);if(arr.some(x=>x.id===item.id)){notify('这项参考素材已收录');return}
 const type=assetTypes.find(x=>x[0]===policy.assetType);if(!type)throw Error('请先选择素材用途');
 const scope=['project','panel','character','outfit','location','object'].includes(policy.scope)?policy.scope:'';if(!scope)throw Error('请指定素材作用范围');
 if(scope==='panel'&&!/^\d{1,2}$/.test(String(policy.targetId||'')))throw Error('请选择要应用的画格');
 if(['character','outfit','object'].includes(scope)&&!String(policy.targetId||''))throw Error('请选择目标角色或道具');
 const reference={assetType:type[0],appliesTo:{scope,targetId:scope==='project'?'project':String(policy.targetId||''),characterName:String(policy.characterName||'')}};
 const application=validateApplication(reference,{scope,targetId:policy.targetId});if(!application.ok)throw Error(application.reason);
 p.visualReferences=[...arr,{id:item.id,title:item.title,artist:item.artist,date:item.date,
  image:item.image,source:item.source,source_url:item.source_url,license:item.license||'作者确认自有/授权',license_evidence_url:item.licenseEvidenceUrl||'',rights_verified:true,rightsStatus:cc0?'verified_cc0':item.rightsStatus,assetType:type[0],assetTypeLabel:type[1],
  appliesTo:reference.appliesTo,role:'visual_reference_only'}].slice(0,24);
 setChange(p,'添加 '+item.source+' 的 CC0 视觉参考：'+item.title);
 render();notify('已加入视觉参考库；素材将按所选角色或画格应用');
}
function ownDialog(){modal('<div class="kicker">PRIVATE ASSET / OWNER OR LICENSED</div><h2>登记自有或已授权素材</h2><form id="wtVisualOwnForm"><div class="fields"><div class="field"><label>素材名称</label><input name="title" required maxlength="180"></div><div class="field"><label>图片 URL</label><input name="imageUrl" type="url" required placeholder="https://…"></div><div class="field"><label>来源/作者</label><input name="source" required maxlength="180" placeholder="自摄、原创、馆藏或授权方"></div><div class="field"><label>权利状态</label><select name="rights"><option value="self">我拥有该素材的使用权</option><option value="authorized">我已取得可用于本作品的授权</option></select></div><div class="field wide"><label>授权凭证链接（授权素材必填）</label><input name="licenseEvidenceUrl" type="url" maxlength="500" placeholder="https://…"></div><div class="field"><label>素材用途</label><select name="assetType">'+assetTypes.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></div><div class="field"><label>应用范围</label><select name="scope"><option value="panel">指定画格</option><option value="character">角色造型参考</option><option value="project">本作品通用空间/色彩</option></select></div><div class="field"><label>目标 ID（画格序号或角色名）</label><input name="targetId" required value="'+Math.max(1,Number(ui.panel||0)+1)+'"></div></div><label class="wt-visual-attest"><input name="attest" type="checkbox" required>我确认自己拥有该素材使用权或持有适用授权，且该素材不侵犯他人肖像和隐私权。</label><p class="wt-note">素材仅存于本机/本账号私有空间；授权素材需提供凭证链接。登记不等于平台替你核验授权。</p><div class="stepactions"><button type="button" class="button" data-action="modal-close">取消</button><button class="button dark" type="submit">登记并绑定用途</button></div></form>')}
function openForWorkspace(){const p=selected();if(p)modal('<div class="kicker">VISUAL REFERENCES / WORKSPACE</div><h2>本作品视觉素材与应用</h2>'+panel(p))}
function pinDialog(p,index){const item=items[index];if(!item)return;pendingPin=index;const chars=p.creativeDirection?.cast||[];const options=chars.map((c,i)=>'<option value="'+e(c.characterId||c.id||c.name)+'" data-name="'+e(c.name)+'">'+e(c.name||'角色 '+(i+1))+'</option>').join('');
 modal('<div class="kicker">VISUAL ASSET / APPLICATION</div><h2>'+e(item.title)+'</h2><p>'+e(item.source)+' · '+e(item.license)+' · '+e(item.date||'年代待核')+'</p><form id="wtVisualApplyForm"><div class="fields"><div class="field"><label>素材用途</label><select name="assetType">'+assetTypes.map(x=>'<option value="'+x[0]+'">'+x[1]+'</option>').join('')+'</select></div><div class="field"><label>应用范围</label><select name="scope"><option value="panel">指定画格</option><option value="character">角色造型参考</option><option value="project">本作品通用空间/色彩</option></select></div><div class="field" data-visual-panel><label>画格（1–'+(p.panels?.length||9)+'）</label><input type="number" name="targetId" min="1" max="'+(p.panels?.length||9)+'" value="'+Math.max(1,Number(ui.panel||0)+1)+'"></div><div class="field" data-visual-character hidden><label>目标角色</label><select name="characterId">'+(options||'<option value="">请先在创意导演台设定角色</option>')+'</select></div></div><p class="wt-note">素材只能用于创作参考；入选不会复制馆藏图片到漫画画格。</p><div class="stepactions"><button type="button" class="button" data-action="modal-close">取消</button><button class="button dark" type="submit">加入并绑定用途</button></div></form>');
}
function referencesForPanel(p,index){const target=Number(index)+1,panel=p?.panels?.[Number(index)]||{},text=String([panel.scene,panel.dialogue,panel.prompt].join(' '));return refList(p).filter(r=>{const scope=r.appliesTo;if(!scope)return r.license==='CC0';if(r.rightsStatus!=='verified_cc0'&&r.rightsStatus!=='author_self_owned'&&r.rightsStatus!=='author_authorized')return false;if(scope.scope==='project')return true;if(scope.scope==='panel')return String(scope.targetId)===String(target)||String(scope.targetId)===String(panel.id||'');if(scope.scope==='character')return !!scope.characterName&&text.includes(scope.characterName);return false})}
const previousStudio=studio;
studio=function(){
 const p=selected();
 if(p&&location.hash.startsWith('#/studio')&&lastAutoProject!==p.id){
  lastAutoProject=p.id;query=suggestedQuery(p);items=[];counts=[];warning='';searched=false;
  setTimeout(()=>search(query),0);
 }
 return previousStudio()+(p?panel(p):'');
};
document.addEventListener('click',ev=>{
 const open=ev.target.closest('[data-visual-open]');if(open){ev.preventDefault();ev.stopImmediatePropagation();openForWorkspace();return}
 const btn=ev.target.closest('[data-visual]');if(!btn)return;ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected(),type=btn.dataset.visual;
 if(type==='preset'){search(btn.dataset.query);return}
 if(!p)return;
 if(type==='pin'){pinDialog(p,Number(btn.dataset.index))}
 if(type==='own'){ownDialog()}
 if(type==='unpin'){p.visualReferences=refList(p).filter(x=>x.id!==btn.dataset.id);setChange(p,'移除视觉参考');render()}
},true);
document.addEventListener('submit',ev=>{
 if(ev.target.id==='wtVisualOwnForm'){
  ev.preventDefault();ev.stopImmediatePropagation();const f=ev.target,v=Object.fromEntries(new FormData(f).entries()),rights=v.rights==='authorized'?'author_authorized':'author_self_owned';
  if(!/^https:\/\/[\w.-]+\//.test(String(v.imageUrl||''))){notify('图片地址必须使用 HTTPS');return}
  if(rights==='author_authorized'&&!/^https:\/\/[\w.-]+\//.test(String(v.licenseEvidenceUrl||''))){notify('授权素材须填写 HTTPS 授权凭证链接');return}
  const item={id:'author-'+Date.now().toString(36),title:String(v.title||'').trim(),source:String(v.source||'').trim(),source_url:String(v.imageUrl),image:String(v.imageUrl),licenseEvidenceUrl:String(v.licenseEvidenceUrl||''),rightsStatus:rights,userAttested:f.elements.attest.checked,license:rights==='author_authorized'?'作者确认已授权':'作者确认自有'};
  try{const scope=v.scope;addReference(selected(),item,{assetType:v.assetType,scope,targetId:scope==='project'?'project':v.targetId,characterName:scope==='character'?v.targetId:''});closeModal()}catch(err){notify(String(err.message||err))}return;
 }
 if(ev.target.id==='wtVisualApplyForm'){
  ev.preventDefault();ev.stopImmediatePropagation();const f=ev.target,v=Object.fromEntries(new FormData(f).entries()),scope=v.scope,sel=f.elements.characterId?.selectedOptions?.[0];
  try{addReference(selected(),items[pendingPin],{assetType:v.assetType,scope,targetId:scope==='panel'?v.targetId:v.characterId,characterName:sel?.dataset.name||''});pendingPin=-1;closeModal()}catch(err){notify(String(err.message||err))}return;
 }
 if(ev.target.id!=='wtVisualSearch')return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const q=ev.target.elements.q.value;search(q);
},true);
document.addEventListener('change',ev=>{const f=ev.target?.form;if(f?.id!=='wtVisualApplyForm'||ev.target.name!=='scope')return;const panel=f.querySelector('[data-visual-panel]'),character=f.querySelector('[data-visual-character]');if(panel)panel.hidden=ev.target.value!=='panel';if(character)character.hidden=ev.target.value!=='character'},true);
window.wtVisualStudio={panel,refList,addReference,presets,suggestedQuery,assetTypes,validateApplication,referencesForPanel,openForWorkspace};
if(typeof render==='function'&&location.hash.startsWith('#/studio'))render();
})();
