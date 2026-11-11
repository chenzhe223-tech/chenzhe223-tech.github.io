/* WORLD/TOON Creative Director: human-approved production design before ChatGPT dispatch.
 * CSS swatches and wireframe thumbnails are illustrative, NOT generated artwork.
 * No model is invoked and no publication approval is granted.
 */
'use strict';
(function(){
const LEGACY_STYLES=[
 {id:'editorial',name:'杂志墨线',subtitle:'高端商业与社会寓言',palette:['#f0e7d8','#312c27','#c26943','#809387'],
  material:'暖纸纹理、手绘墨线、适度写实',lighting:'柔和侧光、纸张留白',layout:'电影式景别切换、清晰主体',negative:'霓虹紫蓝、光滑塑料、假3D、拥挤文字'},
 {id:'warm',name:'温暖绘本',subtitle:'人物成长与生活观察',palette:['#f5e3cc','#526456','#dd9f6e','#bccec0'],
  material:'彩铅与水彩叠染、自然纸纹',lighting:'金色日光、舒缓漫反射',layout:'轻盈童趣、情绪特写',negative:'塑胶皮肤、刺眼高饱和、机械阴影'},
 {id:'woodcut',name:'复古版画',subtitle:'历史、经典与人物传记',palette:['#e9dbbe','#40392f','#a36340','#857d69'],
  material:'木刻细纹、复古蚀刻、胶印颗粒',lighting:'戏剧性明暗、老照片质感',layout:'历史器物可信、广角环境建立',negative:'现代服饰穿帮、未经证实的历史还原'},
 {id:'cinematic',name:'电影分镜',subtitle:'悬疑、战争纪实与戏剧',palette:['#d5d2c9','#25343c','#bd7d56','#687e84'],
  material:'手绘电影分镜、精密明暗层次',lighting:'受控逆光、明暗聚焦',layout:'大远景交代、剪接与反打',negative:'无依据的战争暴力细节、面部漂移'},
 {id:'diagram',name:'科学图解',subtitle:'科普、机器人与 AI 研究',palette:['#f1efe7','#314f4e','#d3a357','#789f99'],
  material:'精确线稿、纸面信息设计、温和科技感',lighting:'均匀清晰、局部强调',layout:'结构拆解、图解结合剧情',negative:'虚构科研数据、伪造实验结果、花哨光效'},
 {id:'comic',name:'手绘轻喜剧',subtitle:'反转、人间百态与讽刺',palette:['#faf0e0','#283d37','#e58d5a','#a3b598'],
  material:'动画感笔触、简练线条与平涂',lighting:'明快干净、温暖投影',layout:'强烈表情、动感镜头与节奏点',negative:'表情失控、手部畸形、人物五官不一致'}
];
const STYLES=[...window.WTStyleV3.STYLES,...LEGACY_STYLES];
const ARCS=[
 {id:'twist',name:'反转寓言',detail:'矛盾升级 → 重构认知 → 余味'},
 {id:'journey',name:'人物成长',detail:'欲望 → 挫折 → 改变'},
 {id:'mystery',name:'悬疑探寻',detail:'疑点 → 证据 → 新理解'},
 {id:'explain',name:'知识解说',detail:'提出问题 → 类比拆解 → 应用'},
 {id:'chronicle',name:'历史纪事',detail:'时代背景 → 抉择 → 后果'}
];
const SHOTS=['远景交代','中景人物','近景细节','对肩镜头','俯视关系','反打冲突','特写线索','低角度转折','远景余韵'];
const BEATS={
 twist:['惊人的传闻','角色的追问','互相矛盾的答案','第一道阻力','看似合理的解释','代价开始浮现','细节揭示另一面','思维翻转的时刻','留给读者的问题'],
 journey:['渴望的东西','迈出第一步','遭遇阻力','关系出现变化','尝试新的方案','付出代价','找到同伴','做出真正选择','走向新的自己'],
 mystery:['突发线索','不合常理的细节','第一条路径','证据出现裂痕','人物意见分裂','追寻关键原因','被忽略的细节','谜底的重构','谨慎的结论'],
 explain:['提出一个问题','认识关键概念','用角色讲解机制','出现错误理解','第一层解释','看见具体例子','比较不同方案','形成解决路径','现实应用与局限'],
 chronicle:['确立时代与地点','交代人物处境','重要事件出现','不同立场交锋','历史背景补充','关键抉择','转折的影响','后来发生了什么','史料与留白']
};
const TITLES=['开场','铺垫','冲突','加压','转折','代价','反击','高潮','余韵'];
let step=0,lastProjectId='';
const pendingAuto=new Set();
let storyBusy=false,storyProvider='native',storyApiKey='',storyModel='';
const providerModels={deepseek:'deepseek-chat',openai:'gpt-4o-mini'};

const clean=s=>String(s??'').replace(/[\u0000-\u001f]/g,' ').trim();
const style=id=>STYLES.find(x=>x.id===id)||STYLES[0];
const arc=id=>ARCS.find(x=>x.id===id)||ARCS[0];
function defaultCast(category){
 const history=/历史|文化|经典|军事|宗教/.test(category||''),science=/AI|科学|机器人|科普|航空/.test(category||'');
 return [
  {role:'主要人物',name:history?'阿衡':science?'黎舟':'简宁',look:history?'黑发束起、沉静眉眼、青年史官比例':science?'短黑发、圆框眼镜、略瘦的青年研究员':'深棕短发、清晰眉形、成年人比例',clothes:history?'烟青色长袍、布质腰带':science?'浅色实验外套、青灰色内搭':'墨绿色外套、米白色衬衫',symbol:history?'棕色手札':science?'银灰平板':'随身记事本',nature:'谨慎、愿意验证信息'},
  {role:'搭档',name:history?'小砚':science?'星点':'阿谷',look:history?'灰发束带、较矮身形、温和表情':science?'原创奶油色圆头小机器人、橙色显示屏、细银色关节':'栗色卷发、圆眼、比主角稍矮',clothes:history?'棕黄色粗布衣裳':science?'橙白配色机体、无衣服':'浅沙色衬衣与青绿围巾',symbol:history?'竹简':science?'方形胸前灯':'米色帆布袋',nature:'好奇、喜欢追问'}
 ];
}
function ensure(p){
 if(!p) return null;
 if(p.creativeDirection?.version===1)return p.creativeDirection;
 const c={version:1,quality:'Premium',styleId:/历史|经典|宗教|军事/.test(p.category||'')?'chinese-historical-epic':/AI|科学|机器人/.test(p.category||'')?'futuristic-sci-fi':'western-cinematic',
  arcId:/历史|经典/.test(p.category||'')?'chronicle':/科学|AI|机器人/.test(p.category||'')?'explain':'twist',
  thesis:clean(p.description)||'从公开议题出发，通过原创人物讲出冲突、选择与结果。',
  world:/历史|经典/.test(p.category||'')?'取材于时代背景但不虚构史实结论的架空城镇':'与现实新闻不对应的架空城市',
  emotion:'有趣、清楚、克制、有余味',cover:'简洁的大标题留白、完整原创人物、故事核心象征物、统一系列标识 By DAVYLAB',
  cast:defaultCast(p.category),drafted:false,reviewed:false,approval:null};
 p.creativeDirection=c;persist();return c;
}
function shotOf(i){return SHOTS[i]||'中景人物'}
function localStoryboard(p){
 const c=ensure(p),subject=clean(p.sourceTitle||p.title).replace(/：漫画改编$/,'').slice(0,95);
 const a=clean(c.cast?.[0]?.name)||'主人公',b=clean(c.cast?.[1]?.name)||'搭档';
 const time=/时间机器|time machine|时空|穿越/i.test(subject);
 const object=time?'一台刻有同心圆刻度的铜制时间机器':/经典|文学|历史/.test(p.category||'')?'泛黄的手稿与一张重要的旧地图':'一份记录着矛盾证词的公开档案';
 const conflict=clean(p.description||c.thesis).slice(0,115);
 const beats=BEATS[c.arcId]||BEATS.twist;
 const stages=[
  ['建立悬念',a+'在'+c.world+'发现'+object+'，'+b+'注意到它与「'+subject+'」有关，但两人的判断并不相同。','谁都以为这只是一件不起眼的小事。',a+'：如果它真能改变结果呢？'],
  ['人物抉择',b+'伸手阻止'+a+'启动'+object+'，镜头切至两人截然不同的神色；桌上摊开与主题相关的线索，观众看到第一次利益冲突。','每一次选择，都有不愿承担的代价。',b+'：你确定我们理解它的意义吗？'],
  ['首次尝试',a+'按下装置／展开档案，屋内的细节出现可见变化，'+b+'从地面拾起一件之前没人留意的证物。画面以近景强调动作因果。','他们选择了最容易相信的解释。',a+'：线索就在眼前。'],
  ['新的阻力',a+'与'+b+'来到充满对立意见的公共场景，周围的人纷纷指向同一方向；前景的一处微小反常细节却与众人的结论冲突。','答案似乎近在咫尺，疑问却更多了。',b+'：所有人都这么说，就一定对吗？'],
  ['谬误放大',a+'沿着错误的判断继续推进，场景中的'+object+'投下夸张的影子，'+b+'努力试图指出被忽略的证据。双方动作与前格衔接。','一个看似合理的答案，遮住了更重要的真相。',a+'：这不是我们想看到的吗？'],
  ['代价显现',b+'把原先隐藏的事实摊在'+a+'面前，两人身后的环境呈现行为造成的影响；镜头压低，突出沉默和后果。','当代价出现时，谎言已经难以收回。',b+'：你还愿意承担这个结果吗？'],
  ['线索反转',a+'忽然回头，发现一直被忽略的'+object+'有一处细节足以推翻此前判断；特写聚焦手指、证据和瞳孔的变化。','真正的线索，其实从一开始就在那里。',a+'：等等，我们是不是看错了？'],
  ['因果揭示',a+'与'+b+'重新回到最初的场景，以反向构图复现开场；他们发现问题不是“谁拥有答案”，而是“谁承担选择”，用具体动作完成转折。','改变事情的不是工具，而是人的责任。',b+'：原来需要改变的，是我们的选择。'],
  ['余韵收束',a+'没有再争辩，而是将'+object+'郑重放在两人之间；远景显现新一天的环境。留下一个与开场对照的视觉象征，让观众自己得出结论。','所有故事都会结束，但选择仍会继续。',a+'：下一次，我们会怎样做？']
 ];
 return stages.map((row,i)=>({title:(c.arcId==='twist'?beats[i]:row[0]).slice(0,100),
  scene:'【'+shotOf(i)+'】'+row[1]+' 固定'+a+'、'+b+'的服装、脸型与识别道具。题材背景：'+conflict+'。',
  caption:row[2],dialogue:row[3],prompt:'专业完成级漫画分镜，人物外貌连续、空间轴线明确；'+shotOf(i)+'；'+style(c.styleId).material+'，'+style(c.styleId).lighting}));
}
function applyStoryboard(p,panels,meta,replace=false){
 if(p.handoff?.repoQueuedAt)throw Error('该版本已正式派单，不能修改既有故事');
 if(!Array.isArray(panels)||panels.length!==9||!Array.isArray(p.panels)||p.panels.length!==9)throw Error('需要恰好九格内容');
 const existing=p.panels.some(x=>clean(x.scene)||clean(x.caption)||clean(x.dialogue));
 if(replace===true&&existing&&!confirm('这会替换你当前九格中的文字与分镜，但保留已上传图片。确认覆盖？'))return false;
 const fields=['title','scene','caption','dialogue','prompt'];
 let updated=0;
 for(let i=0;i<9;i++){
  for(const field of fields){
   const cur=p.panels[i][field];
   if(!replace&&clean(cur)&&!(field==='title'&&/^第 ?[1-9] 格$/.test(cur)))continue;
   const value=clean(panels[i]?.[field]).slice(0,field==='title'?100:field==='scene'?1700:field==='prompt'?1200:550);
   if(value){p.panels[i][field]=value;updated++}
  }
 }
 const c=ensure(p);
 c.drafted=true;c.reviewed=false;c.approval=null;
 c.storyboardProvenance={method:meta.method||'local_structure_rules',provider:meta.provider||'local',
  model:meta.model||null,at:new Date().toISOString(),analysis:clean(meta.analysis||'').slice(0,600),
  fields_updated:updated,author_reviewed:false};
 if(!clean(p.fiction))p.fiction='原创独立角色与架空地点；来源事实与虚构对白独立标注。';
 p.characters=castText(c);
 markDirty(p);setChange(p,meta.method==='verified_model_response'?'AI生成九格可编辑脚本（仍需人工复审）':'本地剧情规则生成九格草稿（非大模型输出）');
 step=2;render();
 return true;
}
function draft(p,replace=true){
 const ok=applyStoryboard(p,localStoryboard(p),{method:'local_structure_rules',provider:'local',analysis:'本地结构化分镜建议，尚未经大模型分析'},replace);
 if(ok)notify('已填写九格本地规则草稿；这不是 AI 模型输出，可继续逐格编辑');
 return ok;
}
function aiStoryPayload(p,provider){
 const c=ensure(p),st=style(c.styleId);
 return {provider,model:providerModels[provider]||'',apiKey:provider==='native'?'':storyApiKey,
  title:p.sourceTitle||p.title,summary:p.description||c.thesis,category:p.category,
  arc:arc(c.arcId).name,thesis:c.thesis,world:c.world,emotion:c.emotion,fiction:p.fiction,
  style:st.name,styleRules:[st.material,st.lighting,st.layout,st.negative].join('；'),
  cast:c.cast,episodes:Array.isArray(p.seriesEpisodes)?p.seriesEpisodes:[]};
}
async function generateStory(p,{provider='native',auto=false,replace=false}={}){
 if(storyBusy||p.handoff?.repoQueuedAt)return;
 const empty=p.panels.every(x=>!clean(x.scene)&&!clean(x.caption)&&!clean(x.dialogue));
 if(auto&&!empty)return;
 if(auto&&(!wtSession?.access_token||!wtConfig?.storyboardAiEnabled)){
  draft(p,false);return;
 }
 if(provider!=='native'){
  if(!storyApiKey.trim()){notify('请输入 '+(provider==='deepseek'?'DeepSeek':'OpenAI')+' API Key，仅用于本次请求');return}
  if(!auto&&!confirm('将使用你提供的第三方模型 API。供应商可能按使用量收费；确认本次调用？'))return;
 }
 if(!auto&&replace&&p.panels.some(x=>clean(x.scene))){
  if(!confirm('将用新剧本替换当前文字与分镜；不会删除已有的漫画图片。确定继续？'))return;
 }
 storyBusy=true;render();
 try{
  if(typeof wtCallAI!=='function')throw Error('模型请求组件未载入');
  const basis=digest(p);
  const result=await wtCallAI('/api/ai/storyboard',aiStoryPayload(p,provider));
  if(result?.method!=='verified_model_response'||!Array.isArray(result.panels)||result.panels.length!==9)throw Error('没有收到九格完整的模型生成结果');
  if(selected()?.id!==p.id||p.handoff?.repoQueuedAt)throw Error('当前作品已切换或已派单，原始草稿未被覆盖');
  if(digest(p)!==basis)throw Error('生成期间作品内容有改动，AI结果未覆盖你的修改');
  const wrote=applyStoryboard(p,result.panels,result,replace?'approved':false);
  if(wrote)notify('已使用 '+(provider==='native'?'平台内置AI':provider==='deepseek'?'DeepSeek':'OpenAI')+' 生成可编辑九格草稿，请人工确认');
 }catch(err){
  if(auto&&selected()?.id===p.id&&!p.panels.some(x=>clean(x.scene))){
   draft(p,false);notify('内置模型暂不可用，已退回本地规则草稿（非AI模型输出）');
  }else notify('AI九格生成失败：'+String(err?.message||err).slice(0,110));
 }finally{storyBusy=false;render()}
}
function scheduleAutoStoryboard(p){
 if(!p||p.handoff?.repoQueuedAt||!Array.isArray(p.panels)||p.panels.length!==9||
    p.panels.some(x=>clean(x.scene)||clean(x.dialogue)||clean(x.caption))||pendingAuto.has(p.id))return;
 pendingAuto.add(p.id);
 queueMicrotask(()=>{if(selected()?.id===p.id&&step===2)generateStory(p,{auto:true,provider:'native'});});
}
function castText(c){return c.cast.map((x,i)=>[i+1+'. '+x.role+'：'+x.name,'外貌与比例：'+x.look,'固定服饰：'+x.clothes,'识别道具：'+x.symbol,'性格：'+x.nature].join('；')).join('\n')}
function payload(p){
 const c=ensure(p),s=style(c.styleId);
 return {
  version:3,style_catalog_version:'3.0.0',quality_target:c.quality||'Premium',model_capability:'unverified',style_id:s.id,style_name:s.name,visual_rules:{palette:s.palette,material:s.material,lighting:s.lighting,layout:s.layout,negative:s.negative,ratio:'3:4',size:'1080x1440',lettering:'先生成无文字画面，准确中文另行排版'},
  narrative:{arc_id:c.arcId,arc_name:arc(c.arcId).name,story_thesis:clean(c.thesis),world:clean(c.world),emotion:clean(c.emotion),summary:clean(p.description),fictionalization:clean(p.fiction)},
  characters:c.cast.map(x=>({role:clean(x.role),name:clean(x.name),look:clean(x.look),clothes:clean(x.clothes),symbol:clean(x.symbol),nature:clean(x.nature)})),
  storyboard:(p.panels||[]).map((x,i)=>({index:i+1,title:clean(x.title),shot:shotOf(i),scene:clean(x.scene),caption:clean(x.caption),dialogue:clean(x.dialogue),custom_prompt:clean(x.prompt)})),
  cover_brief:clean(c.cover),
  visual_references:(p.visualReferences||[]).slice(0,24).map(x=>({id:x.id,title:x.title,source:x.source,source_url:x.source_url,license:x.license,role:'visual_reference_only'}))
 };
}
function digest(p){
 // FNV-1a change indicator; not a signature. GitHub commit provides the immutable official task record.
 let str=JSON.stringify({title:clean(p.title),subject:clean(p.sourceTitle),data:payload(p)}),h=2166136261;
 for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16).padStart(8,'0');
}
function checks(p){
 if(!p)return ['未选择作品'];
 const c=ensure(p),errs=[];
 if(clean(c.thesis).length<12)errs.push('故事主旨至少12字');
 if(clean(c.world).length<8)errs.push('故事发生的世界和地点至少8字');
 if(clean(c.cover).length<12)errs.push('封面视觉方案至少12字');
 if(!STYLES.some(s=>s.id===c.styleId))errs.push('选择固定画风');
 if(!ARCS.some(s=>s.id===c.arcId))errs.push('选择剧情结构');
 if(!Array.isArray(c.cast)||c.cast.length<2)errs.push('至少锁定两名原创角色');
 if(c.cast?.some(x=>clean(x.name).length<2||clean(x.look).length<8||clean(x.clothes).length<6||clean(x.symbol).length<2))errs.push('角色姓名、外貌、服饰和识别特征必须完整');
 if(new Set((c.cast||[]).map(x=>clean(x.name))).size!==(c.cast||[]).length)errs.push('角色姓名不能重复');
 if(!Array.isArray(p.panels)||p.panels.length!==9)errs.push('必须恰好九格分镜');
 else for(let i=0;i<9;i++){const x=p.panels[i];if(clean(x.scene).length<30||clean(x.title).length<2||(!clean(x.caption)&&!clean(x.dialogue)))errs.push('第'+(i+1)+'格缺少完整场景、标题或文字')}
 if((p.visualReferences||[]).some(x=>x.license!=='CC0'))errs.push('视觉参考包含未确认 CC0 的馆藏');
 if(!c.drafted)errs.push('先生成并逐格审阅九格分镜');
 if(!c.reviewed)errs.push('请勾选“已逐格审阅并确认创意方向”');
 return errs;
}
function approved(p){const c=p?.creativeDirection;return !!(c?.approval?.lock_hash&&c.approval.lock_hash===digest(p)&&c.approval.author_approved===true&&checks(p).length===0)}
function readiness(p){const missing=checks(p);if(!missing.length&&!approved(p))missing.push('请在导演台点击“确认并锁定制作方案”');return missing}
function exportBrief(p){
 if(!approved(p))throw Error('创作方案尚未锁定，禁止派单');
 const c=p.creativeDirection;
 return {...payload(p),style_lock:{schema:'davylab.worldtoon.style-lock.v3',style_id:c.styleId,style_version:'3.0.0',quality_target:c.quality||'Premium',aspect_ratio:'3:4',resolution:[1080,1440],render_pipeline:'same_model_preview_and_final_required',model_id:null,model_version:null,preview_sha256:null,character_reference_sha256:null,original_first_panel_required:true,production_status:'awaiting_real_pilot'},lock_status:'approved',approval:{lock_hash:c.approval.lock_hash,approved_at:c.approval.approved_at,author_approved:true,approval_scope:'style_cast_storyboard',note:'锁定创意设定不等于事实核验或正式发表批准'},
 production_gates:{pilot_required:true,pilot_artifacts:['character-sheet.png','pilot-01.png'],pilot_approval_required:true,
  full_run_panel_count:9,independent_cover:true,character_continuity:true,original_preview_is_panel_01:true,preview_sha256_equals_final_panel_01:true,min_resolution:[1080,1440],reject_svg_and_placeholder:true,source_verification_before_fact_claims:true,
  instructions:'先交付角色设定图与首格样稿由作者审阅；未获作者确认不得批量生成剩余画格或宣布完成。'}};
}
function commitEdit(p,label){const c=ensure(p);if(p.handoff?.repoQueuedAt)throw Error('此版本已正式入仓。请先复制为新版作品，再修改和派单');c.approval=null;c.reviewed=false;markDirty(p);setChange(p,label)}
function approve(p){
 const errors=checks(p);
 if(errors.length)throw Error('暂无法定稿：'+errors.slice(0,3).join('；')+(errors.length>3?' 等'+errors.length+'项':''));
 if(p.handoff?.repoQueuedAt)throw Error('本版本已经正式派单，不可再次锁定覆盖');
 if(!confirm('确认画风、两名角色、故事主旨和九格分镜都是最终制作依据？锁定后任何修改都需要重新确认。'))return;
 const c=ensure(p);c.approval={lock_hash:digest(p),approved_at:new Date().toISOString(),author_approved:true};
 setChange(p,'作者锁定创作导演方案（不代表对事实和出版的审核）');render();notify('创意定稿已锁定；可以创建 ChatGPT 制作任务');
}
function field(k,label,value,min=0,kind='textarea'){
 const val=clean(value);
 if(kind==='input')return '<label class="director-field">'+label+'<input data-director-field="'+k+'" maxlength="350" value="'+e(val)+'"></label>';
 return '<label class="director-field">'+label+'<textarea data-director-field="'+k+'" rows="3" maxlength="1600">'+e(val)+'</textarea></label>';
}
function styleCards(c){return window.WTStyleV3.cards(c)}
function stylePreview(c){return window.WTStyleV3.detail(c)}
function narrative(p,c){
 return '<div class="director-arcs">'+ARCS.map(x=>'<button type="button" data-director-arc="'+x.id+'" class="'+(c.arcId===x.id?'selected':'')+'"><strong>'+e(x.name)+'</strong><small>'+e(x.detail)+'</small></button>').join('')+'</div>'+
 '<div class="director-fields">'+field('thesis','故事一句话 · 核心表达',c.thesis)+field('world','人物所在世界与场景规则',c.world)+field('emotion','情绪与阅读节奏',c.emotion,'','input')+field('cover','独立封面视觉指令',c.cover)+'</div>';
}
function castEditor(c){
 return '<div class="director-cast">'+c.cast.map((person,i)=>'<article class="director-character"><div class="director-character-head"><span>0'+(i+1)+'</span><strong>'+e(person.role)+'</strong></div>'+
 '<div class="director-character-avatar director-theme-'+style(c.styleId).id+'"><i></i><b></b><small>角色版式示意 · 非定妆照</small></div>'+
 '<div class="director-character-fields">'+['name','look','clothes','symbol','nature'].map((key,j)=>
 '<label>'+['角色姓名','固定容貌、发型与体型','每格不变的服装','可识别道具或标记','性格与行为'][j]+
 (key==='look'||key==='clothes'?'<textarea rows="2"':'<input type="text"')+' data-director-cast="'+key+'" data-character-index="'+i+'" maxlength="500"'+(key==='look'||key==='clothes'?'>'+e(person[key])+'</textarea>':' value="'+e(person[key])+'">')+'</label>').join('')+
 '</div></article>').join('')+'</div>';
}
function framePreview(p,c){
 const rows=(p.panels||[]).map((x,i)=>'<article class="director-panel"><div class="director-panel-frame">'+
 '<span>0'+(i+1)+' / 09</span><strong>'+e(shotOf(i))+'</strong><div class="director-panel-art"><i></i><b></b></div></div>'+
 '<div class="director-panel-edit"><label>画格主题<input data-director-panel="title" data-panel-index="'+i+'" value="'+e(x.title)+'" maxlength="100"></label>'+
 '<label>镜头与画面<textarea rows="3" data-director-panel="scene" data-panel-index="'+i+'" maxlength="1700">'+e(x.scene)+'</textarea></label>'+
 '<label>旁白<textarea rows="2" data-director-panel="caption" data-panel-index="'+i+'" maxlength="550">'+e(x.caption)+'</textarea></label>'+
 '<label>对白<textarea rows="2" data-director-panel="dialogue" data-panel-index="'+i+'" maxlength="550">'+e(x.dialogue)+'</textarea></label></div></article>').join('');
 return '<div class="director-board-info"><strong>'+e(arc(c.arcId).name)+' · 九格镜头表</strong><span>仅为镜头/文字预演，不是 AI 生成的最终图片</span></div>'+
 '<div class="director-board">'+rows+'</div>';
}
function storyControls(p,c){
 const info=c.storyboardProvenance;
 const origin=info?.method==='verified_model_response'?'AI生成 · '+(info.provider==='native'?'平台内置模型':info.provider==='deepseek'?'DeepSeek API':'OpenAI API')+(info.model?' · '+info.model:''):
    info?.method==='local_structure_rules'?'本地剧情分析规则 · 非AI模型输出':'尚未生成 · 将优先使用内置AI';
 const providerLabel=storyProvider==='deepseek'?'DeepSeek':storyProvider==='openai'?'OpenAI':'内置AI';
 return '<div class="director-ai-workflow" role="group" aria-label="九格剧本智能生成">'+
 '<div class="director-ai-head"><div><strong>自动编剧 · 九格完整分镜</strong><span>默认自动分析选题、人物与画风；模型结果和人工编辑都写入当前作品。</span></div>'+
 '<span class="director-ai-status">'+e(storyBusy?'生成中 · 请勿重复提交':origin)+'</span></div>'+
 '<div class="director-ai-grid"><label>生成方式<select data-director-provider>'+
 '<option value="native"'+(storyProvider==='native'?' selected':'')+'>内置AI · 已登录优先自动生成</option>'+
 '<option value="deepseek"'+(storyProvider==='deepseek'?' selected':'')+'>DeepSeek API · 自带密钥</option>'+
 '<option value="openai"'+(storyProvider==='openai'?' selected':'')+'>OpenAI API · 自带密钥</option></select></label>'+
 (storyProvider!=='native'?'<label>API Key · 本次网页会话使用，不保存到项目<input data-director-api-key type="password" autocomplete="off" spellcheck="false" placeholder="'+e(providerLabel)+' API Key" value="'+e(storyApiKey)+'"></label>':'<div class="director-ai-guide"><b>自动填充规则</b><span>仅在九格仍为空白时自动生成；若模型不可用，会明确回退本地规则草稿。</span></div>')+'</div>'+
 '<div class="director-ai-actions"><button type="button" class="button dark" data-director-action="ai"'+(storyBusy?' disabled':'')+'> '+(storyBusy?'正在生成…':'使用'+e(providerLabel)+'智能生成九格')+'</button>'+
 '<button type="button" class="button" data-director-action="fill"'+(storyBusy?' disabled':'')+'>仅填补空白字段</button>'+
 '<button type="button" class="button subtle" data-director-action="draft"'+(storyBusy?' disabled':'')+'>本地规则草稿</button></div>'+
 '<p class="director-ai-foot">AI草稿不等于事实核验或正式完成。内置模型使用已有平台配额；第三方API仅在你点击生成并确认后调用，可能产生费用。文字可逐格修改，最终需作者审阅锁定。</p>'+
 '</div>';
}
function review(p,c){
 const errs=checks(p),locked=approved(p),count=p.panels.filter(x=>clean(x.scene).length>=30).length;
 return '<div class="director-review"><section class="director-review-summary"><h3>本次制作定版</h3><div class="director-review-kpis"><span><strong>'+e(style(c.styleId).name)+'</strong>画风</span><span><strong>'+c.cast.length+' 位</strong>固定人物</span><span><strong>'+count+'/9</strong>分镜完成</span></div>'+
 '<p>情节：'+e(arc(c.arcId).name)+' · '+e(c.thesis)+'</p>'+
 '<p>后续 ChatGPT 必须先交一张角色定妆图和首格试画，作者确认后才能继续制作其余画格；实际图片和风格一致性仍需验收。</p>'+
 (locked?'<p class="director-approved">制作方案已锁定 · '+e(c.approval.approved_at)+' · 锁码 '+e(c.approval.lock_hash)+'</p>':
 '<div class="director-review-gaps">'+(errs.length?'<b>派单前待处理 '+errs.length+' 项</b><p>'+errs.map(e).map(x=>e(x)).join(' · ')+'</p>':'<b>所有字段已经准备好，请确认最终方案</b>')+'</div>')+
 '<label class="director-consent"><input type="checkbox" data-director-reviewed="1" '+(c.reviewed?'checked':'')+(p.handoff?.repoQueuedAt?' disabled':'')+'> 我已检查剧情、人物、画风与九格分镜，并理解当前预览非真实成品。</label>'+
 '<div class="buttons"><button type="button" class="button dark" data-director-action="approve" '+(p.handoff?.repoQueuedAt?'disabled':'')+'>确认并锁定制作方案</button>'+
 '<a href="#/handoff/'+e(p.id)+'" class="button">前往制作交接 →</a></div></section></div>';
}
function draw(){
 const p=selected();
 if(!p)return '<div class="box"><h2>尚未选择漫画作品</h2><a href="#/radar" class="button">前往选题池</a></div>';
 if(lastProjectId!==p.id){step=0;lastProjectId=p.id}
 const c=ensure(p),locked=approved(p);
 const tabs=['画风定调','人物设定','九格故事','最终定版'];
 return '<div class="director-page">'+heroHeader('CREATIVE DIRECTOR / PRE-PRODUCTION','创意导演台',
  '先确定样子、人物和剧情，再把锁定的制作标准交给 ChatGPT。这里的画面仅是配色和镜头示意，不是实际生成效果。',
  '<a class="button" href="#/handoff/'+e(p.id)+'">制作交接 →</a>')+
 '<div class="director-head"><div><span class="director-kicker">正在制作</span><h2>'+e(p.title)+'</h2><p>'+e(p.category)+' · '+e(c.thesis)+'</p></div>'+
 '<span class="director-status '+(locked?'ready':'')+'">'+(locked?'已锁定 · 可派单':'创作设定待确认')+'</span></div>'+
 '<div class="director-tabs">'+tabs.map((t,i)=>'<button type="button" data-director-step="'+i+'" class="'+(step===i?'active':'')+'"><span>0'+(i+1)+'</span>'+t+'</button>').join('')+'</div>'+
 (step===0?'<section class="box director-section"><h2>选择一套贯穿九张漫画的视觉语言</h2><p class="minor">选择后，统一色板、线条、灯光、构图与禁用项将写入正式生产任务。此处不是实际生图展示。</p>'+styleCards(c)+stylePreview(c)+
 '<div class="director-actions"><button type="button" class="button dark" data-director-action="next">下一步 · 人物设定 →</button></div></section>':'')+
 (step===1?'<section class="box director-section"><h2>锁住人物的一致性</h2><p class="minor">每个角色固定容貌、身形、服装和标志道具。不能每格随机改造人物，也不能借更名影射真实个人。</p>'+castEditor(c)+
 '<div class="director-actions"><button type="button" class="button dark" data-director-action="next">下一步 · 九格故事 →</button></div></section>':'')+
 (step===2?'<section class="box director-section"><h2>先审剧情，再生成画面</h2><p class="minor">选择叙事结构和主题，先生成可修改的九格草稿；每格场景、镜头与对白都可以独立修改。</p>'+narrative(p,c)+
 storyControls(p,c)+
 '<div class="director-actions"><button type="button" class="button" data-director-action="adopt">保留已编辑九格脚本</button><button type="button" class="button dark" data-director-action="next">审阅整体故事 →</button></div>'+
 framePreview(p,c)+'</section>':'')+
 (step===3?review(p,c):'')+
 (step===2?(scheduleAutoStoryboard(p),''):'')+
 '<p class="director-footer">By DAVYLAB · 创意预制与锁定不等于事实认证、图像已经生成或内容允许发表。资料自动保存在当前作品，并可随原有账户同步。</p></div>';
}
async function action(type,p){
 if(!p)throw Error('请先选择作品');
 if(type==='next'){step=Math.min(3,step+1);render();return}
 if(type==='draft'){if(p.handoff?.repoQueuedAt)throw Error('该任务已正式入仓，不能覆盖分镜');draft(p);return}
 if(type==='ai'){await generateStory(p,{provider:storyProvider,replace:true});return}
 if(type==='fill'){await generateStory(p,{provider:storyProvider,replace:false});return}
 if(type==='adopt'){
  if(p.handoff?.repoQueuedAt)throw Error('本版任务已经派单，不可重签原稿');
  if(!Array.isArray(p.panels)||p.panels.length!==9||p.panels.some(x=>clean(x.scene).length<30||!clean(x.caption)&&!clean(x.dialogue)))throw Error('保留现有分镜前，请补齐九格场景与旁白/对白');
  const c=ensure(p);c.drafted=true;c.reviewed=false;c.approval=null;
  setChange(p,'保留并提交已有九格分镜供作者审稿');render();notify('九格脚本已保留，没有覆盖已有画面或对白');return
 }
 if(type==='approve'){approve(p);return}
}
document.addEventListener('input',ev=>{
 const el=ev.target;if(el?.matches?.('[data-director-api-key]'))storyApiKey=String(el.value||'').slice(0,320);
},true);
document.addEventListener('change',ev=>{
 const el=ev.target;
 if(!el?.matches?.('[data-director-provider]'))return;
 ev.stopImmediatePropagation();
 storyProvider=['native','deepseek','openai'].includes(el.value)?el.value:'native';
 storyApiKey='';render();
},true);
document.addEventListener('click',ev=>{
 const el=ev.target.closest('[data-director-action],[data-director-step],[data-director-style],[data-director-arc]');if(!el)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected();if(!p)return;
 try{
  if(el.dataset.directorStep!=null){step=Number(el.dataset.directorStep);render();return}
  if(el.dataset.directorStyle!=null){if(p.handoff?.repoQueuedAt)throw Error('任务已入仓，本版本画风不可变更');ensure(p).styleId=el.dataset.directorStyle;commitEdit(p,'更新画风套装');render();return}
  if(el.dataset.directorArc!=null){if(p.handoff?.repoQueuedAt)throw Error('任务已入仓，本版本剧情结构不可变更');ensure(p).arcId=el.dataset.directorArc;commitEdit(p,'选择叙事结构（现有九格可按需重建）');render();return}
  action(el.dataset.directorAction,p);
 }catch(err){notify(String(err.message||err))}
},true);
document.addEventListener('change',ev=>{
 const el=ev.target,p=selected();if(!p||!el||!(el.matches?.('[data-director-field],[data-director-cast],[data-director-panel],[data-director-reviewed]')))return;
 try{
  if(p.handoff?.repoQueuedAt)throw Error('已正式派单。本版创作方向不能直接覆盖，请另建修订作品');
  const c=ensure(p);
  if(el.dataset.directorReviewed){c.reviewed=el.checked;c.approval=null;setChange(p,'更新九格分镜审阅状态');render();return}
  if(el.dataset.directorField){c[el.dataset.directorField]=el.value.slice(0,1600)}
  if(el.dataset.directorCast){const i=Number(el.dataset.characterIndex);if(!c.cast[i])return;c.cast[i][el.dataset.directorCast]=el.value.slice(0,500);p.characters=castText(c)}
  if(el.dataset.directorPanel){const i=Number(el.dataset.panelIndex);if(!p.panels[i])return;p.panels[i][el.dataset.directorPanel]=el.value.slice(0,1700);c.drafted=true}
  commitEdit(p,'调整并保存导演台创意设定');render();
 }catch(err){notify(String(err.message||err));render()}
},true);
window.wtCreativeDirector=draw;
window.wtDirector={STYLES,ARCS,ensure,payload,digest,checks,readiness,approved,exportBrief,castText,shotOf,draft,localStoryboard,applyStoryboard,aiStoryPayload,generateStory};
if(location.hash.startsWith('#/director'))queueMicrotask(()=>render());
})();
