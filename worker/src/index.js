/**
 * DAVYLAB AI Radar Subscription API
 * Required bindings: DB (D1), BREVO_API_KEY secret.
 * Vars: PUBLIC_BASE_URL, SENDER_EMAIL, SENDER_NAME.
 * Cron: 30 23 * * * UTC = 07:30 Asia/Shanghai.
 */
const TOPICS = new Set(["models","products","industry","business","creator","life"]);
const JSON_HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const html = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const token = () => crypto.randomUUID().replaceAll("-","") + crypto.randomUUID().replaceAll("-","");
async function digest(value){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function corsHeaders(request){const origin=request.headers.get("Origin")||"";const allowed=["https://chenzhe223-tech.github.io"];return {"access-control-allow-origin":allowed.includes(origin)?origin:allowed[0],"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type","vary":"Origin"};}
async function mail(env,to,subject,htmlContent,textContent){if(!env.BREVO_API_KEY||!env.SENDER_EMAIL)throw new Error("Email provider is not configured");const res=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{name:env.SENDER_NAME||"DAVYLAB · AI 前沿简报",email:env.SENDER_EMAIL},to:[{email:to}],subject,htmlContent,textContent})});if(!res.ok)throw new Error("Email provider returned "+res.status);return res.json();}
async function requestHandler(request,env){
 const url=new URL(request.url);const cors=corsHeaders(request);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(url.pathname==="/health")return json({ok:true,service:"davylab-radar-subscriptions",time:new Date().toISOString()});
 if(request.method==="POST"&&url.pathname==="/api/subscribe"){
  let body;try{body=await request.json()}catch{return json({error:"请填写有效的订阅信息。"},400)}
  const email=String(body.email||"").trim().toLowerCase();const topics=Array.isArray(body.topics)?[...new Set(body.topics.map(String).filter(t=>TOPICS.has(t)))]:[];
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"请输入有效邮箱。"},400,{headers:cors});
  if(!topics.length)return json({error:"至少选择一个感兴趣的主题。"},400,{headers:cors});
  if(body.consent!==true)return json({error:"请确认同意接收订阅邮件。"},400);
  const raw=token(),hash=await digest(raw),now=new Date().toISOString();
  const existing=await env.DB.prepare("SELECT id,status FROM subscribers WHERE email=?").bind(email).first();
  if(existing?.status==="active")return new Response(JSON.stringify({ok:true,message:"这个邮箱已经订阅。"}),{headers:{...JSON_HEADERS,...cors}});
  if(existing){await env.DB.prepare("UPDATE subscribers SET topics_json=?,status='pending',confirm_hash=?,updated_at=?,consent_at=? WHERE id=?").bind(JSON.stringify(topics),hash,now,now,existing.id).run();}
  else{await env.DB.prepare("INSERT INTO subscribers(email,topics_json,status,confirm_hash,created_at,updated_at,consent_at) VALUES(?,?,'pending',?,?,?,?)").bind(email,JSON.stringify(topics),hash,now,now,now).run();}
  const confirmUrl=(env.PUBLIC_BASE_URL||"https://chenzhe223-tech.github.io/radar/subscribe/") + "?confirm="+encodeURIComponent(raw);
  try{await mail(env,email,"请确认你的 DAVYLAB AI 前沿简报订阅",'<div style="font-family:Arial,sans-serif;line-height:1.8;color:#17243a;max-width:600px;margin:auto"><p style="letter-spacing:2px;color:#315f91">DAVYLAB · SPARK & PULSE</p><h1>确认你的 AI 简报订阅</h1><p>点击下方按钮，确认接收你选择的个性化 AI 新闻。确认前不会发送每日简报。</p><p><a style="display:inline-block;background:#18304d;color:#fff;padding:13px 22px;border-radius:5px;text-decoration:none" href="'+html(confirmUrl)+'">确认订阅</a></p><p>如果不是你本人操作，请忽略此邮件。</p></div>',"请确认订阅："+confirmUrl);}
  catch(e){await env.DB.prepare("UPDATE subscribers SET last_error=?,updated_at=? WHERE email=?").bind(String(e.message).slice(0,300),new Date().toISOString(),email).run();return json({error:"订阅信息已暂存，但确认邮件暂时发送失败。请稍后重试。"},503);}
  return new Response(JSON.stringify({ok:true,message:"请查收确认邮件，点击确认后才会开始订阅。"}),{headers:{...JSON_HEADERS,...cors}});
 }
 if(request.method==="GET"&&url.pathname==="/api/confirm"){
  const raw=url.searchParams.get("token")||"";if(raw.length<32)return json({error:"确认链接无效或已过期。"},400);
  const hash=await digest(raw),sub=await env.DB.prepare("SELECT id,email,status FROM subscribers WHERE confirm_hash=?").bind(hash).first();
  if(!sub)return json({error:"确认链接无效或已使用。"},404);
  await env.DB.prepare("UPDATE subscribers SET status='active',confirm_hash=NULL,confirmed_at=?,updated_at=?,last_error=NULL WHERE id=?").bind(new Date().toISOString(),new Date().toISOString(),sub.id).run();
  return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>订阅已确认</title><main style='font:16px/1.8 system-ui;max-width:620px;margin:12vh auto;padding:24px;color:#17243a'><p style='color:#315f91;letter-spacing:2px'>DAVYLAB</p><h1>订阅确认成功</h1><p>从下一次成功通过自检的日报开始，你将收到个性化 AI 前沿简报。</p><p><a href='https://chenzhe223-tech.github.io/radar/daily/'>查看今日简报 →</a></p></main>",{headers:{"content-type":"text/html; charset=utf-8"}});
 }
 if(request.method==="GET"&&url.pathname==="/api/unsubscribe"){
  const raw=url.searchParams.get("token")||"";if(raw.length<32)return new Response("退订链接无效。",{status:400});
  const hash=await digest(raw),sub=await env.DB.prepare("SELECT id FROM subscribers WHERE unsubscribe_hash=?").bind(hash).first();if(!sub)return new Response("退订链接无效或已使用。",{status:404});
  await env.DB.prepare("UPDATE subscribers SET status='unsubscribed',updated_at=? WHERE id=?").bind(new Date().toISOString(),sub.id).run();
  return new Response("<meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><main style='font:16px system-ui;max-width:600px;margin:15vh auto;padding:24px'><h1>已取消订阅</h1><p>此邮箱不会再收到每日 AI 前沿简报。</p></main>",{headers:{"content-type":"text/html; charset=utf-8"}});
 }
 return json({error:"Not found"},404);
}
function storyText(x){return [x.title_zh||x.title_en||x.title,x.what_zh||x.what_en||x.summary_zh||x.summary,x.why_zh||x.why_en||x.why_it_matters_zh||x.why_it_matters_en].filter(Boolean).join(" ");}
async function sendDaily(env){
 const db=env.DB;const now=new Date().toISOString();let report;
 try{const res=await fetch("https://chenzhe223-tech.github.io/radar/data/latest.json",{headers:{"cache-control":"no-cache"}});if(!res.ok)throw new Error("日报数据 HTTP "+res.status);report=await res.json();}
 catch(e){await db.prepare("INSERT INTO delivery_runs(run_date,status,details,created_at) VALUES(?, 'blocked', ?, ?)").bind(now.slice(0,10),JSON.stringify({reason:"source_fetch_failed",message:String(e.message)}),now).run();return;}
 const stories=Array.isArray(report.top5)?report.top5:[];const urls=stories.map(s=>s.source_url||s.url).filter(Boolean);
 const storyComplete=stories.length===5&&stories.every(s=>(s.title_zh||s.title_en||s.title)&&storyText(s).length>40&&(s.source_url||s.url));
 const uniqueUrls=new Set(urls);
 const reportDate=String(report.report_date||"");
 const dateOkay=/^\d{4}-\d{2}-\d{2}$/.test(reportDate)&&Math.abs(Date.parse(reportDate+"T12:00:00Z")-Date.now())<48*60*60*1000;
 const quality={storyCount:stories.length,allHaveSource:urls.length===5,uniqueSources:uniqueUrls.size,reportDate,dateOkay,editorialReady:!!report.editorial,sourceCoverage:[report.sources_ok,report.sources_total]};
 if(!storyComplete||uniqueUrls.size<4||!dateOkay||report.top5_status==="fallback"||report.top5_status==="error"){
  await db.prepare("INSERT INTO delivery_runs(run_date,status,details,created_at) VALUES(?, 'blocked', ?, ?)").bind(reportDate||now.slice(0,10),JSON.stringify({reason:"quality_gate_failed",quality}),now).run();return;
 }
 const subs=await db.prepare("SELECT id,email,topics_json,unsubscribe_hash FROM subscribers WHERE status='active'").all();let sent=0,failed=0;
 for(const sub of subs.results||[]){
  const topics=JSON.parse(sub.topics_json||"[]");const chosen=stories.filter(s=>{const c=String(s.category||s.category_en||s.category_zh||"").toLowerCase();return topics.some(t=>t==="models"&&/model|technical|技术|大模型/i.test(c)||t==="products"&&/product|应用|产品/i.test(c)||t==="industry"&&/industry|行业/i.test(c)||t==="business"&&/business|market|商业|市场/i.test(c)||t==="creator"&&/creator|创作|内容/i.test(c)||t==="life"&&/life|生活|趋势/i.test(c));});
  const selected=chosen.length?chosen:stories.slice(0,3);
  const items=selected.map((s,i)=>'<article style="padding:18px 0;border-bottom:1px solid #e4e8ed"><div style="font-size:12px;color:#52749b">0'+(i+1)+' · '+html(s.category_zh||s.category_en||"AI 情报")+'</div><h2 style="font-size:20px;line-height:1.45;color:#17243a">'+html(s.title_zh||s.title_en||s.title)+'</h2><p style="line-height:1.8;color:#42536a">'+html(s.why_zh||s.what_zh||s.summary_zh||s.why_en||s.what_en||s.summary_en||"")+'</p><a href="'+html(s.source_url||s.url)+'" style="color:#2b659b">阅读原文 →</a></article>').join("");
  const unUrl=(env.PUBLIC_BASE_URL||"https://chenzhe223-tech.github.io/radar/subscribe/")+"?unsubscribe="+encodeURIComponent(sub.unsubscribe_hash||"");
  const content='<div style="max-width:680px;margin:auto;font-family:Arial,sans-serif;color:#17243a"><div style="padding:24px 0;border-bottom:3px solid #17243a"><div style="font-size:12px;letter-spacing:2px;color:#52749b">DAVYLAB · SPARK & PULSE</div><h1 style="font-family:Georgia,serif;font-size:32px">AI 前沿简报</h1><p>看见趋势 · 发现机会 · 打开新可能</p><small>'+html(reportDate)+' · 每日精选</small></div>'+items+'<p style="margin-top:26px;color:#68778a;font-size:12px">本简报按你的兴趣偏好整理。每条新闻均提供原始来源，请以原文为准。</p><p style="font-size:12px"><a href="'+html("https://chenzhe223-tech.github.io/radar/daily/")+'">在线阅读</a> · <a href="'+html(unUrl)+'">取消订阅</a></p></div>';
  try{await mail(env,sub.email,"AI 前沿简报｜"+reportDate+"｜你的个性化 AI 情报",content,"AI 前沿简报 "+reportDate+"\n"+selected.map(s=>(s.title_zh||s.title_en||s.title)+"\n"+storyText(s)+"\n"+(s.source_url||s.url)).join("\n\n")+"\n退订："+unUrl);await db.prepare("INSERT INTO deliveries(subscriber_id,report_date,status,created_at) VALUES(?,?,'sent',?)").bind(sub.id,reportDate,now).run();sent++;}
  catch(e){await db.prepare("INSERT INTO deliveries(subscriber_id,report_date,status,error,created_at) VALUES(?,?,'failed',?,?)").bind(sub.id,reportDate,String(e.message).slice(0,300),now).run();failed++;}
 }
 await db.prepare("INSERT INTO delivery_runs(run_date,status,details,created_at) VALUES(?, ?, ?, ?)").bind(reportDate,sent?"sent":"no_subscribers",JSON.stringify({sent,failed,quality}),now).run();
}
export default {
 async fetch(request,env){try{const response=await requestHandler(request,env);const headers=new Headers(response.headers);for(const [k,v] of Object.entries(corsHeaders(request)))headers.set(k,v);return new Response(response.body,{status:response.status,headers});}catch(e){return json({error:"服务暂时不可用，请稍后重试。",requestId:crypto.randomUUID()},500);}},
 async scheduled(controller,env,ctx){ctx.waitUntil(sendDaily(env));}
};