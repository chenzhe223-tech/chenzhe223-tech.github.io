/* DAVYLAB Topic Studio — browser-only Drive export. Never persists bearer tokens. */
(function(root,factory){
 const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.DAVYLABDriveSync=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const SCOPE="https://www.googleapis.com/auth/drive.file",BASE="https://www.googleapis.com/drive/v3/files",UPLOAD="https://www.googleapis.com/upload/drive/v3/files",FOLDER="application/vnd.google-apps.folder",MARK="davylab-topic-studio-v1",FIELDS="id,name,mimeType,parents,webViewLink,modifiedTime,appProperties";
const clean=(s,max=90)=>String(s??"").replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g,"_").trim().slice(0,max)||"未命名";
const q=s=>"'"+String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")+"'";
function plan(t,mode,platform,variant){
 const c=t.continuity||{},category=mode==="finance"||t.productionMode==="finance"?"财经资讯":c.mode==="series"?"系列连载":c.mode==="followup"||c.mode==="update"?"热门文章续写":"独立文章";
 const series=category==="系列连载"?{key:String(c.seriesId||c.seriesName||"unknown"),name:clean(c.seriesName||"未命名系列")}:null;
 const modes={production:"完整生产指令",planning:"内容策划指令",finance:"财经快报指令"},platforms={chatgpt:"ChatGPT",claude:"Claude",gemini:"Gemini",other:"其他AI"};
 const prefix=series&&Number.isInteger(Number(c.order))&&Number(c.order)>0?String(c.order).padStart(2,"0")+"_":"";
 return {category,series,key:JSON.stringify([String(t.id),mode,platform,mode==="finance"?String(variant||""):""]),name:prefix+clean(t.title,72)+"_"+(modes[mode]||modes.production)+"_"+(platforms[platform]||platforms.other)};
}
function versionName(name,now=new Date()){return name+"_"+now.toISOString().replace(/[:.]/g,"-")+".md"}
async function digest(v){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(v)));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("")}
function makeClient({request,hash=digest,now=()=>new Date()}){
 const query=(url,params)=>url+"?"+new URLSearchParams(params);
 async function list(filter){
  const out=[];let pageToken="";
  do{const r=await request(query(BASE,{q:"trashed = false and "+filter,fields:"nextPageToken,files("+FIELDS+")",pageSize:"100",...(pageToken?{pageToken}:{})}));
   out.push(...(r.files||[]));pageToken=r.nextPageToken||"";if(out.length>1000)throw Error("归档匹配项过多，请在 Drive 中整理重复文件");
  }while(pageToken);return out.sort((a,b)=>String(b.modifiedTime||"").localeCompare(String(a.modifiedTime||""))||String(a.id).localeCompare(String(b.id)));
 }
 const property=(key,val)=>"appProperties has { key="+q(key)+" and value="+q(val)+" }";
 const scope=property("davylabApp",MARK);
 const fields=FIELDS;
 async function folder(parent,key,name){
  const listItems=await list(scope+" and "+property("folderKey",await hash(key))+" and mimeType = "+q(FOLDER)+(parent?" and "+q(parent)+" in parents":" and 'root' in parents"));
  if(listItems.length>1)throw Error("发现重复归档目录，请先在 Google Drive 中整理同名应用目录");
  if(listItems[0])return listItems[0].id;
  const metadata={name,mimeType:FOLDER,parents:[parent||"root"],appProperties:{davylabApp:MARK,folderKey:await hash(key)}};
  const r=await request(query(BASE,{fields}),{method:"POST",json:metadata});if(!r.id)throw Error("目录创建未返回 ID");return r.id;
 }
 async function sync(input){
  if(typeof input.text!=="string"||!input.text.trim())throw Error("当前指令为空");
  if(!input.topic?.id)throw Error("请先选择有效选题");
  const p=plan(input.topic,input.mode,input.platform,input.variant),key=await hash(p.key);
  const root=await folder(null,"root","DAVYLAB 公众号工作台");
  let parent=await folder(root,"category:"+p.category,p.category);
  if(p.series)parent=await folder(parent,"series:"+p.series.key,p.series.name);
  const keep=input.strategy==="version";
  const match=keep?[]:await list(scope+" and "+property("promptKey",key)+" and "+property("recordKind","current")+" and "+q(parent)+" in parents");
  if(match.length>1)throw Error("发现多个当前版本，请在 Drive 中整理后重试");
  const prev=match[0];
  const metadata={name:keep?versionName(p.name,now()):p.name+".md",mimeType:"text/markdown",appProperties:{davylabApp:MARK,promptKey:key,recordKind:keep?"history":"current"}};
  if(!prev)metadata.parents=[parent];
  const dest=prev?UPLOAD+"/"+encodeURIComponent(prev.id):UPLOAD;
  const saved=await request(query(dest,{uploadType:"multipart",fields}),{method:prev?"PATCH":"POST",multipart:{metadata,text:input.text}});
  if(!saved.id)throw Error("上传响应未返回文件 ID，不能确认同步");
  const read=await request(query(BASE+"/"+encodeURIComponent(saved.id),{fields}));
  const content=await request(query(BASE+"/"+encodeURIComponent(saved.id),{alt:"media"}),{asText:true});
  if(content!==input.text||read.id!==saved.id||!read.parents?.includes(parent)||read.name!==metadata.name)throw Error("写入请求已返回，但文件回读核验未通过；请检查 Drive 后再重试");
  const link=typeof read.webViewLink==="string"&&/^https:\/\/drive\.google\.com\//.test(read.webViewLink)?read.webViewLink:"https://drive.google.com/open?id="+encodeURIComponent(read.id);
  return {id:read.id,name:read.name,url:link,modifiedTime:read.modifiedTime||"",action:prev?"updated":"created",path:["DAVYLAB 公众号工作台",p.category,...(p.series?[p.series.name]:[]),read.name].join(" / ")};
 }
 return {sync};
}
function attach(){
 const $=id=>document.getElementById(id);if(!$("driveSyncPrompt"))return;
 const CLIENT_KEY="davylab-drive-oauth-client-v1",STRATEGY_KEY="davylab-drive-prompt-strategy-v1";
 const stored=k=>{try{return localStorage.getItem(k)||""}catch{return ""}};
 const set=(k,v)=>{try{localStorage.setItem(k,v);return true}catch{return false}};
 let access="",expires=0,busy=false,loadPromise=null;
 const status=s=>{$("driveSyncStatus").textContent=s};
 const validClient=s=>/^[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(s);
 const clientId=()=> $("driveClientId").value.trim();
 const validToken=()=>access&&Date.now()<expires-30000;
 $("driveClientId").value=stored(CLIENT_KEY);
 $("driveSyncStrategy").value=stored(STRATEGY_KEY)==="version"?"version":"update";
 function resetLink(){$("driveSyncLink").hidden=true;$("driveSyncLink").removeAttribute("href");$("driveSyncPath").textContent=""}
 function clearToken(){access="";expires=0}
 function controls(v){busy=v;for(const id of ["driveSyncPrompt","driveConnect","driveDisconnect","driveSaveConfig","driveClientId","driveSyncStrategy"])$(id).disabled=v;}
 function loadGIS(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  if(loadPromise)return loadPromise;
  loadPromise=new Promise((resolve,reject)=>{
   const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
   const timer=setTimeout(()=>{s.remove();reject(Error("Google 授权组件加载超时"))},15000);
   s.onload=()=>{clearTimeout(timer);if(window.google?.accounts?.oauth2)resolve();else reject(Error("Google 授权组件不可用"))};
   s.onerror=()=>{clearTimeout(timer);s.remove();reject(Error("无法加载 Google 授权组件，请检查网络"))};document.head.append(s);
  }).catch(e=>{loadPromise=null;throw e});return loadPromise;
 }
 function authorize(){
  if(!validClient(clientId()))throw Error("请先设置有效的 Web OAuth 客户端 ID");
  if(!window.google?.accounts?.oauth2)throw Error("授权组件尚未就绪，请重试");
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("授权未完成，请重新连接")),120000);
   const fail=()=>{clearTimeout(timer);reject(Error("Google 授权取消、拒绝或弹窗未打开"))};
   const c=google.accounts.oauth2.initTokenClient({client_id:clientId(),scope:SCOPE,include_granted_scopes:false,callback:r=>{
    clearTimeout(timer);
    if(r.error||!r.access_token||!google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)){clearToken();reject(Error("未取得 Google Drive 文件授权"));return}
    access=r.access_token;expires=Date.now()+Math.max(0,Number(r.expires_in)||0)*1000;
    if(!validToken()){clearToken();reject(Error("授权令牌已失效，请重新连接"));return}resolve();
   },error_callback:fail});
   try{c.requestAccessToken({prompt:"select_account"})}catch{fail()}
  })
 }
 async function request(url,opt={}){
  if(!validToken())throw Error("Google 授权已过期，请重新同步");
  const headers={Authorization:"Bearer "+access};let body;
  if(opt.json){headers["Content-Type"]="application/json; charset=UTF-8";body=JSON.stringify(opt.json)}
  if(opt.multipart){
   const boundary="davylab_"+crypto.randomUUID().replace(/-/g,"");
   headers["Content-Type"]="multipart/related; boundary="+boundary;
   body=new Blob(["--"+boundary+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n",JSON.stringify(opt.multipart.metadata),"\r\n--"+boundary+"\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n",opt.multipart.text,"\r\n--"+boundary+"--\r\n"]);
  }
  let r;try{r=await fetch(url,{method:opt.method||"GET",headers,body,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"})}catch{throw Error("Google Drive 网络请求失败；如果刚发生上传，请先检查网盘再重试")}
  if(r.status===401){clearToken();throw Error("Google 授权已失效（401），请重新连接")}
  if(!r.ok){let reason="";try{const j=await r.json();reason=j.error?.errors?.[0]?.reason||""}catch{}throw Error("Google Drive API 请求失败（HTTP "+r.status+(reason?" / "+String(reason).replace(/[^a-zA-Z0-9_-]/g,""):"")+"）")}
  return opt.asText?r.text():r.json();
 }
 function capture(){
  const t=topics.find(t=>t.id===promptTopicId),text=$("promptBox").value;
  if(!t||!text.trim())throw Error("先从选题池生成一份完整指令");
  if(!activePromptKey||promptSourceVersions.get(activePromptKey)!==promptSourceVersion(t))throw Error("选题或关联资料已更新，请重新生成指令后同步");
  return {topic:JSON.parse(JSON.stringify(t)),text,mode:$("promptMode").value,platform:$("promptPlatform").value,variant:[$("financePosterStyle").value,$("financePosterCount").value].join(":"),strategy:$("driveSyncStrategy").value};
 }
 function config(){
  if(!validClient(clientId())){$("driveSettings").open=true;status("请先填写 Google Cloud 的 Web OAuth 客户端 ID。无需 Client Secret。");return false}
  return true;
 }
 async function run(connectOnly){
  if(busy)return;let input;
  resetLink();
  if(!connectOnly){try{input=capture()}catch(e){status(e.message);return}}
  if(!config())return;
  controls(true);
  try{
   if(!window.google?.accounts?.oauth2){status("正在加载 Google 授权组件…");await loadGIS();status("授权组件已就绪，请再次点击"+(connectOnly?"连接 Google Drive":"同步至 Google Drive")+"以打开 Google 授权弹窗。");return}
   if(!validToken()){status("请在 Google 弹窗确认账号和文件权限…");await authorize()}
   if(connectOnly){status("Google Drive 本次会话已授权；同步时才会写入指令。");return}
   // Authorization can take time: never write a snapshot if the selected prompt changed.
   const latest=capture();if(latest.text!==input.text||plan(latest.topic,latest.mode,latest.platform,latest.variant).key!==plan(input.topic,input.mode,input.platform,input.variant).key||latest.strategy!==input.strategy)throw Error("授权期间指令已变化，请重新点击同步");
   status("正在归档当前指令，并从 Drive 回读核验…");
   const result=await makeClient({request}).sync(input);
   $("driveSyncLink").href=result.url;$("driveSyncLink").hidden=false;$("driveSyncPath").textContent=result.path;
   status("同步成功 · "+(result.action==="updated"?"已更新当前版本":"已创建文件")+" · "+new Date(result.modifiedTime||Date.now()).toLocaleString("zh-CN")+" · 正文回读一致");
  }catch(e){status(e.message||"同步未完成")}finally{controls(false)}
 }
 $("driveSaveConfig").addEventListener("click",()=>{if(!validClient(clientId())){status("客户端 ID 格式不正确；应以 .apps.googleusercontent.com 结尾");return}clearToken();resetLink();status(set(CLIENT_KEY,clientId())?"客户端 ID 已保存，请连接 Google Drive。":"本地保存不可用，当前页面仍可授权。");loadGIS().catch(e=>status(e.message))});
 $("driveClientId").addEventListener("input",()=>{clearToken();resetLink()});
 $("driveSyncStrategy").addEventListener("change",()=>set(STRATEGY_KEY,$("driveSyncStrategy").value));
 $("driveConnect").addEventListener("click",()=>run(true));$("driveSyncPrompt").addEventListener("click",()=>run(false));
 $("driveDisconnect").addEventListener("click",()=>{clearToken();resetLink();status("本次会话已断开；云端文件未删除。可在 Google 账号设置撤销应用授权。")});
 $("driveSettings").addEventListener("toggle",()=>{if($("driveSettings").open&&validClient(clientId()))loadGIS().catch(e=>status(e.message))});
}
return {SCOPE,plan,versionName,makeClient,attach};
});
if(typeof window!=="undefined")window.DAVYLABDriveSync.attach();
