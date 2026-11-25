/* WORLD/TOON · By DAVYLAB | Book-to-Comic novel research panel.
 * TXT/MD/PDF/EPUB stays local. Explicit consent is needed to include the source
 * in an outbound ChatGPT task ZIP; never upload a novel on input-change.
 */
'use strict';
(function(root){
 const local=new Map(),busy=new Set();
 const id=p=>String(p?.id||'');
 const escape=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const summary=skill=>skill.chapter_index.slice(0,15).map(x=>'<div class="novel-chapter"><strong>'+escape(x.chapter_id)+' · '+escape(x.title)+'</strong><span>'+escape(x.locator)+' · '+x.characters+' 字</span><small>'+escape(x.theme_cues.join(' · ')||'无高置信主题线索')+'</small></div>').join('')+
  (skill.chapter_index.length>15?'<p class="minor">另有 '+(skill.chapter_index.length-15)+' 段已纳入完整结构索引（不截断源文）。</p>':'');
 function panel(p){
  if(!p)return '';
  const staged=local.get(id(p)),skill=staged?.skill||p.novelSkill;
  const locked=!!p.handoff?.repoQueuedAt||!!p.handoff?.directTaskExportedAt||p.status==='已发布';
  const mode=staged?.rightsMode||p.storySourceSelection?.adaptation||'literary_review';
  const hasFile=!!p.novelSkill?.private_source_ref,hasShare=!!p.novelSkill?.export_source_approved;
  return '<details class="wt-novel-studio" data-novel-panel="'+escape(p.id)+'"'+(staged?' open':'')+'>'+
   '<summary><span class="wt-novel-icon">▤</span><span><strong>文学漫绘 · 作品资料整理</strong><small>本地全文索引 → 人物与主题线索 → 九格创作依据</small></span><span class="wt-novel-badge">'+(skill?'已有结构索引':'上传小说')+'</span></summary>'+
   '<div class="wt-novel-body">'+
   '<p class="wt-novel-note">TXT、MD、文字层 PDF、EPUB；本机处理，不自动上传原著。继承 book-to-skill 的分章、溯源和按需引用方式，当前“结构蒸馏”不冒充 AI 深层理解。<a href="https://github.com/virgiliojr94/book-to-skill" target="_blank" rel="noopener noreferrer">开源来源</a></p>'+
   '<div class="wt-novel-grid"><label>小说文件（≤40MB）<input type="file" data-novel-file accept=".txt,.md,.pdf,.epub,text/plain,application/pdf,application/epub+zip" '+(locked?'disabled':'')+'></label>'+
   '<label>创作边界<select data-novel-rights '+(locked?'disabled':'')+'><option value="literary_review" '+(mode!=='faithful'?'selected':'')+'>文学导读 · 未获得改编权限</option><option value="faithful" '+(mode==='faithful'?'selected':'')+'>剧情改编 · 有有效许可依据</option></select></label></div>'+
   '<label class="wt-novel-source">可信书目／评论或改编许可证明链接<input data-novel-source type="url" placeholder="https://…（按作品来源填写；不可编造）" value="'+escape(staged?.sourceURL||p.storySourceSelection?.source||'')+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="wt-novel-option"><input type="checkbox" data-novel-keep '+(locked?'disabled':'checked')+'>本机保留原文副本，以便本项目随后生成任务包（不自动传给云端）</label>'+
   '<label class="wt-novel-option"><input type="checkbox" data-novel-share '+(staged?.shareAllowed||(!staged&&hasShare)?'checked':'')+' '+(locked?'disabled':'')+'>我确认有权将该原文提交给外部 AI，并明确同意仅在我手动下载、发送任务 ZIP 时附带原稿（不会自动上传、公开或发表）</label>'+
   (mode==='faithful'?'<label class="wt-novel-option"><input type="checkbox" data-novel-license '+(staged?.licensed?'checked':'')+' '+(locked?'disabled':'')+'>我确认拥有有效的剧情改编权，并已提供可核验的授权／公版依据；本机标记不代表平台完成版权核验</label>':'')+
   '<div class="wt-novel-actions"><button type="button" class="button dark" data-novel-action="apply" '+(!staged||locked?'disabled':'')+'>采用蒸馏索引，写入当前漫画</button>'+
   (p.novelSkill&&!locked?'<button type="button" class="button" data-novel-action="clear">移除索引</button>':'')+
   (p.novelSkill?'<button type="button" class="button" data-novel-action="copy">复制深度语义蒸馏指令</button>':'')+
   '</div><div class="wt-novel-status" aria-live="polite">'+(busy.has(id(p))?'正在本地解析小说…':staged?'文本已解析，尚未写入项目':'请选择小说文件，解析后核对章节线索与版权范围')+'</div>'+
   (skill?'<div class="wt-novel-evidence"><div class="wt-novel-metrics"><span><strong>'+skill.provenance.char_count.toLocaleString()+'</strong> 字</span><span><strong>'+skill.provenance.chapter_count+'</strong> 章／段</span><span><strong>'+skill.themes.length+'</strong> 主题线索</span></div>'+
   '<p><strong>高频主题：</strong>'+escape(skill.themes.slice(0,8).map(x=>x.name).join(' · ')||'未检测到稳健线索')+'</p>'+
   '<p><strong>人物候选（未经核验）：</strong>'+escape(skill.cast_candidates.slice(0,7).map(x=>x.name).join('、')||'无可靠候选')+'</p>'+
   '<p class="wt-novel-safeguard">索引层级：本地结构提示；作者/主题/人物、哲学意义和真实场景仍须 AI 阅读与人工核实。'+(hasFile?'原著副本仅存在于当前设备。':'')+'</p>'+
   '<details class="wt-novel-chapters"><summary>查看章节、位置与主题依据</summary>'+summary(skill)+'</details>'+
   (p.novelSkill?'<p class="wt-novel-digest">源文件 SHA256：<code>'+escape(skill.provenance.sha256||'待校验')+'</code></p>':'')+'</div>':'')+
   (locked?'<p class="wt-novel-safeguard">本作品已导出或进入制作流程；若需更新全文蒸馏，请复制为新修订版，避免覆盖已锁定任务。</p>':'')+
   '</div></details>';
 }
 function liveSource(el){
  const node=el.closest('[data-novel-panel]');
  return node?.dataset.novelPanel||'';
 }
 async function analyze(el){
  const projectId=liveSource(el);if(!projectId)return;
  const p=typeof findProject==='function'?findProject(projectId):null;
  if(!p||p.handoff?.repoQueuedAt||p.handoff?.directTaskExportedAt)throw Error('已经派单／导出任务，请复制新的作品版本后再修改');
  const file=el.files?.[0];if(!file)return;
  if(!root.WTNovelCore)throw Error('小说解析引擎尚未加载，请刷新页面');
  if(busy.has(projectId))return;
  busy.add(projectId);
  const label=el.closest('[data-novel-panel]')?.querySelector('.wt-novel-status');
  if(label)label.textContent='正在本机读取全文和建立章节索引，不会上传到服务器…';
  try{
   const extracted=await root.WTNovelCore.extractFile(file);
   const mode=el.closest('[data-novel-panel]')?.querySelector('[data-novel-rights]')?.value||'literary_review';
   const skill=root.WTNovelCore.buildSkill(extracted.chapters,{fileName:file.name,fileType:extracted.ext,
    sha256:extracted.sha256,rightsMode:mode});
   const preview=local.get(projectId)||{};
   const rootEl=el.closest('[data-novel-panel]');
   local.set(projectId,{...preview,file,rightsMode:mode,skill,sourceURL:rootEl?.querySelector('[data-novel-source]')?.value?.trim()||preview.sourceURL||'',licensed:!!rootEl?.querySelector('[data-novel-license]')?.checked,shareAllowed:!!rootEl?.querySelector('[data-novel-share]')?.checked});
   if(typeof render==='function')render();
   if(typeof notify==='function')notify('已本地索引 '+skill.provenance.chapter_count+' 段正文，主题和人名仅为未经核验的候选');
  }catch(err){if(label)label.textContent='解析失败：'+(err?.message||err);if(typeof notify==='function')notify('小说解析失败：'+(err?.message||err))}
  finally{busy.delete(projectId)}
 }
 function semanticPrompt(p){
  const skill=p.novelSkill;if(!skill)throw Error('当前作品尚未导入小说蒸馏索引');
  return [
   'WORLD/TOON · By DAVYLAB｜小说结构索引 → AI 深度语义蒸馏',
   '请先读取随任务包附带的 novel-skill.json 以及实际授权提供的原文；如果没有原文，不得仅凭章节标题和关键词编造情节。',
   '作品：'+(p.sourceTitle||p.title)+'；来源文件：'+skill.provenance.file_name+'；完整来源 SHA256：'+skill.provenance.sha256,
   '第一级：逐章建立可追溯的真实人物与事件关系、冲突、关键转折及叙述视角，每项标注原书章节位置。无法核验的情节和人物写“待核验”。',
   '第二级：提炼作品核心议题、文学意象、叙事结构和可争议的哲学解释；明确原文事实、模型解释和编辑观点分别是什么。',
   '第三级：从以上候选中建议九格漫画，每格有原文锚点、叙事意图、原创视觉隐喻、镜头、台词及风险评估；不能伪造原著对白。',
   skill.rights.mode==='literary_review'?
    '没有有效改编许可：只制作01–04作品故事导读（人物、核心事件、冲突、转折及结局的原创概述）、05–07独立哲学分析、08–09普通人原创生活场景；严禁逐幕复制书中独特剧情和原著人物形象。':
    '剧情改编模式：先核实已提供的授权许可链接与作者确认，未核准时只做研究，不进入原著情节改编和正式图片制作。',
   '严格禁止只回传标题、零散摘句或不完整的截断句子充当蒸馏结果。先核对引用证据与原文位置。',
   '最终产出可编辑的角色关系圣经、主题矩阵、结构化九格分镜建议和 QA 待审清单；这是研究辅助，不得自动替作者锁定创意或批准发表。'
  ].join('\n\n');
 }
 function validURL(value){try{const u=new URL(String(value||'').trim());return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
 async function apply(p,rootEl){
  const state=local.get(id(p));
  if(!state)throw Error('请先上传并成功解析一份小说');
  if(p.handoff?.repoQueuedAt||p.handoff?.directTaskExportedAt||p.publishedAt||p.panels?.some(x=>x.image)||p.cover)
   throw Error('作品已制作、导出或发表，请先创建修订版以保护现有成品');
  const rightsMode=rootEl.querySelector('[data-novel-rights]')?.value||'literary_review';
  const source=validURL(rootEl.querySelector('[data-novel-source]')?.value);
  const rawURL=rootEl.querySelector('[data-novel-source]')?.value?.trim()||'';
  if(rawURL&&!source)throw Error('书目或授权证据链接必须是有效的 HTTPS 地址');
  const keep=!!rootEl.querySelector('[data-novel-keep]')?.checked;
  const sharing=!!rootEl.querySelector('[data-novel-share]')?.checked;
  const permission=!!rootEl.querySelector('[data-novel-license]')?.checked;
  if(rightsMode==='faithful'&&(!permission||!source))
   throw Error('原著剧情改编必须单独确认改编权限并提供有效的 HTTPS 授权依据链接；仅有书稿文件不能视为授权');
  if(sharing&&!keep)throw Error('请先勾选“本机保留原文副本”，才能在后续 ZIP 附带经允许的原稿');
  if(!confirm('将把小说的本地结构索引写入当前漫画创作依据，并使已有导演台定稿失效（不会删除图片；本操作只适用于未制作项目）。确定继续？'))return;
  const fileKey='novel-source-'+id(p)+'-'+state.skill.provenance.sha256;
  const skill=JSON.parse(JSON.stringify(state.skill));
  skill.rights.mode=rightsMode;
  skill.rights.source_license_status=rightsMode==='faithful'?'creator_attested_pending_independent_verification':'not_claiming_adaptation_rights';
  skill.rights.external_file_transfer_approved=sharing;
  skill.rights.license_evidence_url=rightsMode==='faithful'?source:'';
  skill.private_source_ref=keep?'media:'+fileKey:null;
  skill.export_source_approved=sharing;
  skill.provenance.source_metadata_url=source;
  skill.qa.rights_pending_verification=true;skill.qa.ready_for_publication=false;
  const previous={novelSkill:p.novelSkill,storySourceSelection:p.storySourceSelection,
   sourceURLs:p.sourceURLs,sourceTitle:p.sourceTitle,category:p.category,description:p.description,
   ideaSeed:p.ideaSeed,fiction:p.fiction,disclosure:p.disclosure,panels:p.panels,
   handoff:p.handoff,creativeDirection:p.creativeDirection};
  const existingCount=p.panels?.length||0;
  try{
   if(keep)await putMedia(fileKey,state.file);
   if(existingCount!==9)
    p.panels=Array.from({length:9},(_,i)=>makePanel(i));
   p.novelSkill=skill;
   p.storySourceSelection={...(p.storySourceSelection||{}),
    title:p.sourceTitle||p.title,source:source||'',type:'novel',source_kind:'local_text_index',
    rights:rightsMode==='faithful'?'licensed_pending_verification':'unknown',
    adaptation:rightsMode,license_url:rightsMode==='faithful'?source:'',
    license_attested:rightsMode==='faithful'&&permission,
    selected_beats:[],requires_independent_author_review:true,
    review_dimensions:rightsMode==='literary_review'?['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers']:undefined,
    local_source_sha256:skill.provenance.sha256};
   if(source&&!String(p.sourceURLs||'').split(/\s+/).includes(source))
    p.sourceURLs=[String(p.sourceURLs||'').trim(),source].filter(Boolean).join('\n');
   p.category=rightsMode==='literary_review'?(/诺奖/.test(p.category||'')?'诺奖文学导读':'世界文学导读'):'世界文学剧情改编';
   p.ideaSeed='【小说全文本地结构索引｜非大模型语义结论】章节 '+skill.provenance.chapter_count+' 段，来源SHA256 '+skill.provenance.sha256+'。主题词候选：'+(skill.cues.join('、')||'未提炼')+'。请依照 novel-skill.json 每章证据索引进行深度语义理解，不得凭词频杜撰原著剧情。';
   p.description=rightsMode==='literary_review'?
    '以真实作品为研究对象的九格原创导读：01–04讲清经核实的人物、主要事件、冲突、转折及结局；05–07依据具体作品证据探讨独立文学哲学解释；08–09通过原创当代普通人角色展示现实意义。原著文本来源锚点见小说索引，当前仅完成本地结构提取，未执行语义模型。':
    '以有权使用的小说为创作来源。依据原著全文章节索引与后续AI语义核验选择九格分镜。人物关系、具体桥段、时间线须按原文核实，未经核实不得假装为原书事实。';
   p.fiction=rightsMode==='literary_review'?'只做原创导读与独立评论，不逐幕复刻原著独特剧情、角色外观、长篇对白或插画。':(p.fiction||'严格依据授权作品的实际内容进行分镜改编。');
   p.disclosure=rightsMode==='literary_review'?'本漫画为原创文学导读与评论，不是原著剧情漫画化；文学解释属于编辑观点。':'依据有权使用作品改编；授权和出处仍需独立审核。';
   p.handoff={...(p.handoff||{}),mode:'hotspot'};
   // Build a genuine editable nine-slot research storyboard from source anchors.
   // These slots are editorial scaffolding, NOT a semantic model interpretation.
   if(typeof wtDirector?.ensure==='function'){
    const c=wtDirector.ensure(p);
    const entries=skill.chapter_index,theme=skill.themes;
    const proposed=rightsMode==='literary_review'?wtDirector.localStoryboard(p):
     Array.from({length:9},(_,i)=>{
      const ch=entries[Math.min(entries.length-1,Math.floor((i+.5)*entries.length/9))];
      return {title:'第'+String(i+1).padStart(2,'0')+'格 · '+ch.chapter_id+'资料核对',
       scene:'【授权改编资料卡｜语义尚未核验】先阅读并验证原著 '+ch.chapter_id+'（'+ch.title+'）的实际事件、人物和时间关系，再决定该镜头的真实画面。未审定前只绘原创编辑的书桌与章节证据卡，不冒充原著情节；不得自动编造人物动作和对白。',
       caption:'本格剧情需完成原著 '+ch.chapter_id+' 的内容核验后由编剧确认。',
       dialogue:'',prompt:'独立竖版3:4单镜头，先核对真实文本和版权授权；本格参考锚点 '+ch.locator+'；未经核验不准描绘具体书中事件。'};
     });
    for(let i=0;i<9;i++){
     const ch=entries[Math.min(entries.length-1,Math.floor((i+.5)*entries.length/9))];
     const cue=theme[i%Math.max(1,theme.length)]?.name||'主题待核验';
     const item=proposed[i];
     item.scene+='【原著索引锚点 '+ch.chapter_id+' · '+ch.locator+'；主题词统计候选 '+cue+'（非作品事实）】';
     item.prompt+=' 参考全书结构索引 '+ch.chapter_id+'，不能把关键词直接画成未经核实的剧情。';
     Object.assign(p.panels[i],item);
    }
    c.drafted=true;c.reviewed=false;c.approval=null;
    c.storyboardProvenance={method:'book_to_skill_local_structure',provider:'local',model:null,
     at:new Date().toISOString(),authorEdited:false,analysis:'依据全本章节来源索引填充九格可编辑创作脚手架；深度语义/情节尚未由AI核验。'};
    p.creativeDirection=c;
   }else if(p.creativeDirection){p.creativeDirection={...p.creativeDirection,approval:null,reviewed:false}}
   if(!persist())throw Error('项目存储失败，尚未安全应用本次蒸馏索引');
   setChange(p,'应用本地小说结构蒸馏索引（语义与版权仍待审核）');
   local.delete(id(p));
   if(typeof render==='function')render();
   notify('已生成带源文锚点的九格可编辑资料分镜；请先用 ChatGPT 深读原文并审核内容，不能直接把资料卡当成正式漫画');
  }catch(err){
   Object.assign(p,previous);
   if(keep)try{await delMedia(fileKey)}catch{}
   throw err;
  }
 }
 function copy(p){const msg=semanticPrompt(p);return copyText(msg)}
 async function clear(p){
  if(!p.novelSkill)return;
  if(p.handoff?.repoQueuedAt||p.handoff?.directTaskExportedAt)throw Error('已导出或入仓的任务不可删除来源索引');
  if(!confirm('移除当前作品的文学资料索引？已有分镜和其他创作内容会保留。'))return;
  const key=p.novelSkill.private_source_ref;
  delete p.novelSkill;
  if(p.creativeDirection){p.creativeDirection.approval=null;p.creativeDirection.reviewed=false}
  setChange(p,'移除小说蒸馏索引，需重新核对创意');
  if(key?.startsWith('media:')&&!data.projects.some(x=>x!==p&&x.novelSkill?.private_source_ref===key))try{await delMedia(key.slice(6))}catch{}
  render();notify('文学资料索引已移除');
 }
 document.addEventListener('change',ev=>{
  if(ev.target?.matches?.('[data-novel-file]')){analyze(ev.target);return}
  if(ev.target?.matches?.('[data-novel-rights]')){
   const key=liveSource(ev.target),a=local.get(key);if(a){const form=ev.target.closest('[data-novel-panel]');a.rightsMode=ev.target.value;a.sourceURL=form?.querySelector('[data-novel-source]')?.value?.trim()||'';a.shareAllowed=!!form?.querySelector('[data-novel-share]')?.checked;a.licensed=!!form?.querySelector('[data-novel-license]')?.checked;local.set(key,a)} 
   if(typeof render==='function')render();
   return;
  }
 },true);
 document.addEventListener('click',ev=>{
  const el=ev.target?.closest?.('[data-novel-action]');if(!el)return;
  ev.preventDefault();ev.stopImmediatePropagation();
  const p=typeof selected==='function'?selected():null,rootEl=el.closest('[data-novel-panel]');
  if(!p||!rootEl||id(p)!==rootEl.dataset.novelPanel)return;
  const action=el.dataset.novelAction;
  (action==='apply'?apply(p,rootEl):action==='clear'?clear(p):action==='copy'?copy(p):Promise.reject(Error('未知蒸馏操作')))
   ?.catch?.(err=>notify('文学漫绘：'+(err.message||err)));
 },true);
 root.WTNovelStudio={panel,semanticPrompt,_drafts:local};
})(typeof window!=='undefined'?window:globalThis);
