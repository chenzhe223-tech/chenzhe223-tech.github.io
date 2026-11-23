'use strict';
const WTLiterature = (() => {
 const methods=['人物选择或关系','叙述视角或信息差','语言意象或节奏','戏剧冲突或讽刺','散文思想或内心活动'];
 const questions=['谁或什么发生了怎样的变化，为什么值得关心？','哪一段换成另一部书也成立？如何辨认本书？','仅通过观察画面获得了什么理解？','哪一项解读由哪个具体细节支撑？','如果现在翻开原书，我会特别留意什么？'];
 const active=p=>p?.literaryWorkflowVersion===2 && ['faithful','literary_review'].includes(p.storySourceSelection?.adaptation);
 const note='先用章节、段落、目录、译者说明或研究出处核查一个具体入口和一个值得亲自阅读的发现。区分原作事实、编辑解释和原创演示。涉及译法注明版本；材料不足则缩小问题。任选一种讲法，自由分配篇幅。每格回应前格，动作体现变化，允许静默。现实类比须回到原书。';
 const schema={work:'',entry:'',discovery:'',initialReading:'',turningDetail:'',openQuestion:'',method:'',evidence:[{claim:'',source:'',locator:'',kind:'原作事实'}],panels:[{title:'',carry:'',gain:'',action:'',visible:'',change:'',caption:'',speaker:'',dialogue:'',next:'',evidence:[1]}]};
 function initialize(p){
  if(!active(p))return;
  delete p.storySourceSelection.review_dimensions;
  p.literaryReviewGuide={schema:'davylab.worldtoon.literary-review.v2',source_status:'pending_research'};
  if(p.storySourceSelection.adaptation==='literary_review'){
   p.description='围绕《'+(p.storySourceSelection.title||p.sourceTitle||p.title)+'》的一项可定位文本发现组织全篇。';
   p.ideaSeed=p.description;p.fiction='原创导读人物和演示，情节事实与解释分开标注。';
  }
 }
 function binding(p,stage){return JSON.stringify([p.literaryDraft,p.panels.map(x=>[x.scene,x.caption,x.dialogue,x.prompt]),...(stage==='成品'?[p.cover,p.panels.map(x=>x.image)]:[])])}
 function passed(p,stage){const r=p.literaryReports?.filter(v=>v.stage===stage).at(-1);return r?.status==='通过'&&r.binding===binding(p,stage)&&verifyReport(r,p.panels.length)}
 function packet(p){
  return {work:p.sourceTitle||p.title,panel_count:p.panels.length,rights:p.storySourceSelection.adaptation,source_leads:p.sourceURLs,notes:p.factNotes,chapter_index:p.novelSkill?.chapter_index?.map(x=>({title:x.title,locator:x.locator})),cast:p.creativeDirection?.cast?.map(x=>x.name),instructions:note+' 先完成编辑稿再写台词。资料仅能支持梗概就缩小范围；不要将原创演示写成原作事件。现实类比须在末尾返回具体文本。小说可用人物代价或视角反转，诗歌可用反复意象或断句，散文可跟随一次判断的修正。每格只保留一个重心，用具体动作表达发现，机位的改变须服务于阅读。第一格建立具体悬念，旁白补背景，对白必须有说话对象和当场动机，可由动作承接下一格。输出一个符合下列结构的 JSON，work 原样填写。每格 evidence 填写对应依据编号，从 1 起。caption、speaker、dialogue 可留空；内部备注不得排字。',methods,evidence_kinds:['原作事实','编辑解读','原创演示'],schema,reader_checks:questions,script_report:report('脚本','Agent自检'),report_instructions:'审读完整脚本后另交脚本报告，每项填独立回答与格号。各维度判为通过或需返工；脚本阶段视觉可填待成图。排版后依据最终作品重新作答。'};
 }
 const requireText=(o,keys,label)=>{for(const k of keys)if(typeof o?.[k]!=='string'||!o[k].trim())throw Error(label+'缺少 '+k)};
 function validate(p,b){
  requireText(b,['work','entry','discovery','initialReading','turningDetail','openQuestion'],'研究稿');
  if(b.work!==(p.sourceTitle||p.title)||!methods.includes(b.method))throw Error('书名或主讲法不匹配');
  if(!Array.isArray(b.evidence)||!b.evidence.some(v=>v?.kind==='原作事实'))throw Error('需要有定位出处的原作事实');
  for(const v of b.evidence){requireText(v,['claim','source','locator'],'依据');if(!packet(p).evidence_kinds.includes(v.kind))throw Error('依据类别无效')}
  if(!Array.isArray(b.panels)||b.panels.length!==p.panels.length)throw Error('篇幅与任务不一致');
  for(const [i,v] of b.panels.entries()){
   requireText(v,['title','carry','gain','action','visible','change','next'],'第'+(i+1)+'格');
   for(const k of ['caption','speaker','dialogue'])if(typeof v[k]!=='string')throw Error('缺少文字字段 '+k);
   if(v.dialogue.trim())requireText(v,['speaker'],'对白');
   if(!Array.isArray(v.evidence)||!v.evidence.length||v.evidence.some(n=>!Number.isInteger(n)||!b.evidence[n-1]))throw Error('画格依据编号无效');
  }
 }
 function row(v){return {title:v.title,scene:v.action,caption:v.caption,dialogue:v.dialogue?v.speaker+'：'+v.dialogue:'',prompt:v.visible+'；'+v.change}}
 function checks(p){
  try{validate(p,p.literaryDraft);if(p.literaryDraft.panels.some((v,i)=>Object.entries(row(v)).some(([k,s])=>s!==p.panels[i][k])))return ['分镜已修改，请同步文学编辑稿并重新核对'];return []}catch(err){return [err.message]}
 }
 function report(stage,reviewer){return {stage,reviewer,status:'待审',dimensions:{文学理解:'待审',阅读连贯性:'待审',视觉质量:'待审'},answers:questions.map(question=>({question,answer:'',panels:[]}))}}
 function verifyReport(r,n){
  if(!['Agent自检','真人试读'].includes(r?.reviewer)||!['脚本','成品'].includes(r.stage))throw Error('审读类型无效');
  if(r.answers?.length!==5||r.answers.some((a,i)=>a.question!==questions[i]||!a.answer?.trim()||!Array.isArray(a.panels)||!a.panels.length||a.panels.some(k=>!Number.isInteger(k)||k<1||k>n)))throw Error('五项审读均须实际回答并标注格号');
  if(['文学理解','阅读连贯性','视觉质量'].some(k=>!['通过','需返工',...(k==='视觉质量'&&r.stage==='脚本'?['待成图']:[])].includes(r.dimensions?.[k])))throw Error('需分别评价理解、连贯性与视觉');
  return !Object.values(r.dimensions).includes('需返工');
 }
 function editor(p){
  if(!active(p))return '';
  return '<details class="box"><summary>文学编辑稿与读者验收</summary><p>复制研究任务给制作 Agent，核对出处后粘贴返回的编辑稿。脚本自检通过后即可定版。</p><button type="button" data-lit-file="research">下载本书研究任务</button><textarea readonly>'+e(JSON.stringify(packet(p),null,2))+'</textarea><label>载入 Agent 的编辑稿文件<input type="file" accept=".json,application/json" data-lit-input="draft"></label><label>文学编辑稿 JSON<textarea id="literary-draft">'+e(JSON.stringify(p.literaryDraft||schema,null,2))+'</textarea></label><button type="button" data-lit-save="draft">应用编辑稿和分镜</button><label>载入审读报告文件<input type="file" accept=".json,application/json" data-lit-input="report"></label><label>审读报告 JSON<textarea id="literary-report">'+e(JSON.stringify(p.literaryReports?.at(-1)||report('脚本','Agent自检'),null,2))+'</textarea></label><button type="button" data-lit-save="report">记录审读报告</button><button type="button" data-lit-file="report">导出本版验收报告</button></details>';
 }
 function save(kind,p){
  if(!active(p)||p.publishedAt||p.status==='已发布'||p.archived)throw Error('当前作品不可修改');
  const v=JSON.parse(document.querySelector('#literary-'+kind).value);
  if(kind==='draft'){
   if(p.handoff?.repoQueuedAt||p.creativeDirection?.approval)throw Error('已锁定的任务须建立修订版');
   validate(p,v);
   if(p.panels.some(x=>x.scene)&&!confirm('替换当前文学分镜与审读记录？'))return;
   const c=wtDirector.ensure(p);
   p.panels.forEach((x,i)=>Object.assign(x,row(v.panels[i])));
   p.literaryDraft=v;p.literaryReports=[];p.description=v.discovery;c.thesis=v.discovery;c.drafted=true;c.reviewed=false;c.approval=null;
   c.storyboardProvenance={method:'literary_editorial_v2',analysis:v.discovery,at:new Date().toISOString()};
  }else{
   if(checks(p).length)throw Error('先完成并同步文学编辑稿');
   v.binding=binding(p,v.stage);v.status=verifyReport(v,p.panels.length)?'通过':'需返工';
   if(v.stage==='成品'&&(!p.cover||p.panels.some(x=>!x.image)))throw Error('请先导入完整成图');
   (p.literaryReports??=[]).push(v);
  }
  setChange(p,'更新文学'+(kind==='draft'?'分镜':'审读'));render();
 }
 function download(kind,p){
  const content=kind==='research'?packet(p):{work:p.sourceTitle||p.title,reports:(p.literaryReports||[]).map(({binding,...r})=>r),script_passed:passed(p,'脚本'),final_passed:passed(p,'成品')};
  const url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=kind==='research'?'literary-research-task.json':'literary-QA.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(typeof document!=='undefined')document.addEventListener('change',async ev=>{
  const field=ev.target.dataset?.litInput,file=ev.target.files?.[0];if(!field||!file)return;
  const input=ev.target.closest('details').querySelector('#literary-'+field);
  try{const parsed=JSON.parse(await file.text());input.value=JSON.stringify(parsed,null,2)}catch{notify('请载入有效的 JSON 文件')}
 });
 if(typeof document!=='undefined')document.addEventListener('click',ev=>{const file=ev.target.closest('[data-lit-file]')?.dataset.litFile;if(file)download(file,selected());const k=ev.target.closest('[data-lit-save]')?.dataset.litSave;if(k)try{save(k,selected())}catch(err){notify(err.message)}});
 return {initialize,passed,active,editor,checks,packet,note,row,validate,report,verifyReport};
})();
