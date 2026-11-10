/* WORLD/TOON Creative Director: human-approved production design before ChatGPT dispatch.
 * CSS swatches and wireframe thumbnails are illustrative, NOT generated artwork.
 * No model is invoked and no publication approval is granted.
 */
'use strict';
(function(){
const STYLES=[
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
let step=0;
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
 const c={version:1,styleId:/历史|经典|宗教|军事/.test(p.category||'')?'woodcut':/AI|科学|机器人/.test(p.category||'')?'diagram':'editorial',
  arcId:/历史|经典/.test(p.category||'')?'chronicle':/科学|AI|机器人/.test(p.category||'')?'explain':'twist',
  thesis:clean(p.description)||'从公开议题出发，通过原创人物讲出冲突、选择与结果。',
  world:/历史|经典/.test(p.category||'')?'取材于时代背景但不虚构史实结论的架空城镇':'与现实新闻不对应的架空城市',
  emotion:'有趣、清楚、克制、有余味',cover:'简洁的大标题留白、完整原创人物、故事核心象征物、统一系列标识 By DAVYLAB',
  cast:defaultCast(p.category),drafted:false,reviewed:false,approval:null};
 p.creativeDirection=c;persist();return c;
}
function shotOf(i){return SHOTS[i]||'中景人物'}
function draft(p){
 const c=ensure(p),subject=clean(p.sourceTitle||p.title).replace(/：漫画改编$/,'').slice(0,100);
 const names=c.cast.map(x=>clean(x.name)).filter(Boolean),a=names[0]||'主角',b=names[1]||'搭档';
 const beats=BEATS[c.arcId]||BEATS.twist;
 const occupied=(p.panels||[]).some(x=>clean(x.scene));
 if(occupied&&!confirm('重新生成会覆盖当前九格脚本中的画面、对白与旁白；不会删除已有的图片。是否继续？'))return;
 p.panels.forEach((x,i)=>{
  x.title=beats[i];
  x.scene='镜头：'+shotOf(i)+'。场景：'+c.world+'。'+a+'与'+b+'围绕「'+subject+'」展开'+beats[i]+'的故事画面；遵守人物固定外观和统一光色规则。'+(i===8?'以开放式尾声收束。':'保留清晰视觉焦点。');
  x.caption=['一件事，改变了他们看世界的方式。','起初，大家都以为答案很简单。','有人提出了另一种解释。','难题并没有就此结束。','他们发现，真正的问题可能在别处。','每种选择都要付出代价。','一条新线索让局面发生变化。','这一次，必须认真作出选择。','故事结束了，但问题仍值得追问。'][i];
  x.dialogue=i%2===0?a+'：我们应该先把事情弄清楚。':b+'：还有什么是我们忽略的？';
  x.prompt='';
 });
 c.drafted=true;c.reviewed=false;c.approval=null;
 if(!clean(p.fiction))p.fiction='采用独立原创角色和架空地点，事实和虚构对白分别标明；不沿用可识别的真实人物关系与未经证实的指控。';
 if(!clean(p.sourceTitle))p.sourceTitle=p.title;
 if(!clean(p.description))p.description=c.thesis;
 p.characters=castText(c);
 markDirty(p);setChange(p,'创建九格分镜草稿（规则建议，待作者审阅）');
 step=2;render();notify('已生成九格可编辑分镜草稿；逐格确认后才能锁定');
}
function castText(c){return c.cast.map((x,i)=>[i+1+'. '+x.role+'：'+x.name,'外貌与比例：'+x.look,'固定服饰：'+x.clothes,'识别道具：'+x.symbol,'性格：'+x.nature].join('；')).join('\n')}
function payload(p){
 const c=ensure(p),s=style(c.styleId);
 return {
  version:1,style_id:s.id,style_name:s.name,visual_rules:{palette:s.palette,material:s.material,lighting:s.lighting,layout:s.layout,negative:s.negative,ratio:'3:4',size:'1080x1440',lettering:'先生成无文字画面，准确中文另行排版'},
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
 return {...payload(p),lock_status:'approved',approval:{lock_hash:c.approval.lock_hash,approved_at:c.approval.approved_at,author_approved:true,approval_scope:'style_cast_storyboard',note:'锁定创意设定不等于事实核验或正式发表批准'},
 production_gates:{pilot_required:true,pilot_artifacts:['character-sheet.png','pilot-01.png'],pilot_approval_required:true,
  full_run_panel_count:9,independent_cover:true,character_continuity:true,source_verification_before_fact_claims:true,
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
function styleCards(c){
 return '<div class="director-styles">'+STYLES.map(x=>'<button type="button" class="director-style '+(c.styleId===x.id?'selected':'')+'" data-director-style="'+x.id+'" aria-pressed="'+(c.styleId===x.id)+'">'+
 '<span class="director-style-art" style="--d-bg:'+x.palette[0]+';--d-ink:'+x.palette[1]+';--d-a:'+x.palette[2]+';--d-b:'+x.palette[3]+'"><i></i><b></b><em></em></span>'+
 '<strong>'+e(x.name)+'</strong><small>'+e(x.subtitle)+'</small></button>').join('')+'</div>';
}
function stylePreview(c){
 const s=style(c.styleId);
 return '<div class="director-art-preview"><div class="director-art-sheet" style="--d-bg:'+s.palette[0]+';--d-ink:'+s.palette[1]+';--d-a:'+s.palette[2]+';--d-b:'+s.palette[3]+'"><span>WORLD / TOON</span><div class="director-wire-figure"><i></i><b></b></div><strong>'+e(s.name)+'</strong><small>配色与构图示意 · 非真实生图</small></div>'+
 '<div class="director-art-rules"><b>统一视觉规范</b><p>材质：'+e(s.material)+'</p><p>光线：'+e(s.lighting)+'</p><p>构图：'+e(s.layout)+'</p><p>禁用：'+e(s.negative)+'</p><p>所有画格：1080×1440，3:4，中文另行排版</p></div></div>';
}
function narrative(p,c){
 return '<div class="director-arcs">'+ARCS.map(x=>'<button type="button" data-director-arc="'+x.id+'" class="'+(c.arcId===x.id?'selected':'')+'"><strong>'+e(x.name)+'</strong><small>'+e(x.detail)+'</small></button>').join('')+'</div>'+
 '<div class="director-fields">'+field('thesis','故事一句话 · 核心表达',c.thesis)+field('world','人物所在世界与场景规则',c.world)+field('emotion','情绪与阅读节奏',c.emotion,'','input')+field('cover','独立封面视觉指令',c.cover)+'</div>';
}
function castEditor(c){
 return '<div class="director-cast">'+c.cast.map((person,i)=>'<article class="director-character"><div class="director-character-head"><span>0'+(i+1)+'</span><strong>'+e(person.role)+'</strong></div>'+
 '<div class="director-character-avatar" style="--d-bg:'+style(c.styleId).palette[0]+';--d-ink:'+style(c.styleId).palette[1]+'"><i></i><b></b><small>角色版式示意 · 非定妆照</small></div>'+
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
 '<div class="director-actions"><button type="button" class="button" data-director-action="draft">生成／重做九格脚本</button><button type="button" class="button dark" data-director-action="next">审阅整体故事 →</button></div>'+
 framePreview(p,c)+'</section>':'')+
 (step===3?review(p,c):'')+
 '<p class="director-footer">By DAVYLAB · 创意预制与锁定不等于事实认证、图像已经生成或内容允许发表。资料自动保存在当前作品，并可随原有账户同步。</p></div>';
}
async function action(type,p){
 if(!p)throw Error('请先选择作品');
 if(type==='next'){step=Math.min(3,step+1);render();return}
 if(type==='draft'){if(p.handoff?.repoQueuedAt)throw Error('该任务已正式入仓，不能覆盖分镜');draft(p);return}
 if(type==='approve'){approve(p);return}
}
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
window.wtDirector={STYLES,ARCS,ensure,payload,digest,checks,readiness,approved,exportBrief,castText,shotOf,draft};
if(location.hash.startsWith('#/director'))queueMicrotask(()=>render());
})();
