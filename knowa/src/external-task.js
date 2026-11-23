// KNOWA Content Engine: no remote calls, no prompts sent to any third party.
// One authoritative brief is compiled into a runnable handoff for an external creator.
export const EXTERNAL_TASK_VERSION='knowa-external-v1';
export const EXTERNAL_TARGETS=['ChatGPT','WorkBuddy','Gemini','Claude','千问','其他'];
export const EXTERNAL_KINDS=['video','poster','article','full'];
export const EXTERNAL_STYLES=['高级科学杂志','自然纪录片','博物馆科学图鉴','天文工程图解','极简数据视觉','冷蓝科技线描'];
export function generateExternalTask(raw={}){
 const b=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const limited=(v,max)=>String(v??'').trim().slice(0,max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 const topic=limited(b.topic,110),facts=limited(b.facts,3800),sourceName=limited(b.sourceName,110),sourceUrl=limited(b.sourceUrl,1200);
 const notes=limited(b.requirements,1400),audience=limited(b.audience,110)||'对科学感兴趣的大众',reference=limited(b.reference,700);
 const target=EXTERNAL_TARGETS.includes(b.target)?b.target:'ChatGPT';
 const kind=EXTERNAL_KINDS.includes(b.kind)?b.kind:'full';
 const style=EXTERNAL_STYLES.includes(b.style)?b.style:EXTERNAL_STYLES[0];
 const duration=[12,30,45,60].includes(Number(b.duration))?Number(b.duration):30;
 const imageCount=Number.isInteger(Number(b.imageCount))?Math.max(1,Math.min(9,Number(b.imageCount))):3;
 const articleLength=[600,900,1200,1800].includes(Number(b.articleLength))?Number(b.articleLength):900;
 const errors=[];
 if(topic.length<4)errors.push('请填写至少4字的知识主题');
 if(facts.length<12)errors.push('请提供至少12字的可信知识说明');
 if(sourceName.length<2)errors.push('请填写来源机构');
 let url='';
 try{const u=new URL(sourceUrl);if(u.protocol!=='https:')throw Error('Only HTTPS');url=u.href}catch{errors.push('请输入有效的 HTTPS 来源链接')}
 if(errors.length)return {ok:false,errors};
 const desired=['video','full'].includes(kind),wantImages=['poster','full'].includes(kind),wantArticle=['article','full'].includes(kind);
 const shotCount=duration===12?4:duration===30?6:duration===45?9:10;
 const beats=[
  '用一句生活化问题或反常识现象提出悬念，不夸大结论',
  '明确核心概念及对象范围，避免偷换概念',
  '通过直观物体、地图或图解展示主要现象',
  '拆解关键科学机制，逐步解释因果关系',
  '展示能被来源支持的证据、数字或比较，不制造数据',
  '补充必要边界、条件、误区和例外',
  '将抽象机制转化为可见的结构示意，不使用无意义人物插画',
  '给出有依据的现实应用或延伸意义',
  '用一句结论重新回答最初的问题',
  '收束主题并展示来源、版本及待复核状态'
 ];
 const steps=Array.from({length:shotCount},(_,i)=>{
   const topicPrompt=shotCount===4?[
    '开场：提出核心问题与清晰钩子，不要杜撰事实',
    '讲解：用一张科学示意图解释主要概念',
    '论证：用可被原始资料支持的事实和图示说明',
    '总结：给出结论、边界及可核查的来源'
   ][i]:beats[i===shotCount-1?9:Math.floor(i*9/(shotCount-1))];
   return {number:i+1,seconds:duration/shotCount,objective:topicPrompt};
 });
 const outline=steps.map(s=>String(s.number).padStart(2,'0')+'｜'+s.seconds+'秒｜'+s.objective).join('\n');
 const identity='KNOWA · By DAVYLAB';
 const intro=[
 '【任务身份】你是科普总编辑、事实核验员、资深科学视觉导演与交付验收负责人。以下为可执行生产任务，不是随意的创意建议。',
 '【任务主题】'+topic,
 '【交付对象】'+audience,
 '【目标平台】'+target+'（仅作为任务接收端。先确认自身工具与执行权限，不得假称具有生图、生视频、上传或压缩能力）',
 '【视觉规范】'+style+'；高端科学出版物气质；版面克制、信息层级清晰、拒绝炫光、伪3D、无意义emoji与密集装饰。',
 '【事实基线】\n'+facts,
 '【原始资料】'+sourceName+'｜'+url,
 '【来源状态】source-review-pending：这些内容是待独立核验的工作材料，不得声称已核实。先访问并核对原始来源；如无法访问，明确指出且只基于已提供资料工作，不可补造机构、统计、引文或实验结果。',
 '【额外需求】'+(notes||'无；优先准确、清晰、易读，保留自然中文与正确引用。'),
 '【参考视觉/参考约束】'+(reference||'以 KNOWA 现有深海蓝、冷白、科学杂志美术风格为基准，避免盗用未授权品牌素材。'),
 '【执行准则】先制作内容事实表（主张｜对应出处｜是否已查证｜不确定性），再建立统一视觉母版及术语表，再按媒体逐项制作。必须给出每项作品的可用文件或明确说明无法实际生成的原因。不得把规划稿写成已渲染成品，不得夸大事实。',
 '【总制作流程】P0 来源核验 → P1 科学叙事大纲和创作母版 → P2 分媒体真实制作 → P3 逐项事实/版式/分辨率/文件完整性 QA → P4 文件清单、版本、可核验素材包交付。',
 '【统一标记】在草稿及未审校内容中保留“来源待复核”。第三方核验完成后，也必须写明实际核验的来源和日期才能调整状态。'
 ];
 const video=desired?[
 '【A｜科普视频｜必须实际交付】',
 '时长：'+duration+'秒，竖版 9:16，目标 1080×1920，标准交付 MP4/H.264；帧率24或30fps。若工具不支持 MP4，声明实际格式与转换要求。',
 '开头前3秒设置一个知识悬念，科学信息不通过夸张虚构制造戏剧性。',
 '分镜表必须逐镜提供：镜号、镜头秒数、科学事实、画面主体、景别与运动、旁白、屏幕文字、音效/配乐、素材来源及验收点。',
 '预设镜头主题（可依据真实资料调整，但总时长必须不变）：\n'+outline,
 '语音旁白按每秒约3—4个汉字控制；旁白原稿与画面事实一一对应。字幕需按时轴输出独立 SRT，并保证手机可读。',
 '建立统一导演母版：色板、字体、线条、插图写实程度、图表单位和标题字号；各镜画面统一。能用真实科学图示就不要拼贴通用AI人物。',
 '视频素材不能用一张九宫格冒充多个镜头；每镜独立生成、单独验收后再合成。若支持 Motion Lab / 专业剪辑工具，可采用细粒子或线描动画，但仅用于解释知识而非全屏特效。',
 '交付：video_final.mp4（或实际支持的格式）、cover_1080x1920.png、storyboard.md、voiceover.txt、subtitles.srt、shot_assets/（独立编号素材）、sources.md、QA.md。若不具备真实渲染/导出能力，则输出完整的逐镜生图提示词、转场与合成脚本，不得声称已交付视频文件。'
].join('\n'):'';
 const poster=wantImages?[
 '【B｜科普贴图｜必须实际交付】',
 '生成 '+imageCount+' 张彼此独立的高清 3:4 竖版 PNG（每张1080×1440）。禁止合并为拼图、单张总览海报或连续截图；每张都能单独发布。',
 '内容结构：第1张采用标题+关键结论的封面视觉；中间依次围绕原理、核心事实、图解与常见误区展开；最后一张提供有边界的总结和原始来源。只有1张时保证同一张可完整传播。',
 '先提出整组统一的色板、字体、图签、科学图例和排版网格，确保尺寸、对象、用词与风格一致。风格遵循'+style+'，文字克制，保留空白。',
 '逐张提供：画面主题、三层文字（标题/核心信息/小注）、构图、可授权的参考素材、独立生图指令、校验标准。所有数字、单位、专有名词逐字校验。',
 '交付：cover.png、poster_01.png 至 poster_'+String(imageCount).padStart(2,'0')+'.png（按实际数量）、captions.md、visual_master.md、sources.md、QA.md。逐个核对文件尺寸和正文可读性，不得只输出一张拼版。'
].join('\n'):'';
 const article=wantArticle?[
 '【C｜科普文章｜必须实际交付】',
 '写一篇约 '+articleLength+' 字的原创中文科普文章：吸引人的标题、一段开门见山的结论、科学解释、直观类比、容易混淆的边界、简短总结。',
 '需要把已确认事实、推断、比喻分开写；全文不要堆术语，不复制或整段改写受版权保护的第三方原文。',
 '参考文献用可追溯链接标注并与正文关键结论相对应。不可核实的数据标为待核验，而非填入推测值。',
 '提供公众号友好版（分段合理、不使用表情符号堆砌）及一段80—130字的社交分享文案。',
 '交付：article.md、article.html（如工具能够生成文件）、summary_social.txt、sources.md、QA.md。'
].join('\n'):'';
 const final=[
 '【成套成果与验收】',
 '输出一份 production_manifest.json，逐项列出：文件名、媒体类型、尺寸/时长、是否真实生成、是否完成事实核验、实际存储位置或下载入口。生成失败必须标记 failed / not-generated，不得用计划文本冒充文件。',
 '如具备本地文件及压缩能力，请将实际文件以 KNOWA_'+kind.toUpperCase()+'_DELIVERY.zip 打包；否则分别提供可用文件/逐项拷贝内容，明示不能完成的文件。',
 '最终对照验收：①知识结论准确且来源可访问 ②全部数字与单位一致 ③视觉母版统一 ④所有镜头/海报独立交付 ⑤时长、比例和分辨率满足要求 ⑥作品无错别字 ⑦文件可打开 ⑧封面与正文一致 ⑨版权来源清晰 ⑩未完成项与原因完整披露。',
 '实际执行时按阶段自动推进，不对同一信息重复提问。只有事实来源缺失、版权冲突、无法实际执行或用户需要授权付费时，才向用户明确说明阻碍。',
 '【预期完成状态】按 Code Completed / Build Passed / Runtime Verified / Functional Tested / Production Deployed 准确标记；缺少验证绝不标为通过。',
 '【制作署名】'+identity
 ].join('\n');
 const targetAdvice={
  ChatGPT:'利用当前实际可用的图像/文件能力完成素材生成；视频若没有可用渲染功能，交付镜头脚本与可复用的分镜生图指令，不要宣称已生成MP4。',
  WorkBuddy:'如具备已授权的本地工作目录、渲染工具和文件权限，按文件清单逐一生产并执行文件检查；未经授权不得自动向外发布。',
  Gemini:'使用当前可访问的多模态工具；如果视频或文件生成受限，转交可复制的制作清单和工具适配指令，不虚构最终下载链接。',
  Claude:'优先生成严格结构化的科学脚本、分镜、文章和可执行资源清单；只有实际连接渲染器时才执行生图生视频。',
  千问:'根据当前可用的图像、视频和文件功能选择能真实完成的环节；无法渲染的内容输出可交给其他工具的完整指令。',
  其他:'先识别实际可用工具与模态，再执行对应部分；对于不支持的素材类型输出可移交制作指令，绝不伪造已交付的文件。'
 };
 const prompt=[...intro,'【'+target+' 专属执行补充】'+targetAdvice[target],video,poster,article,final].filter(Boolean).join('\n\n');
 return {ok:true,version:EXTERNAL_TASK_VERSION,target,kind,style,duration,imageCount,articleLength,prompt,storyboard:desired?steps:[],source:{title:topic,provider:sourceName,url,reviewStatus:'source-review-pending'},filePrefix:'KNOWA_'+kind.toUpperCase(),files:{video:desired,poster:wantImages,article:wantArticle}};
}
