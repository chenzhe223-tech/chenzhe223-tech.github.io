/* DAVYLAB · AI-assisted Art Direction. Generates editable specifications, NOT images. */
(function(){
"use strict";
if(typeof topics==="undefined"||typeof $!=="function")return;
const STORAGE="davylab-visual-direction-v1";
const PRESETS=[
{id:"doodle",name:"涂鸦贴纸风",bg:"#FFF8E8",primary:"#FFD640",accent:"#6E96FF",ink:"#141414",texture:"纯色奶油底、6px 粗黑描边、右下 10px 纯黑硬阴影",type:"粗黑无衬线；1080px 宽正文图文字不低于30px",layout:"左上标题胶囊＋中央单一概念＋粗黑箭头",details:"方头机器人、火柴人、四角星；彩色不超过五种",avoid:"渐变、模糊阴影、写实照片、emoji、文字过密"},
{id:"editorial",name:"科技杂志风",bg:"#F7F5EE",primary:"#19314B",accent:"#3C82EC",ink:"#14253A",texture:"暖白纸感、克制照片/概念拼贴、低对比纹理",type:"高对比衬线大标题＋清爽中文无衬线",layout:"杂志网格；左侧标题，右侧主视觉，适度留白",details:"科技概念物、真实来源图像和精准图注",avoid:"霓虹紫蓝、无意义机器人、未经授权的现实人物照片"},
{id:"diagram",name:"知识信息图",bg:"#FFF9EE",primary:"#386D69",accent:"#F5B94E",ink:"#19302E",texture:"干净矢量几何和轻微印刷质感",type:"清晰无衬线；标题、步骤、注释三级",layout:"流程图或知识卡网格，沿阅读方向排列",details:"一图一个原理；最多四个步骤与关键箭头",avoid:"长段小字、假数据、模型自由生成复杂文字"},
{id:"business",name:"商业报告风",bg:"#F5F6F4",primary:"#213449",accent:"#CF9B44",ink:"#142230",texture:"高端研报纸感、精细分隔线、严谨图表",type:"数字对齐、清晰的单位和数据注释",layout:"一张主图表配一条核心结论",details:"所有数值标注日期、口径、单位和来源",avoid:"编造图表、夸大数字、投资收益保证"},
{id:"comic",name:"纪实漫画风",bg:"#F4EDE1",primary:"#32485C",accent:"#D47E59",ink:"#201C1A",texture:"手绘版画颗粒、故事分镜线条",type:"短旁白，中文文字后期可控排版",layout:"单一戏剧场景＋视线方向清晰的分镜",details:"统一人物设定；事实与改编明确区分",avoid:"伪造新闻现场、侵犯肖像、文字溢出"},
{id:"minimal",name:"极简产品风",bg:"#F6F8FB",primary:"#264769",accent:"#55A7C4",ink:"#17212C",texture:"苹果式极简几何、轻材质、柔和自然光",type:"精炼产品标题、克制信息层级",layout:"一个产品核心界面为主，四周留白",details:"只使用真实已验证的产品界面和功能",avoid:"假截图、伪造按钮、虚构已经上线的能力"}
];
let activeId="",choices=[],index=0,loading=false;
const el=id=>document.getElementById(id);
const esc=v=>typeof safe==="function"?safe(v):String(v).replace(/</g,"&lt;");
const short=(v,n=800)=>String(v||"").replace(/[\u0000-\u001f]/g," ").trim().slice(0,n);
const hex=(v,f)=>/^#[0-9a-fA-F]{6}$/.test(String(v||""))?String(v).toUpperCase():f;
function topic(){return topics.find(x=>x.id===activeId)||null}
function theme(){return short(el("vdTheme")?.value,180)}
function context(){return [theme(),topic()?.angle||topic()?.summary||"",el("vdContext")?.value||""].join(" ").slice(0,2600)}
function isLab(){return /AI 实验室合集|DAVYLAB.*AI 实验室|涂鸦贴纸/.test(context()+" "+(topic()?.column||""))}
function chooseIds(s){
 if(isLab())return["doodle","diagram","minimal"];
 const x=String(s||"").toLowerCase();
 if(/漫画|小说|故事|历史|人物|worldtoon/.test(x))return["comic","editorial","doodle"];
 if(/采购|成本|财报|市场|投资|经济|结算|金融|商业|数据/.test(x))return["business","editorial","diagram"];
 if(/supabase|skill|agent|智能体|原理|教程|学习|科普|rag|数据库|知识|模型/.test(x))return["diagram","doodle","editorial"];
 if(/应用|设计|界面|产品|开发|工具|部署|logo|ui/.test(x))return["minimal","editorial","diagram"];
 return["editorial","doodle","diagram"];
}
function fromPreset(id){const p=PRESETS.find(x=>x.id===id)||PRESETS[0];return{preset:p.id,name:p.name,background:p.bg,primary:p.primary,accent:p.accent,text:p.ink,texture:p.texture,typography:p.type,composition:p.layout,details:p.details,avoid:p.avoid,mood:"清晰、克制、富有辨识度",extra:"",artDirection:"",source:"rule"}}
function picks(){return chooseIds(context()).map(fromPreset)}
function updateSelect(){
 const s=el("vdSelectTopic");if(!s)return;
 s.innerHTML='<option value="">自由策划（不关联选题）</option>'+topics.filter(t=>t.status!=="published").map(t=>'<option value="'+esc(t.id)+'">'+esc((t.title||"无标题").slice(0,48))+'</option>').join("");
 s.value=topic()?activeId:"";
}
const FIELDS={vdBackground:"background",vdPrimary:"primary",vdAccent:"accent",vdTextColor:"text",vdMood:"mood",vdTexture:"texture",vdTypography:"typography",vdComposition:"composition",vdDetails:"details",vdAvoid:"avoid",vdExtra:"extra",vdArtDirection:"artDirection"};
function capture(){
 const c=choices[index];if(!c)return;
 for(const [id,key] of Object.entries(FIELDS))if(el(id))c[key]=el(id).value;
}
function populate(c){
 for(const [id,key] of Object.entries(FIELDS))if(el(id))el(id).value=c[key]||"";
 el("vdPreset").value=c.preset||"custom";renderPreview();
}
function renderCards(){
 const root=el("vdChoiceCards");if(!root)return;
 root.innerHTML=choices.map((c,i)=>'<button class="vd-choice '+(i===index?"selected":"")+'" type="button" data-vd-choice="'+i+'" aria-pressed="'+(i===index)+'"><span class="vd-mini" style="--vb:'+hex(c.background,"#ffffff")+';--vp:'+hex(c.primary,"#222222")+';--va:'+hex(c.accent,"#cccccc")+'"><i></i><b></b></span><span class="vd-choice-copy"><strong>'+esc(c.name)+'</strong><small>'+(c.source==="ai"?"AI 方向 · 配色规则映射":"规则匹配 · 可自定义")+'</small></span><span class="vd-choose">'+(i===index?"已选":"选择")+'</span></button>').join("");
 root.querySelectorAll("[data-vd-choice]").forEach(b=>b.addEventListener("click",()=>{capture();index=+b.dataset.vdChoice;renderCards();populate(choices[index]);notice("可以逐项修改配色、构图、材质和画面细节。")}));
}
function renderPreview(){
 const c=choices[index];if(!c)return;
 const parts=[["--vb",hex(c.background,"#FFF8E8")],["--vp",hex(c.primary,"#FFD640")],["--va",hex(c.accent,"#6E96FF")],["--vi",hex(c.text,"#141414")]];
 for(const id of ["vdPreviewStage","vdInnerPreview"]){const stage=el(id);if(stage){parts.forEach(p=>stage.style.setProperty(p[0],p[1]));stage.dataset.preset=c.preset||"custom"}}
 if(el("vdPreviewTitle"))el("vdPreviewTitle").textContent=theme()||"一篇文章的专属视觉";
 if(el("vdInnerSubtitle"))el("vdInnerSubtitle").textContent=(c.composition||"一图一个概念").slice(0,42);
 el("vdSwatches")?.querySelectorAll("i").forEach((node,i)=>node.style.background=parts[i][1]);
}
function notice(text,kind="info"){const e=el("vdFeedback");if(e){e.textContent=text;e.dataset.kind=kind}}
function rules(){
 if(!theme()){notice("请先选择选题或输入文章主题。","error");return}
 choices=picks();index=0;renderCards();populate(choices[0]);
 notice("已按文章主题与品牌规范推荐三套方案（规则匹配，非模型调用）。","success");
}
function normalize(raw){
 const base=fromPreset(raw.preset),c={...base,...raw};
 for(const k of ["background","primary","accent","text"])c[k]=hex(raw[k],base[k]);
 for(const k of ["texture","typography","composition","details","avoid","mood","extra","artDirection"])c[k]=short(raw[k]||base[k],1000);
 return c;
}
function load(id){
 activeId=id||"";updateSelect();
 const t=topic();
 if(t){el("vdTheme").value=t.title||"";el("vdContext").value=short(t.angle||t.summary,1800)}
 if(t?.visualPlan?.version===1){
  choices=[normalize(t.visualPlan),...picks().slice(1)];index=0;renderCards();populate(choices[0]);
  notice("已恢复这篇文章保存的视觉规范；不会覆盖原有修改。","success");return;
 }
 rules();
}
function spec(){
 if(!theme())return"";
 capture();const c=choices[index];if(!c)return"";
 const t=topic();
 return [
 "# DAVYLAB · 文章配图视觉制作规范（草稿）","",
 "文章主题："+theme(),"栏目："+(t?.column||"未关联"),"状态：draft（待审核）；未生成实际图片。",
 "方向来源："+(c.source==="ai"?"AI 提出风格描述；配色/参数由规则映射并可自定义":"DAVYLAB 主题规则推荐"),
 "","## 整体视觉","风格："+c.name,"背景："+hex(c.background,"#FFF8E8"),"主色："+hex(c.primary,"#FFD640"),"点缀色："+hex(c.accent,"#6E96FF"),"文字色："+hex(c.text,"#141414"),
 "情绪："+c.mood,"材质："+c.texture,"排版："+c.typography,"构图："+c.composition,"核心元素："+c.details,"避免："+c.avoid,
 "AI 艺术指导："+(c.artDirection||"无"),"自定义要求："+(c.extra||"无"),"",
 "## 图片交付清单",
 "1. 文章封面 900×383：标题“"+theme()+"”；左上角标题区域，单一核心视觉，署名 DAVYLAB。",
 "2. 正文图 1080px 宽：根据正文段落选择一个最重要的概念，不凭空生成事实、数据与截图。",
 "3. 图中文字应先形成校对清单，建议使用后期可控排版；全部按统一视觉规范制作。","",
 "## 质量验收",
 "- 每张图逐一核验文字完整、版权来源、移动端阅读、真实数据、高清尺寸和系列一致性。",
 "- 这里是可执行配图规范，不等于图片已生成，更不代表公众号已获发布授权。"
 ].join("\n");
}
function save(){
 capture();const c=choices[index];if(!c||!theme()){notice("请先选择方案并填写主题。","error");return}
 const value={...normalize(c),articleTheme:theme(),version:1,reviewStatus:"draft",assetStatus:"not_generated",updatedAt:new Date().toISOString()};
 const t=topic();if(t){t.visualPlan=value;saveTopics();notice("方案已关联选题保存。只有视觉草稿，没有生成图片。","success")}
 else{localStorage.setItem(STORAGE,JSON.stringify(value));notice("自由策划方案已保存至当前浏览器。","success")}
}
function download(){
 const value=spec();if(!value){notice("请先输入主题。","error");return}
 const blob=new Blob([value],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="DAVYLAB_文章配图规范_"+new Date().toISOString().slice(0,10)+".md";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);notice("已导出 Markdown 制作规范，尚未生成图片。","success");
}
async function ai(){
 if(!theme()){notice("先填写文章主题。","error");return}
 if(!nianboxToken){notice("AI 深度匹配需要连接念头盒账号；未登录可继续使用规则推荐。","error");return}
 if(loading)return;
 loading=true;const btn=el("vdAiMatch");btn.disabled=true;btn.textContent="分析中…";
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const adjustment="围绕这一篇已确定的文章，只提供三个差异明显的视觉配图方向，不另起选题。每个方案必须填写 title（风格名）、shortLabel（短名称）、angle（色彩和气质及选择原因）、visual（插画或摄影类型、构图、字体、纹理、主体物、易犯错误）。避免空泛表达，只说明可执行的视觉设计。";
  const r=await fetch(NIANBOX_API+"/ai/topic-directions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+nianboxToken},body:JSON.stringify({input:"DAVYLAB 公众号文章主题："+theme()+"\n核心内容："+context().slice(0,1800),adjustment}),signal:controller.signal});
  let data={};try{data=await r.json()}catch{}
  if(!r.ok||data.configured===false)throw Error(data.message||data.error||("AI 服务 HTTP "+r.status));
  const rows=Array.isArray(data)?data:(data.directions||data.choices||[]);
  if(!Array.isArray(rows)||!rows.length)throw Error("AI 未返回有效视觉方向。");
  const cleaned=rows.filter(x=>x&&(x.visual||x.angle)).slice(0,3);
  if(!cleaned.length)throw Error("AI 返回内容缺少视觉描述。");
  choices=cleaned.map((d,i)=>{
   const description=[d.title,d.visual,d.angle].filter(Boolean).join(" ");
   const id=isLab()?(i===0?"doodle":chooseIds(context())[i]):chooseIds(description)[0];
   return{...fromPreset(id),name:short(d.title||d.shortLabel||"AI 视觉方向",50),artDirection:short([d.visual,d.angle].filter(Boolean).join("；"),950),source:"ai"};
  });
  index=0;renderCards();populate(choices[0]);
  notice("模型已返回 "+choices.length+" 个视觉方向；颜色与细节控件根据风格规则提供初值，支持自定义。没有生成实际图片。","success");
 }catch(err){notice("AI 分析未完成："+(err.name==="AbortError"?"请求超时":String(err.message||err))+"。当前规则方案保留。","error")}
 finally{clearTimeout(timer);btn.disabled=false;btn.textContent="AI 深度匹配";loading=false}
}
function setup(){
 if(!el("section-visual"))return;
 el("vdPreset").innerHTML=PRESETS.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join("")+'<option value="custom">自定义混合</option>';
 updateSelect();
 el("vdSelectTopic").addEventListener("change",e=>load(e.target.value));
 el("vdRuleMatch").addEventListener("click",rules);
 el("vdAiMatch").addEventListener("click",ai);
 el("vdConnect").addEventListener("click",()=>{const d=el("importDialog");if(d?.showModal&&!d.open)d.showModal();notice("在弹窗连接念头盒账号后，返回这里点击 AI 深度匹配。")});
 el("vdPreset").addEventListener("change",e=>{
  capture();const prev=choices[index],id=e.target.value;if(id==="custom"){prev.preset="custom";renderCards();renderPreview();return}
  choices[index]={...fromPreset(id),mood:prev.mood,extra:prev.extra,artDirection:prev.artDirection,source:prev.source};
  renderCards();populate(choices[index]);notice("已切换模板，保留了用户自定义补充。")
 });
 for(const id of Object.keys(FIELDS))el(id)?.addEventListener("input",()=>{capture();if(["vdBackground","vdPrimary","vdAccent","vdTextColor"].includes(id))renderPreview()});
 el("vdTheme").addEventListener("input",renderPreview);
 el("vdSave").addEventListener("click",save);
 el("vdCopy").addEventListener("click",()=>{const s=spec();if(s)copyText(s,"已复制配图制作规范");else notice("请先输入主题。","error")});
 el("vdExport").addEventListener("click",download);
 const originalRender=renderTopics;
 renderTopics=function(){originalRender();el("topicList")?.querySelectorAll(".topicactions").forEach(root=>{
  const original=root.querySelector("[data-a='edit']");if(!original||root.querySelector("[data-vd-open]"))return;
  const button=document.createElement("button");button.type="button";button.className="btn small";button.dataset.vdOpen=original.dataset.id;button.textContent="配图策划";
  root.insertBefore(button,original);
 })};
 el("topicList")?.addEventListener("click",event=>{const b=event.target.closest("[data-vd-open]");if(!b)return;changeSection("visual");load(b.dataset.vdOpen)});
 const previousChange=changeSection;
 changeSection=function(section){previousChange(section);if(section==="visual"){el("crumbTitle").textContent="配图策划";updateSelect();renderPreview()}};
 let draft=null;try{draft=JSON.parse(localStorage.getItem(STORAGE)||"null")}catch{}
 if(draft?.version===1){el("vdTheme").value=draft.articleTheme||"";choices=[normalize(draft),...picks().slice(1)]}
 else choices=picks();
 index=0;renderCards();populate(choices[0]);renderTopics();
}
window.DAVYLABVisualDirection={version:"1.0.0",chooseIds,fromPreset,spec,rules,load,ai,presets:PRESETS.map(x=>x.id)};
setup();
})();