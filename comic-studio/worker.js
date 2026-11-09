// WORLD/TOON 2.0 / By DAVYLAB — editorial news wire + restricted AI + GitHub static assets
const ORIGIN='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/1488fc19df97c2d61518dea181badce5f863dbb8/comic-studio/';
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
  const story=(o)=>({title:str(o.title_zh||o.title,260),summary:str(o.summary_zh||o.summary,600),why:str(o.why_it_matters_zh||'',430),url:https(o.url),source:str(o.source,130),published:str(o.published,60),image:https(o.image_url),imageAlt:str(o.image_alt||o.title_zh||o.title,260),imageStatus:str(o.image_match_status||'',55),imageCredit:str(o.image_credit||'',120)});
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
async function ai(request,env,url){let user=await authenticate(request,env);if(!user)return failure('请先登录账户以使用 AI 功能',401);if(env.AI_ENABLED!=='true')return failure('AI 生成已集成，但当前未启用计费模型；待确认模型费用与预算后开放。',503);if(!env.AI)return failure('AI 模型绑定未配置',503);let type=url.pathname.endsWith('/script')?'script':'image';const limit=type==='script'?3:2;let body=await request.json().catch(()=>null);if(!body||JSON.stringify(body).length>1250000)return failure('参数格式无效或参考图过大',413);if(type==='script'&&(!body.title||!body.sourceURLs||!body.factNotes))return failure('请提供有效来源与事实笔记');if(type==='image'&&!body.scene)return failure('请先填写画面描述');try{await quota(env,'__worldtoon_global__',type,type==='script'?12:24);await quota(env,user.id,type,limit)}catch(err){return failure(aiError(err),429)}
try{
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
export default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname==='/health')return Response.json({ok:true,app:'WORLD/TOON',version:'2.2.1',features:{news:true,auth:true,sync:true,characterReferences:true,script:env.AI_ENABLED==='true',image:env.AI_ENABLED==='true'},at:new Date().toISOString()},{headers:RESULT_HEADERS});
 if(url.pathname==='/api/config')return Response.json({supabaseUrl:SUPABASE_URL,supabaseKey:SUPABASE_PUBLISHABLE_KEY,aiEnabled:env.AI_ENABLED==='true'},{headers:RESULT_HEADERS});
 if((url.pathname==='/api/ai-briefing'||url.pathname==='/api/ai-briefing/history')&&request.method==='GET')return aiBriefing(url);
 if(url.pathname==='/api/news'&&request.method==='GET')return news(url);
 if(url.pathname.startsWith('/api/ai/')){if(request.method!=='POST')return failure('Method not allowed',405);if(!['/api/ai/script','/api/ai/image'].includes(url.pathname))return failure('Not found',404);return ai(request,env,url)}
 const path=url.pathname==='/'?'index.html':url.pathname.slice(1);if(path.includes('..')||!(/^(index\.html|app\.js|extension\.js|briefing\.js|styles\.css|sw\.js|manifest\.webmanifest|favicon\.svg|assets\/[A-Za-z0-9_.%\-]+\.png)$/.test(path)))return new Response('Not found',{status:404});
 try{const isAsset=path.startsWith('assets/'),ttl=isAsset?3600:30;let up=await fetch(ORIGIN+path,{cf:{cacheTtl:ttl,cacheEverything:true}});if(!up.ok)return new Response('Asset unavailable',{status:up.status===404?404:503});const ext=path.split('.').pop();let h=new Headers({'content-type':CONTENT[ext]||'application/octet-stream','cache-control':isAsset?'public,max-age=3600':'public,max-age=30','x-worldtoon-version':'2.1','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(),microphone=(),geolocation=()'});if(!isAsset)h.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://qjyqaydfezbpeimpvlcb.supabase.co; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");return new Response(up.body,{status:200,headers:h})}catch{return new Response('Temporary origin error',{status:503})}}
};