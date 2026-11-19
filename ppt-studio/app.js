import {THEMES,TYPES,MAX_SLIDES,uid,freshDeck,parseOutline,validateDeck,assertDeck,pptxColor,safeFilename} from './core.mjs';
const $=id=>document.getElementById(id);
const KEY='davylab:ppt-studio:p0';
const demo={version:1,title:'DAVYLAB · 产品提案示例',theme:'ocean',updatedAt:Date.now(),slides:[
 {id:uid(),type:'cover',title:'DAVYLAB PPT Studio',body:'从想法到专业演示\n开放、可编辑、可交付',notes:'此内容为明确标识的示例作品，并非 AI 自动生成。',source:''},
 {id:uid(),type:'content',title:'为什么需要一款自己的 PPT 工具？',body:'创作过程可控：每一页都能编辑\n统一视觉风格：跨设备保持一致\n真实交付格式：导出原生 PowerPoint\n透明生产状态：未接通的 AI 功能不冒充已完成',notes:'演示该工作台的核心价值主张。',source:''},
 {id:uid(),type:'section',title:'把想法，做成能用的工具',body:'By DAVYLAB',notes:'结束。',source:''}
]};
let deck=load()||freshDeck();let selected=0;let presenting=0;let toastTimer;
function load(){try{const raw=localStorage.getItem(KEY);return raw?assertDeck(JSON.parse(raw)):null}catch{return null}}
function persist(){deck.updatedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(deck));$('saveStatus').textContent='已保存到此设备'}catch{$('saveStatus').textContent='本地存储不可用，请备份 JSON'}}
function notify(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3500)}
function current(){return deck.slides[selected]}
function label(i){return String(i+1).padStart(2,'0')}
function applyTheme(target,theme){const t=THEMES[theme]||THEMES.ocean;target.style.setProperty('--ink','#'+t.ink);target.style.setProperty('--muted','#'+t.muted);target.style.setProperty('--accent','#'+t.accent);target.style.color='#'+t.ink;target.style.background='#'+t.background;return t}
function renderThumbs(){const list=$('thumbList');list.replaceChildren();deck.slides.forEach((s,i)=>{const btn=document.createElement('button');btn.type='button';btn.className='thumb'+(i===selected?' active':'');btn.setAttribute('aria-label',`打开第${i+1}页 ${s.title}`);const preview=document.createElement('div');preview.className='thumb-preview';const t=applyTheme(preview,deck.theme);preview.style.borderLeft=`3px solid #${t.accent}`;const b=document.createElement('b');b.textContent=s.title||'（空标题）';const p=document.createElement('i');p.textContent=s.body||'点击编辑';preview.append(b,p);const name=document.createElement('span');name.className='thumb-label';name.textContent=`${label(i)}  ${s.title||'未命名页面'}`;btn.append(preview,name);btn.onclick=()=>{selected=i;render()};list.append(btn)})}
function render(){selected=Math.max(0,Math.min(selected,deck.slides.length-1));const s=current();$('deckTitleLabel').textContent=deck.title;$('slideCount').textContent=`${String(deck.slides.length).padStart(2,'0')} 页`;$('thumbCount').textContent=String(deck.slides.length).padStart(2,'0');$('slidePosition').textContent=`${label(selected)} / ${String(deck.slides.length).padStart(2,'0')}`;$('slideNumber').textContent=label(selected);const canvas=$('slideCanvas');canvas.className='slide-canvas '+s.type;applyTheme(canvas,deck.theme);$('editableTitle').textContent=s.title;$('editableBody').textContent=s.body;$('slideType').value=s.type;$('themeSelect').value=deck.theme;$('slideNotes').value=s.notes||'';$('slideSource').value=s.source||'';$('moveUp').disabled=selected===0;$('moveDown').disabled=selected===deck.slides.length-1;$('deleteSlide').disabled=deck.slides.length===1;renderThumbs();updateQuality()}
function updateQuality(){const problems=validateDeck(deck);$('qualitySummary').textContent=problems.length?`${problems.length} 项待检查`:'通过基础检查'}
function changeContent(which){const s=current();s[which]=($(which==='title'?'editableTitle':'editableBody').innerText||'').replace(/\r/g,'').slice(0,8000);persist();updateQuality();const btn=$('thumbList').children[selected];if(btn){btn.querySelector('b').textContent=s.title||'（空标题）';btn.querySelector('i').textContent=s.body||'点击编辑';btn.querySelector('.thumb-label').textContent=`${label(selected)}  ${s.title||'未命名页面'}`}}
$('editableTitle').addEventListener('input',()=>changeContent('title'));
$('editableBody').addEventListener('input',()=>changeContent('body'));
$('slideNotes').addEventListener('input',e=>{current().notes=e.target.value;persist()});
$('slideSource').addEventListener('input',e=>{current().source=e.target.value;persist()});
$('slideType').onchange=e=>{current().type=TYPES.includes(e.target.value)?e.target.value:'content';persist();render()};
$('themeSelect').onchange=e=>{deck.theme=e.target.value;persist();render()};
$('addSlide').onclick=()=>{if(deck.slides.length>=MAX_SLIDES)return notify(`最多 ${MAX_SLIDES} 页`);deck.slides.splice(selected+1,0,{id:uid(),type:'content',title:'新幻灯片',body:'',notes:'',source:''});selected++;persist();render()};
$('duplicateSlide').onclick=()=>{if(deck.slides.length>=MAX_SLIDES)return notify(`最多 ${MAX_SLIDES} 页`);deck.slides.splice(selected+1,0,{...current(),id:uid()});selected++;persist();render()};
$('deleteSlide').onclick=()=>{if(deck.slides.length===1)return notify('请至少保留一页');if(!confirm('确认删除当前幻灯片？'))return;deck.slides.splice(selected,1);selected=Math.max(0,selected-1);persist();render()};
function shift(by){const j=selected+by;if(j<0||j>=deck.slides.length)return;const [item]=deck.slides.splice(selected,1);deck.slides.splice(j,0,item);selected=j;persist();render()}
$('moveUp').onclick=()=>shift(-1);$('moveDown').onclick=()=>shift(1);
$('renameDeck').onclick=()=>{const title=prompt('演示文稿名称',deck.title);if(title===null)return;deck.title=title.trim().slice(0,100)||deck.title;persist();render()};
$('newDeck').onclick=$('createBlank').onclick=()=>{if(deck.slides.length>1&&!confirm('新建演示会替换当前作品。建议先备份 JSON，是否继续？'))return;deck=freshDeck();selected=0;persist();render();notify('已创建空白演示')};
$('importBtn').onclick=$('createFromOutline').onclick=()=>{$('outlineTitle').value='';$('outlineText').value='';$('importFile').value='';$('fileLabel').textContent='文件仅在当前设备处理';$('modal').classList.remove('hidden')};
$('closeModal').onclick=$('cancelModal').onclick=()=>$('modal').classList.add('hidden');
$('exampleBtn').onclick=()=>{if(!confirm('将当前作品替换为明确标注的演示示例？建议先备份项目。'))return;deck=assertDeck(demo);selected=0;persist();render();notify('已打开示例作品（不是 AI 生成）')};
$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)return notify('仅支持 2MB 以下的 TXT/MD/JSON 文件');try{const content=await file.text();$('fileLabel').textContent=file.name;if(/\.json$/i.test(file.name)){const loaded=assertDeck(JSON.parse(content));if(!confirm('导入 JSON 会替换当前作品，是否继续？'))return;deck=loaded;selected=0;persist();render();$('modal').classList.add('hidden');notify('项目导入成功');return}$('outlineText').value=content;$('outlineTitle').value=file.name.replace(/\.[^.]+$/,'')}catch(err){notify('无法读取文件：'+err.message)}};
$('confirmImport').onclick=()=>{try{if(!confirm('根据大纲创建新作品会替换当前项目，是否继续？'))return;const next=parseOutline($('outlineText').value,$('outlineTitle').value||'大纲演示');deck=next;selected=0;persist();render();$('modal').classList.add('hidden');notify(`成功创建 ${deck.slides.length} 页可编辑内容`)}catch(err){notify(err.message)}};
$('downloadJson').onclick=()=>{const blob=new Blob([JSON.stringify(deck,null,2)],{type:'application/json'});downloadBlob(blob,`${safeFilename(deck.title)}.json`);notify('项目备份已下载')};
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
$('qualityBtn').onclick=()=>{const problems=validateDeck(deck);const body=$('reportBody');body.replaceChildren();if(!problems.length){const box=document.createElement('div');box.className='qa-pass';box.textContent=`✓ ${deck.slides.length} 页全部通过基础内容检查。请继续进行事实复核与 PowerPoint 渲染验收。`;body.append(box)}else{const ul=document.createElement('ul');ul.className='qa-problems';problems.forEach(x=>{const li=document.createElement('li');li.textContent=x;ul.append(li)});body.append(ul)}$('reportModal').classList.remove('hidden')};
$('closeReport').onclick=$('closeReportBtn').onclick=()=>$('reportModal').classList.add('hidden');
// PPTX contains native editable text boxes, rectangles, and slide notes. It never exports slide screenshots.
$('exportBtn').onclick=async()=>{const Ctor=globalThis.PptxGenJS||globalThis.pptxgen;if(!Ctor){notify('导出引擎加载失败。请检查网络并刷新页面后重试。');return}const warnings=validateDeck(deck);if(warnings.length&&!confirm(`发现 ${warnings.length} 项排版提示，仍继续导出？\n`+warnings.slice(0,3).join('\n')))return;
 const btn=$('exportBtn');btn.disabled=true;btn.textContent='正在导出…';try{const pptx=new Ctor();pptx.layout='LAYOUT_WIDE';pptx.author='DAVYLAB';pptx.subject='DAVYLAB PPT Studio editable deck';pptx.title=deck.title;pptx.lang='zh-CN';const t=THEMES[deck.theme]||THEMES.ocean;const accent=pptxColor(t.accent),ink=pptxColor(t.ink),muted=pptxColor(t.muted),bg=pptxColor(t.background);
 for(let i=0;i<deck.slides.length;i++){const s=deck.slides[i];const slide=pptx.addSlide();slide.background={color:bg};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.13,h:7.5,line:{color:accent,transparency:100},fill:{color:accent}});
 const isCover=s.type==='cover'||s.type==='section';const align=s.type==='closing'?'center':'left';slide.addText('DAVYLAB  /  PRESENTATION',{x:1.0,y:.57,w:9.5,h:.27,fontFace:'Aptos',fontSize:10,bold:true,color:accent,charSpacing:2,margin:0});
 slide.addText(s.title||'',{x:1.0,y:isCover?2.05:1.33,w:11.3,h:isCover?2.15:1.23,fontFace:'Microsoft YaHei',fontSize:isCover?39:30,bold:true,color:ink,breakLine:false,margin:0,align,valign:'mid',fit:'shrink',transparency:0});
 if(s.body){slide.addText(s.body,{x:1.03,y:isCover?4.44:3.02,w:11.15,h:isCover?1.4:3.46,fontFace:'Microsoft YaHei',fontSize:isCover?19:18,color:muted,margin:0,align,valign:'top',breakLine:false,fit:'shrink',paraSpaceAfterPt:10});}
 slide.addText('By DAVYLAB',{x:1,y:7.05,w:2.5,h:.22,fontFace:'Aptos',fontSize:8,color:muted,margin:0});slide.addText(label(i),{x:11.75,y:7.05,w:.6,h:.22,fontFace:'Aptos',fontSize:8,color:muted,margin:0,align:'right'});
 const note=[s.notes,s.source?'资料来源：'+s.source:''].filter(Boolean).join('\n');if(note&&typeof slide.addNotes==='function')slide.addNotes(note);
 }
 await pptx.writeFile({fileName:`${safeFilename(deck.title)}.pptx`});notify('PPTX 已导出，所有标题和正文均为可编辑对象。')}
 catch(err){notify('导出失败：'+(err?.message||String(err)))}finally{btn.disabled=false;btn.textContent='↓ 导出 PPTX'}};
function showPresentation(){const s=deck.slides[presenting],container=$('presentationSlide');container.replaceChildren();const t=applyTheme(container,deck.theme);container.style.borderLeft=`12px solid #${t.accent}`;const h=document.createElement('h2');h.textContent=s.title;h.style.color='#'+t.ink;const p=document.createElement('p');p.textContent=s.body||'';p.style.color='#'+t.muted;const f=document.createElement('footer');f.textContent=`By DAVYLAB  ·  ${label(presenting)}`;container.append(h,p,f);$('presentationIndex').textContent=`${presenting+1} / ${deck.slides.length}`}
$('previewBtn').onclick=()=>{presenting=selected;showPresentation();$('presentation').classList.remove('hidden')};
$('prevPresentation').onclick=()=>{presenting=Math.max(0,presenting-1);showPresentation()};$('nextPresentation').onclick=()=>{presenting=Math.min(deck.slides.length-1,presenting+1);showPresentation()};$('closePresentation').onclick=()=>$('presentation').classList.add('hidden');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('presentation').classList.add('hidden');$('modal').classList.add('hidden');$('reportModal').classList.add('hidden')}if($('presentation').classList.contains('hidden'))return;if(['ArrowRight',' ','PageDown'].includes(e.key)){e.preventDefault();$('nextPresentation').click()}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();$('prevPresentation').click()}});
$('navEdit').onclick=()=>document.querySelector('.studio').scrollIntoView({behavior:'smooth'});
render();

