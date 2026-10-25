/* MelodyMe Poster Design System v1.0
 * AI produces background artwork only; verified text is composed by the frontend.
 * Quality claims are deliberately split: technical checks are automated, visual style is not
 * automatically scored unless a real vision evaluator is configured.
 */
(function (root) {
  "use strict";
  var commonNegative = "text, letters, words, typography, logo, watermark, QR code, fake UI, fake data, cropped focal subject, cluttered composition, low resolution, blurry details, compression artifacts, distorted anatomy, duplicated objects, oversharpening";
  var modes = [
    {styleId:"cinematic",styleName:"电影感氛围",englishName:"Cinematic Mood",designIntent:"独立电影剧照般的叙事空间与克制情绪",compositionRules:"纵向3:4；前景、中景、背景分层；单一视觉焦点；上方或侧边保留至少20%干净文字区",palette:["午夜蓝","深蓝","暗青","少量暖光"],lighting:"单一可信主光源：月光、窗光、路灯或夕阳；自然景深与受控反差",materials:"真实电影摄影、细腻胶片颗粒、自然景深",subjectGuidance:"孤独人物剪影、叙事性环境或有情绪暗示的风景，只选一个主主体",negativePrompt:"廉价霓虹渐变、无意义光斑、满屏粒子、杂乱背景、过度锐化、塑料质感、多个竞争焦点",reservedTextZones:["top 18%","left 22%"],qualityChecks:["明确单一主体","前中后景可辨","光源合理","标题区低细节"],promptVersion:"1.0"},
    {styleId:"geometric",styleName:"几何排版艺术",englishName:"Geometric Modernist",designIntent:"瑞士现代主义、编辑网格与几何构成",compositionRules:"模块网格、清晰基线、控制不对称；图形按网格对齐；留白至少25%",palette:["暖白","黑","深蓝","单一强调色"],lighting:"平面设计优先；若含摄影主体则使用均匀编辑光",materials:"哑光纸面、几何色块、圆形、矩形、弧线",subjectGuidance:"几何构成或被网格整合的单个人物摄影，不能变成普通照片",negativePrompt:"随机色块、超过3种主色、无基准线、杂乱装饰、照片主导、图片内大段文字",reservedTextZones:["top 22%","bottom 18%"],qualityChecks:["几何秩序明显","主色不超过3种加点缀","网格对齐","留白充足"],promptVersion:"1.0"},
    {styleId:"surreal",styleName:"超现实梦境",englishName:"Surreal Dreamscape",designIntent:"围绕一个清晰的梦境隐喻建立诗意空间",compositionRules:"单一超现实场景；尺度错位明确；主体不超过两个；保留安静文字区",palette:["淡紫","雾蓝","粉色","珍珠白","柔和暖色"],lighting:"柔和漫反射、适量体积光、可信反射",materials:"半透明玻璃、薄雾、镜面、柔和反射",subjectGuidance:"漂浮阶梯、远方门廊、巨大月亮或悬浮物中选一到两项",negativePrompt:"奇幻元素堆砌、游戏概念图、彩色烟雾、所有元素发光、无目的空间混乱",reservedTextZones:["top 20%","left 18%"],qualityChecks:["一个可描述的梦境概念","空间尺度清晰","色彩柔和统一","主体不拥挤"],promptVersion:"1.0"},
    {styleId:"analog-film",styleName:"复古胶片",englishName:"Analog Film",designIntent:"真实35mm胶片的私人记忆与自然怀旧",compositionRules:"生活化抓拍或旅行场景；自然构图；主体不刻意摆拍；留出安静文字区",palette:["暖棕","米黄","暗橙","褪色蓝","橄榄绿"],lighting:"窗光、夕阳、街灯或阴天散射光",materials:"自然胶片颗粒、轻微halation、温和褪色、细微曝光变化",subjectGuidance:"雨天车窗、黄昏街道、旅途或窗边人物，场景可信且日常",negativePrompt:"黄色滤镜过重、过量划痕灰尘、破损边框、纯黑暗部、过度磨皮、复古贴纸",reservedTextZones:["top 18%","bottom 20%"],qualityChecks:["摄影可信","颗粒不过量","色彩不过黄","主体自然"],promptVersion:"1.0"},
    {styleId:"sound-visualization",styleName:"声音可视化",englishName:"Sound Visualization",designIntent:"用有秩序的抽象图形表达共振、节奏和声音流动",compositionRules:"波形、连续曲线或同心共振结构为核心；线条方向明确；文字区与图形分离",palette:["黑","银白","深蓝","低饱和冷色"],lighting:"精细边缘高光与克制的明暗层次",materials:"金属细线、半透明曲线、哑光底、精密数字图形",subjectGuidance:"选择一种组织系统：连续波形、共振圆环、频率流线；不是播放器界面",negativePrompt:"虚构音频UI、随机频谱柱、游戏HUD、虚构数据标签、廉价霓虹、线条无序堆叠",reservedTextZones:["top 22%","bottom 18%"],qualityChecks:["声音图形是主体","图形有连续组织逻辑","不是软件截图","没有伪数据"],promptVersion:"1.0"},
    {styleId:"artist-editorial",styleName:"歌手与专辑编辑",englishName:"Artist Editorial",designIntent:"音乐杂志封面式的人物摄影和编辑层级",compositionRules:"肖像或演奏场景占据视觉中心；脸部和主要动作区域不被文字覆盖；保留杂志式排版区",palette:["由场景确定的协调色组","最多一个强调色"],lighting:"方向明确的摄影灯光或舞台环境光",materials:"高级编辑摄影、细节自然、受控色彩分级",subjectGuidance:"只有获得合法参考图时才使用真实歌手；否则生成虚构且不可识别的音乐人或剪影",negativePrompt:"冒充真实歌手、伪造官方专辑封面、可识别名人仿真肖像、促销横幅、人物脸部畸形",reservedTextZones:["top 18%","bottom 18%"],qualityChecks:["编辑摄影感","面部无遮挡","未冒充官方素材","主体自然"],promptVersion:"1.0"},
    {styleId:"nature-healing",styleName:"自然治愈",englishName:"Nature & Healing",designIntent:"自然景观中的平静、呼吸感和片刻宁静",compositionRules:"单一自然环境；层次柔和；地平线与主体清晰；留白不低于20%",palette:["雾蓝","暖白","草木绿","沙色","柔和灰"],lighting:"自然晨光、日落光或均匀散射光",materials:"真实自然摄影、轻雾、柔和轮廓和自然空气透视",subjectGuidance:"山湖、海岸、草地、晨雾森林或安静人物远景，最多选一种主要景观",negativePrompt:"旅游宣传照、过饱和、HDR、夸张锐化、过多风景元素、励志文字",reservedTextZones:["top 20%","bottom 18%"],qualityChecks:["自然光可信","画面可呼吸","景观不过度复杂","色彩克制"],promptVersion:"1.0"},
    {styleId:"futuristic-digital",styleName:"未来数字音乐",englishName:"Futuristic Digital",designIntent:"实验音乐与电子音乐的雕塑化未来视觉",compositionRules:"明确对角线或动态透视；单一主物体；强烈尺度对比；保留干净文字区",palette:["深黑","钴蓝","银色","有限高亮色"],lighting:"定向硬光、边缘光、受控镜面反射",materials:"金属、铬、玻璃、精细三维表面",subjectGuidance:"一个雕塑化物体或抽象数字结构，动态来自构图而不是粒子堆积",negativePrompt:"廉价赛博朋克、游戏UI、随机代码数字、过量霓虹烟雾、多个物体无序堆叠",reservedTextZones:["top 18%","left 18%"],qualityChecks:["单一主视觉","材质可信","高光不过曝","未来感来自结构"],promptVersion:"1.0"},
    {styleId:"color-sketch-comic",styleName:"彩色素描漫画",englishName:"Color Sketch Comic",designIntent:"彩铅线稿、水彩叠色与生活漫画结合的原创手绘插画",compositionRules:"纵向3:4；一个主要人物或对象；场景有前后关系；标题区干净；所有对象统一插画语言",palette:["奶油黄","天蓝","珊瑚橙","草木绿","柔和粉色"],lighting:"手绘环境色与柔和纸面光，不使用照片式高光",materials:"可见彩色铅笔笔触、表达性墨线、轻水彩叠色、纸张纹理、自然手绘瑕疵",subjectGuidance:"依歌曲情绪变化选择房间、雨窗、咖啡馆、黑胶、植物、宠物、旅途或户外瞬间；不要每次都画同一人物",negativePrompt:"写实照片、照片转漫画滤镜、通用动漫壁纸、光亮3D角色、塑料皮肤、企业扁平矢量插画、随机贴纸、混乱涂鸦、荧光色、线条风格不一致、畸形手、重复物体、不可读文字、假Logo、二维码、拥挤构图",reservedTextZones:["top 20%","bottom 18%"],qualityChecks:["可见手绘线稿与笔触","全画面插画语言一致","配色协调","场景有故事而非拼贴","主体比例自然"],promptVersion:"1.0",
      substyles:[
        {id:"lively-pencil",name:"活力彩铅风",composition:"偏动态斜向构图、活泼姿态和节奏型辅助线，主体更大",palette:["奶油黄","天蓝","珊瑚橙","草木绿"],linework:"更明显的彩铅线稿、活跃笔触和适量动态线"},
        {id:"gentle-journal",name:"温柔手账风",composition:"静态生活场景、留白较大、日记式自然视角与轻微纸面层次",palette:["奶油白","雾蓝","柔和粉","鼠尾草绿"],linework:"细腻铅笔线、轻水彩叠色、温柔不规则轮廓"},
        {id:"comic-panels",name:"漫画分镜风",composition:"清晰的单一或双分镜结构、动态斜线和强烈主次对比，避免信息拥挤",palette:["暖白","深墨线","钴蓝","珊瑚橙"],linework:"更有力的墨线、方向性排线和漫画动态线"}
      ]}
  ];
  function byId(id){return modes.find(function(m){return m.styleId===id||m.styleName===id;})||modes[0];}
  function buildPrompt(input){
    input=input||{};var mode=byId(input.styleId||input.styleName);var sub=null;
    if(mode.substyles&&input.substyle)sub=mode.substyles.find(function(x){return x.id===input.substyle||x.name===input.substyle;})||null;
    var mood=String(input.mood||"").slice(0,80),scene=String(input.scene||"").slice(0,120);
    var songContext=[mood?"Mood direction: "+mood:"",scene?"Optional scene cue: "+scene:""].filter(Boolean).join(". ");
    return [
      "Create an original premium music poster BACKGROUND ONLY in vertical 3:4 composition, target 768x1024 or closest supported portrait ratio.",
      "STYLE LOCK — "+mode.englishName+": "+mode.designIntent+".",
      "FIXED COMPOSITION: "+mode.compositionRules+". "+(sub?sub.composition+".":""),
      "FIXED COLOR PALETTE: "+(sub?sub.palette:mode.palette).join(", ")+".",
      "LIGHTING: "+mode.lighting+". MATERIALS: "+mode.materials+".",
      "SUBJECT GUIDANCE: "+mode.subjectGuidance+".",
      songContext?"ALLOWED VARIATION ONLY: "+songContext+". This may influence scene and mood but must not override the fixed style, palette logic, or materials.":"",
      sub?"SUBSTYLE "+sub.name+" LINE LANGUAGE: "+sub.linework+".":"",
      "TYPOGRAPHY SAFE ZONES: "+mode.reservedTextZones.join(", ")+". Leave those areas visually quiet and low-detail for separately typeset real song title and artist.",
      "DO NOT render any text, title, artist name, lyrics, logo, watermark, QR code, player controls or fake data. Frontend will typeset all text.",
      "STYLE-SPECIFIC RESTRICTIONS: "+mode.negativePrompt+".",
      "GLOBAL NEGATIVE RULES: "+commonNegative+".",
      "QUALITY: crisp coherent focal subject, clean edges, no stretching, high-quality art direction, consistent visual language across this style."
    ].filter(Boolean).join("\n");
  }
  function inspectImage(image){
    var result={technicalPassed:false,checks:[],visualStyleStatus:"not_automatically_verified",visualStyleScore:null};
    if(!image||!image.naturalWidth||!image.naturalHeight){result.checks.push({id:"image-readable",passed:false,detail:"图片尚未成功解码"});return result;}
    var ratio=image.naturalWidth/image.naturalHeight;
    result.checks.push({id:"image-readable",passed:true,detail:"图片已解码"});
    result.checks.push({id:"portrait-ratio",passed:ratio>=0.68&&ratio<=0.82,detail:"宽高比 "+ratio.toFixed(3)});
    result.checks.push({id:"minimum-size",passed:image.naturalWidth>=600&&image.naturalHeight>=800,detail:image.naturalWidth+"×"+image.naturalHeight});
    result.technicalPassed=result.checks.every(function(c){return c.passed;});
    return result;
  }
  root.MelodyMePosterSystem={version:"1.0.0",promptVersion:"1.0",modes:modes,commonNegative:commonNegative,byId:byId,buildPrompt:buildPrompt,inspectImage:inspectImage};
})(window);
