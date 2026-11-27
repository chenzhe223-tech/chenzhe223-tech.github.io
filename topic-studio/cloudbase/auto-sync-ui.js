/* DAVYLAB Topic Studio · CloudBase v4 login UI + automatic sync.
   Private credentials are handled by CloudBase SDK; no admin key in client.
   All automatic cloud writes are disabled until independent live RLS acceptance.
*/
(function(){
"use strict";
const ENV="excess-tiglon-d6gjc77qr6fa193f2";
const $=id=>document.getElementById(id);
const button=$("davylabSyncButton");
if(!button)return;
let sdk=null,app=null,auth=null,engine=null,unsubscribe=null,sessionUid=null;
let activation=null,ready=false,busy=false,otpIssued=false;let accountGeneration=0;
const allowed=new Set(window.DAVYLABSyncCore?.SOURCES?.map(x=>x.key)||[]);
const dialog=document.createElement("dialog");
dialog.className="davylab-sync-dialog";dialog.id="davylabSyncDialog";
dialog.setAttribute("aria-labelledby","davylabSyncTitle");
dialog.innerHTML=[
 '<div class="sync-header"><div><small>INKORA · BY DAVYLAB / CLOUD SYNC</small><h2 id="davylabSyncTitle">登录后，自动同步</h2></div>',
 '<button type="button" id="syncClose" aria-label="关闭登录窗口">×</button></div>',
 '<p class="sync-intro">同一账号在电脑和手机登录，选题、稿件、AI 指令、排期、研究、配图与增长记录自动对齐。</p>',
 '<p id="syncMessage" role="status" aria-live="polite" class="sync-message">正在检查云端状态…</p>',
 '<div id="syncLoginSection">',
 '<label for="syncEmail">邮箱地址</label><input id="syncEmail" type="email" autocomplete="username" maxlength="160" placeholder="CloudBase 身份认证邮箱">',
 '<div class="sync-tabs"><button id="syncPasswordTab" type="button" aria-pressed="true">邮箱密码</button>',
 '<button id="syncOtpTab" type="button" aria-pressed="false">邮箱验证码</button></div>',
 '<div id="syncPasswordSection"><label for="syncPassword">登录密码</label>',
 '<input id="syncPassword" type="password" autocomplete="current-password" placeholder="仅用于本次登录">',
 '<button class="sync-primary" type="button" id="syncPasswordLogin">登录并自动同步</button></div>',
 '<div id="syncOtpSection" hidden><button type="button" id="syncSendOtp">发送邮箱验证码</button>',
 '<label for="syncOtp">验证码</label><input id="syncOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="12">',
 '<button class="sync-primary" id="syncVerifyOtp" type="button">验证并登录</button></div></div>',
 '<div id="syncAccountSection" hidden><p id="syncAccountInfo"></p>',
 '<button id="syncRetry" type="button">检查同步状态</button> ',
 '<button id="syncPreflight" type="button">只读云端验收</button>',
 '<button id="syncExportConflicts" type="button" hidden>下载冲突双方私有备份</button>',
 '<p id="syncPreflightResult" role="status" aria-live="polite"></p>',
 '<button id="syncSignOut" type="button">退出登录</button></div>',
 '<p class="sync-notice">云端权限未验收时只保留本机数据。账号密码不会写入网站文件；退出登录不删除本机稿件。</p>',
 '<a href="./cloudbase/sync-center.html">查看本机私有备份与冲突记录</a>'
].join("");
document.body.appendChild(dialog);
const label=$("davylabSyncButtonLabel");
function display(message,type="neutral"){
 $("syncMessage").textContent=String(message||"").slice(0,230);
 $("syncMessage").dataset.state=type;
}
function indicator(text,type="idle"){
 if(label)label.textContent=text;
 button.dataset.sync=type;
 button.setAttribute("aria-label","多端同步："+text);
}
function openDialog(){if(!dialog.open)dialog.showModal()}
function closeDialog(){if(dialog.open)dialog.close()}
function safeError(error){
 const msg=String(error?.message||error||"未知错误");
 if(/Failed to fetch|NetworkError|timeout/i.test(msg))return"网络未连接 CloudBase；本地编辑不受影响，恢复网络后可重试。";
 if(/BOUND_TO_DIFFERENT_ACCOUNT/.test(msg))return"当前浏览器绑定另一账号；为保护稿件，请先备份，禁止自动混合账号数据。";
 if(/OWNER_NOT_ALLOWED|NOT_ALLOWLISTED|PG_IDENTITY_GATE|RLS|42501/.test(msg))return"CloudBase 当前账号尚未完成本人权限授权，自动同步保持关闭。";
 if(/CONFLICT|40001|23505/.test(msg))return"检测到其他设备同时修改；已保留冲突，未覆盖。";
 return msg.slice(0,180);
}
function onStatus(s){
 const n=s?.conflicts?.length||0;$("syncExportConflicts").hidden=!n;
 if(s.phase==="synced"){indicator("已同步","synced");
  display("已自动同步。上传 "+s.upload+" 条，接收 "+s.download+" 条；"+new Date(s.lastSync).toLocaleString("zh-CN"),"success")}
 else if(s.phase==="syncing"){indicator("同步中…","syncing");display("正在安全地对齐所有设备数据。")}
 else if(s.phase==="conflict"){indicator("待处理冲突","warning");display("同一条记录出现 "+n+" 项并发改动，未自动覆盖。请下载冲突双方私有备份后核对。","warning")}
 else if(s.phase==="editing"){indicator("编辑中 · 待接收","warning");display("为保护未结束的编辑，已暂缓写回云端版本；离开输入区后自动重试。","warning")}
 else if(s.phase==="offline"){indicator("离线待同步","warning");display("目前离线，本机操作继续保存，恢复网络后自动重试。","warning")}
 else if(s.phase==="error"){indicator("同步需检查","warning");display(safeError(s.error),"warning")}
}
function activationOK(x){
 return x?.schema===1&&x.requiredSchemaVersion===2&&x.environmentId===ENV&&x.enabled===true&&
 x.permissionsVerified===true&&x.productionApproved===true&&x.tombstonesVerified===true;
}
async function loadConfig(){
 ready=false;
 try{const r=await fetch("./cloudbase/sync-activation.json",{cache:"no-store"});
  if(!r.ok)throw Error("激活配置不可用");
  activation=await r.json();
  if(activation.environmentId!==ENV)throw Error("拒绝错误云环境");
  ready=activationOK(activation);
 }catch(e){activation=null;display(safeError(e),"warning")}
}
async function initializeSDK(){
 if(!sdk){
  const imported=await import("./vendor/cloudbase-sdk-v4.mjs");
  sdk=imported.default;
  if(!sdk||typeof sdk.init!=="function")throw Error("CloudBase SDK 包尚未完成部署");
 }
 if(!app){app=sdk.init({env:ENV,region:"ap-shanghai"});auth=app.auth()}
 return auth;
}
function stop(){accountGeneration++;
 if(unsubscribe){try{unsubscribe()}catch{}}
 unsubscribe=null;
 if(engine){try{engine.stop()}catch{}}
 engine=null;sessionUid=null;
}
function onRemoteApplied(keys){window.DAVYLABSyncRefresh?.(keys)}
function canApplyRemote(){const active=document.activeElement;return !(active&&active.closest(".app")&&(/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)||active.isContentEditable))&&!document.querySelector("dialog[open]:not(#davylabSyncDialog)")&&window.DAVYLABProductivity?.canApplyRemote?.()!==false}
function ownerBound(){try{return localStorage.getItem(window.DAVYLABAutoSyncEngine.boundOwnerKey())}catch{return null}}
function lockWorkspace(locked){const appRoot=document.querySelector(".app");if(appRoot){appRoot.inert=locked;appRoot.hidden=locked;appRoot.style.display=locked?"none":""}let lock=$("inkoraPrivateLock");if(!lock){lock=document.createElement("div");lock.id="inkoraPrivateLock";lock.style.cssText="position:fixed;inset:0;z-index:1000;background:#F9F9F7;display:grid;place-content:center;text-align:center;padding:24px";lock.innerHTML='<strong style="font-size:24px">INKORA · BY DAVYLAB</strong><p>此浏览器保存了已绑定账号的私有稿件。请登录原账号继续。</p><button type="button" class="btn primary" id="inkoraUnlock">登录同步</button>';document.body.append(lock);$("inkoraUnlock").addEventListener("click",openDialog)}lock.hidden=!locked;lock.style.display=locked?"grid":"none";if(locked)for(const d of document.querySelectorAll("dialog[open]:not(#davylabSyncDialog)"))d.close();$("syncExportConflicts").hidden=true}
async function resume(session){
 if(!session?.user?.id)return;
 const uid=session.user.id;const bound=ownerBound();lockWorkspace(Boolean(bound&&bound!==uid));
 $("syncLoginSection").hidden=true;$("syncAccountSection").hidden=false;
 $("syncAccountInfo").textContent="当前账号："+(session.user.email||"已登录 CloudBase");
 if(bound&&bound!==uid){stop();indicator("账号不匹配","warning");display("此浏览器的私有稿件属于另一账号。请退出后登录原账号；不会混合数据。","warning");return}
 if(!ready){
  stop();indicator("已登录 · 待开通","warning");
  display("当前已登录，但云端权限及跨端验收未通过，真实同步仍关闭。","warning");
  return;
 }
 if(engine&&sessionUid===uid)return;
 stop();const generation=accountGeneration;
 try{
  const pg=window.DAVYLABPGSyncAdapter,en=window.DAVYLABAutoSyncEngine;
  if(!pg||!en||!window.DAVYLABAutoSyncModel)throw Error("同步组件未完整加载");
  const adapter=pg.create({environmentId:ENV,rdb:app.rdb(),
   connectionValidated:true,permissionsVerified:true,productionEnabled:true,downloadsEnabled:true,tombstonesEnabled:true});
  await adapter.verifyCapabilities();if(generation!==accountGeneration)return;
  sessionUid=uid;
  engine=en.build({storage:localStorage,adapter,uid,win:window,
   productionEnabled:true,permissionsVerified:true,
   pollMs:Math.max(15000,Number(activation.pollSeconds||25)*1000),tombstonesEnabled:true,canApplyRemote,
   onStatus,onApplied:onRemoteApplied});
  unsubscribe=engine.start();
 }catch(e){indicator("云端权限待验收","warning");display(safeError(e),"warning")}
}
async function checkSession(){
 await initializeSDK();
 const {data,error}=await auth.getSession();
 if(error)throw error;
 if(data?.session)await resume(data.session);
 else{
  stop();lockWorkspace(Boolean(ownerBound()));$("syncLoginSection").hidden=false;$("syncAccountSection").hidden=true;
  indicator("登录同步");
  display(ready?"登录同一账号后将自动恢复云端数据。":"当前账号登录可用，但数据库 RLS 和跨端测试未验收，自动同步暂不开启。",
   ready?"neutral":"warning");
 }
}
async function guard(fn){
 if(busy)return;busy=true;
 const ids=["syncPasswordLogin","syncSendOtp","syncVerifyOtp","syncRetry","syncSignOut","syncPreflight"];
 ids.forEach(id=>{if($(id))$(id).disabled=true});
 try{await fn()}catch(e){display(safeError(e),"warning");indicator("需要检查","warning")}
 finally{busy=false;ids.forEach(id=>{if($(id))$(id).disabled=false})}
}
function email(){
 const value=$("syncEmail").value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||value.length>160)throw Error("请输入有效的登录邮箱");
 return value;
}
$("syncPasswordTab").addEventListener("click",()=>{
 $("syncPasswordSection").hidden=false;$("syncOtpSection").hidden=true;
 $("syncPasswordTab").setAttribute("aria-pressed","true");
 $("syncOtpTab").setAttribute("aria-pressed","false")
});
$("syncOtpTab").addEventListener("click",()=>{
 $("syncPasswordSection").hidden=true;$("syncOtpSection").hidden=false;
 $("syncOtpTab").setAttribute("aria-pressed","true");
 $("syncPasswordTab").setAttribute("aria-pressed","false")
});
$("syncPasswordLogin").addEventListener("click",()=>guard(async()=>{
 const password=$("syncPassword").value,client=await initializeSDK();
 if(!password)throw Error("请输入密码");
 const {data,error}=await client.signInWithPassword({email:email(),password});
 $("syncPassword").value="";
 if(error)throw error;
 if(!data?.session)throw Error("登录没有返回有效会话");
 await resume(data.session)
}));
$("syncSendOtp").addEventListener("click",()=>guard(async()=>{
 const client=await initializeSDK();
 const {error}=await client.signInWithOtp({email:email(),options:{shouldCreateUser:false}});
 if(error)throw error;
 otpIssued=true;display("验证码已发送。请确认使用已在 CloudBase 身份认证建立的账号。")
}));
$("syncVerifyOtp").addEventListener("click",()=>guard(async()=>{
 if(!otpIssued)throw Error("请先发送验证码");
 const token=$("syncOtp").value.trim(),client=await initializeSDK();
 if(!/^[A-Za-z0-9]{4,12}$/.test(token))throw Error("验证码格式不正确");
 const {data,error}=await client.verifyOtp({email:email(),token,type:"email"});
 $("syncOtp").value="";
 if(error)throw error;
 if(!data?.session)throw Error("验证码未返回有效登录会话");
 await resume(data.session)
}));
$("syncRetry").addEventListener("click",()=>guard(async()=>{
 await loadConfig();await checkSession();
 if(engine)await engine.sync("user-check");
}));
$("syncPreflight").addEventListener("click",()=>guard(async()=>{
 const result=$("syncPreflightResult");result.textContent="正在检查真实账号权限与数据库结构…";
 try{await initializeSDK();const {data,error}=await auth.getSession();if(error||!data?.session?.user?.id)throw Error("请先登录本人账号");const adapter=window.DAVYLABPGSyncAdapter.create({environmentId:ENV,rdb:app.rdb(),connectionValidated:true});await adapter.verifyCapabilities();const rows=await adapter.list();result.textContent="真实只读检查通过：本人权限、V2 数据库结构及读取成功（"+rows.length+" 条）。生产写入、跨账号隔离和双端验收仍需实测。"}catch(e){result.textContent="只读检查未通过："+safeError(e);throw e}
}));
$("syncExportConflicts").addEventListener("click",()=>{if(!engine||!engine.conflictCopies)return;const copies=engine.conflictCopies();if(!copies.length)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:"INKORA_PRIVATE_SYNC_CONFLICT_V1",createdAt:new Date().toISOString(),containsPrivateDrafts:true,conflicts:copies},null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="INKORA-私有同步冲突-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$("syncSignOut").addEventListener("click",()=>guard(async()=>{
 const {error}=await auth.signOut();
 if(error)throw error;
 stop();await checkSession();
 display("已退出账号；本机已保存稿件仍保留，避免数据丢失。","warning")
}));
button.addEventListener("click",openDialog);
$("mobileSyncOpen")?.addEventListener("click",()=>{openDialog()});
$("syncClose").addEventListener("click",closeDialog);
dialog.addEventListener("click",e=>{if(e.target===dialog)closeDialog()});
// setItem patch is needed because browser 'storage' events do not fire in the
// same tab that changed localStorage. It preserves native synchronous writes.
const originalSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
 const result=originalSet.call(this,key,value);
 if(this===localStorage&&engine&&allowed.has(String(key)))engine.notifyLocalStorageKey(String(key));
 return result;
};
window.DAVYLABAutoSync={
 status:()=>({environmentId:ENV,cloudReady:ready,phase:engine?.state().phase||"inactive",
   lastSync:engine?.state().lastSync||null,conflicts:engine?.state().conflicts.length||0}),
 recordDeletion:(type,id)=>window.DAVYLABAutoSyncEngine.recordDeletion(localStorage,type,id),open:openDialog
};
document.addEventListener("focusout",()=>{if(engine?.state().phase==="editing")setTimeout(()=>{if(canApplyRemote())void engine?.sync("editor-blur").catch(()=>{})},1000)});
lockWorkspace(Boolean(ownerBound()));
(async()=>{
 try{
  await loadConfig();
  await initializeSDK();
  auth.onAuthStateChange?.((event,session)=>{
   if(event==="SIGNED_OUT"){stop();void checkSession().catch(()=>{})}
   if(session&&(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"))void resume(session).catch(()=>{});
  });
  await checkSession();
 }catch(e){indicator("同步未就绪","warning");
  display("CloudBase 客户端暂不可用："+safeError(e)+"。本机编辑功能不受影响。","warning")}
})();
})();
