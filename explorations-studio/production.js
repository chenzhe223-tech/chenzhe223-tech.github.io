import {createClient} from "https://esm.sh/@supabase/supabase-js@2.57.0";
const SUPA="https://qjyqaydfezbpeimpvlcb.supabase.co",KEY="sb_publishable_jtWLY4vYz2-VklNLoJqxVw_lMdhtfgG";
const api=SUPA+"/functions/v1/explorations-production";
const client=createClient(SUPA,KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
let session=null,runs=[],selected=null,busy=false,initial=false;
const el=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const statusLabels={queued:"排队中",ingesting:"读取情报源",selecting:"自动筛选",draft_ready:"编辑草稿就绪",rendering:"视觉生产",qa:"质量检查",ready:"九图素材已完成",blocked:"待补齐执行能力",failed:"运行失败",archived:"已归档"};
const stageLabels={reading_daily_archives:"正在读取 AI Radar 归档",deduplicating_candidates:"来源核验与去重初筛",preparing_editorial_drafts:"生成编辑内容结构",image_engine_unconfigured:"真实生图引擎未配置",missing_daily_archives:"部分日报归档缺失",unreadable_daily_archive:"部分日报文件读取失败",insufficient_candidates:"可用选题数量不足",exception:"运行异常"};
function message(s,error=false){if(el("productionMessage")){el("productionMessage").textContent=s;el("productionMessage").dataset.error=error?"true":"false"}}
async function request(action,params={}){const sess=await client.auth.getSession();const token=sess.data.session?.access_token;if(!token)throw Error("请先登录");const r=await fetch(api,{method:"POST",headers:{"content-type":"application/json","apikey":KEY,"Authorization":"Bearer "+token},body:JSON.stringify({action,...params})});const j=await r.json();if(!r.ok)throw Error(j.error||"服务调用失败 HTTP "+r.status);return j}
let authMode="login",pendingAfterLogin=false,lastUserId="";
function feedback(msg,error=false){const x=el("authMessage");if(x){x.textContent=msg;x.dataset.error=String(error)}}
function openAuth(mode="login"){init();authMode=mode;updateAuthMode();el("authDialog").hidden=false;document.body.style.overflow="hidden";if(session){el("authForm").hidden=true;el("authLogged").hidden=false;el("authDescription").textContent="当前账户已连接云端工作台。";el("authTitle").textContent="我的账户"}setTimeout(()=>el(session?"authContinue":"authEmail")?.focus(),0)}
function closeAuth(){el("authDialog").hidden=true;document.body.style.overflow="";el("authPassword").value="";feedback("");}
function updateAuthMode(){const logged=!!session;const isRegister=authMode==="register",isRecover=authMode==="recover";
el("authTitle").textContent=isRegister?"创建工作台账号":isRecover?"设置账号密码":"欢迎回来";
el("authDescription").textContent=isRegister?"只需首次建立密码，以后可直接登录。若需要确认邮箱，只需验证一次。":isRecover?"输入邮箱，我们只发送一次密码设置邮件。以后直接使用密码登录。":"邮箱与密码登录，不需要每次点击邮件链接。";
el("authForm").hidden=logged||isRecover;el("authLogged").hidden=!logged;el("authRecoverySection").hidden=true;
el("authSubmit").textContent=isRegister?"创建账号 ↗":"登录工作台 ↗";
el("authSwitch").textContent=isRegister||isRecover?"返回账号登录":"首次使用？创建账号";
el("authForgot").hidden=isRecover||isRegister||logged;
el("authSwitch").hidden=logged;
el("authPassword").autocomplete=isRegister?"new-password":"current-password";
feedback("");
}
function setAuthUI(){const logged=!!session;el("productionAuthenticated").hidden=!logged;el("productionStart").disabled=busy;el("productionUser").textContent=logged?(session.user.email||"已登录"):"";el("productionLogout").hidden=!logged;
el("accountText").textContent=logged?(session.user.email?.split("@")[0]||"我的账户"):"登录 / 账户";
el("accountAvatar").textContent=logged?(session.user.email||"D").slice(0,1).toUpperCase():"D";
el("productionStartHint").textContent=logged?"已连接云端，按最新日报生成批次":"无需先登录浏览；启动生产时验证身份";
if(el("resultLoginHint"))el("resultLoginHint").hidden=logged;
const current=logged?session.user.id:"";if(current!==lastUserId){lastUserId=current;if(logged)Promise.resolve().then(refreshRuns);else{runs=[];selected=null;renderRuns();el("productionDetail").hidden=true;el("resultDetail").hidden=true}}
if(!el("authDialog").hidden){el("authLogged").hidden=!logged;el("authForm").hidden=logged||authMode==="recover";el("authSwitch").hidden=logged;el("authForgot").hidden=logged}}
async function auth(){try{const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;setAuthUI();const params=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.slice(1));const errorInfo=params.get("error_description")||hash.get("error_description");if(errorInfo){openAuth("login");feedback("原邮件链接未能完成登录，请使用邮箱与密码。原因："+errorInfo,true);history.replaceState({},document.title,location.pathname)}}catch(e){message("当前浏览器未建立有效登录状态，请使用账号密码。",true)}}
function translateError(e){const s=(e.message||String(e)).toLowerCase();if(s.includes("invalid login credentials"))return"账号或密码不正确。若以前只用邮件链接登录，请点击『忘记密码』设置一次密码。";if(s.includes("email not confirmed"))return"请先完成首次注册邮箱确认，然后可直接用密码登录。";if(s.includes("already registered"))return"该邮箱已注册，请直接登录或使用密码找回。";if(s.includes("rate limit"))return"邮件服务触发发送限制。已有密码的账户可以直接登录；新验证邮件请稍后再试。";if(s.includes("password"))return"密码不符合要求或无效，请使用至少 8 位密码。";return e.message||"操作失败"}
async function submitAuth(ev){ev.preventDefault();const email=el("authEmail").value.trim(),password=el("authPassword").value;if(!email||!password){feedback("请输入邮箱和密码",true);return}if(authMode==="register"&&password.length<8){feedback("注册密码至少需要 8 位",true);return}
const btn=el("authSubmit");btn.disabled=true;try{if(authMode==="register"){const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:"https://chenzhe223-tech.github.io/explorations-studio/"}});if(error)throw error;if(data.session){session=data.session;setAuthUI();closeAuth();message("账号已创建，现已登录。")}else feedback("如该邮箱尚未注册，系统会发送一次确认邮件。完成首次确认后即可长期使用密码登录；已有账号请选择登录。")}else{const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(!data.session)throw Error("登录未成功，请检查邮箱确认状态");session=data.session;setAuthUI();closeAuth();message("登录成功，云端生产中心已连接。");if(pendingAfterLogin){pendingAfterLogin=false;start()}}}catch(e){feedback(translateError(e),true)}finally{btn.disabled=false}}
async function recoverPassword(){const email=el("authEmail").value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){feedback("请先输入需要重设密码的邮箱地址",true);el("authEmail").focus();return}
try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:"https://chenzhe223-tech.github.io/explorations-studio/"});if(error)throw error;feedback("如该账号存在，已发送一次密码重设邮件。完成后即可使用密码直接登录。")}catch(e){feedback(translateError(e),true)}}
async function saveNewPassword(){const pwd=el("authNewPassword").value;if(pwd.length<8){feedback("新密码至少需要 8 位",true);return}try{const {error}=await client.auth.updateUser({password:pwd});if(error)throw error;feedback("密码设置成功！以后直接用邮箱与密码登录。");el("authRecoverySection").hidden=true;setTimeout(closeAuth,900)}catch(e){feedback(translateError(e),true)}}
async function refreshRuns(){if(!session)return;try{const r=await request("list");runs=r.runs||[];renderRuns()}catch(e){message("读取批次失败："+e.message,true)}}
async function start(){if(busy)return;if(!session){pendingAfterLogin=true;openAuth('login');feedback('登录一次后将自动继续启动本周生产。');return;}busy=true;el("productionStart").disabled=true;message("正在读取上周真实日报归档并自动筛选 7+5，请保持本页打开查看结果。");try{const r=await request("start");await refreshRuns();if(r.already_exists){message("该周已有生产批次，已打开已有记录，不重复创建。");if(r.run?.id)await viewRun(r.run.id)}else{message(r.message||"已创建生产批次");if(r.run_id)await viewRun(r.run_id)}}catch(e){message("启动失败："+e.message,true)}finally{busy=false;el("productionStart").disabled=!session}}
function renderRuns(){
 const box=el("productionRuns"),results=el("resultBatches"),home=el("homeBatches");
 if(!runs.length){if(box)box.innerHTML='<div class="empty">暂无正式生产批次。登录后点击“一键启动本周生产”。</div>';if(results)results.innerHTML='<div class="empty">没有自动生产批次。前往生产中心启动即可。</div>';if(home)home.innerHTML='<div class="empty">暂无周刊批次，点击顶部“自动生产”开始。</div>';return}
 const html=runs.map(r=>'<div class="batch-row"><div><span class="eyebrow">WEEKLY EDITION · '+esc(r.issue)+'</span><h3>'+esc(r.week_start)+' — '+esc(r.week_end)+'</h3><p>'+esc(statusLabels[r.state]||r.state)+' · '+esc(stageLabels[r.stage]||r.stage)+' · '+esc(r.progress)+'%</p></div><button class="btn" data-batch="'+esc(r.id)+'">查看批次 →</button></div>').join("");
 if(box)box.innerHTML=html;if(results)results.innerHTML=html;if(home)home.innerHTML=runs.slice(0,3).map(r=>'<div class="batch-row"><div><span class="eyebrow">'+esc(r.issue)+'</span><h3>'+esc(r.week_start)+' — '+esc(r.week_end)+'</h3><p>'+esc(statusLabels[r.state]||r.state)+' · '+esc(stageLabels[r.stage]||r.stage)+'</p></div><button class="btn" data-batch="'+esc(r.id)+'">查看批次 →</button></div>').join("");
 for(const parent of [box,results,home])parent?.querySelectorAll("[data-batch]").forEach(b=>b.addEventListener("click",()=>viewRun(b.dataset.batch)));
}
async function viewRun(id){try{const r=await request("detail",{run_id:id});selected=r;const run=r.run;el("productionDetail").hidden=false;el("productionDetailHeading").textContent=run.issue+" · "+(statusLabels[run.state]||run.state);el("productionDetailStatus").textContent=(stageLabels[run.stage]||run.stage)+" / "+run.progress+"%";el("productionProgress").style.width=run.progress+"%";el("productionProblem").textContent=run.error_message||"";el("productionDetailSub").textContent="来源完整性："+(run.source_report?.days?.length||0)+"/7 日 · 九图输出："+(run.manifest?.generated_images||0)+"/9";el("productionAssetList").innerHTML=(r.assets||[]).map(a=>'<article class="batch-asset"><span class="asset-number">'+String(a.slot).padStart(2,"0")+'</span><div><h4>'+esc(a.title)+'</h4><small>'+esc(a.kind==="news"?"新闻专题":"Skill 合辑")+' · '+esc(a.image_status==="not_generated"?"待视觉生产":a.image_status)+'</small></div></article>').join("")||'<div class="empty">该批次还没有素材记录。</div>';el("productionJson").disabled=false;
if(el("resultDetail")){el("resultDetail").hidden=false;el("resultHeading").textContent=run.issue+" · "+(statusLabels[run.state]||run.state);el("resultStatus").textContent="已生成 PNG："+(run.manifest?.generated_images||0)+"/9 · "+(stageLabels[run.stage]||run.stage);
el("resultCards").innerHTML=(r.assets||[]).map(a=>'<article class="batch-asset"><span class="asset-number">'+String(a.slot).padStart(2,"0")+'</span><div><h4>'+esc(a.title)+'</h4><small>'+esc(a.image_status==="not_generated"?"尚未生成 PNG":"视觉文件已生成")+' · '+esc(a.qc_status||"待 QA")+'</small></div></article>').join("")}}
catch(e){message("打开批次失败："+e.message,true)}}
function exportPackage(){if(!selected)return;const r=selected;const manifest={schema:"DAVYLAB-Explorations-Handoff-v1",issue:r.run.issue,run_id:r.run.id,status:r.run.state,generated_images:r.run.manifest?.generated_images||0,files_ready:false,source_report:r.run.source_report,selections:r.run.selections,assets:r.assets,requirements:{expected_pngs:9,layout:"7 news + 2 skills",style:"AI Explorations premium editorial",checklist:["9 genuine PNG","source verification","90-day dedupe","copyright check","phone preview","WorkBuddy receipt"],published:false}};const blob=new Blob([JSON.stringify(manifest,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=r.run.issue+"-editorial-draft-manifest.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);message("已导出编辑草稿与交接清单 JSON。此文件不含 PNG，不能作为正式发布素材包。")}
function init(){if(initial)return;initial=true;
el("accountButton")?.addEventListener("click",()=>openAuth(session?"account":"login"));
el("authClose")?.addEventListener("click",closeAuth);
el("authDialog")?.addEventListener("click",e=>{if(e.target===el("authDialog"))closeAuth()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!el("authDialog").hidden)closeAuth()});
el("authForm")?.addEventListener("submit",submitAuth);
el("authSwitch")?.addEventListener("click",()=>{if(authMode==="recover"||authMode==="register")authMode="login";else authMode="register";updateAuthMode()});
el("authForgot")?.addEventListener("click",()=>{authMode="recover";updateAuthMode();el("authForm").hidden=true;el("authRecoverySection").hidden=true;el("authPassword").value="";feedback("填写上方邮箱后点击下面的『发送密码设置邮件』。");if(!el("authRecoverSend")){const b=document.createElement("button");b.id="authRecoverSend";b.type="button";b.className="primary-cta auth-submit";b.textContent="发送密码设置邮件 ↗";el("authForm").after(b);b.addEventListener("click",recoverPassword)}el("authRecoverSend").hidden=false;el("authEmail").closest("form").hidden=false;el("authPassword").parentElement.hidden=true;el("authSubmit").hidden=true});
el("authReveal")?.addEventListener("click",()=>{const p=el("authPassword");p.type=p.type==="password"?"text":"password";el("authReveal").textContent=p.type==="text"?"隐藏":"显示"});
el("authSavePassword")?.addEventListener("click",saveNewPassword);
el("authContinue")?.addEventListener("click",closeAuth);
const signout=async()=>{try{await client.auth.signOut();session=null;setAuthUI();closeAuth();message("已退出云端账号。")}catch(e){message("退出失败："+e.message,true)}};
el("authSignout")?.addEventListener("click",signout);
el("productionLogout")?.addEventListener("click",signout);
el("productionStart")?.addEventListener("click",start);
el("productionRefresh")?.addEventListener("click",()=>{if(session)refreshRuns();else openAuth("login")});
el("productionJson")?.addEventListener("click",exportPackage);
client.auth.onAuthStateChange((event,s)=>{session=s;setAuthUI();if(event==="PASSWORD_RECOVERY"){openAuth("recover");el("authForm").hidden=true;el("authRecoverySection").hidden=false;el("authTitle").textContent="设置新密码";el("authDescription").textContent="验证已完成，现在可以设置你的长期登录密码。";feedback("请设置至少 8 位的新密码。")}});
auth();
}
window.ProductionStudio={onShow(){init();if(session)refreshRuns()},start(){init();start()},openAccount(){init();openAuth(session?"account":"login")}};
init();
