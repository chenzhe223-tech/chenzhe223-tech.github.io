/* WORLD/TOON Visual Research: licensed museum images, as references only. */
'use strict';
(function(){
let query='',busy=false,items=[],warning='',searched=false,counts=[];
const presets=[['ancient ship','古代船舶'],['ancient China','中国古物'],['portrait','人物肖像'],['architecture','建筑场景'],['clothing','历史服饰'],['landscape','山川风景']];
function refList(p){return Array.isArray(p.visualReferences)?p.visualReferences:[]}
function panel(p){
 const refs=refList(p);
 const pins=refs.map(r=>'<article class="heritage-pin"><span class="heritage-pin-title">'+e(r.title)+'</span><span class="minor">'+e(r.source)+' · '+e(r.license||'授权需复核')+'</span><button type="button" class="button" data-visual="unpin" data-id="'+e(r.id)+'">移除</button></article>').join('');
 const gallery=items.map((r,i)=>'<article class="heritage-art">'+
 '<div class="heritage-art-thumb"><img loading="lazy" referrerpolicy="no-referrer" src="'+e(r.image)+'" alt="'+e(r.title)+'视觉参考"></div>'+
 '<div class="heritage-art-copy"><strong>'+e(r.title)+'</strong><span class="minor">'+e(r.artist||'作者未标注')+' · '+e(r.date||'年代未标注')+'</span>'+
 '<span class="heritage-license">CC0 · 公有领域</span>'+
 '<div class="buttons"><a class="button" rel="noopener noreferrer" target="_blank" href="'+e(r.source_url)+'">馆藏记录</a>'+
 '<button type="button" class="button dark" data-visual="pin" data-index="'+i+'">加入参考</button></div></div></article>').join('');
 const helper=searched?(items.length?'找到 '+items.length+' 项 CC0 图片 · '+counts.map(x=>x.id+' '+x.count+(x.ok?'':'（不可用）')).join('、'):'无可用图片，请尝试其他英文关键词。'):'输入搜索词后检索馆藏的 CC0 开放图像；默认不下载、复制或绘制为最终漫画。';
 return '<section class="box heritage-visual-panel" aria-label="视觉素材库"><div class="kicker">VISUAL REFERENCES / OPEN CULTURE</div>'+
 '<div class="heritage-header"><div><h2>视觉素材库</h2><p class="minor">大都会博物馆 + 克利夫兰艺术博物馆。仅展示明确开放的 CC0 藏品，供时代服饰、道具与场景参考。</p></div><span class="wt-chip">已选 '+refs.length+' 项</span></div>'+
 '<form id="wtVisualSearch" class="heritage-search"><input id="wtVisualInput" name="q" type="search" required minlength="2" maxlength="100" placeholder="建议英文：ancient ship, portrait, architecture…" value="'+e(query)+'"><button class="button dark" type="submit"'+(busy?' disabled':'')+'>'+(busy?'检索中…':'搜索馆藏')+'</button></form>'+
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
function addReference(p,item){
 if(!p||!item||item.license!=='CC0'||item.rights_verified!==true)throw Error('只有确认 CC0 的馆藏才能直接收录');
 const arr=refList(p);if(arr.some(x=>x.id===item.id)){notify('这项参考素材已收录');return}
 p.visualReferences=[...arr,{id:item.id,title:item.title,artist:item.artist,date:item.date,
  image:item.image,source:item.source,source_url:item.source_url,license:item.license,role:'visual_reference_only'}].slice(0,24);
 setChange(p,'添加 '+item.source+' 的 CC0 视觉参考：'+item.title);
 render();notify('已加入视觉参考库；新生成的分镜提示词会自动引用素材信息');
}
const previousStudio=studio;
studio=function(){const p=selected();return previousStudio()+(p?panel(p):'')};
document.addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-visual]');if(!btn)return;ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected(),type=btn.dataset.visual;
 if(type==='preset'){search(btn.dataset.query);return}
 if(!p)return;
 if(type==='pin'){try{addReference(p,items[Number(btn.dataset.index)])}catch(err){notify(String(err.message||err))}}
 if(type==='unpin'){p.visualReferences=refList(p).filter(x=>x.id!==btn.dataset.id);setChange(p,'移除视觉参考');render()}
},true);
document.addEventListener('submit',ev=>{
 if(ev.target.id!=='wtVisualSearch')return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const q=ev.target.elements.q.value;search(q);
},true);
window.wtVisualStudio={panel,refList,addReference,presets};
if(typeof render==='function'&&location.hash.startsWith('#/studio'))render();
})();
