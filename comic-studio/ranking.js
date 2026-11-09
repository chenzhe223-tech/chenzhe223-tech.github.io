/* WORLD/TOON Editorial Intelligence v1.0
 * Deterministic first-stage estimates. NOT LLM output, web popularity metrics,
 * or factual verification. A signed / authenticated LLM evaluator can replace
 * the method later; this script makes no paid model calls.
 */
(function(global){
 'use strict';
 const VERSION='1.0.0';
 const MIN_PUBLIC=60;
 const weights=Object.freeze({heat:.32,impact:.36,drawability:.32});
 const labels=Object.freeze({overall:'综合评分',heat:'热度',impact:'影响力',drawability:'可画性',latest:'最新时间'});
 const patterns={
  heat:[
   [/(突发|最新|刚刚|breaking|today|now|live|viral|trending|震惊|爆火|引爆|hot topic)/i,9],
   [/(首次|首个|first|landmark|historical|record|重大|里程碑|historic)/i,7],
   [/(发布|宣布|推出|launch|release|unveil|announc|公布|公开|最新进展|reveal)/i,5],
   [/(争议|冲突|反转|风波|controvers|clash|battle|debate|backlash|protest|scandal)/i,6]
  ],
  impact:[
   [/(法案|立法|监管|禁止|监管政策|白宫|总统|政府|央行|法院|国会|法律|政府|regulat|ban|policy|government|court|election|president|congress)/i,13],
   [/(人工智能|大模型|ai\b|gpt|openai|anthropic|google|deepseek|微软|apple|nvidia|英伟达|claude|deepmind)/i,9],
   [/(研究|论文|突破|科学|突破性|发现|芯片|机器人|research|paper|breakthrough|discover|chip|robot|science|benchmark)/i,11],
   [/(经济|市场|融资|收购|合作|合并|投资|关税|贸易|供应链|acquisit|funding|econom|market|merger|trade|tariff|supply chain)/i,9],
   [/(全球|世界|国际|各国|跨国|global|worldwide|international|across countries|millions|billions)/i,5],
   [/(医疗|健康|药物|教育|安全|环境|气候|就业|能源|hospital|health|climate|energy|job|safety|education)/i,7]
  ],
  drawability:[
   [/(对决|角逐|交锋|碰撞|博弈|battle|clash|versus|\bvs\.?\b|rival|competition|fight|race|竞赛|争夺)/i,12],
   [/(人形|机器人|太空|火箭|实验室|飞行|卫星|工厂|robot|rocket|space|lab|factory|satellite|humanoid|spaceship)/i,11],
   [/(人物|总裁|CEO|创始人|科学家|议员|总统|明星|artist|founder|scientist|actor|leader|president|ceo)/i,9],
   [/(反转|讽刺|荒诞|戏剧|奇迹|秘密|悬念|mystery|dramatic|satire|surprise|twist|secret|shock)/i,10],
   [/(发布|开幕|登场|展示|试飞|亮相|演示|launch|showcase|demonstrat|unveil|present|stage)/i,6],
   [/(对比|变化|取代|颠覆|崛起|转型|挑战|失败|成功|replace|transform|disrupt|challeng|rise|fall)/i,8]
  ]
 };
 const categoryBoost={
  '国际政治':{heat:2,impact:11,drawability:5},'AI 科技':{heat:3,impact:11,drawability:6},
  '机器人':{heat:3,impact:8,drawability:12},'商业财经':{heat:2,impact:9,drawability:6},
  '科学':{heat:1,impact:10,drawability:7},'航空航天':{heat:3,impact:9,drawability:12},
  '文化':{heat:3,impact:5,drawability:8},'娱乐':{heat:5,impact:4,drawability:11},
  '体育':{heat:5,impact:5,drawability:12},'人物':{heat:3,impact:5,drawability:11},
  '旅行':{heat:2,impact:4,drawability:8},'环境':{heat:1,impact:9,drawability:7},
  '健康':{heat:1,impact:9,drawability:6}
 };
 const clamp=x=>Math.max(0,Math.min(100,Math.round(x)));
 function matched(text,which,limit){
  let value=0;const terms=[];
  for(const [pattern,points] of patterns[which]) if(pattern.test(text)){value+=points;terms.push(points)}
  return {value:Math.min(limit,value),count:terms.length};
 }
 function recency(published,now=Date.now()){
  let time=Date.parse(published||'');
  if(!Number.isFinite(time))return 0;
  const days=Math.max(0,(now-time)/86400000);
  return days<=1?26:days<=3?22:days<=7?16:days<=14?9:days<=30?3:0;
 }
 function evaluate(article,opts={}){
  const n=article||{};
  const title=String(n.title||'').slice(0,360);
  const context=String(n.summary||'').slice(0,500)+' '+String(n.why||'').slice(0,320);
  const combined=(title+' '+context).toLowerCase();
  const category=categoryBoost[n.category]||categoryBoost['AI 科技'];
  const verifiedURL=/^https?:\/\/\S+/i.test(String(n.url||'')); // only URL presence, not fact-check
  const time=recency(n.published,opts.now);
  const h=matched(combined,'heat',20),im=matched(combined,'impact',33),dr=matched(combined,'drawability',35);
  const heat=clamp(39+time+category.heat+h.value+(verifiedURL?3:0));
  const impact=clamp(35+category.impact+im.value+(String(n.why||'').length>=25?5:0)+(verifiedURL?2:0));
  const drawability=clamp(39+category.drawability+dr.value+(n.image?3:0)+((title.match(/[:：—\-]/g)||[]).length?2:0));
  const overall=clamp(heat*weights.heat+impact*weights.impact+drawability*weights.drawability);
  const explanations=[
   time>=20?'近期发生或刚发布':'时效信号较弱',
   im.count>=2?'涉及多个行业/公共影响主题':'需要核实实际影响范围',
   dr.count>=2?'具备可视化人物/情节冲突':'需策划原创分镜和叙事'
  ];
  return {overall,heat,impact,drawability,method:'rule_estimate',version:VERSION,
   rationale:explanations.join('；')+'。',factChecked:false,sourceVerified:false,
   explanation:'根据标题、摘要、栏目和时间的规则预评估；不代表实际社交平台热度或大模型审核结果'};
 }
 function decorate(rows,opts={}){
  return (Array.isArray(rows)?rows:[]).map((row,index)=>({...row,_rating:evaluate(row,opts),_sourceIndex:row?._sourceIndex??index}));
 }
 function select(rows,opts={}){
  const arr=Array.isArray(rows)?rows:[];
  const overallMin=Math.max(MIN_PUBLIC,Math.min(100,Number(opts.minimum)||MIN_PUBLIC));
  const focus=String(opts.focus||'all');
  const sort=Object.prototype.hasOwnProperty.call(labels,opts.sort)?opts.sort:'overall';
  const query=String(opts.query||'').trim().toLowerCase();
  const eligible=arr.filter(n=>(n._rating||evaluate(n)).overall>=overallMin);
  const focused=eligible.filter(n=>{
   const r=n._rating||evaluate(n);
   if(focus==='heat70')return r.heat>=70;
   if(focus==='impact70')return r.impact>=70;
   if(focus==='drawability70')return r.drawability>=70;
   if(focus==='heat80')return r.heat>=80;
   if(focus==='impact80')return r.impact>=80;
   if(focus==='drawability80')return r.drawability>=80;
   return true;
  });
  const found=focused.filter(n=>!query||[n.title,n.summary,n.source,n.why,n.category].some(x=>String(x||'').toLowerCase().includes(query)));
  found.sort((a,b)=>{
    const aRank=a._rating||evaluate(a),bRank=b._rating||evaluate(b);
    if(sort==='latest')return (Date.parse(b.published)||0)-(Date.parse(a.published)||0)||bRank.overall-aRank.overall;
    return bRank[sort]-aRank[sort]||bRank.overall-aRank.overall||(Date.parse(b.published)||0)-(Date.parse(a.published)||0);
  });
  return {items:found,all:arr.length,eligible:eligible.length,hidden:arr.length-eligible.length,filtered:focused.length-found.length,minimum:overallMin,sort,focus};
 }
 function format(r){return '综合 '+r.overall+' / 热度 '+r.heat+' / 影响力 '+r.impact+' / 可画性 '+r.drawability}
 global.wtEditorialRank=Object.freeze({VERSION,MIN_PUBLIC,weights,labels,evaluate,decorate,select,format});
})(window);
