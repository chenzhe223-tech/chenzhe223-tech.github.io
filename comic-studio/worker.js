// WORLD/TOON 2.0 / By DAVYLAB — editorial news wire + restricted AI + GitHub static assets
const ORIGIN='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/comic-studio/';
const SUPABASE_URL='https://qjyqaydfezbpeimpvlcb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_jtWLY4vYz2-VklNLoJqxVw_lMdhtfgG'; // replaced at deployment, public (not service role)
const CONTENT={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',webmanifest:'application/manifest+json',md:'text/markdown; charset=utf-8'};
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
/* WORLD/TOON: storyboard-only inference, independent from the paid/disabled image pipeline.
 * BYO API keys are request-scoped, never persisted, echoed, logged or exposed to frontend bundles. */
async function wtStoryboardAI(request,env){
 const auth=await authenticate(request,env);
 if(!auth)return failure('请先登录后使用大模型生成；未登录仍可使用本地故事草稿和人工编辑。',401);
 let body=await request.json().catch(()=>null);
 if(!body||typeof body!=='object'||JSON.stringify(body).length>21000)return failure('剧情数据不完整或超过安全大小限制',400);
 const provider=String(body.provider||'native');
 if(!['native','deepseek','openai','claude','gemini','kimi','qwen'].includes(provider))return failure('不支持该模型服务商',400);
 const title=String(body.title||'').trim().slice(0,220),summary=String(body.summary||'').slice(0,1700);
 if(title.length<2||summary.length<8)return failure('请先补充作品标题与故事背景',400);
 if(provider==='native'&&!env.AI)return failure('当前未接入可用的内置文字模型，请使用本地故事草稿或自行接入API。',503);
 const key=String(body.apiKey||'').trim();
 if(provider!=='native'&&(key.length<12||key.length>320||/[\r\n]/.test(key)))return failure('请填写有效API Key（仅用于本次生成）',400);
 const models={deepseek:'deepseek-chat',openai:'gpt-4o-mini',claude:'claude-sonnet-4-20250514',
  gemini:'gemini-2.5-flash',kimi:'kimi-k2-0905-preview',qwen:'qwen-plus'};
 const modelPatterns={deepseek:/^deepseek-[a-z0-9.-]{1,80}$/i,openai:/^(?:gpt-[a-z0-9.-]{1,80}|o[1-9](?:-[a-z0-9.-]{1,70})?)$/i,
  claude:/^claude-[a-z0-9.-]{1,80}$/i,gemini:/^gemini-[a-z0-9.-]{1,80}$/i,
  kimi:/^(?:kimi|moonshot)-[a-z0-9.-]{1,80}$/i,qwen:/^qwen[a-z0-9.-]{1,80}$/i};
 const model=provider==='native'?'@cf/google/gemma-4-26b-a4b-it':String(body.model||models[provider]).trim();
 if(provider!=='native'&&!modelPatterns[provider].test(model))return failure('模型名称格式与所选服务商不匹配',400);
 const story={title,summary,category:String(body.category||'').slice(0,100),
  arc:String(body.arc||'反转寓言').slice(0,80),
  thesis:String(body.thesis||'').slice(0,800),
  world:String(body.world||'').slice(0,600),emotion:String(body.emotion||'').slice(0,300),
  fiction:String(body.fiction||'').slice(0,600),
  style:String(body.style||'').slice(0,200),styleRules:String(body.styleRules||'').slice(0,950),
  cast:Array.isArray(body.cast)?body.cast.slice(0,4).map(x=>({
   name:String(x?.name||'').slice(0,50),look:String(x?.look||'').slice(0,250),
   clothes:String(x?.clothes||'').slice(0,250),symbol:String(x?.symbol||'').slice(0,130),
   nature:String(x?.nature||'').slice(0,160)})):[],
  episodes:Array.isArray(body.episodes)?body.episodes.slice(0,6).map(x=>String(x).slice(0,160)):[]
 };
 if(story.cast.length<2||story.cast.some(x=>!x.name))return failure('至少需要两位原创角色的设定',400);
 try{
  await quota(env,'__worldtoon_storyboard_global__',provider==='native'?'native':'external',provider==='native'?12:80);
  await quota(env,auth.id,'storyboard_'+provider,provider==='native'?3:10);
 }catch{return failure('今日九格AI生成额度已用完；可以使用本地故事草稿并逐格编辑。',429)}
 const system='你是 WORLD/TOON · By DAVYLAB 的资深漫画编剧兼电影分镜导演。根据提供的故事标题、角色、画风和叙事结构，真正分析主题中的具体冲突和独特情节，创作9格原创中文漫画剧本。九格都要有不同且连贯的动作、空间和叙事进展；必须有开局、伏笔、升级、关键抉择、出人意料但有因果的反转、意味深长的结束。每格：title 4-18字，scene 60-220字，包含明确的镜头构图/人物动作/环境道具/连续关系，caption 0-48字，dialogue 0-75字，prompt 0-160字。分镜需要完整人物与场景，不要简单火柴人；保持人物的固定五官、服装、道具。请不要臆造可识别真实人物的罪行、隐私或政治交易；新闻未核验时只写明确的虚构寓言。文学作品未清权时仅可构思原创主题讨论，不复制受版权保护角色、对白和独特情节。只输出JSON对象，严格格式：{"analysis":"用一句话说明冲突与反转","panels":[{"title":"","scene":"","caption":"","dialogue":"","prompt":""}]}，panels必须9个，不要Markdown或其他说明。';
 let answer='',actualModel=model;
 try{
  const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify(story)}];
  if(provider==='native'){
   const result=await env.AI.run(model,{messages,max_tokens:3300,temperature:0.65});
   answer=String(result?.response||result?.choices?.[0]?.message?.content||'');
  }else if(provider==='claude'){
   const result=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:AbortSignal.timeout(38000),
    headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model,system,messages:[{role:'user',content:JSON.stringify(story)}],max_tokens:3800,temperature:0.7})});
   if(!result.ok)return failure('Claude 请求失败（HTTP '+result.status+'）。请检查密钥、额度或模型名称。',502);
   const parsed=await result.json();answer=String((parsed?.content||[]).find(x=>x?.type==='text')?.text||'');
   actualModel=String(parsed?.model||model).slice(0,100);
  }else if(provider==='gemini'){
   const result=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',signal:AbortSignal.timeout(38000),
    headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(story)}]}],generationConfig:{temperature:0.7,maxOutputTokens:3800,responseMimeType:'application/json'}})});
   if(!result.ok)return failure('Gemini 请求失败（HTTP '+result.status+'）。请检查密钥、额度或模型名称。',502);
   const parsed=await result.json();answer=String(parsed?.candidates?.[0]?.content?.parts?.map(x=>x?.text||'').join('')||'');
   actualModel=model;
  }else{
   const endpoints={deepseek:'https://api.deepseek.com/chat/completions',openai:'https://api.openai.com/v1/chat/completions',
    kimi:'https://api.moonshot.cn/v1/chat/completions',qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'};
   const result=await fetch(endpoints[provider],{method:'POST',signal:AbortSignal.timeout(38000),
    headers:{'content-type':'application/json','authorization':'Bearer '+key},
    body:JSON.stringify({model,messages,temperature:0.7,max_tokens:3800,...(provider==='openai'?{response_format:{type:'json_object'}}:{})})});
   if(!result.ok)return failure(provider+' 请求失败（HTTP '+result.status+'）。请检查密钥、额度或模型名称。',502);
   const parsed=await result.json();answer=String(parsed?.choices?.[0]?.message?.content||'');
   actualModel=String(parsed?.model||model).slice(0,100);
  }
  const raw=parseJSON(answer);
  if(!Array.isArray(raw.panels)||raw.panels.length!==9)return failure('模型未完整生成九格，请重试或使用本地草稿。',502);
  const panels=raw.panels.map((x,i)=>{
   const title=String(x?.title||'').trim().slice(0,100);
   const scene=String(x?.scene||'').trim().slice(0,1700);
   const caption=String(x?.caption||'').trim().slice(0,550);
   const dialogue=String(x?.dialogue||'').trim().slice(0,550);
   const prompt=String(x?.prompt||'').trim().slice(0,1200);
   if(title.length<2||scene.length<32||!caption&&!dialogue)throw Error('模型第'+(i+1)+'格内容不完整');
   return {title,scene,caption,dialogue,prompt};
  });
  return Response.json({panels,analysis:String(raw.analysis||'').slice(0,600),
   provider,model:actualModel,method:'verified_model_response',generated_at:new Date().toISOString(),draft:true,
   requiresHumanReview:true,rightsCleared:false,factChecked:false},
   {headers:{...RESULT_HEADERS,'cache-control':'no-store'}});
 }catch(err){return failure('模型没有返回符合要求的九格草稿，请重试或使用本地规则建议。',502)}
}
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
async function wtArchiveKey(sources,title,revision='',series=null){const src=(Array.isArray(sources)?sources:[]).map(wtArchiveCanonicalURL).filter(Boolean);let normalized=[...new Set(src)].sort().join('\n');if(!normalized)normalized=String(title||'').toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');if(revision){if(!/^r[2-9][0-9]*-[a-z0-9]{8}$/.test(revision))throw Error('创意修订标识非法');normalized+='\nrevision:'+revision}if(series?.id&&series?.episode)normalized+='\nseries:'+series.id+':'+series.episode;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized))),b=>b.toString(16).padStart(2,'0')).join('')}
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
async function wtVerifyPilotImage(env,taskId,fileName,expectedHash){
 const path='tasks/'+taskId+'/pilot/'+fileName,original=await wtGithub(env,path);
 if(!original.ok)return {ok:false,error:fileName+' 尚未在私有仓提交真实 PNG'};
 if(Number(original.body?.size||0)>12*1024*1024||Number(original.body?.size||0)<40000)
  return {ok:false,error:fileName+' 超出图片文件尺寸限制'};
 let encoded=String(original.body?.content||'').replace(/\s+/g,'');
 if(!encoded&&original.body?.sha){
  const r=await fetch(WT_API+'/git/blobs/'+encodeURIComponent(original.body.sha),{
   headers:{'authorization':'Bearer '+env.WORLDTOON_GITHUB_TOKEN,
    'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'WORLD-TOON-Archive/2.5'},
   signal:AbortSignal.timeout(14000)});
  if(!r.ok)return {ok:false,error:fileName+' 文件哈希读取失败'};
  const blob=await r.json();
  encoded=String(blob.content||'').replace(/\s+/g,'');
 }
 if(!encoded)return {ok:false,error:fileName+' GitHub 图像字节不可验证'};
 const decoded=atob(encoded),bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 if(bytes.length<40000||bytes.length>12*1024*1024||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)
  return {ok:false,error:fileName+' 必须是真实 PNG'};
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 return {ok:hash===expectedHash,error:hash===expectedHash?'':fileName+' SHA256 与作者实际审核的样稿不一致'};
}


// WORLD/TOON 3.0 authenticated handoff. Staging is NOT approval or publication.
function wt3Hex(bytes){return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}
function wt3Bytes64(bytes){
 let t='';for(let i=0;i<bytes.length;i+=8192)t+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(t)
}
async function wt3GithubRaw(env,path){
 const r=await wtGithub(env,path);
 if(!r.ok)throw Error('素材不存在 '+r.status);
 let encoded=r.body.content;
 if(!encoded&&r.body.sha){
  const b=await fetch(WT_API+'/git/blobs/'+r.body.sha,{headers:{
   'authorization':'Bearer '+env.WORLDTOON_GITHUB_TOKEN,'accept':'application/vnd.github+json',
   'user-agent':'WORLD-TOON/3.0'},signal:AbortSignal.timeout(20000)});
  if(!b.ok)throw Error('无法读取 GitHub 原图 blob '+b.status);
  encoded=(await b.json()).content;
 }
 if(typeof encoded!=='string'||!encoded)throw Error('GitHub 文件内容不可用');
 const raw=atob(encoded.replace(/\s+/g,''));
 return Uint8Array.from(raw,x=>x.charCodeAt(0))
}
async function wt3ArchiveV3(request,env,url){
 const p=url.pathname,m=request.method,tid=url.searchParams.get('task_id')||'';
 if(p==='/api/archive/deepseek-status'&&m==='GET'){
  const auth=await wtArchiveAuth(request,env);
  if(auth.error)return wtJson({error:auth.error},auth.status);
  return wtJson({configured:!!env.WORLDTOON_DEEPSEEK_API_KEY,model:'deepseek-flash',paid_call_requires_explicit_author_action:true});
 }
 if(p==='/api/archive/deepseek-expand'&&m==='POST'){
  const auth=await wtArchiveAuth(request,env);if(auth.error)return wtJson({error:auth.error},auth.status);
  if(!env.WORLDTOON_DEEPSEEK_API_KEY)return wtJson({code:'DEEPSEEK_KEY_REQUIRED',error:'DeepSeek 真实模型尚未配置服务端 API Key。此接口不会用规则假冒模型响应。'},503);
  let a;try{a=await request.json()}catch{return wtJson({error:'输入不是合法 JSON'},400)}
  const idea=String(a?.idea||'').trim(),n=Number(a?.panel_count||9);
  if(idea.length<8||idea.length>1800||!Number.isInteger(n)||n<4||n>60)return wtJson({error:'创意必须是8–1800字，篇幅4–60格'},400);
  const bible=a?.series_bible&&typeof a.series_bible==='object'?JSON.stringify(a.series_bible).slice(0,8000):'无';
  const prompt='请将下列构思改编为原创中文连续漫画剧本。仅输出一个完整 JSON 对象，不要 markdown。字段：title,subtitle,summary,world,theme,fictionalization,reasoning,characters数组(至少2位，含role,name,look,clothes,symbol,nature),panels数组(每格title,scene至少30汉字,caption,dialogue,visual_prompt)。请分析剧情复杂度，并推荐4–60格：不能为凑字数重复镜头。保持章节角色与画风圣经一致。不要无证据造谣真实人物。作者将逐格修改、审阅与签署；此响应不是生图也不是新闻事实核验。' +
    '\n初始篇幅建议:'+n+'格\n故事构思:'+idea+
    '\n题材:'+String(a.category||'原创').slice(0,80)+
    '\n系列设定:'+bible+'\n前情摘要:'+String(a.previous_summary||'').slice(0,2000);
  let upstream;
  try{upstream=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',
    headers:{authorization:'Bearer '+env.WORLDTOON_DEEPSEEK_API_KEY,'content-type':'application/json'},
    body:JSON.stringify({model:'deepseek-flash',temperature:0.65,stream:false,
      response_format:{type:'json_object'},
      messages:[{role:'system',content:'你是高级中文漫画编剧。只返回可解析 JSON，禁止未经证实的现实指控。'},
                {role:'user',content:prompt}],max_tokens:11000}),
    signal:AbortSignal.timeout(55000)});}catch(err){return wtJson({error:'DeepSeek 服务不可用：'+String(err.message||err).slice(0,100)},503)}
  if(!upstream.ok)return wtJson({error:'DeepSeek API 未完成请求（HTTP '+upstream.status+'）。请检查额度及配置。'},upstream.status===402?402:503);
  const result=await upstream.json();
  let story;try{story=JSON.parse(result.choices?.[0]?.message?.content||'')}catch{return wtJson({error:'DeepSeek 未返回有效的 JSON 漫画剧本'},502)}
  if(!story||!Array.isArray(story.panels)||story.panels.length<4||story.panels.length>60||
     !Array.isArray(story.characters)||story.characters.length<2)
    return wtJson({error:'DeepSeek 生成内容未达到分镜与角色结构要求，可重新调整创意后重试'},422);
  return wtJson({method:'verified_model_response',model:result.model||'deepseek-flash',
    story,usage:result.usage?{total_tokens:result.usage.total_tokens}:null});
 }
 if(p==='/api/archive/cover'&&m==='GET'){
  if(!/^WT-[a-f0-9]{20}$/.test(tid))return wtJson({error:'编号无效'},400);
  try{
   const catalog=await wtGithubJson(env,'library/index.json');
   const item=(catalog.items||[]).find(x=>x.task_id===tid);
   if(!item||item.status!=='published'||item.receipt?.status!=='published'||
      item.cover!=='deliveries/'+tid+'/cover.png')return wtJson({error:'暂无经核验发表的封面'},404);
   const raw=await wt3GithubRaw(env,item.cover);
   return new Response(raw,{headers:{'content-type':'image/png','cache-control':'public,max-age=600',
       'x-content-type-options':'nosniff','content-disposition':'inline; filename="cover.png"'}});
  }catch(e){return wtJson({error:'封面读取暂不可用'},503)}
 }
 if(p==='/api/archive/assets'&&m==='PUT'){
  const auth=await wtArchiveAuth(request,env);if(auth.error)return wtJson({error:auth.error},auth.status);
  if(!/^WT-[a-f0-9]{20}$/.test(tid))return wtJson({error:'任务编号无效'},400);
  const path=url.searchParams.get('path')||'';
  const panel=path.match(/^panels\/(0[1-9]|[1-5][0-9]|60)\.png$/);
  const image=!!panel||path==='cover.png',markdown=path==='caption.md'||path==='sources.md'||path==='style-lock.json';
  if(!image&&!markdown)return wtJson({error:'只允许暂存封面、分镜和文案，不允许跳过 QA 写入 manifest'},403);
  const taskResult=await wtGithub(env,'tasks/'+tid+'/task.json');
  if(!taskResult.ok)return wtJson({error:'必须先正式 GitHub 派单'},404);
  let task;try{task=JSON.parse(wtUnb64(taskResult.body.content))}catch{return wtJson({error:'正式任务资料损坏'},409)}
  if(task.task_id!==tid||!['ChatGPT','WorkBuddy'].includes(task.producer))return wtJson({error:'不允许对非正式生产任务暂存'},403);
  const panelCount=Number(task.panel_count||9);
  if(panel&&Number(panel[1])>panelCount)return wtJson({error:'画格超出导演台批准的篇幅'},409);
  const index=await wtGithubJson(env,'library/index.json');
  const catalog=(index.items||[]).find(x=>x.task_id===tid);
  if(catalog&&['published','ready_for_workbuddy','workbuddy_received','draft_uploaded','publishing'].includes(catalog.status))
    return wtJson({error:'交付已进入出版流程，不允许覆盖；请建立新修订版本'},409);
  const limit=image?20*1024*1024:150000;
  if(Number(request.headers.get('content-length')||0)>limit)return wtJson({error:'单文件超出限制'},413);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length<10||bytes.length>limit)return wtJson({error:'内容为空或超出大小限制'},413);
  if(image&&!(bytes.length>=40000&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71))
    return wtJson({error:'仅允许真实 PNG 文件，禁止 SVG、占位和错误图片格式'},422);
  if(image){const view=new DataView(bytes.buffer);if(view.getUint32(16,false)<1080||view.getUint32(20,false)<1440)
    return wtJson({error:'PNG 原图低于 1080×1440'},422)}
  if(markdown){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return wtJson({error:'文案必须为 UTF-8'},422)}}
  const sha256=wt3Hex(await crypto.subtle.digest('SHA-256',bytes));
  const gitBytes=new Uint8Array(new TextEncoder().encode('blob '+bytes.length+'\0').length+bytes.length);
  const gitHead=new TextEncoder().encode('blob '+bytes.length+'\0');
  gitBytes.set(gitHead);gitBytes.set(bytes,gitHead.length);
  const gitSha=wt3Hex(await crypto.subtle.digest('SHA-1',gitBytes));
  const remotePath='deliveries/'+tid+'/'+path,existing=await wtGithub(env,remotePath);
  if(existing.ok&&existing.body.sha===gitSha)
    return wtJson({task_id:tid,path,sha256,verified:true,existing:true,git_blob_sha:gitSha});
  if(existing.ok)return wtJson({error:'GitHub 已存在不同内容，禁止无确认覆盖；须另建版本或人工修订'},409);
  if(existing.status!==404)return wtJson({error:'仓库资源读取失败 '+existing.status},503);
  const written=await wtGithub(env,remotePath,'PUT',{message:'feat(worldtoon): stage verified original asset '+tid+' '+path,
     content:wt3Bytes64(bytes)});
  if(!written.ok)return wtJson({error:'GitHub 文件提交失败 HTTP '+written.status},503);
  const check=await wtGithub(env,remotePath);
  if(!check.ok||check.body.sha!==gitSha)return wtJson({error:'GitHub 上传后校验未通过，请勿宣称交付'},503);
  return wtJson({task_id:tid,path,sha256,verified:true,commit:written.body.commit?.sha||null,git_blob_sha:gitSha},201);
 }

 if(p==='/api/archive/final-approval'&&m==='POST'){
  const auth=await wtArchiveAuth(request,env);if(auth.error)return wtJson({error:auth.error},auth.status);
  let body;try{body=await request.json()}catch{return wtJson({error:'审核资料必须为 JSON'},400)}
  const t=String(body?.task_id||'');
  if(!/^WT-[a-f0-9]{20}$/.test(t)||body?.author_confirmed!==true||
     body?.approval_scope!=='final_comic_publication'||
     !Array.isArray(body?.reviewed_checks)||body.reviewed_checks.length!==8||
     body.reviewed_checks.some(x=>x!==true))
     return wtJson({error:'必须由已登录作者逐项检查质量、来源、版权并主动确认最终出版授权'},422);
  const record=await wtGithub(env,'tasks/'+t+'/task.json');
  if(!record.ok)return wtJson({error:'任务尚未正式 GitHub 派单'},404);
  let task;try{task=JSON.parse(wtUnb64(record.body.content))}catch{return wtJson({error:'正式工单损坏'},409)}
  if(task.task_id!==t||!['ChatGPT','WorkBuddy'].includes(task.producer))return wtJson({error:'生产者不匹配'},409);
  const count=Number(task.panel_count||9);
  if(!Number.isInteger(count)||count<4||count>60)return wtJson({error:'任务篇幅无效'},409);
  if(task.creative_direction?.production_gates?.pilot_required){
    const lock=task.creative_direction.approval?.lock_hash;
    const pilot=await wtGithub(env,'tasks/'+t+'/pilot-approval.json');
    if(!pilot.ok)return wtJson({error:'真实试画尚未由作者在创意导演台独立批准，不能进入最终出版审批'},409);
    let proof;try{proof=JSON.parse(wtUnb64(pilot.body.content))}catch{return wtJson({error:'试画作者批准回执无效'},409)}
    if(proof.author_approved!==true||proof.task_id!==t||proof.lock_hash!==lock)
      return wtJson({error:'试画审批与该任务创意锁不一致'},409);
  }
  const original=body.manifest||{},assets=original.assets||{},sha=original.sha256||{},qa=original.qa||{};
  const panels=Array.from({length:count},(_,i)=>'panels/'+String(i+1).padStart(2,'0')+'.png');
  if(JSON.stringify(assets.panels)!==JSON.stringify(panels)||assets.cover!=='cover.png'||
     assets.caption!=='caption.md'||assets.sources!=='sources.md')
     return wtJson({error:'漫画图片与任务篇幅不一致；应为连续独立 PNG 与独立封面'},422);
  const names=['cover.png',...panels,'caption.md','sources.md'];
  if(names.some(path=>!/^[a-f0-9]{64}$/.test(String(sha[path]||''))))
     return wtJson({error:'交付清单缺少真实文件 SHA256，请先完成全部素材暂存'},422);
  const gates=task.creative_direction?.production_gates||{};
  if(gates.preview_sha256_equals_final_panel_01===true){
    if(!original.image_provenance||!original.image_provenance.model_id||
       original.image_provenance.placeholder_or_vector_rasterized!==false)
      return wtJson({error:'缺少实际生图模型和无占位图来源证明，禁止冒充精品漫画'},422);
    for(const x of ['style_consistency','character_continuity','story_continuity','preview_identity','no_placeholders','model_resolution_verified'])
      if(qa[x]!==true)return wtJson({error:'缺少人工核实的 V3 画风、角色与首图一致性质检：'+x},422);
    const locked=await wtGithub(env,'deliveries/'+t+'/style-lock.json');
    if(!locked.ok)return wtJson({error:'缺少实际 style-lock.json 与真实生成参数'},409);
  }
  if(task.research_required===true&&(!Array.isArray(original.verified_sources)||!original.verified_sources.length||
    original.verified_sources.some(x=>typeof x!=='string'||!/^https?:\/\//.test(x))))
    return wtJson({error:'现实热点尚缺少核实过的一手来源，拒绝最终出版批准'},422);
  const required=['size_checked','visual_reviewed','chinese_text_reviewed','fiction_disclosed',
                   'sources_checked','rights_checked','phone_previewed'];
  if(required.some(x=>qa[x]!==true)||(count===9?qa.nine_images!==true:qa.panel_count_checked!==true))
     return wtJson({error:'8项质量审核尚未逐项通过'},422);
  // GitHub Actions will independently hash every actual asset, validate PNG and pilot,
  // and build the publication queue only after the manifest is accepted.
  const existing=await wtGithub(env,'deliveries/'+t+'/manifest.json');
  if(existing.ok)return wtJson({error:'已有不可覆盖的最终验收清单；修订版必须新建任务'},409);
  if(existing.status!==404)return wtJson({error:'无法核对当前验收清单'},503);
  const preflight=await Promise.all(names.map(path=>wtGithub(env,'deliveries/'+t+'/'+path)));
  if(preflight.some(x=>!x.ok))return wtJson({error:'GitHub 缺少真实成品文件，或暂存未全部成功'},409);
  const sanitized={schema:'davylab.worldtoon.delivery.v2',task_id:t,title:task.title,producer:task.producer,
    revision:1,ready_for_qa:true,author_approved:true,approved_at:new Date().toISOString(),
    approved_by:'authenticated_worldtoon_owner',approval_scope:'final_comic_publication',
    assets:{cover:'cover.png',panels,caption:'caption.md',sources:'sources.md'},
    sha256:Object.fromEntries(names.map(x=>[x,sha[x]])),qa,
    verified_sources:Array.isArray(original.verified_sources)?original.verified_sources:[],
    image_provenance:original.image_provenance||undefined};
  const written=await wtGithub(env,'deliveries/'+t+'/manifest.json','PUT',{message:'feat(worldtoon): owner final QA approval '+t,
    content:wtB64(JSON.stringify(sanitized,null,2)+'\n')});
  if(!written.ok)return wtJson({error:'最终验收记录 GitHub 提交失败 '+written.status},503);
  return wtJson({task_id:t,manifest_path:'deliveries/'+t+'/manifest.json',
    commit:written.body.commit?.sha||null,
    status:'submitted_for_independent_github_actions_qa',
    ready_for_workbuddy:false,published:false},201);
 }

 return null;
}

async function wtArchiveApi(request,env,url){
 const p=url.pathname,method=request.method;
  const v3=await wt3ArchiveV3(request,env,url);if(v3)return v3;
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
 if(method==='POST'&&p==='/api/archive/pilot-approval'){
  let receipt;try{receipt=await request.json()}catch{return wtJson({error:'试画审批格式无效'},400)}
  if(receipt?.schema!=='davylab.worldtoon.pilot-approval.v1'||receipt.author_approved!==true||
    !/^WT-[a-f0-9]{20}$/.test(String(receipt.task_id||''))||
    !/^[a-f0-9]{8}$/.test(String(receipt.lock_hash||''))||
    ![receipt.character_sheet_sha256,receipt.pilot_frame_sha256].every(x=>/^[a-f0-9]{64}$/.test(String(x||'')))||
    ![receipt.character_sheet_dimensions,receipt.pilot_frame_dimensions].every(x=>x&&
      Number.isInteger(x.width)&&x.width>=640&&Number.isInteger(x.height)&&x.height>=640))
    return wtJson({error:'请上传两张真实高分辨率图片，经作者确认后再签署审核回执'},422);
  try{
   const meta=await wtArchiveMeta(env);
   if(meta.private!==true)return wtJson({error:'仅允许在私有漫画仓库签署试画回执'},409);
   const original=await wtGithub(env,'tasks/'+receipt.task_id+'/task.json');
   if(!original.ok)return wtJson({error:'找不到该漫画的正式创意任务'},404);
   const task=JSON.parse(wtUnb64(original.body.content));
   if(task.creative_direction?.approval?.lock_hash!==receipt.lock_hash||
      task.creative_direction?.lock_status!=='approved'||
      task.creative_direction?.production_gates?.pilot_required!==true)
      return wtJson({error:'审核样稿与原任务锁定的创意方案不一致'},409);
   const proofs=await Promise.all([
    wtVerifyPilotImage(env,receipt.task_id,'character-sheet.png',receipt.character_sheet_sha256),
    wtVerifyPilotImage(env,receipt.task_id,'pilot-01.png',receipt.pilot_frame_sha256)
   ]);
   if(proofs.some(x=>!x.ok))return wtJson({error:'GitHub 真实试画尚未与作者批准图一致：'+proofs.filter(x=>!x.ok).map(x=>x.error).join('；')},409);
   const proofPath='tasks/'+receipt.task_id+'/pilot-approval.json';
   const prior=await wtGithub(env,proofPath);
   if(prior.ok){
    const prev=JSON.parse(wtUnb64(prior.body.content));
    if(prev.character_sheet_sha256===receipt.character_sheet_sha256&&prev.pilot_frame_sha256===receipt.pilot_frame_sha256&&prev.lock_hash===receipt.lock_hash)
      return wtJson({existing:true,path:proofPath,commit:prior.body.sha});
    return wtJson({error:'该任务已有不同版本的正式试画批准回执。必须通过新版本任务修订，不能覆盖作者签署'},409);
   }
   if(prior.status!==404)throw Error('GitHub 审核回执查询失败 '+prior.status);
   const sanitized={schema:receipt.schema,task_id:receipt.task_id,lock_hash:receipt.lock_hash,
    author_approved:true,scope:'character_sheet_and_pilot_frame_only',
    approved_at:new Date().toISOString(),character_sheet_sha256:receipt.character_sheet_sha256,
    pilot_frame_sha256:receipt.pilot_frame_sha256,character_sheet_dimensions:receipt.character_sheet_dimensions,
    pilot_frame_dimensions:receipt.pilot_frame_dimensions,publication_approved:false};
   const written=await wtGithub(env,proofPath,'PUT',{message:'feat(worldtoon): author approve visual pilot '+receipt.task_id,content:wtB64(JSON.stringify(sanitized,null,2)+'\n')});
   if(!written.ok)throw Error('GitHub 试画回执写入失败 '+written.status);
   return wtJson({existing:false,path:proofPath,commit:written.body.commit?.sha||''},201);
  }catch(err){return wtJson({error:'试画审批暂未写入：'+String(err.message||err).slice(0,150)},503)}
 }
 if(method==='POST'&&p==='/api/archive/tasks'){
  try {
   const meta=await wtArchiveMeta(env);
   if(!meta.exists||meta.private!==true)return wtJson({error:'必须先将 GitHub 漫画仓库设为 Private，公开仓库禁止派发未发表内容'},409);
  }catch(err){return wtJson({error:'派单前无法核验 GitHub 仓库私有状态：'+String(err.message||err).slice(0,120)},503)}
 }
 if(p==='/api/archive/tasks'&&method==='POST'){
  let body;try{body=await request.json()}catch{return wtJson({error:'任务格式无效'},400)}
  const t=body?.task,prompt=body?.prompt;
  if(!t||t.schema!==WT_TASK_SCHEMA||t.status!=='queued'||!['ChatGPT','WorkBuddy'].includes(t.producer)||t.publisher!=='WorkBuddy'||typeof t.title!=='string'||t.title.length<2||t.title.length>200||typeof prompt!=='string'||prompt.length<80||prompt.length>90000||!Array.isArray(t.editorial?.sources)||t.editorial.sources.length>20||typeof t.editorial.fictionalization!=='string'||!t.editorial.fictionalization.trim()||!t.editorial.disclaimer) return wtJson({error:'任务缺少必要的核验资料、脱敏策略或生产指令'},400);
    const creative=t.creative_direction;
  if(!creative||creative.version!==1||creative.lock_status!=='approved'||creative.approval?.author_approved!==true||
    !/^[0-9a-f]{8}$/.test(String(creative.approval.lock_hash||''))||
    !Array.isArray(creative.characters)||creative.characters.length<2||
    !Array.isArray(creative.storyboard)||creative.storyboard.length!==(t.panel_count||9)||
    creative.storyboard.some((x,i)=>x.index!==i+1||String(x.scene||'').trim().length<30||
      !(String(x.caption||'').trim()||String(x.dialogue||'').trim()))||
    !creative.visual_rules?.size||!creative.cover_brief||
    !prompt.includes(creative.approval.lock_hash)||!prompt.includes('character-sheet.png'))
      return wtJson({code:'CREATIVE_APPROVAL_REQUIRED',error:'正式派单前必须锁定画风、人物和九格分镜，并要求 ChatGPT 先交角色定妆和首格样稿'},422);
if(t.editorial.sources.length===0&&t.mode!=='original'&&t.research_required!==true)return wtJson({error:'无原始来源的热点任务必须明确标注“待核验／先研究”'},400);
  if(t.research_required===true&&t.mode==='hotspot'&&(!t.editorial.fact_notes||!t.editorial.fictionalization))return wtJson({error:'待核验任务需要事实边界与虚构改编安全规则'},400);
  const key=await wtArchiveKey(t.editorial.sources,t.title,t.creative_revision||'',t.series);const id='WT-'+key.slice(0,20);
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

const COMIC_SOURCES=[{id:'news',name:'全球热点'},{id:'hackernews',name:'Hacker News'},{id:'arxiv',name:'arXiv AI论文'},{id:'classics',name:'经典故事'},{id:'history',name:'历史脑洞'},{id:'literary_series',name:'世界文学连载'},{id:'nobel_literature',name:'诺奖文学作品'},{id:'academic_events',name:'世界学术活动'}];
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
 if(!['all','news','hackernews','arxiv','classics','history','literary_series','nobel_literature','academic_events'].includes(source))return failure('未知素材来源',400);
 if(source==='classics'||source==='history')return heritageDiscover(source,String(url.searchParams.get('q')||'').slice(0,100),Math.min(90,Math.max(5,Number(url.searchParams.get('limit'))||60)));
 if(['literary_series','nobel_literature','academic_events'].includes(source))return editorialDiscover(source);
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
   category:'科技社区',source:'Hacker News'}));
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


// Curated editorial leads are hosted as a versioned source-linked JSON file in the existing site repo.
// No copyrighted story passage or novel text is transferred; the cards contain original editorial hooks.
async function editorialDiscover(source){
 try{
  const r=await fetch(ORIGIN+'editorial-series.json',{signal:AbortSignal.timeout(9500),headers:{accept:'application/json'}});
  if(!r.ok)throw Error('Editorial source '+r.status);
  const raw=await r.text();if(raw.length>220000)throw Error('Editorial manifest too large');
  const doc=JSON.parse(raw);
  if(doc.schema!=='davylab.worldtoon.curated-discovery.v1'||!doc.sources||!Array.isArray(doc.sources[source]))throw Error('Editorial manifest schema mismatch');
  const today=new Date().toISOString().slice(0,10);
  const items=[],seen=new Set();
  for(const entry of doc.sources[source]){
   if(!entry||entry.source_id!==source||!entry.id||seen.has(entry.id))continue;
   let u;try{u=new URL(String(entry.url||''))}catch{continue}
   if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))continue;
   if(source==='literary_series'&&u.hostname!=='www.gutenberg.org')continue;
   if(source==='nobel_literature'&&u.hostname!=='www.nobelprize.org')continue;
   if(source==='academic_events'&&!['royalsociety.org','www.royalsociety.org','rs-uks-score01.royalsociety.org','neurips.cc','www.neurips.cc','iclr.cc','www.iclr.cc','www.lindau-nobel.org'].includes(u.hostname))continue;
   if(source==='academic_events'&&String(entry.event_end_date||entry.eventDate||'')<today)continue; // never advertise concluded events
   const beats=Array.isArray(entry.story_beats)?entry.story_beats.filter(x=>typeof x==='string').slice(0,6):[];
   const episodes=Array.isArray(entry.series_episodes)?entry.series_episodes.filter(x=>typeof x==='string').slice(0,6):[];
   if(beats.length<3||episodes.length<3||String(entry.summary||'').length<20)continue;
   seen.add(entry.id);
   items.push({...entry,title:String(entry.title).slice(0,230),summary:String(entry.summary).slice(0,380),
    why:String(entry.why||'').slice(0,280),story_beats:beats,series_episodes:episodes,
    source_id:source,url:u.href,image:'',published:'',editorial_reviewed_on:doc.reviewed_on,
    rights_cleared:false,fact_checked:false});
  }
  if(!items.length)throw Error('No verified editorial leads; old snapshot remains unchanged');
  return Response.json({items,source,verified:false,rights_cleared:false,method:'source_linked_editorial_selection',
   collectedAt:new Date().toISOString(),
   note:'文学奖与学术活动均来自可追溯官方链接；原创连载构思不代表改编版权、学术事实或传播热度已核验。'},
   {headers:{'cache-control':'public,max-age=1200','x-content-type-options':'nosniff'}});
 }catch(err){return Response.json({error:'专题素材不可用',detail:String(err?.message||err).slice(0,140)},{status:503,headers:RESULT_HEADERS})}
}

// WORLD/TOON evergreen research and public-domain visual references.
// Catalogue entries are discovery leads, not historical fact checks or cleared translations.
async function heritageGetJSON(url,timeout=8500){
 const r=await fetch(url,{headers:{accept:'application/json','user-agent':'WorldToon-Evergreen/1.0'},signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw Error('上游 HTTP '+r.status);
 const raw=await r.text();if(raw.length>1400000)throw Error('上游响应过大');
 return JSON.parse(raw);
}
function heritageBook(x){
 const id=Number(x?.id);if(!Number.isInteger(id)||id<=0)return null;
 const title=String(x.title||'').slice(0,240);
 const author=Array.isArray(x.authors)?x.authors.map(a=>a.name).filter(Boolean).slice(0,3).join(', '):'';
 if(title.length<4)return null;
 return {title,url:'https://www.gutenberg.org/ebooks/'+id,summary:'经典文学 · '+author+' · '+(x.languages||[]).join('/'),
  category:'经典故事',source:'Project Gutenberg',source_id:'gutenberg',published:'',
  image:'',evergreen:true,verification_status:'pending_research',rights_status:'check_jurisdiction',
  classic_id:id,author,language:(x.languages||[])[0]||'',source_license_note:'原著美国公有领域不等于全球版权和翻译版本均已开放'};
}
function heritageEntity(x){
 const id=String(x.id||'');
 if(!/^Q\d+$/.test(id)||!x.label)return null;
 return {title:String(x.label).slice(0,240),url:'https://www.wikidata.org/wiki/'+id,
  summary:String(x.description||'历史人物或事件，待补充权威史料核验').slice(0,280),
  category:'历史脑洞',source:'Wikidata',source_id:'wikidata',published:'',
  image:'',evergreen:true,verification_status:'pending_research',rights_status:'metadata_attribution',
  entity_id:id,source_license_note:'仅将结构化实体作为线索；历史解释需独立核验'};
}
async function heritageDiscover(source,query,limit){
 const attempts=[];
 if(source==='classics')attempts.push({id:'gutenberg',run:async()=>{
  const qs=query?'?search='+encodeURIComponent(query):'?page=1';
  const r=await heritageGetJSON('https://gutendex.com/books/'+qs,11000);
  return (r.results||[]).map(heritageBook).filter(Boolean);
 }});
 if(source==='history')attempts.push({id:'wikidata',run:async()=>{
  const terms=query?[query]:['三国','唐朝','丝绸之路','宋朝','秦朝'];
  const results=await Promise.allSettled(terms.map(q=>heritageGetJSON(
   'https://www.wikidata.org/w/api.php?action=wbsearchentities&search='+encodeURIComponent(q)+'&language=zh&uselang=zh&limit=12&format=json',9000)));
  const rows=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.search||[]);
  if(!rows.length)throw Error('Wikidata 搜索当前不可用');
  return rows.map(heritageEntity).filter(Boolean);
 }});
 const r=await Promise.allSettled(attempts.map(a=>a.run()));
 const items=[],seen=new Set(),warnings=[],counts=[];
 r.forEach((x,i)=>{
  const id=attempts[i].id;
  if(x.status==='rejected'){warnings.push(id+': '+String(x.reason?.message||x.reason).slice(0,140));counts.push({id,count:0,ok:false});return}
  let count=0;
  for(const entry of x.value){if(seen.has(entry.url))continue;seen.add(entry.url);items.push(entry);count++}
  counts.push({id,count,ok:true});
 });
 if(!items.length)return Response.json({error:'经典与历史素材源暂不可用',warnings,counts},{status:503,headers:RESULT_HEADERS});
 return Response.json({items:items.slice(0,limit),warnings,counts,evergreen:true,
  verified:false,source,source_query:query,rights_policy:'research_before_adaptation',
  collectedAt:new Date().toISOString()},{headers:{'cache-control':'public,max-age=1800','x-content-type-options':'nosniff'}});
}
function heritageArt(x,id){
 if(id==='cma'){
  if(String(x?.share_license_status||'').toUpperCase()!=='CC0'||!x?.images?.web?.url||!x?.url)return null;
  return {id:'cma-'+x.id,title:String(x.title||'无题').slice(0,200),
   artist:String((x.creators||[]).map(c=>c.description||c.name).filter(Boolean).join(' · ')||'未标注').slice(0,120),
   date:String(x.creation_date||'').slice(0,90),
   image:x.images.web.url,source_url:x.url,source:'Cleveland Museum of Art',
   license:'CC0',rights_verified:true,role:'visual_reference_only'};
 }
 if(id==='met'){
  if(x?.isPublicDomain!==true||!x.primaryImageSmall||!x.objectURL)return null;
  return {id:'met-'+x.objectID,title:String(x.title||'无题').slice(0,200),
   artist:String(x.artistDisplayName||'未标注').slice(0,120),date:String(x.objectDate||'').slice(0,90),
   image:x.primaryImageSmall,source_url:x.objectURL,source:'The Met Open Access',
   license:'CC0',rights_verified:true,role:'visual_reference_only'};
 }
 if(x?.is_public_domain!==true||!x.image_id||!Number.isInteger(x.id))return null;
 return {id:'aic-'+x.id,title:String(x.title||'无题').slice(0,200),
  artist:String(x.artist_display||'').slice(0,120),date:String(x.date_display||'').slice(0,90),
  image:'https://www.artic.edu/iiif/2/'+encodeURIComponent(x.image_id)+'/full/400,/0/default.jpg',
  source_url:'https://www.artic.edu/artworks/'+x.id,source:'Art Institute of Chicago',
  license:'CC0',rights_verified:true,role:'visual_reference_only'};
}
async function heritageVisuals(url){
 const query=String(url.searchParams.get('q')||'').trim().slice(0,110);
 if(query.length<2)return failure('请输入至少 2 个字的素材搜索词，建议英文主题',400);
 const results=await Promise.allSettled([
  (async()=>{
   const r=await heritageGetJSON('https://openaccess-api.clevelandart.org/api/artworks/?q='+encodeURIComponent(query)+
     '&cc0&has_image=1&limit=18&fields=id,title,share_license_status,images,creators,creation_date,url',11000);
   return (r.data||[]).map(x=>heritageArt(x,'cma')).filter(Boolean).slice(0,12)
  })(),
  (async()=>{
   const r=await heritageGetJSON('https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&limit=12&q='+encodeURIComponent(query),9000);
   const ids=(r.objectIDs||[]).slice(0,12);
   const objects=await Promise.allSettled(ids.map(id=>heritageGetJSON('https://collectionapi.metmuseum.org/public/collection/v1/objects/'+id,6500)));
   return objects.filter(x=>x.status==='fulfilled').map(x=>heritageArt(x.value,'met')).filter(Boolean).slice(0,8)
  })()
 ]);
 const images=[],warnings=[],counts=[];
 for(let i=0;i<results.length;i++){
  const key=i===0?'cma':'met',r=results[i];
  if(r.status==='fulfilled'){images.push(...r.value);counts.push({id:key,count:r.value.length,ok:true})}
  else{warnings.push(key+': '+String(r.reason?.message||r.reason).slice(0,140));counts.push({id:key,count:0,ok:false})}
 }
 return Response.json({items:images,query,counts,warnings,license:'CC0_only',
  policy:'图片仅供创作参考；不得误认为历史原貌、新闻现场或人物肖像许可。'},
  {headers:{'cache-control':'public,max-age=3600','x-content-type-options':'nosniff'}});
}


// Discovery Cache v2: serve only materialized D1 snapshots; never scrape on a user's click.
const WT_CACHE_SOURCES=['news','hackernews','arxiv','classics','history','literary_series','nobel_literature','academic_events'];
const WT_CACHE_HOURS={news:2,hackernews:3,arxiv:4,classics:48,history:48,literary_series:48,nobel_literature:48,academic_events:8};
function wtCanonicalStory(url){
 try{const o=new URL(url);if(o.protocol!=='https:')return '';
  for(const key of [...o.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(key))o.searchParams.delete(key);
  return o.hostname.toLowerCase()+o.pathname.replace(/\/$/,'')+o.search
 }catch{return ''}
}
async function wtStartColdBootstrap(env,ctx){
 if(!ctx?.waitUntil||!env.DB)return false;
 try{
  const now=Date.now();
  const granted=await env.DB.prepare("INSERT INTO wt_discovery_bootstrap(id,locked_until) VALUES('global',?) ON CONFLICT(id) DO UPDATE SET locked_until=excluded.locked_until WHERE wt_discovery_bootstrap.locked_until<? RETURNING locked_until")
   .bind(now+600000,now).first();
  if(!granted)return false;
  ctx.waitUntil(wtDiscoveryScheduled({scheduledTime:now},env).catch(err=>console.error('WorldToon cold-start collection',String(err))));
  return true;
 }catch(err){console.error('Cold-start lock failed',String(err));return false}
}
async function wtDiscoveryRead(env,url,ctx){
 if(!env.DB)return failure('素材缓存数据库未配置',503);
 const requested=url.searchParams.get('source')||'all';
 if(requested!=='all'&&!WT_CACHE_SOURCES.includes(requested))return failure('未知素材来源',400);
 const limit=Math.max(1,Math.min(500,Number(url.searchParams.get('limit'))||500));
 let rows;
 try{rows=(await env.DB.prepare('SELECT source,payload,item_count,collected_at,last_attempt_at,last_error FROM wt_discovery_snapshots').all()).results||[]}
 catch(err){return Response.json({error:'素材缓存无法读取，请检查数据库迁移',detail:String(err.message||err).slice(0,110)},{status:503,headers:RESULT_HEADERS})}
 if(rows.length<WT_CACHE_SOURCES.length)await wtStartColdBootstrap(env,ctx);
 const at=Date.now(),items=[],seen=new Set(),stats=[],warnings=[],buckets=new Map();
 for(const source of (requested==='all'?['literary_series','nobel_literature','academic_events','classics','history','arxiv','hackernews','news']:WT_CACHE_SOURCES)){
  if(requested!=='all'&&source!==requested)continue;
  const row=rows.find(r=>r.source===source);
  if(!row){stats.push({id:source,count:0,ready:false,stale:true});continue}
  let payload;try{payload=JSON.parse(row.payload)}catch{warnings.push(source+' 缓存损坏，待后台修复');continue}
  const age=Math.max(0,at-Date.parse(row.collected_at||0));
  const stale=!Number.isFinite(age)||age>WT_CACHE_HOURS[source]*3600000;
  stats.push({id:source,count:row.item_count,ready:true,stale,collectedAt:row.collected_at,
   lastAttemptAt:row.last_attempt_at,lastError:row.last_error||'',ageMinutes:Math.round(age/60000)});
  if(row.last_error)warnings.push(source+' 最近一次后台更新失败，继续展示已保存数据');
  for(const raw of payload.items||[]){
   if(!raw||typeof raw!=='object'||typeof raw.url!=='string')continue;
   if(source==='academic_events'&&String(raw.event_end_date||raw.eventDate||'')<new Date(at).toISOString().slice(0,10))continue; // expiring events cannot remain 'upcoming' even if the snapshot is stale
   const key=wtCanonicalStory(raw.url);if(!key||seen.has(key))continue;
   seen.add(key);const item={...raw,source_id:raw.source_id||source,cache_source:source};items.push(item);if(!buckets.has(source))buckets.set(source,[]);buckets.get(source).push(item);
  }
 }
 const fresh=stats.filter(x=>x.ready).sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt));
 const lastUpdated=fresh[0]?.collectedAt||null,ready=stats.some(x=>x.ready);
 // Round-robin across sources BEFORE the overall cap: early news feeds must not crowd out curated series.
 const balanced=[];
 if(requested==='all'){
  const allBuckets=WT_CACHE_SOURCES.map(id=>buckets.get(id)||[]);
  const maxDepth=Math.max(0,...allBuckets.map(a=>a.length));
  for(let depth=0;depth<maxDepth&&balanced.length<limit;depth++)
   for(const group of allBuckets)if(group[depth]&&balanced.length<limit)balanced.push(group[depth]);
 }
 return Response.json({schema:'davylab.worldtoon.catalog.v3',items:(requested==='all'?balanced:items).slice(0,limit),
  stats,warnings,source:requested,ready,initializing:!ready,complete:stats.every(x=>x.ready),
  lastUpdated,method:'d1_snapshot_read',fact_checked:false,rights_cleared:false,
  note:'只读后台缓存，未执行实时集采。数据为未经核验的选题线索，版权和史实需独立复核。'},
  {headers:{'cache-control':'public,max-age=45,stale-while-revalidate=120','x-content-type-options':'nosniff'}});
}
async function wtRefreshOneSource(env,source){
 const attempted=new Date().toISOString();
 try{
  const url=new URL('https://worldtoon.chenzhe223.workers.dev/api/comic/discover?source='+source+'&limit=90');
  const response=await comicDiscover(url);
  if(!response.ok)throw Error('采集 HTTP '+response.status);
  const result=await response.json();const rows=Array.isArray(result.items)?result.items:[];
  if(!rows.length)throw Error('未采集到任何可信来源，不覆盖缓存');
  const clean=rows.slice(0,90).filter(x=>x&&typeof x.title==='string'&&wtCanonicalStory(x.url));
  if(!clean.length)throw Error('所有来源链接无效，不覆盖缓存');
  const data=JSON.stringify({schema:'davylab.worldtoon.snapshot.v2',source,items:clean});
  if(data.length>250000)throw Error('来源数据超出安全大小上限');
  const collected=new Date().toISOString();
  await env.DB.prepare('INSERT INTO wt_discovery_snapshots(source,payload,item_count,collected_at,last_attempt_at,last_error) VALUES(?,?,?,?,?,NULL) ON CONFLICT(source) DO UPDATE SET payload=excluded.payload,item_count=excluded.item_count,collected_at=excluded.collected_at,last_attempt_at=excluded.last_attempt_at,last_error=NULL')
   .bind(source,data,clean.length,collected,attempted).run();
  return {source,ok:true,count:clean.length};
 }catch(err){
  const msg=String(err?.message||err).slice(0,160);
  // Last successful payload remains unchanged. A failed refresh is never an empty snapshot.
  try{await env.DB.prepare('UPDATE wt_discovery_snapshots SET last_attempt_at=?,last_error=? WHERE source=?')
   .bind(attempted,msg,source).run()}catch{}
  return {source,ok:false,error:msg};
 }
}
async function wtDiscoveryScheduled(controller,env){
 if(!env.DB)throw Error('WorldToon D1 binding missing');
 const scheduledTime=Number(controller?.scheduledTime)||Date.now();
 const day=new Date(scheduledTime),hour=day.getUTCHours(),minute=day.getUTCMinutes();
 const current=(await env.DB.prepare('SELECT source FROM wt_discovery_snapshots').all()).results||[];
 const has=new Set(current.map(x=>x.source));
 const due=['news'];
 for(const source of ['hackernews','arxiv'])if(minute===0||!has.has(source))due.push(source);
 for(const source of ['classics','history','literary_series','nobel_literature'])if((hour===2&&minute===0)||!has.has(source))due.push(source);
 if((hour%6===2&&minute===0)||!has.has('academic_events'))due.push('academic_events');
 // First cron run fills every absent snapshot, later updates at the specified cadence.
 const out=await Promise.all(due.map(source=>wtRefreshOneSource(env,source)));
 console.log('WorldToon scheduled discovery refresh',JSON.stringify(out));
 return out;
}

/* WORLD/TOON · Source-grounded drama / novel discovery endpoint.
 * Injected into the existing Cloudflare Worker after source verification.
 * This module searches only public metadata, never copies complete protected story text.
 */
const WT_STORY_SEARCH_ALLOWED=['all','drama','novel'];
const wtStoryClean=v=>String(v??'').replace(/<[^>]{0,500}>/g,' ').replace(/&(?:amp|nbsp);/gi,' ').replace(/\s+/g,' ').trim();
const wtStoryUrl=v=>{try{const u=new URL(String(v||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
const wtStoryKey=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[《》“”"'〈〉\s·・]/g,'').replace(/^(?:红果热剧|红果短剧|网络小说|世界名著|名著)/,'');
const wtStoryTitleMatches=(title,q)=>{const needle=wtStoryKey(q),hay=wtStoryKey(title);return needle.length>=2&&hay.includes(needle)};
async function wtStoryCurated(){
 const r=await fetch(ORIGIN+'story-discovery.json',{signal:AbortSignal.timeout(8500)});
 if(!r.ok)throw Error('剧情资源索引不可用 HTTP '+r.status);
 const s=await r.text();if(s.length>100000)throw Error('剧情索引文件异常');
 const x=JSON.parse(s);
 if(x.schema!=='davylab.worldtoon.story-discovery.v1'||!Array.isArray(x.items))throw Error('剧情索引版本不兼容');
 return {at:x.verified_on,items:x.items.filter(v=>v?.title&&wtStoryUrl(v.source)).slice(0,50)};
}
async function wtStoryBooks(q){
 const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('intitle:'+q)+'&maxResults=8&printType=books';
 const r=await fetch(url,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Google Books HTTP '+r.status);
 const j=await r.json();
 return (j.items||[]).slice(0,8).map(x=>{
  const v=x.volumeInfo||{},title=wtStoryClean(v.title||'').slice(0,150),
    source=wtStoryUrl(v.canonicalVolumeLink||v.infoLink);
  if(!title||!source)return null;
  return {id:'books-'+String(x.id||'').slice(0,70),title,type:'novel',author:wtStoryClean((v.authors||[]).join('、')).slice(0,180),
   source,source_name:'Google Books · 图书元数据',source_kind:'book_metadata',
   summary:wtStoryClean(v.description||'').slice(0,280),
   rights:'unknown',rights_note:'检索到书目不等于获得改编许可，请核对原著版权和发行地区。',
   beats:[],published:v.publishedDate||'',verified_on:new Date().toISOString().slice(0,10),
   identity_status:'book_title_match',verification_status:'metadata_only'};
 }).filter(x=>x&&wtStoryTitleMatches(x.title,q));
}
async function wtStoryPublicBooks(q){
 const u='https://gutendex.com/books/?search='+encodeURIComponent(q);
 const r=await fetch(u,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Gutendex HTTP '+r.status);
 const j=await r.json();
 return (j.results||[]).slice(0,6).map(v=>({
  id:'gutendex-'+v.id,title:wtStoryClean(v.title).slice(0,150),type:'classic',
  author:wtStoryClean((v.authors||[]).map(x=>x.name).join('、')).slice(0,180),
  source:'https://www.gutenberg.org/ebooks/'+v.id,source_name:'Project Gutenberg · 开放图书目录',
  source_kind:'public_domain_catalog',summary:'目录检索到此经典书籍；尚未自动读取原著分章节正文。请查看原文后选择剧情。',
  rights:'public_domain_us',rights_note:'仅为美国公版目录候选，需另行核对实际使用地区及具体版本的权利。',
  beats:[],verified_on:new Date().toISOString().slice(0,10),
  identity_status:'book_title_match',verification_status:'catalog_metadata_only'
 })).filter(x=>wtStoryTitleMatches(x.title,q));
}
async function wtStoryDramaSearch(q){
 // Search live Google News RSS for independently attributable title leads.
 // Search results are not treated as episodes or official Hongguo viewing metrics.
 // Empty-query discovery uses only dated, source-linked editorial snapshots.
 // Live news is queried only for a named work and results must mention that exact title.
 if(!q)return [];
 const qq='"'+q+'" 红果短剧 剧情';
 const endpoint='https://news.google.com/rss/search?q='+encodeURIComponent(qq)+'&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
 const r=await fetch(endpoint,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Google News RSS HTTP '+r.status);
 const rss=await r.text();
 if(rss.length>1700000||!rss.includes('<rss'))throw Error('新闻检索格式异常');
 return parseRSS(rss,'娱乐').slice(0,30).filter(x=>wtStoryTitleMatches(x.title,q)).slice(0,12).map((x,i)=>({
   id:'news-'+i+'-'+(x.published||'').slice(0,20),title:wtStoryClean(x.title).slice(0,165),
   type:'drama',source:wtStoryUrl(x.url),source_name:wtStoryClean(x.source||'Google News 来源').slice(0,100),
   source_kind:'web_search_lead',rights:'unknown',rights_note:'网络检索线索不是剧集本身，未验证其红果上架身份、完整剧情或改编权。',
   summary:'搜索引擎发现的公开报道线索；请点开原文核对。此卡不提供未核实的分集情节。',
   beats:[],published:x.published||'',verified_on:new Date().toISOString().slice(0,10),
   identity_status:'title_mentioned_in_source',verification_status:'source_lead_unverified'
 })).filter(x=>x.source&&x.title);
}
async function wtStorySearch(request,env,url){
 const type=url.searchParams.get('type')||'all',q=String(url.searchParams.get('q')||'').trim().slice(0,90);
 if(!WT_STORY_SEARCH_ALLOWED.includes(type))return failure('未知剧情搜索类型',400);
 if(q&&q.length<2)return failure('至少输入两个字符才能搜索',400);
 const notes=[],merged=[];let curated;
 try{curated=await wtStoryCurated();const key=wtStoryKey(q);
  for(const v of curated.items){
   if(type==='drama'&&v.type!=='drama')continue;
   if(type==='novel'&&v.type==='drama')continue;
   if(q&&!([v.title,...(v.aliases||[])].some(s=>wtStoryKey(s).includes(key))))continue;
   merged.push({...v,source_status:'editorial_reviewed',snapshot_date:curated.at,
    identity_status:'curated_title_match',verification_status:'source_metadata_reviewed'});
  }
 }catch(e){notes.push('精选索引不可用：'+String(e.message||e).slice(0,85))}
 const jobs=[];
 if(q&&type!=='drama'){
  jobs.push({name:'Google Books',fn:()=>wtStoryBooks(q)});
  jobs.push({name:'Gutendex',fn:()=>wtStoryPublicBooks(q)});
 }
 if(type!=='novel'&&q)jobs.push({name:'Google News RSS',fn:()=>wtStoryDramaSearch(q)});
 const results=await Promise.allSettled(jobs.map(x=>x.fn()));
 for(let i=0;i<results.length;i++){
  const res=results[i];if(res.status==='fulfilled')merged.push(...res.value);
  else notes.push(jobs[i].name+' 暂不可用：'+String(res.reason?.message||res.reason).slice(0,90));
 }
 const clean=[],seen=new Set();
 for(const item of merged){
  const title=wtStoryClean(item.title).slice(0,160),source=wtStoryUrl(item.source);
  if(!title||!source)continue;
  const key=title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').slice(0,120);
  if(seen.has(key))continue;
  seen.add(key);clean.push({...item,title,source});
 }
 // Curated snapshot ranking is dated and source-backed; do not treat it as today's realtime platform metrics.
 if(!q)clean.sort((a,b)=>Number(a.rank_snapshot||999)-Number(b.rank_snapshot||999));
 // No fake fallback plot or rankings. Fail honestly on total outages, but keep curated matches.
 if(!clean.length&&notes.length)return Response.json({items:[],warnings:notes,error:'暂未找到匹配来源；可更换关键词或稍后重试',searched_at:new Date().toISOString()},{headers:{...RESULT_HEADERS,'cache-control':'public,max-age=120'}});
 return Response.json({schema:'davylab.worldtoon.story-search.v1',items:clean.slice(0,35),query:q,type,warnings:notes,
  searched_at:new Date().toISOString(),source_policy:'题名与来源链接逐项展示；新闻命中只证明来源提及该名称，不证明作品上架身份；非原著全文、非红果官方榜单、不代表改编授权',
  model_generated:false},{headers:{...RESULT_HEADERS,'cache-control':'public,max-age=180,stale-while-revalidate=300'}});
}
export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/health')return Response.json({ok:true,app:'WORLD/TOON',version:'4.4.0',features:{news:true,auth:true,sync:true,characterReferences:true,script:env.AI_ENABLED==='true',characters:!!env.AI,image:env.AI_ENABLED==='true',appearance:true,eventDate:true,storySearch:true,titleIdentityChecks:true,storyboardProviders:['native','deepseek','openai','claude','gemini','kimi','qwen']},at:new Date().toISOString()},{headers:RESULT_HEADERS});
 if(url.pathname.startsWith('/api/archive/'))return wtArchiveApi(request,env,url);
 if(url.pathname==='/api/config')return Response.json({supabaseUrl:SUPABASE_URL,supabaseKey:SUPABASE_PUBLISHABLE_KEY,aiEnabled:env.AI_ENABLED==='true',characterAiEnabled:!!env.AI,storyboardAiEnabled:!!env.AI,storyboardAiRequiresLogin:true,characterAiFree:true,characterModel:Date.now()<Date.parse('2026-11-20T00:00:00Z')?'DeepSeek R1 Distill':'Gemma 4 (DeepSeek 免费模型已下线)'},{headers:RESULT_HEADERS});
 if((url.pathname==='/api/ai-briefing'||url.pathname==='/api/ai-briefing/history')&&request.method==='GET')return aiBriefing(url);
 if(url.pathname==='/api/comic/catalog'&&request.method==='GET')return wtDiscoveryRead(env,url,ctx);
 if(url.pathname==='/api/comic/discover'&&request.method==='GET')return comicDiscover(url);
 if(url.pathname==='/api/comic/visuals'&&request.method==='GET')return heritageVisuals(url);
 if(url.pathname==='/api/comic/story-search'&&request.method==='GET')return wtStorySearch(request,env,url);
 if(url.pathname==='/api/news'&&request.method==='GET')return news(url);
 if(url.pathname==='/api/ai/storyboard'){if(request.method!=='POST')return failure('Method not allowed',405);return wtStoryboardAI(request,env)}
 if(url.pathname.startsWith('/api/ai/')){if(request.method!=='POST')return failure('Method not allowed',405);if(!['/api/ai/script','/api/ai/image','/api/ai/characters'].includes(url.pathname))return failure('Not found',404);return ai(request,env,url)}
 const path=url.pathname==='/'?'index.html':url.pathname.slice(1);if(path.includes('..')||!(/^(index\.html|app\.js|creative-director\.js|creative-pilot\.js|style-v3\.js|style-v3\.css|worldtoon-v3\.js|worldtoon-v3-import\.js|worldtoon-v3-review\.js|worldtoon-v3\.css|comic-engine\.js|comic-visuals\.js|ranking\.js|extension\.js|briefing\.js|archive\.js|personalize\.js|styles\.css|personalize\.css|creative-director\.css|sw\.js|manifest\.webmanifest|favicon\.svg|assets\/[A-Za-z0-9_.%\-]+\.(?:png|webp))$/.test(path)))return new Response('Not found',{status:404});
 try{const isAsset=path.startsWith('assets/'),ttl=isAsset?3600:30;let up=await fetch(ORIGIN+path,{cf:{cacheTtl:ttl,cacheEverything:true}});if(!up.ok)return new Response('Asset unavailable',{status:up.status===404?404:503});const ext=path.split('.').pop();let h=new Headers({'content-type':CONTENT[ext]||'application/octet-stream','cache-control':isAsset?'public,max-age=3600':'public,max-age=30','x-worldtoon-version':'4.3.0','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(),microphone=(),geolocation=()'});if(!isAsset)h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://qjyqaydfezbpeimpvlcb.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");return new Response(up.body,{status:200,headers:h})}catch{return new Response('Temporary origin error',{status:503})}},async scheduled(controller,env,ctx){await wtDiscoveryScheduled(controller,env)}
};

