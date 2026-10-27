'use strict';
const DB_NAME='keypocket-local-v1', DB_VERSION=1, STORE='vault';
const KEYPOCKET_PENDING_SKILL_KEY='kp.radar.pending-skills.v1';
const $=s=>document.querySelector(s); let db, cryptoKey=null, vault=null, records=[], projects=[], editId=null, toastTimer=null;
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
function normalizeProject(p){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('项目数据格式无效。');const limits={name:100,repoUrl:500,appUrl:500,category:50,stack:160,notes:500,tags:200};for(const [k,max] of Object.entries(limits))if(p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>max))throw Error('项目字段格式无效。');if(typeof p.id!=='string'||!p.id||p.id.length>100||typeof p.name!=='string'||!p.name.trim())throw Error('项目名称不能为空。');for(const k of ['repoUrl','appUrl'])if(p[k]&&!validWebUrl(p[k]))throw Error('仓库和应用地址必须是有效的 HTTPS 或 HTTP 链接。');return {id:p.id,name:p.name.trim(),repoUrl:(p.repoUrl||'').trim(),appUrl:(p.appUrl||'').trim(),category:(p.category||'其他').trim(),stack:(p.stack||'').trim(),notes:(p.notes||'').trim(),tags:(p.tags||'').trim(),favorite:p.favorite===true,createdAt:Number.isFinite(p.createdAt)?p.createdAt:Date.now(),updatedAt:Number.isFinite(p.updatedAt)?p.updatedAt:Date.now()};}
function validWebUrl(v){try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
function repoTitle(url){try{const u=new URL(url);if(u.hostname==='github.com'){const parts=u.pathname.split('/').filter(Boolean);if(parts.length>=2)return parts[1].replace(/\.git$/,'')+' · '+parts[0];}}catch{}return '';}
function providerById(id){return PROVIDERS.find(p=>p.id===id)||PROVIDERS[PROVIDERS.length-1];}
function normalizeBackupRecords(items){if(!Array.isArray(items)||items.length>5000)throw Error('备份结构不正确。');const seen=new Set(),allowed=new Set(PROVIDERS.map(p=>p.id));return items.map(r=>{if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>100||r.id==='vault-meta'||seen.has(r.id)||typeof r.key!=='string'||!r.key||r.key.length>20000||typeof r.provider!=='string'||!allowed.has(r.provider))throw Error('备份记录格式无效或包含重复 ID。');seen.add(r.id);const limits={name:80,purpose:100,project:100,notes:240,providerName:100};for(const [field,max] of Object.entries(limits)){if(r[field]!==undefined&&(typeof r[field]!=='string'||r[field].length>max))throw Error('备份记录字段格式无效。');}if(r.tags!==undefined&&(!Array.isArray(r.tags)||r.tags.length>12||r.tags.some(t=>typeof t!=='string'||t.length>160)))throw Error('备份标签格式无效。');if(r.favorite!==undefined&&typeof r.favorite!=='boolean')throw Error('备份收藏状态无效。');for(const field of ['createdAt','updatedAt'])if(r[field]!==undefined&&(!Number.isFinite(r[field])||r[field]<0))throw Error('备份时间字段无效。');const provider=providerById(r.provider);return {id:r.id,key:r.key,provider:r.provider,providerName:provider.name,name:typeof r.name==='string'?r.name:provider.name,purpose:typeof r.purpose==='string'?r.purpose:'',project:typeof r.project==='string'?r.project:'',tags:Array.isArray(r.tags)?r.tags.slice():[],notes:typeof r.notes==='string'?r.notes:'',favorite:r.favorite===true,createdAt:Number.isFinite(r.createdAt)?r.createdAt:Date.now(),updatedAt:Number.isFinite(r.updatedAt)?r.updatedAt:Date.now()};});}
function identifyProvider(key){const k=key.trim();if(/^sk-proj-/.test(k))return {provider:'openai',confidence:'high',reason:'匹配 OpenAI 项目密钥前缀'};if(/^sk-ant-/.test(k))return {provider:'anthropic',confidence:'high',reason:'匹配 Anthropic 密钥前缀'};if(/^sk-or-v1-/.test(k))return {provider:'openrouter',confidence:'high',reason:'匹配 OpenRouter 密钥前缀'};if(/^AIza[0-9A-Za-z_-]{20,}$/.test(k))return {provider:'gemini',confidence:'high',reason:'匹配 Google API Key 格式'};if(/^github_pat_/.test(k)||/^gh[pousr]_[A-Za-z0-9_]{20,}$/.test(k))return {provider:'github',confidence:'high',reason:'匹配 GitHub Token 前缀'};if(/^v1\.0-[A-Fa-f0-9-]{20,}$/.test(k))return {provider:'cloudflare',confidence:'medium',reason:'格式相似，建议人工确认'};if(/^sk-[A-Za-z0-9_-]{20,}$/.test(k))return {provider:'',confidence:'low',reason:'多个服务商使用相似格式，无法可靠区分'};return {provider:'',confidence:'none',reason:'未找到可靠的格式匹配'};}
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),2600);}
function showLockNotice(msg,type='error'){const n=$('#lockNotice');n.textContent=msg;n.className='notice '+type;}
function setView(locked){$('#lockView').classList.toggle('hidden',!locked);$('#mainView').classList.toggle('hidden',locked);}
async function init(){if(!window.crypto?.subtle||!window.indexedDB){$('#lockDesc').textContent='当前浏览器不支持所需的安全加密功能，请使用最新版 HTTPS 浏览器。';$('#unlockBtn').disabled=true;return;}try{db=await openDB();vault=await getItem('vault-meta');const all=await allItems();const hasData=all.some(x=>x.id!=='vault-meta');if(!vault&&hasData){$('#lockTitle').textContent='检测到本地数据，但密钥库信息缺失';$('#lockDesc').textContent='为保护已有数据，KeyPocket 已阻止创建新密码。请回到最初保存密钥的浏览器/设备和原网址打开；不要清理网站数据。此页面中的数据未被删除。';$('#unlockBtn').textContent='暂不可创建密码';$('#unlockBtn').disabled=true;$('#confirmWrap').classList.add('hidden');$('#resetLocalBtn').classList.add('hidden');showLockNotice('安全保护已启动：发现现有记录但缺少密钥库元数据，已阻止覆盖。','error');setView(true);return;}$('#lockTitle').textContent=vault?'欢迎回来':'创建你的本地密钥库';$('#lockDesc').textContent=vault?'输入本地密码解锁。密码不会上传，也无法由我们找回。':'设置一个至少 10 位的本地密码。它将用于加密密钥，且不会上传。';$('#unlockBtn').textContent=vault?'解锁密钥库':'创建本地密钥库';$('#confirmWrap').classList.toggle('hidden',!!vault);$('#resetLocalBtn').classList.toggle('hidden',!vault);setView(true);}catch(err){$('#lockTitle').textContent='本地密钥库暂时无法读取';$('#lockDesc').textContent='读取本地存储时发生错误。请勿清除网站数据，刷新后重试；如仍失败，请保留此页面并反馈错误。';showLockNotice(err.message||'初始化失败。','error');$('#unlockBtn').disabled=true;setView(true);}}
$('#unlockForm').addEventListener('submit',async e=>{e.preventDefault();const pass=$('#masterPassword').value,confirm=$('#confirmPassword').value,btn=$('#unlockBtn');if(btn.disabled)return;const originalLabel=btn.textContent;btn.disabled=true;btn.textContent=vault?'正在验证密码…':'正在创建加密密钥…';showLockNotice(vault?'正在验证密码并读取本地加密数据，请勿关闭页面。':'正在创建本地加密密钥库，请稍候。','info');try{window.kpSyncMasterPassword=pass;if(!vault){if(pass.length<10)throw Error('密码至少需要 10 位。');if(pass!==confirm)throw Error('两次输入的密码不一致。');const salt=randomBytes(16);cryptoKey=await deriveKey(pass,salt);btn.textContent='正在安全保存…';const verifier=await encryptJson({check:'keypocket-v1'});vault={id:'vault-meta',salt:toB64(salt),iterations:310000,verifier};await putItem(vault);records=[];projects=[];showToast('本地密钥库已创建');}else{cryptoKey=await deriveKey(pass,fromB64(vault.salt),vault.iterations||310000);btn.textContent='正在读取本地记录…';const check=await decryptJson(vault.verifier);if(check.check!=='keypocket-v1')throw Error('密码校验失败，或本地数据已损坏。');const stored=(await allItems()).filter(x=>x.id!=='vault-meta');records=await Promise.all(stored.filter(x=>x.kind!=='project'&&!x.id.startsWith('project:')).map(openRecord));projects=await Promise.all(stored.filter(x=>x.kind==='project'||x.id.startsWith('project:')).map(openProject));showToast('已安全解锁');}$('#masterPassword').value='';$('#confirmPassword').value='';$('#lockNotice').className='notice hidden';setView(false);render();renderProjects();updateRadarImportButton();if(readPendingRadarSkills().length)openPendingRadarSkillModal();}catch(err){cryptoKey=null;const msg=err&&err.name==='OperationError'?'密码不正确，或本地加密数据已损坏。':(err.message||'解锁失败，请重试。');showLockNotice(msg,'error');}finally{btn.disabled=false;btn.textContent=vault?'解锁密钥库':originalLabel;}});
$('#resetLocalBtn').addEventListener('click',async()=>{if(!confirm('这将永久删除此浏览器中的全部密钥与本地库，无法撤销。确定继续？'))return;const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=()=>{vault=null;cryptoKey=null;records=[];projects=[];$('#masterPassword').value='';$('#lockTitle').textContent='创建你的本地密钥库';$('#lockDesc').textContent='设置一个至少 10 位的本地密码。';$('#confirmWrap').classList.remove('hidden');$('#resetLocalBtn').classList.add('hidden');$('#unlockBtn').textContent='创建本地密钥库';showLockNotice('本地库已清空，可以设置新密码。','ok');};});
$('#lockBtn').addEventListener('click',()=>{cryptoKey=null;window.kpSyncMasterPassword=null;records=[];projects=[];setView(true);$('#lockTitle').textContent='密钥库已锁定';$('#lockDesc').textContent='输入本地密码重新解锁。';$('#unlockBtn').textContent='解锁密钥库';$('#confirmWrap').classList.add('hidden');$('#masterPassword').focus();});
function render(){const query=$('#searchInput').value.trim().toLowerCase(),filter=$('#providerFilter').value;const shown=records.filter(r=>(!filter||r.provider===filter)&&(!query||[r.name,r.providerName,r.purpose,r.project,r.notes,...(r.tags||[])].join(' ').toLowerCase().includes(query))).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt-a.updatedAt);$('#totalCount').textContent=records.length;$('#providerCount').textContent=new Set(records.map(r=>r.provider)).size;$('#favoriteCount').textContent=records.filter(r=>r.favorite).length;$('#listCount').textContent=`${shown.length} 条记录`;const select=$('#providerFilter'),old=select.value;select.innerHTML='<option value="">全部服务商</option>'+[...new Set(records.map(r=>r.provider))].map(id=>`<option value="${esc(id)}">${esc(providerById(id).name)}</option>`).join('');select.value=records.some(r=>r.provider===old)?old:'';const cards=$('#cards');if(!shown.length){cards.innerHTML=`<div class="empty"><div class="big">⌘</div><h3>${records.length?'没有找到匹配的密钥':'你的口袋还是空的'}</h3><p>${records.length?'试试更换关键词或筛选条件。':'添加第一个 API Key，之后就能快速查找和复制。'}</p>${records.length?'':'<button class="btn primary" data-action="add">＋ 新增 API Key</button>'}</div>`;return;}cards.innerHTML=shown.map(r=>{const p=providerById(r.provider);return `<article class="card" data-id="${esc(r.id)}"><div class="cardtop"><div class="provider-icon">${esc(p.short)}</div><div class="cardtitle"><h3>${esc(r.name||p.name)} ${r.favorite?'★':''}</h3><p>${esc(p.name)} · ${esc(r.purpose||'未填写用途')}</p></div><button class="dots" data-action="menu" aria-label="更多操作" title="更多操作">⋯</button></div><div class="secret"><code>${esc(mask(r.key))}</code><button data-action="reveal" title="临时显示密钥" aria-label="临时显示密钥">◉</button></div><div class="tags">${r.project?`<span class="tag">项目：${esc(r.project)}</span>`:''}${(r.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}<span class="tag">更新于 ${new Date(r.updatedAt).toLocaleDateString()}</span></div><div class="cardactions"><button class="btn primary copy" data-action="copy">复制 Key</button><button class="btn" data-action="edit">编辑</button><button class="btn" data-action="favorite">${r.favorite?'取消收藏':'收藏'}</button></div></article>`}).join('');}
function mask(k){if(!k)return '未填写密钥';if(k.length<9)return '•'.repeat(k.length);return k.slice(0,4)+'•'.repeat(Math.min(18,k.length-8))+k.slice(-4);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function openModal(html){$('#modalRoot').innerHTML=`<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true">${html}</section></div>`;const first=$('#modalRoot input:not([type=hidden]),#modalRoot select');if(first)first.focus();}
function closeModal(){$('#modalRoot').innerHTML='';editId=null;}
function providerOptions(selected){return PROVIDERS.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');}
function addEditModal(rec=null,rawKey=''){editId=rec?.id||null;const guessed=identifyProvider(rawKey||rec?.key||'');const provider=rec?.provider||(guessed.confidence==='high'?guessed.provider:'custom');openModal(`<h2>${rec?'编辑密钥':'新增 API Key'}</h2><p class="sub">密钥仅在本地加密保存。不要把生产密钥粘贴到公共或共享设备。</p><form id="recordForm"><div class="field"><label for="keyInput">API Key <span style="color:#b93636">*</span></label><textarea id="keyInput" required autocomplete="off" spellcheck="false" placeholder="粘贴 API Key" rows="3">${esc(rec?.key||rawKey)}</textarea><div id="detectHint" class="hint">${esc(guessed.reason||'粘贴后将尝试在本地识别服务商')}</div></div><div class="grid2"><div class="field"><label for="providerInput">服务商</label><select id="providerInput">${providerOptions(provider)}</select></div><div class="field"><label for="nameInput">密钥名称</label><input id="nameInput" maxlength="80" placeholder="例如：个人开发 Key" value="${esc(rec?.name||'')}"></div></div><div class="grid2"><div class="field"><label for="purposeInput">用途</label><input id="purposeInput" maxlength="100" placeholder="例如：测试 / 生产 / Agent" value="${esc(rec?.purpose||'')}"></div><div class="field"><label for="projectInput">项目（可选）</label><input id="projectInput" maxlength="100" placeholder="例如：KeyPocket" value="${esc(rec?.project||'')}"></div></div><div class="field"><label for="tagsInput">标签（可选，用逗号分隔）</label><input id="tagsInput" maxlength="160" placeholder="开发, 个人, 测试" value="${esc((rec?.tags||[]).join(', '))}"></div><div class="field"><label for="notesInput">备注（可选）</label><input id="notesInput" maxlength="240" placeholder="控制台地址、轮换提示等，不要写入其他密码" value="${esc(rec?.notes||'')}"></div><div id="formNotice" class="notice info">自动识别仅依据本地格式规则；格式相似时请手动确认服务商。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">${rec?'保存修改':'加密保存'}</button></div></form>`);
$('#keyInput').addEventListener('input',()=>{const g=identifyProvider($('#keyInput').value);$('#detectHint').textContent=g.reason;$('#detectHint').style.color=g.confidence==='high'?'#147d55':'#788293';if(g.confidence==='high'&&!editId)$('#providerInput').value=g.provider;});$('#providerInput').addEventListener('change',()=>{$('#detectHint').textContent='已由你选择服务商：'+providerById($('#providerInput').value).name;});$('#recordForm').addEventListener('submit',async e=>{e.preventDefault();const key=$('#keyInput').value.trim();if(!key){$('#keyInput').focus();return;}const provider=$('#providerInput').value,p=providerById(provider);const now=Date.now();const item={id:editId||crypto.randomUUID(),key,provider,providerName:p.name,name:$('#nameInput').value.trim()||p.name,purpose:$('#purposeInput').value.trim(),project:$('#projectInput').value.trim(),tags:$('#tagsInput').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12),notes:$('#notesInput').value.trim(),favorite:rec?.favorite||false,createdAt:rec?.createdAt||now,updatedAt:now};try{await putItem(await sealRecord(item));records=records.filter(x=>x.id!==item.id);records.push(item);closeModal();render();showToast(rec?'修改已加密保存':'密钥已加密保存');}catch(err){$('#formNotice').className='notice error';$('#formNotice').textContent='保存失败：'+(err.message||'请重试');}});}
$('#cards').addEventListener('click',async e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;if(action==='add'){addEditModal();return;}const card=btn.closest('[data-id]');if(!card)return;const r=records.find(x=>x.id===card.dataset.id);if(!r)return;if(action==='copy'){try{await navigator.clipboard.writeText(r.key);showToast('已复制完整 Key 到剪贴板');}catch{openModal(`<h2>复制未获授权</h2><p class="sub">浏览器未允许直接写入剪贴板。你可以手动复制下面的密钥。</p><div class="field"><textarea readonly rows="4">${esc(r.key)}</textarea></div><div class="modal-actions"><button class="btn primary" data-action="close">完成</button></div>`);}}else if(action==='edit')addEditModal(r);else if(action==='favorite'){r.favorite=!r.favorite;r.updatedAt=Date.now();await putItem(await sealRecord(r));render();showToast(r.favorite?'已加入收藏':'已取消收藏');}else if(action==='reveal'){openModal(`<h2>查看完整密钥</h2><p class="sub">请确认当前屏幕没有被他人看到。关闭窗口后会重新隐藏。</p><div class="field"><textarea readonly rows="4">${esc(r.key)}</textarea></div><div class="modal-actions"><button class="btn" data-action="close">关闭</button><button class="btn primary" data-action="modalcopy" data-id="${esc(r.id)}">复制 Key</button></div>`);}else if(action==='menu'){openModal(`<h2>${esc(r.name)}</h2><p class="sub">${esc(providerById(r.provider).name)} · ${esc(r.purpose||'未填写用途')}</p><div class="cardactions" style="flex-wrap:wrap"><button class="btn" data-action="edit" data-id="${esc(r.id)}">编辑信息</button><button class="btn" data-action="favorite" data-id="${esc(r.id)}">${r.favorite?'取消收藏':'加入收藏'}</button><button class="btn danger" data-action="delete" data-id="${esc(r.id)}">删除密钥</button></div><div class="modal-actions"><button class="btn" data-action="close">关闭</button></div>`);}});
$('#modalRoot').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;if(a==='close'||a==='backdrop'&&e.target===b){closeModal();return;}const id=b.dataset.id,r=records.find(x=>x.id===id);if(a==='modalcopy'&&r){try{await navigator.clipboard.writeText(r.key);closeModal();showToast('已复制完整 Key 到剪贴板');}catch{showToast('复制失败，请检查浏览器权限');}}if(a==='edit'&&r){addEditModal(r);return;}if(a==='favorite'&&r){r.favorite=!r.favorite;r.updatedAt=Date.now();await putItem(await sealRecord(r));closeModal();render();showToast(r.favorite?'已加入收藏':'已取消收藏');}if(a==='delete'&&r){if(confirm(`确定删除「${r.name}」？删除后无法撤销，请确保已有备份（如需要）。`)){await deleteItem(r.id);records=records.filter(x=>x.id!==r.id);closeModal();render();showToast('密钥已从本地删除');}}});
$('#addKeyBtn')?.addEventListener('click',()=>addEditModal());$('#searchInput').addEventListener('input',render);$('#providerFilter').addEventListener('change',render);$('#exportBtn').addEventListener('click',()=>openModal(`<h2>导出加密备份</h2><p class="sub">备份包含全部密钥记录，并使用独立备份密码加密。建议使用不同于本地解锁密码的长密码。</p><form id="exportForm"><div class="field"><label for="backupPassword">备份密码</label><input id="backupPassword" type="password" minlength="10" required autocomplete="new-password" placeholder="至少 10 位"></div><div class="field"><label for="backupConfirm">确认备份密码</label><input id="backupConfirm" type="password" minlength="10" required autocomplete="new-password" placeholder="再次输入"></div><div class="notice warn">丢失备份密码将无法恢复备份。导出的文件请保存到可信位置。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">生成加密备份</button></div></form>`));
$('#modalRoot').addEventListener('submit',async e=>{if(e.target.id!=='exportForm')return;e.preventDefault();const p=$('#backupPassword').value,c=$('#backupConfirm').value;if(p.length<10||p!==c){showToast(p!==c?'两次备份密码不一致':'备份密码至少 10 位');return;}try{const salt=randomBytes(16),key=await deriveKey(p,salt),payload=await encryptJson({format:'keypocket-backup',version:1,createdAt:new Date().toISOString(),records,projects},key);const file={app:'KeyPocket',version:1,createdAt:new Date().toISOString(),kdf:{name:'PBKDF2-SHA-256',iterations:310000,salt:toB64(salt)},cipher:{name:'AES-256-GCM',...payload}};const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`keypocket-backup-${new Date().toISOString().slice(0,10)}.keypocket`;a.click();URL.revokeObjectURL(url);closeModal();showToast('加密备份已生成');}catch(err){showToast('备份失败：'+err.message);}});
$('#importBtn').addEventListener('click',()=>$('#backupFile').click());$('#backupFile').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('备份文件不能超过 10 MB。');const raw=JSON.parse(await file.text());if(raw.app!=='KeyPocket'||raw.version!==1||raw.cipher?.name!=='AES-256-GCM'||raw.kdf?.name!=='PBKDF2-SHA-256')throw Error('这不是受支持的 KeyPocket 备份文件。');if(!Number.isInteger(raw.kdf.iterations)||raw.kdf.iterations<100000||raw.kdf.iterations>1000000)throw Error('备份加密参数无效。');if(fromB64(raw.kdf.salt).length!==16||fromB64(raw.cipher.iv).length!==12||fromB64(raw.cipher.data).length<16)throw Error('备份数据结构无效。');openModal(`<h2>恢复加密备份</h2><p class="sub">文件创建时间：${esc(raw.cipher?new Date(raw.createdAt||Date.now()).toLocaleString():'未知')}。解密将在本地完成。</p><form id="importForm"><div class="field"><label for="importPassword">备份密码</label><input id="importPassword" type="password" required autocomplete="current-password" placeholder="输入导出时设置的密码"></div><div class="field"><label>导入方式</label><select id="importMode"><option value="merge">合并到现有密钥库（同 ID 覆盖）</option><option value="replace">替换当前所有记录</option></select></div><div class="notice warn">替换会删除当前密钥库中的所有记录。建议先导出当前备份。</div><div id="importNotice" class="notice hidden"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">解密并导入</button></div></form>`);$('#importForm').addEventListener('submit',async ev=>{ev.preventDefault();const pass=$('#importPassword').value;try{const key=await deriveKey(pass,fromB64(raw.kdf.salt),raw.kdf.iterations||310000),data=await decryptJson(raw.cipher,key);if(data.format!=='keypocket-backup'||data.version!==1)throw Error('备份结构不正确。');const incoming=normalizeBackupRecords(data.records),incomingProjects=(Array.isArray(data.projects)?data.projects:[]).map(normalizeProject),mode=$('#importMode').value,encrypted=await Promise.all(incoming.map(sealRecord)),encryptedProjects=await Promise.all(incomingProjects.map(sealProject));if(mode==='replace'){await writeItems([vault,...encrypted,...encryptedProjects],true);records=incoming;projects=incomingProjects;}else{await writeItems([...encrypted,...encryptedProjects]);for(const r of incoming){records=records.filter(x=>x.id!==r.id);records.push(r);}for(const p of incomingProjects){projects=projects.filter(x=>x.id!==p.id);projects.push(p);}}closeModal();render();renderProjects();showToast(`成功导入 ${incoming.length} 条密钥与 ${incomingProjects.length} 个项目`);}catch(err){const n=$('#importNotice');n.textContent='无法解密或备份无效，请检查密码与文件。';n.className='notice error';}});}catch(err){showToast(err.message||'读取备份失败');}});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!$('#mainView').classList.contains('hidden')){e.preventDefault();$('#searchInput').focus();}});
init().catch(e=>{showLockNotice('初始化失败：'+(e.message||'浏览器不支持本地存储'));});
// Project pocket: metadata is encrypted before entering IndexedDB; GitHub URLs are saved locally without OAuth tokens.
function isOwnGithubRepo(url){const path=githubRepoPath(url||'');return !!path&&path.owner.toLowerCase()==='chenzhe223-tech';}
function projectSource(p){if(isOwnGithubRepo(p.repoUrl))return 'mine';if(p.repoUrl)return 'external';return 'other';}
function isExternalSkillProject(p){return projectSource(p)==='external'&&(/skill/i.test([p.name,p.category,p.tags].join(' '))||/skill/i.test(p.notes||'')||/AI 前沿简报|公开仓库/.test(p.notes||''));}
function skillCategory(p){
 const s=[p.name,p.category,p.stack,p.tags,p.notes].join(' ').toLowerCase();
 if(/security|secure|privacy|安全|隐私|audit|漏洞/.test(s))return '安全与隐私';
 if(/agent|mcp|automation|workflow|tool.?use|智能体|自动化/.test(s))return 'Agent 与自动化';
 if(/frontend|backend|coding|code|programming|developer|开发|编程|github|api|cli|terminal/.test(s))return '编程与开发';
 if(/ui.?ux|design|figma|css|visual design|界面|设计系统|原型/.test(s))return 'UI/UX 设计';
 if(/data|analytics|sql|database|dashboard|chart|数据|看板|报表/.test(s))return '数据与看板';
 if(/writing|content|copywriting|blog|newsletter|公众号|写作|文案|内容创作/.test(s))return '写作与内容';
 if(/test|qa|playwright|browser|debug|testing|测试|质量保障/.test(s))return '测试与质量';
 if(/image|video|audio|music|photo|media|imagegen|图片|视频|音频|音乐|多媒体/.test(s))return '多媒体创作';
 if(/productivity|note|task|calendar|search|knowledge|效率|笔记|知识管理/.test(s))return '效率与知识管理';
 return '其他 Skill';
}
function skillMetaLines(p){
 const lines=String(p.notes||'').split('\n');
 return {rank:lines.find(x=>/^GitHub 排名：/.test(x)),heat:lines.find(x=>/^热度：/.test(x)),updated:lines.find(x=>/^热度采集时间：/.test(x)),stars:lines.find(x=>/^GitHub Stars：/.test(x)),purpose:lines.find(x=>/^主要作用：|^应用建议：|^建议方向：/.test(x))};
}
function renderProjects(){
 const q=($('#projectSearch')?.value||'').trim().toLowerCase(),sourceFilter=$('#projectSourceFilter')?.value||'all',categoryFilter=$('#projectCategoryFilter')?.value||'all';
 const matches=projects.filter(p=>{
  const src=projectSource(p),externalSkill=isExternalSkillProject(p),cat=externalSkill?skillCategory(p):'';
  if((sourceFilter==='mine'&&src!=='mine')||(sourceFilter==='external'&&src!=='external')||(sourceFilter==='skills'&&!externalSkill)||(sourceFilter==='other'&&src!=='other'))return false;
  if(categoryFilter!=='all'&&cat!==categoryFilter)return false;
  return !q||[p.name,p.repoUrl,p.appUrl,p.category,p.stack,p.notes,p.tags,src==='mine'?'我的开发':src==='external'?'外部收录':'其他',cat].join(' ').toLowerCase().includes(q);
 });
 const list=matches.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.updatedAt-a.updatedAt),host=$('#projectCards');if(!host)return;
 $('#projectCount').textContent=list.length+' / '+projects.length+' 个项目';
 const groups=[{key:'mine',title:'我的开发',desc:'自己开发或维护的应用与仓库',items:list.filter(p=>projectSource(p)==='mine')},{key:'external',title:'外部收录',desc:'来自公开网络、Skill 搜索与 AI 简报的资源',items:list.filter(p=>projectSource(p)==='external')},{key:'other',title:'其他 / 待归类',desc:'暂时无法识别来源的项目',items:list.filter(p=>projectSource(p)==='other')}].filter(g=>g.items.length);
 const categoryOptions=['Agent 与自动化','编程与开发','UI/UX 设计','数据与看板','写作与内容','测试与质量','安全与隐私','多媒体创作','效率与知识管理','其他 Skill'];
 const cards=p=>{
  const src=projectSource(p),externalSkill=isExternalSkillProject(p),m=skillMetaLines(p),cat=externalSkill?skillCategory(p):'';
  const sourceBadge=src==='mine'?'<span class="source-badge source-mine">我的开发</span>':src==='external'?'<span class="source-badge source-external">外部收录</span>':'<span class="source-badge">待归类</span>';
  const catBadge=externalSkill?'<span class="source-badge source-category">'+esc(cat)+'</span>':'';
  const heatPanel=externalSkill&&(m.heat||m.stars||m.rank)?'<div class="skill-insights"><strong>GitHub Skill 热度</strong>'+(m.rank?'<p>'+esc(m.rank)+'</p>':'')+(m.stars?'<p>'+esc(m.stars)+'</p>':'')+(m.heat?'<p>'+esc(m.heat)+'</p>':'')+(m.updated?'<p>'+esc(m.updated)+'</p>':'')+'</div>':'';
  const purpose=externalSkill?'<p class="project-note skill-purpose">'+esc((p.notes||'').split('\n').filter(x=>/^主要作用：|^应用建议：|^建议方向：/.test(x)).join(' '))+'</p>':'';
  const note=p.notes&&!externalSkill?'<p class="project-note">'+esc(p.notes.length>260?p.notes.slice(0,260)+'…':p.notes)+'</p>':'';
  return '<article class="card project-card" data-project-id="'+esc(p.id)+'"><div class="cardtop"><div class="provider-icon">'+(p.repoUrl?'GH':'APP')+'</div><div class="cardtitle"><h3>'+esc(p.name)+(p.favorite?' ★':'')+'</h3><p>'+esc(p.category||'其他')+(p.stack?' · '+esc(p.stack):'')+'</p><div class="source-badges">'+sourceBadge+catBadge+'</div></div><button class="dots" data-project-action="menu" aria-label="项目操作">⋯</button></div><div class="project-links">'+(p.repoUrl?'<a class="btn" href="'+esc(p.repoUrl)+'" target="_blank" rel="noopener noreferrer">↗ GitHub 仓库</a>':'')+(p.appUrl?'<a class="btn primary" href="'+esc(p.appUrl)+'" target="_blank" rel="noopener noreferrer">↗ 打开应用</a>':'')+'</div>'+note+heatPanel+purpose+(p.tags?'<div class="tags">'+p.tags.split(',').map(t=>t.trim()).filter(Boolean).slice(0,6).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div>':'')+'<div class="cardactions"><button class="btn primary" data-project-action="edit">编辑项目</button><button class="btn" data-project-action="favorite">'+(p.favorite?'取消收藏':'收藏')+'</button><button class="btn danger" data-project-action="delete">删除</button></div></article>';
 };
 host.innerHTML=groups.length?groups.map(g=>'<section class="project-group project-group-'+g.key+'"><div class="project-group-head"><div><h3>'+g.title+'</h3><p>'+g.desc+'</p></div><span>'+g.items.length+'</span></div><div class="cards">'+g.items.map(cards).join('')+'</div></section>').join(''):'<div class="empty"><div class="big">⌘</div><h3>'+(projects.length?'没有匹配的项目':'还没有收录项目')+'</h3><p>可尝试更换来源或分类筛选，也可以收录新的应用和 Skill。</p><button class="btn primary" data-project-action="add">＋ 收录项目</button></div>';
}
function setModule(name){const projectsMode=name==='projects';$('#projectView').classList.toggle('hidden',!projectsMode);document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===name));const keyNodes=['.stats','.list-head','#cards','.footer'];keyNodes.forEach(sel=>document.querySelectorAll('#mainView '+sel).forEach(n=>n.classList.toggle('hidden',projectsMode)));$('#searchInput').closest('.toolbar').classList.toggle('hidden',projectsMode);if(projectsMode)renderProjects();}
document.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>setModule(b.dataset.module)));


function githubCategory(repo){const s=((repo.name||'')+' '+(repo.description||'')+' '+(repo.language||'')+' '+(repo.topics||[]).join(' ')).toLowerCase();if(/ai|llm|gpt|agent|model|prompt|deepseek/.test(s))return 'AI 工具';if(/portfolio|personal site|个人网站|homepage/.test(s))return '个人网站';if(/mini.?program|小程序|wechat/.test(s))return '小程序';if(/dashboard|看板|analytics|chart/.test(s))return 'Web 应用';return 'Web 应用';}
function githubImportModal(){openModal('<h2>从 GitHub 导入公开仓库</h2><p class="sub">无需 Token。KeyPocket 只读取公开仓库元数据，不读取仓库代码或私有文件。</p><div class="field"><label for="githubOwner">GitHub 用户名或组织</label><input id="githubOwner" maxlength="100" value="chenzhe223-tech" placeholder="GitHub 用户名"></div><div class="field"><label for="githubRepoSearch">筛选仓库</label><input id="githubRepoSearch" maxlength="100" placeholder="搜索仓库名称、描述或语言…"></div><div id="githubImportStatus" class="notice info">点击加载公开仓库。</div><div id="githubRepoList" class="github-repo-list"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button id="githubLoadBtn" type="button" class="btn">加载仓库</button><button id="githubImportSelectedBtn" type="button" class="btn primary" disabled>导入所选（0）</button></div>');
const status=$('#githubImportStatus'),list=$('#githubRepoList'),load=$('#githubLoadBtn'),submit=$('#githubImportSelectedBtn');let loaded=[];
function paint(){const q=$('#githubRepoSearch').value.trim().toLowerCase(),visible=loaded.filter(r=>(r.name+' '+(r.description||'')+' '+(r.language||'')).toLowerCase().includes(q));list.innerHTML=visible.length?visible.map(r=>'<label class="github-repo-row"><input type="checkbox" data-github-repo="'+esc(r.full_name)+'"><span class="github-repo-meta"><strong>'+esc(r.name)+'</strong><small>'+esc(r.description||'暂无描述')+'</small><small>'+esc(r.language||'未标注语言')+' · '+esc(r.updated_at?.slice(0,10)||'')+'</small></span><a href="'+esc(r.html_url)+'" target="_blank" rel="noopener noreferrer">查看 ↗</a></label>').join(''):'<div class="notice">没有匹配的公开仓库。</div>';function update(){const n=list.querySelectorAll('input[type=checkbox]:checked').length;submit.textContent='导入所选（'+n+'）';submit.disabled=n===0;}list.querySelectorAll('input[type=checkbox]').forEach(c=>c.addEventListener('change',update));update();}
load.addEventListener('click',async()=>{const owner=$('#githubOwner').value.trim();if(!/^[a-zA-Z0-9-]{1,100}$/.test(owner)){status.textContent='请输入有效的 GitHub 用户名或组织名。';status.className='notice error';return;}load.disabled=true;status.textContent='正在加载公开仓库…';status.className='notice info';try{const response=await fetch('https://api.github.com/users/'+encodeURIComponent(owner)+'/repos?per_page=100&sort=updated&type=owner',{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!response.ok)throw Error(response.status===404?'未找到该用户或组织。':'GitHub API 请求失败（HTTP '+response.status+'）。');const data=await response.json();loaded=data.filter(r=>!r.private&&r.html_url&&r.full_name);status.textContent='找到 '+loaded.length+' 个公开仓库。选择要导入的项目。';status.className='notice ok';paint();}catch(e){status.textContent=e.message||'加载失败，请稍后重试。';status.className='notice error';}finally{load.disabled=false;}});
$('#githubRepoSearch').addEventListener('input',paint);
submit.addEventListener('click',async()=>{const selectedNames=[...list.querySelectorAll('input[type=checkbox]:checked')].map(c=>c.dataset.githubRepo),selected=loaded.filter(r=>selectedNames.includes(r.full_name));submit.disabled=true;let added=0,skipped=0;try{for(const r of selected){const normalized=r.html_url.replace(/\.git$/,'').replace(/\/$/,'').toLowerCase();if(projects.some(p=>p.repoUrl.replace(/\.git$/,'').replace(/\/$/,'').toLowerCase()===normalized)){skipped++;continue;}const now=Date.now(),p=normalizeProject({id:crypto.randomUUID(),name:r.name,repoUrl:r.html_url,appUrl:r.homepage&&validWebUrl(r.homepage)?r.homepage:'',category:githubCategory(r),stack:[r.language,...(r.topics||[]).slice(0,4)].filter(Boolean).join(', ').slice(0,160),notes:r.description||'',tags:suggestedProjectTags(r).join(', '),favorite:false,createdAt:now,updatedAt:now});await putItem(await sealProject(p));projects.push(p);added++;}closeModal();renderProjects();showToast('导入 '+added+' 个项目'+(skipped?'，跳过重复 '+skipped+' 个':''));}catch(e){status.textContent='已导入 '+added+' 个；保存中断：'+(e.message||'未知错误');status.className='notice error';submit.disabled=false;}});}
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
function skillResultHtml(r,i,items,q){
 const h=skillHeat(r,i+1,items.length),repo=canonicalSkillRepoUrl(r.html_url);
 const existing=projects.some(p=>canonicalSkillRepoUrl(p.repoUrl)===repo);
 const description=String(r.description||'暂无描述').replace(/\s+/g,' ').slice(0,220);
 const owner=String(r.owner?.login||r.full_name.split('/')[0]||'');
 const nativeHint=(/microsoft|playwright|lemomo-ai|nextlevelbuilder/i.test(owner+' '+r.full_name))?'优先关注的上游/原作者候选':'第三方候选，请核对作者与 README';
 return '<article class="github-repo-row" style="align-items:flex-start"><span class="github-repo-meta"><strong>'+esc(r.full_name)+'</strong><small>'+esc(description)+(String(r.description||'').length>220?'…':'')+'</small><small>'+esc(nativeHint)+' · ★ '+h.stars.toLocaleString()+' · Fork '+h.forks.toLocaleString()+'</small><small>本次关键词相关度排序 #'+(i+1)+'/'+items.length+'；不是全网安装量排名</small><small>建议方向：'+esc(skillUseCase(r))+'</small><small>最近更新：'+esc((r.pushed_at||r.updated_at||'').slice(0,10))+' · '+esc(r.language||'未标注语言')+'</small><span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><a href="'+esc(repo||r.html_url)+'" target="_blank" rel="noopener noreferrer">查看仓库 ↗</a><button class="btn primary" type="button" data-save-skill="'+i+'" '+(existing?'disabled':'')+'>'+(existing?'已收录':'收录 Skill')+'</button></span></span></article>';
}
function skillImportModal(){
 openModal('<h2>按 Skill 名称导入</h2><p class="sub">优先精确匹配仓库名和原作者候选，再展示相关项目。结果按关键词相关度排序，热度仅作参考。</p><form id="skillSearchForm"><div class="field"><label for="skillNameInput">Skill 名称 / 关键词</label><input id="skillNameInput" required maxlength="120" placeholder="例如：playwright、lemo opuscar、all design"></div><div class="modal-actions"><button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">搜索 Skills</button></div></form><div id="skillSearchStatus" class="notice info">输入具体名称可优先匹配原作者仓库；收录前请核对来源。</div><div id="skillSearchResults" class="github-repo-list"></div>');
 const form=$('#skillSearchForm'),status=$('#skillSearchStatus'),results=$('#skillSearchResults');
 let searchSequence=0,activeController=null,searching=false;
 form.addEventListener('submit',async e=>{
  e.preventDefault();const q=$('#skillNameInput').value.trim();if(!q||searching)return;
  const sequence=++searchSequence;searching=true;
  if(activeController)activeController.abort();
  activeController=new AbortController();
  status.className='notice info';status.textContent='正在搜索 GitHub 公开仓库…';results.innerHTML='';
  const btn=form.querySelector('button[type=submit]');btn.disabled=true;
  try{
   const plans=skillQueryPlans(q),merged=new Map();
   for(const plan of plans){
    if(sequence!==searchSequence)return;
    const url='https://api.github.com/search/repositories?q='+encodeURIComponent(plan)+'&sort=stars&order=desc&per_page=15';
    const response=await fetch(url,{signal:activeController.signal,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
    if(!response.ok){
     if(response.status===403)throw Error('GitHub API 搜索次数已达限制，请稍后再试。');
     if(response.status===422)continue;
     throw Error('GitHub 搜索失败（HTTP '+response.status+'）。');
    }
    const data=await response.json();
    for(const r of (data.items||[])){
     if(!r||r.private||!r.html_url||!canonicalSkillRepoUrl(r.html_url))continue;
     const key=canonicalSkillRepoUrl(r.html_url);
     if(!merged.has(key))merged.set(key,r);
    }
   }
   if(sequence!==searchSequence)return;
   let items=[...merged.values()].filter(r=>isClearlyRelevantSkill(r,q));
   items.sort((a,b)=>scoreSkillResult(b,q)-scoreSkillResult(a,q)||Number(b.stargazers_count||0)-Number(a.stargazers_count||0));
   items=items.slice(0,10);
   if(!items.length){status.className='notice';status.textContent='没有找到足够相关的公开仓库。试试官方仓库名、作者名或更准确的英文关键词。';return;}
   status.className='notice ok';status.textContent='找到 '+items.length+' 个相关候选，已按名称和关键词相关度排序。请优先核对上游作者与仓库内容。';
   results.innerHTML=items.map((r,i)=>skillResultHtml(r,i,items,q)).join('');
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
     await putItem(await sealProject(p));projects.push(p);renderProjects();b.textContent='已收录';showToast('Skill 已加密保存');status.className='notice ok';status.textContent='已收录 '+r.full_name+'。你可以继续搜索其他 Skill。';
    }catch(err){b.disabled=false;b.textContent=original;status.className='notice error';status.textContent='收录失败：'+(err.message||'请重试');}
   }));
  }catch(err){
   if(err.name==='AbortError')return;
   if(sequence===searchSequence){status.className='notice error';status.textContent=err.message||'搜索失败，请稍后重试。';}
  }finally{
   if(sequence===searchSequence){searching=false;btn.disabled=false;activeController=null;}
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
    p.updatedAt=Date.now();await putItem(await sealProject(p));updated++;
   }catch(err){failed++;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  renderProjects();showToast('已刷新 '+updated+' 个外部 Skill'+(failed?'；'+failed+' 个失败或超时':'')+(skills.length>batch.length?'；本次最多刷新 8 个':''));
 }finally{btn.disabled=false;btn.textContent=label;}
}
$('#refreshSkillHeatBtn')?.addEventListener('click',refreshSavedSkillHeat);
$('#importSkillBtn')?.addEventListener('click',skillImportModal);

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
 try{
  const captureParam=new URLSearchParams(window.location.search).get('kp_capture');
  if(captureParam){
   try{
    const incoming=JSON.parse(captureParam);
    if(incoming&&incoming.source==='davy-radar'&&canonicalSkillRepoUrl(incoming.url)){
     const stored=window.localStorage.getItem(KEYPOCKET_PENDING_SKILL_KEY);
     const parsed=stored?JSON.parse(stored):[];
     const queue=Array.isArray(parsed)?parsed:[];
     if(!queue.some(x=>x&&x.id===incoming.id))queue.push(incoming);
     window.localStorage.setItem(KEYPOCKET_PENDING_SKILL_KEY,JSON.stringify(queue.slice(-100)));
    }
   }catch(e){console.warn('KeyPocket capture payload invalid',e)}
   const cleanUrl=new URL(window.location.href);
   cleanUrl.searchParams.delete('kp_capture');
   window.history.replaceState({},'',cleanUrl.pathname+cleanUrl.search+cleanUrl.hash);
  }
  const raw=window.localStorage.getItem(KEYPOCKET_PENDING_SKILL_KEY);
  const parsed=raw?JSON.parse(raw):[];
  if(!Array.isArray(parsed))return [];
  return parsed.slice(0,100).map(item=>{
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
 }catch{return [];}
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
 if(!cryptoKey){showToast('请先解锁 KeyPocket，再收录 AI 简报中的 Skill。');return;}
 if($('#modalRoot').innerHTML.trim())return;
 const queue=readPendingRadarSkills();
 updateRadarImportButton();
 if(!queue.length){showToast('目前没有待收录的 Skill。请从 AI 前沿简报点击「一键收录到 KeyPocket」。');return;}
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
 openModal('<h2>收录 Skill 到 KeyPocket</h2><p class="sub">请核对公开仓库信息，再确认加入「我的应用与仓库」。资料会在本机加密保存；不会导入 API Key，也不会上传到服务器。</p><div class="notice info"><strong>'+esc(title)+'</strong><br><a href="'+esc(repoUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(repoUrl)+' ↗</a></div>'+queueLabel+'<div class="field"><label>项目简介</label><div class="project-note">'+esc(item.description||'原简报未提供项目简介。')+'</div></div><div class="field"><label>主题 / Topics</label><div class="project-note">'+esc(topics)+'</div></div><div class="grid2"><div class="field"><label>许可证</label><div class="project-note">'+esc(item.license||'请打开仓库核实')+'</div></div><div class="field"><label>简报记录的 Stars</label><div class="project-note">'+esc(stars)+'</div></div></div><div id="radarSkillImportNotice" class="notice info">即将收录仓库链接、简介、主题和来源日期。Stars 是简报采集时的记录，不代表安装量。</div><div class="modal-actions"><button type="button" class="btn" data-action="close">稍后处理</button><button type="button" class="btn ghost" id="ignoreRadarSkillBtn">忽略此条</button><button type="button" class="btn primary" id="saveRadarSkillBtn">确认收录</button></div>');
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
    await putItem(await sealProject(project));
    projects.push(project);
   }
   removePendingRadarSkill(item.id);
   closeModal();setModule('projects');renderProjects();updateRadarImportButton();
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
$('#projectSearch')?.addEventListener('input',renderProjects);
$('#projectSourceFilter')?.addEventListener('change',renderProjects);
$('#projectCategoryFilter')?.addEventListener('change',renderProjects);


const KP_SUPABASE_URL='https://urzgghdwawpwqliafrzv.supabase.co';
const KP_SUPABASE_KEY='sb_publishable_p4opBpYH50PAThHBObr3aQ_Hw6cpF5o';
const KP_SESSION_KEY='kp.sync.session.v1';
function kpSyncStatus(message,isError=false){const n=$('#syncStatus');if(n){n.textContent=message;n.style.color=isError?'#b93636':'';}}
function kpSession(){try{return JSON.parse(localStorage.getItem(KP_SESSION_KEY)||'null')}catch{return null}}
function kpSetSession(s){if(s)localStorage.setItem(KP_SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(KP_SESSION_KEY);const logged=!!s?.access_token;$('#syncNowBtn').disabled=!logged;$('#syncSignOutBtn').disabled=!logged;$('#syncSignInBtn').disabled=logged;$('#syncSignUpBtn').disabled=logged;}
async function kpAuth(action,email,password){
 const res=await fetch(KP_SUPABASE_URL+'/auth/v1/'+action,{method:'POST',headers:{'Content-Type':'application/json','apikey':KP_SUPABASE_KEY},body:JSON.stringify({email,password})});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.msg||body.message||body.error_description||body.error||'账号认证失败');
 if(body.access_token)kpSetSession(body);
 return body;
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
  await writeItems(sealed,true);await putItem(vault);
  render();renderProjects();kpSyncStatus('同步完成：已合并 '+records.length+' 条密钥、'+projects.length+' 个项目。云端仅保存加密密文。');
 }finally{status.disabled=!kpSession()?.access_token;status.textContent='合并并同步加密资料';}
}
$('#syncSignUpBtn')?.addEventListener('click',async()=>{try{const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||password.length<10)throw Error('请输入邮箱及至少 10 位的账号密码。');await kpAuth('signup',email,password);kpSyncStatus('账号请求已提交。若邮箱验证已开启，请先查收验证邮件，再返回登录。');}catch(e){kpSyncStatus(e.message,true)}});
$('#syncSignInBtn')?.addEventListener('click',async()=>{const btn=$('#syncSignInBtn');if(btn.disabled)return;const old=btn.textContent;btn.disabled=true;btn.textContent='正在登录…';try{const email=$('#syncEmail').value.trim(),password=$('#syncPassword').value;if(!email||!password)throw Error('请输入邮箱和账号密码。');const body=await kpAuth('token?grant_type=password',email,password);if(!body.access_token)throw Error('登录请求未返回有效会话，请检查邮箱验证状态或同步服务配置。');kpSyncStatus('登录成功。请点击“合并并同步加密资料”完成同步。');}catch(e){const msg=String(e.message||'登录失败');kpSyncStatus(msg.includes('Invalid login credentials')?'邮箱或密码不正确。':msg.includes('Email not confirmed')?'邮箱尚未验证，请先完成验证，或检查同步服务的邮箱验证设置。':msg.includes('Failed to fetch')?'无法连接同步服务，请检查网络或后端服务状态。':'登录失败：'+msg,true);}finally{btn.disabled=!!kpSession()?.access_token;btn.textContent=old;}});
$('#syncSignOutBtn')?.addEventListener('click',async()=>{try{const s=kpSession();if(s?.access_token)await fetch(KP_SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{'apikey':KP_SUPABASE_KEY,'Authorization':'Bearer '+s.access_token}});}catch{}kpSetSession(null);kpSyncStatus('已退出同步账号。本地加密库未受影响。');});
$('#syncNowBtn')?.addEventListener('click',async()=>{try{await kpMergeAndSync()}catch(e){kpSyncStatus('同步未完成：'+e.message+' 本地数据保持不变；请确认所有设备使用相同的本地解锁密码。',true)}});
kpSetSession(kpSession());
