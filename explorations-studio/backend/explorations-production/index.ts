import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const DOMAIN="https://chenzhe223-tech.github.io";
const H={"Content-Type":"application/json","Access-Control-Allow-Origin":DOMAIN,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type,authorization,apikey","Cache-Control":"no-store"};
const res=(body,code=200)=>new Response(JSON.stringify(body),{status:code,headers:H});
const shift=(s,n)=>{const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
function pastWeek(){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()),v={};parts.forEach(p=>v[p.type]=p.value);
const d=v.year+"-"+v.month+"-"+v.day,wd=new Date(d+"T12:00:00Z").getUTCDay()||7,start=shift(d,1-wd-7),end=shift(start,6);
const th=new Date(shift(start,3)+"T12:00:00Z"),yr=th.getUTCFullYear(),jan4=new Date(Date.UTC(yr,0,4,12)),weekStart=shift(jan4.toISOString().slice(0,10),1-(jan4.getUTCDay()||7)),no=1+Math.round((new Date(start+"T12:00:00Z")-new Date(weekStart+"T12:00:00Z"))/604800000);
return {start,end,issue:yr+"-W"+String(no).padStart(2,"0"),days:Array.from({length:7},(_,i)=>shift(start,i))};}
function order(run,source){return {
id:run.id,issue:run.issue,week:{start:run.week_start,end:run.week_end,timezone:"Asia/Shanghai"},
sender:"Explorations Studio",assignee:"ChatGPT",downstream:"WorkBuddy",mode:"creative-production",
sources:{daily_home:"https://chenzhe223-tech.github.io/radar/daily/",history:"https://chenzhe223-tech.github.io/radar/data/history.json",archive_pattern:"https://chenzhe223-tech.github.io/radar/data/archive/YYYY-MM-DD.json",days:source.days},
requirements:{news:7,skills:5,posters_news:7,posters_skills:2,png_total:9,resolution:"1080x1440 minimum",historical_dedupe_days:90,art_direction:"AI Explorations · By DAVYLAB | refined international editorial magazine; natural photography, still life, warm paper, sophisticated typography, unique editorial metaphor, DAVY'S NOTE; never neon robots, glassmorphism, generic AI images"},
deliverables:["nine original PNG posters","copy-ready WeChat editorial caption","verified source URLs and dedupe log","QC checklist and source design","ZIP package and accessible asset locations","WorkBuddy publication handoff manifest"],
handoff_rule:"ONLY after all 9 real PNG files and quality checks have been verified, hand completed material to WorkBuddy for WeChat Official Account 贴图 module publishing. Record draft and public publication acknowledgements separately.",
policy:"Never fabricate editorial completion, images, ChatGPT reception, WorkBuddy handoff, or WeChat publication. Never execute public WeChat publication without appropriate publishing permission."};}
Deno.serve(async req=>{
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
if(req.method!=="POST")return res({error:"Method not allowed"},405);
const origin=req.headers.get("origin");if(origin&&origin!==DOMAIN)return res({error:"Origin denied"},403);
const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
if(!jwt)return res({error:"Login required"},401);
const supa=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!supa||!anon||!secret)return res({error:"Supabase configuration missing"},503);
const auth=createClient(supa,anon,{auth:{persistSession:false}}),verified=await auth.auth.getUser(jwt);
const user=verified.data?.user;if(verified.error||!user)return res({error:"Invalid session"},401);
const db=createClient(supa,secret,{auth:{persistSession:false}});
let input={};try{input=await req.json()}catch{return res({error:"Invalid payload"},400)}
if(input.action==="list"){const r=await db.from("explorations_runs").select("id,issue,week_start,week_end,state,stage,progress,created_at,error_message,manifest,source_report").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);return r.error?res({error:r.error.message},500):res({runs:r.data||[]})}
if(input.action==="detail"||input.action==="work_order"){const id=input.run_id;if(!/^[0-9a-f-]{36}$/i.test(id||""))return res({error:"Invalid run ID"},400);
const r=await db.from("explorations_runs").select("*").eq("user_id",user.id).eq("id",id).maybeSingle();if(r.error)return res({error:r.error.message},500);if(!r.data)return res({error:"Run not found"},404);
if(input.action==="work_order")return res({run:r.data,work_order:order(r.data,r.data.source_report||{})});
const assets=await db.from("explorations_assets").select("*").eq("user_id",user.id).eq("run_id",id).order("slot");return assets.error?res({error:assets.error.message},500):res({run:r.data,assets:assets.data||[]})}
if(input.action!=="start")return res({error:"Unknown action"},400);
const w=pastWeek();const existing=await db.from("explorations_runs").select("id,issue,week_start,week_end,state,stage,progress,source_report").eq("user_id",user.id).eq("issue",w.issue).maybeSingle();
if(existing.error)return res({error:existing.error.message},500);
if(existing.data)return res({already_exists:true,run:existing.data,work_order:order(existing.data,existing.data.source_report||{})});
const source_report={days:w.days,history_url:"https://chenzhe223-tech.github.io/radar/data/history.json",integrity:"pending ChatGPT verification"};
const manifest={contract_version:"v3",dispatcher:"Explorations Studio",producer:"ChatGPT",publisher:"WorkBuddy",required_news:7,required_skills:5,required_images:9,generated_images:0,deliverable_status:"request_only",chatgpt_status:"not_claimed",workbuddy_status:"not_started",wechat_status:"not_published"};
const created=await db.from("explorations_runs").insert({user_id:user.id,issue:w.issue,week_start:w.start,week_end:w.end,state:"queued",stage:"awaiting_chatgpt",progress:3,source_report,manifest}).select("*").single();
if(created.error){if(created.error.code==="23505"){const latest=await db.from("explorations_runs").select("*").eq("user_id",user.id).eq("issue",w.issue).single();return latest.error?res({error:latest.error.message},500):res({already_exists:true,run:latest.data,work_order:order(latest.data,latest.data.source_report||{})})}return res({error:created.error.message},500)}
return res({run_id:created.data.id,issue:w.issue,state:"queued",stage:"awaiting_chatgpt",chatgpt_status:"not_claimed",message:"生产任务已登记，等待 ChatGPT 自动化领取；没有生成选题草稿或 PNG。",work_order:order(created.data,source_report)});
});