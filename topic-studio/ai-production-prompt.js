/* DAVYLAB Topic Studio | P0 production instruction generator.
 * Produces an instruction ONLY; never claims to have created assets.
 * Pure UMD module for browser and Node regression tests.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.DAVYLABProductionPrompt=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const VERSION="1.1.0-finance";
const PLATFORMS=Object.freeze({
 chatgpt:{label:"ChatGPT",note:"根据本对话实际提供的搜索、图像生成、文件写入与压缩工具逐一验证；Chat 模式和 Work 模式能力可能不同。",link:"https://chatgpt.com/"},
 claude:{label:"Claude",note:"检查当前 Claude 会话是否实际具备网页研究、图像生成与文件/ZIP 输出工具；不要把文字描述的图片当作生成成功。",link:"https://claude.ai/"},
 gemini:{label:"Gemini",note:"检查当前 Gemini 会话是否支持事实检索、生图、文件落盘与 ZIP 打包；不同产品界面与套餐能力可能不同。",link:"https://gemini.google.com/"},
 other:{label:"其他 AI",note:"先列出本次会话可调用的真实工具，逐项验证；仅凭模型名称不得推断工具可用。",link:""}
});
const required=["来源研究与网页访问","真实图片生成/编辑","写入 Markdown、HTML、JPG 文件","本地执行或等效文件检查","ZIP 创建、解压验证、下载链接"];
const planningRequired=["来源研究与网页访问","文本撰写与结构化编辑"];
const planningDeliverables=["事实研究与选题分析","备选标题与推荐理由","文章大纲及核心观点结构","封面与正文配图方案、生图提示词","编辑建议、风险提示与待核实清单"];
function buildPlanningContent(){
 return [
  "","【B｜内容策划模式｜独立交付标准】",
  "这是 PLAN_ONLY 策划任务，不要求实际生图、HTML 成品、JPG 文件、ZIP 文件或下载链接；不要声称已生成图片，不能将策划标记为生产完成。",
  "1. 事实研究及选题分析：汇总可查证的原始来源、发布时间、事实结论和争议点；区分事实、作者判断、待核实事项。无法访问外部来源时说明研究限制。",
  "2. 标题：给出三个具有不同切入角度的候选标题（每个不超过30字）、推荐理由与目标读者匹配说明。",
  "3. 文章大纲：提供开头钩子、分级结构、每节核心观点、证据需求、生活类比及边界、可执行行动清单和结尾互动问题；此模式交付的是大纲，不得冒充完整正式成稿。",
  "4. 配图策划：拟定一张封面和至少三张正文图的主题、构图、准确文字、比例、配色及逐张可复用的生图提示词，严格继承已保存的视觉方案；写明图片尚未生成。",
  "5. 编辑建议：指出风险、事实核查缺口、作者需确认的真实经历、版权与平台发布约束；附下阶段生产的执行建议。",
  "【策划交付清单】"+planningDeliverables.join("；")+"。",
  "【状态】仅在策划文本确实完成时可标记 PLAN_ONLY；不得报告素材生产完成、素材验收通过或可下载 ZIP。"
 ];
}
const manifest=[
 "DAVYLAB_文章主题_公众号素材包/01_公众号完整成稿.md",
 "DAVYLAB_文章主题_公众号素材包/02_公众号排版预览.html",
 "DAVYLAB_文章主题_公众号素材包/03_使用说明.txt",
 "DAVYLAB_文章主题_公众号素材包/04_事实核查与来源.md",
 "DAVYLAB_文章主题_公众号素材包/images/00_封面.jpg",
 "DAVYLAB_文章主题_公众号素材包/images/01_正文配图.jpg",
 "DAVYLAB_文章主题_公众号素材包/images/02_正文配图.jpg",
 "DAVYLAB_文章主题_公众号素材包/images/03_正文配图.jpg"
];
function v(x,max=2000){return String(x??"").trim().slice(0,max)}
function linesOf(value,label){
 if(value==null||value==="")return[];
 const str=typeof value==="string"?value:JSON.stringify(value);
 return [label+"："+v(str,2600)];
}
function visual(t){
 const a=t?.visualPlan;
 if(!a||a.version!==1)return ["【图片风格】当前选题未保存专属配图方案；按所属栏目规范提出视觉风格，不得自行声称作者已确认。"];
 const props=[["指定风格","name"],["预设 ID","preset"],["背景色","background"],["主色","primary"],["点缀色","accent"],["文字色","text"],["情绪气质","mood"],["材质纹理","texture"],["字体排版","typography"],["画面构图","composition"],["标志性元素","details"],["明确禁忌","avoid"],["AI 艺术指导","artDirection"],["作者补充要求","extra"]];
 return ["【已保存的配图视觉方案｜必须遵守】","以下配置来源于该选题已保存的 visualPlan，禁止默默替换风格、色值或特殊限制。",...props.flatMap(([name,key])=>linesOf(a[key],name)), "视觉方案状态："+v(a.reviewStatus||"draft")+"；图片状态："+v(a.assetStatus||"not_generated")+"（此为输入状态，不能视为图片交付）。"];
}

const financeStyles=Object.freeze([
 {id:"business-editorial",name:"国际商业杂志",background:"#10223B",primary:"#F4F5F4",accent:"#BE9B62",direction:"深海军蓝与暖白，大幅社论式标题、克制金色细线、清晰主图；国际商业周刊封面感"},
 {id:"investment-research",name:"机构财经研报",background:"#F7F9FC",primary:"#192C48",accent:"#9F8054",direction:"暖白纸感、深蓝精确网格，数据重点突出，有出处的图表后期精确绘制；机构研究报告感"},
 {id:"capital-blackgold",name:"黑金资本杂志",background:"#101116",primary:"#F3EEE3",accent:"#CBAA71",direction:"雅黑与哑金，宽留白、极简图形与大号字体；不使用廉价金属光效"},
 {id:"global-finance",name:"环球财经蓝白",background:"#F0F5FB",primary:"#163A71",accent:"#277EC5",direction:"清爽国际蓝白，世界地图与金融建筑图形，统一栅格与蓝色视觉线索"},
 {id:"market-breaking",name:"财经头条红黑",background:"#19202C",primary:"#F6F6F2",accent:"#CE3142",direction:"深石墨配胭脂红，新闻突发标题、强对比，涨跌色以实际市场区域约定为准"},
 {id:"minimal-tech-finance",name:"极简科技财经",background:"#EAF0F7",primary:"#213753",accent:"#7EA5D0",direction:"银灰与深海蓝，精密网格、大留白、克制科技线条，清晰可信的商业资讯"}
]);
const financeRequired=["联网检索原始来源并核验发布时间和关键数字","生成1～3张真正独立的图片文件","图中文字与图表采用可控排版","生成文件/ZIP并实际解压与尺寸验收"];
const financeManifest=[
 "DAVYLAB_财经主题_贴图素材包/01_财经快报.md",
 "DAVYLAB_财经主题_贴图素材包/02_逐条来源与数据核验.md",
 "DAVYLAB_财经主题_贴图素材包/03_图片文字与尺寸QA.md",
 "DAVYLAB_财经主题_贴图素材包/posters/01_专题海报.png",
 "按实际选择数量另含 posters/02、03_专题海报.png"
];
function buildFinance(topic,options,p,metadata){
 const style=financeStyles.find(s=>s.id===options.style)||financeStyles[0];
 const count=Math.min(3,Math.max(1,Math.floor(Number(options.posterCount)||1)));
 const src=String(topic.sourceUrl||topic.url||"待核实");
 const text=[
 "你是 DAVYLAB 全球财经资讯编辑、财经事实核查员和高级商业杂志美术总监。",
 "【C｜财经快报＋独立专题海报｜必须实际生产】",
 "任务是简短财经资讯贴图，不是长篇文章。禁止套用原 A 模式的1800–2500字文章、封面＋三张文章插图模板。",
 "选题标题："+String(topic.title||"未命名财经选题"),
 "切入角度："+String(topic.angle||topic.summary||"待核实"),
 "一手资料链接："+src,
 "辅助导读："+String(topic.summary||"无").slice(0,1200),
 "来源："+String(topic.sourceName||"未记录")+"；素材发布时间："+String(topic.sourcePublishedAt||topic.published||"待核实"),
 "作者署名：By DAVYLAB；目标 AI："+p.label,
 ...metadata,
 "【真实性门槛】先打开并核查权威/一手来源；必须区分财报原文、监管公告、新闻报道、分析观点。每项指标标注绝对单位、币种、财季/日期、同比/环比口径、时区。未核实数字、虚构股价/涨跌幅和由生图模型凭空写出的金融图表一律禁止。存在矛盾时标记待核实，宁可删掉数据也不捏造。",
 "【短文案】用中文输出：1个吸睛但准确的主标题（≤26字），1句核心结论，100～300字财经快报正文（发生了什么→关键数字/事实→对市场或行业的意义与边界），≤100字公众号贴图配文，1条朋友圈短文案，完整来源链接及时间；末尾注明“信息仅供参考，不构成投资建议”与 AI 协助整理声明。不得凭空推断涨跌原因或投资回报。",
 "【真实独立海报】数量："+count+"张；一张一主题，不能拼成九宫格/总览图，不能把方案描述当成图片。每张按公众号贴图竖版 1080×1440 输出 PNG；所有图片均有独立文件，风格一致，内容各不重复。",
 "【选定风格】"+style.name+"（"+style.id+"）；背景"+style.background+"，主要文字色"+style.primary+"，点缀色"+style.accent+"。视觉方向："+style.direction+"。",
 "第1张：商业杂志封面，唯一核心财经结论+已核实的最重要数字/事件。"+(count>=2?"第2张：核心业务、分市场/分板块的准确对比与注释。":""),
 count>=3?"第3张：驱动因素、影响与风险，明确将预测与事实分开。":"",
 "【制作规范】高级商业/财经杂志而非互联网促销海报；留白与专业字体、版面网格优先。图片背景可用图像工具制作，但所有中文、数字、Logo与统计图应在可控排版软件或代码中叠加。严禁虚构K线、指数和价格；没有数据时使用概念图，明确不冒充真实走势。",
 "【文件交付】实际生成 01_财经快报.md、02_逐条来源与数据核验.md、03_图片文字与尺寸QA.md、对应独立PNG后压缩为一个ZIP，解压核对标题/图内文字/数字/单位/日期/出处、数量和每张1080×1440尺寸，再提供真实可访问下载链接。不能生图或落盘时必须报告阻塞原因，不得称已交付。",
 "【审批】当前均为 draft；不自动同步公开仓库中的未发表文章，不调用微信发表。未经作者 approved 禁止发布。",
 "【工具门槛】"+financeRequired.join("；")+"；若不能满足，明确列明缺口和实际完成的项目。",
 "【最终输出】先给1段财经快报，再逐张给海报素材文件与下载素材包，最后给事实与图片QA清单。不得以一张多图拼版、文案或绘图提示词替代素材。"
 ];
 return {mode:"finance",platform:options.platform||"chatgpt",platformLabel:p.label,style:style.id,posterCount:count,
         manifest:financeManifest.slice(),deliverables:financeManifest.slice(),capabilityRequirements:financeRequired.slice(),requiresFullCapability:true,text:text.filter(Boolean).join("\n")};
}

function build(topic,options={}){
 if(!topic||typeof topic!=="object")throw Error("必须先选择有效选题");
 const mode=options.mode==="finance"?"finance":options.mode==="planning"?"planning":"production";
 const needs=mode==="planning"?planningRequired:required;
 const id=Object.hasOwn(PLATFORMS,options.platform)?options.platform:"chatgpt";
 const p=PLATFORMS[id];
 const title=v(topic.title||topic.angle||"未命名选题");
 const metadata=[
 "【已确认选题】"+title,
 "【切入观点】"+v(topic.angle||topic.why||topic.summary||"待补充"),
 "【现有摘要】"+v(topic.summary||"待补充"),
 "【素材原标题】"+v(topic.sourceTitle||title),
 "【来源名称】"+v(topic.sourceName||"未记录"),
 "【原始来源】"+v(topic.sourceUrl||topic.url||"待核实"),
 "【作者】DAVYLAB",
 "【栏目】"+v(topic.column||"待确定"),
 "【内容形式】"+v(topic.format||"文章"),
 "【目标读者】"+v(topic.targetAudience||"对 AI 感兴趣的非程序员、普通职场人及 AI 学习者"),
 "【语言风格】"+v(topic.writingStyle||"第一人称学习者视角，通俗但准确；不杜撰个人经历"),
 "【篇幅要求】"+v(topic.wordCount||topic.length||"建议 1800–2500 字，以内容价值为准"),
 ...linesOf(topic.notes||topic.editorNotes,"作者备注"),
 ...linesOf(topic.specialRequirements||topic.constraints,"特殊限制"),
 ...linesOf(topic.revisionHistory||topic.editHistory||topic.changeLog,"作者修改记录（如有）"),
 ...linesOf(topic.updatedAt,"选题最后更新")
 ];
 const intro=[
 "你是 DAVYLAB 的公众号生产编辑、事实核查员、视觉制作人与交付 QA。品牌主张：把想法，做成能用的工具。",
 "这是交给外部 AI 的【执行指令】，不是已完成的文件或图片。不得假装自己具备当前会话不存在的工具。",
 "【目标执行平台】"+p.label,
 "【执行前能力门禁】先根据当前实际可调用工具逐项确认："+needs.join("；")+"。",
 "平台能力提示（非实时检测）："+p.note,
 "不能仅凭所属平台声称已具备以上能力。工具缺失时说明缺口并明确标记 BLOCKED；不得虚报研究完成、已产图片、HTML、ZIP、下载链接或素材验收。",
 "【任务输入】",...metadata,...visual(topic),
 "【品牌与审批边界】署名统一 DAVYLAB；只写经证实的事实，作者未提供的经历标为待确认；使用 AI 辅助说明；未经作者批准不得视为 approved 或向公众号发表；图片来源和版权需核验。",
 "如内容涉及协助写作 AI 的开发商，披露相关关系；财经内容标注不构成投资建议。"
 ];
 if(mode==="finance")return buildFinance(topic,options,p,metadata.concat(visual(topic)));
 if(mode==="planning")return{
  mode,platform:id,platformLabel:p.label,manifest:[],deliverables:planningDeliverables.slice(),
  capabilityRequirements:planningRequired.slice(),requiresFullCapability:false,
  text:[...intro,...buildPlanningContent()].join("\n")
 };
 const production=[
 "","【交付目标｜必须实际执行】",
 "完成事实研究 → 文章创作 → 真实生图 → 图文排版 → 素材打包 → QA 验收 → ZIP 下载。除非关键能力缺失，直接执行完整流程，不要停在图片规划或询问是否继续。",
 "1. 事实研究：优先找一手资料，保留每项关键主张的原始 URL、发布时间、核对结论。区分已核实／作者判断／未核实；不得伪造来源。无法联网则标记研究能力缺口。",
 "2. 完整文章：产出可直接编辑发布的正文而非提纲，包含≤30字的3个候选标题、推荐标题与理由、署名 DAVYLAB、开头钩子、通俗概念解释、正文、≤5条行动清单、术语词典、来源与 AI 协助声明。另给≤120字摘要、2–3版朋友圈文案、互动问题及下一篇预告。没有证据的经历不要编造。",
 "3. 实际生图：必须生成一张真实 900×383 封面 JPG 和至少三张独立、真实的正文 JPG（建议宽 1080px），逐张落实指定风格与精确色值，不得用占位图、重复图、文字提示词或空白画布代替。文字后期可控排版并检查错字；不制造虚假产品截图。若选题视觉方案指定不同规格，除交付基础 JPG 外另附加对应格式。",
 "4. 图文排版：将四张 JPG 嵌入正文合理位置；编写独立可打开的 HTML，使用 images/ 的相对路径、宽度自适应（max-width:100%）与清晰图注。Markdown 也要引用真实图片路径；确保断网打开 HTML 时本地资源可加载。",
 "5. 素材打包：在实际文件系统创建以下目录及文件（根目录名用安全的文章主题替换）：",
 ...manifest.map(x=>"  "+x),
 "03_使用说明.txt 记录图片尺寸、相对路径、公众号粘贴方法、已完成/待确认项和版权注意；04_事实核查与来源.md 逐条列出核对结果、证据链接与未核实事项。不得把图片提示词或文件清单当作实际文件。",
 "6. 质量验收必须由真实文件检查而非口头自评：Markdown 文章完整；观点与标题一致；来源可追溯；4 张不同的真实图片可解码且尺寸满足要求；文字与保存风格符合；HTML 本地打开无资源 404；ZIP 真正存在、可解压并包含全部要求文件、无空文件。",
 "7. 实际压缩上述根目录为 DAVYLAB_文章主题_公众号素材包.zip，解压复核后返回当前环境可点击的真实下载链接。绝不捏造 sandbox 路径、平台下载链接或上传成功状态。",
 "【验收状态】只有所有核心项 PASS 且 ZIP 已验证可下载，才能标注 COMPLETE；缺工具或某环节失败标记 BLOCKED / INCOMPLETE，准确列出缺口和已产生的文件，不能将任务转为仅策划并冒称完成。",
 "【执行顺序】优先直接制作和验收；按当前会话实际能力选择合法工具。若研究、生图、创建文件或压缩能力缺失，应说明缺哪一项、不能交付完整素材包，并仅交付真实已经完成的部分。"
 ];
 return{mode,platform:id,platformLabel:p.label,manifest,deliverables:manifest.slice(),capabilityRequirements:required.slice(),requiresFullCapability:true,text:[...intro,...production].join("\n")};
}
return Object.freeze({VERSION,PLATFORMS,required,planningRequired,planningDeliverables,manifest,financeStyles,financeRequired,financeManifest,build});
});
