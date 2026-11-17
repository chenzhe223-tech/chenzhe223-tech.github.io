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
const VERSION="1.0.0-p0";
const PLATFORMS=Object.freeze({
 chatgpt:{label:"ChatGPT",note:"根据本对话实际提供的搜索、图像生成、文件写入与压缩工具逐一验证；Chat 模式和 Work 模式能力可能不同。",link:"https://chatgpt.com/"},
 claude:{label:"Claude",note:"检查当前 Claude 会话是否实际具备网页研究、图像生成与文件/ZIP 输出工具；不要把文字描述的图片当作生成成功。",link:"https://claude.ai/"},
 gemini:{label:"Gemini",note:"检查当前 Gemini 会话是否支持事实检索、生图、文件落盘与 ZIP 打包；不同产品界面与套餐能力可能不同。",link:"https://gemini.google.com/"},
 other:{label:"其他 AI",note:"先列出本次会话可调用的真实工具，逐项验证；仅凭模型名称不得推断工具可用。",link:""}
});
const required=["来源研究与网页访问","真实图片生成/编辑","写入 Markdown、HTML、JPG 文件","本地执行或等效文件检查","ZIP 创建、解压验证、下载链接"];
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
function build(topic,options={}){
 if(!topic||typeof topic!=="object")throw Error("必须先选择有效选题");
 const mode=options.mode==="planning"?"planning":"production";
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
 "【执行前能力门禁】先根据当前实际可调用工具逐项确认："+required.join("；")+"。",
 "平台能力提示（非实时检测）："+p.note,
 "不能仅凭所属平台声称已具备以上能力。工具实际不可用时必须逐项列出缺口、明确标记 BLOCKED，不得生成假的下载链接、假 JPG、假 ZIP、占位图片或将规划当成果。",
 "【任务输入】",...metadata,...visual(topic),
 "【品牌与审批边界】署名统一 DAVYLAB；只写经证实的事实，作者未提供的经历标为待确认；使用 AI 辅助说明；未经作者批准不得视为 approved 或向公众号发表；图片来源和版权需核验。",
 "如内容涉及协助写作 AI 的开发商，披露相关关系；财经内容标注不构成投资建议。"
 ];
 if(mode==="planning")return{
  mode,platform:id,platformLabel:p.label,manifest:[],requiresFullCapability:false,
  text:[...intro,"","【仅策划模式｜明确不交付实物】","完成来源调查、文章结构与完整文章草稿、封面和正文图逐张视觉说明及制作提示词。不要声称已生成图片、HTML 或 ZIP。","输出事实核查清单、待核实项目、完整草稿和图片制作说明。状态统一标识为 PLAN_ONLY，不得标记成套素材包已交付。"].join("\n")
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
 return{mode,platform:id,platformLabel:p.label,manifest,requiresFullCapability:true,text:[...intro,...production].join("\n")};
}
return Object.freeze({VERSION,PLATFORMS,required,manifest,build});
});
