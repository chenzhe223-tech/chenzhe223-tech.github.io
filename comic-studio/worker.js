// WORLD/TOON 2.0 / By DAVYLAB — editorial news wire + restricted AI + GitHub static assets
const ORIGIN='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/08a80b99aebda63ecf23ce2ead1e836c66992654/comic-studio/';
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
function parseJSON(text){let s=String(text||'').trim().replace(/^```(?:json)?\s*/,'').replace(/```$/,'');try{return JSON.parse(s)}catch{let a=s.indexOf('{'),b=s.lastIndexOf('}');if(a>=0&&b>a)return JSON.parse(s.slice(a,b+1));throw Error('AI 回复不是有效 JSON')}}
function aiError(err){let msg=String(err?.message||err);return msg.slice(0,250)}
async function ai(request,env,url){let user=await authenticate(request,env);if(!user)return failure('请先登录账户以使用 AI 功能',401);if(env.AI_ENABLED!=='true')return failure('AI 生成已集成，但当前未启用计费模型；待确认模型费用与预算后开放。',503);if(!env.AI)return failure('AI 模型绑定未配置',503);let type=url.pathname.endsWith('/script')?'script':url.pathname.endsWith('/characters')?'characters':'image';const limit=type==='script'?3:type==='characters'?3:2;let body=await request.json().catch(()=>null);if(!body||JSON.stringify(body).length>1250000)return failure('参数格式无效或参考图过大',413);if(type==='script'&&(!body.title||!body.sourceURLs||!body.factNotes))return failure('请提供有效来源与事实笔记');if(type==='image'&&!body.scene)return failure('请先填写画面描述');try{await quota(env,'__worldtoon_global__',type,type==='image'?24:12);await quota(env,user.id,type,limit)}catch(err){return failure(aiError(err),429)}
try{
 if(type==='characters'){
  const count=Math.max(1,Math.min(4,Number(body.count)||2));
  const concept=String(body.concept||'').slice(0,2000),title=String(body.title||'原创漫画').slice(0,180);
  if(!concept.trim())return failure('请提供漫画故事概念或世界观',400);
  const sys='你是优秀的原创漫画角色设计师。依据公共新闻主题设计完全虚构的漫画人物：不同姓名、面容、外形、衣着、世界观与可识别特征。不得假冒或复制真实公众人物面容与身份，不得编造现实人物的违法、私生活、政治交易指控。设计应当适合跨多格保持视觉一致。只输出 JSON 对象，结构为 {"characters":[{"name":"角色名称","type":"虚构角色","description":"年龄段外形发型与面部视觉","costume":"固定服装与材质","colors":"主副配色","traits":"明确不变的视觉识别特征","personality":"背景动机性格"}]}。不得输出 Markdown 或前言。';
  const msg=JSON.stringify({title,concept,style:String(body.style||'杂志式原创漫画').slice(0,100),count,fictional:true});
  const response=await env.AI.run('@cf/google/gemma-4-26b-a4b-it',{messages:[{role:'system',content:sys},{role:'user',content:msg}],max_tokens:2100,temperature:0.7});
  const parsed=parseJSON(response.response||response.choices?.[0]?.message?.content||'');
  if(!Array.isArray(parsed.characters)||parsed.characters.length<1)return failure('模型没有返回有效角色档案',502);
  const chars=parsed.characters.slice(0,count).map(c=>({name:String(c?.name||'').slice(0,80),type:['虚构角色','拟人化角色','抽象象征'].includes(c?.type)?c.type:'虚构角色',description:String(c?.description||'').slice(0,1700),costume:String(c?.costume||'').slice(0,400),colors:String(c?.colors||'').slice(0,220),traits:String(c?.traits||'').slice(0,950),personality:String(c?.personality||'').slice(0,1100)})).filter(c=>c.name.trim());
  if(!chars.length)return failure('角色内容为空，请修改设定重试',502);
  return Response.json({characters:chars,model:'gemma-4-26b-a4b-it',draft:true,requiresHumanReview:true},{headers:RESULT_HEADERS});
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
 // Anonymous reads never query rate-limited GitHub REST metadata. The public
 // catalog itself proves public accessibility; no privileged operation uses it.
 if(!env.WORLDTOON_GITHUB_TOKEN) {
  const catalogue=await wtArchivePublicIndex('library/index.json');
  if(catalogue?.schema!=='davylab.worldtoon.library.v1')throw Error('公开漫画仓库索引不存在或格式错误');
  return {exists:true,private:false,visibility:'public',default_branch:'main',readOnly:true};
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
 if(p==='/api/archive/status'&&method==='GET'){
  try {
   const meta=await wtArchiveMeta(env),writeReady=meta.private===true&&!!(env.WORLDTOON_ARCHIVE_OWNER_UID&&env.WORLDTOON_GITHUB_TOKEN);
   return wtJson({repo:WT_REPO,exists:meta.exists,visibility:meta.visibility,readable:meta.exists&&(!meta.private||writeReady),configured:writeReady,mode:writeReady?'private_authenticated':meta.private?'private_unconfigured':'public_readonly',producer:'ChatGPT',publisher:'WorkBuddy',ai_direct_generation:false});
  }catch(err){return wtJson({repo:WT_REPO,error:'GitHub 仓库状态暂不可用：'+String(err.message||err).slice(0,140)},503)}
 }
 if(p==='/api/archive/sync'&&method==='GET'){
  try {
   const meta=await wtArchiveMeta(env);
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
   return wtJson({repo:WT_REPO,visibility:meta.visibility,mode,configured:mode==='private_authenticated',library,queue,synced_at:new Date().toISOString()});
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
  if(t.editorial.sources.length===0&&t.mode!=='original')return wtJson({error:'真实热点必须提供原始来源'},400);
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
export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/health')return Response.json({ok:true,app:'WORLD/TOON',version:'2.6.0',features:{news:true,auth:true,sync:true,characterReferences:true,script:env.AI_ENABLED==='true',characters:env.AI_ENABLED==='true',image:env.AI_ENABLED==='true',appearance:true,eventDate:true},at:new Date().toISOString()},{headers:RESULT_HEADERS});
 if(url.pathname.startsWith('/api/archive/'))return wtArchiveApi(request,env,url);
 if(url.pathname==='/api/config')return Response.json({supabaseUrl:SUPABASE_URL,supabaseKey:SUPABASE_PUBLISHABLE_KEY,aiEnabled:env.AI_ENABLED==='true'},{headers:RESULT_HEADERS});
 if((url.pathname==='/api/ai-briefing'||url.pathname==='/api/ai-briefing/history')&&request.method==='GET')return aiBriefing(url);
 if(url.pathname==='/api/news'&&request.method==='GET')return news(url);
 if(url.pathname.startsWith('/api/ai/')){if(request.method!=='POST')return failure('Method not allowed',405);if(!['/api/ai/script','/api/ai/image','/api/ai/characters'].includes(url.pathname))return failure('Not found',404);return ai(request,env,url)}
 const path=url.pathname==='/'?'index.html':url.pathname.slice(1);if(path.includes('..')||!(/^(index\.html|app\.js|extension\.js|briefing\.js|archive\.js|personalize\.js|styles\.css|personalize\.css|sw\.js|manifest\.webmanifest|favicon\.svg|assets\/[A-Za-z0-9_.%\-]+\.png)$/.test(path)))return new Response('Not found',{status:404});
 try{const isAsset=path.startsWith('assets/'),ttl=isAsset?3600:30;let up=await fetch(ORIGIN+path,{cf:{cacheTtl:ttl,cacheEverything:true}});if(!up.ok)return new Response('Asset unavailable',{status:up.status===404?404:503});const ext=path.split('.').pop();let h=new Headers({'content-type':CONTENT[ext]||'application/octet-stream','cache-control':isAsset?'public,max-age=3600':'public,max-age=30','x-worldtoon-version':'2.6','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(),microphone=(),geolocation=()'});if(!isAsset)h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://qjyqaydfezbpeimpvlcb.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");return new Response(up.body,{status:200,headers:h})}catch{return new Response('Temporary origin error',{status:503})}}
};