/* WORLD/TOON · By DAVYLAB — newsroom-to-ChatGPT-to-WorkBuddy handoff v2.4.
   This module never invokes a paid model or publishes an external post. */
'use strict';
const WF_REV='2.4', WF_SCHEMA='davylab.worldtoon.task.v1';
let wfBusy=false;
const wfGet=p=>p?.handoff||{};
const wfPhase=p=>{
 const h=wfGet(p);
 // Older failed exports left a task_ready flag before any ZIP or remote handoff existed.
 if(h.phase==='task_ready'&&!h.directTaskExportedAt&&!h.repoQueuedAt&&
  !h.repoCommit&&!h.repoTaskPath&&!h.importedAt)return 'not_started';
 return h.phase||'not_started';
};
const wfLabels={not_started:'待生成制作任务',task_ready:'等待 ChatGPT 制作',delivered:'ChatGPT 成品已导入',workbuddy_ready:'待移交 WorkBuddy',workbuddy_processing:'WorkBuddy 处理中',publish_reported:'已记录发表回执（待核验）'};
const wfStatus=p=>'<span class="chip">'+e(wfPhase(p)==='task_ready'&&!wfGet(p).repoQueuedAt?'任务已生成 · 未入仓':wfLabels[wfPhase(p)]||'待处理')+'</span>';
function wfStyle(){let s=document.createElement('style');s.id='wf-style';s.textContent=`
.wf-step{background:#fff;border:1px solid #dedbd2;border-radius:14px;padding:24px;min-width:0}
.wf-step.active{border-color:#b26f53}.wf-stephead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.wf-num{font-family:Georgia,serif;font-size:36px;color:#b16a52}.wf-path{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:20px 0}
.wf-path span{padding:9px 12px;border:1px solid #d9d6cd;border-radius:50px;font-size:12px;background:#f7f5ef}
.wf-layout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}
.wf-step h3{font-size:21px;margin:3px 0 12px}.wf-step p{font-size:13px;line-height:1.75;color:#65655f}
.wf-step .button,.wf-step label.button{margin:5px 5px 5px 0;display:inline-flex;align-items:center;cursor:pointer}
.wf-meta{font-size:12px;color:#706f68;margin:11px 0;word-wrap:break-word}
.wf-banner{background:#f3e9db;border-left:3px solid #bd7b58;padding:14px 19px;margin:0 0 20px;border-radius:6px}
.wf-footer{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:17px 0}
.wf-form{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}.wf-form .field{min-width:170px;flex:1}
.wf-form input,.wf-form select{max-width:100%}.wf-code{font:12px/1.7 ui-monospace,monospace;color:#575a55}
.wf-instructions{line-height:1.8;font-size:13px}.wf-instructions strong{color:#28312b}
.wf-launch-guide{margin:13px 0 9px;border:1px solid #b7c7b7;background:#f3f7f0;border-radius:9px;padding:12px 14px;color:#243b2d}
.wf-launch-guide strong{font-size:13px;display:block;margin-bottom:4px}
.wf-launch-guide p{font-size:12px;line-height:1.7;margin:0;color:#415447}
.wf-launch-guide b{font-weight:750;color:#25452f}
@media(max-width:850px){.wf-layout{grid-template-columns:1fr}.wf-step{padding:19px}.wf-path{gap:5px}.wf-path span{font-size:11px}}
`;document.head.appendChild(s)}
function wfMode(p){return wfLiteraryReview(p)?'literary_review':wfGet(p).mode||'hotspot'}
function wfResearchPolicy(p){
 const hotspot=wfMode(p)!=='original';
 return {research_required:hotspot,verification_status:hotspot?'pending_research':'original_fiction',candidate_urls:validSources(p),subject:p.sourceTitle||p.title};
}
function wfPrepareTask(p){
 if(!p||!String(p.title||'').trim())throw Error('请先设置漫画名称');
 const topic=Array.isArray(data.topics)?data.topics.find(t=>t.id===p.topicId||t.title===p.sourceTitle):null;
 let changed=false;
 const researchSource=wfLiteraryReview(p)?(p.storySourceSelection?.source||p.literaryReviewGuide?.source_url||topic?.source):topic?.source;
 if(!validSources(p).length&&researchSource&&safeURL(researchSource)){p.sourceURLs=researchSource;changed=true}
 if(!p.sourceTitle?.trim()){p.sourceTitle=topic?.title||p.title;changed=true}
 if(!p.description?.trim()&&topic?.summary?.trim()){p.description=topic.summary;changed=true}
 if(!p.fiction?.trim()){
   p.fiction=wfLiteraryReview(p)?
    '只制作独立文学导读与评论：前3格作品简介（先核实书目及内容），中3格原创人生哲学解读，后3格原创当代读者生活与实际意义。不能逐幕重绘原作剧情、沿用受保护的独特角色造型和对白。':
    '将公共议题转换为完全原创的架空世界与人物，用具象寓言表达制度与利益冲突；原创人物不得使用真实姓名、肖像、独特身份线索或可识别的隐私指控，不能仅通过改名继续影射真实自然人。故事需清楚标注虚构改编。';
   changed=true;
 }
 if(!p.disclosure?.trim()){p.disclosure=wfLiteraryReview(p)?
  '本漫画是独立文学导读与编辑评论，非原著剧情漫画化；未经授权不使用原著插图、受保护的长段文字或具体剧情画面。':
  '本作品为原创虚构漫画，受公共议题启发，不代表事实报道或对现实个人的指控。';changed=true}
 if(!p.factNotes?.trim()){
   const notes=topic?.summary||p.description||'暂无相关摘要';
   p.factNotes=wfLiteraryReview(p)?
    '【文学导读·待核查书目】\n作品：'+(p.sourceTitle||p.title)+
    '\n资料来源：'+(validSources(p).join('；')||'待补充可信书目资料')+
    '\nChatGPT须核查：作者、出版日期、作品实际主题、作家与诺奖关系，并区分文本事实和编辑解释。不得想象原著情节或误称某本书单独获得诺贝尔奖。':
    wfMode(p)==='original'?'【完全原创】本故事无须使用真实事件或现实人物，不引用真实指控。':
    '【待核验·线索草稿，非已核实事实】\n选题：'+(p.sourceTitle||p.title)+'\n候选来源：'+(validSources(p).join('；')||'尚无原文链接，需 ChatGPT 检索')+
    '\n线索摘要（未核查）：'+String(notes).slice(0,1300)+
    '\n优先任务：ChatGPT 检索一手来源，确认事件日期、主体与关键事实，将事实、观点和传闻分开；来源不足时停止现实热点改编，不生成伪事实漫画。';
   changed=true;
 }
 if(!p.handoff){p.handoff={};changed=true}
 if(p.handoff.researchRequired!== (wfMode(p)!=='original')){p.handoff.researchRequired=wfMode(p)!=='original';changed=true}
 if(changed)setChange(p,'从选题自动整理 ChatGPT 制作任务（待核验信息未视为事实）');
 return {changed,researchRequired:p.handoff.researchRequired};
}
function wfTaskReadiness(p){
 if(!p)return '请先建立作品';
 if(!String(p.title||'').trim())return '需要填写漫画标题';
 const sources=validSources(p);
 if(wfMode(p)==='original')return '原创故事 · 无须引用现实新闻；生成时自动补全虚构规则';
 if(wfLiteraryReview(p))return sources.length?
  '文学导读 · 已继承 '+sources.length+' 条作品资料链接；ChatGPT 先核实书目和主题，再制作三维九格评论漫画':
  '文学导读 · 尚无可追溯书目来源，需先在选题资料中补充可信链接，才能生成任务';
 return sources.length?'已继承 '+sources.length+' 条新闻候选链接 · ChatGPT 先核验再创作':'暂无可靠事件链接 · 自动生成“先检索再创作”任务，ChatGPT 必须补充证据';
}
function wfInlineEditor(p){
 const literary=wfLiteraryReview(p);
 return `<details class="wf-source-panel" style="margin:12px 0"><summary style="cursor:pointer;font-weight:650">查看／补充选题资料（可选）</summary><div class="fields" style="margin-top:12px"><div class="field wide"><label>${literary?'作品书目与可信评论来源（每行一个；至少一条有效链接）':'新闻来源候选链接（每行一个，可留空交由 ChatGPT 检索）'}</label><textarea data-wf-editor="sourceURLs" rows="2" placeholder="https://...">${e(p.sourceURLs||'')}</textarea></div><div class="field wide"><label>${literary?'书目事实与待核查观点（不要编造原著情节）':'线索和核验说明（未经核验不得写成事实）'}</label><textarea data-wf-editor="factNotes" rows="3" placeholder="可填写线索摘要，ChatGPT 会先核实">${e(p.factNotes||'')}</textarea></div><div class="field wide"><label>${literary?'独立文学评论与原创生活隐喻（禁止剧情重演）':'原创虚构改编方向（不填则使用安全默认规则）'}</label><textarea data-wf-editor="fiction" rows="3" placeholder="架空世界观、原创角色和故事寓言">${e(p.fiction||'')}</textarea></div></div><p class="minor">生成任务不等于事实核验或正式发表；正式漫画必须通过来源、图像及作者审核。</p></details>`;
}
function wfLiteraryReview(p){
 const explicit=p?.storySourceSelection?.adaptation;
 if(explicit)return explicit==='literary_review'; // An explicit licensed/faithful mode must never be overwritten.
 return p?.literaryReviewGuide?.schema==='davylab.worldtoon.literary-review.v1'&&
  /文学导读/.test(String(p?.category||''));
}
function wfLiterarySelection(p){
 const source=p?.storySourceSelection||null;
 if(!wfLiteraryReview(p))return source;
 return {...(source||{}),adaptation:'literary_review',license_attested:false,
  review_dimensions:source?.review_dimensions||['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers'],
  selected_beats:[]};
}
function wfLiteraryReviewGuide(p){
 if(!wfLiteraryReview(p))return '';
 return [
  '【三维文学导读模式｜诺奖／世界文学原创评论】这不是原著剧情重绘，禁止未经授权以任何方式逐幕搬演原著独特场景、人物造型、经典对白或使用原作插画。介绍内容只限经独立可靠资料核对的简要书目与核心主题，不大段翻译或复述原文。',
  '画格01–03：作品讲了什么——核实作品作者与书目背景、主题/核心矛盾，概述少量必要情节事实以服务评论，不写成完整剧情摘要；先核实作家获诺奖和该书出版的关系，不能把作品误写为单独获诺奖。',
  '画格04–06：揭示什么人生哲学——作者的文本观点与漫画编辑的独立解读分开标注；通过原创抽象隐喻讨论人性、尊严、自由、关系或选择，不伪造作者原话。',
  '画格07–09：对普通人有什么意义——原创当代普通人物与日常困境，用新设计的场景和行动呈现现实启发，结尾留下一个有传播价值的问题；不复用原著角色或典型剧情。',
  '作品完整形态：1张独立封面＋9张竖版独立漫画，适合手机阅读，中文字通过独立文字层准确排版，封面展示真实作品名、作者及“文学导读·原创评论”，不能暗示原作者或版权方授权。',
  '【来源与版权门禁】先核实作品名/作家/出版信息/可信介绍和原作主题；只有搜索结果或封底简介时不得脑补完整情节。保留来源链接、书目版本、事实与编辑观点区分；评介模式可能降低改编风险但不是法定免责，引用及视觉素材仍按发布地区独立检查。'
 ].join('\n');
}
function wfCanTask(p){const missing=[];if(!p?.title?.trim())missing.push('作品名称');const ss=wfLiterarySelection(p);if(ss?.adaptation==='literary_review'&&(!validSources(p).length||p.panels?.length!==9))missing.push('文学导读要求一条可追溯作品资料来源和九格三维结构');if(ss?.adaptation==='faithful'&&ss?.rights!=='public_domain_us'&&(!ss.license_attested||!/^https:\/\/[\w.-]+\//.test(String(ss.license_url||''))))missing.push('受保护作品的有效改编授权依据 URL 与作者授权确认');if(typeof wtDirector!=='undefined')missing.push(...wtDirector.readiness(p));else missing.push('创意导演台尚未加载，请刷新页面');return missing}
function wfTaskObject(p){const h=wfGet(p),policy=wfResearchPolicy(p);return {schema:WF_SCHEMA,research_required:policy.research_required,verification_status:policy.verification_status,task_id:h.taskId,created_at:h.taskAt,producer:p.productionAgent==='WorkBuddy'?'WorkBuddy':'ChatGPT',publisher:'WorkBuddy',panel_count:p.panels.length,series:p.seriesId?{id:p.seriesId,episode:p.seriesEpisode||1,previous_task_id:p.previousTaskId||null}:null,series_bible:p.seriesBible||null,brand:'WORLD/TOON · By DAVYLAB',title:p.title,subtitle:p.subtitle,category:p.category,mode:wfMode(p),creative_revision:p.creativeRevision||undefined,creative_tone:p.tone||'克制讽刺',format:p.panels.length+(wfLiteraryReview(p)?'格原创文学导读':'格原创漫画'),source:{headline:p.sourceTitle,urls:validSources(p),date:p.eventDate,verification_status:policy.verification_status,candidate_summary:p.description||'',fact_notes:p.factNotes||'待 ChatGPT 核验',verified_facts:policy.research_required?'':(p.factNotes||'原创虚构故事')},adaptation:{strategy:p.fiction,characters:p.characters,disclaimer:p.disclosure,source_selection:wfLiterarySelection(p),literary_review: wfLiteraryReview(p)?{schema:'davylab.worldtoon.literary-review.v1',mode:'editorial_criticism_not_plot_adaptation',dimensions:['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers'],panel_ranges:[[1,3],[4,6],[7,9]],research_required:true,no_plot_reenactment:true,rights_risk_pending_review:true,guide:wfLiteraryReviewGuide(p)}:null,rights_verification_required:!!p.storySourceSelection},story:p.description,creative_direction:wtDirector.exportBrief(p),panels:p.panels.map((x,i)=>({index:i+1,title:x.title,scene:x.scene,caption:x.caption,dialogue:x.dialogue,visual_notes:x.prompt})),requirements:{panel_count:p.panels.length,independent_images:true,cover_required:true,language:'zh-CN',visual_style:'必须遵守 creative_direction.visual_rules 的锁定画风、色板、材质、镜头与禁用项，不得擅自改风格',art:'按剧情篇幅的独立竖版 PNG 漫画图 + 独立封面，文字准确可读；如生图文字难以保证则以独立文本图层排版',delivery_zip:'chatgpt-delivery.zip',paths:['delivery.json','cover.png','panels/01.png ... panels/'+String(p.panels.length).padStart(2,'0')+'.png','comic.pdf (可选)','weixin-caption.txt (可选)'],public_claims:'未经证实的指控、婚恋隐私、违法或交易传闻不得描绘成真实事实；人物不可仅换名仍可被识别'}}}
// The approved director storyboard is the only image-generation source of truth.
// Summary, legacy characters and per-panel custom prompts remain audit input only.
function wfProductionBible(p,task){
 const cd=task.creative_direction||{},board=Array.isArray(cd.storyboard)?cd.storyboard:[],cast=Array.isArray(cd.characters)?cd.characters:[];
 if(!cd.approval?.author_approved||!cd.approval.lock_hash)throw Error('缺少作者已锁定的导演圣经');
 if(board.length!==p.panels.length)throw Error('批准的分镜数量和实际画格不同，须重新定稿');
 if(!cast.length||!cd.style_id)throw Error('缺少正式锁定角色或画风');
 const conflicts=[];
 const review=task.adaptation?.source_selection?.adaptation==='literary_review';
 if(review&&board.length!==9)conflicts.push({code:'LITERARY_REVIEW_STRUCTURE_REQUIRED',message:'文学导读必须按01–03、04–06、07–09三维九格结构锁定'});
 const forbiddenStyle=/水彩|水墨|简笔|圆润线稿|手绘线稿|铅笔线稿|速写|扁平卡通/i;
 const threeD=/3d|三维|cinematic-3d/i.test(cd.style_id);
 const panels=board.map((v,i)=>{
  if(!String(v.scene||'').trim())throw Error('锁定分镜第'+(i+1)+'格缺少镜头场景');
  const unsafeText=String(v.scene||'')+' '+String(v.dialogue||'');
  if(/(?:提高|升高|调高).{0,3}水温/.test(unsafeText)&&/婴儿|宝宝|幼儿|浴盆|洗澡/.test(unsafeText))
   conflicts.push({code:'SAFETY_SCENE_REVISION_REQUIRED',panel:i+1,message:'第'+(i+1)+'格涉及婴幼儿洗浴与主动提高水温，须由作者确认安全修订并重新锁定剧情'});
  const raw=String(v.custom_prompt||p.panels[i]?.prompt||'');
  if(threeD&&forbiddenStyle.test(raw))conflicts.push({code:'LOCAL_STYLE_CONFLICT',panel:i+1,message:'第'+(i+1)+'格旧提示词存在与锁定3D画风冲突的风格描述；生图时已隔离，不作为视觉指令'});
  return {panel_id:'P'+String(i+1).padStart(2,'0'),index:i+1,title:String(v.title||''),
   editorial_dimension:review?(i<3?'what_the_book_is_about':i<6?'life_philosophy':'meaning_for_everyday_readers'):null,
   use_original_metaphor_only:review,
   camera:String(v.shot||''),scene:String(v.scene||''),required_actions:String(v.scene||''),
   dialogue:String(v.dialogue||''),caption:String(v.caption||''),no_text:true,
   exact_storyboard_source:'creative_direction.storyboard['+i+']'};
 });
 // Compare the approved cast against explicit role/name pairs in each legacy field.
 // Report the exact field and approved roster; never silently discard potential identities.
 // A literary review uses an editorial narrator and original modern readers, never the novel's cast.
 // Legacy synopsis names are bibliographic data, not approved characters, so do NOT compare them to the review's invented reader cast.
 if(!review){
 const known=new Set(cast.map(x=>String(x.name||'').trim()));
 const roster=[...known].filter(Boolean).join('、')||'（未命名）';
 const roleName=/(?:单亲妈妈|妈妈|女主角|男主角|主人公|主角|AI助手|AI机器人|AI)\s*[：:\-]?\s*([\u4e00-\u9fa5]{2,3})(?=[、，,。；;\s]|$)/g;
 const inputs=[{field:'项目人物设定（旧角色文本）',text:String(task.adaptation?.characters||'')},
  {field:'项目剧情描述（候选摘要）',text:String(task.source?.candidate_summary||'')}];
 const seen=new Set();
 for(const input of inputs)for(const hit of input.text.matchAll(roleName)){
  const name=hit[1],key=input.field+'|'+name;
  if(seen.has(key)||known.has(name)||/(?:角色|模型|助手|手机|机器|孩子|宝宝|功能|系统|时代)/.test(name))continue;
  seen.add(key);
  conflicts.push({code:'NAME_CONFLICT_REVIEW_REQUIRED',name,field:input.field,approved_cast:[...known],
   message:input.field+'出现“'+name+'”，正式角色名单为「'+roster+'」。请在项目编辑中核对该人名是否为旧稿残留；如确为正式人物，请在创意导演台统一角色后重新锁定。'});
 }
 }
 return {schema:'davylab.worldtoon.production-bible.v1',task_id:task.task_id,
  authority:['author_approved_creative_direction','locked_storyboard','summary_for_research_only','legacy_custom_prompt_ignored_for_generation'],
  story_title:task.title,style_id:cd.style_id,visual_lock:cd.visual_rules||{},style_lock:cd.style_lock||{},
  creative_lock_hash:cd.approval.lock_hash,characters:cast.map((x,i)=>({character_id:'C'+String(i+1).padStart(2,'0'),
   name:x.name,role:x.role,look:x.look,clothes:x.clothes,symbol:x.symbol,nature:x.nature,
   portrait_reference:x.portrait_reference||null})),
  panels,cover_brief:cd.cover_brief||task.title,conflicts,
  literary_review:review?task.adaptation?.literary_review:null,
  evidence_state:{character_sheet_sha256:null,pilot_frame_sha256:null,pilot_approved:false,
   image_generation_model:'unknown',image_generation_version:'unknown',publication_approved:false}};
}
function wfProductionPreflight(p){
 if(!p)return {ready:false,reasons:['尚未选择项目']};
 try{
  const bible=wfProductionBible(p,wfTaskObject(p));
  const blockers=bible.conflicts.filter(x=>/REVIEW_REQUIRED|REVISION_REQUIRED/.test(x.code));
  return {ready:blockers.length===0,reasons:blockers.map(x=>x.message)};
 }catch(err){return {ready:false,reasons:[String(err?.message||err)]}}
}
function wfSingleImageJobs(p,task,bible){
 const fixed=bible||wfProductionBible(p,task),cd=task.creative_direction||{};
 const literaryReview=!!fixed.literary_review;
 const style=JSON.stringify({style_id:fixed.style_id,visual_lock:fixed.visual_lock,
  characters:fixed.characters.map(x=>({id:x.character_id,name:x.name,role:x.role,look:x.look,clothes:x.clothes,symbol:x.symbol}))});
 const constraint='ONE IMAGE ONLY. One uninterrupted 3:4 vertical canvas at native 1080x1440 or higher, ONE scene, ONE camera, ONE moment. NO contact sheet, NO storyboard page, NO nine-grid, NO comic strip, NO split screen, NO inset, NO collage, NO multiple scenes, NO panel frames, gutters, tiles or dividing lines. Render only this target frame, not the whole story. Absolutely NO lettering, glyphs, captions, UI text or speech bubbles inside the image; approved Chinese dialogue must be typeset in a separate layer. Use actual approved character-sheet for identities and approved pilot for style ONLY when physically supplied, never treat filename as proof. ';
 const jobs=fixed.panels.map((a,i)=>({
  job_id:a.panel_id,target:'panels/'+String(i+1).padStart(2,'0')+'.png',
  target_type:'panel',panel_index:i+1,image_calls:1,expected_image_count:1,expected_scene_count:1,
  no_text:true,max_retries:2,requires_physical_reference_images:true,
  reference_assets:i===0?['character-sheet.png']:['character-sheet.png','pilot-01.png'],
  scene_only:a.scene,camera:a.camera,required_actions:a.required_actions,
  required_props:[],visible_characters:fixed.characters.map(x=>x.character_id),
  approved_caption_for_separate_typesetting:a.caption,approved_dialogue_for_separate_typesetting:a.dialogue,
  prompt:constraint+(literaryReview?'ORIGINAL LITERARY COMMENTARY, NOT BOOK PLOT ADAPTATION. Never reproduce copyrighted novel scenes, famous book character likenesses, distinctive original dialogue or copyrighted book art. Section: '+a.editorial_dimension+'. Create an original metaphor or everyday original person for independent literary criticism. ':'')+'TARGET: panel '+(i+1)+' (NOT a multi-panel layout). Camera: '+a.camera+'. Fixed approved visual bible: '+style+'. CURRENT APPROVED SCENE ONLY: '+a.scene+'. No neighboring story beats. No textual content.'
 }));
 jobs.push({job_id:'COVER',target:'cover.png',target_type:'cover',panel_index:null,
  image_calls:1,expected_image_count:1,expected_scene_count:1,no_text:true,max_retries:2,
  requires_physical_reference_images:true,reference_assets:['character-sheet.png','pilot-01.png'],
  prompt:constraint+(literaryReview?'Independent literary review cover, not a licensed edition or novel scene. ':'')+'TARGET: independent COVER ONLY. One original editorial illustration, NOT a reused panel background or plot overview. Approved visual bible: '+style+'. Cover art concept ONLY: '+String(fixed.cover_brief||task.title).slice(0,900)+'. Leave separate title-safe space.'});
 return {schema:'davylab.worldtoon.single-image-jobs.v2',task_id:task.task_id,
  panel_count:p.panels.length,expected_files:p.panels.length+1,reference_images:['character-sheet.png','pilot-01.png'],
  production_bible:'production-bible.json',
  retry_policy:{max_retries_per_job:2,on_repeat_failure:'model_unreliable_for_panel; stop identical retries and report backend/reference issue',preserve_accepted_sha256:true},
  protocol:'Execute exactly ONE jobs[i].prompt in each separate image-generation call. NEVER send this full JSON, task.json, the complete storyboard or all prompts in one image tool request. Physically attach approved character-sheet and pilot reference files and log their SHA256. Reuse approved pilot-01.png as panels/01.png byte-for-byte without rerendering. Draw remaining panels in order; draw cover in its own last call. Reject contact sheets and rerender only the faulty target. Never crop a mosaic into panels. No model-generated Chinese text.',
  jobs};
}
function wfDirectPrompt(p,o){
 const shots=p.panels.map((a,i)=>'#'+String(i+1).padStart(2,'0')+' '+(a.title||'第'+(i+1)+'格')+'\n场景与构图：'+(a.scene||'待完善')+'\n旁白：'+(a.caption||'')+'\n对白：'+(a.dialogue||'')+'\n视觉要求：'+(a.prompt||'')).join('\n\n');
 return [
 'WORLD/TOON · By DAVYLAB | DIRECT_CHATGPT_LOCAL_V1 | 完整漫画制作指令',
 '任务编号：'+o.task_id+'；标题：《'+p.title+'》；生产者：ChatGPT；篇幅：'+p.panels.length+' 格。',
 '【生产方式】作者通过平台手动下载任务 ZIP 并交给 ChatGPT，绝不宣称该任务已入 GitHub。生产环节暂停 GitHub 同步、远端领单、远端样稿审批、GitHub Token、WorkBuddy 轮询及远端 SHA 验证；不得以未入仓为由停止创作。此豁免仅限本地全量素材制作，不等于正式发表授权。',
 '【强制分图生产 SINGLE_IMAGE_PER_CALL_V2】全量交付只是任务最终目标，不是一次生图指令。先看 render_jobs.json，它是一组独立的图片任务。每次仅把 jobs[i].prompt 和实际批准的角色/首格参考送入图像生成工具；调用一次只生 1 张 PNG、1 个画面、1 个镜头、1 个时刻。绝不把本总任务、九格分镜全文、所有 jobs、封面加九格要求，一次性提交给生图模型。禁止一张图里出现九宫格、拼版、多镜头、画中画、条漫、多画框、分隔线或故事总结图。按顺序先定妆再首格；批准首格后其原图直接作为 01.png，顺次制作后续画格，封面单独最后生成。若出拼图或错画格，判 INVALID_COMPOSITE，仅重绘该 job，不裁切拼版充数。',
 '【单图验收与失败恢复】每次生图后核对目标路径、原生分辨率、单场景连续画布、无分割/无嵌套小图、人物脸型服装与母版一致、中文排版预留区；明确在 QA 中记录 single_scene_verified、no_contact_sheet、target_story_match。检测失败不得登记为已完成帧，必须同一个 job 单独重绘；如当轮上限触发，保存已通过的实际文件和断点，禁止反复重画已合格画格。',
 '【交付目标】真正绘制 1 张独立封面及 '+p.panels.length+' 张独立正式漫画 PNG，全部采用适合手机的竖版 3:4、原生至少 1080×1440；附 caption.md、sources.md、manifest.json、QA_STATUS.md、production_state.json，并形成一个可下载 ZIP。严禁仅输出提示词、脚本、九宫格拼图裁切、SVG/CSS 线框或占位图片。',
 '【唯一定妆关口】开始时建立角色圣经、视觉圣经及首格正式样稿。若附件已有真实定妆图及首格样稿且作者已明确批准，则直接沿用，无需再次确认；否则只针对实际定妆图和首格请作者确认一次。作者明确确认后，直接连续绘制剩余画格、独立封面、排版、文案与完整 ZIP；不要另设 GitHub、Pilot 云端审批或例行阶段确认节点。',
 '【角色一致性】每个 character_id 锁定脸型、五官、发型、体态、服饰、主色、道具与参考图；每张画格参考同一角色母版及首格，锁定笔触、光影、材质与色板，不允许变脸、换装、改故事、错置道具。',
 '【verified_sources 与新闻版权】研究型新闻必须在 manifest.json 提供 verified_sources 数组及 sources.md 的可追溯原始报道与发生日期。现实新闻先核实可信原始来源、事件日期、真实身份、事实与观点边界；无证据的指控不得变成纪实画面。原创故事不伪造新闻链接。忠实改编受保护作品必须有授权；不得以改名规避版权或影射未经证实的指控。',
 '【严格 QA】逐格检查原生分辨率、画面完整度、中文文字、手机阅读安全区、人物识别、画风连续、事实准确、来源与使用权。失败图只返工有问题的画格并复核整套。实际保存并计算全部文件 SHA256；未实际核验事项记为 pending，禁止假报 QA 通过。确认封面不复制任何画格，正式第一格保持与批准样稿相同的图像内容。',
 '【交付目录】任务 ZIP 内必须附 render_jobs.json 和 render_jobs.md（逐张提示词，不是生图成品）；最终交付 ZIP 含 cover.png；panels/01.png … panels/'+String(p.panels.length).padStart(2,'0')+'.png；caption.md；sources.md；manifest.json；QA_STATUS.md；production_state.json；character-lock.json 与 pilot 样稿可作附加参考。ZIP 要一键下载，真实文件应先存在且经过本地检查。',
 '【断点续作】不能保证后台异步工作；当单次会话或生图工具受限时，先保存已成功的真实 PNG 及 production_state.json（含 task_id、已完成画格、待办和锁定母版校验值），准确报告缺失项。用户发“继续”后接续同一任务的未完成画格，禁止清空或从头重做。只有全部文件和 QA 达标才宣称完整交付。WorkBuddy 正式发表仍须作者单独授权。',
 '【来源与创作方向】类型：'+p.category+'；创作模式：'+o.mode+'；剧情：'+(p.description||'以分镜为准')+'；风格：'+(p.tone||'高级编辑漫画')+'；核验状态：'+o.verification_status+'；候选来源：'+(validSources(p).join('；')||'暂无')+'；事实笔记：'+(p.factNotes||'待核验')+'；虚构声明：'+(p.disclosure||'原创艺术改编')+'；原著许可：'+JSON.stringify(p.storySourceSelection||null),
 ...(wfLiteraryReview(p)?[wfLiteraryReviewGuide(p)]:[]),
 '【已锁定角色与视觉创作圣经】\n'+JSON.stringify(o.creative_direction,null,2),
 '【以下是文本导演分镜，禁止整体传给生图工具】\n'+shots
 ].join('\n\n');
}
function wfStartupCommand(p,task){
 const o=task||wfTaskObject(p),review=wfLiteraryReview(p);
 return [
  '【WORLD/TOON · By DAVYLAB｜正式开工命令｜请立即执行】',
  '我现在正式下达这部漫画的制作任务。此消息同时附有 WORLD_TOON 任务 ZIP，请直接读取并执行，不需要再询问“想如何处理 ZIP”“要脚本还是漫画”等已明确的问题。',
  '任务编号：'+(o.task_id||'【任务号缺失，请核对 task.json】'),
  '作品：《'+(o.title||p.title)+'》；创作类型：'+(review?'三维文学导读（独立评论，不是原著剧情重绘）':o.mode==='original'?'原创漫画':'新闻／主题漫画')+'；预计交付：'+o.panel_count+' 张独立竖版漫画 PNG＋1 张独立封面 PNG＋文案、事实及版权说明、QA 与完整可下载 ZIP。',
  '首先解压附件并按顺序阅读：00_START_HERE.md → task.json → ChatGPT_制作指令.md → production-bible.json → render_jobs.json → production_state.json。以 task_id 与作者已锁定的分镜和视觉圣经为准，禁止自行更换人物、画风和具体镜头。',
  review?'本作须先核实书名、作者、出版背景、作家获诺奖与本书的关系及可信评论；按01–03“作品讲了什么”、04–06“人生哲学”、07–09“对普通人的意义”制作原创编辑漫画。不得逐幕复刻原著情节、经典对白或原著插画，不得把编辑解读伪装为作者原话。':'新闻事实先核实可信来源；现实争议、具体人物或版权材料须按照任务内规则保护，虚构内容应明确标注。',
  '请直接开始研究与创意核对，并实际推进角色定妆图和第01格样稿。只有在必须由作者确认真实定妆／首格时请请求一次批准；确认后继续逐张独立生成、排版和验收。不得用一张九宫格拼图代替9张独立图片，也不得仅提供分镜、文字提示词或计划作为完成交付。',
  '每次生图严格只执行 render_jobs.json 中一个 job 的 prompt；不要将整个故事和九张分镜一次送给生图模型。真实原图不低于1080×1440（竖版3:4），中文另行准确排版。保留已有通过QA的画格，失败只重绘当前格。',
  '本任务的制作交付临时不依赖 GitHub 入仓。不得要求我重新解释附件任务，亦不得擅自代替作者同意发表。若附件读取失败或工具能力确实受限，请指出具体文件／阻碍和已实际完成成果，不虚构图片、SHA或下载链接。',
  '现在立即按 ZIP 执行。首个回复应给出实际读取到的任务编号、作品名、研究和制作动作；仅在遇到具体缺失或真实审批点时提问。'
 ].join('\n\n');
}
function wfStartHere(p,task,launch){
 return '# WORLD/TOON · By DAVYLAB｜ChatGPT 直达任务启动说明\n\n'+
  '本 ZIP 是正式创作任务数据包，而不是漫画成品。仅上传 ZIP 文件不保证对话模型将其识别为“立即执行”；请同时发送明确的开工命令。\n\n'+
  '## 正确的启动操作\n\n'+
  '1. 打开 ChatGPT 对话，在同一条用户消息中上传整个 ZIP。\n'+
  '2. 在文本输入框粘贴下面【正式开工命令】，再点击发送；或使用 WORLD/TOON 交接中心的“复制开工指令”按钮。\n'+
  '3. 不需要再手动粘贴全部导演分镜；ZIP 内的 ChatGPT_制作指令.md 和 render_jobs.json 已包含全量制作细节。\n'+
  '4. 如 ChatGPT 只问“你希望如何处理压缩包”，请补发该开工命令，不必重新制作平台任务。\n\n'+
  '## 正式开工命令（复制以下全文，并与 ZIP 一起发送）\n\n'+launch+'\n\n'+
  '## 身份与交付说明\n\n'+
  '- 任务 ID：'+task.task_id+'\n- 题名：《'+task.title+'》\n'+
  '- 当前状态：任务指令包已生成；真正的漫画图片、封面和出版批准尚未完成。\n'+
  '- 事实和版权待核查时不应伪造已核验状态；作品及视觉使用权仍须单独审查。\n';
}
function wfPrompt(p){const o=wfTaskObject(p);if(o.producer==='ChatGPT')return wfDirectPrompt(p,o);return (wfLiteraryReview(p)?wfLiteraryReviewGuide(p)+'\n\n':'')+'【独立图像生产强制协议 SINGLE_IMAGE_PER_CALL_V2】任务最终要产出完整漫画，但绝不能单次生图整个故事。任务 ZIP 内 render_jobs.json 含每张图唯一提示词与目标文件，每次仅传一个 jobs[i].prompt 到生图模型。严格一调用一张原图一镜头；不得画九宫格、拼版、故事总览或画中画；首格经批准后沿用原图，后续画格依次单独生成，封面最后独立生成；每格检查 single_scene_verified/no_contact_sheet；失败只重绘本帧。\n\n'+`你是 WORLD/TOON · By DAVYLAB 的专属漫画编剧、美术总监、质量审校。\n本任务由我的漫画平台正式下发，创作者为${o.producer}，WorkBuddy 负责微信公众号发布。\n\n任务编号：${o.task_id}\n标题：《${p.title}》\n题材：${p.category} · ${wfLiteraryReview(p)?'三维文学导读（原创评论，不是原著剧情改编）':wfMode(p)==='original'?'完全虚构':'全球热点虚构改编'}\n创作风格：${p.tone||'高级杂志感、黑色幽默'}。严格遵循已锁定的 creative_direction 创意制作圣经，不可用默认风格、默认人物或任意更改故事节奏。
原著／短剧剧情选择：${JSON.stringify(p.storySourceSelection||null)}。公版判定仅依据来源标记与具体司法辖区；非公版的忠实改编必须有有效授权，且作者和 GitHub 独立核验后才可出版。仅受主题启发的原创创作不得沿用原著人物、独特桥段与对白。\n剧情类型：${p.plotGenre==='viral-melodrama'?'狗血网红爽剧 / '+(p.dramaSubtype||'rebirth-bank-rich')+' / 反转强度'+(p.dramaIntensity||4)+'/5':'通用创作'}。人物必须是原创虚构成年人，不得编造可识别真人的关系或指控。
肖像角色：如本任务 ZIP 包含 references/portrait-XX 文件，仅可在本人授权范围内用作人物骨相、面部比例、发型特征的 3D 拟人化参考；不得公开原照，输出高质量 3D 角色定妆图供作者审阅，禁止把文字提示词冒充真实生成图片。\n现实事件候选链接：${validSources(p).join('；')||(wfMode(p)==='original'?'原创故事，无现实来源':'尚无来源，必须先检索核验')}\n当前核验状态：${wfResearchPolicy(p).verification_status}（pending_research 表示尚未核验）\n线索与核验笔记：${p.factNotes||'待 ChatGPT 核验'}\n虚构改编原则：${p.fiction}\n角色设定：${p.characters||'请创作原创虚构角色'}\n剧情：${p.description||'请基于选题完善'}\n系列连续性：${JSON.stringify(o.series_bible||null)} · 上一章任务：${p.previousTaskId||'无'}\n说明：${p.disclosure}\n\n【导演台已锁定的完整制作圣经】\\n${JSON.stringify(o.creative_direction,null,2)}\n\n【V3 真实首图身份锁】选择的风格、品质目标、角色、模型和绘图流程必须与首图正式生产一致。先制作正式 1080×1440 PNG 角色定妆 character-sheet.png 和首格原图 pilot-01.png，记录模型名及实际版本、参数、生成管线版本和两个 SHA-256。禁止 CSS、SVG、简笔占位图以及上采样成图。首图作者批准后，deliveries/<task_id>/panels/01.png 必须逐字节复制已批准的 pilot-01.png；SHA-256 完全一致，禁止重生图、二次压缩或替换。其余${p.panels.length-1}张及独立封面沿用同一画风与角色；提供 deliveries/<task_id>/style-lock.json（含 style_id、quality_target、preview_sha256、model_id、model_version）、manifest.image_provenance、V3 六项额外 QA 与原图来源。未有真实模型或美术 QA 不通过时，标记 blocked，不能用文字或 SVG 代替。
【两阶段生产强约束】必须先输出定妆图 character-sheet.png 与首格试画 pilot-01.png 供作者复核。未获得作者对于样稿的独立确认，不允许批量生成其余画格，也不能冒充整部已完成。即使在研究阶段需要修正事实，也不能未经授权随意更换画风、角色、服装和整体故事结构；若必须改变，请标注 blocked 并请求新创意定稿。\n\n请按以下要求完成。若这是研究型任务，先调查资料与整理证据，再决定是否能够继续创作；来源不可靠时不得把虚构说成真实新闻：\n1. 研究阶段：对于热点改编，必须首先检索并核对至少一条可信的一手来源及真实日期，在来源清单记录核验结果、证据、未确认点；若没有有效证据，停止现实事件改编并在交付状态标注 blocked。不能把候选摘要、未经证实的指控或仅换名影射当作事实。原创故事不需要伪造新闻证据。\n2. 完成 ${p.panels.length} 格分镜台词，并生成 ${p.panels.length} 张彼此独立的漫画图片，画幅适合手机贴图阅读（建议 3:4）；角色、服装、视觉系统贯穿全书；不要只提供一张九宫格拼图。\n3. 同时生成独立封面、准确的中文台词、故事导语和微信贴图文案；如有可用的 PDF 漫画册也一并生成。\n4. 按 WORLD/TOON 仓库协议输出正式交付：cover.png、panels/01.png 至 ${String(p.panels.length).padStart(2,'0')}.png（${p.panels.length}张真实独立 PNG，至少1080×1440）、caption.md、sources.md、manifest.json；可另附 comic.pdf。禁止占位图或九宫格拼图替代。\n5. manifest.json 必须遵循 contracts/delivery.example.json 的 davylab.worldtoon.delivery.v2 协议，列出 assets、sha256、八项 QA。若属于研究型任务（research_required=true），附 verified_sources 数组（至少一条完成核验的真实网址），在 sources.md 写明来源/日期及待确认点；来源核验失败必须标记 blocked，不能进入 WorkBuddy 发表队列。\n6. 制作 Agent 先完成真实图片和文案并上传 GitHub，核实远端文件与 SHA256 后才可将 ready_for_qa=true；author_approved 必须由作者独立审核，制作 Agent 不得代签，任何待审资料不得宣称已交付或发表。\n\n已审核锁定的分镜（禁止擅自改写剧情、人物、固定造型；只允许纠正错误并向作者提出修订建议）：\n${p.panels.map((a,i)=>`#${String(i+1).padStart(2,'0')} ${a.title||'第'+(i+1)+'格'}\n画面：${a.scene||'待设计'}\n旁白：${a.caption||'待撰写'}\n对白：${a.dialogue||'待撰写'}\n美术备注：${a.prompt||'无'}`).join('\n\n')}\n\n完成后请直接交付下载文件。正式交付要求：将${p.panels.length}张真实独立图片、封面、来源和文案以二进制提交到私有 GitHub 仓库 chenzhe223-tech/worldtoon 的 deliveries/<task_id>/；最后才设置 ready_for_qa=true。不得以 sandbox 链接或 ZIP 文件名称冒充 GitHub 交付。GitHub Actions 严格验收后形成 queue/workbuddy.json；WorkBuddy 定时扫描并发表，最后写入 receipts/<task_id>.json。`}
function wfHint(){return `<div class="wf-banner"><strong>制作流程已调整：</strong>ChatGPT 直达模式：下载 ZIP 交给 ChatGPT，定妆后直接输出完整素材包；生产阶段不连接 GitHub。WorkBuddy 正式发表仍按独立验收与授权执行。本站不调用自动生图接口。 <a href="#/handoff"><strong>进入制作交接中心 →</strong></a></div>`}
function wtWorkflow(){const ps=activeProjects(),p=selected();const h=wfGet(p);
const previewGate=p&&typeof wtDirector!=='undefined'&&wtDirector.approved(p)?wfProductionPreflight(p):null;
return heroHeader('THE PRODUCTION DESK / THREE-HANDOFFS','制作交接中心','平台定稿 → ChatGPT 直达制作 → 全量漫画 ZIP；GitHub 生产同步暂时关闭，正式发表仍需独立 QA、作者授权及真实发表回执。')+
'<div class="wf-path"><span>01 平台：选题与制作任务</span><span>→</span><span>02 ChatGPT / WorkBuddy：漫画生产</span><span>→</span><span>03 GitHub QA → 作者授权 → WorkBuddy 发表</span></div>'+
`<div class="box"><div class="wf-form"><div class="field"><label>选择项目</label><select id="wfProject">${ps.map(x=>`<option value="${e(x.id)}" ${p?.id===x.id?'selected':''}>${e(x.title)}</option>`).join('')}</select></div><div class="field"><label>内容类别</label><select id="wfMode" ${wfLiteraryReview(p)?'disabled aria-label="文学导读模式已锁定"':''}>${wfLiteraryReview(p)?'<option selected value="literary_review">三维文学导读（作品／哲学／人生）</option>':`<option value="hotspot" ${wfMode(p)==='hotspot'?'selected':''}>全球热点虚构改编</option><option value="original" ${wfMode(p)==='original'?'selected':''}>完全原创虚构</option>`}</select></div><div>${wfStatus(p)}</div></div><p class="wf-meta">资料编辑请到 <a href="#/studio/${e(p?.id||'')}">创作工作台</a> · 素材来源请到 <a href="#/radar">选题池</a> · 图片回传只保存在当前作品，不会替换其他项目</p></div>`+
(p?`<div class="wf-layout"><section class="wf-step ${wfPhase(p)==='not_started'?'active':''}"><div class="wf-stephead"><span class="wf-num">01</span><span class="chip">平台</span></div><h3>生成制作任务</h3><p>${wfLiteraryReview(p)?'核对作品与作者资料，按“讲了什么／人生哲学／普通人意义”三维构建九格原创文学导读。':'整理新闻来源、事实与虚构边界、角色设定、九格分镜，产生可追溯的任务编号和标准任务包。'}</p><p class="wf-meta">${wfPhase(p)==='not_started'?'尚未生成有效制作任务包':h.taskId?'任务编号：'+e(h.taskId):'尚未建立任务'}</p><p class="wf-meta" style="margin:12px 0">${e(wfTaskReadiness(p))}</p><div class="wf-director-gate"><strong>先确认画风、人物与剧情</strong><p>先在导演台锁定角色、画风和分镜，ChatGPT 直达模式无需 Github 派单。</p><a class="button dark" href="#/director/${e(p.id)}">进入创意导演台 →</a><span>${previewGate?(previewGate.ready?'创意已定稿 · 生产预检通过':'创意已定稿 · 生产预检待修正'):'待作者确认 · 不允许盲派单'}</span></div>
${previewGate&&!previewGate.ready?'<p class="wf-meta" role="alert">生产任务暂不可导出：'+previewGate.reasons.map(x=>e(x)).join('；')+'</p>':''}${wfInlineEditor(p)}<div class="wf-launch-guide"><strong>交给 ChatGPT：两样必须一起发送</strong><p>① 下载任务 ZIP → ② 复制开工指令 → ③ 在 ChatGPT <b>同一条消息</b>上传 ZIP 并粘贴开工指令后发送。<b>仅上传 ZIP 文件，ChatGPT 可能不知道要立即制作。</b>ZIP 内亦附有 00_START_HERE.md 和同一份开工指令。</p></div><button class="button dark" data-wf="task">① 下载完整制作任务 ZIP</button><button class="button" data-wf="copy">② 复制 ChatGPT 开工指令</button><a class="button" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">打开 ChatGPT ↗</a></section>
<section class="wf-step ${wfPhase(p)==='task_ready'?'active':''}"><div class="wf-stephead"><span class="wf-num">02</span><span class="chip">ChatGPT</span></div><h3>接收完整漫画</h3><p>ChatGPT 制作九张独立画格和封面，打包后由此导入。支持 ZIP（含常见压缩格式）或逐张图片导入。</p><p class="wf-meta">已导入画格：${p.panels.filter(x=>x.image).length}/9　|　独立封面：${p.cover?'已具备':'缺失'}</p><label class="button dark">导入 ChatGPT 交付包<input type="file" id="wfUpload" accept=".zip,application/zip,.png,.jpg,.jpeg,.webp,.pdf,.json" multiple hidden></label><a href="#/reader/${e(p.id)}" class="button">漫画预览 ↗</a><p class="wf-meta">导入前校验任务编号、图片签名、数量与大小；旧图片不会在校验失败时被覆盖。</p></section>
<section class="wf-step ${['delivered','workbuddy_ready','workbuddy_processing'].includes(wfPhase(p))?'active':''}"><div class="wf-stephead"><span class="wf-num">03</span><span class="chip">WorkBuddy</span></div><h3>交给公众号执行</h3><p>必须完成作者审核。生成包含九张漫画、封面、来源台账、文案和执行说明的 WorkBuddy 专用 ZIP。</p><p class="wf-meta">作者审核：${p.status==='已审核'||p.status==='已发布'?'已通过':'未通过'}　·　${p.checks.filter(Boolean).length}/6 项复核</p><button class="button dark" data-wf="publishpack">生成 WorkBuddy 发表包</button><button class="button" data-wf="mark-sent">记录已移交</button><a class="button" href="#/studio/${e(p.id)}/4">完成审核 ↗</a></section></div>`:'<div class="empty">请先建立一部作品。</div>')+
(typeof wtSharedHandoffPanel==='function'?wtSharedHandoffPanel(p):'<div class="box"><h2>公众号发表档案</h2><p>共享档案读取组件尚未载入。请稍后刷新。</p></div>')+
`<section class="box" style="margin-top:20px"><h3>三方责任界面</h3><p class="wf-instructions"><strong>WORLD/TOON：</strong>发出明确且可复查的任务工单，不生图、不代替 ChatGPT。<br><strong>ChatGPT：</strong>完成漫画生产及完整的可下载交付包，不能以空文件或生成说明冒充成品。<br><strong>WorkBuddy：</strong>核验成品、进入公众号后台上传贴图，按授权的计划发表，并回传文章链接或后台结果。不依赖平台猜测发表结果。</p></section>`}
function wfInitTask(p){let h=p.handoff||{};if(!h.taskId||wfPhase(p)==='not_started'){h.taskId='WT-'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+uid().slice(0,8);h.taskAt=now()}h.mode=wfMode(p);h.phase='task_ready';p.handoff=h;setChange(p,'生成 ChatGPT 制作任务');return h}
async function wfMakeTask(p){
 if(p?.handoff?.repoQueuedAt&&p.productionAgent==='WorkBuddy')throw Error('已派单的 WorkBuddy 任务不可覆盖，请复制作品并创建修订版');
 wfPrepareTask(p);
 const missing=wfCanTask(p);if(missing.length)throw Error('请先补齐：'+missing.join('、'));
 // Run the same preflight displayed in the UI before creating any task ID or persisting a task_ready state.
 const preflight=wfProductionPreflight(p);
 if(!preflight.ready)throw Error('生产母版预检未通过：'+preflight.reasons.join('；'));
 if(p.productionAgent==='WorkBuddy'&&(p.creativeDirection?.cast||[]).some(ch=>ch.portraitMedia&&ch.portraitConsent))
  throw Error('WorkBuddy 自动派单目前不能安全传输真人肖像参考。请改用 ChatGPT 制作并导出授权照片 ZIP，或移除肖像照片。');
 wfInitTask(p);
 if(typeof wtArchiveKey==='function'){const key=await wtArchiveKey(p);p.handoff.taskId='WT-'+key.slice(0,20)}
 const task=wfTaskObject(p),prompt=wfPrompt(p);
 const bible=wfProductionBible(p,task);
 const blockers=bible.conflicts.filter(x=>/REVIEW_REQUIRED|REVISION_REQUIRED/.test(x.code));
 if(blockers.length)throw Error('生产母版预检未通过，请先修订并重新锁定创意：'+blockers.map(x=>x.message).join('；'));
 const renderJobs=wfSingleImageJobs(p,task,bible);
 const productionState={schema:'davylab.worldtoon.production-state.v1',task_id:task.task_id,
  current_working_version:'task-created',creative_lock_hash:bible.creative_lock_hash,
  job_states:Object.fromEntries(renderJobs.jobs.map(j=>[j.job_id,{status:'missing',attempts:0,accepted_sha256:null}])),
  accepted:{},rejected:{},package_ready:false,github_delivered:false,publication_approved:false,workbuddy_ready:false};
 task.image_render_protocol='single_image_per_call.v2';task.render_jobs_file='render_jobs.json';task.production_bible_file='production-bible.json';task.preflight_conflicts=bible.conflicts;task.expected_image_count=task.panel_count+1;
 if(task.producer==='ChatGPT'){task.production_mode='direct_chatgpt_local_v1';task.github_sync_required=false;task.delivery_target='local_zip';task.publication_approved=false;}
 const portraitCharacters=p.creativeDirection?.cast||[];
 const portraitFiles=[];
 for(let i=0;i<portraitCharacters.length;i++){
  const ch=portraitCharacters[i];
  if(!ch.portraitMedia)continue;
  if(ch.portraitConsent!==true)throw Error('第'+(i+1)+'位角色的真人肖像尚未确认使用授权');
  if(!ch.portraitMedia.startsWith('media:'))throw Error('肖像参考必须来自本机授权上传，不允许未核验外部链接');
  const blob=await getMedia(ch.portraitMedia.slice(6));
  if(!blob)throw Error('肖像参考照片仅存于原设备。请回到导演台重新上传第'+(i+1)+'位角色照片');
  if(blob.size>8*1024*1024||blob.size<1024)throw Error('真人参考照片大小超限');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==ch.portraitSha256)throw Error('第'+(i+1)+'位角色参考照与锁定的 SHA256 不一致，请重新上传');
  portraitFiles.push({name:'references/portrait-'+String(i+1).padStart(2,'0')+'.'+(ch.portraitExt||'png'),bytes});
 }
 if(portraitFiles.length&&task.producer==='WorkBuddy')
  throw Error('WorkBuddy 自动派单目前没有私有肖像照片传输接口。请选 ChatGPT 创作，并将带照片的授权 ZIP 交给 ChatGPT；或先移除照片。');
 const launch=wfStartupCommand(p,task);
 task.startup_command_file='ChatGPT_复制粘贴开工指令.txt';
 task.entrypoint_file='00_START_HERE.md';
 task.requires_explicit_user_message=true;
 task.attachment_alone_starts_production=false;
 const files=[{name:'00_START_HERE.md',bytes:enc.encode(wfStartHere(p,task,launch))},
 {name:'ChatGPT_复制粘贴开工指令.txt',bytes:enc.encode(launch)},
 {name:'production_state.json',bytes:enc.encode(JSON.stringify(productionState,null,2))},{name:'production-bible.json',bytes:enc.encode(JSON.stringify(bible,null,2))},{name:'render_jobs.json',bytes:enc.encode(JSON.stringify(renderJobs,null,2))},{name:'render_jobs.md',bytes:enc.encode(renderJobs.jobs.map(j=>'## '+j.job_id+' → '+j.target+'\n'+j.prompt).join('\n\n'))},{name:'task.json',bytes:enc.encode(JSON.stringify(task,null,2))},{name:(task.producer==='WorkBuddy'?'WorkBuddy':'ChatGPT')+'_制作指令.md',bytes:enc.encode(prompt)},{name:'交接说明.txt',bytes:enc.encode((task.producer==='ChatGPT'?'本 ZIP 是直接交给 ChatGPT 的独立制作任务；注意必须在上传 ZIP 的同一条消息中同时发送“ChatGPT_复制粘贴开工指令.txt”内的开工命令，否则 ChatGPT 可能只询问如何处理附件。完整启动步骤见 00_START_HERE.md。生产不依赖 GitHub 入仓、Token 或远端 Pilot 回执。确认真实角色定妆后直接制作全套独立漫画 PNG、封面、文案及可下载 ZIP，并进行本地 QA；正式微信公众号发表仍需作者独立授权。':'WorkBuddy 正式生产任务必须按原有私有 GitHub 工单、样稿审批和成品验收流程执行。不得以 ChatGPT 直达模式绕过作者审批或发表门槛。')+'references/ 文件仅供经作者授权的创作者进行真人照片拟人化角色参考，禁止将原人像公开到书架、成品或未授权外部服务；请在私有通道传递含照片的 ZIP，并在生成角色定妆图后由作者确认相似度。')},...portraitFiles];
 saveFile(packZip(files),'WORLD_TOON_'+(task.producer==='WorkBuddy'?'WorkBuddy':'ChatGPT')+'任务_'+safeName(p.title)+'.zip');
 if(task.producer==='ChatGPT'){
  p.handoff={...p.handoff,directDeliveryMode:true,directTaskExportedAt:now(),repoError:null};
  setChange(p,'ChatGPT 直达完整素材生产（无需 GitHub）');render();
  notify('任务 ZIP 已下载。下一步点击“复制开工指令”，与 ZIP 一起发送给 ChatGPT；只上传文件不足以明确开工。');
  return;
 }
 if(typeof wtArchivePushTask!=='function'){p.handoff.repoError='仓库派单接口未加载';setChange(p,'仅生成本地备份，尚未入仓');render();notify('任务 ZIP 已生成，但尚未派单入仓');return}
 try{const result=await wtArchivePushTask(p,task,prompt);p.handoff.repoError=null;setChange(p,'GitHub 工单写入已确认');render();notify(result.existing?'GitHub 仓库已存在同一任务（已去重）':'GitHub 漫画仓库正式派单成功');if(typeof wtArchiveRefresh==='function')void wtArchiveRefresh({silent:true}).catch(()=>{})}
 catch(err){p.handoff.repoQueuedAt=null;p.handoff.repoError=String(err?.message||err);setChange(p,'GitHub 派单未成功，本地 ZIP 已保留');render();notify('尚未派单到 GitHub：'+p.handoff.repoError)}
}
async function wfCopyPrompt(p){
 const h=wfGet(p);
 if(!h.taskId||!h.directTaskExportedAt||wfPhase(p)==='not_started')
  throw Error('请先点击“生成 ChatGPT 直达任务 ZIP”，然后复制同一任务的开工命令。');
 if(!wtDirector?.approved?.(p))
  throw Error('导演台创意方案已改变，旧任务与当前作品可能不一致，请重新锁定并导出 ZIP');
 const preflight=wfProductionPreflight(p);
 if(!preflight.ready)throw Error('当前制作预检未通过，请先修复：'+preflight.reasons.join('；'));
 const task=wfTaskObject(p);
 await copyText(wfStartupCommand(p,task));
}
const wfImgExt=f=>/\.(png|jpg|jpeg|webp)$/i.test(f),wfImageMime=n=>/\.png$/i.test(n)?'image/png':/\.webp$/i.test(n)?'image/webp':'image/jpeg';
function wfImageFile(name,bytes){let type=wfImageMime(name);if(bytes.length<16||bytes.length>12*1024*1024)throw Error('单张图片超出 12MB 或为空：'+name);let png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;let jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;let webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!(png&&type==='image/png'||jpg&&type==='image/jpeg'||webp&&type==='image/webp'))throw Error('图片格式与文件名不一致：'+name);return new Blob([bytes],{type})}
async function wfUnzip(file){const raw=new Uint8Array(await file.arrayBuffer());if(raw.length>180*1024*1024)throw Error('ZIP 超过 180MB 限制');let cd=-1;for(let i=raw.length-22;i>=Math.max(0,raw.length-65557);i--){if(raw[i]===80&&raw[i+1]===75&&raw[i+2]===5&&raw[i+3]===6){cd=i;break}}if(cd<0)throw Error('找不到 ZIP 中央目录');const view=new DataView(raw.buffer);let count=view.getUint16(cd+10,true),pos=view.getUint32(cd+16,true),seen=new Map(),total=0;if(count>90)throw Error('交付包文件数量超过 90');for(let i=0;i<count;i++){if(view.getUint32(pos,true)!==0x02014b50)throw Error('ZIP 索引无效');const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),csize=view.getUint32(pos+20,true),usize=view.getUint32(pos+24,true),nlen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true),name=dec.decode(raw.slice(pos+46,pos+46+nlen));pos+=46+nlen+extra+comment;if(!name||name.endsWith('/'))continue;if(name.includes('..')||name.startsWith('/')||/^[A-Za-z]:/.test(name))throw Error('ZIP 包含非法路径');if(flags&1)throw Error('不支持加密 ZIP');if(![0,8].includes(method))throw Error('ZIP 使用了不支持的压缩方法');if(usize>22*1024*1024||csize>180*1024*1024)throw Error('ZIP 中包含超大文件');total+=usize;if(total>240*1024*1024)throw Error('ZIP 解压总量超过 240MB，请适当压缩原图');if(view.getUint32(local,true)!==0x04034b50)throw Error('ZIP 条目损坏');const at=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);if(at+csize>raw.length)throw Error('ZIP 内容越界');let bytes=raw.slice(at,at+csize);if(method===8){if(!('DecompressionStream'in window))throw Error('浏览器不支持 ZIP 解压；可改为逐张上传图片');try{const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));bytes=new Uint8Array(await new Response(stream).arrayBuffer())}catch{throw Error('压缩 ZIP 解压失败；可改为逐张上传 PNG/JPG 文件')}}if(bytes.length!==usize)throw Error('ZIP 条目大小不符：'+name);if(seen.has(name))throw Error('ZIP 文件重名：'+name);seen.set(name,bytes)}return seen}
function wfPanelIndex(name){let leaf=name.replace(/\\/g,'/').split('/').at(-1);const m=leaf.match(/^(?:panel[_-]?|frame[_-]?)?(0?[1-9])(?:[_-][^.]*)?\.(png|jpg|jpeg|webp)$/i);return m?Number(m[1])-1:-1}
async function wfImport(p,input){if(!wfGet(p).taskId)throw Error('请先生成平台制作任务，再导入与任务对应的作品');const incoming=[...input.files];if(incoming.length===1&&/\.zip$/i.test(incoming[0].name)&&window.WT3Import?.importZip){await window.WT3Import.importZip(incoming[0]);return;}if(!incoming.length)return;let files=new Map();if(incoming.length===1&&/\.zip$/i.test(incoming[0].name)){files=await wfUnzip(incoming[0])}else{for(const f of incoming){if(f.size>22*1024*1024)throw Error('单个文件超过 22MB：'+f.name);if(files.has(f.name))throw Error('文件名重复：'+f.name);files.set(f.name,new Uint8Array(await f.arrayBuffer()))}}const imgs=Array(9).fill(null);let cover=null,pdf=null,meta=null;for(const [name,bytes] of files){const leaf=name.replace(/\\/g,'/').split('/').at(-1);if(/^delivery\.json$/i.test(leaf)){meta=JSON.parse(dec.decode(bytes));continue}if(/^comic\.pdf$/i.test(leaf)){if(bytes.length>22*1024*1024||dec.decode(bytes.slice(0,4))!=='%PDF')throw Error('PDF 无效或超出 22MB');pdf=new Blob([bytes],{type:'application/pdf'});continue}if(/^cover\.(png|jpg|jpeg|webp)$/i.test(leaf)){cover=wfImageFile(leaf,bytes);continue}const k=wfPanelIndex(name);if(k>=0){if(imgs[k])throw Error('出现重复漫画页：第'+(k+1)+'格');imgs[k]=wfImageFile(leaf,bytes)}}if(imgs.some(x=>!x))throw Error('九张独立漫画图片不完整：缺少 '+imgs.map((x,i)=>x?'':String(i+1).padStart(2,'0')).filter(Boolean).join('、'));if(!cover)throw Error('缺少独立封面 cover.png/JPG/WebP');if(meta){if(meta.task_id&&meta.task_id!==p.handoff.taskId)throw Error('交付包任务编号与当前作品不一致');if(meta.panel_count!=null&&Number(meta.panel_count)!==9)throw Error('交付包的画格数量说明不是 9');if(meta.title&&meta.title!==p.title)throw Error('交付包标题与当前作品不一致')}let ids=[];try{for(let i=0;i<9;i++){const k=uid();await putMedia(k,imgs[i]);ids.push(k)}const ckey=uid();await putMedia(ckey,cover);ids.push(ckey);let pdfkey='';if(pdf){pdfkey=uid();await putMedia(pdfkey,pdf);ids.push(pdfkey)}p.panels.forEach((x,i)=>{x.image='media:'+ids[i]});p.cover='media:'+ckey;p.handoff={...p.handoff,phase:'delivered',deliveryAt:now(),deliveryManifest:meta||null,pdf:pdfkey?'media:'+pdfkey:null,receipt:null};p.status='草稿';p.reviewedAt=null;p.checks=Array(6).fill(false);setChange(p,'接收 ChatGPT 九格漫画及封面，待人工复核');render();notify('九张漫画及封面导入成功；请人工复核后移交')}catch(err){for(const id of ids)await delMedia(id).catch(()=>{});throw err}}
async function wfWorkBuddy(p){if(!p.handoff?.taskId)throw Error('尚未建立任务编号');if(p.panels.filter(x=>x.image).length!==p.panels.length||!p.cover)throw Error('必须具备所有独立漫画画格和独立封面');if(!['已审核','已发布'].includes(p.status)||canApprove(p).length)throw Error('请先在创作工作台完成全部 6 项人工核查并审核通过：'+canApprove(p).join('、'));const entries=[];for(let i=0;i<p.panels.length;i++){let blob=await getImageBlob(p.panels[i].image);entries.push({name:'panels/'+String(i+1).padStart(2,'0')+'.'+contentExt(blob),bytes:await blobBytes(blob)})}let cover=await getImageBlob(p.cover);entries.push({name:'cover.'+contentExt(cover),bytes:await blobBytes(cover)});if(p.handoff.pdf){let pdf=await getMedia(p.handoff.pdf.slice(6));if(pdf)entries.push({name:'comic.pdf',bytes:await blobBytes(pdf)})}const caption=`《${p.title}》\n${p.subtitle||p.description||''}\n\n${p.disclosure}\n\nWORLD/TOON · By DAVYLAB`;const manifest={schema:'davylab.worldtoon.workbuddy.v1',task_id:p.handoff.taskId,from:'ChatGPT delivery reviewed by creator',to:'WorkBuddy',channel:'微信公众号',post_type:'贴图',title:p.title,images:entries.filter(x=>x.name.startsWith('panels/')).map(x=>x.name),cover:entries.find(x=>x.name.startsWith('cover.'))?.name,caption:'weixin-caption.txt',disclaimer:p.disclosure,source_urls:validSources(p),reviewed_at:p.reviewedAt,approved_for_publication:true,actual_published:false,require_receipt:true};entries.push({name:'workbuddy-publish.json',bytes:enc.encode(JSON.stringify(manifest,null,2))},{name:'weixin-caption.txt',bytes:enc.encode(caption)},{name:'source-ledger.json',bytes:enc.encode(JSON.stringify({sourceURLs:validSources(p),factNotes:p.factNotes,fiction:p.fiction},null,2))},{name:'WORKBUDDY执行说明.md',bytes:enc.encode(`# WORLD/TOON 公众号贴图发布工单\n\n任务：${p.handoff.taskId}\n作品：《${p.title}》\n\n请按 01–09 顺序上传九张漫画，使用 cover 文件作为封面，使用 weixin-caption.txt 为文案基础。\n确认原创虚构免责声明可见；按授权排期完成微信公众号贴图发表，遵守平台规范和素材使用权。\n请在实际发布完成后回传文章 URL、发表时间和成功证据；仅上传或保存草稿不算已发表。\n不得在没有审校批准或图片缺失的情况下直接发布。\n`) });saveFile(packZip(entries),'WORLD_TOON_WorkBuddy发表包_'+safeName(p.title)+'.zip');p.handoff={...p.handoff,phase:'workbuddy_ready',packageAt:now()};setChange(p,'导出 WorkBuddy 已审校发表包（尚未移交）');render();notify('WorkBuddy 发表包已下载；请实际移交给 WorkBuddy')}
async function wfClick(ev){const b=ev.target.closest('[data-wf]');if(!b||wfBusy)return;ev.preventDefault();ev.stopPropagation();const p=selected();if(!p){notify('请先选择作品');return}wfBusy=true;try{switch(b.dataset.wf){case'task':await wfMakeTask(p);if(p.handoff?.repoQueuedAt&&['workspace','production'].includes(ui.route))nav('workspace/'+p.id+'/4');break;case'copy':await wfCopyPrompt(p);break;case'publishpack':await wfWorkBuddy(p);break;case'mark-sent':if(wfPhase(p)!=='workbuddy_ready')throw Error('请先导出已审校的 WorkBuddy 发表包');if(!confirm('确认你已经把 ZIP 文件实际交给 WorkBuddy？'))break;p.handoff.phase='workbuddy_processing';p.handoff.sentAt=now();setChange(p,'人工确认已移交 WorkBuddy');render();break;case'receipt':{let raw=document.querySelector('#wfReceipt')?.value?.trim()||'',u;try{u=new URL(raw)}catch{throw Error('请填写实际发表的微信公众号文章链接')}if(u.protocol!=='https:'||u.hostname!=='mp.weixin.qq.com'||!/^\/s(?:\/|$)/.test(u.pathname))throw Error('需要微信公众号正式文章链接（mp.weixin.qq.com/s/...）');if(!['workbuddy_ready','workbuddy_processing','publish_reported'].includes(wfPhase(p)))throw Error('请先生成 WorkBuddy 发表包');p.handoff.receipt=u.href;p.handoff.receiptAt=now();p.handoff.phase='publish_reported';setChange(p,'人工录入公众号发表回执（尚未自动核验）');render();notify('已记录链接；仍需到公众号后台核验实际发表');break}}}catch(err){notify(err.message||String(err))}finally{wfBusy=false}}
function wfChange(ev){const x=ev.target,p=selected();if(x.dataset.wfEditor){const key=x.dataset.wfEditor;if(p&&['sourceURLs','factNotes','fiction'].includes(key)&&!p.handoff?.repoQueuedAt){p[key]=x.value;setChange(p,'更新制作任务资料');render()}else notify('任务已正式入仓，请创建修订版本，不可直接覆盖来源');return}if(x.id==='wfProject'){ui.selected=x.value;render();return}if(!p)return;if(x.id==='wfMode'){if(wfLiteraryReview(p)){notify('当前已按三维文学导读模式锁定，不可误切到热点剧情改编');render();return}if(p.handoff?.taskId&&wfPhase(p)!=='not_started'){notify('任务已建立：要更改类型请建立新作品，避免任务与交付不一致');render();return}p.handoff={...p.handoff,mode:x.value};setChange(p,'修改作品类型');render();return}if(x.id==='wfUpload'){wfImport(p,x).catch(err=>notify('交付包导入失败：'+err.message));}}
// Layout styles are now provided by styles.css (CSP safe).
document.addEventListener('click',wfClick);
document.addEventListener('change',wfChange);

// Explicitly expose route and schedule a post-initialization render.
window.wtWorkflow=wtWorkflow;
queueMicrotask(()=>{if(location.hash.startsWith('#/handoff'))parseRoute()});

/* DAVYLAB WORLD/TOON | v1.0 | Local-first creative studio. No hidden server uploads. */
'use strict';
const APP_KEY='davylab-comic-press-v1', DB_NAME='davylab-comic-media-v1', LEGACY_KEY='davylab_worldtoon_v01';
const assetNames=['01_甜蜜暗流.png','02_执法突袭.png','03_寻找靠山.png','04_选举失势.png','05_公开恋情.png','06_发布会.png','07_茶话风云.png','08_撕碎人设.png','09_最后的选择.png'];
const stages=['立项与来源','虚构改编','剧本与分镜','导入漫画成品','编辑审校'];
const checksText=['已区分可核验事实、观点、传闻与虚构','真实事件已核查原始来源；原创作品无需伪造新闻','改编不会通过独特细节对号入座真实自然人','没有将未经证实的违法、婚恋或交易指控写成事实','图片素材有合法使用权，人物形象和台词已复核','漫画明确标注虚构改编，完成逐格人工审校'];
const now=()=>new Date().toISOString();
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'cp-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml, safeURL=(u)=>{try{let v=new URL(u);return ['https:','http:'].includes(v.protocol)?v.href:''}catch{return ''}};
const humanDate=s=>s?new Date(s).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}):'—';
const safeName=s=>(s||'comic').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70);
const CATS=['国际政治','文化','娱乐','体育','人物','旅行','AI 科技','机器人','商业财经','科学','环境','健康','航空航天','其他'];
const prompts=[
['甜蜜暗流','芯片霸总与神秘女友亲密相拥。远方鹰与兔代表两方势力对峙。','霸总爱情甜如蜜，鹰兔博弈暗流急。',''],
['执法突袭','虚构执法人员闯入，女友被带走，霸总震惊。','风暴来得比新闻推送还快。','执法人员：你涉嫌间谍罪！'],
['秘密游说','霸总深夜拜访政客，办公室里光影交错。','面对困局，他试着寻找权力靠山。','霸总：只要选举顺利，这件事能办吧？'],
['选举失势','电视屏幕出现虚构选举结果，政客神色低沉。','选举翻车，靠山塌了。',''],
['破釜沉舟','霸总拍桌，桌上的棋子翻倒。','最后一张牌，居然是爱情。','霸总：公开我们的关系！'],
['公开恋情','新闻发布会，闪光灯下两人站在一起。','是爱情，也是舆论风暴。','霸总：是的，我们相爱。'],
['圈内茶话','虚构商业精英在茶室低声议论，窗外鹰兔棋盘悬浮。','在资本叙事里，爱情从来不只是爱情。',''],
['撕碎人设','霸总撕掉写有“爱妻人设”的纸张。','当人设碎裂，真相也未必浮现。','霸总：这一次，我自己选。'],
['最后一幕','夕阳下两人走向飞机，画面留白。','这场小爱情，是一则关于权力、资本与叙事的虚构寓言。','']
];
function makePanel(i,seed=false){let p=prompts[i];return {id:uid(),title:seed?p[0]:`第 ${i+1} 格`,scene:seed?p[1]:'',caption:seed?p[2]:'',dialogue:seed?p[3]:'',prompt:'',image:seed?`assets/${assetNames[i]}`:''}}
function sampleProject(){let t=now();return {id:'sample-ba-zong-001',title:'霸总的小爱情',subtitle:'爱情与权力的九格寓言',description:'虚构的芯片霸总与神秘女友，卷入由舆论、政治与商业交织而成的风暴。',category:'商业财经',tone:'黑色幽默',format:'九格短篇',status:'示例',archived:false,deleted:false,createdAt:t,updatedAt:t,sourceTitle:'跨国科技与政治风波（虚构主题）',sourceURLs:'',eventDate:'',factNotes:'这是原创虚构演示故事，不代表对某一真实案件的核验或报道。',fiction:'人物、国家符号、人物间交易、关系及情节均为虚构；避免推断到真实个人。',characters:'芯片霸总／神秘女友／虚构政客／虚构执法人员／鹰兔象征',disclosure:'本故事纯属虚构，不应据此推断任何现实人物违法、私人关系或政治交易。',panels:prompts.map((_,i)=>makePanel(i,true)),checks:Array(6).fill(false),activity:[{at:t,detail:'内置示例作品已建立'}],reviewedAt:null,publishedAt:null,cover:'assets/cover.png'};}
function emptyProject(topic){let t=now();let p={id:uid(),topicId:topic?.id||'',title:topic?.title?`${topic.title}：漫画改编`:'未命名新作',subtitle:'',description:topic?.summary||'',category:topic?.category||'AI 科技',tone:'黑色幽默',format:'九格短篇',status:'草稿',archived:false,deleted:false,createdAt:t,updatedAt:t,sourceTitle:topic?.title||'',sourceURLs:topic?.source||'',eventDate:topic?.eventDate||'',eventDateBasis:topic?.eventDateBasis||'',newsPublishedAt:topic?.publishedAt||'',factNotes:'',fiction:'',characters:'',disclosure:'本作品是基于公共议题创作的虚构漫画，不构成对真实人物的指控。',panels:Array.from({length:9},(_,i)=>makePanel(i)),checks:Array(6).fill(false),activity:[{at:t,detail:'创建草稿'}],reviewedAt:null,publishedAt:null,cover:''};
 if(topic?.category==='诺奖文学'||topic?.sourceId==='nobel_literature'){
  if(!['licensed_adaptation','public_domain_verified_region'].includes(topic?.rightsStatus)){
   p.category='诺奖文学导读';
   p.title='读懂｜'+String(topic.title||'待核验文学作品')+'：故事·哲学·人生';
   p.handoff={mode:'hotspot'};
   p.storySourceSelection={source_id:topic.sourceId||'nobel_literature',title:topic.title||'',source:topic.source||'',type:'nobel_literature',
    rights:topic.rightsStatus||'unknown',adaptation:'literary_review',license_attested:false,selected_beats:[],
    requires_independent_author_review:true,bibliography_verified:false,
    review_dimensions:['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers']};
   p.literaryReviewGuide={schema:'davylab.worldtoon.literary-review.v1',
    source_title:topic.title||'',source_url:topic.source||'',source_status:'pending_research',
    dimensions:['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers'],
    panel_ranges:[[1,3],[4,6],[7,9]],protect_original_expression:true};
   p.description='针对已核实的作品进行原创文学导读：01–03格简要介绍作品讲了什么；04–06格独立解释其人生哲学；07–09格通过原创当代生活场景解释对普通人的意义。不得逐幕复刻原著情节、照搬人物形象或对白；先核实作者与诺奖关系。';
   p.fiction='文学评论和原创读者视角，不是小说剧情改编；文学事实须有可靠来源，哲学观点属于编辑解读。';
   p.disclosure='原创文学导读与评论漫画，非原著漫画改编；未取得授权不复刻原著具体场景、插画、台词或大量文字。';
  }
 }
 return p}
const sampleTopic={id:'sample-topic-001',title:'科技产业与国际政治的戏剧性碰撞',category:'商业财经',summary:'仅用于展示选题结构；不是实时新闻，也未完成事实核验。',source:'',heat:3,impact:4,story:5,stage:'待核验',isSample:true,createdAt:now()};
const initial=()=>({version:3,projects:[sampleProject()],topics:[sampleTopic],characters:[],settings:{brand:'By DAVYLAB',color:'#df624a'},logs:[]});
let legacyImport=false;
function importLegacyMetadata(){
 try{
  const old=JSON.parse(localStorage.getItem(LEGACY_KEY)||'null');
  if(!Array.isArray(old)||!old.length)return null;
  const imported=old.filter(x=>x&&typeof x==='object').map((o,index)=>{
   let p=emptyProject();p.id=`legacy-${String(o.id||index).replace(/[^a-zA-Z0-9_-]/g,'-')}`;
   p.title=String(o.title||`旧版作品 ${index+1}`);p.subtitle='从 WORLD/TOON V0.1 导入';p.description=String(o.notes||'');p.category='国际政治';p.tone=String(o.style||'黑色幽默');p.status=['已发布','已审核','待审核'].includes(o.stage)?o.stage:'草稿';p.sourceTitle=p.title;p.sourceURLs=String(o.source||'');p.factNotes=String(o.notes||'');p.fiction='旧版导入：请补充独立人物世界观与脱敏策略。';p.disclosure='原创虚构漫画，不代表真实事件报道。请完成来源、内容与授权审查后再发布。';p.panels=Array.from({length:9},(_,i)=>{let a=o.panels?.[i]||{};return {...makePanel(i),scene:String(a.scene||''),dialogue:String(a.dialogue||''),image:String(a.image||'')}});p.checks=Array(6).fill(false);p.reviewedAt=null;p.publishedAt=null;if(p.status!=='草稿')p.status='待审核';p.activity=[{at:now(),detail:'从 WORLD/TOON V0.1 导入草稿，待重新复核'}];return p;
  });
  return {...initial(),projects:imported};
 }catch{return null}
}
let data;try{let raw=JSON.parse(localStorage.getItem(APP_KEY)||'null');if(raw&&Array.isArray(raw.projects)&&Array.isArray(raw.topics))data=raw;else {data=importLegacyMetadata()||initial();legacyImport=!!data.projects.some(x=>x.id?.startsWith('legacy-'))}}catch{data=initial()}

data.characters=data.characters||[];
let ui={route:'dashboard',selected:data.projects[0]?.id||'sample-ba-zong-001',stage:0,panel:0,filter:'全部',topicFilter:'全部',search:'',reader:0,rev:0};
function persist(){try{localStorage.setItem(APP_KEY,JSON.stringify(data));if(typeof wtScheduleSync==='function')wtScheduleSync();return true}catch(err){notify('保存失败：本机存储空间可能不足，请先导出备份');return false}}
function setChange(p,desc){p.updatedAt=now();if(desc){p.activity=p.activity||[];p.activity.unshift({at:now(),detail:desc});p.activity=p.activity.slice(0,60)}persist()}
function markDirty(p){if(p.status==='已审核'||p.status==='已发布'){p.status='草稿';p.checks=Array(6).fill(false);p.reviewedAt=null;p.publishedAt=null;}setChange(p)}
const activeProjects=()=>data.projects.filter(p=>!p.deleted&&!p.archived);
// A cleanup operation only applies to unproduced, local-only drafts.
// A story outline or locked creative direction is not an image or publication deliverable.
function wtUnmadeBlockers(p){
 const h=p?.handoff||{},c=p?.creativeDirection||{},pilot=c.pilot||{},approval=c.pilotApproval||{};
 const blockers=[];
 if(!p||!p.id||p.id==='sample-ba-zong-001'||p.deleted)blockers.push('不存在可清理的未制作草稿');
 if(!['草稿','待制作','创作中'].includes(p?.status))blockers.push('作品已进入审核、发布或其他保护状态');
 if(p?.reviewedAt||p?.publishedAt||p?.checks?.some(Boolean))blockers.push('作品已有审核或出版记录');
 if(p?.cover||(p?.panels||[]).some(a=>!!a?.image))blockers.push('作品已包含漫画画格或封面');
 if(pilot.characterImage||pilot.panelImage||pilot.characterSha256||pilot.panelSha256||
  approval.local_approved||approval.repo_commit||c.pilotReviewed)blockers.push('作品已有真实定妆或样稿，不能按未制作草稿清理');
 if(h.taskId||h.repoTaskId||h.repoQueuedAt||h.repoCommit||h.repoTaskPath||h.directTaskExportedAt||
  h.importedAt||h.stagedFiles?.length||h.stageUploaded?.length||h.readyForWorkbuddy||
  (h.phase&&!['not_started'].includes(h.phase)))blockers.push('作品已导出任务、交接或上传，需保留执行与验收记录');
 return blockers;
}
function wtCanDeleteUnmade(p){return wtUnmadeBlockers(p).length===0;}
function wtCollectMediaRefs(value,out=new Set(),depth=0){
 if(depth>24||!value)return out;
 if(typeof value==='string'){if(value.startsWith('media:')&&value.length>6&&value.length<300)out.add(value.slice(6));return out;}
 if(typeof value!=='object')return out;
 if(Array.isArray(value)){for(const item of value)wtCollectMediaRefs(item,out,depth+1);return out;}
 for(const v of Object.values(value))wtCollectMediaRefs(v,out,depth+1);
 return out;
}
async function wtDeleteUnmadeProjects(ids,{deleteLinkedTopics=false}={}){
 const unique=[...new Set((ids||[]).map(String))];
 if(!unique.length)throw Error('请先选择需要清理的草稿');
 const targets=unique.map(id=>findProject(id));
 const invalid=targets.filter(p=>!wtCanDeleteUnmade(p));
 if(invalid.length)throw Error('存在不可删除的作品：'+invalid.map(p=>(p?.title||'未知作品')+'（'+wtUnmadeBlockers(p).join('；')+'）').join('、'));
 const titles=targets.map(p=>p.title).slice(0,4).join('、');
 const extra=unique.length>4?' 等 '+unique.length+' 部':'';
 if(!confirm('确定永久删除 '+unique.length+' 部未制作漫画草稿（'+titles+extra+'）？'+
   (deleteLinkedTopics?'同时清理仅关联这些草稿的原选题。':'原始选题默认保留。')+
   '\n此操作不可从回收站恢复，正式作品与云端工单不受影响。'))return {cancelled:true};
 const removedIds=new Set(unique),originalProjects=data.projects,originalTopics=data.topics;
 const kept=originalProjects.filter(p=>!removedIds.has(String(p.id)));
 const missingTopics=new Set(targets.map(p=>p.topicId).filter(Boolean));
 const preservedTopics=deleteLinkedTopics?originalTopics.filter(t=>!missingTopics.has(t.id)||
  kept.some(p=>p.topicId===t.id)):originalTopics;
 const deletedMedia=wtCollectMediaRefs(targets),retainedMedia=wtCollectMediaRefs({
  projects:kept,characters:data.characters,topics:preservedTopics
 });
 const unreferenced=[...deletedMedia].filter(key=>!retainedMedia.has(key));
 const priorSelected=ui.selected,priorLast=ui.wt4LastId;
 data.projects=kept;data.topics=preservedTopics;
 if(removedIds.has(String(ui.selected)))ui.selected=activeProjects()[0]?.id||'';
 if(removedIds.has(String(ui.wt4LastId||'')))ui.wt4LastId='';
 if(!persist()){
  data.projects=originalProjects;data.topics=originalTopics;
  ui.selected=priorSelected;ui.wt4LastId=priorLast;
  throw Error('本地工作区未能保存，已取消清理，尚未删除图片');
 }
 let freed=0,failed=0;
 for(const key of unreferenced){
  try{
   await delMedia(key);
   const url=objectURLs.get('media:'+key);
   if(url){URL.revokeObjectURL(url);objectURLs.delete('media:'+key)}
   freed++;
  }catch{failed++}
 }
 closeModal();nav('library');
 notify('已删除 '+targets.length+' 部未制作草稿'+
  (freed?'，释放 '+freed+' 份不再使用的本地素材':'')+
  (failed?'；'+failed+' 份本地媒体缓存清理失败，稍后可重试':'')+
  (typeof wtSession!=='undefined'&&wtSession?.access_token?'；云端工作区待同步':''));
 return {removed:targets.length,freed,failed,topicsRemoved:originalTopics.length-preservedTopics.length};
}
function wtUnmadeCleanupDialog(){
 const list=data.projects.filter(wtCanDeleteUnmade);
 if(!list.length){notify('目前没有可清理的未制作草稿');return}
 modal('<div class="kicker">WORLD/TOON · DRAFT CLEANUP</div><h2>清理未制作漫画</h2>'+
  '<p class="minor">仅列出未生成正式图片、未提交任务、未审核发表的本地草稿。默认不勾选、不删除原选题；已发布或制作中的作品不可在这里删除。</p>'+
  '<form id="wtUnmadeCleanupForm"><div class="wt-cleanup-list">'+
  list.map(p=>'<label class="wt-cleanup-item"><input type="checkbox" name="projectId" value="'+e(p.id)+'"><span><strong>'+e(p.title)+'</strong><small>'+e(p.category)+' · 未制作草稿</small></span></label>').join('')+
  '</div><label class="wt-cleanup-option"><input type="checkbox" name="deleteLinkedTopics" value="yes">一并删除没有其他作品关联的原选题</label>'+
  '<p class="minor">提交后仍会再次确认。删除会释放不再被其他作品使用的本地媒体缓存；不会自动删除 GitHub 或远端云存储图片。</p>'+
  '<div class="stepactions"><button type="button" class="button" data-action="modal-close">取消</button>'+
  '<button type="submit" class="button danger">永久删除选中的未制作草稿</button></div></form>');
}
function findProject(id){return data.projects.find(p=>p.id===id)}
function selected(){return findProject(ui.selected)||activeProjects()[0]||null}
const wtNavigationHandledHashes=new Set();
function nav(route){
 const target='#/'+route;
 if(location.hash!==target)wtNavigationHandledHashes.add(target);
 location.hash=target;
 parseRoute(); // Navigation updates immediately; matching hashchange must not rerender/close the freshly reopened mobile sidebar.
}
function parseRoute(){let bits=(location.hash||'#/dashboard').replace(/^#\/?/,'').split('/').filter(Boolean);ui.route=['dashboard','workspace','production','radar','live','ai-briefing','characters','account','library','studio','publish','settings','reader','handoff','archive','director'].includes(bits[0])?bits[0]:'dashboard';if(bits[1]&&findProject(bits[1]))ui.selected=bits[1];if(ui.route==='workspace')ui.wt4Step=bits.length>2&&/^[0-6]$/.test(bits[2])?Number(bits[2]):-1;if(ui.route==='reader'&&bits[2])ui.reader=Math.max(0,Math.min((selected()?.panels?.length||9)-1,Number(bits[2])-1||0));if(ui.route==='studio'&&bits[2])ui.stage=Math.max(0,Math.min(4,Number(bits[2])||0));render();document.querySelector('.rail')?.classList.remove('is-open')}
function link(route,id){return '#/'+route+(id?'/'+encodeURIComponent(id):'')}
function notify(msg){const x=document.querySelector('#toast');x.textContent=msg;x.classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>x.classList.remove('visible'),3200)}
function statusChip(s){let color=s==='已发布'?'green':s==='待审核'?'yellow':s==='示例'?'dark':s==='已审核'?'green':'coral';return `<span class="pill ${color}">${e(s)}</span>`}
function heroHeader(k,title,lead,actions=''){return `<section class="pagehead"><div class="kicker">${k}</div><h1>${title}</h1><p class="lead">${lead}</p>${actions?`<div class="buttons" style="margin-top:20px">${actions}</div>`:''}</section>`}
function actionButton(label,act,arg='',kind=''){return `<button class="button ${kind}" data-action="${e(act)}" data-id="${e(arg)}">${label}</button>`}
function projectCard(p){let img=p.cover||p.panels?.find(x=>x.image)?.image||'';let thumb=img?`<img src="${e(img)}" alt="${e(p.title)}封面" loading="lazy">`:`<div class="placeholder-art">CP <span style="font-size:22px;margin-left:8px">${e(p.panels?.length||9)}</span></div>`;return `<article class="storycard"><a href="${link('reader',p.id)}" aria-label="阅读${e(p.title)}">${thumb}</a><div class="cardbody"><div class="buttons">${statusChip(p.status)} <span class="chip">${e(p.category)}</span></div><h3>${e(p.title)}</h3><p>${e(p.description||p.subtitle||'一部正在创作中的原创短篇。')}</p><div class="cardfoot"><span>${humanDate(p.updatedAt)} 更新 · ${p.panels?.length||9} 格</span><a href="${link('studio',p.id)}"><b>进入编辑 →</b></a></div></div></article>`}
function dashboard(){let ps=activeProjects(),pub=typeof wtArchiveSnapshot!=='undefined'&&wtArchiveSnapshot?.library?wtArchiveSnapshot.library.items.filter(x=>x.status==='published').length:0,works=ps.filter(p=>p.status!=='已发布').length;let cards=ps.slice(0,2).map(projectCard).join('');return `<div class="hero"><div><div class="kicker">THE INDEPENDENT COMIC JOURNAL / VOL.001</div><h1>世界每日上演。<br><span>我们画下来。</span></h1><p class="lead" style="font-size:15px">你的双轨 AI 漫画编辑部。A 轨预留自定义模型；B 轨以平台派单、ChatGPT 制作、GitHub 验收、WorkBuddy 发表为核心，正式作品依据真实回执进入书架。</p><div class="buttons" style="margin-top:27px"><button class="button dark" data-action="new">＋ 开始一部新漫画</button><a href="#/library" class="button">进入漫画书架 ↗</a><a href="#/handoff" class="button">制作交接中心 ↗</a><a href="#/ai-briefing" class="button">阅读 AI 简报 ↗</a></div><div class="hero-meta"><div><b>${String(ps.length).padStart(2,'0')}</b><span>我的作品</span></div><div><b>${String(data.topics.length).padStart(2,'0')}</b><span>选题素材</span></div><div><b>${String(pub).padStart(2,'0')}</b><span>仓库核验发表</span></div></div></div><div class="hero-art"><img src="assets/cover.png" alt="《霸总的小爱情》示例漫画封面"><span class="corner">ISSUE 001 · FICTION</span></div></div><div class="sectionbar"><h2>编辑部概况 / THE DESK</h2><p>所有改动优先存于此浏览器</p></div><div class="metrics"><div class="metric"><span>活跃作品 <i>↗</i></span><strong>${ps.length}</strong><span>包含草稿和示例作品</span></div><div class="metric"><span>待完成作品 <i>↗</i></span><strong>${works}</strong><span>仍需创作与复核</span></div><div class="metric"><span>选题池 <i>↗</i></span><strong>${data.topics.length}</strong><span>手动记录的公开议题</span></div><div class="metric"><span>待审核 <i>↗</i></span><strong>${ps.filter(p=>p.status==='待审核').length}</strong><span>审核后生成 WorkBuddy 交付包，发表状态以仓库回执为准</span></div></div><div class="sectionbar"><h2>最新作品 / RECENT ISSUES</h2><p><a href="#/library">查看全部 →</a></p></div><div class="cards3">${cards}<a class="blankcard" href="#/studio"><div class="plus">＋</div><h3>下个封面故事</h3><p>添加热点，搭建人物世界观与九格分镜，创作下一期。</p></a></div><div class="sectionbar"><h2>创作流程 / THE PIPELINE</h2></div><div class="statusflow"><div class="active">01 / 新闻选题</div><div class="active">02 / 脱敏改编</div><div class="active">03 / 剧本分镜</div><div class="active">04 / 视觉制作</div><div class="active">05 / 审核出版</div></div><div class="notice" style="margin-top:20px"><strong>重要说明：</strong>当前版本是<strong>本地优先</strong>创作与出版工具。现已支持新闻线索检索与原创角色设定；自动事实核验和模型生图尚未启用。</div>`}
function radar(){let arr=data.topics.filter(t=>ui.topicFilter==='全部'||t.stage===ui.topicFilter);arr.sort((a,b)=>topicScore(b)-topicScore(a));return `${heroHeader('02 / THE RADAR','热点素材库','不是热搜搬运，而是把值得改编的议题沉淀为可追溯选题。热度、影响和故事价值由你评分。',`<button class="button dark" data-action="topic-new">＋ 收录热点</button><a class="button" href="#/ai-briefing">阅读 DAVYLAB AI 简报 ↗</a>`)}<div class="notice" style="margin-top:28px">本区不会自动采集实时新闻，也不会自动证明来源真实。示例题材明确标识，发布前需要作者核验新闻原始出处和发布日期。</div><div class="toolbar"><div class="tabbar">${['全部','待核验','已核验','已转漫画'].map(x=>`<button data-action="topic-filter" data-id="${x}" class="${ui.topicFilter===x?'active':''}">${x}</button>`).join('')}</div><span class="minor">共 ${arr.length} 个选题</span></div>${arr.length?`<div class="cards2">${arr.map(t=>`<article class="box"><div class="buttons">${t.isSample?'<span class="pill dark">演示</span>':''}<span class="pill ${t.stage==='已核验'?'green':'yellow'}">${e(t.stage)}</span><span class="chip">${e(t.category)}</span></div><h3 style="margin:14px 0;font-size:21px">${e(t.title)}</h3><p class="minor">${e(t.summary||'暂无摘要')}</p><p class="minor">事件日期：${e(t.eventDate||'待确认')}${t.eventDateBasis==='published_candidate'?' · 新闻发布日期候选，待核验':t.eventDateBasis==='source_event'?' · 新闻来源提供，待核验':''}</p><div class="buttons" style="margin:16px 0"><span class="chip">热度 ${e(t.heat)}/5</span><span class="chip">影响 ${e(t.impact)}/5</span><span class="chip">可画性 ${e(t.story)}/5</span><span class="pill dark">综合 ${topicScore(t)} / 100</span></div>${safeURL(t.source)?`<p><a href="${e(safeURL(t.source))}" target="_blank" rel="noopener noreferrer" class="reader-label">来源链接 ↗</a></p>`:''}<div class="buttons">${actionButton('改编成漫画','topic-to-project',t.id,'dark')}${actionButton('编辑','topic-edit',t.id)}${actionButton('删除','topic-delete',t.id,'danger')}</div></article>`).join('')}</div>`:`<div class="empty"><span class="icon">◎</span><b>暂无选题</b>从你关注的科技、国际与商业新闻开始记录。</div>`}`}
function topicScore(t){return Math.round((Number(t.heat||0)*.30+Number(t.impact||0)*.35+Number(t.story||0)*.35)*20)}
function library(){const unmadeCount=data.projects.filter(wtCanDeleteUnmade).length;let ps=data.projects.filter(p=>ui.filter==='回收站'?p.deleted:!p.deleted&&(ui.filter==='全部'?true:ui.filter==='已归档'?p.archived:ui.filter==='草稿'?p.status==='草稿':p.status===ui.filter));let q=ui.search.toLowerCase().trim();if(q)ps=ps.filter(p=>[p.title,p.category,p.description].join(' ').toLowerCase().includes(q));ps.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));return `${heroHeader('03 / THE ARCHIVE','我的漫画书架','从第一部到第一百部，每篇漫画都拥有自己的素材、剧本、画面、审核和导出记录。',`<button class="button dark" data-action="new">＋ 新建作品</button>${unmadeCount?'<button class="button" data-action="clean-unmade">清理未制作草稿 ('+unmadeCount+')</button>':''}`)}<div class="toolbar"><div class="tabbar">${['全部','草稿','示例','待审核','已审核','已发布','已归档','回收站'].map(x=>`<button data-action="library-filter" data-id="${x}" class="${ui.filter===x?'active':''}">${x}</button>`).join('')}</div><input class="search" id="librarySearch" placeholder="搜索作品名称或分类" value="${e(ui.search)}" aria-label="搜索漫画作品"></div>${ps.length?`<div class="cards3">${ps.map(p=>`<div>${projectCard(p)}<div class="buttons" style="padding:9px 0 18px">${p.deleted?actionButton('恢复作品','restore',p.id,'dark'):actionButton('复制','duplicate',p.id)}${p.deleted?actionButton('彻底删除','purge',p.id,'danger'):actionButton(p.archived?'解除归档':'归档','archive',p.id)}${!p.deleted&&wtCanDeleteUnmade(p)?actionButton('删除未制作','delete-unmade',p.id,'danger'):''}${!p.deleted?actionButton('移入回收站','trash',p.id,'danger'):''}</div></div>`).join('')}</div>`:`<div class="empty"><b>没有符合条件的作品</b>试试其它分类，或创建一部新漫画。</div>`}`}
function studio(){let p=selected();if(!p){return `${heroHeader('04 / CREATOR STUDIO','开始创作','先创建一部漫画，进入完整五阶段编辑流程。',`<button class="button dark" data-action="new">＋ 新建作品</button>`)}`}return `${heroHeader('04 / CREATOR STUDIO','漫画创作工作台',`正在编辑：${e(p.title)} · 所有修改自动保存到此设备。`,`<a class="button" href="#/director/${e(p.id)}">创意导演台 ↗</a><a class="button" href="${link('reader',p.id)}">预览漫画 ↗</a>${actionButton('生成 AI 创作指令','prompt',p.id)}`)}<div class="editor-header" style="margin-top:22px"><div><h2>${e(p.title)}</h2><span class="minor">最后修改：${humanDate(p.updatedAt)} · ${e(p.tone)}</span></div>${statusChip(p.status)}</div><div class="stagebar">${stages.map((x,i)=>`<button data-action="studio-stage" data-id="${i}" class="${ui.stage===i?'active':''}"><strong>0${i+1}</strong>${x}</button>`).join('')}</div><div id="editorContent">${studioStage(p)}</div><div class="stepactions"><button class="button" data-action="stage-prev" ${ui.stage===0?'disabled':''}>← 上一步</button><div class="buttons">${actionButton('备份此作品','export-project',p.id)}<button class="button dark" data-action="stage-next" ${ui.stage===4?'disabled':''}>下一步 →</button></div></div>`}
function field(label,key,p,kind='input',placeholder=''){let value=e(p[key]||'');return `<div class="field ${kind==='textarea'?'wide':''}"><label for="f-${key}">${label}</label>${kind==='textarea'?`<textarea id="f-${key}" data-project-field="${key}" placeholder="${e(placeholder)}">${value}</textarea>`:`<input id="f-${key}" data-project-field="${key}" value="${value}" placeholder="${e(placeholder)}" ${kind==='date'?'type="date"':''}>`}</div>`}
function studioStage(p){if(ui.stage===0)return `<div class="work-grid"><section class="box"><div class="kicker">STEP 01 / SOURCE DESK</div><h2>故事从哪里来？</h2><p class="lead">追踪原文和时间，把“发生了什么”与“我们想怎样讲述”分开。</p><div class="fields">${field('漫画名称','title',p)}${field('副标题','subtitle',p)}<div class="field"><label>事件分类</label><select data-project-field="category">${CATS.map(c=>`<option ${c===p.category?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>现实事件发生日期</label><input type="date" data-project-field="eventDate" value="${e(p.eventDate||'')}"><small>${p.eventDateBasis==='published_candidate'?'新闻发布日期自动填入，实际事件日期尚需核验':p.eventDateBasis==='source_event'?'采集来源标记的事件日，尚需核实':''}</small></div>${field('漫画简介','description',p,'textarea','故事简介，不写未经证实的指控')}${field('现实议题名称','sourceTitle',p)}${field('可信原文链接（一行一个）','sourceURLs',p,'textarea','https://...\nhttps://...')}${field('事实核验与未知项记录','factNotes',p,'textarea','已核实事实 / 未确认之处 / 反方观点 / 日期')}</div></section><aside class="box"><h3>事实边界</h3><p class="minor">涉及现实人物的违法、隐私或情感指控时，不能只换个名字再继续影射。</p><div class="notice">至少记录一条可访问的新闻原文链接。本站<strong>不自动判断来源真伪</strong>，请人工复核。</div><a class="button" href="https://chenzhe223-tech.github.io/radar/daily/" target="_blank" rel="noopener noreferrer" style="margin-top:18px">打开 AI Radar ↗</a></aside></div>`;
if(ui.stage===1)return `<div class="work-grid"><section class="box"><div class="kicker">STEP 02 / STORY DEVELOPMENT</div><h2>把现实议题改造成好故事</h2><p class="lead">人物不是现实个人的换皮复制品。建立原创世界观、叙事角度和视觉规则。</p><div class="fields"><div class="field"><label>叙事风格</label><select data-project-field="tone">${['黑色幽默','轻喜剧','社会寓言','科幻讽刺','悬疑剧情','手绘纪实'].map(x=>`<option ${x===p.tone?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>作品形态</label><select data-project-field="format"><option>九格短篇</option><option ${p.format==='系列连载'?'selected':''}>系列连载</option></select></div>${field('虚构化改编策略','fiction',p,'textarea','时间、地点、人物身份与关联细节如何脱离真实指向？')}${field('人物设定 / 角色圣经','characters',p,'textarea','角色外貌、服装、标志动作、性格、出场关系，保证连贯性')}${field('公开展示的创作声明','disclosure',p,'textarea')}</div><div class="divider"></div><div class="buttons">${actionButton('生成九格剧情骨架（模板）','story-template',p.id,'dark')}${actionButton('复制 AI 剧本生成指令','prompt',p.id)}</div></section><aside class="box"><h3>视觉主编手记</h3><p class="minor">延续 DAVYLAB 杂志调性：克制、锐利、有戏剧张力；用跨页节奏而非堆积文字推动故事。</p><div class="notice">“自动分镜模板”是<strong>本地规则生成</strong>，并非真实 AI 接口生成，文字可继续修改。</div></aside></div>`;
if(ui.stage===2){return `<div class="box"><div class="kicker">STEP 03 / THE STORYBOARD</div><div class="editor-header"><div><h2>${p.panels.length}格分镜脚本</h2><p class="lead">每格包含场景、画面旁白和人物对白。修改后会重置此前的审核通过状态。</p></div><div class="buttons">${actionButton('填入示例结构','story-template',p.id)}${actionButton('导出图片提示词','prompt',p.id,'dark')}</div></div><div class="panel-selector" style="grid-template-columns:repeat(auto-fill,minmax(56px,1fr));margin-bottom:24px">${p.panels.map((a,i)=>`<button class="${ui.panel===i?'active':''}" data-action="select-panel" data-id="${i}">${a.image?`<img src="${e(a.image)}" alt="画格${i+1}" onerror="this.style.visibility='hidden'">`:'<div class="mini-placeholder"></div>'}<b>${String(i+1).padStart(2,'0')}</b></button>`).join('')}</div>${p.panels.map((a,i)=>`<div class="fields panel-script ${i===ui.panel?'':'hidden'}" data-edit-panel="${i}"><div class="field wide"><label>第 ${i+1} 格 · 标题</label><input data-panel-field="title" data-panel-index="${i}" value="${e(a.title)}"></div><div class="field wide"><label>画面描述 / 情绪 / 镜头</label><textarea data-panel-field="scene" data-panel-index="${i}">${e(a.scene)}</textarea></div><div class="field wide"><label>旁白</label><textarea data-panel-field="caption" data-panel-index="${i}">${e(a.caption)}</textarea></div><div class="field wide"><label>角色对白</label><textarea data-panel-field="dialogue" data-panel-index="${i}">${e(a.dialogue)}</textarea></div><div class="field wide"><label>画面生成 Prompt（选填）</label><textarea data-panel-field="prompt" data-panel-index="${i}">${e(a.prompt)}</textarea></div></div>`).join('')}<div class="reader-controls"><button class="button" data-action="panel-prev">← 上一格</button><b>FRAME ${ui.panel+1} / ${p.panels.length}</b><button class="button" data-action="panel-next">下一格 →</button></div></div>`;}
if(ui.stage===3){let a=p.panels[ui.panel];return `<div class="panel-editor"><section class="box"><div class="kicker">STEP 04 / VISUAL PRODUCTION</div><h2>让每一格拥有画面</h2><p class="lead">导入自己生成或持有使用权的 PNG/JPG/WebP，已上传图片保存在浏览器 IndexedDB，不会发送到远端。</p><div class="panel-photo">${a.image?`<img src="${e(a.image)}" alt="第${ui.panel+1}格视觉素材">`:`<div class="no-photo">FRAME ${ui.panel+1}<br>尚未添加画面</div>`}</div><div class="buttons" style="margin:15px 0"><label class="button dark">↑ 上传当前画格 <input type="file" accept="image/jpeg,image/png,image/webp" data-upload-panel="${ui.panel}" hidden></label>${actionButton('复制这一格的生图 Prompt','panel-prompt',String(ui.panel))}${a.image?actionButton('移除图片','remove-image',String(ui.panel),'danger'):''}</div><div class="notice">建议统一角色特征、分镜画幅和画面配色。已有漫画示例的九张插画为独立图片。</div><div class="reader-controls"><button class="button" data-action="panel-prev">← 上一格</button><b>FRAME ${ui.panel+1} / ${p.panels.length}</b><button class="button" data-action="panel-next">下一格 →</button></div></section><aside class="box"><h3>九格画面索引</h3><p class="minor">点选任意一格进行替换。</p><div class="panel-selector">${p.panels.map((v,i)=>`<button class="${ui.panel===i?'active':''}" data-action="select-panel" data-id="${i}">${v.image?`<img src="${e(v.image)}" alt="画格${i+1}">`:'<div class="mini-placeholder"></div>'}<b>${i+1}</b></button>`).join('')}</div><div class="divider"></div><div class="buttons">${actionButton('封面设计导出','cover-png',p.id)}</div></aside></div>`}
return `<div class="work-grid"><section class="box"><div class="kicker">STEP 05 / EDITORIAL REVIEW</div><h2>出版前最后一轮编辑</h2><p class="lead">人工核验完成之前，作品只保存在工作区。审核通过是作者的记录，不代表法律意见或事实核验系统。</p>${checksText.map((t,i)=>`<label class="checkrow"><input type="checkbox" data-check-index="${i}" ${p.checks?.[i]?'checked':''}><span>${t}</span></label>`).join('')}<div class="notice"><strong>公开声明：</strong> ${e(p.disclosure||'请先填写虚构声明。')}</div><div class="divider"></div><div class="buttons">${actionButton('进入待审核','request-review',p.id)}${actionButton('确认审稿通过','approve',p.id,'dark')}${actionButton('打开出版中心','publish-go',p.id)}</div></section><aside class="box"><h3>稿件状态</h3><p>${statusChip(p.status)}</p><p class="minor">完整画面：${p.panels.filter(a=>a.image).length}/${p.panels.length}</p><p class="minor">核验勾选：${p.checks.filter(Boolean).length}/6</p><p class="minor">来源链接：${validSources(p).length}</p><p class="minor">历史活动：${p.activity?.length||0} 条</p><div class="divider"></div><h3>最近编辑记录</h3>${(p.activity||[]).slice(0,5).map(a=>`<div class="rowline"><div><small>${humanDate(a.at)}</small><strong>${e(a.detail)}</strong></div></div>`).join('')}</aside></div>`}
function validSources(p){return (p.sourceURLs||'').split(/\r?\n|[,，]/).map(s=>s.trim()).map(safeURL).filter(Boolean)}
function canApprove(p){let missing=[];if(!p.title.trim())missing.push('漫画标题');if(wfMode(p)!=='original'&&!validSources(p).length)missing.push('真实来源链接');if(!p.factNotes?.trim())missing.push('事实核验备注');if(!p.fiction?.trim())missing.push('虚构改编策略');if(!p.disclosure?.trim())missing.push('虚构声明');if(!p.checks?.every(Boolean))missing.push('6 项人工核查');if(p.panels.filter(a=>a.image).length!==p.panels.length)missing.push('未完成的漫画画格');if(p.handoff?.importedAt){const imgs=(p.handoff.stagedFiles||[]).filter(x=>x.path?.endsWith('.png')&&x.sha256);if(imgs.length!==p.panels.length+1||imgs.some(x=>p.handoff.frameScopeQA?.[x.path]!==x.sha256))missing.push('逐张单场景与非拼版视觉核验');}return missing}
function reader(){let p=selected();if(!p)return `<div class="empty">作品不存在。<a href="#/library">返回书架</a></div>`;let idx=ui.reader,a=p.panels[idx],imgs=p.panels;return `${heroHeader('THE READING ROOM / ISSUE',e(p.title),e(p.subtitle||p.description||'原创漫画作品'),`<a class="button" href="${link('library')}">← 回到书架</a>${actionButton('编辑此作','edit',p.id)}${actionButton('下载独立封面','cover-png',p.id)}`)}<div class="reader-layout" style="margin-top:24px"><div><div class="reader-image">${a.image?`<img src="${e(a.image)}" alt="第${idx+1}格：${e(a.scene)}">`:`<div class="no-photo" style="color:#eee">第 ${idx+1} 格 · 尚未上传画面</div>`}</div><div class="reader-controls"><button class="button" data-action="reader-prev">← 上一格</button><b>${idx+1} / ${imgs.length}</b><button class="button dark" data-action="reader-next">下一格 →</button></div><div class="box"><div class="kicker">FRAME ${idx+1} / ${e(a.title)}</div><p>${e(a.caption)}</p><p class="minor">${e(a.dialogue)}</p></div></div><aside><div class="reader-thumbbar">${imgs.map((im,i)=>`<button class="${i===idx?'active':''}" data-action="reader-jump" data-id="${i}" aria-label="第${i+1}格">${im.image?`<img src="${e(im.image)}" alt="第${i+1}格">`:`<span>${i+1}</span>`}</button>`).join('')}</div><div class="notice" style="margin-top:20px">${e(p.disclosure)}</div></aside></div>`}
function publish(){let ps=activeProjects();let p=selected();return `${heroHeader('05 / THE PRESS','作品素材导出中心','一份作品，多种出口：完整分镜图片、独立封面、离线阅读与可核验的出版素材。',`<a class="button" href="#/studio">前往编辑工作台 ↗</a>`)}<div class="work-grid" style="margin-top:27px"><section class="box"><div class="kicker">SELECT THE ISSUE</div><h2>选择准备出版的漫画</h2><div class="field"><label>当前作品</label><select id="publishProject">${ps.map(x=>`<option value="${e(x.id)}" ${p?.id===x.id?'selected':''}>${e(x.title)} · ${e(x.status)}</option>`).join('')}</select></div>${p?`<div class="rowline" style="margin:16px 0"><div><strong>${e(p.title)}</strong><small>${p.panels.filter(a=>a.image).length}/${p.panels.length} 张视觉素材 · ${p.checks.filter(Boolean).length}/6 项编辑核查</small></div>${statusChip(p.status)}</div><div class="notice">${p.status==='已审核'||p.status==='已发布'?'本机审核已通过，可导出交付素材；是否正式发表以独立 GitHub 仓库中的 WorkBuddy 核验回执为准。':`尚未审核完成：${e(canApprove(p).slice(0,3).join('、')||'请人工检查')}${canApprove(p).length>3?'等':''}。允许导出个人预览，但公开发布前请完成审校。`}</div><div class="sectionbar"><h2>出版动作</h2></div><div class="cards2"><div class="outline"><h3>01 / 漫画图片 ZIP</h3><p class="minor">九张图片、作品介绍和创作声明，适合微信和小红书。缺失画面时导出失败。</p>${actionButton('打包九张 PNG/JPG','zip-pages',p.id,'dark')}</div><div class="outline"><h3>02 / 离线漫画网站</h3><p class="minor">生成无需后台的完整 HTML 漫画阅读包，可部署到静态站点。</p>${actionButton('导出静态发布包','zip-site',p.id,'dark')}</div><div class="outline"><h3>03 / 杂志式封面</h3><p class="minor">1080 × 1440 的原创排版 PNG，独立封面不包含九宫格细字。</p>${actionButton('生成封面 PNG','cover-png',p.id)}</div><div class="outline"><h3>04 / 作品编辑备份</h3><p class="minor">JSON 格式保存设定、分镜、来源、审核记录（不含上传图片）。</p>${actionButton('下载项目 JSON','export-project',p.id)}</div></div><div class="divider"></div><div class="buttons">${actionButton('复制公众号简介','copy-social',p.id)}${actionButton('复制九格 AI 生图指令','prompt',p.id)}<a href="#/archive" class="button">查看真实发表回执 ↗</a></div>`:''}</section><aside class="box"><h3>出版规则</h3><div class="outlined-list"><div class="rowline"><div><strong>新闻 ≠ 漫画剧情</strong><small>原创改编需要可见的虚构标注</small></div></div><div class="rowline"><div><strong>自动化 ≠ 已上线</strong><small>本机标记不代表网站或社交平台实际发布</small></div></div><div class="rowline"><div><strong>图片必须有使用权</strong><small>自行生成或获得合法授权</small></div></div><div class="rowline"><div><strong>PDF 输出</strong><small>在离线漫画网站中选择浏览器“打印 → 保存为 PDF”</small></div></div></div><div class="notice" style="margin-top:18px">当前<strong>没有微信 / 小红书账户直发接口</strong>。本页面提供素材下载，不会擅自替你向公众发布。</div></aside></div>`}
function settings(){return `${heroHeader('06 / YOUR WORKSPACE','数据与偏好','让漫画资产属于你。保存于本机的作品可以导出备份，换浏览器或清除站点数据前务必操作。')}<div class="cards2" style="margin-top:28px"><section class="box"><h3>作品数据库备份</h3><p class="minor">导出 ZIP，包含全部项目、热点记录、审稿元数据和已上传图片。内置示例图片也会打包。</p><div class="buttons">${actionButton('导出完整工作区 ZIP','backup-all','','dark')}<label class="button">导入 ZIP 备份<input type="file" data-import-workspace accept=".zip,application/zip" hidden></label></div><p class="risk">导入操作会替换当前工作区，请先导出当前版本备份。</p></section><section class="box"><h3>管理原则</h3><p class="minor">未登录时仅在本机保存。登录后可选择将项目与原创图片同步至用户私有云端；AI 模型计费开关仍关闭，定时采集和社交平台直发尚未启用。</p><div class="buttons"><a class="button" href="#/library">作品回收站 →</a>${actionButton('清空本机所有数据','reset-all','','danger')}</div></section><section class="box"><h3>数据使用说明</h3><p class="minor">漫画信息、来源、状态：localStorage；上传的图片：IndexedDB。浏览器清理缓存或无痕模式可能抹掉数据。本地备份是当前版本的可靠迁移方式。</p><p class="minor">最大单张导入图片：12MB · 支持 JPEG、PNG、WebP。</p></section><section class="box"><h3>平台进度</h3><div class="rowline"><strong>本地编辑 / 九格管理 / 作品归档</strong><span class="pill green">已实现</span></div><div class="rowline"><strong>发布素材与网页导出</strong><span class="pill green">已实现</span></div><div class="rowline"><strong>实时热点采集（事实须人工核验）</strong><span class="pill green">已接入</span></div><div class="rowline"><strong>账户与云端同步配置</strong><span class="pill green">已配置</span></div></section></div>`}
function render(){document.querySelectorAll('[data-route]').forEach(a=>{const active=a.dataset.route===ui.route;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelectorAll('[data-nav-group="handoff"]').forEach(el=>el.querySelector('.nav-parent')?.classList.toggle('is-group-active',['handoff','director','archive'].includes(ui.route)));const title={'production':'生产与出版','workspace':'作品工作空间','ai-briefing':'AI 前沿简报',live:'素材发现',characters:'角色档案',account:'云端账户',dashboard:'总览',radar:'选题池',library:'漫画书架',studio:'创作工作台',director:'创意导演台',publish:'素材导出',settings:'数据管理',reader:'漫画阅读',handoff:'制作交接',archive:'生产调度中心'};document.querySelector('#crumb').textContent=title[ui.route];let fn={dashboard,workspace:typeof wt4Workspace==='function'?wt4Workspace:studio,production:typeof wt4Production==='function'?wt4Production:wtWorkflow,radar,'ai-briefing':typeof wtBriefing==='function'?wtBriefing:dashboard,live:typeof wtLive==='function'?wtLive:dashboard,characters:typeof wtCharacters==='function'?wtCharacters:dashboard,account:typeof wtAccount==='function'?wtAccount:settings,library,studio,director:typeof wtCreativeDirector==='function'?wtCreativeDirector:studio,publish,settings,reader,handoff:typeof wtWorkflow==='function'?wtWorkflow:dashboard,archive:typeof wtArchiveDesk==='function'?wtArchiveDesk:dashboard}[ui.route];document.querySelector('#view').innerHTML=fn();document.title=`${title[ui.route]} — WORLD/TOON · By DAVYLAB`;}
function modal(body){let root=document.querySelector('#modalRoot');root.innerHTML=`<div class="modal-card"><button class="iconbtn modal-close" data-action="modal-close" aria-label="关闭">×</button>${body}</div>`;root.hidden=false}
function closeModal(){let x=document.querySelector('#modalRoot');x.hidden=true;x.innerHTML=''}
function newProject(topic){let p=emptyProject(topic);data.projects.unshift(p);ui.selected=p.id;ui.stage=0;persist();closeModal();nav('workspace/'+p.id);notify(topic?'已从选题建立作品，继续编剧与创意定稿':'作品已建立，继续输入创意并完善剧本')}
function topicModal(t){modal(`<div class="kicker">NEW EDITORIAL LEAD</div><h2>${t?'编辑热点':'添加一个热点'}</h2><p class="minor">手工记录可信来源。评分是个人策划评分，不代表真实平台流量。</p><form id="topicForm" data-id="${e(t?.id||'')}"><div class="fields"><div class="field wide"><label>事件标题 *</label><input name="title" required maxlength="180" value="${e(t?.title||'')}"></div><div class="field"><label>类别</label><select name="category">${CATS.map(x=>`<option ${x===t?.category?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>核验状态</label><select name="stage">${['待核验','已核验','已转漫画'].map(x=>`<option ${x===t?.stage?'selected':''}>${x}</option>`).join('')}</select></div><div class="field wide"><label>新闻摘要</label><textarea name="summary">${e(t?.summary||'')}</textarea></div><div class="field wide"><label>原始来源链接</label><input type="url" name="source" placeholder="https://..." value="${e(t?.source||'')}"></div><div class="field"><label>现实事件发生日期</label><input type="date" name="eventDate" value="${e(t?.eventDate||'')}"><small>${t?.eventDateBasis==='published_candidate'?'根据新闻发布日期自动填入的候选日期，待核验':t?.eventDateBasis==='source_event'?'新闻数据给出的事件日，仍须核实':'未取得可靠事件日时，请对照原文核验'}</small></div><input type="hidden" name="eventDateBasis" value="${e(t?.eventDateBasis||'')}">${['heat','impact','story'].map((k,i)=>`<div class="field"><label>${['热度','影响力','漫画价值'][i]}（1—5）</label><input name="${k}" type="number" min="1" max="5" value="${e(t?.[k]||3)}"></div>`).join('')}</div><div class="stepactions"><button type="button" class="button" data-action="modal-close">取消</button><button class="button dark" type="submit">保存选题</button></div></form>`)}
function saveTopic(form){let values=Object.fromEntries(new FormData(form).entries());let title=(values.title||'').trim();if(!title){notify('请填写热点标题');return}if(values.source&&!safeURL(values.source)){notify('来源链接必须为完整 HTTP(S) 地址');return}let t=data.topics.find(t=>t.id===form.dataset.id);if(!t){t={id:uid(),createdAt:now()};data.topics.unshift(t)}if((t.eventDate||'')!==String(values.eventDate||''))values.eventDateBasis=values.eventDate?'manual_unverified':'';Object.assign(t,{...values,title,heat:Math.max(1,Math.min(5,Number(values.heat)||1)),impact:Math.max(1,Math.min(5,Number(values.impact)||1)),story:Math.max(1,Math.min(5,Number(values.story)||1)),isSample:false});persist();closeModal();render();notify('选题已保存')}
function makePrompt(p,index){const lead=`你是 DAVYLAB WORLD/TOON 的原创漫画编剧与视觉导演。请基于以下内容创作，但必须将新闻可验证事实与虚构情节清晰区分，绝不编造针对现实人物的违法、私人关系或交易事实。风格：高级杂志审美、克制黑色幽默、清晰分镜、角色服饰和面貌连续一致；任何原始新闻报道不应被照搬。\n\n漫画标题：${p.title}\n故事摘要：${p.description}\n现实选题：${p.sourceTitle}\n可信来源：${p.sourceURLs||'未提供，必须先核验'}\n已核查事实：${p.factNotes||'待核验'}\n虚构改编策略：${p.fiction||'待补全'}\n角色圣经：${p.characters||'待补全'}\n公开声明：${p.disclosure}\n\n`;
if(index!==undefined){let a=p.panels[index];return '单张画格专用图像提示：ONE IMAGE ONLY，ONE SCENE，ONE CAMERA，ONE MOMENT。禁止九宫格、拼图、漫画排版、分屏、画中画、复合镜头、故事总览；仅画下述第 '+(index+1)+' 格，绝不包含其他格，竖版3:4高清原图。\n'+lead+`请为第 ${index+1} 格生成一张单镜头竖版漫画视觉，无水印，不需要生成可读中文字，预留旁白/对白文字排版空间。人物与全书风格一致。\n镜头：${a.scene}\n旁白：${a.caption}\n对白：${a.dialogue}\n额外视觉提示：${a.prompt}`;}
return lead+'请输出 9 格原创漫画分镜表，每格列出：标题、主体人物、画面构图、光线/配色、旁白、对白、独立画面提示词。尊重虚构声明；有事实不确定性时标注“待核验”，不可强行填空。\n\n已有分镜：\n'+p.panels.map((a,i)=>`#${i+1} ${a.title}\n画面：${a.scene}\n旁白：${a.caption}\n对白：${a.dialogue}`).join('\n');}
async function copyText(str){try{await navigator.clipboard.writeText(str);notify('内容已复制到剪贴板')}catch{modal(`<h2>复制内容</h2><p class="minor">此浏览器无法直接复制，请手动选取下面文本。</p><textarea style="width:100%;min-height:280px" readonly>${e(str)}</textarea>`);}}
function fillStoryTemplate(p){if(p.panels.some(a=>a.scene.trim())&&!confirm('将用九格通用叙事模板填充全部画面描述（不影响已上传图片），继续吗？'))return;let titles=['引子：平静表面','转折：不速之客','追问：各方说法','升级：风暴扩散','抉择：进退两难','公开：聚光灯下','反差：旁观者说','反转：重新定义','余韵：留给读者'];p.panels.forEach((a,i)=>{a.title=titles[i];a.scene=`原创漫画画面：第${i+1}幕。围绕「${p.sourceTitle||p.title}」的公共议题，以原创虚构角色展开。镜头与场景应体现${['平静','冲突','秘密','变化','挣扎','对峙','讽刺','反转','余味'][i]}，避免与真实人物发生可识别对应。`;a.caption=['故事从一个日常瞬间开始。','突然，事件打破宁静。','每个人都在讲述自己的版本。','局势朝着意外的方向发展。','主角必须作出选择。','聚光灯照亮了另一面。','旁观者发现事情并不简单。','原来的答案被重新书写。','未完待续，世界仍在继续。'][i];a.dialogue='';a.prompt='';});markDirty(p);setChange(p,'应用九格叙事模板');render();notify('已生成九格剧情骨架（本地模板）')}
async function openDB(){return new Promise((res,rej)=>{if(!('indexedDB' in window))return rej(Error('浏览器不支持 IndexedDB'));let req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('media');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
let dbPromise;const db=()=>dbPromise||(dbPromise=openDB());
async function putMedia(key,blob){let d=await db();return new Promise((resolve,reject)=>{let tx=d.transaction('media','readwrite');tx.objectStore('media').put(blob,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getMedia(key){let d=await db();return new Promise((resolve,reject)=>{let req=d.transaction('media').objectStore('media').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function delMedia(key){let d=await db();return new Promise((resolve,reject)=>{let tx=d.transaction('media','readwrite');tx.objectStore('media').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
const objectURLs=new Map();async function resolveImage(s){if(!s)return '';if(!s.startsWith('media:'))return s;if(objectURLs.has(s))return objectURLs.get(s);let blob=await getMedia(s.slice(6));if(!blob&&typeof wtDownloadMedia==='function'){blob=await wtDownloadMedia(s.slice(6));if(blob)await putMedia(s.slice(6),blob)}if(!blob)return '';let url=URL.createObjectURL(blob);objectURLs.set(s,url);return url}
async function hydrateImages(){let imgs=[...document.querySelectorAll('img[data-source]')];for(let el of imgs){try{let url=await resolveImage(el.dataset.source);if(el.isConnected)el.src=url||''}catch{if(el.isConnected)el.alt='图片读取失败，请从备份恢复'}}}
function mediaSrc(s){return s?.startsWith('media:')?'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#d7ddcf"/><text x="20" y="53" font-size="12">加载中</text></svg>'):s||''}
// Resolve any image references that were uploaded and live in IndexedDB.
const originalRender=render;render=function(){originalRender();document.querySelectorAll('img').forEach(el=>{if(el.hasAttribute('src')&&el.getAttribute('src').startsWith('media:')){el.dataset.source=el.getAttribute('src');el.src=mediaSrc(el.dataset.source)}});hydrateImages()};
async function uploadPanel(input){let file=input.files?.[0];if(!file)return;let type=file.type;if(!['image/jpeg','image/png','image/webp'].includes(type)){notify('仅支持 JPG、PNG、WebP 图片');return}if(file.size>12*1024*1024){notify('单张图片不能超过 12 MB');return}let p=selected(),i=Number(input.dataset.uploadPanel);let img=p.panels[i];let key=uid();try{await putMedia(key,file);let old=img.image;img.image='media:'+key;if(old?.startsWith('media:'))await delMedia(old.slice(6));markDirty(p);setChange(p,`更新第${i+1}格画面`);render();notify('图片已保存；登录后可同步到私有云端')}catch(err){notify('图片写入失败：'+err.message)}}
function saveFile(blob,filename){let a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}
async function getImageBlob(img){if(img.startsWith('media:')){let b=await getMedia(img.slice(6));if(!b&&typeof wtDownloadMedia==='function'){b=await wtDownloadMedia(img.slice(6));if(b)await putMedia(img.slice(6),b)}if(!b)throw Error('找不到已上传图片：'+img);return b}if(!img)throw Error('有画格尚未上传图片');let resp=await fetch(img);if(!resp.ok)throw Error('无法读取图片 '+img);return resp.blob()}
function contentExt(blob){return blob.type==='image/webp'?'webp':blob.type==='image/jpeg'?'jpg':'png'}
// A deterministic, dependency-free ZIP (STORE method), readable by Windows/macOS/7-Zip.
const enc=new TextEncoder(),dec=new TextDecoder();
const concat=xs=>{let n=xs.reduce((t,b)=>t+b.length,0),out=new Uint8Array(n),off=0;for(let a of xs){out.set(a,off);off+=a.length}return out};
let crcTable;function crc32(buf){if(!crcTable)crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0});let c=0xffffffff;for(let b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function packZip(entries){let parts=[],central=[],offset=0;for(let {name,bytes} of entries){let path=enc.encode(name),body=bytes instanceof Uint8Array?bytes:enc.encode(bytes),sum=crc32(body);let local=new Uint8Array(30+path.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,path.length,true);local.set(path,30);parts.push(local,body);
let c=new Uint8Array(46+path.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint32(16,sum,true);d.setUint32(20,body.length,true);d.setUint32(24,body.length,true);d.setUint16(28,path.length,true);d.setUint32(42,offset,true);c.set(path,46);central.push(c);offset+=local.length+body.length}let center=concat(central);let end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,center.length,true);v.setUint32(16,offset,true);return new Blob([...parts,center,end],{type:'application/zip'})}
function readZip(bytes){let u=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(u.buffer,u.byteOffset,u.byteLength),pos=0,found=new Map();while(pos+30<=u.length&&v.getUint32(pos,true)===0x04034b50){let method=v.getUint16(pos+8,true),size=v.getUint32(pos+18,true),nameLen=v.getUint16(pos+26,true),extra=v.getUint16(pos+28,true),name=dec.decode(u.slice(pos+30,pos+30+nameLen)),at=pos+30+nameLen+extra;if(method!==0)throw Error('只支持本平台导出的 ZIP 原始存储格式');if(at+size>u.length)throw Error('ZIP 文件损坏');if(name.includes('..')||name.startsWith('/'))throw Error('ZIP 文件路径无效');found.set(name,u.slice(at,at+size));pos=at+size}if(!found.size)throw Error('未找到可读的 ZIP 条目');return found}
const blobBytes=async b=>new Uint8Array(await b.arrayBuffer());
async function collectImages(p,filenames='pages'){let entries=[],images=[];for(let i=0;i<p.panels.length;i++){let img=p.panels[i].image;if(!img)throw Error(`第 ${i+1} 格尚未上传画面`);let b=await getImageBlob(img);let filename=`${filenames}/page-${String(i+1).padStart(2,'0')}.${contentExt(b)}`;entries.push({name:filename,bytes:await blobBytes(b)});images.push(filename)}return {entries,images}}
function escapeScript(s){return JSON.stringify(s).replace(/</g,'\\u003c')}
function generateReaderHTML(p,imgs){let payload={title:p.title,subtitle:p.subtitle,description:p.description,disclosure:p.disclosure,panels:p.panels.map((a,i)=>({title:a.title,caption:a.caption,dialogue:a.dialogue,image:imgs[i]}))};let json=escapeScript(payload);return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(p.title)} · By DAVYLAB</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f0e8;color:#1d2520;font-family:system-ui,'Noto Sans SC',sans-serif}header{text-align:center;padding:36px 14px 25px}small{letter-spacing:2px;color:#d3634e}h1{font-family:Georgia,serif;font-size:clamp(35px,7vw,64px);margin:12px 0}main{max-width:850px;margin:auto;padding:15px}figure{margin:0 0 40px;background:#fff;padding:14px;border:1px solid #ded9d0;break-inside:avoid;page-break-inside:avoid}img{max-width:100%;display:block;margin:auto;max-height:85vh;object-fit:contain}figcaption{padding:15px 8px;line-height:1.7}b{font-size:13px}.muted{color:#6f766d;font-size:13px}footer{padding:30px;text-align:center;color:#747b72;font-size:12px;border-top:1px solid #ddd}button{background:#1d2520;color:white;border:0;padding:12px 20px;cursor:pointer;border-radius:5px}@media print{button{display:none}figure{break-after:page;page-break-after:always;margin:0}header{padding:10px}footer{display:none}}</style></head><body><header><small>DAVYLAB / WORLD/TOON · ORIGINAL FICTION</small><h1>${e(p.title)}</h1><p>${e(p.subtitle||p.description)}</p><button onclick="window.print()">打印 / 保存为 PDF</button></header><main id="pages"></main><footer>${e(p.disclosure)}<p>By DAVYLAB · 独立原创漫画</p></footer><script>let d=${json};const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));document.getElementById('pages').innerHTML=d.panels.map((p,i)=>'<figure><img src="'+p.image+'" alt="画格'+(i+1)+'"><figcaption><b>FRAME '+String(i+1).padStart(2,'0')+' · '+esc(p.title)+'</b><p>'+esc(p.caption)+'</p><p class="muted">'+esc(p.dialogue)+'</p></figcaption></figure>').join('');<\/script></body></html>`}
async function exportZip(p,mode){
 notify('正在核查漫画文件并建立素材包…');
 try{
  let entries=[],images=[];
  if(mode==='site'){
   ({entries,images}=await collectImages(p));
   entries.push({name:'index.html',bytes:enc.encode(generateReaderHTML(p,images))});
   entries.push({name:'README.txt',bytes:enc.encode('DAVYLAB WORLD/TOON\n解压 ZIP 后打开 index.html 即可离线阅读。本包仅供预览，不代表 QA、发表或版权审核。')});
   saveFile(packZip(entries),safeName(p.title)+'_离线漫画预览.zip');
  }else{
   if(!Array.isArray(p.panels)||p.panels.length!==9||p.panels.some(x=>!x.image)||!p.cover)
    throw Error('完整素材包必须包含全部 01—09 格及独立封面，不能输出碎片包');
   const checks=[],hashes={},seen=new Set();
   const addPNG=async (path,source)=>{
    const blob=await getImageBlob(source);
    if(blob.type!=='image/png')throw Error(path+' 不是 PNG，正式素材不接受 JPG/WebP 占位');
    const bmp=await createImageBitmap(blob),w=bmp.width,h=bmp.height;bmp.close?.();
    if(w<1080||h<1440||Math.abs(w/h-0.75)>0.002)
     throw Error(path+' 不符合原生至少1080×1440的3:4画布（'+w+'×'+h+'）');
    const bytes=await blobBytes(blob);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(seen.has(digest))throw Error(path+' 与另一画格内容完全相同，不能重复使用图像');
    seen.add(digest);hashes[path]=digest;entries.push({name:path,bytes});
    checks.push({path,width:w,height:h,sha256:digest,source:'actual_uploaded_png'});
   };
   for(let i=0;i<9;i++)await addPNG('panels/'+String(i+1).padStart(2,'0')+'.png',p.panels[i].image);
   await addPNG('cover.png',p.cover);
   const firstSha=p.creativeDirection?.pilotApproval?.pilot_frame_sha256;
   if(firstSha&&hashes['panels/01.png']!==firstSha)
    throw Error('01.png 不是获作者批准的 Pilot 原始字节，不允许正式打包');
   const staged=(p.handoff?.stagedFiles||[]).filter(x=>x.sha256&&/^(cover\.png|panels\/\d{2}\.png)$/.test(x.path));
   const sceneQa=staged.length===10&&staged.every(x=>p.handoff?.frameScopeQA?.[x.path]===x.sha256);
   // File integrity is checked here; editorial/rights/mobile/visual approval must not be inferred.
   const manifest={schema:'davylab.worldtoon.export-candidate.v2',task_id:p.handoff?.taskId||null,
    title:p.title,panel_count:9,assets:{cover:'cover.png',panels:checks.filter(x=>x.path.startsWith('panels/')).map(x=>x.path)},
    sha256:hashes,files_verified:true,scene_human_reviewed:sceneQa,
    qa:{native_png:true,complete_files:true,pilot_byte_identical:firstSha?true:null,
     single_scene_verified:sceneQa,character_continuity:'pending',chinese_text_reviewed:'pending',
     safety_rights:'pending',phone_previewed:'pending',sources_checked:'pending',cover_independent_concept:'pending'},
    package_ready:false,publication_approved:false,github_delivered:false,actual_published:false,
    note:'Candidate-only archive. PNG bytes and hash integrity passed. Semantic/editorial/publishing QA not automatically asserted.'};
   entries.push({name:'manifest.json',bytes:enc.encode(JSON.stringify(manifest,null,2))});
   entries.push({name:'caption.md',bytes:enc.encode('# '+p.title+'\n\n'+p.panels.map((x,i)=>'## '+String(i+1).padStart(2,'0')+' · '+x.title+'\n'+(x.caption||'')+'\n'+(x.dialogue||'')).join('\n\n')+'\n\n'+(p.disclosure||''))});
   entries.push({name:'sources.md',bytes:enc.encode('# 资料与核验\n\n'+validSources(p).join('\n')+'\n\n'+(p.factNotes||'尚未核验')+'\n\n声明：'+(p.disclosure||''))});
   entries.push({name:'QA_STATUS.md',bytes:enc.encode('# WORLD/TOON 导出 QA\n\n文件尺寸、PNG 格式、内容唯一性及 SHA256：已由平台核实。\n人物跨格一致性、镜头/文字/肖像版权/手机端：待真实人工核对。\n本 ZIP 是完整素材候选包，不是正式 FINAL 或 WorkBuddy 可发包。\n')});
   saveFile(packZip(entries),safeName(p.title)+'_十图完整候选素材_待QA.zip');
  }
  setChange(p,'导出实际文件验收通过的'+(mode==='site'?'预览':'10图候选素材')+'（不代表正式出版）');
  notify('文件已校验并触发下载；版权、镜头和中文视觉 QA 仍须人工完成');
 }catch(err){notify('导出已阻断：'+String(err.message||err))}
}

function canvasRound(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
async function exportCover(p){
 if(window.WTStyleV3?.CATALOG?.some(x=>x.style_id===p?.creativeDirection?.styleId)){
  notify('V3 必须使用独立绘制的正式封面，禁止浏览器 Canvas 示意图冒充商业漫画封面');return;
 }
notify('正在绘制封面…');try{let canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;let ctx=canvas.getContext('2d');ctx.fillStyle='#f1eee5';ctx.fillRect(0,0,1080,1440);ctx.fillStyle='#202622';ctx.fillRect(0,0,1080,175);ctx.fillStyle='#ffffff';ctx.font='bold 67px Georgia, serif';ctx.fillText('WORLD/TOON',60,97);ctx.fillStyle='#dc694e';ctx.font='bold 22px sans-serif';ctx.fillText('BY DAVYLAB  /  ORIGINAL STORIES',62,139);ctx.fillStyle='#1d2520';ctx.font='bold 27px sans-serif';ctx.fillText('THE WORLD, REIMAGINED IN PANELS.',63,230);
let source=p.cover||p.panels.find(a=>a.image)?.image||'';if(!source){ctx.fillStyle='#d7ddcf';ctx.fillRect(62,270,956,795);ctx.fillStyle='#4b5e53';ctx.font='bold 110px Georgia,serif';ctx.fillText('STORY',112,680);ctx.fillText('IN PROGRESS',112,800,830)}else{let b=await getImageBlob(source);let u=URL.createObjectURL(b);try{let img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=u});let x=62,y=270,w=956,h=795;let scale=Math.max(w/img.width,h/img.height);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);ctx.restore()}finally{URL.revokeObjectURL(u)}}
ctx.fillStyle='#202622';ctx.fillRect(62,1080,956,288);ctx.fillStyle='#f6f0e7';ctx.font='bold 66px "Noto Sans SC",sans-serif';let title=p.title.slice(0,13);ctx.fillText(title,98,1182,890);ctx.fillStyle='#bac2b8';ctx.font='27px sans-serif';ctx.fillText((p.subtitle||p.description||'一部原创漫画').slice(0,36),100,1243,880);ctx.fillStyle='#de7054';ctx.fillRect(99,1282,130,5);ctx.fillStyle='#bfc8bd';ctx.font='18px sans-serif';ctx.fillText('DAVYLAB WORLD/TOON  /  FICTIONAL ADAPTATION',101,1322);let blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('封面渲染失败');saveFile(blob,safeName(p.title)+'_杂志封面.png');notify('封面已生成：1080×1440 PNG')}catch(err){notify('封面生成失败：'+err.message)}}
function exportProject(p){saveFile(new Blob([JSON.stringify({schema:'comicpress-project-v2',project:p},null,2)],{type:'application/json'}),safeName(p.title)+'_项目数据.json');notify('项目 JSON 已导出，不含上传图片')}
async function backupAll(){notify('正在创建完整备份，请勿关闭此页');try{let items=[{name:'workspace.json',bytes:enc.encode(JSON.stringify({schema:'comicpress-backup-v2',exportedAt:now(),data}))}],seen=new Set();for(let p of [...data.projects,{panels:(data.characters||[]).map(ch=>({image:ch.portrait})),cover:''}]){let imgs=[...(p.panels||[]).map(a=>a.image),p.cover,p.creativeDirection?.pilot?.characterImage,p.creativeDirection?.pilot?.panelImage,...(p.creativeDirection?.cast||[]).filter(ch=>ch.portraitConsent).map(ch=>ch.portraitMedia)];for(let im of imgs){if(!im||seen.has(im))continue;seen.add(im);let b=await getImageBlob(im);let name=im.startsWith('media:')?`media/${im.slice(6)}.${contentExt(b)}`:`seed/${im.replace('assets/','')}`;items.push({name,bytes:await blobBytes(b)})}}saveFile(packZip(items),'DAVYLAB_Comic_Press_完整备份_'+new Date().toISOString().slice(0,10)+'.zip');notify('完整 ZIP 备份已生成')}catch(err){notify('备份失败：'+err.message)}}
async function importWorkspace(file){if(!confirm('导入将覆盖本机全部漫画资料。建议先导出当前备份。继续吗？'))return;notify('正在验证并恢复备份…');try{let files=readZip(new Uint8Array(await file.arrayBuffer())),raw=files.get('workspace.json');if(!raw)throw Error('不是本平台的完整备份');let obj=JSON.parse(dec.decode(raw));if(obj.schema!=='comicpress-backup-v2'||!Array.isArray(obj.data?.projects)||!Array.isArray(obj.data?.topics))throw Error('工作区数据格式不符合要求');let fresh=obj.data;for(let p of fresh.projects){if(!Array.isArray(p.panels)||p.panels.length<4||p.panels.length>60)throw Error('备份中存在损坏的漫画分镜（需4–60格）');for(let a of [...p.panels,{image:p.cover},{image:p.creativeDirection?.pilot?.characterImage},{image:p.creativeDirection?.pilot?.panelImage},...(p.creativeDirection?.cast||[]).filter(ch=>ch.portraitConsent).map(ch=>({image:ch.portraitMedia}))]){let im=a.image;if(!im)continue;if(im.startsWith('media:')){let k=im.slice(6),name=[...files.keys()].find(n=>n.startsWith(`media/${k}.`));if(!name)throw Error('备份缺失图片 '+k);let mime=name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png';await putMedia(k,new Blob([files.get(name)],{type:mime}))}else if(im.startsWith('assets/')){if(!files.has('seed/'+im.slice(7)))throw Error('备份缺失示例素材 '+im)}}}for(const ch of fresh.characters||[]){const im=ch.portrait;if(!im)continue;if(im.startsWith('media:')){const k=im.slice(6),name=[...files.keys()].find(n=>n.startsWith('media/'+k+'.'));if(!name)throw Error('备份缺失角色定妆照 '+k);const mime=name.endsWith('.webp')?'image/webp':name.endsWith('.jpg')?'image/jpeg':'image/png';await putMedia(k,new Blob([files.get(name)],{type:mime}));}}data=fresh;persist();ui.selected=data.projects[0]?.id||'';closeModal();nav('library');notify('完整工作区已恢复，请核对作品')}catch(err){notify('导入失败：'+err.message)}}
async function action(act,id){let p=selected();switch(act){case 'new':newProject();break;case 'topic-new':topicModal();break;case 'topic-edit':topicModal(data.topics.find(t=>t.id===id));break;case 'topic-filter':ui.topicFilter=id;render();break;case 'topic-delete':if(confirm('确定移除此选题吗？')){data.topics=data.topics.filter(t=>t.id!==id);persist();render()}break;case 'topic-to-project':{let t=data.topics.find(t=>t.id===id);if(!t)break;t.stage='已转漫画';persist();newProject(t);break}case 'library-filter':ui.filter=id;render();break;case 'clean-unmade':wtUnmadeCleanupDialog();break;case 'delete-unmade':await wtDeleteUnmadeProjects([id]);break;case 'edit':ui.selected=id;ui.stage=0;nav(`studio/${id}/0`);break;case 'duplicate':{let orig=findProject(id);if(!orig)break;let v=structuredClone(orig);v.id=uid();v.title+=' · 副本';v.status='草稿';v.checks=Array(6).fill(false);v.deleted=false;v.archived=false;v.createdAt=now();v.updatedAt=now();v.activity=[{at:now(),detail:'复制自「'+orig.title+'」'}];data.projects.unshift(v);persist();render();notify('已复制作品')}break;case 'archive':{let v=findProject(id);v.archived=!v.archived;setChange(v,v.archived?'归档作品':'解除归档');render();break}case 'trash':if(confirm('将此作品移入回收站？可从回收站恢复。')){let v=findProject(id);v.deleted=true;setChange(v,'移入回收站');render()}break;case 'restore':{let v=findProject(id);v.deleted=false;v.archived=false;setChange(v,'恢复作品');render();break}case 'purge':if(confirm('彻底删除此作品？不能从回收站恢复，请先备份。')){data.projects=data.projects.filter(v=>v.id!==id);persist();render()}break;case 'studio-stage':ui.stage=Number(id);render();break;case 'stage-prev':ui.stage=Math.max(0,ui.stage-1);render();break;case 'stage-next':ui.stage=Math.min(4,ui.stage+1);render();break;case 'select-panel':ui.panel=Number(id);render();break;case 'panel-prev':ui.panel=(ui.panel+p.panels.length-1)%p.panels.length;render();break;case 'panel-next':ui.panel=(ui.panel+1)%p.panels.length;render();break;case 'reader-prev':ui.reader=(ui.reader+p.panels.length-1)%p.panels.length;render();break;case 'reader-next':ui.reader=(ui.reader+1)%p.panels.length;render();break;case 'reader-jump':ui.reader=Number(id);render();break;case 'story-template':fillStoryTemplate(findProject(id)||p);break;case 'prompt':copyText(makePrompt(findProject(id)||p));break;case 'panel-prompt':copyText(makePrompt(p,Number(id)));break;case 'remove-image':if(confirm('移除这一格的图片？上传素材会从浏览器媒体库删除。')){let a=p.panels[Number(id)],old=a.image;a.image='';if(old.startsWith('media:'))await delMedia(old.slice(6));markDirty(p);setChange(p,'移除图片');render()}break;case 'request-review':p.status='待审核';setChange(p,'提交待审核');render();break;case 'approve':{let missing=canApprove(p);if(missing.length){notify('无法审核通过：缺少 '+missing.join('、'));return}p.status='已审核';p.reviewedAt=now();setChange(p,'作者人工审核通过');render();notify('已审核通过（本地记录）');break}case 'mark-published':notify('正式发表状态只从 GitHub 的 WorkBuddy 核验回执同步，不能在本机直接标记');nav('archive');break;case 'publish-go':ui.selected=id;nav('publish');break;case 'export-project':exportProject(findProject(id));break;case 'zip-pages':await exportZip(findProject(id),'pages');break;case 'zip-site':await exportZip(findProject(id),'site');break;case 'cover-png':await exportCover(findProject(id));break;case 'copy-social':{let v=findProject(id);copyText(`《${v.title}》\n${v.subtitle||v.description}\n\n九格看世界，幽默不失锋芒。\n${v.disclosure}\n\nWORLD/TOON · By DAVYLAB`);break}case 'backup-all':await backupAll();break;case 'reset-all':{if(!confirm('彻底清空本机全部漫画作品和选题？操作不可撤销。'))return;if(!confirm('请确认已下载完整备份。仍然清空？'))return;data=initial();persist();ui.selected=data.projects[0].id;nav('dashboard');notify('已重置工作区（图片可能仍占用媒体缓存）');break}case 'modal-close':closeModal();break;default:console.warn('unknown action',act)}}
document.addEventListener('click',ev=>{const anchor=ev.target.closest('a[href^="#/"]');if(anchor){ev.preventDefault();nav(anchor.getAttribute('href').slice(2));return}let t=ev.target.closest('[data-action]');if(t){ev.preventDefault();action(t.dataset.action,t.dataset.id||'').catch(err=>notify('操作未完成：'+err.message))}});
document.addEventListener('submit',ev=>{
 if(ev.target.id==='wtUnmadeCleanupForm'){
  ev.preventDefault();
  const form=ev.target;
  const chosen=[...form.querySelectorAll('input[name="projectId"]:checked')].map(x=>x.value);
  const deleteLinkedTopics=!!form.querySelector('input[name="deleteLinkedTopics"]:checked');
  wtDeleteUnmadeProjects(chosen,{deleteLinkedTopics}).catch(err=>notify('清理失败：'+err.message));
  return;
 }
 if(ev.target.id==='topicForm'){ev.preventDefault();saveTopic(ev.target)}
});
document.addEventListener('input',ev=>{let el=ev.target,p=selected();if(el.matches('[data-project-field]')&&p){p[el.dataset.projectField]=el.value;if(el.dataset.projectField==='eventDate')p.eventDateBasis=el.value?'manual_unverified':'';markDirty(p);return}if(el.matches('[data-panel-field]')&&p){let idx=Number(el.dataset.panelIndex);p.panels[idx][el.dataset.panelField]=el.value;markDirty(p);return}if(el.id==='librarySearch'){ui.search=el.value;let caret=el.selectionStart;render();let next=document.querySelector('#librarySearch');next?.focus();next?.setSelectionRange(caret,caret)}});
document.addEventListener('change',ev=>{let el=ev.target,p=selected();if(el.matches('[data-check-index]')&&p){p.checks[Number(el.dataset.checkIndex)]=el.checked;if(!el.checked&&p.status==='已审核')p.status='草稿';setChange(p);render()}if(el.matches('[data-upload-panel]'))uploadPanel(el).then(()=>{if(typeof wtScheduleSync==='function')wtScheduleSync()});if(el.matches('[data-import-workspace]')&&el.files[0])importWorkspace(el.files[0]);if(el.id==='publishProject'){ui.selected=el.value;render()}if(el.matches('[data-project-field]')&&p){setChange(p,'更新作品设定')}});
document.getElementById('topNew').addEventListener('click',()=>newProject());document.getElementById('menuToggle').addEventListener('click',()=>document.querySelector('.rail').classList.toggle('is-open'));
window.addEventListener('hashchange',ev=>{
 const target=ev?.newURL?new URL(ev.newURL).hash:location.hash;
 if(wtNavigationHandledHashes.delete(target))return;
 wtNavigationHandledHashes.clear();
 parseRoute();
});document.addEventListener('keydown',ev=>{if(document.querySelector('#modalRoot:not([hidden])')){if(ev.key==='Escape')closeModal();return}if(ui.route==='reader'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){if(ev.key==='ArrowRight'){const n=selected()?.panels?.length||9;ui.reader=(ui.reader+1)%n;render()}if(ev.key==='ArrowLeft'){const n=selected()?.panels?.length||9;ui.reader=(ui.reader+n-1)%n;render()}}});
async function finishLegacyImport(){
 let moved=0,failed=0;
 for(let p of data.projects){for(let im of p.panels){if(im.image?.startsWith('data:image/')){
  try{const b=await(await fetch(im.image)).blob(),key=uid();await putMedia(key,b);im.image='media:'+key;moved++}catch{failed++}
 }}}
 if(failed){notify(`旧版导入存在 ${failed} 张图片迁移失败；请先在旧版导出备份`);return}
 if(persist()){legacyImport=false;notify(`旧版作品已导入，${moved} 张图片转入安全媒体存储`);render()}
}
if(legacyImport)finishLegacyImport();else if(!localStorage.getItem(APP_KEY))persist();parseRoute();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});