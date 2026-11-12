/* WORLD/TOON complete-season planning, validation and idempotent workbench drafts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WTSeriesPlanner=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const text=(v,n=500)=>String(v??'').trim().slice(0,n);
 const archiveIds=data=>new Set((data?.characters||[]).map(x=>String(x?.characterId||x?.id||'')).filter(Boolean));
 function validatePlan(plan,data){
  const errors=[];
  if(!plan||typeof plan!=='object')return {ok:false,errors:['系列计划格式无效']};
  const count=Number(plan.episodeCount),episodes=Array.isArray(plan.episodes)?plan.episodes:[],ids=archiveIds(data);
  if(!text(plan.seriesTitle,100))errors.push('请填写系列名称');
  if(!text(plan.theme,300))errors.push('请填写系列主题');
  if(!text(plan.arc,1800))errors.push('请填写完整的全季故事弧');
  if(!Number.isInteger(count)||count<2||count>30)errors.push('系列总集数须为 2–30 集');
  if(episodes.length!==count)errors.push('逐集剧情数量必须与系列总集数一致');
  const bible=plan.bible||{};
  if(!text(bible.world,1200))errors.push('请补全系列世界观');
  if(!text(bible.styleId,100))errors.push('请确定系列画风');
  if(!Array.isArray(bible.characters)||!bible.characters.length)errors.push('请在角色档案中选择系列固定角色');
  const bibleIds=new Set();
  for(const c of Array.isArray(bible.characters)?bible.characters:[]){
   const id=text(c?.characterId,120);if(!id||!ids.has(id))errors.push('系列角色引用不存在：'+(id||'未指定角色'));
   if(bibleIds.has(id))errors.push('系列角色重复：'+id);bibleIds.add(id);
   if(!text(c?.comicName,80))errors.push('系列角色缺少漫画名：'+(id||''));
   if(!text(c?.look,500)||!text(c?.costume,500))errors.push('系列固定角色需要外形与服装：'+(c?.comicName||id));
  }
  episodes.forEach((ep,i)=>{
   if(Number(ep?.episode)!==i+1)errors.push('第 '+(i+1)+' 集编号缺失或顺序错误');
   if(!text(ep?.title,120)||text(ep?.summary,20).length<20)errors.push('第 '+(i+1)+' 集标题或剧情简介不足');
   if(!Array.isArray(ep?.beats)||ep.beats.length<3||ep.beats.some(x=>!text(x,180)))errors.push('第 '+(i+1)+' 集至少需要三个剧情节点');
   if(!Array.isArray(ep?.castIds)||!ep.castIds.length||ep.castIds.some(id=>!ids.has(String(id))||!bibleIds.has(String(id))))errors.push('第 '+(i+1)+' 集包含无效角色引用');
   if(!text(ep?.wardrobeNotes,500)||!text(ep?.location,240))errors.push('第 '+(i+1)+' 集需要服装连续性与场景设置');
  });
  return {ok:errors.length===0,errors};
 }
 function createEpisodes(data,plan,template={}){
  const validation=validatePlan(plan,data);if(!validation.ok)throw new Error(validation.errors.join('；'));
  if(!Array.isArray(data.projects))data.projects=[];
  const seriesId=text(plan.seriesId,120)||'series-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  const existing=new Set(data.projects.filter(p=>p.seriesId===seriesId).map(p=>Number(p.seriesEpisode)));
  const cast=plan.bible.characters.map(c=>({characterId:String(c.characterId),role:text(c.role,80),name:text(c.comicName,80),look:text(c.look,500),clothes:text(c.costume,500),symbol:text(c.symbol,200),nature:text(c.personality,300)}));
  const baseBible={...structuredClone(plan.bible),seriesTitle:text(plan.seriesTitle,100),theme:text(plan.theme,300),arc:text(plan.arc,1800),characters:structuredClone(plan.bible.characters),continuity:'全季沿用本系列固定角色身份、漫画名、外貌、服饰、风格与世界设定。剧情可发展，已确认集数不被重规划覆盖。'};
  return plan.episodes.map((ep,i)=>({ep,i})).filter(({ep})=>!existing.has(Number(ep.episode))).map(({ep,i})=>{
   const n=i+1,now=new Date().toISOString(),id=seriesId+'-episode-'+String(n).padStart(2,'0');
   return {id,title:text(ep.title,120),subtitle:text(plan.seriesTitle,100)+' · 第 '+n+' 集',description:text(ep.summary,1200),ideaSeed:text(ep.summary,1200),category:text(template.category||'原创系列',80),tone:text(template.tone||'剧情漫画',60),format:template.format||'九格短篇',status:'草稿',archived:false,deleted:false,createdAt:now,updatedAt:now,seriesId,seriesTitle:text(plan.seriesTitle,100),seriesEpisode:n,seriesEpisodeCount:Number(plan.episodeCount),seriesPlanVersion:Number(plan.version)||1,seriesTheme:text(plan.theme,300),seriesArc:text(plan.arc,1800),seriesBible:structuredClone(baseBible),seriesEpisodes:plan.episodes.map((x,j)=>({episode:j+1,title:text(x.title,120),summary:text(x.summary,1200)})),characterRefs:cast.map(c=>({characterId:c.characterId,role:c.role,comicName:c.name})),characters:cast.map(c=>c.name+'（'+c.look+'；固定服饰：'+c.clothes+'）').join('\n'),fiction:'系列为独立原创创作；人物、场景、关系与剧情均为原创设定。',disclosure:'原创系列漫画；如涉及来源灵感，已在选题中标明并遵守版权边界。',panels:Array.from({length:9},(_,j)=>({id:id+'-panel-'+(j+1),title:'第 '+(j+1)+' 格',scene:'',caption:'',dialogue:'',prompt:'',image:''})),checks:Array(6).fill(false),activity:[{at:now,detail:'作者确认整季规划后创建草稿'}],reviewedAt:null,publishedAt:null,cover:'',creativeDirection:{version:1,quality:'Premium',styleId:text(plan.bible.styleId,100),arcId:'journey',thesis:text(ep.summary,1200),world:text(plan.bible.world,1200),cast:structuredClone(cast),drafted:false,reviewed:false,approval:null,continuityNotes:text(ep.wardrobeNotes,500)+'；场景：'+text(ep.location,240),storyboardProvenance:null},seriesEpisodePlan:{episode:n,title:text(ep.title,120),summary:text(ep.summary,1200),beats:ep.beats.map(x=>text(x,180)),wardrobeNotes:text(ep.wardrobeNotes,500),location:text(ep.location,240)}};
  });
 }
 const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 let pending=null,busy=false;
 function begin(){
  const p=typeof selected==='function'?selected():null,chars=typeof data!=='undefined'?(data.characters||[]):[];
  if(!p)return;
  const options=chars.map(c=>{const id=c.characterId||c.id,selectedByProject=p.characterRefs?.some(r=>r.characterId===id),comicName=window.WTCharacterContinuity?.displayName(data,id,p.id)||c.originalName||c.name;return '<label class="wt-series-cast-option"><input type="checkbox" name="castId" value="'+esc(id)+'" '+(selectedByProject?'checked':'')+'><span><strong>'+esc(c.originalName||c.name)+'</strong><small>'+esc(c.description||'请补外形')+' · 服饰：'+esc(c.costume||'请补固定服饰')+'</small></span><input aria-label="本系列漫画名" name="comicName_'+esc(id)+'" value="'+esc(comicName)+'" placeholder="系列漫画名"></label>'}).join('');
  modal('<div class="kicker">SERIES BIBLE / FULL SEASON</div><h2>AI 规划完整系列</h2><p>先选择创作者角色档案和授权状态。模型只读取本次提交的角色设定与来源元数据，不抓取小说全文。生成后可以逐集修改，作者确认前不会创建作品。</p><form id="wtSeriesForm"><div class="fields"><div class="field"><label>系列名称</label><input name="seriesTitle" maxlength="120" required value="'+esc(p.seriesTitle||p.title||'')+'"></div><div class="field"><label>总集数（2–30）</label><input name="episodeCount" type="number" min="2" max="30" value="8" required></div><div class="field wide"><label>系列主题与核心冲突</label><textarea name="theme" minlength="8" maxlength="500" required>'+esc(p.description||p.ideaSeed||'')+'</textarea></div><div class="field"><label>目标读者</label><input name="audience" maxlength="160" value="成年漫画读者"></div><div class="field"><label>规划模型</label><select name="provider"><option value="native">平台内置模型</option><option value="deepseek">DeepSeek</option><option value="claude">Claude</option><option value="gemini">Gemini</option><option value="kimi">Kimi</option><option value="qwen">通义千问</option><option value="openai">OpenAI</option></select></div><div class="field wide" data-series-key-wrap hidden><label>本次 API Key</label><input name="apiKey" type="password" autocomplete="off" maxlength="320"><small>供应商可能按用量收费；密钥只用于本次请求，不保存到作品或备份。</small></div><div class="field"><label>作品来源权利状态</label><select name="originalityStatus"><option value="original">完全原创</option><option value="public_domain">公版作品（提供身份来源）</option><option value="authorized">已获授权作品</option></select></div><div class="field"><label>来源标题（可选）</label><input name="sourceTitle" maxlength="160" value="'+esc(p.sourceTitle||'')+'"></div><div class="field"><label>来源链接（公版必填）</label><input name="sourceUrl" type="url" maxlength="600" value="'+esc(p.sourceURLs||'')+'"></div><div class="field"><label>来源日期</label><input name="sourceDate" type="date"></div><div class="field wide"><label>授权凭证说明（授权作品必填）</label><input name="authorizationReference" maxlength="220" placeholder="合同/许可范围标识，不上传合同正文"></div></div><fieldset class="wt-series-cast"><legend>系列固定角色（至少选择一位）</legend>'+(options||'<p>当前没有角色档案，请先到「角色档案」建立并填写原生名、外形与固定服饰。</p>')+'</fieldset><p class="wt-note">需要人工确认全季剧情、角色、服装、来源和权利；不会自动发表或覆盖已有锁定作品。</p><div class="stepactions"><button type="button" class="button" data-action="modal-close">取消</button><button type="submit" class="button dark" '+(chars.length?'':'disabled')+'>生成完整季草案</button></div></form>');
 }
 function previewHTML(plan){return '<div class="kicker">DRAFT / AUTHOR REVIEW</div><h2>'+esc(plan.seriesTitle)+' · '+plan.episodeCount+' 集</h2><p>全季弧线：'+esc(plan.arc)+'</p><div class="field"><label>世界观</label><textarea data-series-world>'+esc(plan.bible.world)+'</textarea></div><div class="field"><label>固定服装规则</label><textarea data-series-wardrobe>'+esc(plan.bible.wardrobeRules)+'</textarea></div><div class="wt-series-preview">'+plan.episodes.map(ep=>'<article><h3>第 '+ep.episode+' 集 · <input data-series-title="'+ep.episode+'" value="'+esc(ep.title)+'"></h3><label>剧情简介<textarea data-series-summary="'+ep.episode+'">'+esc(ep.summary)+'</textarea></label><label>剧情节点<textarea data-series-beats="'+ep.episode+'">'+esc(ep.beats.join('\n'))+'</textarea></label><div class="fields"><label>角色 IDs<input data-series-cast="'+ep.episode+'" value="'+esc(ep.castIds.join(','))+'"></label><label>服装连续性<input data-series-costume="'+ep.episode+'" value="'+esc(ep.wardrobeNotes)+'"></label><label>主要场景<input data-series-location="'+ep.episode+'" value="'+esc(ep.location)+'"></label></div></article>').join('')+'</div><div class="stepactions"><button type="button" class="button" data-series-back>返回调整</button><button type="button" class="button dark" data-series-confirm>确认并创建 '+plan.episodeCount+' 集工作草稿</button></div>'}
 function collectPreview(root){
  if(!pending)return null;const plan=structuredClone(pending);plan.bible.world=root.querySelector('[data-series-world]')?.value||'';plan.bible.wardrobeRules=root.querySelector('[data-series-wardrobe]')?.value||'';
  plan.episodes=plan.episodes.map(ep=>({...ep,title:root.querySelector('[data-series-title="'+ep.episode+'"]')?.value||'',summary:root.querySelector('[data-series-summary="'+ep.episode+'"]')?.value||'',beats:(root.querySelector('[data-series-beats="'+ep.episode+'"]')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),castIds:(root.querySelector('[data-series-cast="'+ep.episode+'"]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),wardrobeNotes:root.querySelector('[data-series-costume="'+ep.episode+'"]')?.value||'',location:root.querySelector('[data-series-location="'+ep.episode+'"]')?.value||''}));return plan;
 }
 async function generate(form){if(busy)return;const values=Object.fromEntries(new FormData(form).entries()),ids=form.querySelectorAll('input[name="castId"]:checked'),p=typeof selected==='function'?selected():null;if(!p)return;
  const cast=Array.from(ids).map(box=>{const c=data.characters.find(x=>String(x.characterId||x.id)===box.value);return c?{characterId:c.characterId||c.id,role:c.role||'',name:c.originalName||c.name,comicName:form.elements['comicName_'+box.value]?.value||c.originalName||c.name,look:c.description||'',costume:c.costume||'',traits:c.traits||''}:null}).filter(Boolean);
  if(!cast.length){notify('至少选择一个角色档案');return}const provider=values.provider||'native';if(provider!=='native'&&String(values.apiKey||'').trim().length<12){notify('请输入本次调用用的 API Key');return}
  if(!wtSession?.access_token){notify('请先登录后使用 AI 系列规划');return}
  if(!confirm(provider==='native'?'将使用平台内置模型规划整季草稿，确认继续？':'将把 API Key 仅用于本次 '+provider+' 请求；供应商可能按用量收费。确认本次调用？'))return;
  const count=Number(values.episodeCount),source={title:values.sourceTitle,url:values.sourceUrl,date:values.sourceDate,authorizationReference:values.authorizationReference};busy=true;const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
  try{const result=await wtCallAI('/api/ai/series-plan',{provider,apiKey:provider==='native'?'':String(values.apiKey||'').trim(),seriesTitle:values.seriesTitle,theme:values.theme,audience:values.audience,episodeCount:count,originalityStatus:values.originalityStatus,source,cast});const plan={...result,seriesId:'series-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),version:1};const valid=validatePlan(plan,data);if(!valid.ok)throw Error('模型草案校验未通过：'+valid.errors.join('；'));pending=plan;document.querySelector('#modalRoot .modal-card').innerHTML=previewHTML(plan)}catch(err){notify('系列规划未完成：'+String(err.message||err).slice(0,200))}finally{if(form.elements.apiKey)form.elements.apiKey.value='';busy=false;if(submit?.isConnected)submit.disabled=false}
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',ev=>{const open=ev.target.closest('[data-series-planner="open"]');if(open){ev.preventDefault();begin();return}if(ev.target.closest('[data-series-back]')){pending=null;begin();return}if(ev.target.closest('[data-series-confirm]')){const plan=collectPreview(document.querySelector('#modalRoot .modal-card')),validation=validatePlan(plan,data);if(!validation.ok){notify(validation.errors.join('；'));return}try{const projects=createEpisodes(data,plan,selected());if(!projects.length){notify('该系列集数已经建立，无需重复创建');return}data.projects.unshift(...projects);persist();const p=projects[0];ui.selected=p.id;nav('workspace/'+p.id+'/0');pending=null;closeModal();notify('已确认并创建 '+projects.length+' 集草稿，进入第 1 集工作台')}catch(err){notify('系列没有创建：'+err.message)}return}});
  document.addEventListener('submit',ev=>{if(ev.target?.id!=='wtSeriesForm')return;ev.preventDefault();generate(ev.target)});
  document.addEventListener('change',ev=>{if(ev.target?.name==='provider'){const wrap=ev.target.form?.querySelector('[data-series-key-wrap]');if(wrap)wrap.hidden=ev.target.value==='native'}});
 }
 return {validatePlan,createEpisodes,begin};
});
