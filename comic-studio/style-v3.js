/* WORLD/TOON · 20-style visual library V3.0. Strictly separate visual descriptions from verified artwork. */
'use strict';
(function(){
const CATALOG=[
 {
  "style_id": "chinese-historical-epic",
  "version": "3.0.0",
  "number": 1,
  "name": "国风史诗写实",
  "name_en": "Chinese Historical Epic",
  "category": "东方与历史",
  "subtitle": "恢宏历史、人物写实",
  "material": "细密甲胄、丝织服饰、写实古建、历史器物",
  "lighting": "烟尘穿透的电影侧逆光",
  "layout": "军阵远景与有情绪的脸部特写",
  "negative": "简笔画、粗糙武器、错代盔甲",
  "subjects": "三国·秦汉·战争",
  "palette": [
   "#e7d5b5",
   "#302e2d",
   "#92543a"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "chinese-ink-wash",
  "version": "3.0.0",
  "number": 2,
  "name": "东方水墨国漫",
  "name_en": "Chinese Ink Wash",
  "category": "东方与历史",
  "subtitle": "宣纸笔韵、写意叙事",
  "material": "多层水墨渗化、皴擦、干湿并置",
  "lighting": "柔和透纸明暗与留白",
  "layout": "山水长镜与完整人物动作",
  "negative": "火柴人、平涂水墨滤镜",
  "subjects": "武侠·诗词·古典",
  "palette": [
   "#e9e5d9",
   "#323a35",
   "#85917b"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-seinen",
  "version": "3.0.0",
  "number": 3,
  "name": "日系青年漫画",
  "name_en": "Japanese Seinen Manga",
  "category": "日本漫画与动画",
  "subtitle": "成熟叙事、精密黑白",
  "material": "细密网点、人体写实、深层排线",
  "lighting": "黑白灰渐进塑形",
  "layout": "张力特写与电影镜头",
  "negative": "乱线草稿、面部失真",
  "subjects": "政治·传记·悬疑",
  "palette": [
   "#f0eee8",
   "#24272b",
   "#8b8073"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-shonen",
  "version": "3.0.0",
  "number": 4,
  "name": "日系热血漫画",
  "name_en": "Japanese Shonen Action",
  "category": "日本漫画与动画",
  "subtitle": "动态透视、力量冲击",
  "material": "成熟动作线稿、透视夸张、丰富服装",
  "lighting": "明确的硬光与运动明暗",
  "layout": "高低机位、连续动作",
  "negative": "肢体错位、随意速度线",
  "subjects": "冒险·英雄·成长",
  "palette": [
   "#e8ddc5",
   "#202d38",
   "#d26b3d"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "western-cinematic",
  "version": "3.0.0",
  "number": 5,
  "name": "欧美电影写实",
  "name_en": "Western Cinematic Realism",
  "category": "欧美漫画",
  "subtitle": "电影摄影、写实图像小说",
  "material": "人物结构写实、建筑空间复杂、精密细节",
  "lighting": "局部受控暖冷光",
  "layout": "镜头切换、人物环境互相映衬",
  "negative": "假3D塑料、空洞背景",
  "subjects": "国际政治·商业·战争",
  "palette": [
   "#d7d4c9",
   "#283c43",
   "#af855e"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "european-ligne-claire",
  "version": "3.0.0",
  "number": 6,
  "name": "欧式清线漫画",
  "name_en": "European Ligne Claire",
  "category": "欧美漫画",
  "subtitle": "精致清线、饱满场景",
  "material": "均匀精准轮廓、完整建筑、克制平涂",
  "lighting": "自然日光、少量投影",
  "layout": "平衡的角色全景与探险路线",
  "negative": "儿童涂鸦、空白场景",
  "subjects": "旅行·科学·欧洲历史",
  "palette": [
   "#efe2c8",
   "#2b4548",
   "#ba885e"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "american-vintage",
  "version": "3.0.0",
  "number": 7,
  "name": "美式复古漫画",
  "name_en": "American Vintage Comics",
  "category": "欧美漫画",
  "subtitle": "复古胶印、戏剧色彩",
  "material": "网点、旧纸、精确粗轮廓",
  "lighting": "高对比商业印刷色块",
  "layout": "斜切镜头、张力构图",
  "negative": "粗糙仿旧、单调卡通",
  "subjects": "社会热点·讽刺·英雄",
  "palette": [
   "#f2dfbd",
   "#293347",
   "#c9634d"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "noir-graphic-novel",
  "version": "3.0.0",
  "number": 8,
  "name": "黑色电影漫画",
  "name_en": "Noir Graphic Novel",
  "category": "欧美漫画",
  "subtitle": "高反差、暗影悬念",
  "material": "细密黑白结构、真实空间与投影",
  "lighting": "一束强烈定向光",
  "layout": "深景深与悬疑反打",
  "negative": "空白黑底、随意草线",
  "subjects": "调查·悬疑·纪实",
  "palette": [
   "#d6d6d0",
   "#191e23",
   "#848a87"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "artistic-watercolor",
  "version": "3.0.0",
  "number": 9,
  "name": "艺术水彩绘本",
  "name_en": "Artistic Watercolor Storybook",
  "category": "艺术绘本",
  "subtitle": "纸本水彩、诗意叙事",
  "material": "透明水彩叠色、纸纤维、细节笔触",
  "lighting": "温柔漫射自然光",
  "layout": "呼吸感场景与人物细腻表情",
  "negative": "模糊人脸、廉价贴图",
  "subjects": "文学·宗教·温情",
  "palette": [
   "#eadfcf",
   "#536c62",
   "#c58b6e"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "futuristic-sci-fi",
  "version": "3.0.0",
  "number": 10,
  "name": "未来科幻漫画",
  "name_en": "Futuristic Sci-Fi Comics",
  "category": "科幻与现代",
  "subtitle": "硬科幻机械、精密世界",
  "material": "可信机甲结构、复杂空间、严谨材料",
  "lighting": "环境冷光与实用灯带",
  "layout": "巨大建筑空间与微小人物对照",
  "negative": "滥用紫蓝霓虹、科技空壳",
  "subjects": "AI·宇宙·未来",
  "palette": [
   "#d4dddb",
   "#263f46",
   "#a48f6e"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "korean-webtoon",
  "version": "3.0.0",
  "number": 11,
  "name": "韩式彩色条漫",
  "name_en": "Korean Webtoon",
  "category": "科幻与现代",
  "subtitle": "精致彩绘、现代人物",
  "material": "数字插画笔触、精细头发与服饰",
  "lighting": "柔和肤色塑形与环境反射",
  "layout": "竖向连续节奏、情绪近景",
  "negative": "美颜塑料脸、背景空缺",
  "subjects": "都市·成长·现代",
  "palette": [
   "#ede3da",
   "#394e56",
   "#c78d93"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "premium-chibi",
  "version": "3.0.0",
  "number": 12,
  "name": "精品Q版漫画",
  "name_en": "Premium Chibi Comics",
  "category": "儿童与轻松",
  "subtitle": "商业动画级萌趣角色",
  "material": "精致Q版比例、全场景刻画",
  "lighting": "明亮自然投影",
  "layout": "表情节奏、完整道具",
  "negative": "简笔画、涂鸦式空白",
  "subjects": "亲子·科普·幽默",
  "palette": [
   "#f4e1ba",
   "#416262",
   "#e89c6b"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-hand-painted",
  "version": "3.0.0",
  "number": 13,
  "name": "日式手绘动画电影风",
  "name_en": "Japanese Hand-Painted Animation",
  "category": "日本漫画与动画",
  "subtitle": "自然手绘、温暖电影美术",
  "material": "细腻手绘山林、柔和人物、丰富生活道具",
  "lighting": "温暖自然日光与树影",
  "layout": "情景长镜头、空气透视",
  "negative": "粗线儿童画、无背景人物",
  "subjects": "童话·自然·亲子",
  "palette": [
   "#e8e3c7",
   "#50684f",
   "#c18e63"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-luminous",
  "version": "3.0.0",
  "number": 14,
  "name": "日式唯美光影动画风",
  "name_en": "Japanese Luminous Anime",
  "category": "日本漫画与动画",
  "subtitle": "精细天空、建筑光影",
  "material": "云层层次、城市反光、完整精致人物",
  "lighting": "黄昏体积光与地面漫反射",
  "layout": "城市全景与精细人物同镜",
  "negative": "背景精致人像粗糙、过曝",
  "subjects": "青春·旅行·情感",
  "palette": [
   "#d8e3e7",
   "#36536a",
   "#d59b77"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-healing",
  "version": "3.0.0",
  "number": 15,
  "name": "日式治愈系漫画",
  "name_en": "Japanese Healing Slice of Life",
  "category": "日本漫画与动画",
  "subtitle": "舒适生活、细腻日常",
  "material": "植物纹理、生活器物、自然面部表情",
  "lighting": "低对比清晨阳光",
  "layout": "日常观察、微小情感动作",
  "negative": "没有环境的简笔画",
  "subjects": "家庭·成长·旅行",
  "palette": [
   "#e7ecd8",
   "#53745b",
   "#bca280"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-fantasy",
  "version": "3.0.0",
  "number": 16,
  "name": "日式奇幻冒险漫画",
  "name_en": "Japanese Fantasy Adventure",
  "category": "日本漫画与动画",
  "subtitle": "奇幻地理、原创世界观",
  "material": "手工道具、建筑细节、独特生物",
  "lighting": "多层环境光与魔法边缘光",
  "layout": "冒险地图、丰富中远景",
  "negative": "挪用现有角色、逻辑穿帮",
  "subjects": "神话·史诗·冒险",
  "palette": [
   "#e1dcc9",
   "#425067",
   "#a58458"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-cel",
  "version": "3.0.0",
  "number": 17,
  "name": "日式赛璐璐动画风",
  "name_en": "Japanese Cel Animation",
  "category": "日本漫画与动画",
  "subtitle": "精准线稿、分层色影",
  "material": "干净专业赛璐璐、真实背景",
  "lighting": "二到三段精密阴影",
  "layout": "连续人物表演、动作线",
  "negative": "草图冒充、背景缩水",
  "subjects": "人物·历史·动作",
  "palette": [
   "#e7e7db",
   "#364656",
   "#ce9064"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-showa",
  "version": "3.0.0",
  "number": 18,
  "name": "日式复古昭和漫画",
  "name_en": "Japanese Showa Retro Manga",
  "category": "日本漫画与动画",
  "subtitle": "昭和胶印、怀旧细节",
  "material": "年代印刷、复古衣物、颗粒纹",
  "lighting": "暖旧纸与高对比硬光",
  "layout": "经典报刊分镜",
  "negative": "现代服饰混入、假做旧",
  "subjects": "近代史·传记·怀旧",
  "palette": [
   "#e9d5af",
   "#4a4140",
   "#ae694d"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-military",
  "version": "3.0.0",
  "number": 19,
  "name": "日式精细战争漫画",
  "name_en": "Japanese Military Historical Manga",
  "category": "东方与历史",
  "subtitle": "军事考据、丰富场面",
  "material": "兵器细节、历史军服、军阵结构",
  "lighting": "真实天气下的烟火遮挡",
  "layout": "高低层战场地理和人物战术",
  "negative": "失实装备、现代武器穿帮",
  "subjects": "三国·二战·军事",
  "palette": [
   "#dbd6c9",
   "#34434a",
   "#8d6f59"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 },
 {
  "style_id": "japanese-cinematic",
  "version": "3.0.0",
  "number": 20,
  "name": "日式电影分镜漫画",
  "name_en": "Japanese Cinematic Storyboarding",
  "category": "日本漫画与动画",
  "subtitle": "完成级电影漫画、戏剧表演",
  "material": "精细人体、完整景物、层次暗部",
  "lighting": "戏剧侧光与局部焦点",
  "layout": "景别切换、正反打、视觉连续",
  "negative": "只给草稿或导演线框",
  "subjects": "传记·悬疑·新闻",
  "palette": [
   "#d9d5cc",
   "#253944",
   "#ab7967"
  ],
  "reference": {
   "status": "not_licensed",
   "url": null,
   "source": null,
   "author": null,
   "license": null
  },
  "sample": {
   "status": "not_generated",
   "url": null,
   "model": null,
   "model_version": null,
   "sha256": null
  },
  "quality_capability": {
   "standard": false,
   "premium": false,
   "cinematic": false
  },
  "production_mode": "ChatGPT_pilot_required"
 }
];
const CATEGORIES=['全部','东方与历史','日本漫画与动画','欧美漫画','艺术绘本','科幻与现代','儿童与轻松'];
let filter='全部';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const STYLES=CATALOG.map(x=>({id:x.style_id,name:x.name,subtitle:x.subtitle,palette:x.palette,material:x.material,lighting:x.lighting,layout:x.layout,negative:x.negative,version:x.version}));
function isReference(x){return !!(x?.status==='licensed'&&x.url&&x.source&&x.license&&/^https:\/\//.test(x.url))}
function isSample(x){return !!(x?.status==='verified'&&x.url&&x.model&&x.model_version&&/^[a-f0-9]{64}$/.test(x.sha256)&&/^https:\/\//.test(x.url))}
function art(asset,kind){
 if(kind==='reference'&&isReference(asset))return '<a class="wt-v3-zoom" target="_blank" rel="noopener noreferrer" href="'+esc(asset.url)+'" aria-label="放大查看授权风格参考"><img loading="lazy" referrerpolicy="no-referrer" src="'+esc(asset.url)+'" alt="授权风格参考"></a>';
 if(kind==='sample'&&isSample(asset))return '<a class="wt-v3-zoom" target="_blank" rel="noopener noreferrer" href="'+esc(asset.url)+'" aria-label="放大查看真实生成样张"><img loading="lazy" src="'+esc(asset.url)+'" alt="平台实际生成样张"></a>';
 return '<span class="wt-v3-empty">'+(kind==='reference'?'授权参考图待配置':'真实生成样张尚未验证')+'</span>';
}
let searchTerm='';
function pilotFor(c){
 const p=typeof selected==='function'?selected():null;
 const pilot=p?.creativeDirection?.pilot;
 if(!pilot?.panelImage||p.creativeDirection.styleId!==c.styleId)return null;
 if(!/^[a-f0-9]{64}$/.test(pilot.panelSha256||''))return null;
 if(pilot.panelDimensions?.width!==1080||pilot.panelDimensions?.height!==1440)return null;
 const approved=p.creativeDirection.pilotApproval;
 return {src:pilot.panelImage,sha256:pilot.panelSha256,approved:!!(approved?.repo_commit&&approved.pilot_frame_sha256===pilot.panelSha256)};
}
function cardImage(x,c){
 const proof=pilotFor(c);
 if(c.styleId===x.style_id&&proof&&typeof mediaSrc==='function')
  return '<span class="wt-v3-photo"><img alt="'+esc(x.name)+'当前作品实绘首图" loading="lazy" src="'+esc(mediaSrc(proof.src))+'" data-source="'+esc(proof.src)+'"><em>'+(proof.approved?'本作品已批准原图':'本作品待审核首图')+'</em></span>';
 const asset=isReference(x.reference)?x.reference:isSample(x.sample)?x.sample:null;
 if(asset)return '<span class="wt-v3-photo"><img loading="lazy" referrerpolicy="no-referrer" src="'+esc(asset.url)+'" alt="'+esc(x.name)+'可追溯视觉图像"><em>'+(isReference(x.reference)?'已授权风格参考':'已核验模型样张')+'</em></span>';
 return '<span class="wt-v3-card-visual" style="--v3-paper:'+esc(x.palette[0])+';--v3-ink:'+esc(x.palette[1])+';--v3-accent:'+esc(x.palette[2])+'"><small>STYLE / '+String(x.number).padStart(2,'0')+'</small><strong>'+esc(x.name_en)+'</strong><em>视觉档案 · 暂无可核验图片<br>此处不是生成效果预览</em></span>';
}
function cards(c){
 const subset=CATALOG.filter(x=>(filter==='全部'||x.category===filter)&&(!searchTerm||[x.name,x.name_en,x.subtitle,x.material,x.subjects].join(' ').toLowerCase().includes(searchTerm.toLowerCase())));
 return '<div class="wt-v3-intro"><div><b>WORLD/TOON · VISUAL ATLAS 03</b><p>先看真实来源，再确认正式首图。画风描述不是生成能力承诺。</p></div><span>20 STYLES</span></div>'+
 '<div class="wt-v3-toolrow"><input type="search" data-wt-v3-query aria-label="检索漫画风格" placeholder="搜索画风、题材与视觉特征" value="'+esc(searchTerm)+'"><span class="wt-v3-count">找到 '+subset.length+' 种</span></div>'+
 '<div class="wt-v3-filters">'+CATEGORIES.map(x=>'<button type="button" data-wt-v3-filter="'+esc(x)+'" aria-pressed="'+(filter===x)+'" class="'+(filter===x?'is-active':'')+'">'+esc(x)+'</button>').join('')+'</div>'+
 '<div class="director-styles wt-v3-grid">'+subset.map(x=>'<button type="button" class="director-style wt-v3-card '+(c.styleId===x.style_id?'selected':'')+'" data-director-style="'+esc(x.style_id)+'" aria-pressed="'+(c.styleId===x.style_id)+'">'+
 cardImage(x,c)+'<span class="wt-v3-card-meta"><b>'+esc(x.name)+'</b><small>'+esc(x.subtitle)+'</small><span class="wt-v3-subjects">'+esc(x.subjects.replace(/·/g,' / '))+'</span></span></button>').join('')+'</div>'+(subset.length?'':'<p class="wt-v3-nothing">没有符合条件的画风，请调整搜索。</p>');
}
function detail(c){
 const x=CATALOG.find(s=>s.style_id===c.styleId);
 if(!x)return '<p class="minor">此作品使用历史旧版画风；新建作品可选择 V3.0 画风。</p>';
 const quality=c.quality||'Premium';
 const livePilot=pilotFor(c);
 const pilotBlock=livePilot&&typeof mediaSrc==='function'?'<div class="wt-v3-pilot-proof"><b>当前作品 / 真实首图</b><img loading="lazy" data-source="'+esc(livePilot.src)+'" src="'+esc(mediaSrc(livePilot.src))+'" alt="当前作品的真实首格"><small>1080×1440 · SHA-256 '+esc(livePilot.sha256.slice(0,16))+'… · '+(livePilot.approved?'私有仓已核验批准':'待作者审核；不可批量制作')+'</small></div>':'<div class="wt-v3-pilot-pending">当前作品尚无真实首图。请完成派单与角色定妆、首格试画后，在下方审核区确认。</div>';
 return '<section class="wt-v3-detail"><div class="wt-v3-detail-head"><div><div class="kicker">'+String(x.number).padStart(2,'0')+' / WORLD/TOON VISUAL ATLAS</div><h3>'+esc(x.name)+'</h3><p>'+esc(x.name_en)+' · '+esc(x.subtitle)+'</p></div><span>未通过真实生图能力验证</span></div>'+
 '<div class="wt-v3-media"><div><b>风格参考 · RIGHTS CHECK</b><div class="wt-v3-asset">'+art(x.reference,'reference')+'</div><small>仅在来源、作者、许可可追溯后展示</small></div><div><b>真实生成样张 · MODEL OUTPUT</b><div class="wt-v3-asset">'+art(x.sample,'sample')+'</div><small>仅由正式生产模型生成、校验 SHA-256 后展示</small></div></div>'+
 pilotBlock+
 '<div class="wt-v3-spec"><p><b>媒介与细节</b>'+esc(x.material)+'</p><p><b>光影</b>'+esc(x.lighting)+'</p><p><b>分镜</b>'+esc(x.layout)+'</p><p><b>适用题材</b>'+esc(x.subjects)+'</p><p><b>必须排除</b>'+esc(x.negative)+'</p></div>'+
 '<div class="wt-v3-production"><div><b>制作画质目标</b><p>目标级别不等于现有模型能力；出图实测与人工审核通过后才可标记达成。</p></div><div class="wt-v3-quality">'+['Standard','Premium','Cinematic'].map(v=>'<button type="button" data-wt-v3-quality="'+v+'" aria-pressed="'+(quality===v)+'" class="'+(quality===v?'is-active':'')+'">'+v+'</button>').join('')+'</div></div>'+
 '<div class="wt-v3-actions"><button type="button" data-wt-v3-export-lock="1" '+(!livePilot?.approved?'disabled':'')+'>导出已批准风格锁定档案</button><span>正式模型信息由实际生产者填写并校验</span></div>'+
 '<p class="wt-v3-gate">真实预览必须为正式模型的原始 PNG，首图提交私有仓并经作者批准后按 SHA-256 原样进入最终第 01 张。当前 A 轨图像能力未认证，禁止用 CSS、SVG 或外部图片模拟生成成功。B 轨可按既有“角色定妆 + 首格试画”两阶段派单流程推进。</p></section>';
}
document.addEventListener('click',ev=>{
 const f=ev.target.closest('[data-wt-v3-filter]');
 if(f){ev.preventDefault();ev.stopImmediatePropagation();filter=f.dataset.wtV3Filter;render();return}
 const lockButton=ev.target.closest('[data-wt-v3-export-lock]');
 if(lockButton){ev.preventDefault();ev.stopImmediatePropagation();exportApprovedLock();return}
 const q=ev.target.closest('[data-wt-v3-quality]');
 if(q){ev.preventDefault();ev.stopImmediatePropagation();const p=selected();if(!p||p.handoff?.repoQueuedAt){notify('已有正式工单不可更改画质，请创建修订版');return}const c=window.wtDirector?.ensure(p);if(!c)return;c.quality=q.dataset.wtV3Quality;c.approval=null;c.reviewed=false;setChange(p,'调整目标画质为 '+c.quality+'（未声称模型已达到）');render()}
},true);
function exportApprovedLock(){
 const p=typeof selected==='function'?selected():null,c=p?.creativeDirection,st=CATALOG.find(x=>x.style_id===c?.styleId),proof=pilotFor(c||{});
 if(!c||!st||!proof?.approved)throw Error('需要经作者正式批准的真实首图才可导出风格锁定');
 const lock={
  schema:'davylab.worldtoon.style-lock.v3',task_id:p.handoff?.taskId||null,
  style_id:st.style_id,style_version:st.version,quality_target:c.quality||'Premium',
  model_id:null,model_version:null,render_pipeline_version:null,
  characters:(c.cast||[]).map(x=>({name:x.name,appearance:x.look,costume:x.clothes,identity_marks:x.symbol})),
  palette:st.palette,lighting:st.lighting,scene_rules:st.layout,
  prompt_template:st.material+'；'+st.layout+'。保持人物面容、固定服装、背景细节。',
  negative_prompt:st.negative+'；禁止简笔画、SVG 矢量占位、重采样冒充原生高分辨率',
  aspect_ratio:'3:4',resolution:[1080,1440],
  preview_sha256:proof.sha256,approved_at:c.pilotApproval.approved_at,
  status:'awaiting_actual_model_provenance'
 };
 const payload=JSON.stringify(lock,null,2)+'\n';
 const blob=new Blob([payload],{type:'application/json'});
 saveFile(blob,'worldtoon-style-lock-draft-'+(p.handoff?.taskId||p.id)+'.json');
 notify('风格锁定草案已导出；真实模型与管线版本由生产者填入，未填写不能通过验收');
}
document.addEventListener('input',ev=>{
 if(!ev.target.matches?.('[data-wt-v3-query]'))return;
 searchTerm=ev.target.value.slice(0,60);
 const box=document.querySelector('.wt-v3-grid'),count=document.querySelector('.wt-v3-count');
 if(!box)return;
 const c=typeof selected==='function'?selected()?.creativeDirection:null;
 if(!c)return;
 const parser=document.createElement('div');parser.innerHTML=cards(c);
 const incoming=parser.querySelector('.wt-v3-grid');
 if(incoming){box.innerHTML=incoming.innerHTML;if(typeof hydrateImages==='function')hydrateImages()}
 const found=parser.querySelector('.wt-v3-count');if(count&&found)count.textContent=found.textContent;
},true);
window.WTStyleV3={CATALOG,STYLES,cards,detail,isReference,isSample};
})();
