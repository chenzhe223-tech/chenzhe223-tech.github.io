/* WORLD/TOON Creative Director: human-approved production design before ChatGPT dispatch.
 * Built-in storyboard model may be invoked on blank projects after login, subject to quota;
 * source-specific local structured drafts are explicitly labeled when the model is unavailable.
 * CSS wireframes are illustrative, NOT generated artwork; no publication approval is granted.
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
 {id:'chronicle',name:'历史纪事',detail:'时代背景 → 抉择 → 后果'},
 {id:'viral-melodrama',name:'狗血网红爽剧',detail:'重生逆袭 → 身份反转 → 金钱权力与娱乐圈修罗场'}
];
const SHOTS=['远景交代','中景人物','近景细节','对肩镜头','俯视关系','反打冲突','特写线索','低角度转折','远景余韵'];
const BEATS={
 twist:['惊人的传闻','角色的追问','互相矛盾的答案','第一道阻力','看似合理的解释','代价开始浮现','细节揭示另一面','思维翻转的时刻','留给读者的问题'],
 journey:['渴望的东西','迈出第一步','遭遇阻力','关系出现变化','尝试新的方案','付出代价','找到同伴','做出真正选择','走向新的自己'],
 mystery:['突发线索','不合常理的细节','第一条路径','证据出现裂痕','人物意见分裂','追寻关键原因','被忽略的细节','谜底的重构','谨慎的结论'],
 explain:['提出一个问题','认识关键概念','用角色讲解机制','出现错误理解','第一层解释','看见具体例子','比较不同方案','形成解决路径','现实应用与局限'],
 chronicle:['确立时代与地点','交代人物处境','重要事件出现','不同立场交锋','历史背景补充','关键抉择','转折的影响','后来发生了什么','史料与留白'],
 'viral-melodrama':['重生/意外开局','财富或身份差距初显','前任/合约关系曝光','网红热搜引爆舆论','富婆逆袭反击','男明星真实动机反转','豪门与银行职场冲突','直播现场身份大反转','新反转钩子引出下一集']
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
 const c={version:1,quality:'Premium',styleId:/网红|狗血|爽剧|重生|娱乐圈/.test(p.category||'')?'dramatic-3d-vertical':/历史|经典|宗教|军事/.test(p.category||'')?'chinese-historical-epic':/AI|科学|机器人/.test(p.category||'')?'futuristic-sci-fi':'western-cinematic',
  arcId:p.plotGenre==='viral-melodrama'?'viral-melodrama':/历史|经典/.test(p.category||'')?'chronicle':/科学|AI|机器人/.test(p.category||'')?'explain':'twist',
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
 if(c.arcId==='viral-melodrama'){
  const theme=p.dramaSubtype||'rebirth-bank-rich';
  const tag=theme==='rebirth-bank-rich'?'重生银行富婆与成年男明星':theme==='celebrity-contract'?'娱乐圈合约恋爱':theme==='wealth-revenge'?'豪门真假身份逆袭':'银行职场与网红流量';
  const snippets=[
    ['重生开局','银行年度酒会突然重置时间，主人公发现自己回到改变命运的那天，手机显示一笔神秘的新投资账户','这一次，账户里还有秘密。','我要重新决定人生规则。'],
    ['富婆亮相','主人公穿精致职业装进入私人银行，被误认为普通访客，随后投资人的身份反转让现场众人目瞪口呆','所有人都低估了她。','你确定她只是来办卡的吗？'],
    ['男星合约','主人公与成年男演员签署合法商业合作协议，旁边网红误将合同镜头解读成恋情，造成强烈喜剧冲突','一份合同，被剪辑成了爱情。','我投资事业，不等于购买感情。'],
    ['直播爆炸','银行董事会收到未经核实的网红热搜，合约男演员在直播前主动澄清，舆论与职场双线冲突升级','热搜速度远远超过了真相。','先查证据，还是先上热搜？'],
    ['专业打脸','主人公以完整合法合约和时间线回应争议，镜头聚焦文件与稳定目光，反派人物的表情从轻视变震惊','有人靠造势，有人靠专业反击。','把传闻写进风控报告是谁教你的？'],
    ['关系反转','男演员在走廊向主人公坦诚真实动机，原来合作是为了保护年轻创作者，双方对彼此的偏见开始瓦解','最狗血的误会，藏着真诚的选择。','你看到的，不是全部。'],
    ['豪门围猎','架空慈善晚宴上竞争者试图借旧关系打压女主，旁人发现一份重要且可查的银行交易记录','他们以为她只会花钱。','这笔账，谁敢当场解释？'],
    ['直播反击','主人公在现场直播和董事会会议中公开可核查的虚构企业交易记录，身份与权力地位大反转','她赢的不是流量，是判断。','我买的是未来，不是人设。'],
    ['续集钩子','故事将结束时主人公收到新的神秘合作邀请函，镜头只显示署名和众人惊讶目光，留下下一集悬念','这一局结束了，下一局才刚开始。','下一位，又是谁？']
  ];
  return Array.from({length:p.panels.length},(_,i)=>{
    const row=snippets[Math.min(8,Math.floor(i*9/p.panels.length))];
    return {title:row[0],scene:'【'+shotOf(i)+'】'+row[1]+'。题材：'+tag+'；角色均为原创成年人物，服装、面容与身份逻辑必须连续。',
      caption:row[2],dialogue:row[3],prompt:'高品质都市3D漫画；'+style(c.styleId).material+'；'+style(c.styleId).lighting+'；反差戏剧性与电影构图'};
  });
 }
 const expanded=Array.from({length:p.panels.length},(_,i)=>stages[Math.min(8,Math.floor(i*9/p.panels.length))]);
 return expanded.map((row,i)=>({title:(c.arcId==='twist'?beats[Math.min(8,Math.floor(i*9/p.panels.length))]:row[0]).slice(0,100),
  scene:'【'+shotOf(i)+'】'+row[1]+' 固定'+a+'、'+b+'的服装、脸型与识别道具。题材背景：'+conflict+'。',
  caption:row[2],dialogue:row[3],prompt:'专业完成级漫画分镜，人物外貌连续、空间轴线明确；'+shotOf(i)+'；'+style(c.styleId).material+'，'+style(c.styleId).lighting}));
}
function applyStoryboard(p,panels,meta,replace=false){
 if(p.handoff?.repoQueuedAt)throw Error('该版本已正式派单，不能修改既有故事');
 if(!Array.isArray(panels)||!Array.isArray(p.panels)||panels.length!==p.panels.length||p.panels.length<4||p.panels.length>60)throw Error('分镜数量必须与作品篇幅一致（4–60格）');
 const existing=p.panels.some(x=>clean(x.scene)||clean(x.caption)||clean(x.dialogue));
 if(replace===true&&existing&&!confirm('这会替换你当前九格中的文字与分镜，但保留已上传图片。确认覆盖？'))return false;
 const fields=['title','scene','caption','dialogue','prompt'];
 let updated=0;
 for(let i=0;i<p.panels.length;i++){
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
  arc:arc(c.arcId).name,genre:p.plotGenre||'general',drama_subtype:p.dramaSubtype||'',drama_intensity:Number(p.dramaIntensity||3),thesis:c.thesis,world:c.world,emotion:c.emotion,fiction:p.fiction,
  style:st.name,styleRules:[st.material,st.lighting,st.layout,st.negative].join('；'),
  cast:c.cast,panel_count:p.panels.length,series_bible:p.seriesBible||null,episodes:Array.isArray(p.seriesEpisodes)?p.seriesEpisodes:[]};
}
async function generateStory(p,{provider='native',auto=false,replace=false}={}){
 if(storyBusy||p.handoff?.repoQueuedAt)return;
 const empty=p.panels.every(x=>!clean(x.scene)&&!clean(x.caption)&&!clean(x.dialogue));
 if(auto&&!empty)return;
 if(auto&&(!wtSession?.access_token||!wtConfig?.storyboardAiEnabled)){
  draft(p,false);return;
 }
 if(provider==='deepseek'){
  if(!auto&&!confirm('将调用当前 WORLD/TOON 已配置的 DeepSeek 服务端真实模型生成剧本，可能按 Token 计费。确认本次调用吗？'))return;
 }else if(provider!=='native'){
  if(!storyApiKey.trim()){notify('请输入 OpenAI API Key，仅用于本次请求');return}
  if(!auto&&!confirm('将使用你提供的第三方模型 API，供应商可能按用量收费。确认本次调用？'))return;
 }
 if(!auto&&replace&&p.panels.some(x=>clean(x.scene))){
  if(!confirm('将用新剧本替换当前文字与分镜；不会删除已有的漫画图片。确定继续？'))return;
 }
 storyBusy=true;render();
 try{
  const basis=digest(p);
  let result;
  if(provider==='deepseek'){
    if(typeof wtArchiveApi!=='function')throw Error('安全 DeepSeek 网关尚未加载');
    const genre=p.plotGenre==='viral-melodrama'?'狗血网红爽剧':'通用故事';
    const theme=p.dramaSubtype||'rebirth-bank-rich',intensity=Number(p.dramaIntensity||4);
    const idea=(p.ideaSeed||p.description||ensure(p).thesis||'').slice(0,1100)+
      (genre==='狗血网红爽剧'?'\\n【作者创作要求】原创成年人的都市重生逆袭、富婆/金融职场、网红热搜与合约男明星的情感纠葛。狗血反转强度 '+intensity+'/5；具体题材'+theme+'；每2–3格有反转，开场强悬念，结尾强钩子。全为架空虚构人物，不捏造真人丑闻。':'');
    if(idea.trim().length<8||idea.length>1800)throw Error('请先完善8–1800字的故事核心构思');
    const response=await wtArchiveApi('deepseek-expand',{method:'POST',
      body:JSON.stringify({idea,title:p.title,category:genre,panel_count:p.panels.length,
        genre:p.plotGenre||'general',drama_subtype:theme,drama_intensity:intensity,
        series_bible:p.seriesBible||null,previous_summary:p.seriesEpisode>1?p.description:''})});
    if(response?.method!=='verified_model_response'||!response.story?.panels)
      throw Error('未收到真实 DeepSeek 结构化剧本');
    result={method:'verified_model_response',provider:'deepseek',model:response.model||'deepseek-flash',
      analysis:response.story.reasoning||'',panels:response.story.panels.map(x=>({
        title:x.title,scene:x.scene,caption:x.caption,dialogue:x.dialogue,prompt:x.visual_prompt}))};
  }else{
    if(typeof wtCallAI!=='function')throw Error('模型请求组件未载入');
    result=await wtCallAI('/api/ai/storyboard',aiStoryPayload(p,provider));
  }
  if(result?.method!=='verified_model_response'||!Array.isArray(result.panels)||result.panels.length<4||result.panels.length>60)
     throw Error('模型未返回可用的4–60格完整分镜');
  if(selected()?.id!==p.id||p.handoff?.repoQueuedAt)throw Error('当前作品已切换或已派单，原始草稿未被覆盖');
  if(digest(p)!==basis)throw Error('生成期间作品内容有改动，AI结果未覆盖你的修改');
  if(result.panels.length!==p.panels.length){
    if(p.panels.some(x=>x.image)||p.cover)throw Error('AI 推荐的新篇幅与已上传图片不匹配，请先建立修订作品');
    p.panels=Array.from({length:result.panels.length},(_,i)=>p.panels[i]||makePanel(i));
  }
  const wrote=applyStoryboard(p,result.panels,result,replace?'approved':false);
  if(wrote)notify('已使用 '+(provider==='native'?'平台内置AI':provider==='deepseek'?'DeepSeek':'OpenAI')+' 生成可编辑九格草稿，请人工确认');
 }catch(err){
  if(auto&&selected()?.id===p.id&&!p.panels.some(x=>clean(x.scene))){
   draft(p,false);notify('内置模型暂不可用，已退回本地规则草稿（非AI模型输出）');
  }else notify('AI剧本生成失败：'+String(err?.message||err).slice(0,110));
 }finally{storyBusy=false;render()}
}
function scheduleAutoStoryboard(p){
 if(!p||p.handoff?.repoQueuedAt||!Array.isArray(p.panels)||(p.panels.length<4||p.panels.length>60)||
    p.panels.some(x=>clean(x.scene)||clean(x.dialogue)||clean(x.caption))||pendingAuto.has(p.id))return;
 pendingAuto.add(p.id);
 queueMicrotask(()=>{if(selected()?.id===p.id&&step===2)generateStory(p,{auto:true,provider:'native'});});
}
function castText(c){return c.cast.map((x,i)=>[i+1+'. '+x.role+'：'+x.name,'外貌与比例：'+x.look,'固定服饰：'+x.clothes,'识别道具：'+x.symbol,'性格：'+x.nature].join('；')).join('\n')}
function payload(p){
 const c=ensure(p),s=style(c.styleId);
 return {
  version:3,style_catalog_version:'3.0.0',quality_target:c.quality||'Premium',model_capability:'unverified',style_id:s.id,style_name:s.name,visual_rules:{palette:s.palette,material:s.material,lighting:s.lighting,layout:s.layout,negative:s.negative,ratio:'3:4',size:'1080x1440',lettering:'先生成无文字画面，准确中文另行排版'},
  series_bible:p.seriesBible||null,series_identity:p.seriesId?{id:p.seriesId,episode:p.seriesEpisode||1,previous_task_id:p.previousTaskId||null}:null,
   narrative:{arc_id:c.arcId,arc_name:arc(c.arcId).name,genre:p.plotGenre||'general',drama_subtype:p.dramaSubtype||'',drama_intensity:Number(p.dramaIntensity||3),story_thesis:clean(c.thesis),world:clean(c.world),emotion:clean(c.emotion),summary:clean(p.description),fictionalization:clean(p.fiction)},
  characters:c.cast.map((x,i)=>({role:clean(x.role),name:clean(x.name),look:clean(x.look),clothes:clean(x.clothes),symbol:clean(x.symbol),nature:clean(x.nature),portrait_reference:x.portraitConsent&&x.portraitMedia?{file:'references/portrait-'+String(i+1).padStart(2,'0')+'.'+(x.portraitExt||'png'),sha256:x.portraitSha256||null,usage:'authorized_visual_likeness_reference_only',source:'user_supplied_private',description:clean(x.portraitNotes||''),requires_actual_photo_for_generation:true}:null})),
  storyboard:(p.panels||[]).map((x,i)=>({index:i+1,title:clean(x.title),shot:shotOf(i),scene:clean(x.scene),caption:clean(x.caption),dialogue:clean(x.dialogue),custom_prompt:clean(x.prompt)})),
  storyboard_generation:c.storyboardProvenance?{method:c.storyboardProvenance.method,provider:c.storyboardProvenance.provider,model:c.storyboardProvenance.model,generated_at:c.storyboardProvenance.at,author_modified:!!c.storyboardProvenance.authorEdited,analysis:clean(c.storyboardProvenance.analysis)}:{method:'manual_unverified'},
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
 if(p.seriesEpisode>1&&p.seriesBible){if(p.seriesBible.style_id&&p.seriesBible.style_id!==c.styleId)errs.push('续章画风必须与系列创作圣经一致');if(Array.isArray(p.seriesBible.characters)&&p.seriesBible.characters.length&&JSON.stringify(p.seriesBible.characters)!==JSON.stringify(c.cast))errs.push('系列续章角色外貌服饰需保持锁定，修改应建立新系列版本')}
 if(!Array.isArray(p.panels)||p.panels.length<4||p.panels.length>60)errs.push('分镜数量必须为4–60格');
 else for(let i=0;i<p.panels.length;i++){const x=p.panels[i];if(clean(x.scene).length<30||clean(x.title).length<2||(!clean(x.caption)&&!clean(x.dialogue)))errs.push('第'+(i+1)+'格缺少完整场景、标题或文字')}
 if((p.visualReferences||[]).some(x=>x.license!=='CC0'))errs.push('视觉参考包含未确认 CC0 的馆藏');
 if(c.cast?.some(x=>x.portraitMedia&&!x.portraitConsent))errs.push('肖像照片必须获得肖像使用授权；否则移除照片');
 if(!c.drafted)errs.push('先生成并逐格审阅分镜');
 if(!c.reviewed)errs.push('请勾选“已逐格审阅并确认创意方向”');
 return errs;
}
function approved(p){const c=p?.creativeDirection;return !!(c?.approval?.lock_hash&&c.approval.lock_hash===digest(p)&&c.approval.author_approved===true&&checks(p).length===0)}
function readiness(p){const missing=checks(p);if(!missing.length&&!approved(p))missing.push('请在导演台点击“确认并锁定制作方案”');return missing}
function exportBrief(p){
 if(!approved(p))throw Error('创作方案尚未锁定，禁止派单');
 const c=p.creativeDirection;
 return {...payload(p),style_lock:{schema:'davylab.worldtoon.style-lock.v3',style_id:c.styleId,style_version:'3.0.0',quality_target:c.quality||'Premium',aspect_ratio:'3:4',resolution:[1080,1440],render_pipeline:'same_model_preview_and_final_required',model_id:null,model_version:null,preview_sha256:null,character_reference_sha256:null,original_first_panel_required:true,production_status:'awaiting_real_pilot'},lock_status:'approved',approval:{lock_hash:c.approval.lock_hash,approved_at:c.approval.approved_at,author_approved:true,approval_scope:'style_cast_storyboard',note:'锁定创意设定不等于事实核验或正式发表批准'},
 production_gates:{pilot_required:true,pilot_artifacts:['character-sheet.png','pilot-01.png'],pilot_approval_required:true,portrait_reference_requires_private_transfer:true,portrait_likeness_review_required:true,
  full_run_panel_count:p.panels.length,independent_cover:true,character_continuity:true,original_preview_is_panel_01:true,preview_sha256_equals_final_panel_01:true,min_resolution:[1080,1440],reject_svg_and_placeholder:true,source_verification_before_fact_claims:true,
  instructions:'先交付角色设定图与首格样稿由作者审阅；未获作者确认不得批量生成剩余画格或宣布完成。'}};
}
function commitEdit(p,label){const c=ensure(p);if(p.handoff?.repoQueuedAt)throw Error('此版本已正式入仓。请先复制为新版作品，再修改和派单');c.approval=null;c.reviewed=false;markDirty(p);setChange(p,label)}
function approve(p){
 const errors=checks(p);
 if(errors.length)throw Error('暂无法定稿：'+errors.slice(0,3).join('；')+(errors.length>3?' 等'+errors.length+'项':''));
 if(p.handoff?.repoQueuedAt)throw Error('本版本已经正式派单，不可再次锁定覆盖');
 if(!confirm('确认画风、两名角色、故事主旨和九格分镜都是最终制作依据？锁定后任何修改都需要重新确认。'))return;
 const c=ensure(p);if(p.seriesId&&p.seriesEpisode===1){p.seriesBible={...(p.seriesBible||{}),title:p.seriesTitle||p.title,world:c.world,style_id:c.styleId,characters:structuredClone(c.cast),continuity:'固定角色容貌、比例、服饰、标记与视觉风格；续章可以改编剧情，但不可无故改造定妆'};}
 c.approval={lock_hash:digest(p),approved_at:new Date().toISOString(),author_approved:true};
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
 (person.portraitConsent&&person.portraitMedia?
    '<div class="director-portrait-preview"><img data-source="'+e(person.portraitMedia)+'" src="'+e(mediaSrc(person.portraitMedia))+'" alt="'+e(person.name)+'的本人授权参考照"><small>本人授权原照 · 非 AI 生成角色</small></div>':
    '<div class="director-character-avatar director-theme-'+style(c.styleId).id+'"><i></i><b></b><small>角色版式示意 · 非定妆照</small></div>')+
 '<div class="director-portrait-controls">'+
 '<label class="director-portrait-consent"><input type="checkbox" data-director-portrait-consent="'+i+'" '+(person.portraitConsent?'checked':'')+'>我确认拥有此人肖像的使用授权，仅用于本作品的角色参考与交付</label>'+
 '<label class="button director-portrait-upload">＋ 上传真人参考照（仅本机保存）<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-director-portrait-upload="'+i+'" '+(!person.portraitConsent?'disabled':'')+'></label>'+
 (person.portraitMedia?'<button type="button" class="button" data-director-portrait-remove="'+i+'">移除照片</button>':'')+
 '<p>支持 PNG/JPEG/WebP，最多 8MB。AI 将参照骨相、发型和独特特征生成 3D 拟人角色；真实图像需由生产 Agent 完成并经作者审核。照片不公开入书架。</p></div>'+
 '<div class="director-character-fields">'+['name','look','clothes','symbol','nature'].map((key,j)=>
 '<label>'+['角色姓名','固定容貌、发型与体型（可参照授权真人照片）','每格不变的服装','可识别道具或标记','性格与行为'][j]+
 (key==='look'||key==='clothes'?'<textarea rows="2"':'<input type="text"')+' data-director-cast="'+key+'" data-character-index="'+i+'" maxlength="500"'+(key==='look'||key==='clothes'?'>'+e(person[key])+'</textarea>':' value="'+e(person[key])+'">')+'</label>').join('')+
 '</div></article>').join('')+'</div>'+ 
 '<div class="director-portrait-handoff"><button type="button" class="button dark" data-director-action="portrait-pack">导出真人 → 3D 角色参考包</button>'+ 
 '<p>仅打包已经授权的原始照片、角色设定、当前画风与 SHA256，交给 ChatGPT 生产真实角色定妆图。此按钮不会调用收费生图模型或上传照片。</p></div>';
}
function framePreview(p,c){
 const rows=(p.panels||[]).map((x,i)=>'<article class="director-panel"><div class="director-panel-frame">'+
 '<span>'+String(i+1).padStart(2,'0')+' / '+String(p.panels.length).padStart(2,'0')+'</span><strong>'+e(shotOf(i))+'</strong><div class="director-panel-art"><i></i><b></b></div></div>'+
 '<div class="director-panel-edit"><label>画格主题<input data-director-panel="title" data-panel-index="'+i+'" value="'+e(x.title)+'" maxlength="100"></label>'+
 '<label>镜头与画面<textarea rows="3" data-director-panel="scene" data-panel-index="'+i+'" maxlength="1700">'+e(x.scene)+'</textarea></label>'+
 '<label>旁白<textarea rows="2" data-director-panel="caption" data-panel-index="'+i+'" maxlength="550">'+e(x.caption)+'</textarea></label>'+
 '<label>对白<textarea rows="2" data-director-panel="dialogue" data-panel-index="'+i+'" maxlength="550">'+e(x.dialogue)+'</textarea></label></div></article>').join('');
 return '<div class="director-board-info"><strong>'+e(arc(c.arcId).name)+' · '+p.panels.length+'格镜头表</strong><span>仅为镜头/文字预演，不是 AI 生成的最终图片</span></div>'+
 '<div class="director-board">'+rows+'</div>';
}
function storyControls(p,c){
 const info=c.storyboardProvenance;
 const origin=info?.method==='verified_model_response'?'AI生成 · '+(info.provider==='native'?'平台内置模型':info.provider==='deepseek'?'DeepSeek API':'OpenAI API')+(info.model?' · '+info.model:''):
    info?.method==='local_structure_rules'?'本地剧情分析规则 · 非AI模型输出':'尚未生成 · 将优先使用内置AI';
 const providerLabel=storyProvider==='deepseek'?'DeepSeek':storyProvider==='openai'?'OpenAI':'内置AI';
 return '<div class="director-ai-workflow" role="group" aria-label="动态篇幅剧本智能生成">'+
 '<div class="director-ai-head"><div><strong>自动编剧 · 4–60 格完整分镜</strong><span>默认自动分析选题、人物与画风；模型结果和人工编辑都写入当前作品。</span></div>'+
 '<span class="director-ai-status">'+e(storyBusy?'生成中 · 请勿重复提交':origin)+'</span></div>'+
 '<div class="director-ai-grid"><label>生成方式<select data-director-provider>'+
 '<option value="native"'+(storyProvider==='native'?' selected':'')+'>内置AI · 已登录优先自动生成</option>'+
 '<option value="deepseek"'+(storyProvider==='deepseek'?' selected':'')+'>DeepSeek API · 复用安全服务端密钥</option>'+
 '<option value="openai"'+(storyProvider==='openai'?' selected':'')+'>OpenAI API · 自带密钥</option></select></label>'+
 (storyProvider==='openai'?'<label>API Key · 本次网页会话使用，不保存到项目<input data-director-api-key type="password" autocomplete="off" spellcheck="false" placeholder="'+e(providerLabel)+' API Key" value="'+e(storyApiKey)+'"></label>':'<div class="director-ai-guide"><b>安全模型配置</b><span>DeepSeek 复用 Cloudflare 服务端密钥，无需再次输入。内置 AI 可在空白时自动填写，模型不可用会明确标注本地规则草稿。</span></div>')+'</div>'+
 '<div class="director-ai-actions"><button type="button" class="button dark" data-director-action="ai"'+(storyBusy?' disabled':'')+'> '+(storyBusy?'正在生成…':'使用'+e(providerLabel)+'智能生成剧本')+'</button>'+
 '<button type="button" class="button" data-director-action="fill"'+(storyBusy?' disabled':'')+'>仅填补空白字段</button>'+
 '<button type="button" class="button subtle" data-director-action="draft"'+(storyBusy?' disabled':'')+'>本地规则草稿</button></div>'+
 '<p class="director-ai-foot">AI草稿不等于事实核验或正式完成。内置模型使用已有平台配额；第三方API仅在你点击生成并确认后调用，可能产生费用。文字可逐格修改，最终需作者审阅锁定。</p>'+
 '</div>';
}
function review(p,c){
 const errs=checks(p),locked=approved(p),count=p.panels.filter(x=>clean(x.scene).length>=30).length;
 return '<div class="director-review"><section class="director-review-summary"><h3>本次制作定版</h3><div class="director-review-kpis"><span><strong>'+e(style(c.styleId).name)+'</strong>画风</span><span><strong>'+c.cast.length+' 位</strong>固定人物</span><span><strong>'+count+'/'+p.panels.length+'</strong>分镜完成</span></div>'+
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
 if(lastProjectId!==p.id){step=0;lastProjectId=p.id;storyApiKey='';storyProvider='native'}
 const c=ensure(p),locked=approved(p);
 const tabs=['画风定调','人物设定','剧情分镜','最终定版'];
 return '<div class="director-page">'+heroHeader('CREATIVE DIRECTOR / PRE-PRODUCTION','创意导演台',
  '先确定样子、人物和剧情，再把锁定的制作标准交给 ChatGPT。这里的画面仅是配色和镜头示意，不是实际生成效果。',
  '<a class="button" href="#/handoff/'+e(p.id)+'">制作交接 →</a>')+
 '<div class="director-head"><div><span class="director-kicker">正在制作</span><h2>'+e(p.title)+'</h2><p>'+e(p.category)+' · '+e(c.thesis)+'</p></div>'+
 '<span class="director-status '+(locked?'ready':'')+'">'+(locked?'已锁定 · 可派单':'创作设定待确认')+'</span></div>'+
 '<div class="director-tabs">'+tabs.map((t,i)=>'<button type="button" data-director-step="'+i+'" class="'+(step===i?'active':'')+'"><span>0'+(i+1)+'</span>'+t+'</button>').join('')+'</div>'+
 (step===0?'<section class="box director-section"><h2>选择一套贯穿整部漫画的视觉语言</h2><p class="minor">选择后，统一色板、线条、灯光、构图与禁用项将写入正式生产任务。此处不是实际生图展示。</p>'+styleCards(c)+stylePreview(c)+
 '<div class="director-actions"><button type="button" class="button dark" data-director-action="next">下一步 · 人物设定 →</button></div></section>':'')+
 (step===1?'<section class="box director-section"><h2>锁住人物的一致性</h2><p class="minor">每个角色固定容貌、身形、服装和标志道具。不能每格随机改造人物，也不能借更名影射真实个人。</p>'+castEditor(c)+
 '<div class="director-actions"><button type="button" class="button dark" data-director-action="next">下一步 · 九格故事 →</button></div></section>':'')+
 (step===2?'<section class="box director-section"><h2>先审剧情，再生成画面</h2><p class="minor">选择叙事结构和主题，生成可修改的分镜草稿；每格场景、镜头与对白都可以独立修改。</p>'+narrative(p,c)+
 storyControls(p,c)+
 '<div class="director-actions"><button type="button" class="button" data-director-action="adopt">保留已编辑九格脚本</button><button type="button" class="button dark" data-director-action="next">审阅整体故事 →</button></div>'+
 framePreview(p,c)+'</section>':'')+
 (step===3?review(p,c):'')+
 (step===2?(scheduleAutoStoryboard(p),''):'')+
 '<p class="director-footer">By DAVYLAB · 创意预制与锁定不等于事实认证、图像已经生成或内容允许发表。资料自动保存在当前作品，并可随原有账户同步。</p></div>';
}
async function exportPortraitReferencePack(p){
 const c=ensure(p),refs=[];
 const guide={title:p.title,style_id:c.styleId,style_name:style(c.styleId).name,
  visual_style:{material:style(c.styleId).material,lighting:style(c.styleId).lighting,negative:style(c.styleId).negative},
  genre:p.plotGenre||'general',characters:[]};
 for(let i=0;i<c.cast.length;i++){
  const person=c.cast[i];if(!person.portraitMedia)continue;
  if(!person.portraitConsent)throw Error('未获得第'+(i+1)+'位角色肖像使用授权');
  const blob=await getMedia(person.portraitMedia.slice(6));
  if(!blob)throw Error('第'+(i+1)+'位角色照片不在当前设备，请重新上传');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
      b=>b.toString(16).padStart(2,'0')).join('');
  if(sha!==person.portraitSha256)throw Error('肖像照片 SHA256 与授权记录不一致');
  const filename='references/portrait-'+String(i+1).padStart(2,'0')+'.'+(person.portraitExt||'png');
  refs.push({name:filename,bytes});
  guide.characters.push({name:person.name,role:person.role,look:person.look,clothes:person.clothes,
    reference_file:filename,sha256:sha,portrait_usage:'subject_consented',priority:'retain recognizable face and hairstyle'});
 }
 if(!refs.length)throw Error('请先为至少一位角色上传已授权的真人照片');
 const prompt='WORLD/TOON · By DAVYLAB · 真实肖像拟人化 3D 角色定妆任务\\n'+
  '请使用附带的本人授权照片作为唯一身份参照，生成独立原创高品质 3D 漫画人物定妆图；优先保持面部骨相、眼鼻嘴比例、发型和气质的可识别相似度，再适度进行漫画化。'+
  '保持成年人物比例与自然皮肤质感，禁止廉价塑料质感。人物身份和故事均属原创虚构，不要冒充真实照片或伪造真实人物事实。\\n'+
  '所选画风：'+style(c.styleId).name+'；'+style(c.styleId).material+'；'+style(c.styleId).lighting+'。\\n'+
  '先输出正式竖版3:4、至少1080x1440像素的角色定妆 PNG，待作者核对容貌后再开展全篇创作。';
 const files=[{name:'portrait-brief.json',bytes:enc.encode(JSON.stringify(guide,null,2))},
   {name:'生成指令.md',bytes:enc.encode(prompt)},...refs];
 saveFile(packZip(files),'WORLD_TOON_3D肖像角色参考_'+safeName(p.title)+'.zip');
 notify('已导出 '+refs.length+' 张授权照片的3D角色生产参考包。请私密交给制作 Agent，先验收定妆图。');
}

async function action(type,p){
 if(!p)throw Error('请先选择作品');
 if(type==='next'){step=Math.min(3,step+1);render();return}
 if(type==='portrait-pack'){await exportPortraitReferencePack(p);return}
 if(type==='draft'){if(p.handoff?.repoQueuedAt)throw Error('该任务已正式入仓，不能覆盖分镜');draft(p);return}
 if(type==='ai'){await generateStory(p,{provider:storyProvider,replace:true});return}
 if(type==='fill'){await generateStory(p,{provider:storyProvider,replace:false});return}
 if(type==='adopt'){
  if(p.handoff?.repoQueuedAt)throw Error('本版任务已经派单，不可重签原稿');
  if(!Array.isArray(p.panels)||(p.panels.length<4||p.panels.length>60)||p.panels.some(x=>clean(x.scene).length<30||!clean(x.caption)&&!clean(x.dialogue)))throw Error('保留现有分镜前，请补齐九格场景与旁白/对白');
  const c=ensure(p);c.drafted=true;c.reviewed=false;c.approval=null;
  if(!c.storyboardProvenance)c.storyboardProvenance={method:'manual_unverified',provider:'manual',model:null,at:new Date().toISOString(),authorEdited:true};
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
  if(el.dataset.directorPanel){const i=Number(el.dataset.panelIndex);if(!p.panels[i])return;p.panels[i][el.dataset.directorPanel]=el.value.slice(0,1700);c.drafted=true;if(c.storyboardProvenance)c.storyboardProvenance.authorEdited=true}
  commitEdit(p,'调整并保存导演台创意设定');render();
 }catch(err){notify(String(err.message||err));render()}
},true);
// Keep likeness references private: IndexedDB for preview and the owner-approved
// offline handoff ZIP. No public URL and no background upload to shared publications.
async function handlePortraitUpload(el){
 const p=selected();if(!p||p.handoff?.repoQueuedAt)throw Error('正式派单后不能改动本版肖像参考');
 const i=Number(el.dataset.directorPortraitUpload),c=ensure(p),person=c.cast[i];
 if(!person)throw Error('角色不存在');
 if(person.portraitConsent!==true)throw Error('请先确认肖像使用授权，再上传照片');
 const file=el.files?.[0];if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1024||file.size>8*1024*1024)
    throw Error('照片仅接受 1KB–8MB 的 PNG/JPEG/WebP');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const isPng=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,
       isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
       isWebp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(isPng||isJpeg||isWebp))throw Error('图片文件内容不符合声明格式');
 let bitmap;
 try{
  bitmap=await createImageBitmap(file);
  if(bitmap.width<256||bitmap.height<256)throw Error('建议上传不低于 256×256 的正面或半身照片');
 }finally{bitmap?.close()}
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
   b=>b.toString(16).padStart(2,'0')).join('');
 const ext=isPng?'png':isJpeg?'jpg':'webp',key='portrait-'+p.id+'-'+i+'-'+sha.slice(0,16);
 await putMedia(key,file);
 person.portraitMedia='media:'+key;person.portraitSha256=sha;person.portraitExt=ext;
 person.portraitNotes='请依据授权照片保持面部骨相、眼鼻嘴比例、发型和自然表情的可辨识相似，转为原创3D漫画形象；不要声称原图是真实生成结果。';
 p.characters=castText(c);
 commitEdit(p,'保存授权真人肖像与 3D 拟人角色参考（仅本机 IndexedDB，未上传远端）');
 render();notify('肖像参考已保存于当前设备；生成任务时将包含照片参考和 SHA256。');
}
document.addEventListener('change',ev=>{
 const el=ev.target;
 if(!el?.matches?.('[data-director-portrait-consent]'))return;
 ev.stopImmediatePropagation();
 try{
  const p=selected();if(!p||p.handoff?.repoQueuedAt)throw Error('已派单作品不能改动肖像授权');
  const c=ensure(p),person=c.cast[Number(el.dataset.directorPortraitConsent)];
  if(!person)return;
  person.portraitConsent=!!el.checked;
  if(!person.portraitConsent){person.portraitMedia=null;person.portraitSha256=null;person.portraitExt=null}
  commitEdit(p,person.portraitConsent?'作者确认肖像使用授权':'作者撤回肖像使用授权并停止使用肖像参考');
  render();
 }catch(e){notify(String(e.message||e));render()}
},true);
document.addEventListener('change',ev=>{
 const el=ev.target;if(!el?.matches?.('[data-director-portrait-upload]'))return;
 ev.stopImmediatePropagation();void handlePortraitUpload(el).catch(err=>notify('真人肖像上传失败：'+String(err.message||err)));
},true);
document.addEventListener('click',ev=>{
 const el=ev.target.closest('[data-director-portrait-remove]');if(!el)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const p=selected();if(!p||p.handoff?.repoQueuedAt){notify('已派单任务请创建新修订版本');return}
 const person=ensure(p).cast[Number(el.dataset.directorPortraitRemove)];
 if(!person)return;
 person.portraitMedia=null;person.portraitSha256=null;person.portraitExt=null;
 commitEdit(p,'作者移除肖像参考照片');render();
},true);

window.wtCreativeDirector=draw;
window.wtDirector={STYLES,ARCS,ensure,payload,digest,checks,readiness,approved,exportBrief,castText,shotOf,draft,localStoryboard,applyStoryboard,aiStoryPayload,generateStory};
if(location.hash.startsWith('#/director'))queueMicrotask(()=>render());
})();
