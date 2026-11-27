/* Local directory export: no Google OAuth, network upload or token. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.DAVYLABLocalDrive=api})(typeof window!=="undefined"?window:null,function(){
"use strict";
const ROOT="DAVYLAB 公众号工作台";
const clean=(s,max=70)=>String(s||"未命名").replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g,"_").trim().replace(/[. ]+$/g,"").slice(0,max)||"未命名";
async function hash(s){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(buf),v=>v.toString(16).padStart(2,"0")).join("").slice(0,20)}
async function findBySuffix(dir,suffix,kind){const matches=[];for await(const [name,h] of dir.entries())if(h.kind===kind&&name.endsWith(suffix))matches.push(h);if(matches.length>1)throw Error("发现重复归档，请整理目录后重试。");return matches[0]}
function makeWriter({plan,hashKey=hash,now=()=>new Date(),nonce=()=>crypto.randomUUID().slice(0,8)}){
 return async function save(root,input){
 if(!root||root.kind!=="directory"||!input.topic?.id||typeof input.text!=="string"||!input.text.trim())throw Error("请选择同步目录并生成有效指令");
 const p=plan(input.topic,input.mode,input.platform,input.variant),key=await hashKey(p.key);
 const base=root.name===ROOT?root:await root.getDirectoryHandle(ROOT,{create:true});
 let dir=await base.getDirectoryHandle(p.category,{create:true});
 if(p.series){const suffix="__"+await hashKey("series:"+p.series.key);dir=await findBySuffix(dir,suffix,"directory")||await dir.getDirectoryHandle(clean(p.series.name)+suffix,{create:true})}
 const suffix="__"+key+".md",history=input.strategy==="version";
 const stem=clean(p.name,105);
 let file=history?null:await findBySuffix(dir,suffix,"file");
 const existed=!!file;
 const name=history?stem+"_"+now().toISOString().replace(/[:.]/g,"-")+"_"+nonce()+"__history_"+key+".md":stem+suffix;
 if(!file)file=await dir.getFileHandle(name,{create:true});
 const writable=await file.createWritable({keepExistingData:false});
 try{await writable.write(input.text);await writable.close()}catch(e){try{await writable.abort()}catch{}throw e}
 const actual=await file.getFile();if(await actual.text()!==input.text)throw Error("本地文件回读不一致，请检查文件后重试。");
 return {name:file.name,path:[root.name,...(root.name===ROOT?[]:[ROOT]),p.category,...(p.series?[dir.name]:[]),file.name].join(" / "),action:existed?"updated":"created"};
 }
}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open("davylab-local-drive-v1",1);r.onupgradeneeded=()=>r.result.createObjectStore("settings");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function storedHandle(value,write=false){const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction("settings",write?"readwrite":"readonly"),store=tx.objectStore("settings");const r=write?(value?store.put(value,"directory"):store.delete("directory")):store.get("directory");let result;r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
function attach(){
 const $=id=>document.getElementById(id);if(!$("driveLocalSync"))return;
 const status=s=>$("driveLocalStatus").textContent=s;
 let directory=null,busy=false,restoring=true;
 const available=typeof window.showDirectoryPicker==="function"&&window.isSecureContext;
 const label=()=>{$("driveLocalDirectory").textContent=directory?"已选择："+directory.name:"尚未选择 Google Drive 本地目录"};
 const lock=v=>{busy=v;for(const id of ["driveLocalSync","driveLocalPick","driveLocalForget"])$(id).disabled=v||!available};
 const capture=()=>{const t=topics.find(x=>x.id===promptTopicId),text=$("promptBox").value;if(!t||!text.trim())throw Error("请先生成选题指令");if(!activePromptKey||activePromptKey!==promptKey(t)||promptSourceVersions.get(activePromptKey)!==promptSourceVersion(t))throw Error("选题或关联资料已更新，请重新生成指令");return {topic:JSON.parse(JSON.stringify(t)),text,mode:$("promptMode").value,platform:$("promptPlatform").value,variant:[$("financePosterStyle").value,$("financePosterCount").value].join(":"),strategy:$("driveSyncStrategy").value}};
 const writer=makeWriter({plan:window.DAVYLABDriveSync.plan});
 async function pick(){directory=await window.showDirectoryPicker({mode:"readwrite",id:"davylab-drive"});label();try{await storedHandle(directory,true)}catch{status("目录已选择，但浏览器无法记住授权；刷新后可能需重新选择。")}return directory}
 async function permitted(){if(await directory.queryPermission({mode:"readwrite"})==="granted")return true;return await directory.requestPermission({mode:"readwrite"})==="granted"}
 function failure(e){if(e.name==="AbortError")status("已取消目录选择，未写入指令。");else if(e.name==="NotAllowedError"||e.name==="SecurityError")status("浏览器未授予目录写入权限，请使用独立 Chrome / Edge 页面重新选择目录。");else status("本地写入未确认："+(e.message||e.name||"未知错误"))}
 async function run(chooseOnly){if(busy||restoring||!available)return;let input;if(!chooseOnly){try{input=capture()}catch(e){status(e.message);return}}lock(true);$("driveLocalPath").textContent="";
 try{if(chooseOnly||!directory){await pick();if(chooseOnly){status("目录已选择。请确认它位于 Google Drive 桌面客户端的同步范围内。");return}}else if(!await permitted()){status("写入权限未获批准；未保存指令。");return}
 const latest=capture();const p=window.DAVYLABDriveSync.plan;if(latest.text!==input.text||p(latest.topic,latest.mode,latest.platform,latest.variant).key!==p(input.topic,input.mode,input.platform,input.variant).key||latest.strategy!==input.strategy)throw Error("选择目录期间指令已改变，请再次点击同步");
 const result=await writer(directory,input);$("driveLocalPath").textContent=result.path;status("本地保存并回读成功 · "+(result.action==="updated"?"已更新":"已创建")+" · 云端上传状态待 Google Drive 客户端确认。");
 }catch(e){failure(e)}finally{lock(false)}}
 $("driveLocalPick").addEventListener("click",()=>run(true));$("driveLocalSync").addEventListener("click",()=>run(false));
 $("driveLocalForget").addEventListener("click",async()=>{if(busy)return;lock(true);directory=null;label();$("driveLocalPath").textContent="";try{await storedHandle(null,true);status("已忘记本地目录；文件未删除。")}catch{status("当前会话已断开，但浏览器保存的目录授权未能清除。")}finally{lock(false)}});
 lock(true);
 if(!available){restoring=false;lock(false);status("当前浏览器不支持目录写入。请使用桌面 Chrome / Edge 打开独立页面，或下载 Markdown 后手动放入同步目录。");return}
 storedHandle().then(h=>{if(h?.kind==="directory")directory=h;label()}).catch(()=>{}).finally(()=>{restoring=false;lock(false)});
}
return {makeWriter,attach};
});
if(typeof window!=="undefined")window.DAVYLABLocalDrive.attach();
