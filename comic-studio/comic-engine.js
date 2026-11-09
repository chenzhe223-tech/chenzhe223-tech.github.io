/* WORLD/TOON Comic Skills Workshop v1
 * Operational, no-paid-inference adapters for:
 * baoyu-comic (script), scenario-storyboards (shots), agent-comic-kit (cast),
 * TT_AutoManga (asset assembly). Their Python/MCP runtimes are NOT embedded.
 * Images are composed only from actual user-supplied/generated artwork.
 */
'use strict';
(function(){
const SHOTS=['wide establishing','medium two-shot','close-up reaction','over-the-shoulder','low-angle reveal','high-angle contrast','detail insert','dynamic confrontation','wide closing shot'];
const BEATS=[
 ['开场钩子','架空世界，一则与主题相关的消息打破日常。','今天，规则好像不一样了。'],
 ['角色登场','原创主人公与伙伴面对新局面，明确他们想弄明白的问题。','这件事会改变什么？'],
 ['第一道难题','角色尝试接触信息，发现存在彼此矛盾的理解。','答案没那么简单。'],
 ['意外阻力','一个出人意料的制度或技术障碍出现。','原来真正的难题在这里。'],
 ['剧情转折','用具体的视觉隐喻说明公共议题的核心矛盾。','等等，我们看错了方向？'],
 ['代价显现','主角在选择中遭遇新的限制，观察事情的另一面。','每个选择都有代价。'],
 ['寻找办法','角色通过合作、验证来源或重新设计寻找出路。','也许该换一种方法。'],
 ['关键交锋','原创角色正面讨论两种看似合理但冲突的方案。','谁的答案更经得起检验？'],
 ['余韵与思考','虚构世界恢复平静，一个开放问题留给读者。','真正的答案，需要我们继续观察。']
];
const STEPS=[
 {name:'baoyu-comic',role:'原创剧情与九格节奏',ready:'规则剧情草稿已接入',repo:'https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-comic'},
 {name:'scenario-storyboards',role:'镜头、分镜与对白留白',ready:'镜头编排规则已接入',repo:'https://github.com/E5EnclaveInc/agent-skills/blob/main/skills/scenario-storyboards/SKILL.md'},
 {name:'agent-comic-kit',role:'角色圣经与画格复核',ready:'角色一致性模板已接入',repo:'https://github.com/Saeyeon-developer/agent-comic-kit'},
 {name:'TT_AutoManga',role:'逐格素材与文字排版',ready:'浏览器本地合成已接入',repo:'https://github.com/TTDiang2/TT_AutoManga'}
];
const clean=s=>String(s||'').replace(/[\u0000-\u001f]/g,' ').trim();
function cast(p){
 const existing=clean(p.characters);
 const entries=(typeof data!=='undefined'?(data.characters||[]):[]).map(c=>[
  clean(c.name),clean(c.description),clean(c.costume),clean(c.colors),clean(c.traits)
 ].filter(Boolean).join(' · ')).filter(Boolean);
 return [existing,...entries].filter(Boolean).join('\n')||'主角：原创观察员阿诺（短棕发、墨绿色外套、斜挎笔记本）；搭档：虚构机器人小点（奶油色圆头、橙色显示屏、银灰色关节）。所有九格保持固定外观、服装与配色。';
}
function storyboard(p){
 const topic=clean(p.sourceTitle||p.title).slice(0,160);
 const style=clean(p.tone||'杂志风格');
 const bible=cast(p);
 const refs=(Array.isArray(p.visualReferences)?p.visualReferences:[]).slice(0,12);
 const visualNote=refs.length?'Museum references (inspiration ONLY, not factual reconstruction): '+refs.map(r=>r.title+' / '+r.source+' / '+r.license+' / '+r.source_url).join(' | '):'No museum references selected.';
 return BEATS.map((beat,i)=>{
  const shot=SHOTS[i],existing=p.panels?.[i]||{};
  const scene=clean(existing.scene)||beat[1].replace('主题',topic);
  const caption=clean(existing.caption)||('第 '+(i+1)+' 幕 · '+beat[0]);
  const dialogue=clean(existing.dialogue)||beat[2];
  const prompt=clean(existing.prompt)||[
   'ORIGINAL EDITORIAL COMIC | PAGE '+String(i+1).padStart(2,'0'),
   'Inspired by the public topic: '+topic+'. This is a fictional allegory, not a factual depiction.',
   'Shot: '+shot+'. Scene: '+scene,
   'Fixed character bible (same appearance in every panel): '+bible,
   'Style: '+style+'; sophisticated magazine illustration, warm paper palette, clean linework, cinematic composition.',
   'Visual references: '+visualNote,
   'Reserve clean bubble space away from characters faces. Do not add AI-generated text; dialogue is lettered separately.',
   'No realistic likeness of real people, defamatory accusations, unlicensed logos or copied artwork.',
   'Portrait canvas 1080x1440.'
  ].join('\n');
  return {title:clean(existing.title)&&!/^第 \d+ 格$/.test(existing.title)?existing.title:beat[0],
   scene,caption,dialogue,prompt,shot,bubble_space:i%2?'top-right':'top-left',image:existing.image||'',id:existing.id};
 });
}
function apply(p){
 if(!p||!Array.isArray(p.panels)||p.panels.length!==9)throw Error('请先创建九格漫画作品');
 if(p.panels.some(x=>clean(x.scene))&&!confirm('将仅填补空白分镜，保留你已经编辑的内容、图片和角色设定。继续吗？'))return;
 const panels=storyboard(p);p.panels.forEach((panel,i)=>{
  for(const field of ['title','scene','caption','dialogue','prompt','shot','bubble_space']){
   if(!clean(panel[field])||field==='title'&&panel.title&&!/^第 \d+ 格$/.test(panel.title))continue;
   if(!clean(p.panels[i][field])||field==='title'&&/^第 \d+ 格$/.test(p.panels[i][field]))p.panels[i][field]=panel[field];
  }
 });
 if(!clean(p.characters))p.characters=cast(p);
 if(!clean(p.fiction))p.fiction='采用架空世界和原创人物，通过寓言表现公共议题；不复现未经核验的真实人名、肖像或对话。';
 if(!clean(p.disclosure))p.disclosure='基于公共议题的虚构漫画，不构成对真实个人或企业的事实指控。';
 p.status='草稿';p.checks=Array(6).fill(false);p.reviewedAt=null;p.publishedAt=null;
 setChange(p,'四阶段 Skill 方法生成九格分镜初稿；真实画面尚待制作/复核');
 ui.stage=2;render();notify('九格分镜初稿已建立；可继续逐格生图或上传原创图片');
}
function refsForBundle(p){return (Array.isArray(p.visualReferences)?p.visualReferences:[]).slice(0,24).map(r=>({id:r.id,title:r.title,source:r.source,date:r.date,license:r.license,source_url:r.source_url,image:r.image,role:'visual_reference_only'}))}
function bundleEntries(p){
 const parts=storyboard(p);const title=clean(p.title);
 const files=[
  {name:'production/brief.json',bytes:JSON.stringify({schema:'davylab.worldtoon.comic-engine.v1',title,source:clean(p.sourceURLs),research_required:true,verified:false,author_approved:false,style:p.tone,format:p.format,adapters:STEPS,disclosure:p.disclosure},null,2)},
  {name:'production/storyboard.json',bytes:JSON.stringify({title,panels:parts},null,2)},
  {name:'production/visual-references.json',bytes:JSON.stringify(refsForBundle(p),null,2)},
  {name:'production/characters.md',bytes:'# 固定角色圣经\n\n'+cast(p)+'\n\n保持衣着、发型、面部和相对身高一致；未批准角色不要加入画格。\n'},
  {name:'production/README.md',bytes:'# WORLD/TOON · 四 Skill 制作包\n\n本包包含可执行的分镜数据、逐格图像提示和角色锁定规则。\n四个上游项目未作为 Python/MCP 服务安装，平台执行的是经改编的创作规则与本地画格合成功能。\n严禁把此包视作已出图、来源已核验、已通过人工审批或公众号已发表。\n外部绘图模型调用需要另行授权与配置。\n'}
 ];
 parts.forEach((x,i)=>files.push({name:'production/prompts/'+String(i+1).padStart(2,'0')+'.md',bytes:x.prompt+'\n\nCaption: '+x.caption+'\nDialogue (overlay separately): '+x.dialogue+'\n'}));
 return files;
}
function exportProduction(p){
 const entries=bundleEntries(p);
 saveFile(packZip(entries),('worldtoon-comic-skills-'+p.id+'.zip').replace(/[^A-Za-z0-9_.-]/g,'_'));
 notify('四 Skill 制作包已导出：含剧本、角色设定、九格分镜和提示词');
}
function wrapText(ctx,text,x,y,maxWidth,maxLines,lineHeight){
 let line='',count=0,chars=[...clean(text)];
 for(const char of chars){let next=line+char;if(ctx.measureText(next).width>maxWidth&&line){
  ctx.fillText(line,x,y+count*lineHeight);count++;line=char;
  if(count>=maxLines)return count;
 }else line=next}
 if(line&&count<maxLines){ctx.fillText(line,x,y+count*lineHeight);count++}
 return count;
}
async function generateMissing(p){
 if(!wtConfig?.aiEnabled){notify('生图模型尚未授权启用；请通过 ChatGPT 派单，或在明确费用后开放模型。');return}
 if(!wtSession?.access_token){notify('请先登录才能调用模型');return}
 const missing=p.panels.map((panel,i)=>panel.image?-1:i).filter(i=>i>=0);
 if(!missing.length){notify('九张图片齐全，可以执行排版与人工 QA');return}
 if(!confirm('将尝试生成缺失画格，共 '+missing.length+' 张。当前用户每天最多2张，可能产生推理费用，确认发起本次请求吗？'))return;
 let ok=0;
 for(const i of missing){
  const panel=p.panels[i];if(!panel.scene?.trim())throw Error('第 '+(i+1)+' 格缺少画面描述；请先完成分镜');
  try{
   const out=await wtCallAI('/api/ai/image',{title:p.title,scene:panel.scene,visualNotes:panel.prompt||'',characters:cast(p),references:[]});
   if(!out.image)throw Error('图片接口未返回结果');
   const bin=atob(out.image),bytes=new Uint8Array(bin.length);
   for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);
   const key=uid();await putMedia(key,new Blob([bytes],{type:'image/png'}));
   panel.image='media:'+key;markDirty(p);ok++;
  }catch(err){notify('已生成 '+ok+' 张，第 '+(i+1)+' 格未完成：'+String(err.message||err).slice(0,70));break}
 }
 render();if(ok)notify('生成 '+ok+' 张画格，已保存草稿；请继续人工 QA');
}
async function inspectNine(p){
 const errors=[],warnings=[],panels=[];
 const all=Array.isArray(p.panels)?p.panels:[];
 if(all.length!==9)errors.push('漫画应恰好九格');
 for(let i=0;i<9;i++){
  const panel=all[i]||{};
  if(!panel.image){errors.push('第 '+(i+1)+' 格尚未有真实图片');panels.push({index:i+1,ok:false});continue}
  try{
   const blob=await getImageBlob(panel.image),bitmap=await createImageBitmap(blob);
   const width=bitmap.width,height=bitmap.height;bitmap.close?.();
   if(width<720||height<900)warnings.push('第 '+(i+1)+' 格尺寸偏低：'+width+'×'+height);
   if(!panel.scene?.trim())warnings.push('第 '+(i+1)+' 格未记录完整场景');
   if(!panel.dialogue?.trim()&&!panel.caption?.trim())warnings.push('第 '+(i+1)+' 格缺少可读对白或旁白');
   panels.push({index:i+1,ok:true,width,height,bytes:blob.size,format:blob.type});
  }catch(err){errors.push('第 '+(i+1)+' 格文件无法解码：'+String(err.message||err).slice(0,80));panels.push({index:i+1,ok:false})}
 }
 const sources=String(p.sourceURLs||'').split(/[\n,，]+/).map(x=>x.trim()).filter(Boolean);
 if(sources.length&&!p.factNotes?.trim())warnings.push('尚未记录独立事实核验资料');
 if(/待核验|未核验|pending/i.test(p.factNotes||''))warnings.push('事实标注仍为待核验');
 if(['check_jurisdiction','unknown'].includes(p.rightsStatus||''))warnings.push('原著与译本或第三方素材权利仍待人工确认');
 if((p.visualReferences||[]).some(r=>r.license!=='CC0'))errors.push('视觉参考库包含未确认 CC0 的馆藏');
 const technical=errors.length===0?'technical_pass':'blocked';
 return {schema:'davylab.worldtoon.comic-qa.v1',title:p.title,project_id:p.id,checked_at:new Date().toISOString(),
  status:technical,author_approved:false,fact_checked:false,licensed_for_publication:false,
  count:panels.filter(x=>x.ok).length,panels,errors,warnings,
  notes:'自动检查只覆盖图片完整性、尺寸、基础内容与参考授权标记；无法替代事实、肖像、版权、中文错字与人物一致性人工审校。'};
}
async function exportQa(p){
 const report=await inspectNine(p);
 saveFile(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'worldtoon-qa-'+p.id+'.json');
 notify(report.errors.length?'九图预检发现 '+report.errors.length+' 项阻断，已下载报告':'九图文件技术预检通过，仍需完成人工与版权审核');
}

async function compose(p){
 const images=p.panels||[];
 if(images.length!==9||images.some(x=>!x.image))throw Error('九格均需先上传或生成真实图片；仅有分镜文字不能导出正式画格。');
 if(!confirm('将使用现有九张图片在本机合成带独立文字区的九张 PNG（不会自动审核或发表）。继续吗？'))return;
 const files=[],canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器不支持 Canvas 图片合成');
 for(let i=0;i<9;i++){
  const blob=await getImageBlob(images[i].image),bitmap=await createImageBitmap(blob);
  ctx.fillStyle='#f6f1e9';ctx.fillRect(0,0,1080,1440);
  const area={x:38,y:36,w:1004,h:1125};
  const scale=Math.min(area.w/bitmap.width,area.h/bitmap.height);
  const w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);
  ctx.drawImage(bitmap,area.x+(area.w-w)/2,area.y+(area.h-h)/2,w,h);
  bitmap.close?.();
  ctx.fillStyle='#f6f1e9';ctx.fillRect(0,1177,1080,263);
  ctx.strokeStyle='#d7cfc0';ctx.beginPath();ctx.moveTo(38,1180);ctx.lineTo(1042,1180);ctx.stroke();
  ctx.fillStyle='#8a7461';ctx.font='bold 23px sans-serif';ctx.fillText('WORLD / TOON · '+String(i+1).padStart(2,'0'),44,1226);
  ctx.fillStyle='#222c26';ctx.font='bold 32px sans-serif';
  wrapText(ctx,images[i].dialogue||images[i].caption||images[i].title,44,1288,984,3,47);
  const out=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG 输出失败')),'image/png'));
  files.push({name:'panels/'+String(i+1).padStart(2,'0')+'.png',bytes:new Uint8Array(await out.arrayBuffer())});
 }
 files.push({name:'README.md',bytes:'本地合成的画格仅供编辑审校，不代表原始来源核验、画质评审或作者独立批准；未获得批准不得直接发表。\n'});
 saveFile(packZip(files),'worldtoon-composed-'+p.id+'.zip');
 notify('已合成九张独立 PNG（原图不裁切），仍需作者审核');
}
function panel(p){
 const completed=(p.panels||[]).filter(x=>x.image).length;
 const rows=STEPS.map((step,i)=>'<div class="comic-skill-step"><span class="comic-skill-num">0'+(i+1)+'</span><div><strong>'+e(step.name)+'</strong><small>'+e(step.role)+'</small><span>'+e(step.ready)+'</span></div></div>').join('');
 return '<section class="box comic-engine" aria-label="漫画制作引擎"><div class="kicker">COMIC ENGINE / SOURCE → SKILLS → PRODUCTION</div>'+
 '<div class="comic-engine-head"><div><h2>漫画制作引擎</h2><p class="minor">四 Skill 创作规则已接入；直接生成九格分镜、角色规范、逐格提示词，并可用现有画面合成 PNG。</p></div><span class="wt-chip">已完成画面 '+completed+'/9</span></div>'+
 '<div class="comic-skill-grid">'+rows+'</div>'+
 '<p class="minor">当前为浏览器原生制作能力；原版 Python/MCP 引擎及付费生图并未启用。剧本草稿不等于图片成品。</p>'+
 '<div class="buttons"><button type="button" class="button dark" data-comic="storyboard">生成九格分镜草稿</button><button type="button" class="button" data-comic="generate"'+(wtConfig?.aiEnabled&&wtSession?.access_token?'':' disabled title="需要模型权限与登录"')+'>续生成缺失画格</button><button type="button" class="button" data-comic="export">导出四 Skill 制作包</button><button type="button" class="button" data-comic="compose"'+(completed!==9?' disabled title="请先上传全部九格图片"':'')+'>九图排版导出</button><button type="button" class="button" data-comic="qa">九图质量预检</button></div></section>';
}
const previousStudio=studio;
studio=function(){const p=selected();return previousStudio()+(p?panel(p):'')};
document.addEventListener('click',async ev=>{
 const btn=ev.target.closest('[data-comic]');if(!btn)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected();if(!p)return;
 try{if(btn.dataset.comic==='storyboard')apply(p);else if(btn.dataset.comic==='export')exportProduction(p);
 else if(btn.dataset.comic==='compose')await compose(p);else if(btn.dataset.comic==='generate')await generateMissing(p);else if(btn.dataset.comic==='qa')await exportQa(p);}
 catch(err){notify('漫画制作失败：'+String(err.message||err).slice(0,140))}
},true);
window.wtComicEngine={STEPS,BEATS,SHOTS,storyboard,cast,bundleEntries,refsForBundle,inspectNine};
if(typeof render==='function'&&location.hash.startsWith('#/studio'))render();
})();
