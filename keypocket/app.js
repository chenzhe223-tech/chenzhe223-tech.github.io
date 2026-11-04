'use strict';
window.__kpBuildVersion='kp-v2-skill-intelligence-20261104-01';
window.__kpInitDiagnostic='script-loaded';
const DB_NAME='keypocket-local-v1', DB_VERSION=1, STORE='vault';
const KEYPOCKET_PENDING_SKILL_KEY='kp.radar.pending-skills.v1';
const KP_META_PREFIX='kp.meta.',KP_SNAPSHOT_PREFIX='kp.snapshot.',KP_SNAPSHOT_LATEST_ID='kp.snapshot.latest',KP_TOMBSTONE_PREFIX='kp.tombstone.',KP_TRASH_DAYS=30,KP_AUTOSAVE_DELAY=850;
const KP_V2_DEVICE_KEY='kp.v2.device-id',KP_V2_SYNC_SCHEMA=2;
let kpSnapshotTimer=null,kpSnapshotBusy=false,kpSnapshotRequested=false;
let kpV2SyncBusy=false,kpV2SyncTimer=null,kpV2SyncKey=null,kpV2SyncSalt=null;
const $=s=>document.querySelector(s); let db, cryptoKey=null, vault=null, records=[], projects=[], editId=null, toastTimer=null;
let kpSkillSearchController=null,kpSkillSearchSequence=0;
const PROVIDERS=[
 {id:'openai',name:'OpenAI',short:'OA',category:'AI 模型',patterns:[/^sk-proj-/,/^sk-[A-Za-z0-9_-]{20,}$/],urls:['platform.openai.com']},
 {id:'anthropic',name:'Anthropic',short:'AN',category:'AI 模型',patterns:[/^sk-ant-/],urls:['console.anthropic.com']},
 {id:'deepseek',name:'DeepSeek',short:'DS',category:'AI 模型',patterns:[/^sk-[A-Za-z0-9]{20,}$/],urls:['platform.deepseek.com']},
 {id:'gemini',name:'Google Gemini',short:'GM',category:'AI 模型',patterns:[/^AIza[0-9A-Za-z_-]{20,}$/],urls:['aistudio.google.com','console.cloud.google.com']},
 {id:'openrouter',name:'OpenRouter',short:'OR',category:'AI 聚合',patterns:[/^sk-or-v1-/],urls:['openrouter.ai/keys']},
 {id:'mistral',name:'Mistral AI',short:'MI',category:'AI 模型',patterns:[/^.{0}$/],urls:['console.mistral.ai']},
 {id:'zhipu',name:'智谱 GLM',short:'GL',category:'AI 模型',patterns:[/^.{0}$/],urls:['open.bigmodel.cn']},
 {id:'aliyun',name:'阿里云百炼',short:'AL',category:'AI 模型',patterns:[/^sk-[A-Za-z0-9]{20,}$/],urls:['bailian.console.aliyun.com']},
 {id:'volcengine',name:'火山引擎',short:'VE',category:'AI 模型',patterns:[/^.{0}$/],urls:['console.volcengine.com']},
 {id:'moonshot',name:'Moonshot AI',short:'MS',category:'AI 模型',patterns:[/^sk-[A-Za-z0-9]{20,}$/],urls:['platform.moonshot.cn']},
 {id:'cloudflare',name:'Cloudflare',short:'CF',category:'云服务',patterns:[/^v1\.0-[A-Fa-f0-9-]{20,}$/],urls:['dash.cloudflare.com/profile/api-tokens']},
 {id:'github',name:'GitHub',short:'GH',category:'开发平台',patterns:[/^github_pat_/,/^gh[pousr]_[A-Za-z0-9_]{20,}$/],urls:['github.com/settings/tokens']},
 {id:'custom',name:'其他 / 自定义',short:'＋',category:'其他',patterns:[],urls:[]}
];
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function getItem(key){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function putItem(item){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(item);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
function writeItems(items,clear=false){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite'),s=t.objectStore(STORE);if(clear)s.clear();for(const item of items)s.put(item);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('本地写入事务已中止'));});}
function deleteItem(key){return new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).delete(key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
function allItems(){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function randomBytes(n){return crypto.getRandomValues(new Uint8Array(n));}
function toB64(buf){const b=new Uint8Array(buf);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s);}
function fromB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function deriveKey(password,salt,iterations=310000){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function encryptJson(obj,key=cryptoKey){const iv=randomBytes(12),plain=new TextEncoder().encode(JSON.stringify(obj));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain);return {iv:toB64(iv),data:toB64(data)};}
async function decryptJson(payload,key=cryptoKey){const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(payload.iv)},key,fromB64(payload.data));return JSON.parse(new TextDecoder().decode(plain));}
// Encrypt each record once; envelope metadata contains no key material.
async function sealRecord(rec){const p=await encryptJson(rec);return {id:rec.id,iv:p.iv,data:p.data,updatedAt:Date.now()};}
async function openRecord(item){return decryptJson({iv:item.iv,data:item.data});}
async function sealProject(project){const p=await encryptJson(project);return {id:'project:'+project.id,kind:'project',iv:p.iv,data:p.data,updatedAt:Date.now()};}
async function openProject(item){return decryptJson({iv:item.iv,data:item.data});}
function normalizeProject(p){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('项目数据格式无效。');const limits={name:100,repoUrl:500,appUrl:500,category:50,stack:160,notes:500,tags:200};for(const [k,max] of Object.entries(limits))if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>max))throw Error('项目字段格式无效。');if(typeof p.id!=='string'||!p.id||p.id.length>100||typeof p.name!=='string'||!p.name.trim())throw Error('项目名称不能为空。');for(const k of ['repoUrl','appUrl'])if(p[k]&&!validWebUrl(p[k]))throw Error('仓库和应用地址必须是有效的 HTTPS 或 HTTP 链接。');return {id:p.id,name:p.name.trim(),repoUrl:(p.repoUrl||'').trim(),appUrl:(p.appUrl||'').trim(),category:(p.category||'其他').trim(),stack:(p.stack||'').trim(),notes:(p.notes||'').trim(),tags:(p.tags||'').trim(),favorite:p.favorite===true,createdAt:Number.isFinite(p.createdAt)?p.createdAt:Date.now(),updatedAt:Number.isFinite(p.updatedAt)?p.updatedAt:Date.now(),syncVersion:Number.isSafeInteger(p.syncVersion)?p.syncVersion:0};}
function validWebUrl(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
function repoTitle(url){try{const u=new URL(url);if(u.hostname==='github.com'){const parts=u.pathname.split('/').filter(Boolean);if(parts.length>=2)return parts[1].replace(/\.git$/,'')+' · '+parts[0];}}catch{}return '';}
function providerById(id){return PROVIDERS.find(p=>p.id===id)||PROVIDERS[PROVIDERS.length-1];}
function normalizeBackupRecords(items){if(!Array.isArray(items)||items.length>5000)throw Error('备份结构不正确。');const seen=new Set(),allowed=new Set(PROVIDERS.map(p=>p.id));return items.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>100||r.id==='vault-meta'||seen.has(r.id)||typeof r.key!=='string'||!r.key||r.key.length>20000||typeof r.provider!=='string'||!allowed.has(r.provider))throw Error('备份记录格式无效或包含重复 ID。');seen.add(r.id);const limits={name:80,purpose:100,project:100,notes:240,providerName:100};for(const [field,max] of Object.entries(limits)){if(r[field]!==undefined&&(typeof r[field]!=='string'||r[field].length>max))throw Error('备份记录字段格式无效。');}if(r.tags!==undefined&&(!Array.isArray(r.tags)||r.tags.length>12||r.tags.some(t=>typeof t!=='string'||t.length>160)))throw Error('备份标签格式无效。');if(r.favorite!==undefined&&typeof r.favorite!=='boolean')throw Error('备份收藏状态无效。');for(const field of ['createdAt','updatedAt'])if(r[field]!==undefined&&(!Number.isFinite(r[field])||r[field]<0))throw Error('备份时间字段无效。');const provider=providerById(r.provider);return {id:r.id,key:r.key,provider:r.provider,providerName:provider.name,name:typeof r.name==='string'?r.name:provider.name,purpose:typeof r.purpose==='string'?r.purpose:'',project:typeof r.project==='string'?r.project:'',tags:Array.isArray(r.tags)?r.tags.slice():[],notes:typeof r.notes==='string'?r.notes:'',favorite:r.favorite===true,createdAt:Number.isFinite(r.createdAt)?r.createdAt:Date.now(),updatedAt:Number.isFinite(r.updatedAt)?r.updatedAt:Date.now(),syncVersion:Number.isSafeInteger(r.syncVersion)?r.syncVersion:0};});}
function identifyProvider(key){const k=key.trim();if(/^sk-proj-/.test(k))return {provider:'openai',confidence:'high',reason:'匹配 OpenAI 项目密钥前缀'};if(/^sk-ant-/.test(k))return {provider:'anthropic',confidence:'high',reason:'匹配 Anthropic 密钥前缀'};if(/^sk-or-v1-/.test(k))return {provider:'openrouter',confidence:'high',reason:'匹配 OpenRouter 密钥前缀'};if(/^AIza[0-9A-Za-z_-]{20,}$/.test(k))return {provider:'gemini',confidence:'high',reason:'匹配 Google API Key 格式'};if(/^github_pat_/.test(k)||/^gh[pousr]_[A-Za-z0-9_]{20,}$/.test(k))return {provider:'github',confidence:'high',reason:'匹配 GitHub Token 前缀'};if(/^v1\.0-[A-Fa-f0-9-]{20,}$/.test(k))return {provider:'cloudflare',confidence:'medium',reason:'格式相似，建议人工确认'};if(/^sk-[A-Za-z0-9_-]{20,}$/.test(k))return {provider:'',confidence:'low',reason:'多个服务商使用相似格式，无法可靠区分'};return {provider:'',confidence:'none',reason:'未找到可靠的格式匹配'};}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),2600);}
function showLockNotice(msg,type='error'){const n=$('#lockNotice');n.textContent=msg;n.className='notice '+type;}
function setView(locked){$('#lockView').classList.toggle('hidden',!locked);$('#mainView').classList.toggle('hidden',locked);}
async function init(){window.__kpInitDiagnostic='entered';if(!window.crypto?.subtle||!window.indexedDB){window.__kpInitDiagnostic='unsupported';$('#lockDesc').textContent='当前浏览器不支持所需的安全加密功能，请使用最新版 HTTPS 浏览器。';$('#unlockBtn').disabled=true;return;}try{window.__kpInitDiagnostic='opening-db';db=await openDB();window.__kpInitDiagnostic='db-opened';vault=await getItem('vault-meta');const all=await allItems();const hasData=all.some(x=>x.id!=='vault-meta');if(!vault&&hasData){window.__kpInitDiagnostic='vault-meta-missing-with-data';$('#lockTitle').textContent='检测到本地数据，但密钥库信息缺失';$('#lockDesc').textContent='为保护已有数据，KeyPocket 已阻止创建新密码。请回到最初保存密钥的浏览器/设备和原网址打开；不要清理网站数据。此页面中的数据未被删除。';$('#unlockBtn').textContent='暂不可创建密码';$('#unlockBtn').disabled=true;$('#confirmWrap').classList.add('hidden');$('#resetLocalBtn').classList.add('hidden');showLockNotice('安全保护已启动：发现现有记录但缺少密钥库元数据，已阻止覆盖。','error');setView(true);return;}$('#lockTitle').textContent=vault?'欢迎回来':'创建你的本地密钥库';$('#lockDesc').textContent=vault?'输入本地密码解锁。密码不会上传，也无法由我们找回。':'设置一个至少 10 位的本地密码。它将用于加密密钥，且不会上传。';$('#unlockBtn').textContent=vault?'解锁密钥库':'创建本地密钥库';$('#confirmWrap').classList.toggle('hidden',!!vault);$('#resetLocalBtn').classList.toggle('hidden',!vault);setView(true);window.__kpInitDiagnostic='ready';}catch(err){window.__kpInitDiagnostic='error: '+String(err?.name||'Error')+' '+String(err?.message||'');$('#lockTitle').textContent='本地密钥库暂时无法读取';$('#lockDesc').textContent='读取本地存储时发生错误。请勿清除网站数据，刷新后重试；如仍失败，请保留此页面并反馈错误。';showLockNotice(err.message||'初始化失败。','error');$('#unlockBtn').disabled=true;setView(true);}}
init().catch(e=>{window.__kpInitDiagnostic='error: '+String(e?.name||'Error')+' '+String(e?.message||'');showLockNotice('初始化失败：'+(e.message||'浏览器不支持本地存储'));});
$('#unlockForm').addEventListener('submit',async e=>{e.preventDefault();const pass=$('#masterPassword').value,confirm=$('#confirmPassword').value,btn=$('#unlockBtn');if(btn.disabled)return;const originalLabel=btn.textContent;btn.disabled=true;btn.textContent=vault?'正在验证密码…':'正在创建加密密钥…';showLockNotice(vault?'正在验证密码并读取本地加密数据，请勿关闭页面。':'正在创建本地加密密钥库，请稍候。','info');try{window.kpSyncMasterPassword=null;if(!vault){if(pass.length<10)throw Error('密码至少需要 10 位。');if(pass!==confirm)throw Error('两次输入的密码不一致。');const salt=randomBytes(16);cryptoKey=await deriveKey(pass,salt);btn.textContent='正在安全保存…';const verifier=await encryptJson({check:'keypocket-v1'});vault={id:'vault-meta',salt:toB64(salt),iterations:310000,verifier};await putItem(vault);records=[];projects=[];showToast('本地密钥库已创建');}else{cryptoKey=await deriveKey(pass,fromB64(vault.salt),vault.iterations||310000);btn.textContent='正在读取本地记录…';const check=await decryptJson(vault.verifier);if(check.check!=='keypocket-v1')throw Error('密码校验失败，或本地数据已损坏。');const stored=(await allItems()).filter(x=>{const id=String(x.id||'');return id&&id!=='vault-meta'&&!id.startsWith(KP_META_PREFIX)&&!id.startsWith(KP_SNAPSHOT_PREFIX)&&!id.startsWith(KP_TOMBSTONE_PREFIX);});records=(await Promise.all(stored.filter(x=>x.kind!=='project'&&!String(x.id||'').startsWith('project:')).map(openRecord))).filter(x=>!x.deletedAt);projects=(await Promise.all(stored.filter(x=>x.kind==='project'||String(x.id||'').startsWith('project:')).map(openProject))).filter(x=>!x.deletedAt);showToast('已安全解锁');}$('#masterPassword').value='';$('#confirmPassword').value='';$('#lockNotice').className='notice hidden';window.__kpUnlockStep='switch-view';setView(false);window.__kpUnlockStep='render-keys';render();window.__kpUnlockStep='render-projects';window.renderProjects();window.__kpUnlockStep='update-radar-import-button';updateRadarImportButton();window.__kpVaultUnlocked=!!cryptoKey;window.__kpUnlockStep='read-pending-queue';const pendingSkills=readPendingRadarSkills();window.__kpUnlockQueueCount=pendingSkills.length;window.__kpUnlockQueueStage=window.__kpRadarQueueDiagnostic?.stage||'none';if(pendingSkills.length){window.__kpRadarModalDiagnostic='opening';window.__kpUnlockStep='open-pending-modal';openPendingRadarSkillModal();window.__kpRadarModalDiagnostic=$('#modalRoot').innerHTML.includes('saveRadarSkillBtn')?'opened':'not-opened';}window.__kpUnlockStep='create-unlock-snapshot';await kpWriteEncryptedSnapshot('unlock-protection');window.__kpUnlockStep='daily-snapshot';window.__kpUnlockStep='prune-expired-trash';await kpPruneExpiredTrash();window.__kpUnlockStep='complete';}catch(err){window.__kpUnlockError={step:window.__kpUnlockStep||'unknown',name:String(err?.name||'Error'),message:String(err?.message||err)};cryptoKey=null;const msg=err&&err.name==='OperationError'?'密码不正确，或本地加密数据已损坏。':(err.message||'解锁失败，请重试。');showLockNotice(msg,'error');}finally{btn.disabled=false;btn.textContent=vault?'解锁密钥库':originalLabel;}});
$('#resetLocalBtn').addEventListener('click',async()=>{if(!confirm('这将永久删除此浏览器中的全部密钥与本地库，无法撤销。确定继续？'))return;const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>{vault=null;cryptoKey=null;records=[];projects=[];$('#masterPassword').value='';$('#lockTitle').textContent='创建你的本地密钥库';$('#lockDesc').textContent='设置一个至少 10 位的本地密码。';$('#confirmWrap').classList.remove('hidden');$('#resetLocalBtn').classList.add('hidden');$('#unlockBtn').textContent='创建本地密钥库';showLockNotice('本地库已清空，可以设置新密码。','ok');};});
$('#lockBtn').addEventListener('click',()=>{cryptoKey=null;window.kpSyncMasterPassword=null;window.kpV2Passphrase=null;kpV2SyncKey=null;kpV2SyncSalt=null;records=[];projects=[];setView(true);$('#lockTitle').textContent='密钥库已锁定';$('#lockDesc').textContent='输入本地密码重新解锁。';$('#unlockBtn').textContent='解锁密钥库';$('#confirmWrap').classList.add('hidden');$('#masterPassword').focus();});
function render(){const query=$('#searchInput').value.trim().toLowerCase(),filter=$('#providerFilter').value;const shown=records.filter(r=>(!filter||r.provider===filter)&&(!query||[r.name,r.providerName,r.purpose,r.project,r.notes,...(r.tags||[])].join(' ').toLowerCase().includes(query))).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt-a.updatedAt);$('#totalCount').textContent=records.length;$('#providerCount').textContent=new Set(records.map(r=>r.provider)).size;$('#favoriteCount').textContent=records.filter(r=>r.favorite).length;$('#listCount').textContent=`${shown.length} 条记录`;const select=$('#providerFilter'),old=select.value;select.innerHTML='<option value="">全部服务商</option>'+[...new Set(records.map(r=>r.provider))].map(id=>`<option value="${esc(id)}">${esc(providerById(id).name)}</option>`).join('');select.value=records.some(r=>r.provider===old)?old:'';const cards=$('#cards');if(!shown.length){cards.innerHTML=`<div class="empty"><div class="big">⌘</div><h3>${records.length?'没有找到匹配的密钥':'你的口袋还是空的'}</h3><p>${records.length?'试试更换关键词或筛选条件。':'添加第一个 API Key，之后就能快速查找和复制。'}</p>${records.length?'':'<button class="btn primary" data-action="add">＋ 新增 API Key</button>'}</div>`;return;}cards.innerHTML=shown.map(r=>{const p=providerById(r.provider);return `<article class="card" data-id="${esc(r.id)}"><div class="cardtop"><div class="provider-icon">${esc(p.short)}</div><div class="cardtitle"><h3>${esc(r.name||p.name)} ${r.favorite?'★':''}</h3><p>${esc(p.name)} · ${esc(r.purpose||'未填写用途')}</p></div><button class="dots" data-action="menu" aria-label="更多操作" title="更多操作">⋯</button></div><div class="secret"><code>${esc(mask(r.key))}</code><button data-action="reveal" title="临时显示密钥" aria-label="临时显示密钥">◉</button></div><div class="tags">${r.project?`<span class="tag">项目：${esc(r.project)}</span>`:''}${(r.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}<span class="tag">更新于 ${new Date(r.updatedAt).toLocaleDateString()}</span></div><div class="cardactions"><button class="btn primary copy" data-action="copy">复制 Key</button><button class="btn" data-action="edit">编辑</button><button class="btn" data-action="favorite">${r.favorite?'取消收藏':'收藏'}</button></div></article>`}).join('');}
function mask(k){if(!k)return '未填写密钥';if(k.length<9)return '•'.repeat(k.length);return k.slice(0,4)+'•'.repeat(Math.min(18,k.length-8))+k.slice(-4);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openModal(html){
 if(kpSkillSearchController){kpSkillSearchSequence++;kpSkillSearchController.abort();kpSkillSearchController=null;}
 $('#modalRoot').innerHTML=`<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" tabindex="-1">${html}</section></div>`;
 document.body.classList.add('kp-modal-open');
 const first=$('#modalRoot input:not([type=hidden]),#modalRoot select');
 // Do not auto-open the iOS keyboard or force a visual-viewport jump on phones.
 if(first&&!window.matchMedia('(max-width: 700px)').matches)first.focus();
}
function closeModal(){
 kpSkillSearchSequence++;
 if(kpSkillSearchController){kpSkillSearchController.abort();kpSkillSearchController=null;}
 $('#modalRoot').innerHTML='';document.body.classList.remove('kp-modal-open');editId=null;
}
function providerOptions(selected){return PROVIDERS.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');}
function addEditModal(rec=null,rawKey=''){editId=rec?.id||null;const guessed=identifyProvider(rawKey||rec?.key||'');const provider=rec?.provider||(guessed.confidence==='high'?guessed.provider:'custom');openModal(`<h2>${rec?'编辑密钥':'新增 API Key'}</h2><p class="sub">密钥仅在本地加密保存。不要把生产密钥粘贴到公共或共享设备。</p><form id="recordForm"><div class="field"><label for="keyInput">API Key <span style="color:#b93636">*</span></label><textarea id="keyInput" required autocomplete="off" spellcheck="false" placeholder="粘贴 API Key" rows="3">${esc(rec?.key||rawKey)}</textarea><div id="detectHint" class="hint">${esc(guessed.reason||'粘贴后将尝试在本地识别服务商')}</div></div><div class="grid2"><div class="field"><label for="providerInput">服务商</label><select id="providerInput">${providerOptions(provider)}</select></div><div class="field"><label for="nameInput">密钥名称</label><input id="nameInput" maxlength="80" placeholder="例如：个人开发 Key" value="${esc(rec?.name||'')}"></div></div><div class="grid2"><div class="field"><label for="purposeInput">用途</label><input id="purposeInput" maxlength="100" placeholder="例如：测试 / 生产 / Agent" value="${esc(rec?.purpose||'')}"></div><div class="field"><label for="projectInput">项目（可选）</label><input id="projectInput" maxlength="100" placeholder="例如：KeyPocket" value="${esc(rec?.project||'')}"></div></div><div class="field"><label for="tagsInput">标签（可选，用逗号分隔）</label><input id="tagsInput" maxlength="160" placeholder="开发, 个人, 测试" value="${esc((rec?.tags||[]).join(', '))}"></div><div class="field"><label for="notesInput">备注（可选）</label><input id="notesInput" maxlength="240" placeholder="控制台地址、轮换提示等，不要写入其他密码" value="${esc(rec?.notes||'')}"></div><div id="formNotice" class="notice info">自动识别仅依据本地格式规则；格式相似时请手动确认服务商。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">${rec?'保存修改':'加密保存'}</button></div></form>`);
$('#keyInput').addEventListener('input',()=>{const g=identifyProvider($('#keyInput').value);$('#detectHint').textContent=g.reason;$('#detectHint').style.color=g.confidence==='high'?'#147d55':'#788293';if(g.confidence==='high'&&!editId)$('#providerInput').value=g.provider;});$('#providerInput').addEventListener('change',()=>{$('#detectHint').textContent='已由你选择服务商：'+providerById($('#providerInput').value).name;});$('#recordForm').addEventListener('submit',async e=>{e.preventDefault();const key=$('#keyInput').value.trim();if(!key){$('#keyInput').focus();return;}const provider=$('#providerInput').value,p=providerById(provider),now=Date.now();const item={id:editId||crypto.randomUUID(),key,provider,providerName:p.name,name:$('#nameInput').value.trim()||p.name,purpose:$('#purposeInput').value.trim(),project:$('#projectInput').value.trim(),tags:$('#tagsInput').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12),notes:$('#notesInput').value.trim(),favorite:rec?.favorite||false,createdAt:rec?.createdAt||now,updatedAt:now};try{await persistRecord(item);records=records.filter(x=>x.id!==item.id);records.push(item);closeModal();render();showToast(rec?'修改已加密保存':'密钥已加密保存');}catch(err){$('#formNotice').className='notice error';$('#formNotice').textContent='保存失败：'+(err.message||'请重试');}});}
$('#cards').addEventListener('click',async e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;if(action==='add'){addEditModal();return;}const card=btn.closest('[data-id]');if(!card)return;const r=records.find(x=>x.id===card.dataset.id);if(!r)return;if(action==='copy'){try{await navigator.clipboard.writeText(r.key);showToast('已复制完整 Key 到剪贴板');}catch{openModal(`<h2>复制未获授权</h2><p class="sub">浏览器未允许直接写入剪贴板。你可以手动复制下面的密钥。</p><div class="field"><textarea readonly rows="4">${esc(r.key)}</textarea></div><div class="modal-actions"><button class="btn primary" data-action="close">完成</button></div>`);}}else if(action==='edit')addEditModal(r);else if(action==='favorite'){r.favorite=!r.favorite;r.updatedAt=Date.now();await persistRecord(r);render();showToast(r.favorite?'已加入收藏':'已取消收藏');}else if(action==='reveal'){openModal(`<h2>查看完整密钥</h2><p class="sub">请确认当前屏幕没有被他人看到。关闭窗口后会重新隐藏。</p><div class="field"><textarea readonly rows="4">${esc(r.key)}</textarea></div><div class="modal-actions"><button class="btn" data-action="close">关闭</button><button class="btn primary" data-action="modalcopy" data-id="${esc(r.id)}">复制 Key</button></div>`);}else if(action==='menu'){openModal(`<h2>${esc(r.name)}</h2><p class="sub">${esc(providerById(r.provider).name)} · ${esc(r.purpose||'未填写用途')}</p><div class="cardactions" style="flex-wrap:wrap"><button class="btn" data-action="edit" data-id="${esc(r.id)}">编辑信息</button><button class="btn" data-action="favorite" data-id="${esc(r.id)}">${r.favorite?'取消收藏':'加入收藏'}</button><button class="btn danger" data-action="delete" data-id="${esc(r.id)}">删除密钥</button></div><div class="modal-actions"><button class="btn" data-action="close">关闭</button></div>`);}});
$('#modalRoot').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(a==='close'||a==='backdrop'&&e.target===b){closeModal();return;}const id=b.dataset.id,r=records.find(x=>x.id===id);if(a==='modalcopy'&&r){try{await navigator.clipboard.writeText(r.key);closeModal();showToast('已复制完整 Key 到剪贴板');}catch{showToast('复制失败，请检查浏览器权限');}}if(a==='edit'&&r){addEditModal(r);return;}if(a==='favorite'&&r){r.favorite=!r.favorite;await persistRecord(r);closeModal();render();showToast(r.favorite?'已加入收藏':'已取消收藏');}if(a==='delete'&&r){if(confirm(`确定将「${r.name}」移入回收站？可在 30 天内恢复。`)){await softDeleteRecord(r);records=records.filter(x=>x.id!==r.id);closeModal();render();showToast('已移入回收站，可在 30 天内恢复');}}});
$('#addKeyBtn')?.addEventListener('click',()=>addEditModal());$('#searchInput').addEventListener('input',render);$('#providerFilter').addEventListener('change',render);$('#exportBtn').addEventListener('click',()=>openModal(`<h2>导出加密备份</h2><p class="sub">备份包含全部密钥记录，并使用独立备份密码加密。建议使用不同于本地解锁密码的长密码。</p><form id="exportForm"><div class="field"><label for="backupPassword">备份密码</label><input id="backupPassword" type="password" minlength="10" required autocomplete="new-password" placeholder="至少 10 位"></div><div class="field"><label for="backupConfirm">确认备份密码</label><input id="backupConfirm" type="password" minlength="10" required autocomplete="new-password" placeholder="再次输入"></div><div class="notice warn">丢失备份密码将无法恢复备份。导出的文件请保存到可信位置。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">生成加密备份</button></div></form>`));
$('#modalRoot').addEventListener('submit',async e=>{if(e.target.id!=='exportForm')return;e.preventDefault();const p=$('#backupPassword').value,c=$('#backupConfirm').value;if(p.length<10||p!==c){showToast(p!==c?'两次备份密码不一致':'备份密码至少 10 位');return;}try{const salt=randomBytes(16),key=await deriveKey(p,salt),payload=await encryptJson({format:'keypocket-backup',version:1,createdAt:new Date().toISOString(),records,projects},key);const file={app:'KeyPocket',version:1,createdAt:new Date().toISOString(),kdf:{name:'PBKDF2-SHA-256',iterations:310000,salt:toB64(salt)},cipher:{name:'AES-256-GCM',...payload}};const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`keypocket-backup-${new Date().toISOString().slice(0,10)}.keypocket`;a.click();URL.revokeObjectURL(url);closeModal();showToast('加密备份已生成');}catch(err){showToast('备份失败：'+err.message);}});
$('#importBtn').addEventListener('click',()=>$('#backupFile').click());$('#backupFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB。');const raw=JSON.parse(await file.text());if(raw.app!=='KeyPocket'||raw.version!==1||raw.cipher?.name!=='AES-256-GCM'||raw.kdf?.name!=='PBKDF2-SHA-256')throw Error('这不是受支持的 KeyPocket 备份文件。');if(!Number.isInteger(raw.kdf.iterations)||raw.kdf.iterations<100000||raw.kdf.iterations>1000000)throw Error('备份加密参数无效。');if(fromB64(raw.kdf.salt).length!==16||fromB64(raw.cipher.iv).length!==12||fromB64(raw.cipher.data).length<16)throw Error('备份数据结构无效。');openModal(`<h2>恢复加密备份</h2><p class="sub">文件创建时间：${esc(raw.cipher?new Date(raw.createdAt||Date.now()).toLocaleString():'未知')}。解密将在本地完成。</p><form id="importForm"><div class="field"><label for="importPassword">备份密码</label><input id="importPassword" type="password" required autocomplete="current-password" placeholder="输入导出时设置的密码"></div><div class="field"><label>导入方式</label><select id="importMode"><option value="merge">合并到现有密钥库（同 ID 覆盖）</option><option value="replace">替换当前所有记录</option></select></div><div class="notice warn">替换会删除当前密钥库中的所有记录。建议先导出当前备份。</div><div id="importNotice" class="notice hidden"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">解密并导入</button></div></form>`);$('#importForm').addEventListener('submit',async ev=>{ev.preventDefault();const pass=$('#importPassword').value;try{const key=await deriveKey(pass,fromB64(raw.kdf.salt),raw.kdf.iterations||310000),data=await decryptJson(raw.cipher,key);if(data.format!=='keypocket-backup'||data.version!==1)throw Error('备份结构不正确。');const incoming=normalizeBackupRecords(data.records),incomingProjects=(Array.isArray(data.projects)?data.projects:[]).map(normalizeProject),mode=$('#importMode').value,encrypted=await Promise.all(incoming.map(sealRecord)),encryptedProjects=await Promise.all(incomingProjects.map(sealProject));if(mode==='replace'){await kpWriteEncryptedSnapshot('before-import-replace');const retained=(await allItems()).filter(x=>x.id==='vault-meta'||x.id.startsWith(KP_SNAPSHOT_PREFIX)||x.id.startsWith(KP_META_PREFIX)||x.id.startsWith(KP_TOMBSTONE_PREFIX));await writeItems([...retained,...encrypted,...encryptedProjects],true);records=incoming;projects=incomingProjects;}else{await writeItems([...encrypted,...encryptedProjects]);for(const r of incoming){records=records.filter(x=>x.id!==r.id);records.push(r);}for(const p of incomingProjects){projects=projects.filter(x=>x.id!==p.id);projects.push(p);}}await kpWriteEncryptedSnapshot(mode==='replace'?'after-import-replace':'after-import-merge');closeModal();render();window.renderProjects();showToast(`成功导入 ${incoming.length} 条密钥与 ${incomingProjects.length} 个项目`);}catch(err){const n=$('#importNotice');n.textContent='无法解密或备份无效，请检查密码与文件。';n.className='notice error';}});}catch(err){showToast(err.message||'读取备份失败');}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('#mainView').classList.contains('hidden')){e.preventDefault();$('#searchInput').focus();}});

// Project pocket: metadata is encrypted before entering IndexedDB; GitHub URLs are saved locally without OAuth tokens.
function isOwnGithubRepo(url){const path=githubRepoPath(url||'');return !!path&&path.owner.toLowerCase()==='chenzhe223-tech';}
function projectSource(p){if(isOwnGithubRepo(p.repoUrl))return 'mine';if(p.repoUrl)return 'external';return 'other';}
function isExternalSkillProject(p){return projectSource(p)==='external'&&(/skill/i.test([p.name,p.category,p.tags].join(' '))||/skill/i.test(p.notes||'')||/AI 前沿简报|公开仓库/.test(p.notes||''));}
function isOwnSkillProject(p){return projectSource(p)==='mine'&&(/skill/i.test([p.name,p.category,p.tags].join(' '))||/skill/i.test(p.notes||''));}
const KP_SKILL_TAXONOMY={
 'AI Agent 与自动化':{subs:['Agent 框架与多智能体','MCP 与工具调用','工作流与自动化','提示词与上下文工程'],scenes:['构建 AI Agent','自动化重复工作','连接外部工具']},
 '编程与软件工程':{subs:['前端与 Web 开发','后端与 API','代码理解与重构','调试与性能优化','测试与代码审查'],scenes:['开发 Web 应用','API 集成','代码质量提升']},
 'UI/UX 与视觉设计':{subs:['界面与交互设计','设计系统与组件','插画与视觉生成','动效与原型','地图与数据视觉'],scenes:['设计产品界面','制作视觉内容','构建动效原型']},
 '数据分析与知识管理':{subs:['数据分析与 SQL','数据可视化与看板','知识库与检索','文档解析与信息提取'],scenes:['分析业务数据','搭建知识库','制作数据看板']},
 '内容创作与办公':{subs:['写作与编辑','演示与文档','办公自动化','翻译与本地化'],scenes:['撰写内容','制作办公文档','跨语言沟通']},
 '搜索与深度研究':{subs:['网页与资料搜索','研究分析与综述','事实核查与引用'],scenes:['开展专题研究','检索可信资料','信息核验']},
 '多媒体与创意':{subs:['图像生成与编辑','视频与动画','音频与音乐','3D 与空间创作'],scenes:['生成图片','制作视频','音频创作']},
 '业务与行业应用':{subs:['产品与项目管理','商业分析与运营','采购与合同','行业专业工具'],scenes:['管理项目','业务流程优化','专业行业工作']},
 '安全与系统运维':{subs:['应用安全与隐私','云与基础设施','DevOps 与部署','监控与故障排查'],scenes:['保障应用安全','部署与运维','排查系统故障']}
};
function inferSkillProfile(p){
 const text=[p.name,p.category,p.stack,p.tags,p.notes,p.repoUrl].join(' ').toLowerCase();
 const rules=[
  ['安全与系统运维','应用安全与隐私',/security|secure|privacy|安全|隐私|漏洞|audit/],
  ['AI Agent 与自动化','MCP 与工具调用',/\bmcp\b|tool.?use|工具调用/],
  ['AI Agent 与自动化','Agent 框架与多智能体',/agent|智能体|multi.?agent/],
  ['AI Agent 与自动化','工作流与自动化',/automation|workflow|自动化|工作流/],
  ['编程与软件工程','前端与 Web 开发',/frontend|front-end|react|vue|next\.js|css|html|前端|web/],
  ['编程与软件工程','后端与 API',/backend|api|server|后端|接口/],
  ['编程与软件工程','测试与代码审查',/test|qa|playwright|testing|测试|代码审查/],
  ['UI/UX 与视觉设计','界面与交互设计',/ui.?ux|figma|design|interface|界面|交互|设计/],
  ['UI/UX 与视觉设计','插画与视觉生成',/image|illustration|draw|hand.?draw|插画|图像|图片/],
  ['UI/UX 与视觉设计','动效与原型',/motion|animation|prototype|动效|动画|原型/],
  ['数据分析与知识管理','数据可视化与看板',/dashboard|chart|visualization|看板|图表|可视化/],
  ['数据分析与知识管理','数据分析与 SQL',/data|analytics|sql|database|数据|分析/],
  ['搜索与深度研究','网页与资料搜索',/search|browser|crawl|scrape|搜索|爬取/],
  ['内容创作与办公','写作与编辑',/writing|content|copywriting|blog|文案|写作|内容/],
  ['多媒体与创意','视频与动画',/video|film|视频/],
  ['多媒体与创意','音频与音乐',/audio|music|音频|音乐/],
  ['业务与行业应用','产品与项目管理',/project management|product management|项目管理|产品管理/],
  ['安全与系统运维','DevOps 与部署',/devops|deploy|cloud|docker|kubernetes|部署|运维/]
 ];
 let selected=rules.find(r=>r[2].test(text));
 const domain=selected?.[0]||'业务与行业应用',subcategory=selected?.[1]||'专业工具与流程';
 const evidence=[p.name?'仓库/Skill 名称':'',p.category?'原始分类':'',p.stack?'技术栈':'',p.tags?'标签':'',p.notes?'备注描述':'',p.repoUrl?'GitHub 仓库地址':''].filter(Boolean);
 const purpose=(String(p.notes||'').split('\n').find(x=>/^(主要作用|应用建议|建议方向)：/.test(x))||'').replace(/^(主要作用|应用建议|建议方向)：/,'').trim();
 const summary=purpose||((p.name||'该 Skill')+'：根据名称、标签与仓库元数据归纳的能力工具；建议打开原始仓库核实详细用法。');
 const confidence=evidence.length>=4?'较高':evidence.length>=2?'中等':'较低';
 return {version:1,domain,subcategory,scenes:KP_SKILL_TAXONOMY[domain]?.scenes||[],summary,capabilities:[subcategory,...(p.stack?[p.stack]:[])].slice(0,4),confidence,evidence,source:p.repoUrl||'',generatedAt:Date.now(),method:'metadata-rules'};
}
function skillProfile(p){
 const auto=inferSkillProfile(p),saved=p.skillProfile&&typeof p.skillProfile==='object'?p.skillProfile:{};
 return {...auto,...saved,domain:saved.manualDomain||auto.domain,subcategory:saved.manualSubcategory||auto.subcategory,summary:saved.manualSummary||auto.summary,scenes:saved.manualScenes||auto.scenes,confidence:saved.manualDomain||saved.manualSummary?'人工确认':auto.confidence};
}
function skillCategory(p){return skillProfile(p).domain;}
function skillMetaLines(p){
 const lines=String(p.notes||'').split('\n');
 return {rank:lines.find(x=>/^GitHub 排名：/.test(x)),heat:lines.find(x=>/^热度：/.test(x)),updated:lines.find(x=>/^热度采集时间：/.test(x)),stars:lines.find(x=>/^GitHub Stars：/.test(x)),purpose:lines.find(x=>/^主要作用：|^应用建议：|^建议方向：/.test(x))};
}
function renderProjects(){
 const q=($('#projectSearch')?.value||'').trim().toLowerCase(),sourceFilter=$('#projectSourceFilter')?.value||'all',categoryFilter=$('#projectCategoryFilter')?.value||'all',sceneFilter=$('#projectSceneFilter')?.value||'all';
 const matches=projects.filter(p=>{
  const src=projectSource(p),externalSkill=isExternalSkillProject(p),ownSkill=isOwnSkillProject(p),skillProject=externalSkill||ownSkill,profile=skillProject?skillProfile(p):null;
  if((sourceFilter==='mine'&&src!=='mine')||(sourceFilter==='external'&&src!=='external')||(sourceFilter==='skills'&&!skillProject)||(sourceFilter==='other'&&src!=='other'))return false;
  if(categoryFilter!=='all'&&profile?.domain!==categoryFilter)return false;
  if(sceneFilter!=='all'&&!(profile?.scenes||[]).includes(sceneFilter))return false;
  return !q||[p.name,p.repoUrl,p.appUrl,p.category,p.stack,p.notes,p.tags,profile?.domain,profile?.subcategory,profile?.summary,...(profile?.scenes||[])].join(' ').toLowerCase().includes(q);
 });
 const list=matches.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt-a.updatedAt),host=$('#projectCards');if(!host)return;
 $('#projectCount').textContent=list.length+' / '+projects.length+' 个项目';
 const groups=[{key:'mine',title:'我的开发',desc:'自己开发或维护的应用与仓库',items:list.filter(p=>projectSource(p)==='mine')},{key:'external',title:'外部收录',desc:'来自公开网络、Skill 搜索与 AI 简报的资源',items:list.filter(p=>projectSource(p)==='external')},{key:'other',title:'其他 / 待归类',desc:'暂时无法识别来源的项目',items:list.filter(p=>projectSource(p)==='other')}].filter(g=>g.items.length);
 const cards=p=>{
  const src=projectSource(p),externalSkill=isExternalSkillProject(p),ownSkill=isOwnSkillProject(p),skillProject=externalSkill||ownSkill,profile=skillProject?skillProfile(p):null,m=skillMetaLines(p);
  const sourceBadge=src==='mine'?'<span class="source-badge source-mine">我的开发</span>':src==='external'?'<span class="source-badge source-external">外部收录</span>':'<span class="source-badge">待归类</span>';
  const catBadge=profile?'<span class="source-badge source-category">'+esc(profile.domain)+' · '+esc(profile.subcategory)+'</span>':'';
  const purpose=profile?'<div class="skill-profile"><p>'+esc(profile.summary)+'</p><small>场景：'+esc((profile.scenes||[]).slice(0,3).join(' · '))+'　·　归纳置信度：'+esc(profile.confidence)+'</small><small>依据：'+esc((profile.evidence||[]).join('、')||'仅名称')+'</small></div>':'';
  const heatPanel=externalSkill&&(m.heat||m.stars||m.rank)?'<div class="skill-insights"><strong>GitHub Skill 热度</strong>'+(m.rank?'<p>'+esc(m.rank)+'</p>':'')+(m.stars?'<p>'+esc(m.stars)+'</p>':'')+(m.heat?'<p>'+esc(m.heat)+'</p>':'')+(m.updated?'<p>'+esc(m.updated)+'</p>':'')+'</div>':'';
  const note=p.notes&&!externalSkill?'<p class="project-note">'+esc(p.notes.length>260?p.notes.slice(0,260)+'…':p.notes)+'</p>':'';
  return '<article class="card project-card" data-project-id="'+esc(p.id)+'"><div class="cardtop"><div class="provider-icon">'+(p.repoUrl?'GH':'APP')+'</div><div class="cardtitle"><h3>'+esc(p.name)+(p.favorite?' ★':'')+'</h3><p>'+esc(p.category||'其他')+(p.stack?' · '+esc(p.stack):'')+'</p><div class="source-badges">'+sourceBadge+catBadge+'</div></div><button class="dots" data-project-action="menu" aria-label="项目操作">⋯</button></div><div class="project-links">'+(p.repoUrl?'<a class="btn" href="'+esc(p.repoUrl)+'" target="_blank" rel="noopener noreferrer">↗ GitHub 仓库</a>':'')+(p.appUrl?'<a class="btn primary" href="'+esc(p.appUrl)+'" target="_blank" rel="noopener noreferrer">↗ 打开应用</a>':'')+'</div>'+purpose+note+heatPanel+(p.tags?'<div class="tags">'+p.tags.split(',').map(t=>t.trim()).filter(Boolean).slice(0,6).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div>':'')+'<div class="cardactions"><button class="btn primary" data-project-action="edit">编辑项目</button><button class="btn" data-project-action="favorite">'+(p.favorite?'取消收藏':'收藏')+'</button><button class="btn danger" data-project-action="delete">删除</button></div></article>';
 };
 const skillItems=list.filter(p=>isExternalSkillProject(p)||isOwnSkillProject(p)),counts=Object.keys(KP_SKILL_TAXONOMY).map(k=>({name:k,count:skillItems.filter(p=>skillProfile(p).domain===k).length})).filter(x=>x.count);
 const explorer='<section class="skill-explorer"><div class="skill-explorer-head"><div><h3>Skill 智能分类</h3><p>按能力领域与实际使用场景查阅；分类由仓库元数据规则归纳，可在编辑时人工校正。</p></div><span>'+skillItems.length+' 个 Skill</span></div><div class="skill-domain-grid">'+counts.map(x=>'<button class="skill-domain-chip '+(categoryFilter===x.name?'active':'')+'" data-skill-domain="'+esc(x.name)+'"><strong>'+esc(x.name)+'</strong><small>'+x.count+' 个</small></button>').join('')+'</div><div class="skill-scenes">'+['构建 AI Agent','自动化重复工作','开发 Web 应用','设计产品界面','制作视觉内容','分析业务数据','搭建知识库','开展专题研究','撰写内容','管理项目','部署与运维'].map(x=>'<button class="skill-scene-chip '+(sceneFilter===x?'active':'')+'" data-skill-scene="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div></section>';
 host.innerHTML=(explorer)+(groups.length?groups.map(g=>'<section class="project-group project-group-'+g.key+'"><div class="project-group-head"><div><h3>'+g.title+'</h3><p>'+g.desc+'</p></div><span>'+g.items.length+'</span></div><div class="cards">'+g.items.map(cards).join('')+'</div></section>').join(''):'<div class="empty"><div class="big">⌘</div><h3>'+(projects.length?'没有匹配的项目':'还没有收录项目')+'</h3><p>可尝试更换来源或分类筛选，也可以收录新的应用和 Skill。</p><button class="btn primary" data-project-action="add">＋ 收录项目</button></div>');
}

window.renderProjects = renderProjects;
window.__kpProjectRendererReady = true;window.__kpSkillIntelligenceVersion=1;
$('#projectCards')?.addEventListener('click',async e=>{
 const domain=e.target.closest('[data-skill-domain]');if(domain){$('#projectCategoryFilter').value=domain.dataset.skillDomain;$('#projectSceneFilter').value='all';window.renderProjects();return;}const scene=e.target.closest('[data-skill-scene]');if(scene){$('#projectSceneFilter').value=scene.dataset.skillScene;$('#projectCategoryFilter').value='all';window.renderProjects();return;}
 const b=e.target.closest('[data-project-action]');if(!b)return;
 const action=b.dataset.projectAction,card=b.closest('[data-project-id]'),id=card?.dataset.projectId;
 if(action==='add'){openProjectEditor();return;}
 const p=projects.find(x=>x.id===id);if(!p)return;
 if(action==='favorite'){
  p.favorite=!p.favorite;
  try{await persistProject(p);window.renderProjects();showToast(p.favorite?'已收藏项目':'已取消收藏');}
  catch(err){showToast('保存失败：'+err.message);}
  return;
 }
 if(action==='delete'){
  if(!confirm('确定将「'+p.name+'」移入回收站？可在 30 天内恢复。'))return;
  try{await softDeleteProject(p);projects=projects.filter(x=>x.id!==id);window.renderProjects();showToast('已移入回收站');}
  catch(err){showToast('删除失败：'+err.message);}
  return;
 }
 if(action==='menu'||action==='edit')openProjectEditor(p);
});
function openProjectEditor(project=null){
 const p=project||null;
 openModal('<h2>'+(p?'编辑项目':'收录项目')+'</h2><p class="sub">项目信息将在本地使用当前 KeyPocket 加密密钥保存。</p><form id="projectEditForm"><div class="field"><label for="projectNameInput">项目名称</label><input id="projectNameInput" maxlength="100" required value="'+esc(p?.name||'')+'"></div><div class="field"><label for="projectRepoInput">GitHub 仓库 URL</label><input id="projectRepoInput" maxlength="500" type="url" placeholder="https://github.com/owner/repo" value="'+esc(p?.repoUrl||'')+'"></div><div class="field"><label for="projectAppInput">应用地址</label><input id="projectAppInput" maxlength="500" type="url" placeholder="https://..." value="'+esc(p?.appUrl||'')+'"></div><div class="grid2"><div class="field"><label for="projectCategoryInput">分类</label><input id="projectCategoryInput" maxlength="50" value="'+esc(p?.category||'Web 应用')+'"></div><div class="field"><label for="projectStackInput">技术栈</label><input id="projectStackInput" maxlength="160" value="'+esc(p?.stack||'')+'"></div></div><div class="field"><label for="projectTagsInput">标签（逗号分隔）</label><input id="projectTagsInput" maxlength="200" value="'+esc(p?.tags||'')+'"></div><div class="field"><label for="projectNotesInput">备注</label><textarea id="projectNotesInput" maxlength="500">'+esc(p?.notes||'')+'</textarea></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">加密保存</button></div></form>');
 $('#projectEditForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  try{
   const now=kpNow(),item=normalizeProject({id:p?.id||crypto.randomUUID(),name:$('#projectNameInput').value,repoUrl:$('#projectRepoInput').value.trim(),appUrl:$('#projectAppInput').value.trim(),category:$('#projectCategoryInput').value,stack:$('#projectStackInput').value,tags:$('#projectTagsInput').value,notes:$('#projectNotesInput').value,favorite:p?.favorite===true,createdAt:p?.createdAt||now,updatedAt:now});
   await persistProject(item);projects=projects.filter(x=>x.id!==item.id);projects.push(item);closeModal();window.renderProjects();showToast(p?'项目已更新':'项目已加密收录');
  }catch(err){const n=$('#modalRoot .modal');if(n){const msg=document.createElement('div');msg.className='notice error';msg.textContent='保存失败：'+(err.message||'请重试');n.prepend(msg);}}
 });
}
function setModule(name){
 const views={keys:'#keysView',projects:'#projectView',radar:'#radarView',recycle:'#recycleView',backup:'#backupView',sync:'#syncView',github:'#githubView'};
 Object.entries(views).forEach(([key,selector])=>{const n=$(selector);if(n)n.classList.toggle('hidden',key!==name);});
 document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===name));
 if(name==='projects'){window.renderProjects();scanOwnGithubRepos({automatic:true});}
 if(name==='recycle')renderRecycleBin();
 if(name==='backup')renderBackupCenter();
 if(name==='radar')renderSkillRadar();
 if(name==='sync')renderSyncCenter();
 if(name==='github')renderGithubCenter();
}
document.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>setModule(b.dataset.module)));
function githubCategory(repo){const s=((repo.name||'')+' '+(repo.description||'')+' '+(repo.language||'')+' '+(repo.topics||[]).join(' ')).toLowerCase();if(/ai|llm|gpt|agent|model|prompt|deepseek/.test(s))return 'AI 工具';if(/portfolio|personal site|个人网站|homepage/.test(s))return '个人网站';if(/mini.?program|小程序|wechat/.test(s))return '小程序';if(/dashboard|看板|analytics|chart/.test(s))return 'Web 应用';return 'Web 应用';}
const KP_GITHUB_OWNER='chenzhe223-tech',KP_REPO_SCAN_KEY='kp.repo-scan.last.v1';
let kpRepoScanPromise=null;
function kpRepoScanStatus(message,type='info'){
 const el=$('#githubAutoScanStatus');if(!el)return;
 el.className='notice '+type;el.textContent=message;
}
function kpIsSkillRepo(repo){
 const text=[repo.name,repo.description,...(repo.topics||[])].filter(Boolean).join(' ').toLowerCase();
 return /(^|[^a-z])skills?([^a-z]|$)|agent[-_ ]skills?|claude[-_ ]skills?|codex[-_ ]skills?|skill\.md|cursor[-_ ]rules?/i.test(text);
}
async function scanOwnGithubRepos(options={}){
 const automatic=options.automatic===true;
 if(!cryptoKey){kpRepoScanStatus('请先解锁 KeyPocket，再扫描 GitHub 仓库。','error');return;}
 if(automatic){
  const last=Number(localStorage.getItem(KP_REPO_SCAN_KEY))||0;
  if(last&&Date.now()-last<24*60*60*1000){
   kpRepoScanStatus('上次自动扫描：'+new Date(last).toLocaleString()+'。每 24 小时自动扫描一次；也可点击「扫描我的仓库」立即刷新。','info');
   return;
  }
 }
 if(kpRepoScanPromise)return kpRepoScanPromise;
 kpRepoScanPromise=(async()=>{
  const button=$('#scanOwnReposBtn');if(button){button.disabled=true;button.textContent='扫描中…';}
  kpRepoScanStatus('正在扫描 '+KP_GITHUB_OWNER+' 的公开仓库…','info');
  try{
   const repos=[];let truncated=false;
   for(let page=1;page<=10;page++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;
    try{
     response=await fetch('https://api.github.com/users/'+encodeURIComponent(KP_GITHUB_OWNER)+'/repos?type=owner&sort=created&direction=desc&per_page=100&page='+page,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:controller.signal});
    }catch(error){if(error.name==='AbortError')throw Error('GitHub 仓库扫描超时，请稍后重试。');throw error;}
    finally{clearTimeout(timer);}
    if(!response.ok){
     if(response.status===403)throw Error('GitHub API 访问频率受限（HTTP 403），请稍后再扫描。');
     throw Error('GitHub 仓库扫描失败（HTTP '+response.status+'）。');
    }
    const batch=await response.json();if(!Array.isArray(batch))throw Error('GitHub 返回的数据格式异常。');
    repos.push(...batch);
    if(batch.length<100)break;
    if(page===10)truncated=true;
   }
   const owned=repos.filter(r=>r&&r.owner?.login?.toLowerCase()===KP_GITHUB_OWNER&&!r.private&&!r.fork&&!r.archived&&!r.disabled&&r.html_url);
   const known=new Set(projects.map(p=>canonicalSkillRepoUrl(p.repoUrl)).filter(Boolean).map(x=>x.toLowerCase()));
   let added=0,skills=0,apps=0,skipped=0;
   for(const r of owned){
    const repoUrl=canonicalSkillRepoUrl(r.html_url);if(!repoUrl)continue;
    const canonical=repoUrl.toLowerCase();if(known.has(canonical)){skipped++;continue;}
    const isSkill=kpIsSkillRepo(r),now=Date.now(),topics=Array.isArray(r.topics)?r.topics:[];
    const tags=[...(isSkill?['Skill']:[]),'GitHub 自动扫描',...topics.slice(0,4)].filter(Boolean).join(', ').slice(0,200);
    const noteParts=[r.description||'GitHub 公开仓库，已由 KeyPocket 自动发现。','来源：GitHub 自动扫描（公开仓库）',isSkill?'项目类型：AI Skill':'项目类型：应用 / 开发项目'];
    const item=normalizeProject({
     id:crypto.randomUUID(),name:(r.name||repoTitle(repoUrl)||'GitHub 项目')+(isSkill?' · Skill':''),
     repoUrl,appUrl:r.homepage&&validWebUrl(r.homepage)?r.homepage:'',
     category:isSkill?'AI Skill':githubCategory(r),
     stack:[r.language,...topics.slice(0,4)].filter(Boolean).join(', ').slice(0,160),
     notes:noteParts.join('\n').slice(0,500),tags,favorite:false,createdAt:now,updatedAt:now
    });
    await persistProject(item);projects.push(item);known.add(canonical);added++;if(isSkill)skills++;else apps++;
   }
   localStorage.setItem(KP_REPO_SCAN_KEY,String(Date.now()));
   window.renderProjects();
   const suffix=truncated?'；仓库数量超过本次扫描上限，后续可再次扫描':''; 
   kpRepoScanStatus('扫描完成：检查 '+owned.length+' 个公开原创仓库，新增 '+added+' 个（Skill '+skills+' 个、应用/项目 '+apps+' 个），已收录 '+skipped+' 个未重复导入。'+suffix+' 私有仓库需待 GitHub App 授权后接入。','ok');
   return {scanned:owned.length,added,skills,apps,skipped,truncated};
  }catch(error){
   kpRepoScanStatus('扫描未完成：'+(error.message||'请检查网络后重试。'),'error');
   return null;
  }finally{
   if(button){button.disabled=false;button.textContent='↻ 扫描我的仓库';}
  }
 })();
 try{return await kpRepoScanPromise;}finally{kpRepoScanPromise=null;}
}
$('#scanOwnReposBtn')?.addEventListener('click',()=>scanOwnGithubRepos({automatic:false}));

function githubImportModal(){openModal('<h2>从 GitHub 导入公开仓库</h2><p class="sub">无需 Token。KeyPocket 只读取公开仓库元数据，不读取仓库代码或私有文件。</p><div class="field"><label for="githubOwner">GitHub 用户名或组织</label><input id="githubOwner" maxlength="100" value="chenzhe223-tech" placeholder="GitHub 用户名"></div><div class="field"><label for="githubRepoSearch">筛选仓库</label><input id="githubRepoSearch" maxlength="100" placeholder="搜索仓库名称、描述或语言…"></div><div id="githubImportStatus" class="notice info">点击加载公开仓库。</div><div id="githubRepoList" class="github-repo-list"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button id="githubLoadBtn" type="button" class="btn">加载仓库</button><button id="githubImportSelectedBtn" type="button" class="btn primary" disabled>导入所选（0）</button></div>');
const status=$('#githubImportStatus'),list=$('#githubRepoList'),load=$('#githubLoadBtn'),submit=$('#githubImportSelectedBtn');let loaded=[];
function paint(){const q=$('#githubRepoSearch').value.trim().toLowerCase(),visible=loaded.filter(r=>(r.name+' '+(r.description||'')+' '+(r.language||'')).toLowerCase().includes(q));list.innerHTML=visible.length?visible.map(r=>'<label class="github-repo-row"><input type="checkbox" data-github-repo="'+esc(r.full_name)+'"><span class="github-repo-meta"><strong>'+esc(r.name)+'</strong><small>'+esc(r.description||'暂无描述')+'</small><small>'+esc(r.language||'未标注语言')+' · '+esc(r.updated_at?.slice(0,10)||'')+'</small></span><a href="'+esc(r.html_url)+'" target="_blank" rel="noopener noreferrer">查看 ↗</a></label>').join(''):'<div class="notice">没有匹配的公开仓库。</div>';function update(){const n=list.querySelectorAll('input[type=checkbox]:checked').length;submit.textContent='导入所选（'+n+'）';submit.disabled=n===0;}list.querySelectorAll('input[type=checkbox]').forEach(c=>c.addEventListener('change',update));update();}
load.addEventListener('click',async()=>{const owner=$('#githubOwner').value.trim();if(!/^[a-zA-Z0-9-]{1,100}$/.test(owner)){status.textContent='请输入有效的 GitHub 用户名或组织名。';status.className='notice error';return;}load.disabled=true;status.textContent='正在加载公开仓库…';status.className='notice info';try{const response=await fetch('https://api.github.com/users/'+encodeURIComponent(owner)+'/repos?per_page=100&sort=updated&type=owner',{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!response.ok)throw Error(response.status===404?'未找到该用户或组织。':'GitHub API 请求失败（HTTP '+response.status+'）。');const data=await response.json();loaded=data.filter(r=>!r.private&&r.html_url&&r.full_name);status.textContent='找到 '+loaded.length+' 个公开仓库。选择要导入的项目。';status.className='notice ok';paint();}catch(e){status.textContent=e.message||'加载失败，请稍后重试。';status.className='notice error';}finally{load.disabled=false;}});
$('#githubRepoSearch').addEventListener('input',paint);
submit.addEventListener('click',async()=>{const selectedNames=[...list.querySelectorAll('input[type=checkbox]:checked')].map(c=>c.dataset.githubRepo),selected=loaded.filter(r=>selectedNames.includes(r.full_name));submit.disabled=true;let added=0,skipped=0;try{for(const r of selected){const normalized=r.html_url.replace(/\.git$/,'').replace(/\/$/,'').toLowerCase();if(projects.some(p=>p.repoUrl.replace(/\.git$/,'').replace(/\/$/,'').toLowerCase()===normalized)){skipped++;continue;}const now=Date.now(),p=normalizeProject({id:crypto.randomUUID(),name:r.name,repoUrl:r.html_url,appUrl:r.homepage&&validWebUrl(r.homepage)?r.homepage:'',category:githubCategory(r),stack:[r.language,...(r.topics||[]).slice(0,4)].filter(Boolean).join(', ').slice(0,160),notes:r.description||'',tags:suggestedProjectTags(r).join(', '),favorite:false,createdAt:now,updatedAt:now});await persistProject(p);projects.push(p);added++;}closeModal();window.renderProjects();showToast('导入 '+added+' 个项目'+(skipped?'，跳过重复 '+skipped+' 个':''));}catch(e){status.textContent='已导入 '+added+' 个；保存中断：'+(e.message||'未知错误');status.className='notice error';submit.disabled=false;}});}
$('#importGithubBtn')?.addEventListener('click',githubImportModal);

/* Skill discovery: public GitHub repository metadata only; no token or private repo access. */
function skillUseCase(repo){
 const s=((repo.name||'')+' '+(repo.description||'')+' '+(repo.language||'')+' '+(repo.topics||[]).join(' ')).toLowerCase();
 if(/agent|mcp|tool.?use|workflow/.test(s))return '适合构建 AI Agent、工具调用与自动化工作流；可先在低风险任务中试用。';
 if(/prompt|writing|content|copywriting|公众号|写作/.test(s))return '适合内容创作、提示词模板和文案工作流；建议先用真实任务验证输出稳定性。';
 if(/frontend|ui|ux|design|css|figma|component/.test(s))return '适合 UI/UX 设计、前端实现与组件规范；建议结合现有设计系统评估兼容性。';
 if(/data|analytics|sql|database|dashboard/.test(s))return '适合数据分析、查询、报表或看板生成；使用前检查数据权限与输出准确性。';
 if(/test|qa|playwright|browser|debug/.test(s))return '适合软件测试、浏览器自动化和缺陷排查；建议先在测试环境运行。';
 if(/security|audit|scan/.test(s))return '适合安全审查或风险检查；不要将生产密钥交给未经审查的脚本。';
 if(/image|video|audio|music|media/.test(s))return '适合多媒体内容处理或生成；重点评估模型依赖、成本和素材授权。';
 return '先阅读 README、安装要求与权限范围，再用一个明确的小任务试用，确认效果后再纳入常规工作流。';
}
function skillPurpose(repo){return (repo.description||'暂无项目描述。')+'\n主要作用：'+((repo.topics||[]).slice(0,5).join('、')||'以仓库 README 为准')+'。\n应用建议：'+skillUseCase(repo);}
function skillHeat(repo,rank=0,total=0){
 const stars=Number(repo.stargazers_count)||0,forks=Number(repo.forks_count)||0,updated=Date.parse(repo.pushed_at||repo.updated_at||'')||0,ageDays=updated?Math.max(0,(Date.now()-updated)/86400000):9999;
 const level=stars>=5000?'高热度':stars>=1000?'较高热度':stars>=200?'有一定关注':stars>=30?'小众关注':'关注度较低';
 const freshness=ageDays<30?'近期活跃':ageDays<180?'半年内有更新':'近期更新较少';
 return {stars,forks,level,freshness,ageDays:Math.round(ageDays),rank,total,percentile:rank&&total?Math.round((total-rank+1)/total*100):null};
}
function githubRepoPath(url){try{const u=new URL(url);if(u.hostname.toLowerCase()!=='github.com')return null;const p=u.pathname.split('/').filter(Boolean);if(p.length<2)return null;return {owner:p[0],repo:p[1].replace(/\.git$/,'')};}catch{return null;}}
function suggestedProjectTags(repo){
 const pool=[...(repo.topics||[]),repo.language,repo.homepage?'已上线':'待部署',githubCategory(repo),'GitHub','Skill'];
 const out=[];for(const x of pool){const t=String(x||'').trim().replace(/-/g,' ');if(t&&!out.some(y=>y.toLowerCase()===t.toLowerCase()))out.push(t);if(out.length===6)break;}
 while(out.length<6){const t=['开源项目','效率工具','持续维护','待评估','个人项目','AI 工具'][out.length];if(!out.includes(t))out.push(t);}
 return out.slice(0,6);
}
async function fetchGithubRepoMeta(url,timeoutMs=8000){
 const path=githubRepoPath(url);if(!path)throw Error('请输入有效的 github.com/owner/repo 仓库地址。');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 let response;try{response=await fetch('https://api.github.com/repos/'+encodeURIComponent(path.owner)+'/'+encodeURIComponent(path.repo),{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:controller.signal});}catch(err){if(err.name==='AbortError')throw Error('GitHub 请求超时，请稍后重试。');throw err;}finally{clearTimeout(timer);}
 if(!response.ok)throw Error(response.status===404?'未找到公开仓库，请检查地址。':response.status===403?'GitHub API 请求频率受限，请稍后重试。':'GitHub 仓库信息读取失败（HTTP '+response.status+'）。');
 return response.json();
}
function normalizeSkillQuery(q){
 return String(q||'').trim().toLowerCase().replace(/[\s_-]+/g,' ').replace(/\bskills?\b/g,'').trim();
}
function skillQueryPlans(q){
 const n=normalizeSkillQuery(q), raw=String(q||'').trim();
 const plans=[];
 const add=x=>{if(x&&!plans.includes(x))plans.push(x);};
 if(/^(playwright|playwright skill|playwright skills)$/i.test(raw)){
  add('"playwright" "skill"');add('playwright skill');add('playwright agent skill');
 }else if(/^(lemo ?opuscar|lemo opuscar|lemomo ai lemo opuscar)$/i.test(raw)){
  add('lemomo-ai/lemo-opuscar');add('"lemo-opuscar"');add('"lemo opuscar"');
 }else if(/^(all design|all design skill|all design skills)$/i.test(raw)){
  add('"all design" skill');add('ui ux pro max skill');add('"design skill"');
 }else{
  add('"'+raw.replace(/"/g,'')+'" skill');add(raw+' skill');add(n);
 }
 return plans.slice(0,3);
}
function scoreSkillResult(r,q){
 const query=normalizeSkillQuery(q),full=String(r.full_name||'').toLowerCase(),name=String(r.name||'').toLowerCase();
 const desc=String(r.description||'').toLowerCase(),topics=(r.topics||[]).join(' ').toLowerCase();
 let score=0;
 const tokens=query.split(' ').filter(Boolean);
 if(tokens.length&&tokens.every(t=>name.includes(t)))score+=100;
 if(tokens.length&&tokens.every(t=>full.includes(t)))score+=90;
 if(query&&name===query.replace(/\s+/g,'-'))score+=180;
 if(query&&full.endsWith('/'+query.replace(/\s+/g,'-')))score+=220;
 if(tokens.some(t=>desc.includes(t)))score+=20;
 if(tokens.some(t=>topics.includes(t)))score+=15;
 if(/skill|agent|mcp|playwright|design/i.test([name,desc,topics].join(' ')))score+=8;
 if(r.fork)score-=15;
 score+=Math.min(Number(r.stargazers_count)||0,10000)/10000;
 return score;
}
function isClearlyRelevantSkill(r,q){
 const query=normalizeSkillQuery(q),full=String(r.full_name||'').toLowerCase(),name=String(r.name||'').toLowerCase(),desc=String(r.description||'').toLowerCase(),topics=(r.topics||[]).join(' ').toLowerCase();
 if(/lemo ?opuscar/i.test(q))return /lemo-opuscar/.test(full+' '+name)||/lemomo-ai\/lemo-opuscar/i.test(full);
 if(/^all design/i.test(query))return /all.?design|ui.?ux.?pro.?max|design.?skill/.test(full+' '+name+' '+desc+' '+topics);
 if(/^playwright/i.test(query))return /playwright/.test(full+' '+name+' '+desc+' '+topics)&&(/skill|agent|mcp|automation|test/i.test(full+' '+name+' '+desc+' '+topics)||/playwright/.test(name));
 const tokens=query.split(' ').filter(Boolean);
 return tokens.length>0&&tokens.some(t=>(full+' '+name+' '+desc+' '+topics).includes(t));
}
function skillResultHtml(r,i,items,q,exactMatch=false){
 const h=skillHeat(r,i+1,items.length),repo=canonicalSkillRepoUrl(r.html_url);
 const existing=projects.some(p=>canonicalSkillRepoUrl(p.repoUrl)===repo);
 const description=String(r.description||'暂无描述').replace(/\\s+/g,' ').slice(0,220);
 const owner=String(r.owner?.login||r.full_name.split('/')[0]||'');
 const nativeHint=exactMatch?'用户指定的 GitHub 仓库 · 精确匹配':(/microsoft|playwright|lemomo-ai|nextlevelbuilder/i.test(owner+' '+r.full_name)?'优先关注的上游/原作者候选':'第三方候选，请核对作者与 README');
 return '<article class="github-repo-row" style="align-items:flex-start"><span class="github-repo-meta"><strong>'+esc(r.full_name)+'</strong><small>'+esc(description)+(String(r.description||'').length>220?'…':'')+'</small><small>'+esc(nativeHint)+' · ★ '+h.stars.toLocaleString()+' · Fork '+h.forks.toLocaleString()+'</small><small>'+(exactMatch?'按指定仓库地址精确匹配；不是关键词搜索结果。':'本次关键词相关度排序 #'+(i+1)+'/'+items.length+'；不是全网安装量排名')+'</small><small>建议方向：'+esc(skillUseCase(r))+'</small><small>最近更新：'+esc((r.pushed_at||r.updated_at||'').slice(0,10))+' · '+esc(r.language||'未标注语言')+'</small><span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><a href="'+esc(repo||r.html_url)+'" target="_blank" rel="noopener noreferrer">查看仓库 ↗</a><button class="btn primary" type="button" data-save-skill="'+i+'" '+(existing?'disabled':'')+'>'+(existing?'已收录':'收录 Skill')+'</button></span></span></article>';
}
function skillImportModal(){
 openModal('<h2>按 Skill 名称导入</h2><p class="sub">优先精确匹配仓库名和原作者候选，再展示相关项目。结果按关键词相关度排序，热度仅作参考。</p><form id="skillSearchForm"><div class="field"><label for="skillNameInput">Skill 名称 / 关键词</label><input id="skillNameInput" required maxlength="120" placeholder="例如：playwright、lemo opuscar、all design"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">搜索 Skills</button></div></form><div id="skillSearchStatus" class="notice info">输入完整 GitHub 仓库地址时，将直接精确读取该仓库；名称或关键词则执行相关搜索。</div><div id="skillSearchResults" class="github-repo-list"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">关闭导入窗口</button></div>');
 const form=$('#skillSearchForm'),status=$('#skillSearchStatus'),results=$('#skillSearchResults');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const q=$('#skillNameInput').value.trim();if(!q)return;
  if(kpSkillSearchController)kpSkillSearchController.abort();
  const sequence=++kpSkillSearchSequence,controller=new AbortController();
  kpSkillSearchController=controller;
  let timedOut=false,searchingButton=form.querySelector('button[type=submit]');
  status.className='notice info';status.textContent='正在搜索 GitHub 公开仓库…';results.innerHTML='';
  searchingButton.disabled=true;
  try{
   const exactRepo=canonicalSkillRepoUrl(q);
   let items=[],exactMatch=false;
   if(exactRepo){
    const meta=await fetchGithubRepoMeta(exactRepo,12000);
    if(sequence!==kpSkillSearchSequence)return;
    if(meta.private||meta.disabled)throw Error('指定仓库当前不可公开读取，未收录。');
    if(canonicalSkillRepoUrl(meta.html_url).toLowerCase()!==exactRepo.toLowerCase())throw Error('GitHub 返回的仓库地址与输入地址不一致，已停止收录。');
    items=[meta];exactMatch=true;
   }else{
    const plans=skillQueryPlans(q),merged=new Map();
    for(const plan of plans){
     if(sequence!==kpSkillSearchSequence)return;
     const url='https://api.github.com/search/repositories?q='+encodeURIComponent(plan)+'&sort=stars&order=desc&per_page=15';
     const timer=setTimeout(()=>{timedOut=true;controller.abort();},12000);
     let response;
     try{response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});}
     finally{clearTimeout(timer);}
     if(sequence!==kpSkillSearchSequence)return;
     if(!response.ok){
      if(response.status===403)throw Error('GitHub API 搜索次数已达限制，请稍后再试。');
      if(response.status===422)continue;
      throw Error('GitHub 搜索失败（HTTP '+response.status+'）。');
     }
     const data=await response.json();
     for(const r of (data.items||[])){
      if(!r||r.private||!r.html_url||!canonicalSkillRepoUrl(r.html_url))continue;
      const key=canonicalSkillRepoUrl(r.html_url);if(!merged.has(key))merged.set(key,r);
     }
    }
    if(sequence!==kpSkillSearchSequence)return;
    items=[...merged.values()].filter(r=>isClearlyRelevantSkill(r,q));
    items.sort((a,b)=>scoreSkillResult(b,q)-scoreSkillResult(a,q)||Number(b.stargazers_count||0)-Number(a.stargazers_count||0));
    items=items.slice(0,10);
   }
   if(!items.length){status.className='notice';status.textContent='没有找到足够相关的公开仓库。试试官方仓库名、作者名或更准确的英文关键词。';return;}
   status.className='notice ok';status.textContent=exactMatch?'已精确读取你指定的 GitHub 仓库。请核对作者与 README 后收录。':'找到 '+items.length+' 个相关候选，已按名称和关键词相关度排序。请优先核对上游作者与仓库内容。';
   results.innerHTML=items.map((r,i)=>skillResultHtml(r,i,items,q,exactMatch)).join('');
   results.querySelectorAll('[data-save-skill]').forEach(b=>b.addEventListener('click',async()=>{
    const r=items[Number(b.dataset.saveSkill)];if(!r||b.disabled)return;
    const repo=canonicalSkillRepoUrl(r.html_url);
    if(!repo){status.className='notice error';status.textContent='仓库地址校验失败，未收录。';return;}
    const existing=projects.find(p=>canonicalSkillRepoUrl(p.repoUrl)===repo);
    if(existing){b.disabled=true;b.textContent='已收录';status.className='notice';status.textContent='该仓库已存在于你的项目清单中。';return;}
    b.disabled=true;const original=b.textContent;b.textContent='正在保存…';
    try{
     const h=skillHeat(r,Number(b.dataset.saveSkill)+1,items.length),now=Date.now();
     const p=normalizeProject({id:crypto.randomUUID(),name:r.name+' · Skill',repoUrl:repo,appUrl:r.homepage&&validWebUrl(r.homepage)?r.homepage:'',category:githubCategory(r),stack:r.language||'',notes:'主要作用：'+skillPurpose(r)+'\n应用建议：'+skillUseCase(r)+'\n关键词：'+q+'\nGitHub Stars：'+h.stars+'；Forks：'+h.forks+'。\n热度：'+h.level+'；'+h.freshness+'。\n热度采集时间：'+new Date().toISOString(),tags:['Skill',...suggestedProjectTags(r).filter(t=>t.toLowerCase()!=='skill')].slice(0,6).join(', '),favorite:true,createdAt:now,updatedAt:now});
     await persistProject(p);projects.push(p);window.renderProjects();closeModal();showToast('Skill 已加密保存：'+r.full_name);
    }catch(err){b.disabled=false;b.textContent=original;status.className='notice error';status.textContent='收录失败：'+(err.message||'请重试');}
   }));
  }catch(err){
   if(sequence!==kpSkillSearchSequence)return;
   if(err.name==='AbortError'&&timedOut){status.className='notice error';status.textContent='GitHub 搜索响应超时（12 秒），请检查网络后重试。';}
   else if(err.name!=='AbortError'){status.className='notice error';status.textContent=err.message||'搜索失败，请稍后重试。';}
  }finally{
   if(sequence===kpSkillSearchSequence){searchingButton.disabled=false;kpSkillSearchController=null;}
  }
 });
}
async function refreshSavedSkillHeat(){
 const btn=$('#refreshSkillHeatBtn');if(!btn)return;
 const skills=projects.filter(p=>p.favorite&&isExternalSkillProject(p));
 if(!skills.length){showToast('暂未找到已收藏的外部 Skill 仓库');return;}
 btn.disabled=true;const label=btn.textContent;let updated=0,failed=0;
 try{
  const batch=skills.slice(0,8);
  for(let i=0;i<batch.length;i++){
   const p=batch[i];btn.textContent='刷新中 '+(i+1)+'/'+batch.length;
   try{
    const meta=await fetchGithubRepoMeta(p.repoUrl,7000),h=skillHeat(meta),now=new Date().toISOString();
    const old=String(p.notes||'').split('\n').filter(line=>!/^GitHub 排名：|^热度：|^热度采集时间：|^GitHub Stars：|^主要作用：|^应用建议：|^建议方向：/.test(line)).join('\n').trim();
    p.notes=(old?old+'\n':'')+'主要作用：'+skillPurpose(meta)+'\n应用建议：'+skillUseCase(meta)+'\nGitHub Stars：'+h.stars+'；Forks：'+h.forks+'。\n热度：'+h.level+'；'+h.freshness+'。\n热度采集时间：'+now+'。';
    if(meta.homepage&&validWebUrl(meta.homepage))p.appUrl=meta.homepage;
    p.category=githubCategory(meta);p.stack=[meta.language,...(meta.topics||[]).slice(0,4)].filter(Boolean).join(', ').slice(0,160);
    if(!p.tags.trim())p.tags=suggestedProjectTags(meta).join(', ');
    p.updatedAt=Date.now();await persistProject(p);updated++;
   }catch(err){failed++;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  window.renderProjects();showToast('已刷新 '+updated+' 个外部 Skill'+(failed?'；'+failed+' 个失败或超时':'')+(skills.length>batch.length?'；本次最多刷新 8 个':''));
 }finally{btn.disabled=false;btn.textContent=label;}
}
$('#refreshSkillHeatBtn')?.addEventListener('click',refreshSavedSkillHeat);
$('#importSkillBtn')?.addEventListener('click',skillImportModal);
$('#addProjectBtn')?.addEventListener('click',()=>openProjectEditor());

function canonicalSkillRepoUrl(value){
 try{
  const u=new URL(String(value||''));
  if(u.protocol!=='https:'||u.hostname.toLowerCase()!=='github.com'||u.username||u.password||u.port)return '';
  const parts=u.pathname.split('/').filter(Boolean);
  if(parts.length!==2||! /^[A-Za-z0-9_.-]{1,100}$/.test(parts[0])||! /^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]))return '';
  const repository=parts[1].replace(/\.git$/i,'');
  if(!repository)return '';
  return 'https://github.com/'+parts[0]+'/'+repository;
 }catch{return '';}
}
function readPendingRadarSkills(){
 let stage='start';
 try{
  const captureParam=new URLSearchParams(window.location.search).get('kp_capture');
  if(captureParam){
   stage='capture-parse';
   try{
    const incoming=JSON.parse(captureParam);
    const canonical=incoming&&canonicalSkillRepoUrl(incoming.url);
    window.__kpRadarCaptureDiagnostic={source:incoming?.source||null,idValid:typeof incoming?.id==='string'&&!!incoming.id.trim(),canonicalValid:!!canonical};
    if(incoming&&incoming.source==='davy-radar'&&canonical){
     const stored=window.localStorage.getItem(KEYPOCKET_PENDING_SKILL_KEY);
     const parsed=stored?JSON.parse(stored):[];
     const queue=Array.isArray(parsed)?parsed:[];
     if(!queue.some(x=>x&&x.id===incoming.id))queue.push(incoming);
     window.localStorage.setItem(KEYPOCKET_PENDING_SKILL_KEY,JSON.stringify(queue.slice(-100)));
    }
   }catch(e){window.__kpRadarCaptureDiagnostic={error:String(e?.name||'Error')+': '+String(e?.message||e)};console.warn('KeyPocket capture payload invalid',e)}
   stage='capture-clean-url';
   const cleanUrl=new URL(window.location.href);
   cleanUrl.searchParams.delete('kp_capture');
   window.history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
  }
  stage='read-queue';
  const raw=window.localStorage.getItem(KEYPOCKET_PENDING_SKILL_KEY);
  const parsed=raw?JSON.parse(raw):[];
  if(!Array.isArray(parsed)){window.__kpRadarQueueDiagnostic={stage,rawLength:raw?.length||0,parsedArray:false};return [];}
  stage='validate-queue';
  const result=parsed.slice(0,100).map(item=>{
   if(!item||typeof item!=='object'||item.source!=='davy-radar'||typeof item.id!=='string'||!item.id.trim()||item.id.length>180)return null;
   const url=canonicalSkillRepoUrl(item.url);
   if(!url)return null;
   const topicInput=Array.isArray(item.topics)?item.topics:(typeof item.topics==='string'?item.topics.split(/[·,]/):[]);
   const topics=topicInput.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean).slice(0,8).map(x=>x.slice(0,80));
   const date=/^\d{4}-\d{2}-\d{2}$/.test(String(item.reportDate||''))?String(item.reportDate):'';
   const stars=item.stars!==null&&item.stars!==undefined&&item.stars!==''?Number(item.stars):NaN;
   return {
    id:item.id,source:'davy-radar',createdAt:Number.isFinite(item.createdAt)?item.createdAt:Date.now(),
    reportDate:date,name:String(item.name||url.split('/').pop()).trim().slice(0,180),
    url,description:typeof item.description==='string'?item.description.slice(0,2400):'',
    topics,license:typeof item.license==='string'?item.license.slice(0,80):'',
    stars:Number.isFinite(stars)&&stars>=0?stars:null,
    language:typeof item.language==='string'?item.language.slice(0,80):'',
    updated:typeof item.updated==='string'?item.updated.slice(0,10):'',
    sourcePage:typeof item.sourcePage==='string'&&validWebUrl(item.sourcePage)?item.sourcePage.slice(0,500):''
   };
  }).filter(Boolean);
  window.__kpRadarQueueDiagnostic={stage,rawLength:raw?.length||0,sourceCount:parsed.length,validCount:result.length,sourceNames:parsed.slice(0,5).map(x=>String(x?.source||'')),capture:window.__kpRadarCaptureDiagnostic||null};
  return result;
 }catch(err){window.__kpRadarQueueDiagnostic={stage,error:String(err?.name||'Error')+': '+String(err?.message||err)};return [];}
}
function updateRadarImportButton(){
 const btn=$('#importRadarSkillsBtn');
 if(!btn)return;
 const count=readPendingRadarSkills().length;
 btn.textContent=count?'↧ 从 AI 简报收录（'+count+'）':'↧ 从 AI 简报收录';
 btn.title=count?'有 '+count+' 个 Skill 等待确认收录':'从每日 AI 简报收录公开 Skill';
 btn.setAttribute('aria-label',btn.title);
}
function writePendingRadarSkills(queue){
 window.localStorage.setItem(KEYPOCKET_PENDING_SKILL_KEY,JSON.stringify(queue.slice(0,100)));
 updateRadarImportButton();
}
function removePendingRadarSkill(id){
 const queue=readPendingRadarSkills().filter(item=>item.id!==id);
 writePendingRadarSkills(queue);
}
function openPendingRadarSkillModal(){
 window.__kpRadarModalDiagnostic='entered';
 if(!cryptoKey){window.__kpRadarModalDiagnostic='locked';showToast('请先解锁 KeyPocket，再收录 AI 简报中的 Skill。');return;}
 if($('#modalRoot').innerHTML.trim()){window.__kpRadarModalDiagnostic='modal-busy';return;}
 const queue=readPendingRadarSkills();
 updateRadarImportButton();
 if(!queue.length){window.__kpRadarModalDiagnostic='empty-queue';showToast('目前没有待收录的 Skill。请从 AI 前沿简报点击「一键收录到 KeyPocket」。');return;}
 const item=queue[0],repoUrl=canonicalSkillRepoUrl(item.url);
 if(!repoUrl){removePendingRadarSkill(item.id);showToast('发现无效的 GitHub 链接，已跳过该条目。');return;}
 const duplicate=projects.find(p=>canonicalSkillRepoUrl(p.repoUrl).toLowerCase()===repoUrl.toLowerCase());
 const queueLabel=queue.length>1?'<p class="sub">待处理队列共 '+queue.length+' 个 Skill；本次先处理第一条。</p>':'';
 if(duplicate){
  openModal('<h2>这个 Skill 已经收录</h2><p class="sub">KeyPocket 中已存在相同的 GitHub 仓库，不会重复创建记录。</p><div class="notice info"><strong>'+esc(duplicate.name)+'</strong><br>'+esc(repoUrl)+'</div>'+queueLabel+'<div class="modal-actions"><button type="button" class="btn" data-action="close">稍后处理</button><button type="button" class="btn primary" id="removeDuplicateRadarSkill">移出待处理队列</button></div>');
  $('#removeDuplicateRadarSkill').addEventListener('click',()=>{
   try{removePendingRadarSkill(item.id);closeModal();showToast('重复 Skill 已从待处理队列移除。');}
   catch(err){showToast('更新队列失败，请检查浏览器本地存储。');}
  });
  return;
 }
 const title=item.name||repoUrl.split('/').pop();
 const topics=item.topics.length?item.topics.join(' · '):'未提供';
 const stars=item.stars===null?'未提供':item.stars.toLocaleString('en-US');
 window.__kpRadarModalDiagnostic='before-render';
 openModal('<h2>收录 Skill 到 KeyPocket</h2><p class="sub">请核对公开仓库信息，再确认加入「我的应用与仓库」。资料会在本机加密保存；不会导入 API Key，也不会上传到服务器。</p><div class="notice info"><strong>'+esc(title)+'</strong><br><a href="'+esc(repoUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(repoUrl)+' ↗</a></div>'+queueLabel+'<div class="field"><label>项目简介</label><div class="project-note">'+esc(item.description||'原简报未提供项目简介。')+'</div></div><div class="field"><label>主题 / Topics</label><div class="project-note">'+esc(topics)+'</div></div><div class="grid2"><div class="field"><label>许可证</label><div class="project-note">'+esc(item.license||'请打开仓库核实')+'</div></div><div class="field"><label>简报记录的 Stars</label><div class="project-note">'+esc(stars)+'</div></div></div><div id="radarSkillImportNotice" class="notice info">即将收录仓库链接、简介、主题和来源日期。Stars 是简报采集时的记录，不代表安装量。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">稍后处理</button><button type="button" class="btn ghost" id="ignoreRadarSkillBtn">忽略此条</button><button type="button" class="btn primary" id="saveRadarSkillBtn">确认收录</button></div>');
 window.__kpRadarModalDiagnostic='rendered';
 $('#ignoreRadarSkillBtn').addEventListener('click',()=>{
  try{removePendingRadarSkill(item.id);closeModal();showToast('已忽略此 Skill；其他待处理项仍保留。');}
  catch(err){const n=$('#radarSkillImportNotice');n.textContent='更新队列失败，请检查浏览器本地存储。';n.className='notice error';}
 });
 $('#saveRadarSkillBtn').addEventListener('click',async()=>{
  const btn=$('#saveRadarSkillBtn'),notice=$('#radarSkillImportNotice');
  btn.disabled=true;btn.textContent='正在加密保存…';
  try{
   const duplicateNow=projects.find(p=>canonicalSkillRepoUrl(p.repoUrl).toLowerCase()===repoUrl.toLowerCase());
   if(!duplicateNow){
    const now=Date.now();
    const projectName=(title.length>90?title.slice(0,90):title)+' · Skill';
    const noteParts=[
     '来源：DAVYLAB AI 前沿简报'+(item.reportDate?'（'+item.reportDate+'）':''),
     item.license?'许可证：'+item.license:'',
     item.stars!==null?'推荐时 GitHub Stars：'+item.stars:'',
     item.updated?'简报记录的更新时间：'+item.updated:'',
     item.topics.length?'Topics：'+item.topics.join('、').slice(0,100):'',
     item.description?'简介：'+item.description.slice(0,200):'',
     item.sourcePage?'来源页面：'+item.sourcePage:''
    ].filter(Boolean);
    const project=normalizeProject({
     id:crypto.randomUUID(),name:projectName.slice(0,100),repoUrl,appUrl:'',
     category:'AI 工具',stack:[item.language,...item.topics.slice(0,4)].filter(Boolean).join(', ').slice(0,160),
     notes:noteParts.join('\n').slice(0,500),
     tags:['Skill','AI 前沿简报',item.license?'License '+item.license:''].filter(Boolean).join(', ').slice(0,200),
     favorite:true,createdAt:now,updatedAt:now
    });
    await persistProject(project);
    projects.push(project);
   }
   removePendingRadarSkill(item.id);
   closeModal();setModule('projects');window.renderProjects();updateRadarImportButton();
   showToast(duplicateNow?'该 Skill 已收录，已清理重复待办。':'Skill 已加密收录到 KeyPocket。');
  }catch(err){
   btn.disabled=false;btn.textContent='确认收录';
   if(notice){notice.textContent='收录失败：'+(err.message||'请重试。');notice.className='notice error';}
  }
 });
}
$('#importRadarSkillsBtn')?.addEventListener('click',openPendingRadarSkillModal);
window.addEventListener('storage',event=>{
 if(event.key!==KEYPOCKET_PENDING_SKILL_KEY)return;
 updateRadarImportButton();
 const pendingCount=readPendingRadarSkills().length;
 if(cryptoKey&&pendingCount&&!$('#modalRoot').innerHTML.trim())openPendingRadarSkillModal();
 if(!pendingCount&&$('#modalRoot').innerHTML.includes('saveRadarSkillBtn'))closeModal();
});
updateRadarImportButton();
$('#projectSearch')?.addEventListener('input',window.renderProjects);
$('#projectSourceFilter')?.addEventListener('change',window.renderProjects);
$('#projectCategoryFilter')?.addEventListener('change',window.renderProjects);$('#projectSceneFilter')?.addEventListener('change',window.renderProjects);


const KP_SUPABASE_URL='https://urzgghdwawpwqliafrzv.supabase.co';
const KP_SUPABASE_KEY='sb_publishable_p4opBpYH50PAThHBObr3aQ_Hw6cpF5o';
const KP_SESSION_KEY='kp.sync.session.v1';
function kpSyncStatus(message,isError=false){const n=$('#syncStatus');if(n){n.textContent=message;n.style.color=isError?'#b93636':'';}}
function kpSession(){try{return JSON.parse(localStorage.getItem(KP_SESSION_KEY)||'null')}catch{return null}}
function kpSetSession(s){if(s)localStorage.setItem(KP_SESSION_KEY,JSON.stringify(s));else{localStorage.removeItem(KP_SESSION_KEY);window.kpV2Passphrase=null;kpV2SyncKey=null;kpV2SyncSalt=null;}const logged=!!s?.access_token;$('#syncNowBtn').disabled=!logged;$('#syncSignOutBtn').disabled=!logged;$('#syncSignInBtn').disabled=logged;$('#syncSignUpBtn').disabled=logged;}
async function kpAuth(action,email,password){
 const res=await fetch(KP_SUPABASE_URL+'/auth/v1/'+action,{method:'POST',headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY},body:JSON.stringify({email,password})});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.msg||body.message||body.error_description||body.error||'账号认证失败');
 if(body.access_token)kpSetSession(body);
 return body;
}

let kpRecoveryAccessToken=null;
function kpRecoveryRedirectUrl(){return window.location.origin+window.location.pathname;}
async function kpRequestPasswordRecovery(email){
 const endpoint=KP_SUPABASE_URL+'/auth/v1/recover?redirect_to='+encodeURIComponent(kpRecoveryRedirectUrl());
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY},body:JSON.stringify({email})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.msg||body.message||body.error_description||body.error||'暂时无法提交密码找回请求，请稍后重试。');
 return body;
}
async function kpVerifyRecoveryTokenHash(tokenHash){
 const response=await fetch(KP_SUPABASE_URL+'/auth/v1/verify',{method:'POST',headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY},body:JSON.stringify({token_hash:tokenHash,type:'recovery'})});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.access_token)throw Error(body.msg||body.message||body.error_description||body.error||'恢复链接无效或已过期，请重新申请。');
 return body.access_token;
}
function kpShowPasswordRecovery(token){
 kpRecoveryAccessToken=token||null;
 $('#syncPasswordRecoveryPanel')?.classList.remove('hidden');
 $('#syncNewPassword')?.focus();
 kpSyncStatus(token?'已验证密码找回链接。请设置新的同步账号密码。':'恢复链接缺少有效授权，请重新申请密码找回。',!token);
}
async function kpHandlePasswordRecoveryRedirect(){
 const query=new URLSearchParams(window.location.search),hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
 const type=(hash.get('type')||query.get('type')||'').toLowerCase();
 let token=hash.get('access_token')||query.get('access_token');
 const tokenHash=query.get('token_hash')||hash.get('token_hash');
 window.__kpRecoveryDiagnostic={type,hasAccessToken:!!token,hasTokenHash:!!tokenHash,hasRecoveryIntent:type==='recovery'||!!tokenHash||!!token};
 if(type!=='recovery'&&!tokenHash&&!token)return;
 try{
  if(!token&&tokenHash)token=await kpVerifyRecoveryTokenHash(tokenHash);
  if(!token){kpShowPasswordRecovery(null);return;}
  window.__kpRecoveryDiagnostic.validated=true;
  kpShowPasswordRecovery(token);
 }catch(error){window.__kpRecoveryDiagnostic.error=String(error?.message||error);kpShowPasswordRecovery(null);kpSyncStatus('密码恢复链接验证失败：'+error.message,true);}
}
async function kpSubmitPasswordRecovery(){
 const button=$('#syncResetPasswordBtn'),password=$('#syncNewPassword').value,confirm=$('#syncConfirmNewPassword').value;
 if(!kpRecoveryAccessToken)throw Error('恢复授权已失效，请重新申请密码找回邮件。');
 if(password.length<10)throw Error('新密码至少需要 10 位。');
 if(password!==confirm)throw Error('两次输入的新密码不一致。');
 button.disabled=true;button.textContent='正在安全更新…';
 try{
  const response=await fetch(KP_SUPABASE_URL+'/auth/v1/user',{method:'PATCH',headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY,'Authorization':'Bearer '+kpRecoveryAccessToken},body:JSON.stringify({password})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.msg||body.message||body.error_description||body.error||'密码更新失败，请重新申请恢复链接。');
  kpRecoveryAccessToken=null;
  $('#syncPasswordRecoveryPanel')?.classList.add('hidden');
  $('#syncPassword').value='';$('#syncNewPassword').value='';$('#syncConfirmNewPassword').value='';
  window.history.replaceState(null,document.title,window.location.pathname);
  kpSyncStatus('同步账号密码已更新。请使用新密码登录；本地密钥库和跨设备加密口令均未更改。');
 }finally{button.disabled=false;button.textContent='确认重置密码';}
}
async function kpCloudRequest(method,payload){
 const s=kpSession();if(!s?.access_token)throw Error('请先登录同步账号。');
 const endpoint=KP_SUPABASE_URL+'/rest/v1/keypocket_vault_sync'+(method==='POST'?'?on_conflict=user_id':'?select=user_id,payload,schema_version,revision,updated_at');
 const res=await fetch(endpoint,{method,headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY,'Authorization':'Bearer '+s.access_token,'Prefer':method==='POST'?'resolution=merge-duplicates,return=minimal':'return=representation'},body:payload?JSON.stringify(payload):undefined});
 if(!res.ok){const b=await res.json().catch(()=>({}));throw Error(b.message||b.error||'云端请求失败（HTTP '+res.status+'）');}
 if(method==='GET')return res.json();
 return null;
}
function kpCanonicalRepo(v){try{const u=new URL(v||'');if(u.hostname.toLowerCase()!=='github.com')return '';const p=u.pathname.split('/').filter(Boolean);return p.length>=2?('https://github.com/'+p[0]+'/'+p[1].replace(/\.git$/i,'')).toLowerCase():''}catch{return ''}}
async function kpMergeAndSync(){
 if(!cryptoKey||!window.kpSyncMasterPassword)throw Error('请先解锁本地密钥库，再同步。');
 const status=$('#syncNowBtn');status.disabled=true;status.textContent='正在合并…';
 try{
  const response=await kpCloudRequest('GET');
  const cloud=Array.isArray(response)?response[0]:null;
  let mergedRecords=records.slice(),mergedProjects=projects.slice(),salt;
  if(cloud?.payload){
   const envelope=cloud.payload;
   salt=fromB64(envelope.salt);
   const cloudKey=await deriveKey(window.kpSyncMasterPassword,salt,Number(envelope.iterations)||310000);
   const remote=await decryptJson({iv:envelope.iv,data:envelope.data},cloudKey);
   if(!remote||remote.schemaVersion!==1||!Array.isArray(remote.records)||!Array.isArray(remote.projects))throw Error('云端加密数据格式不兼容，未修改本地数据。');
   const recordMap=new Map(remote.records.map(x=>[x.id,x]));
   for(const item of records){const prev=recordMap.get(item.id);if(!prev||Number(item.updatedAt||0)>Number(prev.updatedAt||0))recordMap.set(item.id,item);}
   mergedRecords=[...recordMap.values()];
   const projectMap=new Map();
   for(const item of [...remote.projects,...projects]){
    const repo=kpCanonicalRepo(item.repoUrl),key=repo||('id:'+item.id),prev=projectMap.get(key);
    if(!prev||Number(item.updatedAt||0)>Number(prev.updatedAt||0))projectMap.set(key,item);
   }
   mergedProjects=[...projectMap.values()];
  }else{salt=randomBytes(16);}
  const cloudKey=await deriveKey(window.kpSyncMasterPassword,salt,310000);
  const snapshot={schemaVersion:1,records:mergedRecords,projects:mergedProjects};
  const encrypted=await encryptJson(snapshot,cloudKey);
  const envelope={salt:toB64(salt),iterations:310000,iv:encrypted.iv,data:encrypted.data};
  await kpCloudRequest('POST',{user_id:kpSession().user.id,payload:envelope,schema_version:1,revision:(cloud?.revision||0)+1,updated_at:new Date().toISOString()});
  records=mergedRecords;projects=mergedProjects;
  const sealed=[];
  for(const rec of records)sealed.push(await sealRecord(rec));
  for(const project of projects)sealed.push(await sealProject(project));
  await writeItems([...sealed,...(await allItems()).filter(x=>x.id.startsWith('kp.meta.')||x.id.startsWith('kp.snapshot.')||x.id.startsWith('kp.tombstone.'))],false);await putItem(vault);
  render();window.renderProjects();kpSyncStatus('同步完成：已合并 '+records.length+' 条密钥、'+projects.length+' 个项目。云端仅保存加密密文。');
 }finally{status.disabled=!kpSession()?.access_token;status.textContent='合并并同步加密资料';}
}
$('#syncSignUpBtn')?.addEventListener('click',async()=>{try{const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||password.length<10)throw Error('请输入邮箱及至少 10 位的账号密码。');await kpAuth('signup',email,password);kpSyncStatus('账号请求已提交。若邮箱验证已开启，请先查收验证邮件，再返回登录。');}catch(e){kpSyncStatus(e.message,true)}});
$('#syncForgotPasswordBtn')?.addEventListener('click',async()=>{
 const button=$('#syncForgotPasswordBtn'),email=$('#syncEmail').value.trim();
 if(!email){kpSyncStatus('请先填写注册同步账号时使用的邮箱。',true);$('#syncEmail').focus();return;}
 const old=button.textContent;button.disabled=true;button.textContent='正在提交…';
 try{await kpRequestPasswordRecovery(email);kpSyncStatus('如果该邮箱对应有效账号，系统将发送密码重置邮件。请检查收件箱、垃圾邮件，并使用最新邮件中的链接。');}
 catch(error){kpSyncStatus('密码找回请求失败：'+error.message,true);}
 finally{button.disabled=false;button.textContent=old;}
});
$('#syncResetPasswordBtn')?.addEventListener('click',async()=>{
 const button=$('#syncResetPasswordBtn');if(button.disabled)return;
 try{await kpSubmitPasswordRecovery();}
 catch(error){kpSyncStatus('密码重置未完成：'+error.message,true);}
});
$('#syncSignInBtn')?.addEventListener('click',async()=>{const btn=$('#syncSignInBtn');if(btn.disabled)return;const old=btn.textContent;btn.disabled=true;btn.textContent='正在登录…';try{const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||!password)throw Error('请输入邮箱和账号密码。');const body=await kpAuth('token?grant_type=password',email,password);if(!body.access_token)throw Error('登录请求未返回有效会话，请检查邮箱验证状态或同步服务配置。');kpSyncStatus('登录成功。请点击“合并并同步加密资料”完成同步。');}catch(e){const msg=String(e.message||'登录失败');kpSyncStatus(msg.includes('Invalid login credentials')?'邮箱或密码不正确。':msg.includes('Email not confirmed')?'邮箱尚未验证，请先完成验证，或检查同步服务的邮箱验证设置。':msg.includes('Failed to fetch')?'无法连接同步服务，请检查网络或后端服务状态。':'登录失败：'+msg,true);}finally{btn.disabled=!!kpSession()?.access_token;btn.textContent=old;}});
$('#syncSignOutBtn')?.addEventListener('click',async()=>{try{const s=kpSession();if(s?.access_token)await fetch(KP_SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{'apikey':KP_SUPABASE_KEY,'Authorization':'Bearer '+s.access_token}});}catch{}kpSetSession(null);kpSyncStatus('已退出同步账号。本地加密库未受影响。');});
$('#syncNowBtn')?.addEventListener('click',async()=>{try{await kpV2SyncNow()}catch(e){kpSyncStatus('同步未完成：'+e.message+' 本地数据保持不变。',true)}});
kpSetSession(kpSession());
kpHandlePasswordRecoveryRedirect().catch(error=>kpSyncStatus('无法处理密码恢复链接：'+error.message,true));
window.addEventListener('hashchange',()=>kpHandlePasswordRecoveryRedirect().catch(error=>kpSyncStatus('无法处理密码恢复链接：'+error.message,true)));

// KeyPocket V2.0 local recovery foundation. Existing record envelopes are unchanged.

function kpV2DeviceId(){
 let id=localStorage.getItem(KP_V2_DEVICE_KEY);
 if(!id){id=crypto.randomUUID();localStorage.setItem(KP_V2_DEVICE_KEY,id);}
 return id;
}
function kpV2Iso(ts){return new Date(Number(ts)||kpNow()).toISOString();}
function kpV2Version(item){return Math.max(1,Number.isSafeInteger(item?.syncVersion)?item.syncVersion:0);}
let kpV2RefreshPromise=null;
async function kpV2RefreshSession(previousSession){
 if(kpV2RefreshPromise)return kpV2RefreshPromise;
 kpV2RefreshPromise=(async()=>{
  const current=kpSession();
  if(!current?.refresh_token)throw Error('同步账号会话已过期，请重新登录。');
  if(previousSession?.access_token&&current.access_token&&current.access_token!==previousSession.access_token)return current;
  const response=await fetch(KP_SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
   method:'POST',
   headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY},
   body:JSON.stringify({refresh_token:current.refresh_token})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body.access_token){
   const latest=kpSession();
   if(latest?.access_token&&latest.access_token!==current.access_token)return latest;
   kpSetSession(null);
   throw Error('同步账号会话已过期，请重新登录。');
  }
  const next={...current,...body,user:body.user||current.user};
  kpSetSession(next);
  return next;
 })().finally(()=>{kpV2RefreshPromise=null;});
 return kpV2RefreshPromise;
}
async function kpV2Api(path,method='GET',payload=null,prefer=null){
 let session=kpSession();if(!session?.access_token)throw Error('请先登录同步账号。');
 const send=activeSession=>{
  const headers={'apikey':KP_SUPABASE_KEY,'Authorization':'Bearer '+activeSession.access_token,'Accept':'application/json'};
  if(payload!==null)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  return fetch(KP_SUPABASE_URL+'/rest/v1/'+path,{method,headers,body:payload===null?undefined:JSON.stringify(payload)});
 };
 let response=await send(session);
 if(response.status===401&&session.refresh_token){
  session=await kpV2RefreshSession(session);
  response=await send(session);
 }
 const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
 if(!response.ok)throw Error((data&&(data.message||data.details||data.hint))||'云端请求失败（HTTP '+response.status+'）');
 return data;
}
async function kpV2EnsureMeta(passphrase){
 if(typeof passphrase!=='string'||passphrase.length<10)throw Error('跨设备加密口令至少需要 10 位。');
 const session=kpSession(),user=session?.user?.id;
 if(!user)throw Error('同步账号会话缺少用户 ID，请退出后重新登录。');
 let rows=await kpV2Api('keypocket_sync_meta?select=user_id,key_salt,iterations,schema_version,key_verifier&limit=1');
 let meta=Array.isArray(rows)?rows[0]:null;
 if(!meta){
  const salt=randomBytes(16),iterations=310000,key=await deriveKey(passphrase,salt,iterations);
  const verifier=await encryptJson({app:'KeyPocket',schemaVersion:KP_V2_SYNC_SCHEMA,purpose:'sync-passphrase-check'},key);
  try{
   await kpV2Api('keypocket_sync_meta?on_conflict=user_id','POST',{
    user_id:user,key_salt:toB64(salt),iterations,schema_version:KP_V2_SYNC_SCHEMA,
    key_verifier:verifier,updated_at:new Date().toISOString()
   },'resolution=ignore-duplicates,return=minimal');
  }catch(error){
   if(!String(error.message).includes('duplicate'))throw error;
  }
  rows=await kpV2Api('keypocket_sync_meta?select=user_id,key_salt,iterations,schema_version,key_verifier&limit=1');
  meta=Array.isArray(rows)?rows[0]:null;
 }
 if(!meta?.key_salt)throw Error('无法初始化云端加密元数据。');
 const salt=fromB64(meta.key_salt);
 if(salt.length!==16)throw Error('云端加密 Salt 格式异常，已停止同步。');
 const iterations=Number(meta.iterations)||310000;
 if(iterations<100000||iterations>1000000)throw Error('云端加密参数超出安全范围。');
 kpV2SyncKey=await deriveKey(passphrase,salt,iterations);kpV2SyncSalt=meta.key_salt;
 const verifierValue={app:'KeyPocket',schemaVersion:KP_V2_SYNC_SCHEMA,purpose:'sync-passphrase-check'};
 if(meta.key_verifier){
  try{
   const verified=await decryptJson(meta.key_verifier,kpV2SyncKey);
   if(verified?.app!=='KeyPocket'||verified?.purpose!=='sync-passphrase-check')throw Error('口令校验内容不匹配。');
  }catch{
   kpV2SyncKey=null;kpV2SyncSalt=null;
   throw Error('跨设备加密口令不正确。为保护云端数据，已阻止本次同步写入。');
  }
 }else{
  // Older V2 metadata can be upgraded only after the supplied passphrase decrypts
  // at least one existing encrypted sync row. Empty accounts can initialize safely.
  const existing=await kpV2FetchRemoteItems();
  if(existing.length){
   try{
    const probe=await decryptJson(existing[0].payload,kpV2SyncKey);
    if(!probe||String(probe.id)!==String(existing[0].entity_id))throw Error('同步记录身份不匹配。');
   }catch{
    kpV2SyncKey=null;kpV2SyncSalt=null;
    throw Error('跨设备加密口令无法解密现有云端记录，已阻止写入。');
   }
  }
  const verifier=await encryptJson(verifierValue,kpV2SyncKey);
  await kpV2Api('keypocket_sync_meta?user_id=eq.'+encodeURIComponent(user),'PATCH',{
   key_verifier:verifier,schema_version:KP_V2_SYNC_SCHEMA,updated_at:new Date().toISOString()
  },'return=minimal');
 }
 return {key:kpV2SyncKey,salt:kpV2SyncSalt,iterations};
}
async function kpV2RegisterDevice(){
 const session=kpSession(),deviceId=kpV2DeviceId(),now=new Date().toISOString();
 if(!session?.user?.id)throw Error('同步账号缺少用户信息，请重新登录。');
 const ua=navigator.userAgent||'';
 const label=/iPhone|iPad|iPod/i.test(ua)?'iOS / iPadOS 浏览器':/Android/i.test(ua)?'Android 浏览器':'桌面浏览器';
 await kpV2Api('keypocket_devices?on_conflict=user_id,device_id','POST',{
  user_id:session.user.id,device_id:deviceId,device_label:'KeyPocket · '+label,last_seen_at:now
 },'resolution=merge-duplicates,return=minimal');
 return deviceId;
}
async function kpV2FetchRemoteItems(){
 const rows=[];let offset=0,limit=1000;
 while(true){
  const batch=await kpV2Api('keypocket_sync_items?select=entity_type,entity_id,version,device_id,updated_at,deleted_at,payload,schema_version&order=entity_type.asc,entity_id.asc&limit='+limit+'&offset='+offset);
  if(!Array.isArray(batch))throw Error('云端同步列表响应格式错误。');
  rows.push(...batch);if(batch.length<limit)break;
  offset+=batch.length;if(offset>20000)throw Error('云端记录数量超过安全上限，已暂停同步。');
 }
 return rows;
}
async function kpV2LocalEntities(){
 const stored=await allItems(),byId=new Map(stored.map(item=>[item.id,item])),entities=new Map();
 for(const wrapped of stored){
  if(wrapped.id==='vault-meta'||wrapped.id.startsWith(KP_META_PREFIX)||wrapped.id.startsWith(KP_SNAPSHOT_PREFIX)||wrapped.id.startsWith(KP_TOMBSTONE_PREFIX))continue;
  const isProject=wrapped.id.startsWith('project:')||wrapped.kind==='project';
  const plain=isProject?await openProject(wrapped):await openRecord(wrapped);
  const kind=isProject?'project':'key',id=isProject?String(plain.id):String(plain.id);
  entities.set(kind+':'+id,{kind,id,plain,version:kpV2Version(plain),deletedAt:Number(plain.deletedAt)||null,updatedAt:Number(plain.updatedAt)||Number(wrapped.updatedAt)||kpNow()});
 }
 for(const tombstone of stored.filter(x=>String(x.id||'').startsWith(KP_TOMBSTONE_PREFIX))){
  try{
   const detail=await decryptJson({iv:tombstone.iv,data:tombstone.data});
   const kind=detail.kind==='record'?'key':detail.kind==='project'?'project':null;
   if(!kind||!detail.id)continue;
   const id=String(detail.id),wrapped=byId.get(kind==='key'?id:'project:'+id);
   let plain=detail.deletedItem||null;
   if(wrapped)plain=kind==='key'?await openRecord(wrapped):await openProject(wrapped);
   if(!plain)continue;
   const key=kind+':'+id;
   const version=Math.max(Number(detail.version)||0,kpV2Version(plain),1);
   const current=entities.get(key);
   if(!current||version>=current.version){
    plain.syncVersion=version;
    plain.deletedAt=Number(plain.deletedAt)||Number(detail.deletedAt)||kpNow();
    entities.set(key,{kind,id,plain,version,deletedAt:plain.deletedAt,updatedAt:Number(plain.updatedAt)||Number(detail.deletedAt)||kpNow(),permanent:detail.permanent===true});
   }
  }catch{}
 }
 return [...entities.values()];
}
async function kpV2SealRemoteEntity(entity,key){
 const payload=await encryptJson(entity.plain,key);
 return {iv:payload.iv,data:payload.data};
}
async function kpV2PushEntity(entity,remoteRow,deviceId,key){
 const encrypted=await kpV2SealRemoteEntity(entity,key);
 const input={
  p_entity_type:entity.kind,
  p_entity_id:entity.id,
  p_version:entity.version,
  p_device_id:deviceId,
  p_updated_at:kpV2Iso(entity.updatedAt),
  p_deleted_at:entity.deletedAt?kpV2Iso(entity.deletedAt):null,
  p_payload:encrypted,
  p_schema_version:KP_V2_SYNC_SCHEMA
 };
 const result=await kpV2Api('rpc/keypocket_sync_put_item','POST',input);
 const row=Array.isArray(result)?result[0]:null;
 if(!row?.outcome)throw Error('云端没有返回同步写入结果。');
 if(row.outcome==='accepted'||row.outcome==='already_applied'){
  entity.plain.syncVersion=entity.version;
  const wrapped=entity.kind==='key'?await sealRecord(entity.plain):await sealProject(entity.plain);
  await putItem(wrapped);
 }
 return row;
}
function kpV2RemoteTime(row){const n=Date.parse(row?.updated_at||'');return Number.isFinite(n)?n:0;}
function kpV2LocalWins(local,remote){
 if(local.updatedAt!==kpV2RemoteTime(remote))return local.updatedAt>kpV2RemoteTime(remote);
 return kpV2DeviceId().localeCompare(String(remote.device_id||''))>0;
}
async function kpV2ApplyRemote(row,key){
 const plain=await decryptJson(row.payload,key);
 const kind=row.entity_type,id=String(row.entity_id||'');
 if(!plain||typeof plain!=='object'||String(plain.id)!==id)throw Error('云端记录身份不匹配，已停止应用。');
 plain.syncVersion=Number(row.version)||1;
 plain.updatedAt=kpV2RemoteTime(row)||kpNow();
 const wrappedKey=kind==='key'?id:kind==='project'?'project:'+id:null;
 if(!wrappedKey)throw Error('云端记录类型不受支持。');
 if(row.deleted_at){
  plain.deletedAt=Date.parse(row.deleted_at)||plain.deletedAt||kpNow();
  plain.deletedFrom=kind==='key'?'records':'projects';
  const sealed=kind==='key'?await sealRecord(plain):await sealProject(plain);
  await putItem(sealed);
  await kpSaveTombstone(kind==='key'?'record':'project',id,plain.deletedAt,plain);
  if(kind==='key')records=records.filter(x=>x.id!==id);
  else projects=projects.filter(x=>x.id!==id);
 }else{
  delete plain.deletedAt;delete plain.deletedFrom;
  const sealed=kind==='key'?await sealRecord(plain):await sealProject(plain);
  await putItem(sealed);await deleteItem(KP_TOMBSTONE_PREFIX+(kind==='key'?'record':'project')+':'+id);
  if(kind==='key'){records=records.filter(x=>x.id!==id);records.push(plain);}
  else{projects=projects.filter(x=>x.id!==id);projects.push(plain);}
 }
}
async function kpV2SaveCloudBackups(key,salt,deviceId){
 const session=kpSession();
 const local=await kpV2LocalEntities();
 const live=local.filter(x=>!x.deletedAt);
 const deleted=local.filter(x=>x.deletedAt).map(x=>({kind:x.kind,id:x.id,deletedAt:x.deletedAt,permanent:x.permanent===true,plain:x.plain}));
 const snapshot={schemaVersion:KP_V2_SYNC_SCHEMA,createdAt:new Date().toISOString(),records:live.filter(x=>x.kind==='key').map(x=>x.plain),projects:live.filter(x=>x.kind==='project').map(x=>x.plain),deleted};
 const encrypted=await encryptJson(snapshot,key);
 const payload={salt:salt,iv:encrypted.iv,data:encrypted.data};
 const now=new Date().toISOString();
 // Write the new account-wide snapshot first. Only after the upsert succeeds do
 // we remove previous daily/monthly/milestone versions for this authenticated user.
 const saved=await kpV2Api('keypocket_backup_snapshots?on_conflict=user_id,device_id,snapshot_type,period_key','POST',{
  user_id:session.user.id,device_id:deviceId,snapshot_type:'milestone',period_key:'latest',
  schema_version:KP_V2_SYNC_SCHEMA,record_count:live.filter(v=>v.kind==='key').length,
  payload,created_at:now
 },'resolution=merge-duplicates,return=representation');
 const latest=Array.isArray(saved)?saved[0]:null;
 if(!latest?.id)throw Error('云端最新备份已提交，但未返回备份 ID，未清理旧备份。');
 await kpV2Api('keypocket_backup_snapshots?user_id=eq.'+encodeURIComponent(session.user.id)+'&id=neq.'+encodeURIComponent(latest.id),'DELETE');
}
async function kpV2SyncNow(options={}){
 if(kpV2SyncBusy)return false;
 if(!kpSession()?.access_token)throw Error('请先登录同步账号。');
 if(!cryptoKey)throw Error('请先解锁本地密钥库。');
 const input=$('#syncEncryptionPassword');
 const passphrase=String(input?.value||window.kpV2Passphrase||'');
 if(passphrase.length<10)throw Error('请输入至少 10 位的跨设备加密口令。');
 window.kpV2Passphrase=passphrase;
 kpV2SyncBusy=true;
 const button=$('#syncNowBtn'),old=button?.textContent;
 if(button){button.disabled=true;button.textContent='正在加密同步…';}
 try{
  const auth=await kpV2EnsureMeta(passphrase),deviceId=await kpV2RegisterDevice(),[locals,remotes]=await Promise.all([kpV2LocalEntities(),kpV2FetchRemoteItems()]);
  const remoteMap=new Map(remotes.map(x=>[x.entity_type+':'+x.entity_id,x]));
  const localMap=new Map(locals.map(x=>[x.kind+':'+x.id,x]));
  const keys=new Set([...remoteMap.keys(),...localMap.keys()]);
  let pushed=0,pulled=0,conflicts=0;
  for(const identity of keys){
   let local=localMap.get(identity),remote=remoteMap.get(identity);
   if(!local&&remote){await kpV2ApplyRemote(remote,auth.key);pulled++;continue;}
   if(!remote&&local){const result=await kpV2PushEntity(local,null,deviceId,auth.key);if(result.outcome==='accepted'||result.outcome==='already_applied')pushed++;else conflicts++;continue;}
   if(!local||!remote)continue;
   const localVersion=local.version,remoteVersion=Number(remote.version)||0;
   if(localVersion>remoteVersion){
    let result=await kpV2PushEntity(local,remote,deviceId,auth.key);
    if(result.outcome==='conflict'){
     const current={...remote,version:result.current_version,device_id:result.current_device_id,updated_at:result.current_updated_at,deleted_at:result.current_deleted_at,payload:result.current_payload};
     if(kpV2LocalWins(local,current)){
      local.version=(Number(result.current_version)||0)+1;local.plain.syncVersion=local.version;
      result=await kpV2PushEntity(local,current,deviceId,auth.key);
      if(result.outcome==='accepted'||result.outcome==='already_applied')pushed++;else conflicts++;
     }else{await kpV2ApplyRemote(current,auth.key);pulled++;}
    }else if(result.outcome==='accepted'||result.outcome==='already_applied')pushed++;
    continue;
   }
   if(localVersion<remoteVersion){await kpV2ApplyRemote(remote,auth.key);pulled++;continue;}
   const sameDevice=String(remote.device_id)===deviceId;
   if(sameDevice&&local.updatedAt===kpV2RemoteTime(remote))continue;
   if(kpV2LocalWins(local,remote)){
    local.version=remoteVersion+1;local.plain.syncVersion=local.version;
    const result=await kpV2PushEntity(local,remote,deviceId,auth.key);
    if(result.outcome==='accepted'||result.outcome==='already_applied')pushed++;else conflicts++;
   }else{await kpV2ApplyRemote(remote,auth.key);pulled++;}
  }
  render();window.renderProjects();
  await kpV2SaveCloudBackups(auth.key,auth.salt,deviceId);
  const status='V2 同步完成：上传/更新 '+pushed+' 条，下载/合并 '+pulled+' 条'+(conflicts?'，待处理冲突 '+conflicts+' 条':'')+'。云端仅保存独立口令加密密文。';
  kpSyncStatus(status);const center=$('#syncCenterStatus');if(center)center.textContent=status+' 本设备 ID：'+deviceId.slice(0,8)+'…';
  await kpWriteEncryptedSnapshot('after-cloud-sync');
  return true;
 }finally{
  kpV2SyncBusy=false;if(button){button.disabled=!kpSession()?.access_token;button.textContent=old||'同步并备份';}
 }
}
function kpQueueCloudSync(){
 if(kpV2SyncBusy||!kpSession()?.access_token||!window.kpV2Passphrase)return;
 clearTimeout(kpV2SyncTimer);
 kpV2SyncTimer=setTimeout(()=>kpV2SyncNow({silent:true}).catch(error=>kpSyncStatus('自动云同步未完成：'+error.message,true)),1800);
}
function kpNow(){return Date.now();}
function kpDateKey(ts=kpNow()){return new Date(ts).toISOString().slice(0,10);}
async function kpVaultPlainSnapshot(){
 const stored=(await allItems()).filter(x=>x.id!=='vault-meta');
 const plain={schemaVersion:2,createdAt:kpNow(),records:[],projects:[]};
 for(const item of stored){
  if(item.id.startsWith(KP_META_PREFIX)||item.id.startsWith(KP_SNAPSHOT_PREFIX)||item.id.startsWith(KP_TOMBSTONE_PREFIX))continue;
  if(item.id.startsWith('project:')||item.kind==='project'){
   const x=await openProject(item);if(!x.deletedAt)plain.projects.push(x);
  }else{const x=await openRecord(item);if(!x.deletedAt)plain.records.push(x);}
 }
 return plain;
}
async function kpWriteEncryptedSnapshot(reason='auto'){
 if(!cryptoKey||kpSnapshotBusy){kpSnapshotRequested=true;return false;}
 kpSnapshotBusy=true;
 try{
  const data=await kpVaultPlainSnapshot(),payload=await encryptJson(data),now=kpNow();
  // A stable IndexedDB key makes each completed backup overwrite the previous full snapshot.
  // The old snapshot remains safe until the new encrypted value has been stored.
  await putItem({id:KP_SNAPSHOT_LATEST_ID,kind:'local-encrypted-snapshot',createdAt:now,reason,iv:payload.iv,data:payload.data,recordCount:data.records.length,projectCount:data.projects.length});
  const legacy=(await allItems()).filter(x=>x.id.startsWith(KP_SNAPSHOT_PREFIX)&&x.id!==KP_SNAPSHOT_LATEST_ID);
  for(const x of legacy)await deleteItem(x.id);
  await putItem({id:KP_META_PREFIX+'backup-state',lastSnapshotAt:now,lastSnapshotType:reason,lastError:null});
  const n=$('#backupStatus');if(n)n.textContent='最新完整备份已更新：'+new Date(now).toLocaleString()+' · '+data.records.length+' 条密钥 · '+data.projects.length+' 个项目（仅保留一份）';
  return true;
 }catch(err){
  try{await putItem({id:KP_META_PREFIX+'backup-state',lastError:String(err.message||err),failedAt:kpNow()});}catch{}
  const n=$('#backupStatus');if(n)n.textContent='备份失败：'+(err.message||'未知错误')+'。上一份有效备份保持不变。';return false;
 }finally{kpSnapshotBusy=false;if(kpSnapshotRequested){kpSnapshotRequested=false;queueMicrotask(()=>kpWriteEncryptedSnapshot('queued'));}}
}
function kpQueueSnapshot(reason='auto'){if(!cryptoKey)return;clearTimeout(kpSnapshotTimer);kpSnapshotTimer=setTimeout(()=>kpWriteEncryptedSnapshot(reason),KP_AUTOSAVE_DELAY);}
async function kpPersist(item,reason){await putItem(item);kpQueueSnapshot(reason);kpQueueCloudSync();}
function kpBumpVersion(item){item.syncVersion=Math.max(Number(item.syncVersion)||0,kpNow())+1;item.updatedAt=kpNow();return item.syncVersion;}
async function persistRecord(record){kpBumpVersion(record);await kpPersist(await sealRecord(record),'record');}
async function persistProject(project){kpBumpVersion(project);await kpPersist(await sealProject(project),'project');}
async function kpSaveTombstone(kind,id,deletedAt=kpNow(),deletedItem=null,options={}){
 const version=Math.max(Number(deletedItem?.syncVersion)||0,Number(options.version)||0,deletedAt);
 const item={id,kind,deletedAt,expiresAt:deletedAt+KP_TRASH_DAYS*86400000,version,deletedItem:deletedItem||null,permanent:options.permanent===true,expired:options.expired===true};
 const payload=await encryptJson(item);await putItem({id:KP_TOMBSTONE_PREFIX+kind+':'+id,iv:payload.iv,data:payload.data,updatedAt:deletedAt});
 kpQueueCloudSync();
}
async function softDeleteRecord(record){
 await kpWriteEncryptedSnapshot('before-delete');
 const deletedAt=kpNow();kpBumpVersion(record);record.deletedAt=deletedAt;record.deletedFrom='records';
 const payload=await encryptJson(record);
 await putItem({id:record.id,kind:'record',iv:payload.iv,data:payload.data,updatedAt:deletedAt});
 await kpSaveTombstone('record',record.id,deletedAt,record);kpQueueSnapshot('delete');kpQueueCloudSync();
}
async function softDeleteProject(project){
 await kpWriteEncryptedSnapshot('before-delete');
 const key='project:'+project.id,deletedAt=kpNow();kpBumpVersion(project);project.deletedAt=deletedAt;project.deletedFrom='projects';
 const payload=await encryptJson(project);
 await putItem({id:key,kind:'project',iv:payload.iv,data:payload.data,updatedAt:deletedAt});
 await kpSaveTombstone('project',project.id,deletedAt,project);kpQueueSnapshot('delete');kpQueueCloudSync();
}
async function kpPruneExpiredTrash(){
 if(!cryptoKey)return 0;
 const now=kpNow(),stored=await allItems(),expired=stored.filter(x=>String(x.id||'').startsWith(KP_TOMBSTONE_PREFIX));
 let removed=0;
 for(const tombstone of expired){
  try{
   const d=await decryptJson({iv:tombstone.iv,data:tombstone.data});
   if(!Number.isFinite(Number(d.expiresAt))||Number(d.expiresAt)>now)continue;
   const key=d.kind==='record'?d.id:d.kind==='project'?'project:'+d.id:null;
   if(key){
    const wrapped=stored.find(x=>x.id===key);
    if(wrapped){
     const item=d.kind==='record'?await openRecord(wrapped):await openProject(wrapped);
     // Never purge a newer/recreated record that happens to reuse an ID.
     if(Number(item.deletedAt)===Number(d.deletedAt))await deleteItem(key);
    }
   }
   d.expired=true;
   const retained=await encryptJson(d);
   await putItem({id:tombstone.id,iv:retained.iv,data:retained.data,updatedAt:now});
   removed++;
  }catch{
   // A tombstone that cannot be authenticated must not trigger deletion.
  }
 }
 return removed;
}
async function kpReadTrash(){
 const stored=await allItems(),out=[];
 for(const t of stored.filter(x=>String(x.id||'').startsWith(KP_TOMBSTONE_PREFIX))){
  try{const d=await decryptJson({iv:t.iv,data:t.data});if(d.permanent===true||d.expired===true||Number(d.expiresAt)<=kpNow())continue;
   const key=d.kind==='record'?d.id:d.kind==='project'?'project:'+d.id:null;if(!key)continue;
   const wrapped=stored.find(x=>x.id===key);const item=wrapped?(d.kind==='record'?await openRecord(wrapped):await openProject(wrapped)):d.deletedItem;
   if(!item||!item.deletedAt||Number(item.deletedAt)!==Number(d.deletedAt))continue;
   out.push({kind:d.kind,id:d.id,deletedAt:d.deletedAt,expiresAt:d.expiresAt,item});
  }catch{}
 }
 return out.sort((a,b)=>b.deletedAt-a.deletedAt);
}
async function kpRestoreTrash(id,kind){
 const tomb=await getItem(KP_TOMBSTONE_PREFIX+kind+':'+id);
 const detail=tomb?await decryptJson({iv:tomb.iv,data:tomb.data}):null;
 const key=kind==='record'?id:'project:'+id,wrapped=await getItem(key);
 const item=wrapped?(kind==='record'?await openRecord(wrapped):await openProject(wrapped)):detail?.deletedItem;
 if(!item||!item.deletedAt)throw Error('待恢复记录不存在。');
 delete item.deletedAt;delete item.deletedFrom;kpBumpVersion(item);
 await putItem(kind==='record'?await sealRecord(item):await sealProject(item));await deleteItem(KP_TOMBSTONE_PREFIX+kind+':'+id);
 if(kind==='record'){records=records.filter(x=>x.id!==id);records.push(item);render();}else{projects=projects.filter(x=>x.id!==id);projects.push(item);window.renderProjects();}
 await kpWriteEncryptedSnapshot('restore');kpQueueCloudSync();
}
async function kpPurgeTrash(id,kind){
 const tombId=KP_TOMBSTONE_PREFIX+kind+':'+id,tomb=await getItem(tombId);
 if(tomb){
  const d=await decryptJson({iv:tomb.iv,data:tomb.data});
  if(!d.deletedItem){
   const wrapped=await getItem(kind==='record'?id:'project:'+id);
   if(wrapped)d.deletedItem=kind==='record'?await openRecord(wrapped):await openProject(wrapped);
  }
  d.permanent=true;d.deletedAt=Number(d.deletedAt)||kpNow();d.version=Math.max(Number(d.version)||0,kpNow())+1;
  if(d.deletedItem)d.deletedItem.syncVersion=d.version;
  const sealed=await encryptJson(d);await putItem({id:tombId,iv:sealed.iv,data:sealed.data,updatedAt:kpNow()});
 }
 await deleteItem(kind==='record'?id:'project:'+id);await kpWriteEncryptedSnapshot('permanent-delete');kpQueueCloudSync();
}
async function renderRecycleBin(){
 const host=$('#recycleCards');if(!host)return;await kpPruneExpiredTrash();const items=await kpReadTrash();
 host.innerHTML=items.length?items.map(x=>'<article class="card"><div class="cardtop"><div class="provider-icon">'+(x.kind==='record'?'KEY':'APP')+'</div><div class="cardtitle"><h3>'+esc(x.kind==='record'?(x.item.name||providerById(x.item.provider).name):x.item.name)+'</h3><p>删除于 '+new Date(x.deletedAt).toLocaleString()+'</p><p>剩余 '+Math.max(0,Math.ceil((x.expiresAt-kpNow())/86400000))+' 天</p></div></div><div class="cardactions"><button class="btn primary" data-trash-restore="'+esc(x.id)+'" data-kind="'+x.kind+'">恢复</button><button class="btn danger" data-trash-purge="'+esc(x.id)+'" data-kind="'+x.kind+'">永久删除</button></div></article>').join(''):'<div class="empty"><h3>回收站是空的</h3><p>删除的密钥、项目与 Skill 将在这里保留 30 天。</p></div>';
}
$('#recycleCards')?.addEventListener('click',async e=>{const a=e.target.closest('[data-trash-restore]'),b=e.target.closest('[data-trash-purge]');try{if(a){await kpRestoreTrash(a.dataset.trashRestore,a.dataset.kind);showToast('记录已恢复');}if(b&&confirm('永久删除后无法恢复，确认继续？')){await kpPurgeTrash(b.dataset.trashPurge,b.dataset.kind);showToast('记录已永久删除');}await renderRecycleBin();}catch(err){showToast('操作失败：'+err.message);}});
$('#restoreAllBtn')?.addEventListener('click',async()=>{const xs=await kpReadTrash();for(const x of xs)await kpRestoreTrash(x.id,x.kind);await renderRecycleBin();showToast('已恢复 '+xs.length+' 条记录');});
$('#emptyRecycleBtn')?.addEventListener('click',async()=>{const xs=await kpReadTrash();if(!xs.length||!confirm('永久删除 '+xs.length+' 条记录？'))return;for(const x of xs)await kpPurgeTrash(x.id,x.kind);await renderRecycleBin();showToast('回收站已清空');});
async function renderBackupCenter(){
 const xs=(await allItems()).filter(x=>x.id.startsWith(KP_SNAPSHOT_PREFIX)).sort((a,b)=>b.createdAt-a.createdAt),meta=await getItem(KP_META_PREFIX+'backup-state');
 const n=$('#backupStatus');if(n)n.textContent=meta?.lastSnapshotAt?'最新本地完整备份：'+new Date(meta.lastSnapshotAt).toLocaleString()+' · '+(meta.lastError?'最近备份失败：'+meta.lastError:'自动覆盖已启用，仅保留一份'):'尚未生成本地备份。数据变化后自动创建并覆盖上一份。';
 const latest=xs[0];
 $('#backupCards').innerHTML=latest?'<article class="card"><div class="cardtop"><div class="provider-icon">BK</div><div class="cardtitle"><h3>最新完整备份</h3><p>'+new Date(latest.createdAt).toLocaleString()+' · '+latest.recordCount+' 条密钥 · '+latest.projectCount+' 个项目</p></div></div><div class="cardactions"><button class="btn primary" data-snapshot-restore="'+esc(latest.id)+'">恢复最新备份</button></div></article>':'<div class="empty"><h3>暂无本地备份</h3><p>数据变更后自动创建；每次完成后覆盖上一份。</p></div>';
 await renderCloudBackupCenter();
}
async function renderCloudBackupCenter(){
 const host=$('#cloudBackupCards'),status=$('#cloudBackupStatus');if(!host||!status)return;
 if(!kpSession()?.access_token){status.textContent='登录同步账号并完成一次 V2 同步后，这里将显示云端加密快照。';host.innerHTML='';return;}
 if(!window.kpV2Passphrase||!kpV2SyncKey){status.textContent='请先在“同步中心”完成一次 V2 同步，解锁本会话云备份口令。';host.innerHTML='';return;}
 try{
  const rows=await kpV2Api('keypocket_backup_snapshots?select=id,device_id,snapshot_type,period_key,record_count,created_at&order=created_at.desc&limit=1');
  status.textContent='账号级最新完整云端备份：每次成功同步后覆盖上一份，云端仅保留一份 AES-GCM 加密密文，可在其他设备恢复。';
  host.innerHTML=(rows||[]).map(x=>'<article class="card"><div class="cardtop"><div class="provider-icon">☁</div><div class="cardtitle"><h3>最新完整备份</h3><p>'+new Date(x.created_at).toLocaleString()+' · '+Number(x.record_count||0)+' 条密钥</p></div></div><div class="cardactions"><button class="btn primary" data-cloud-restore="'+esc(x.id)+'">恢复最新云备份</button></div></article>').join('')||'<div class="empty"><h3>暂无云端备份</h3><p>完成 V2 同步后自动生成一份最新完整备份。</p></div>';
 }catch(error){status.textContent='读取云端快照失败：'+error.message;host.innerHTML='';}
}
async function kpV2RestoreCloudBackup(snapshotId){
 if(!kpV2SyncKey||!window.kpV2Passphrase)throw Error('请先在同步中心解锁云端加密口令。');
 const rows=await kpV2Api('keypocket_backup_snapshots?select=id,payload,schema_version,record_count,device_id&id=eq.'+encodeURIComponent(snapshotId)+'&limit=1');
 const row=Array.isArray(rows)?rows[0]:null;if(!row)throw Error('云端快照不存在或不属于当前设备。');
 if(Number(row.schema_version)!==KP_V2_SYNC_SCHEMA)throw Error('云端快照版本不兼容，未修改本地数据。');
 if(row.payload?.salt!==kpV2SyncSalt)throw Error('云端快照加密 Salt 与当前口令不一致。');
 const snapshot=await decryptJson({iv:row.payload.iv,data:row.payload.data},kpV2SyncKey);
 if(!snapshot||snapshot.schemaVersion!==KP_V2_SYNC_SCHEMA||!Array.isArray(snapshot.records)||!Array.isArray(snapshot.projects)||!Array.isArray(snapshot.deleted))throw Error('云端快照结构验证失败。');
 const restoredRecords=normalizeBackupRecords(snapshot.records),restoredProjects=snapshot.projects.map(normalizeProject);
 const protection=await kpWriteEncryptedSnapshot('before-cloud-restore');if(!protection)throw Error('恢复前本地保护快照创建失败，已停止恢复。');
 const all=await allItems(),retained=all.filter(x=>x.id==='vault-meta'||x.id.startsWith(KP_SNAPSHOT_PREFIX)||x.id.startsWith(KP_META_PREFIX));
 const sealed=[];for(const item of restoredRecords){item.syncVersion=Math.max(kpV2Version(item),kpNow())+1;sealed.push(await sealRecord(item));}
 for(const item of restoredProjects){item.syncVersion=Math.max(kpV2Version(item),kpNow())+1;sealed.push(await sealProject(item));}
 const deleted=[];
 for(const entry of snapshot.deleted){
  if(!entry||!['key','project'].includes(entry.kind)||!entry.id||!entry.plain||!entry.plain.deletedAt)continue;
  const plain=entry.plain;plain.syncVersion=Math.max(Number(plain.syncVersion)||0,kpNow())+1;
  const wrapped=entry.kind==='key'?await sealRecord(plain):await sealProject(plain);sealed.push(wrapped);
  deleted.push({kind:entry.kind==='key'?'record':'project',id:String(entry.id),deletedAt:Number(plain.deletedAt),plain,permanent:entry.permanent===true});
 }
 await writeItems([...retained,...sealed],true);
 records=restoredRecords;projects=restoredProjects;
 for(const item of deleted)await kpSaveTombstone(item.kind,item.id,item.deletedAt,item.plain,{permanent:item.permanent,version:item.plain.syncVersion});
 render();window.renderProjects();
 await kpV2SyncNow({silent:true});
 showToast('已恢复云端加密快照，并将恢复结果同步到其他设备。');
}
$('#cloudBackupCards')?.addEventListener('click',async e=>{
 const b=e.target.closest('[data-cloud-restore]');if(!b)return;
 if(!confirm('恢复云备份将替换本机当前记录。系统会先生成保护快照，确认继续？'))return;
 try{b.disabled=true;await kpV2RestoreCloudBackup(b.dataset.cloudRestore);}catch(error){showToast('云备份恢复失败：'+error.message);}finally{b.disabled=false;await renderBackupCenter();}
});
$('#backupNowBtn')?.addEventListener('click',async()=>{const ok=await kpWriteEncryptedSnapshot('manual');showToast(ok?'加密快照已生成':'快照失败');await renderBackupCenter();});
$('#backupCards')?.addEventListener('click',async e=>{
 const b=e.target.closest('[data-snapshot-restore]');if(!b||!confirm('恢复会先为当前内容创建保护快照，再替换活动记录。'))return;
 try{
  const wrapped=await getItem(b.dataset.snapshotRestore);if(!wrapped)throw Error('最新备份不存在。');
  const snap=await decryptJson({iv:wrapped.iv,data:wrapped.data});
  if(!Array.isArray(snap.records)||!Array.isArray(snap.projects))throw Error('最新备份结构无效。');
  const protectedOk=await kpWriteEncryptedSnapshot('before-restore');if(!protectedOk)throw Error('恢复前保护备份失败，已停止恢复。');
  const sealed=[];for(const x of snap.records)sealed.push(await sealRecord(x));for(const x of snap.projects)sealed.push(await sealProject(x));
  const keep=(await allItems()).filter(x=>x.id==='vault-meta'||x.id.startsWith(KP_SNAPSHOT_PREFIX)||x.id.startsWith(KP_TOMBSTONE_PREFIX)||x.id.startsWith(KP_META_PREFIX));
  await writeItems([...keep,...sealed],true);records=snap.records;projects=snap.projects;render();window.renderProjects();
  await kpWriteEncryptedSnapshot('after-restore');await renderBackupCenter();showToast('最新完整备份已恢复');
 }catch(err){showToast('恢复失败：'+err.message);}
});
async function kpMaybeDailySnapshot(){const d=await getItem(KP_META_PREFIX+'daily-date');if(d?.value===kpDateKey())return;const ok=await kpWriteEncryptedSnapshot('daily');if(ok)await putItem({id:KP_META_PREFIX+'daily-date',value:kpDateKey()});}
async function renderSyncCenter(){
 const el=$('#syncCenterStatus'),host=$('#syncDeviceList'),meta=$('#syncDeviceStatus');
 if(!kpSession()?.access_token){if(el)el.textContent='未登录 V2 同步账号。数据使用独立加密口令加密后再上传。';if(host)host.innerHTML='';if(meta)meta.textContent='登录同步账号后查看此账号已关联的设备。';return;}
 if(el)el.textContent='已登录 V2 同步账号。输入独立跨设备加密口令后，点击“同步并备份”。后续本设备的更改会在口令仍留在当前页面内存时自动同步。';
 if(!host||!meta)return;
 try{
  const rows=await kpV2Api('keypocket_devices?select=device_id,device_label,created_at,last_seen_at,revoked_at&order=last_seen_at.desc&limit=50');
  const current=kpV2DeviceId();
  meta.textContent='设备 ID 保存在每台设备本地。可撤销不再使用的其他设备；当前设备不能从自身会话中撤销。撤销后，该设备后续云同步写入将被服务端拒绝。';
  host.innerHTML=(rows||[]).map(x=>{
   const deviceId=String(x.device_id||''),isCurrent=deviceId===current,revoked=!!x.revoked_at;
   const state=revoked?'已撤销，不能写入云端':(isCurrent?'当前设备，不能在此撤销':'有效设备');
   const action=!isCurrent&&!revoked?'<div class="cardactions"><button class="btn danger" type="button" data-revoke-device="'+esc(deviceId)+'">撤销此设备</button></div>':'';
   return '<article class="card" data-device-id="'+esc(deviceId)+'"><div class="cardtop"><div class="provider-icon">DEV</div><div class="cardtitle"><h3>'+esc(x.device_label||'KeyPocket 设备')+(isCurrent?' · 当前设备':'')+'</h3><p>设备 ID '+esc(deviceId.slice(0,8))+' · 最近同步 '+(x.last_seen_at?new Date(x.last_seen_at).toLocaleString():'尚未同步')+'</p><p>'+state+'</p></div></div>'+action+'</article>';
  }).join('')||'<div class="empty"><p>尚未注册设备；完成首次同步后自动登记。</p></div>';
 }catch(error){meta.textContent='设备列表暂不可用：'+error.message;host.innerHTML='';}
}
$('#syncDeviceList')?.addEventListener('click',async event=>{
 const button=event.target.closest('[data-revoke-device]');if(!button)return;
 const deviceId=String(button.dataset.revokeDevice||''),session=kpSession();
 if(!session?.access_token||!session?.user?.id){showToast('登录状态已失效，请重新登录。');return;}
 if(!deviceId||deviceId===kpV2DeviceId()){showToast('为防止当前设备失去控制，不能在本设备撤销自身。');return;}
 if(!confirm('确认撤销这台设备？\n撤销后，该设备将无法继续向 KeyPocket 云端写入同步数据。'))return;
 button.disabled=true;button.textContent='正在撤销…';
 try{
  const rows=await kpV2Api('keypocket_devices?user_id=eq.'+encodeURIComponent(session.user.id)+'&device_id=eq.'+encodeURIComponent(deviceId)+'&revoked_at=is.null&select=device_id,revoked_at','PATCH',{revoked_at:new Date().toISOString()},'return=representation');
  if(!Array.isArray(rows)||rows.length!==1||String(rows[0].device_id)!==deviceId||!rows[0].revoked_at)throw Error('服务端未确认设备撤销，可能该设备已被撤销或不属于当前账号。');
  showToast('设备已撤销，后续云同步写入将被拒绝。');
  await renderSyncCenter();
 }catch(error){
  button.disabled=false;button.textContent='撤销此设备';
  showToast('撤销失败：'+error.message);
  kpSyncStatus('设备撤销未完成：'+error.message,true);
 }
});
async function renderGithubCenter(){
 const el=$('#githubAccountStatus'),button=$('#githubConnectBtn');
 if(el)el.innerHTML='<strong>尚未连接 KeyPocket GitHub App</strong><p>应用内 GitHub 授权服务尚未开放，因此当前不能绑定账号或创建私有备份仓库。</p><p>Cloudflare 中已有 Worker 占位脚本，但 workers.dev 公网子域名尚未启用，且没有绑定 GitHub App / OAuth Secrets。完成 GitHub App 注册、最小权限配置和服务端密钥部署后，才可以开放连接。</p><p>ChatGPT 的 GitHub 连接器只用于仓库开发，不会自动授权 KeyPocket 应用。</p><a href="https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/blob/main/keypocket/docs/github-app.md" target="_blank" rel="noopener noreferrer">查看 GitHub App 配置与安全要求 ↗</a>';
 if(button){button.disabled=true;button.textContent='授权服务待配置';button.title='GitHub App 与 OAuth Worker 尚未完成配置。';}
}
async function renderSkillRadar(){
 const host=$('#radarCards'),meta=$('#radarMeta');if(!host)return;
 const period=document.querySelector('[data-radar-period].active')?.dataset.radarPeriod||'month';
 const periodLabels={month:'近 30 天',quarter:'近 90 天',year:'近 365 天',all:'当前 Stars'};
 try{
  const res=await fetch('./api/skill-radar.json',{cache:'no-store'});
  if(!res.ok)throw Error('历史采集服务暂不可用（HTTP '+res.status+'）。');
  const data=await res.json(),xs=(data.boards?.[period]||[]).slice(0,10),status=data.periodStatus?.[period]|| (xs.length?'available':'collecting_history');
  meta.textContent='数据更新：'+new Date(data.updatedAt).toLocaleString()+' · 历史起始：'+data.historyStartedAt+' · 已采集 '+Number(data.snapshotCount||0)+' 天 · '+periodLabels[period]+' · 来源：GitHub API';
  if(!xs.length){
   const title=status==='collecting_history'?'历史样本积累中':'暂无可用榜单数据';
   const detail=period==='all'?'首次 GitHub 采集完成后会生成当前 Stars 排名。':'周期榜需要足够长的真实历史快照：'+periodLabels[period]+' 的起点样本尚未建立，当前不会把累计 Stars 误报为周期增长。';
   host.innerHTML='<div class="empty"><h3>'+title+'</h3><p>'+esc(detail)+'</p></div>';
   return;
  }
  host.innerHTML=xs.map((x,i)=>{
   const growth=period==='all'?'当前 Stars 排名':'近 '+Number(x.growthWindowDays||0)+' 天增长 '+(Number(x.starGrowth)>0?'+':'')+Number(x.starGrowth||0)+' Stars';
   const forks=period==='all'?'Fork '+Number(x.forks||0).toLocaleString():'Fork 增长 '+(Number(x.forkGrowth)>0?'+':'')+Number(x.forkGrowth||0);
   const files=(x.skillFiles||[]).slice(0,2).map(file=>'<span class="tag">'+esc(file)+'</span>').join('');
   return '<article class="card"><div class="cardtop"><div class="provider-icon">#'+(i+1)+'</div><div class="cardtitle"><h3>'+esc(x.fullName)+'</h3><p>'+esc(x.owner)+' · 当前 ★ '+Number(x.stars||0).toLocaleString()+' · '+esc(growth)+' · '+esc(forks)+'</p></div></div><p class="project-note">'+esc(x.description||'该仓库已通过公开 Git Tree 中 SKILL.md 路径验证。')+'</p><div class="tags">'+files+'</div><div class="cardactions"><a class="btn" href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">查看仓库 ↗</a><button class="btn primary" data-radar-save="'+i+'">收录 Skill</button></div></article>';
  }).join('');
 }catch(err){
  meta.textContent='榜单暂不可用：'+err.message;
  host.innerHTML='<div class="empty"><h3>等待真实数据源</h3><p>采集失败不会覆盖上一份有效榜单，也不会展示模拟热度。</p></div>';
 }
}
document.querySelectorAll('[data-radar-period]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-radar-period]').forEach(x=>x.classList.toggle('active',x===b));renderSkillRadar();}));
$('#refreshRadarBtn')?.addEventListener('click',renderSkillRadar);
$('#radarCards')?.addEventListener('click',async e=>{
 const b=e.target.closest('[data-radar-save]');if(!b)return;
 try{const data=await (await fetch('./api/skill-radar.json',{cache:'no-store'})).json(),p=(data.boards?.[document.querySelector('[data-radar-period].active')?.dataset.radarPeriod||'month']||[])[Number(b.dataset.radarSave)];if(!p)return;
  if(projects.some(x=>canonicalSkillRepoUrl(x.repoUrl)===canonicalSkillRepoUrl(p.url))){showToast('该 Skill 已收录');return;}
  const item=normalizeProject({id:crypto.randomUUID(),name:p.fullName+' · Skill',repoUrl:p.url,appUrl:'',category:'AI 工具',stack:p.language||'',notes:'Skill Radar 收录；周期增长基于首次历史快照。',tags:'Skill, Skill Radar, GitHub',favorite:true,createdAt:kpNow(),updatedAt:kpNow()});
  await persistProject(item);projects.push(item);showToast('Skill 已收录');
 }catch(err){showToast('收录失败：'+err.message);}
});
window.addEventListener('online',()=>{const x=$('#backupStatus');if(x)x.textContent='网络已恢复。本地保存正常。';kpQueueCloudSync();});
window.addEventListener('offline',()=>{const x=$('#backupStatus');if(x)x.textContent='当前离线。本地加密保存正常；云同步等待联网。'});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&cryptoKey)kpMaybeDailySnapshot();});


/* Visual & Motion Studio: presentation preferences only; never touches encrypted vault data. */
const KP_VISUAL_PREF_KEY='kp.visual.preferences.v1';
const KP_VISUAL_DEFAULTS={theme:'qore',font:'system',density:'comfortable',radius:18,accent:'#5b5ce2',background:'#f6f7fb',paper:'#ffffff',layout:'balanced',width:'wide',columns:'2',spacing:'comfortable',nav:'top',motion:'rise',speed:420,amplitude:12,direction:'up'};
const KP_VISUAL_THEMES=[
 {id:'qore',name:'QORE 冰雾玻璃',bg:'#f4f5ff',paper:'#ffffff',ink:'#222c4a',muted:'#77819b',line:'#e4e7f3',accent:'#5b5ce2'},
 {id:'editorial',name:'Editorial 纸感',bg:'#f4f0e8',paper:'#fffdf8',ink:'#302d29',muted:'#81786d',line:'#e7dfd2',accent:'#a66b45'},
 {id:'ocean',name:'Ocean Mist',bg:'#eaf3f4',paper:'#fbffff',ink:'#203b43',muted:'#71888d',line:'#d7e5e6',accent:'#267f91'},
 {id:'sunshine',name:'阳光 Sunshine',bg:'#fff7e9',paper:'#fffefa',ink:'#473a28',muted:'#91816a',line:'#f0e3cc',accent:'#df9a35'},
 {id:'mint',name:'薄荷 Mint',bg:'#edf7f1',paper:'#fcfffd',ink:'#234238',muted:'#748e83',line:'#dcebe2',accent:'#319b78'},
 {id:'peach',name:'蜜桃 Peach',bg:'#fff1ed',paper:'#fffdfc',ink:'#503b39',muted:'#9a7d78',line:'#f0dfda',accent:'#d77c72'},
 {id:'lavender',name:'薰衣草 Lavender',bg:'#f4f0fb',paper:'#fffefe',ink:'#3c3451',muted:'#877d9d',line:'#e6def2',accent:'#8870c9'}
];
let kpVisualPrefs={...KP_VISUAL_DEFAULTS},kpVisualListenersBound=false;
function kpLoadVisualPrefs(){try{const saved=JSON.parse(localStorage.getItem(KP_VISUAL_PREF_KEY)||'{}');kpVisualPrefs={...KP_VISUAL_DEFAULTS,...saved};}catch{kpVisualPrefs={...KP_VISUAL_DEFAULTS};}kpApplyVisualPrefs();}
function kpSaveVisualPrefs(){try{localStorage.setItem(KP_VISUAL_PREF_KEY,JSON.stringify(kpVisualPrefs));}catch{}}
function kpApplyVisualPrefs(){
 const p=kpVisualPrefs,t=KP_VISUAL_THEMES.find(x=>x.id===p.theme)||KP_VISUAL_THEMES[0],body=document.body;
 const bg=p.theme==='custom'?p.background:t.bg,paper=p.theme==='custom'?p.paper:t.paper,accent=p.accent||t.accent;
 body.classList.add('kp-customized');
 body.classList.remove('kp-density-compact','kp-density-comfortable','kp-density-loose','kp-layout-editorial','kp-layout-balanced','kp-layout-vertical','kp-layout-compact','kp-layout-bento','kp-layout-split','kp-layout-wide','kp-layout-standard','kp-layout-full','kp-nav-top','kp-nav-left','kp-nav-right','kp-nav-bottom','kp-nav-floating','kp-nav-hidden','kp-motion-none','kp-motion-fade','kp-motion-rise','kp-motion-float','kp-motion-glow','kp-motion-slide');
 body.classList.add('kp-density-'+p.density,'kp-layout-'+p.layout,'kp-layout-'+p.width,'kp-nav-'+p.nav,'kp-motion-'+p.motion);
 const root=document.documentElement.style;
 root.setProperty('--kp-user-bg',bg);root.setProperty('--kp-user-paper',paper);root.setProperty('--kp-user-ink',t.ink);root.setProperty('--kp-user-muted',t.muted);root.setProperty('--kp-user-line',t.line);root.setProperty('--kp-user-accent',accent);root.setProperty('--kp-user-radius',(Number(p.radius)||18)+'px');root.setProperty('--kp-user-card-pad',p.density==='compact'?'12px':p.density==='loose'?'25px':'19px');root.setProperty('--kp-user-gap',p.spacing==='compact'?'8px':p.spacing==='loose'?'20px':'14px');root.setProperty('--kp-user-columns',p.layout==='vertical'?'1':p.columns==='auto'?'2':p.columns);root.setProperty('--kp-user-width',p.width==='custom'?'1240px':p.width==='full'?'none':p.width==='standard'?'1100px':'1380px');root.setProperty('--kp-user-motion-duration',(Number(p.speed)||420)+'ms');const d=Math.max(0,Number(p.amplitude)||0);root.setProperty('--kp-user-motion-start',p.direction==='down'?'translateY(-'+d+'px)':p.direction==='left'?'translateX('+d+'px)':p.direction==='right'?'translateX(-'+d+'px)':'translateY('+d+'px)');
 const fonts={system:'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif',rounded:'"Arial Rounded MT Bold","PingFang SC","Microsoft YaHei",sans-serif',serif:'Georgia,"Songti SC","SimSun",serif',mono:'ui-monospace,SFMono-Regular,Consolas,monospace'};
 root.setProperty('--kp-user-font',fonts[p.font]||fonts.system);
 body.style.background=bg;body.style.color=t.ink;
 document.querySelectorAll('.card,.stat,.modal,.lock-card').forEach(n=>{n.style.borderColor=t.line;n.style.borderRadius=(Number(p.radius)||18)+'px';});
}
function kpVisualChoice(group,value,label,swatches=''){return '<button type="button" class="kp-choice '+(kpVisualPrefs[group]===value?'active':'')+'" data-vgroup="'+group+'" data-vvalue="'+value+'">'+(swatches?'<span class="kp-swatch">'+swatches+'</span>':'')+label+'</button>';}
function kpVisualSwatches(colors){return colors.map(c=>'<i style="background:'+c+'"></i>').join('');}
function kpVisualTab(tab){document.querySelectorAll('[data-vtab]').forEach(b=>b.classList.toggle('active',b.dataset.vtab===tab));const host=$('#kpVisualContent');if(!host)return;
 if(tab==='theme'){
  host.innerHTML='<div class="kp-setting-group"><h3>主题与配色</h3><div class="kp-choice-grid">'+KP_VISUAL_THEMES.map(t=>kpVisualChoice('theme',t.id,t.name,kpVisualSwatches([t.bg,t.paper,t.accent]))).join('')+kpVisualChoice('theme','custom','自定义配色',kpVisualSwatches([kpVisualPrefs.background,kpVisualPrefs.paper,kpVisualPrefs.accent]))+'</div><div class="kp-setting-row"><label for="kpAccent">强调色</label><input id="kpAccent" type="color" value="'+kpVisualPrefs.accent+'"></div><div class="kp-setting-row"><label for="kpBackground">页面背景</label><input id="kpBackground" type="color" value="'+kpVisualPrefs.background+'"></div><div class="kp-setting-row"><label for="kpPaper">卡片颜色</label><input id="kpPaper" type="color" value="'+kpVisualPrefs.paper+'"></div></div><div class="kp-setting-group"><h3>字体与卡片</h3><div class="kp-setting-row"><label>字体</label><select id="kpFont"><option value="system">系统默认</option><option value="rounded">圆润现代</option><option value="serif">人文衬线</option><option value="mono">等宽技术</option></select></div><div class="kp-setting-row"><label>内容密度</label><select id="kpDensity"><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="loose">宽松</option></select></div><div class="kp-setting-row"><label>圆角 <span id="kpRadiusValue">'+kpVisualPrefs.radius+'px</span></label><input id="kpRadius" type="range" min="8" max="28" value="'+kpVisualPrefs.radius+'"></div></div>';
  $('#kpFont').value=kpVisualPrefs.font;$('#kpDensity').value=kpVisualPrefs.density;
 }else if(tab==='motion'){
  host.innerHTML='<div class="kp-setting-group"><h3>页面动效 · Motion Lab</h3><div class="kp-choice-grid">'+[['none','关闭'],['fade','柔和淡入'],['rise','轻盈上浮'],['float','漂浮显现'],['glow','光感聚焦'],['slide','侧向滑入']].map(x=>kpVisualChoice('motion',x[0],x[1])).join('')+'</div><div class="kp-setting-row"><label>动效速度 <span id="kpSpeedValue">'+kpVisualPrefs.speed+'ms</span></label><input id="kpSpeed" type="range" min="150" max="1200" step="50" value="'+kpVisualPrefs.speed+'"></div><div class="kp-setting-row"><label>动效幅度 <span id="kpAmplitudeValue">'+kpVisualPrefs.amplitude+'px</span></label><input id="kpAmplitude" type="range" min="0" max="30" value="'+kpVisualPrefs.amplitude+'"></div><div class="kp-setting-row"><label>方向</label><select id="kpDirection"><option value="up">向上</option><option value="down">向下</option><option value="left">向左</option><option value="right">向右</option></select></div></div><div class="kp-visual-preview"><strong style="font-size:12px">实时预览</strong><article class="card" style="animation:kpRise var(--kp-user-motion-duration) ease both"><div class="cardtop"><div class="provider-icon">KP</div><div class="cardtitle"><h3>KeyPocket Preview</h3><p>主题、字体、圆角与动效预览</p></div></div><div class="secret"><code>sk-preview••••••••••••</code></div><span class="tag">安全 · 本地优先</span></article></div>';
  $('#kpDirection').value=kpVisualPrefs.direction;
 }else{
  host.innerHTML='<div class="kp-setting-group"><h3>布局预设</h3><div class="kp-choice-grid">'+[['editorial','Editorial'],['balanced','Balanced'],['vertical','Vertical'],['compact','Compact'],['bento','Bento'],['split','Split']].map(x=>kpVisualChoice('layout',x[0],x[1])).join('')+'</div><div class="kp-setting-row"><label>内容宽度</label><select id="kpWidth"><option value="full">全宽</option><option value="wide">宽屏</option><option value="standard">标准</option><option value="custom">自定义 1240px</option></select></div><div class="kp-setting-row"><label>卡片列数</label><select id="kpColumns"><option value="1">单列</option><option value="2">双列</option><option value="3">三列</option><option value="auto">自动</option></select></div><div class="kp-setting-row"><label>卡片间距</label><select id="kpSpacing"><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="loose">宽松</option></select></div></div><div class="kp-setting-group"><h3>导航栏位置</h3><div class="kp-choice-grid">'+[['top','顶部'],['left','左侧'],['right','右侧'],['bottom','底部'],['floating','悬浮'],['hidden','隐藏']].map(x=>kpVisualChoice('nav',x[0],x[1])).join('')+'</div><p class="hint" style="font-size:11px;color:var(--muted);margin:10px 0 0">隐藏导航后，仍可通过此设置菜单切换回其他布局。</p></div>';
  $('#kpWidth').value=kpVisualPrefs.width;$('#kpColumns').value=kpVisualPrefs.columns;$('#kpSpacing').value=kpVisualPrefs.spacing;
 }
}
function kpOpenVisualStudio(){
 openModal('<div class="kp-visual-panel"><h2>视觉与动效</h2><p class="sub">自定义 KeyPocket 的外观与交互体验。设置仅保存在当前浏览器，不会修改密钥库数据。</p><nav class="kp-visual-tabs" aria-label="视觉设置"><button class="active" data-vtab="theme" type="button">主题与字体</button><button data-vtab="motion" type="button">动效 Motion Lab</button><button data-vtab="layout" type="button">页面布局</button></nav><div id="kpVisualContent" class="kp-visual-content"></div><div class="kp-visual-actions"><button class="btn ghost" id="kpVisualExport" type="button">导出设置 JSON</button><div><button class="btn" id="kpVisualReset" type="button">恢复默认</button> <button class="btn primary" data-action="close" type="button">完成</button></div></div></div>');
 kpVisualTab('theme');
 if(kpVisualListenersBound)return;kpVisualListenersBound=true;
 $('#modalRoot').addEventListener('click',e=>{const tab=e.target.closest('[data-vtab]');if(tab){kpVisualTab(tab.dataset.vtab);return;}const choice=e.target.closest('[data-vgroup]');if(choice){kpVisualPrefs[choice.dataset.vgroup]=choice.dataset.vvalue;if(choice.dataset.vgroup==='theme'&&choice.dataset.vvalue!=='custom'){const t=KP_VISUAL_THEMES.find(x=>x.id===choice.dataset.vvalue);kpVisualPrefs.accent=t.accent;kpVisualPrefs.background=t.bg;kpVisualPrefs.paper=t.paper;}kpSaveVisualPrefs();kpApplyVisualPrefs();const active=document.querySelector('[data-vtab].active')?.dataset.vtab||'theme';kpVisualTab(active);return;}if(e.target.id==='kpVisualReset'){kpVisualPrefs={...KP_VISUAL_DEFAULTS};kpSaveVisualPrefs();kpApplyVisualPrefs();kpVisualTab('theme');showToast('视觉设置已恢复默认');}if(e.target.id==='kpVisualExport'){const blob=new Blob([JSON.stringify(kpVisualPrefs,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='keypocket-visual-settings.json';a.click();URL.revokeObjectURL(url);showToast('设置文件已导出');}});
 $('#modalRoot').addEventListener('input',e=>{const map={kpAccent:'accent',kpBackground:'background',kpPaper:'paper',kpRadius:'radius',kpSpeed:'speed',kpAmplitude:'amplitude'};if(map[e.target.id]){kpVisualPrefs[map[e.target.id]]=e.target.type==='range'?Number(e.target.value):e.target.value;if(e.target.id==='kpBackground'||e.target.id==='kpPaper')kpVisualPrefs.theme='custom';if(e.target.id==='kpRadius')$('#kpRadiusValue').textContent=e.target.value+'px';if(e.target.id==='kpSpeed')$('#kpSpeedValue').textContent=e.target.value+'ms';if(e.target.id==='kpAmplitude')$('#kpAmplitudeValue').textContent=e.target.value+'px';kpSaveVisualPrefs();kpApplyVisualPrefs();}});
 $('#modalRoot').addEventListener('change',e=>{const map={kpFont:'font',kpDensity:'density',kpDirection:'direction',kpWidth:'width',kpColumns:'columns',kpSpacing:'spacing'};if(map[e.target.id]){kpVisualPrefs[map[e.target.id]]=e.target.value;kpSaveVisualPrefs();kpApplyVisualPrefs();}});
}
$('#visualSettingsBtn')?.addEventListener('click',kpOpenVisualStudio);
kpLoadVisualPrefs();
