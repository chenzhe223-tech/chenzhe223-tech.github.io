// WORLD/TOON 2.0 / By DAVYLAB — editorial news wire + restricted AI + GitHub static assets
const ORIGIN='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/comic-studio/';
const SUPABASE_URL='https://qjyqaydfezbpeimpvlcb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_jtWLY4vYz2-VklNLoJqxVw_lMdhtfgG'; // replaced at deployment, public (not service role)
const CONTENT={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json',md:'text/markdown; charset=utf-8'};
const QUERIES={
'国际政治':'international politics diplomacy summit',
'文化':'culture arts heritage museum',
'娱乐':'entertainment cinema music film',
'体育':'sports football basketball tennis',
'人物':'scientists innovators artist leaders biography',
'旅行':'travel tourism destinations aviation',
'AI 科技':'artificial intelligence generative AI research',
'机器人':'robotics humanoid robot automation',
'商业财经':'global business finance markets',
'科学':'science discovery research space',
'环境':'climate environment energy biodiversity',
'健康':'health medicine scientific breakthroughs',
'航空航天':'space rocket satellite aerospace'
};
const RESULT_HEADERS={'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'same-origin'};
const failure=(message,status=400)=>Response.json({error:message},{status,headers:RESULT_HEADERS});
function textDecode(s){return String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,'').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&#(\d+);/g,(_,c)=>String.fromCodePoint(Number(c))).trim();}
const tag=(body,name)=>{let m=body.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));return m?textDecode(m[1]):''};
function safeNewsImage(v){try{const x=textDecode(v),u=new URL(x);return u.protocol==='https:'&&u.hostname.includes('.')&&!/\.(?:svg|gif)(?:$|\?)/i.test(u.pathname)?u.href:''}catch{return ''}}
function extractRSSImage(x){
 for(const t of x.match(/<(?:media:thumbnail|media:content|enclosure)\b[^>]*>/gi)||[]){
  if(/\btype\s*=\s*["'](?!image\/)[^"']+["']/i.test(t))continue;
  const w=+(t.match(/\bwidth\s*=\s*["'](\d+)/i)?.[1]||0),h=+(t.match(/\bheight\s*=\s*["'](\d+)/i)?.[1]||0);
  if((w&&w<180)||(h&&h<110))continue;
  const image=safeNewsImage(t.match(/\burl\s*=\s*["']([^"']+)/i)?.[1]);if(image)return image;
 }
 // WordPress news feeds often provide a text-only <description> followed by full,
 // illustrated <content:encoded>. Inspect the full content first.
 const chunks=[x.match(/<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1],x.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i)?.[1]].filter(Boolean);
 for(const chunk of chunks){const html=chunk.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"');
  for(const tagText of html.match(/<img\b[^>]*>/gi)||[]){
   const raw=tagText.match(/\b(?:src|data-src)\s*=\s*["']([^"']+)["']/i)?.[1];if(!raw)continue;
   const label=tagText.match(/\balt\s*=\s*["']([^"']+)["']/i)?.[1]||'';
   const detail=(raw+' '+label).toLowerCase();
   if(/(?:banner|advert|adsense|sponsor|promo|social.share|logo|pixel|tracking|trr50)/i.test(detail))continue;
   const w=Number(tagText.match(/\bwidth\s*=\s*["'](\d+)/i)?.[1]||0);
   const h=Number(tagText.match(/\bheight\s*=\s*["'](\d+)/i)?.[1]||0);
   if(w&&h&&(w/h>3.4||h/w>2.7||w<190||h<115))continue;
   const image=safeNewsImage(raw);if(image)return image;
  }
 }
 return '';
}
function parseRSS(xml,category){let parts=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||[];return parts.slice(0,30).map(x=>{let rawTitle=tag(x,'title');let pub=tag(x,'pubDate');let published=Date.parse(pub);let source=tag(x,'source')||'Google News';let raw=tag(x,'link');let title=rawTitle.replace(/\s+-\s+[^-]+$/,'').trim();return {title,source,url:raw,published:published?new Date(published).toISOString():null,category,language:'global',provider:'Google News RSS',image:extractRSSImage(x),imageSource:'媒体 RSS 图片',summary:source==='Google News'?'':tag(x,'description').slice(0,170)}}).filter(x=>x.title.length>=8&&x.url.startsWith('https://'));}
async function collectRSS(category){let q=QUERIES[category];let endpoint='https://news.google.com/rss/search?q='+encodeURIComponent(q+' when:7d')+'&hl=en-US&gl=US&ceid=US:en';let r=await fetch(endpoint,{headers:{'user-agent':'WorldToonEditorial/2.0 (+https://worldtoon.chenzhe223.workers.dev)'}});if(!r.ok)throw Error('RSS '+r.status);let xml=await r.text();if(!xml.includes('<rss')&&!xml.includes('<item'))throw Error('RSS format unavailable');return parseRSS(xml,category)}
const RSS_FEEDS={"国际政治":["https://feeds.bbci.co.uk/news/world/rss.xml","https://www.theguardian.com/world/rss"],"文化":["https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"],"娱乐":["https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml","https://variety.com/feed/"],"体育":["https://feeds.bbci.co.uk/sport/rss.xml","https://www.espn.com/espn/rss/news"],"人物":["https://feeds.bbci.co.uk/news/world/rss.xml"],"旅行":["https://www.theguardian.com/travel/rss"],"AI 科技":["https://techcrunch.com/category/artificial-intelligence/feed/","https://feeds.bbci.co.uk/news/technology/rss.xml"],"机器人":["https://www.therobotreport.com/feed/","https://feeds.bbci.co.uk/news/technology/rss.xml"],"商业财经":["https://feeds.bbci.co.uk/news/business/rss.xml"],"科学":["https://www.sciencedaily.com/rss/top/science.xml","https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],"环境":["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],"健康":["https://feeds.bbci.co.uk/news/health/rss.xml"],"航空航天":["https://www.nasa.gov/feed/","https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"]};
async function collectFeeds(category){const urls=RSS_FEEDS[category]||[];if(!urls.length)throw Error('No RSS feeds configured');return Promise.any(urls.map(async url=>{const r=await fetch(url,{headers:{'accept':'application/rss+xml,application/xml,text/xml,*/*'},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('RSS HTTP '+r.status);const xml=await r.text();const items=parseRSS(xml,category).map(x=>({...x,source:x.source==='Google News'?new URL(url).hostname:x.source,provider:'Direct RSS'}));if(!items.length)throw Error('No valid RSS items: '+url);return items;}));}
async function collectGDELT(category){const query=QUERIES[category];const endpoint='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(query)+'&mode=artlist&maxrecords=20&format=json&timespan=7d&sort=datedesc';let r=await fetch(endpoint,{signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('GDELT '+r.status);let j=await r.json();return (j.articles||[]).map(a=>({title:a.title||'',source:a.domain||'GDELT',url:a.url||'',published:a.seendate&&/^\d{8}T\d{6}Z$/.test(a.seendate)?new Date(a.seendate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z')).toISOString():null,category,language:a.language||'',provider:'GDELT',image:safeNewsImage(a.socialimage||a.image||''),imageSource:'GDELT 来源分享图'})).filter(a=>a.title.length>8&&a.url.startsWith('https://'))}
function uniqueNews(items){const seen=new Set();return items.filter(x=>{let key=(x.url||x.title).toLowerCase().replace(/\?.*$/,'').replace(/[^\p{L}\p{N}]/gu,'').slice(0,150);if(!key||seen.has(key))return false;seen.add(key);return true});}

function newsRelevant(item,category){
 if(category!=='机器人')return true;
 const host=(()=>{try{return new URL(item.url).hostname}catch{return ''}})();
 if((host==='therobotreport.com'||host.endsWith('.therobotreport.com'))&&item.provider==='Direct RSS')return true;
 return /\brobot(s|ic|ics)?\b|\bhumanoid\b|automation|boston dynamics|autonomous machine|robotics/i.test(item.title||'');
}
async function enrichSourceImages(items){
 // Original-article metadata only; no unrelated stock photo or invented photo.
 const trusted=['therobotreport.com','techcrunch.com','theguardian.com','variety.com','bbc.com','bbc.co.uk','nasa.gov','espn.com','sciencedaily.com'];
 const missing=items.filter(x=>!x.image&&x.provider==='Direct RSS'&&(()=>{try{const h=new URL(x.url).hostname;return trusted.some(t=>h===t||h.endsWith('.'+t))}catch{return false}})()).slice(0,6);
 await Promise.all(missing.map(async article=>{try{
  const response=await fetch(article.url,{redirect:'error',headers:{accept:'text/html'},signal:AbortSignal.timeout(3000)});
  if(!response.ok||!(response.headers.get('content-type')||'').includes('html'))return;
  if(Number(response.headers.get('content-length')||0)>2500000)return;
  const html=(await response.text()).slice(0,180000),metas=html.match(/<meta\b[^>]*>/gi)||[];
  for(const meta of metas){const prop=meta.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]||'';
   if(!/^(og:image|og:image:secure_url|twitter:image|twitter:image:src)$/i.test(prop))continue;
   const raw=meta.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];if(!raw)continue;
   const image=safeNewsImage(new URL(textDecode(raw),article.url).href);
   if(image){article.image=image;article.imageSource='来源文章的 Open Graph 主图';break;}
  }
 }catch{}}));
}

// DAVYLAB AI Radar: read-only bridge to the official published daily JSON.
// The original Radar publishing automation and website remain independent.
const RADAR_DATA='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/radar/data/';
async function radarGetJson(file,ttl=180){
 const response=await fetch(RADAR_DATA+file,{headers:{accept:'application/json'},signal:AbortSignal.timeout(9500),cf:{cacheEverything:true,cacheTtl:ttl}});
 if(!response.ok)throw Error('上游简报数据源返回 '+response.status);
 const json=await response.json();if(!json||typeof json!=='object')throw Error('上游简报格式异常');return json;
}
async function aiBriefing(url){
 try{
  if(url.pathname==='/api/ai-briefing/history'){
   const h=await radarGetJson('history.json',600);
   const days=(h.days||[]).map(x=>String(x).replace(/\.json$/,'')).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse().slice(0,100);
   return Response.json({days,source:'DAVYLAB AI Radar'},{headers:{'cache-control':'public,max-age=600','x-content-type-options':'nosniff'}});
  }
  const date=url.searchParams.get('date')||'latest';
  if(date!=='latest'&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return failure('日期格式不正确');
  const raw=await radarGetJson(date==='latest'?'latest.json':('archive/'+date+'.json'),date==='latest'?120:3600);
  if(!raw.report_date||!Array.isArray(raw.news)||!Array.isArray(raw.china_ai_news))throw Error('简报必要字段缺失');
  const str=(v,max=1000)=>String(v||'').slice(0,max);
  const https=(v)=>typeof v==='string'&&/^https:\/\//i.test(v)?v.slice(0,1900):'';
  const story=(o)=>({eventDate:str(o.event_date||o.eventDate||o.occurrence_date||'',35),title:str(o.title_zh||o.title,260),summary:str(o.summary_zh||o.summary,600),why:str(o.why_it_matters_zh||'',430),url:https(o.url),source:str(o.source,130),published:str(o.published,60),image:https(o.image_url),imageAlt:str(o.image_alt||o.title_zh||o.title,260),imageStatus:str(o.image_match_status||'',55),imageCredit:str(o.image_credit||'',120)});
  const skill=(o)=>({name:str(o.name,170),description:str(o.description_zh||o.description,400),url:https(o.url),stars:typeof o.stars_total==='number'?o.stars_total:(typeof o.stars==='number'?o.stars:null),license:str(o.license_name||o.license,130)});
  const editorial=raw.editorial||{};
  return Response.json({date:raw.report_date,posterUrl:'https://chenzhe223-tech.github.io/radar/posters/'+encodeURIComponent(raw.report_date)+'.png',generatedAt:str(raw.generated_at,80),status:str(raw.status,35),source:'DAVYLAB AI Radar',sourceUrl:'https://chenzhe223-tech.github.io/radar/daily/',top5:(raw.top5||[]).slice(0,5).map(story),global:raw.news.slice(0,40).map(story),china:raw.china_ai_news.slice(0,40).map(story),skills:(raw.skills||[]).slice(0,12).map(skill),editorial:{core:str(editorial.core_zh,2000),trend:str(editorial.trend_zh,2000),question:str(editorial.next_question_zh,1500)},warning:raw.status==='ok'?'':'上游简报状态异常，内容仅供参考',qualityStatus:str(raw.quality_gate?.status||'',40)},{headers:{'cache-control':'public,max-age=120','x-content-type-options':'nosniff'}});
 }catch(err){return Response.json({error:'AI 简报暂时无法读取：'+String(err?.message||err).slice(0,160)},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})}
}

async function news(url){
 const cat=url.searchParams.get('category')||'全部';if(cat!=='全部'&&!QUERIES[cat])return failure('无效新闻分类');
 const limit=Math.min(60,Math.max(5,Number(url.searchParams.get('limit'))||24));
 const cats=cat==='全部'?['国际政治','AI 科技','商业财经','文化','科学','体育']:[cat];
 const result=await Promise.allSettled(cats.map(async c=>{const res=await Promise.allSettled([collectFeeds(c),collectGDELT(c),collectRSS(c)]);const rows=res.flatMap(x=>x.status==='fulfilled'?x.value:[]);if(!rows.length)throw Error('新闻源不可用');return uniqueNews(rows.filter(x=>newsRelevant(x,c)));}));
 const items=uniqueNews(result.flatMap(r=>r.status==='fulfilled'?r.value:[]));
 const rank=x=>(Date.parse(x.published)||0)+(x.image?6*3600000:0);items.sort((a,b)=>rank(b)-rank(a));
 await enrichSourceImages(items.slice(0,limit));
 const warning=result.some(r=>r.status==='rejected')?'部分新闻来源暂不可用，当前内容并非完整全球新闻榜单。':'';
 if(!items.length)return Response.json({error:'新闻源暂时无法连接；平台不提供模拟新闻',diagnostics:result.map((r,i)=>({category:cats[i],error:r.status==='rejected'?String(r.reason?.message||r.reason).slice(0,140):null}))},{status:503,headers:RESULT_HEADERS});
 return Response.json({items:items.slice(0,limit),category:cat,provider:'Google News RSS / Direct RSS / GDELT',fetchedAt:new Date().toISOString(),imagePolicy:'真实媒体 RSS 缩略图及 GDELT 分享图；缺失则显示占位图',warning},{headers:{'cache-control':'public,max-age=600','x-content-type-options':'nosniff'}});
}
async function authenticate(request,env){const auth=request.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return null;let r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'apikey':SUPABASE_PUBLISHABLE_KEY,'authorization':auth}});if(!r.ok)return null;let u=await r.json();return u?.id?u:null}
async function quota(env,userId,kind,cap){if(!env.DB)throw Error('配额数据库未配置');let day=new Date().toISOString().slice(0,10);const key=userId+':'+day+':'+kind;let r=await env.DB.prepare('INSERT INTO usage_counts(id,uses,updated_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET uses=uses+1,updated_at=excluded.updated_at WHERE uses<? RETURNING uses').bind(key,new Date().toISOString(),cap).first();if(!r)throw Error('今日模型使用上限已到，请明天再试');return r.uses;}
function parseJSON(text){let s=String(text||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?\s*/,'').replace(/```$/,'');try{return JSON.parse(s)}catch{let a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));throw Error('AI 回复不是有效 JSON')}}
function aiError(err){let msg=String(err?.message||err);return msg.slice(0,250)}
async function ai(request,env,url){let user=await authenticate(request,env);if(!user)return failure('请先登录账户以使用 AI 功能',401);let type=url.pathname.endsWith('/script')?'script':url.pathname.endsWith('/characters')?'characters':'image';if(type!=='characters'&&env.AI_ENABLED!=='true')return failure('生图与编剧模型尚未获批启用；角色设计可使用免费 DeepSeek。',503);if(!env.AI)return failure('AI 免费模型绑定未配置',503);const limit=type==='script'?3:2;let body=await request.json().catch(()=>null);if(!body||JSON.stringify(body).length>1250000)return failure('参数格式无效或参考图过大',413);if(type==='script'&&(!body.title||!body.sourceURLs||!body.factNotes))return failure('请提供有效来源与事实笔记');if(type==='image'&&!body.scene)return failure('请先填写画面描述');if(type==='characters'&&String(body.concept||'').trim().length<6)return failure('请输入至少六个字的故事背景或人物设定',400);try{await quota(env,'__worldtoon_global__',type,type==='characters'?5:type==='image'?24:12);await quota(env,user.id,type,limit)}catch(err){return failure('今日免费生成额度已用完，请明天再试。',429)}
try{
 if(type==='characters'){
  const count=Math.max(1,Math.min(4,Number(body.count)||2));
  const concept=String(body.concept||'').slice(0,2000).trim();
  const title=String(body.title||'原创漫画').slice(0,180);
  if(concept.length<6)return failure('请输入至少六个字的故事背景或人物设定',400);
  const style=['杂志式原创漫画','温暖手绘','黑色幽默','未来科幻'].includes(body.style)?body.style:'杂志式原创漫画';
  const sys='你是 DAVYLAB 世界级原创漫画角色总监。围绕同一虚构故事，生成有辨识度、彼此差异明显、九格漫画中稳定一致的角色设计。角色全部原创，不使用现实公众人物或可识别的真实人物身份，不捏造真实人物的违法、私生活或其他事实指控。每个角色必须包含：中文姓名、类型、外貌与发型及五官轮廓、材质和服装、可复用的2-3个HEX主辅色或明确色名、至少3个跨画格不变的识别特征、性格和戏剧冲突功能。精确生成指定数量，避免重复角色和空洞套话。输出 JSON 对象（禁止 Markdown 或解释）：{"characters":[{"name":"角色名","type":"虚构角色","description":"外形与年龄段、发型五官","costume":"固定服饰","colors":"配色","traits":"稳定特征","personality":"动机性格"}]}。';
  const msg=JSON.stringify({title,concept,style,count,fictional:true});
  const useDeepSeek=Date.now()<Date.parse('2026-11-20T00:00:00Z');
  let model='',response=null,fallbackReason='';
  if(useDeepSeek){
    try{
      response=await env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',{
        messages:[{role:'system',content:sys},{role:'user',content:msg}],
        max_tokens:2100,temperature:0.55,response_format:{type:'json_object'}
      });
      model='deepseek-r1-distill-qwen-32b';
    }catch(err){fallbackReason='DeepSeek 免费模型暂不可用';}
  }else fallbackReason='DeepSeek 免费模型已下线';
  if(!response){
    response=await env.AI.run('@cf/google/gemma-4-26b-a4b-it',{
      messages:[{role:'system',content:sys},{role:'user',content:msg}],
      max_tokens:1650,temperature:0.65
    });
    model='gemma-4-26b-a4b-it';
  }
  let parsed;
  try{parsed=parseJSON(response.response||response.choices?.[0]?.message?.content||'')}
  catch(err){return failure('模型未返回可编辑的角色 JSON，请稍后调整故事背景再试',502)}
  if(!Array.isArray(parsed.characters)||parsed.characters.length<1)return failure('模型没有返回有效角色档案',502);
  const names=new Set();
  const chars=parsed.characters.slice(0,count).map(c=>({
    name:String(c?.name||'').trim().slice(0,80),
    type:['虚构角色','拟人化角色','抽象象征'].includes(c?.type)?c.type:'虚构角色',
    description:String(c?.description||'').slice(0,1700),
    costume:String(c?.costume||'').slice(0,400),
    colors:String(c?.colors||'').slice(0,220),
    traits:String(c?.traits||'').slice(0,950),
    personality:String(c?.personality||'').slice(0,1100)
  })).filter(c=>{if(!c.name||names.has(c.name)||!c.description||!c.traits)return false;names.add(c.name);return true});
  if(!chars.length)return failure('模型返回的角色资料不完整，请修改背景重试',502);
  return Response.json({characters:chars,model,provider:model.startsWith('deepseek')?'Cloudflare Workers AI · DeepSeek':'Cloudflare Workers AI · free fallback',modelFallback:!!fallbackReason,fallbackReason,draft:true,requiresHumanReview:true,freeTier:true},{headers:{...RESULT_HEADERS,'cache-control':'no-store'}});
 }
 if(type==='script'){
  const sys='你是专业中文编辑与原创漫画编剧。只把公共事件作为主题灵感，不能把待证实的新闻断言、犯罪、私人关系、政治交易或隐私编成可识别现实人物的指控。必须使用原创虚构人物，避免精确指向真实个人。创作有幽默感、高级杂志质感、戏剧节奏。仅输出合法JSON对象，格式 {"fiction":"...","panels":[{"title":"...","scene":"...","caption":"...","dialogue":"...","prompt":"..."}]}，panels必须恰好九个。禁止Markdown。';
  const msg=JSON.stringify({title:body.title,description:body.description,sourceTitle:body.sourceTitle,sourceURLs:body.sourceURLs,factNotes:body.factNotes,fiction:body.fiction,tone:body.tone,characters:body.characters}).slice(0,11000);
  const response=await env.AI.run('@cf/google/gemma-4-26b-a4b-it',{messages:[{role:'system',content:sys},{role:'user',content:msg}],max_tokens:3000,temperature:.6});
  const parsed=parseJSON(response.response||response.choices?.[0]?.message?.content||'');if(!Array.isArray(parsed.panels)||parsed.panels.length!==9)return failure('生成文本不完整，请修改素材后重试',502);return Response.json({panels:parsed.panels,fiction:parsed.fiction||'',model:'gemma-4-26b-a4b-it',draft:true},{headers:RESULT_HEADERS});
 }
 const form=new FormData();const prompt=`Original editorial comic art, sophisticated graphic novel, warm paper palette, crisp expressive characters, cinematic composition. NO text, NO readable letters, no logos. Original fictional people only. Scene: ${String(body.scene).slice(0,1800)}. Character bible (keep appearances consistent across images): ${String(body.characters||'').slice(0,2800)}. Art direction: ${String(body.visualNotes||'').slice(0,1000)}. Avoid identifiable real-world politician likenesses or defamatory depictions.`;
 form.append('prompt',prompt);form.append('width','768');form.append('height','1024');const refs=Array.isArray(body.references)?body.references.slice(0,4):(body.reference?[body.reference]:[]);let refIndex=0;for(const ref of refs){if(!ref?.data||!['image/png','image/jpeg','image/webp'].includes(ref.type)||ref.data.length>250000)continue;const decoded=atob(ref.data),bytes=new Uint8Array(decoded.length);for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);form.append('input_image_'+refIndex,new Blob([bytes],{type:ref.type}),'reference-'+refIndex+'.jpg');refIndex++;}if(refIndex)form.set('prompt',prompt+' Use the '+refIndex+' provided reference images to preserve character identities, faces, hairstyles, clothing and visual style consistently, but create an original fictional story composition.');
 const req=new Response(form);const out=await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b',{multipart:{body:req.body,contentType:req.headers.get('content-type')}});
 if(!out?.image)return failure('模型未返回图片',502);return Response.json({image:out.image,model:'flux-2-klein-4b',draft:true},{headers:RESULT_HEADERS});
}catch(err){return failure('生成服务暂不可用：'+aiError(err),503)}
}
// WORLD/TOON ARCHIVE / V2.5 — server-side private GitHub handoff (disabled unless secrets configured)
const WT_REPO='chenzhe223-tech/worldtoon';
const WT_API='https://api.github.com/repos/'+WT_REPO;
const WT_TASK_SCHEMA='davylab.worldtoon.task.v2';
function wtJson(value,status=200){return Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})}
function wtArchiveCanonicalURL(s){try{const u=new URL(s.trim()),url=new URLSearchParams();for(const [k,v] of Array.from(u.searchParams.entries()).sort(([a],[b])=>a.localeCompare(b))){if(!k.toLowerCase().startsWith('utm_')&&!['fbclid','gclid'].includes(k))url.append(k,v)}return u.hostname.toLowerCase().replace(/^www\./,'')+decodeURIComponent(u.pathname).replace(/\/$/,'').toLowerCase()+'?'+url.toString()}catch{return ''}}
async function wtArchiveKey(sources,title){const src=(Array.isArray(sources)?sources:[]).map(wtArchiveCanonicalURL).filter(Boolean);let normalized=[...new Set(src)].sort().join('\n');if(!normalized)normalized=String(title||'').toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized))),b=>b.toString(16).padStart(2,'0')).join('')}
function wtB64(s){const x=new TextEncoder().encode(s);let result='';for(let i=0;i<x.length;i+=8192)result+=String.fromCharCode(...x.subarray(i,i+8192));return btoa(result)}
function wtUnb64(s){const bytes=atob(String(s||'').replace(/\s+/g,''));return new TextDecoder().decode(Uint8Array.from(bytes,c=>c.charCodeAt(0)))}
async function wtGithub(env,repoPath,method='GET',obj=null){if(!env.WORLDTOON_GITHUB_TOKEN)throw Error('漫画仓库 GitHub Token 尚未配置');const url=WT_API+'/contents/'+repoPath;const r=await fetch(url,{method,headers:{'authorization':'Bearer '+env.WORLDTOON_GITHUB_TOKEN,'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'WORLD-TOON-Archive/2.5',...(obj?{'content-type':'application/json'}:{})},body:obj?JSON.stringify(obj):undefined,signal:AbortSignal.timeout(14000)});const json=await r.json().catch(()=>({message:'GitHub API response invalid'}));return {status:r.status,ok:r.ok,body:json}}
async function wtGithubJson(env,path){const r=await wtGithub(env,path);if(!r.ok)throw Error(`GitHub 读取 ${path} 失败 (${r.status})`);const j=JSON.parse(wtUnb64(r.body.content));if(!j||typeof j!=='object')throw Error('仓库 JSON 无效');return j}
async function wtArchiveAuth(req,env){if(!env.WORLDTOON_ARCHIVE_OWNER_UID||!env.WORLDTOON_GITHUB_TOKEN)return {error:'独立仓库尚未完成管理员配置',status:503};const user=await authenticate(req,env);if(!user)return {error:'请先登录 WORLD/TOON',status:401};if(user.id!==env.WORLDTOON_ARCHIVE_OWNER_UID)return {error:'当前账户没有漫画仓库管理权限',status:403};return {user}}
// Archive metadata is never inferred from UI state. A Public repository permits
// read-only public catalog preview; private repositories require owner auth.
async function wtArchiveMeta(env) {
 // A private repository MUST NOT be inferred public from a failed anonymous raw URL.
 // No credentials means configuration needed, not a missing repository or a fake empty catalog.
 if(!env.WORLDTOON_GITHUB_TOKEN) {
  return {exists:null,private:null,visibility:'unverified',readOnly:true,unconfigured:true};
 }
 const headers={'accept':'application/vnd.github+json','user-agent':'WORLD-TOON/2.6','authorization':'Bearer '+env.WORLDTOON_GITHUB_TOKEN};
 const r=await fetch(WT_API,{headers,signal:AbortSignal.timeout(9000)});
 if(r.status===404)return {exists:false,private:null,visibility:'unknown'};
 if(!r.ok)throw Error('GitHub 私有仓库状态读取失败 HTTP '+r.status);
 const v=await r.json();
 return {exists:true,private:v.private===true,visibility:v.private===true?'private':'public',default_branch:v.default_branch||'main'};
}
async function wtArchivePublicIndex(path) {
 if(!['library/index.json','queue/workbuddy.json'].includes(path))throw Error('未授权的目录路径');
 const url='https://raw.githubusercontent.com/'+WT_REPO+'/main/'+path;
 const res=await fetch(url,{signal:AbortSignal.timeout(9000),cf:{cacheEverything:true,cacheTtl:30}});
 if(!res.ok)throw Error('公开仓库索引读取失败 HTTP '+res.status);
 const raw=await res.text();
 if(raw.length>900000)throw Error('仓库索引大小异常');
 return JSON.parse(raw);
}
// Shared public WeChat publication archive — one public JSON read per explicit Studio refresh.
// It is external evidence, never a substitute for the private WorkBuddy receipt and QA.
const WT_PUBLICATIONS_URL='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/topic-studio/data/published-articles.json';
async function wtSharedPublications(){
 try{
  const r=await fetch(WT_PUBLICATIONS_URL,{headers:{accept:'application/json'},signal:AbortSignal.timeout(8500),cf:{cacheEverything:true,cacheTtl:60}});
  if(!r.ok)throw Error('HTTP '+r.status);
  const raw=await r.text();
  if(raw.length>750000)throw Error('共享归档超出安全大小');
  const data=JSON.parse(raw);
  if(data?.schema_version!==1||!Array.isArray(data.articles)||data.articles.length>700)throw Error('共享档案格式不兼容');
  const seen=new Set(),articles=[];
  for(const a of data.articles){
   const url=String(a?.url||'').trim();let u;
   try{u=new URL(url)}catch{continue}
   if(u.protocol!=='https:'||u.hostname!=='mp.weixin.qq.com'||!/^\/s\//.test(u.pathname))continue;
   const id=String(a?.id||'').slice(0,100),key=u.pathname.replace(/\/$/,'');
   if(seen.has(key))continue;seen.add(key);
   const taskId=String(a.worldtoon_task_id||a.worldtoonTaskId||a.task_id||'').slice(0,80);
   articles.push({id,title:String(a.title||'').slice(0,230),url:u.href,
    publishedAt:String(a.publishedAt||'').slice(0,35),format:String(a.format||'').slice(0,35),
    column:String(a.column||'').slice(0,90),coverUrl:String(a.coverUrl||'').slice(0,400),
    task_id:/^WT-[A-Za-z0-9-]{10,65}$/.test(taskId)?taskId:'',
    revision:Number.isInteger(Number(a.worldtoon_revision))?Number(a.worldtoon_revision):null,
    delivery_sha256:/^[0-9a-f]{64}$/i.test(String(a.worldtoon_delivery_sha256||''))?String(a.worldtoon_delivery_sha256).toLowerCase():'',
    evidence_source:String(a.source||'').slice(0,100)});
  }
  return {status:'synced',source:'topic-studio/data/published-articles.json',
   sync_method:String(data.sync_method||'').slice(0,80),
   last_synced_at:String(data.last_synced_at||'').slice(0,50),
   total:articles.length,articles:articles.slice(0,120)};
 }catch(err){return {status:'unavailable',source:'topic-studio/data/published-articles.json',
  error:String(err.message||err).slice(0,130),articles:[],total:null}}
}
function wtArchiveCheckCatalog(library,queue){
 if(library?.schema!=='davylab.worldtoon.library.v1'||queue?.schema!=='davylab.worldtoon.workbuddy-queue.v1'||!Array.isArray(library.items)||!Array.isArray(queue.items))throw Error('独立仓库目录协议不兼容');
 if(library.items.length>1500||queue.items.length>200)throw Error('仓库目录数据异常');
 // Refuse duplicate IDs or duplicated real-story fingerprints in published shelf.
 const ids=new Set(),publishedStories=new Set();
 for(const item of library.items){
  if(!item||typeof item.task_id!=='string'||ids.has(item.task_id))throw Error('漫画索引中存在重复任务');
  ids.add(item.task_id);
  if(item.status==='published'){
   if(!item.receipt?.url||!/^https:\/\/mp\.weixin\.qq\.com\/s(?:\/|\?|$)/.test(item.receipt.url))throw Error('已发表作品缺少有效的微信回执链接');
   if(item.dedupe_key&&publishedStories.has(item.dedupe_key))throw Error('已发表内容存在重复指纹');
   if(item.dedupe_key)publishedStories.add(item.dedupe_key);
  }
 }
 for(const item of queue.items){
  if(!item?.task_id||!ids.has(item.task_id)||!item.author_approved||!item.delivery_sha256)throw Error('待发表队列含未验收任务');
  if(library.items.find(x=>x.task_id===item.task_id)?.status!=='ready_for_workbuddy')throw Error('待发表状态与仓库目录不一致');
 }
}
async function wtArchiveApi(request,env,url){
 const p=url.pathname,method=request.method;
 if(p==='/api/archive/publications'&&method==='GET')return wtJson(await wtSharedPublications());
 if(p==='/api/archive/status'&&method==='GET'){
  try {
   const meta=await wtArchiveMeta(env),writeReady=meta.private===true&&!!(env.WORLDTOON_ARCHIVE_OWNER_UID&&env.WORLDTOON_GITHUB_TOKEN);
   return wtJson({repo:WT_REPO,exists:meta.exists,visibility:meta.visibility,readable:meta.exists===true&&(!meta.private||writeReady),configured:writeReady,mode:meta.unconfigured?'credentials_required':writeReady?'private_authenticated':meta.private?'private_unconfigured':'public_readonly',producer:'ChatGPT',publisher:'WorkBuddy',ai_direct_generation:false});
  }catch(err){return wtJson({repo:WT_REPO,error:'GitHub 仓库状态暂不可用：'+String(err.message||err).slice(0,140)},503)}
 }
 if(p==='/api/archive/sync'&&method==='GET'){
  try {
   const meta=await wtArchiveMeta(env);
   if(meta.unconfigured)return wtJson({repo:WT_REPO,code:'GITHUB_CREDENTIALS_REQUIRED',error:'私有 GitHub 仓库尚未在 Cloudflare Worker 配置安全访问凭证和管理员身份；请在服务端配置，不要在浏览器或聊天中粘贴密钥'},503);
   if(!meta.exists)return wtJson({repo:WT_REPO,error:'独立漫画仓库不存在或访问权限不足'},503);
   let library,queue,mode;
   if(meta.private) {
    const auth=await wtArchiveAuth(request,env);if(auth.error)return wtJson({repo:WT_REPO,error:auth.error},auth.status);
    [library,queue]=await Promise.all([wtGithubJson(env,'library/index.json'),wtGithubJson(env,'queue/workbuddy.json')]);
    mode='private_authenticated';
   } else {
    [library,queue]=await Promise.all([wtArchivePublicIndex('library/index.json'),wtArchivePublicIndex('queue/workbuddy.json')]);
    mode='public_readonly';
   }
   wtArchiveCheckCatalog(library,queue);
   const shared_publications=await wtSharedPublications();
   return wtJson({repo:WT_REPO,visibility:meta.visibility,mode,configured:mode==='private_authenticated',library,queue,shared_publications,synced_at:new Date().toISOString()});
  } catch(err){return wtJson({repo:WT_REPO,error:'漫画仓库同步失败：'+String(err.message||err).slice(0,160)},503)}
 }
 const auth=await wtArchiveAuth(request,env);
 if(auth.error)return wtJson({error:auth.error,repo:WT_REPO},auth.status);
 if(method==='POST'&&p==='/api/archive/tasks'){
  try {
   const meta=await wtArchiveMeta(env);
   if(!meta.exists||meta.private!==true)return wtJson({error:'必须先将 GitHub 漫画仓库设为 Private，公开仓库禁止派发未发表内容'},409);
  }catch(err){return wtJson({error:'派单前无法核验 GitHub 仓库私有状态：'+String(err.message||err).slice(0,120)},503)}
 }
 if(p==='/api/archive/tasks'&&method==='POST'){
  let body;try{body=await request.json()}catch{return wtJson({error:'任务格式无效'},400)}
  const t=body?.task,prompt=body?.prompt;
  if(!t||t.schema!==WT_TASK_SCHEMA||t.status!=='queued'||t.producer!=='ChatGPT'||t.publisher!=='WorkBuddy'||typeof t.title!=='string'||t.title.length<2||t.title.length>200||typeof prompt!=='string'||prompt.length<80||prompt.length>90000||!Array.isArray(t.editorial?.sources)||t.editorial.sources.length>20||typeof t.editorial.fictionalization!=='string'||!t.editorial.fictionalization.trim()||!t.editorial.disclaimer) return wtJson({error:'任务缺少必要的核验资料、脱敏策略或生产指令'},400);
  if(t.editorial.sources.length===0&&t.mode!=='original'&&t.research_required!==true)return wtJson({error:'无原始来源的热点任务必须明确标注“待核验／先研究”'},400);
  if(t.research_required===true&&t.mode==='hotspot'&&(!t.editorial.fact_notes||!t.editorial.fictionalization))return wtJson({error:'待核验任务需要事实边界与虚构改编安全规则'},400);
  const key=await wtArchiveKey(t.editorial.sources,t.title);const id='WT-'+key.slice(0,20);
  if(t.dedupe_key!==key||t.task_id!==id)return wtJson({error:'任务 ID 或去重指纹不一致'},409);
  const path='tasks/'+id+'/task.json',promptPath='tasks/'+id+'/prompt.md';
  try{
   // Idempotent create: GitHub content API rejects two competing creations of same path.
   const existing=await wtGithub(env,path);
   if(existing.ok){const prior=JSON.parse(wtUnb64(existing.body.content));if(prior.dedupe_key!==key)return wtJson({error:'任务 ID 冲突，拒绝覆盖'},409);return wtJson({existing:true,repo:WT_REPO,task_id:id,path,commit:existing.body.sha})}
   if(existing.status!==404)throw Error('GitHub 查询工单失败 '+existing.status);
   const promptExists=await wtGithub(env,promptPath);
   if(promptExists.status===404){const pre=await wtGithub(env,promptPath,'PUT',{message:'feat(worldtoon): prepare ChatGPT prompt '+id,content:wtB64(prompt)});if(!pre.ok&&pre.status!==422)throw Error('生产指令提交失败 '+pre.status)}
   else if(!promptExists.ok)throw Error('无法读取生产指令 '+promptExists.status);
   const write=await wtGithub(env,path,'PUT',{message:'feat(worldtoon): queue comic production '+id,content:wtB64(JSON.stringify(t,null,2)+'\n')});
   if(!write.ok){if(write.status===422){const retry=await wtGithub(env,path);if(retry.ok)return wtJson({existing:true,repo:WT_REPO,task_id:id,path,commit:retry.body.sha})}throw Error('GitHub 新建任务失败 '+write.status)}
   return wtJson({queued:true,existing:false,repo:WT_REPO,task_id:id,path,commit:write.body.commit?.sha||''},201);
  }catch(err){return wtJson({error:String(err.message||err).slice(0,180)},503)}
 }
 return wtJson({error:'该仓库接口不存在或请求方法不被允许'},405)
}

const COMIC_SOURCES=[{id:'news',name:'全球热点'},{id:'hackernews',name:'Hacker News'},{id:'arxiv',name:'arXiv AI论文'}];
function comicNormalize(x,id){
 try{
  let u=new URL(String(x.url||''));if(u.protocol!=='https:'||u.username||u.password)return null;
  let title=String(x.title||'').trim().slice(0,300);if(title.length<8)return null;
  let ts=Date.parse(x.published||'');
  return {title,url:u.href,summary:textDecode(x.summary||'').slice(0,500),
   category:String(x.category||'AI 科技').slice(0,45),source:String(x.source||id).slice(0,90),
   source_id:id,published:Number.isFinite(ts)?new Date(ts).toISOString():'',
   image:safeNewsImage(x.image||''),verification_status:'pending_research',rights_status:'source_link_only'};
 }catch{return null}
}
async function comicDiscover(url){
 const source=url.searchParams.get('source')||'all';
 if(!['all','news','hackernews','arxiv'].includes(source))return failure('未知素材来源',400);
 const tasks=[];
 if(source==='all'||source==='news')tasks.push({id:'news',run:async()=>{
  const r=await news(new URL('/api/news?category=全部&limit=60',url.origin));const json=await r.json();
  if(!r.ok)throw Error(json.error||'新闻源失败');return json.items||[];
 }});
 if(source==='all'||source==='hackernews')tasks.push({id:'hackernews',run:async()=>{
  const r=await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40',{signal:AbortSignal.timeout(8500)});
  if(!r.ok)throw Error('Hacker News HTTP '+r.status);
  return ((await r.json()).hits||[]).slice(0,40).map(x=>({title:x.title||x.story_title,
   url:x.url||'https://news.ycombinator.com/item?id='+encodeURIComponent(x.objectID),
   published:x.created_at,summary:'HN points '+Number(x.points||0)+' · comments '+Number(x.num_comments||0),
   category:'AI 科技',source:'Hacker News'}));
 }});
 if(source==='all'||source==='arxiv')tasks.push({id:'arxiv',run:async()=>{
  const r=await fetch('https://rss.arxiv.org/rss/cs.AI',{signal:AbortSignal.timeout(9500)});
  if(!r.ok)throw Error('arXiv HTTP '+r.status);
  const xml=await r.text();if(xml.length>2000000||!xml.includes('<item'))throw Error('论文 RSS 不可解析');
  return parseRSS(xml,'AI 科技').map(x=>({...x,source:'arXiv cs.AI'}));
 }});
 const responses=await Promise.allSettled(tasks.map(t=>t.run()));
 const items=[],warnings=[],counts=[],seen=new Set();
 for(let i=0;i<responses.length;i++){
  const result=responses[i],id=tasks[i].id;let accepted=0;
  if(result.status==='rejected'){warnings.push(id+': '+String(result.reason?.message||result.reason).slice(0,130));counts.push({id,ok:false,count:0});continue}
  for(const raw of result.value){
   const item=comicNormalize(raw,id);if(!item)continue;
   const u=new URL(item.url);for(const k of [...u.searchParams.keys()])if(k.toLowerCase().startsWith('utm_')||['fbclid','gclid'].includes(k))u.searchParams.delete(k);
   const key=u.hostname+u.pathname.replace(/\/$/,'')+u.search;
   if(seen.has(key))continue;seen.add(key);items.push(item);accepted++;
  }
  counts.push({id,ok:true,count:accepted});
 }
 items.sort((a,b)=>(Date.parse(b.published)||0)-(Date.parse(a.published)||0));
 if(!items.length)return Response.json({error:'全部素材源暂不可用',warnings,counts},{status:503,headers:RESULT_HEADERS});
 return Response.json({items:items.slice(0,Math.min(90,Math.max(5,Number(url.searchParams.get('limit'))||60))),
  sources:COMIC_SOURCES,counts,warnings,collectedAt:new Date().toISOString(),verified:false,
  note:'仅供选题的未核验线索；不得自动认定事实或使用原文图片进行出版。'},
  {headers:{'cache-control':'public,max-age=240','x-content-type-options':'nosniff'}});
}

export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/health')return Response.json({ok:true,app:'WORLD/TOON',version:'2.7.0',features:{news:true,auth:true,sync:true,characterReferences:true,script:env.AI_ENABLED==='true',characters:!!env.AI,image:env.AI_ENABLED==='true',appearance:true,eventDate:true},at:new Date().toISOString()},{headers:RESULT_HEADERS});
 if(url.pathname.startsWith('/api/archive/'))return wtArchiveApi(request,env,url);
 if(url.pathname==='/api/config')return Response.json({supabaseUrl:SUPABASE_URL,supabaseKey:SUPABASE_PUBLISHABLE_KEY,aiEnabled:env.AI_ENABLED==='true',characterAiEnabled:!!env.AI,characterAiFree:true,characterModel:Date.now()<Date.parse('2026-11-20T00:00:00Z')?'DeepSeek R1 Distill':'Gemma 4 (DeepSeek 免费模型已下线)'},{headers:RESULT_HEADERS});
 if((url.pathname==='/api/ai-briefing'||url.pathname==='/api/ai-briefing/history')&&request.method==='GET')return aiBriefing(url);
 if(url.pathname==='/api/comic/discover'&&request.method==='GET')return comicDiscover(url);
 if(url.pathname==='/api/news'&&request.method==='GET')return news(url);
 if(url.pathname.startsWith('/api/ai/')){if(request.method!=='POST')return failure('Method not allowed',405);if(!['/api/ai/script','/api/ai/image','/api/ai/characters'].includes(url.pathname))return failure('Not found',404);return ai(request,env,url)}
 const path=url.pathname==='/'?'index.html':url.pathname.slice(1);if(path.includes('..')||!(/^(index\.html|app\.js|comic-engine\.js|ranking\.js|extension\.js|briefing\.js|archive\.js|personalize\.js|styles\.css|personalize\.css|sw\.js|manifest\.webmanifest|favicon\.svg|assets\/[A-Za-z0-9_.%\-]+\.png)$/.test(path)))return new Response('Not found',{status:404});
 try{const isAsset=path.startsWith('assets/'),ttl=isAsset?3600:30;let up=await fetch(ORIGIN+path,{cf:{cacheTtl:ttl,cacheEverything:true}});if(!up.ok)return new Response('Asset unavailable',{status:up.status===404?404:503});const ext=path.split('.').pop();let h=new Headers({'content-type':CONTENT[ext]||'application/octet-stream','cache-control':isAsset?'public,max-age=3600':'public,max-age=30','x-worldtoon-version':'2.7.0','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(),microphone=(),geolocation=()'});if(!isAsset)h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://qjyqaydfezbpeimpvlcb.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");return new Response(up.body,{status:200,headers:h})}catch{return new Response('Temporary origin error',{status:503})}}
};