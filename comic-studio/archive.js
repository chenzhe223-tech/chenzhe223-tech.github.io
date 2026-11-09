/* WORLD/TOON v2.5 · GitHub comic archive adapter. No model calls and no auto publication. */
'use strict';
const WT_ARCHIVE_REPO='chenzhe223-tech/worldtoon';
const WT_ARCHIVE_URL='https://github.com/'+WT_ARCHIVE_REPO;
let wtArchiveSnapshot=null,wtArchiveError='',wtArchiveBusy=false,wtArchiveLastSync=0;
const wtArchiveHtml=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wtArchiveAuth=()=>typeof wtSession!=='undefined'&&wtSession?.access_token||'';
async function wtArchiveApi(path,options={}){
  const headers=new Headers(options.headers||{});const access=wtArchiveAuth();
  if(access)headers.set('authorization','Bearer '+access);
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{const res=await fetch('/api/archive/'+path,{...options,headers,signal:controller.signal,cache:'no-store'});
    const body=await res.json().catch(()=>({error:'归档服务响应异常'}));if(!res.ok)throw Error(body.error||('HTTP '+res.status));return body;
  }finally{clearTimeout(timeout)}
}
function wtArchiveStateLabel(row){const names={queued:'等待 ChatGPT 领取',claimed:'ChatGPT 制作中',blocked:'质量审查未通过',cancelled:'已取消',ready_for_workbuddy:'待 WorkBuddy 发表',publishing:'公众号发表中',published:'已发表并入档'};return names[row.status]||'未确认状态';}
function wtArchiveDate(d){try{return d?new Date(d).toLocaleDateString('zh-CN'):'—'}catch{return '—'}}
function wtArchiveSection(){const items=(wtArchiveSnapshot?.library?.items||[]).filter(x=>x.status==='published');const cards=items.slice(0,9).map(it=>`<article class="box" style="min-width:0"><div class="kicker">ARCHIVED / ${wtArchiveHtml(it.task_id)}</div><h3>${wtArchiveHtml(it.title)}</h3><p class="minor">${wtArchiveDate(it.receipt?.published_at)} · 第 ${Number(it.revision)||1} 版 · 正式发表回执</p><div class="buttons"><a class="button dark" href="${wtArchiveHtml(it.receipt?.url||'#')}" target="_blank" rel="noopener noreferrer">阅读公众号漫画 ↗</a></div></article>`).join('');
 return `<section class="box" style="margin-bottom:24px"><div class="sectionbar"><div><div class="kicker">GITHUB / PUBLISHED ARCHIVE</div><h2>仓库已发表漫画</h2></div><a class="button" href="#/archive">查看仓库同步状态 ↗</a></div>${items.length?`<div class="cards2">${cards}</div>`:`<p class="minor">${wtArchiveSnapshot?'仓库尚无经过回执核验的已发表作品。':'尚未从独立仓库取得正式目录；本机作品仍保留在下方。'}</p>`}</section>`;
}
function wtArchiveDesk(){const snap=wtArchiveSnapshot;const rows=snap?.library?.items||[];const queue=snap?.queue?.items||[];const published=rows.filter(x=>x.status==='published');const blocked=rows.filter(x=>x.status==='blocked');const queued=rows.filter(x=>x.status==='queued');const status=wtArchiveBusy?'正在检测仓库…':wtArchiveError?'仓库连接未完成':snap?'仓库目录已同步':'未建立仓库连接';
 return heroHeader('PRODUCTION SYSTEM / GITHUB ARCHIVE','漫画仓库','双引擎并行：平台 AI 生图接口仅保留；正式生产采用平台派单、ChatGPT 制作、GitHub 交付、WorkBuddy 公众号发表和回执归档。',`<button class="button dark" data-archive="refresh">⟳ 扫描仓库</button><a class="button" href="${WT_ARCHIVE_URL}" target="_blank" rel="noopener noreferrer">查看独立仓库 ↗</a>`)+
 `<div class="box" style="margin-top:22px"><div class="kicker">CONNECTION / ${wtArchiveHtml(status)}</div><h2>GitHub · ${WT_ARCHIVE_REPO}</h2><p class="minor">${wtArchiveHtml(wtArchiveError||(snap?('上次同步：'+wtArchiveDate(new Date(wtArchiveLastSync).toISOString())+' · 只读仓库目录，不从本机推断发表状态'):'该仓库为独立私有仓库。需完成创建、登录授权和 Worker Secret 后才能启用自动派单/扫描。'))}</p><div class="buttons"><a class="button" href="#/handoff">进入制作交接中心 ↗</a><a class="button" href="#/account">登录工作区 ↗</a></div></div>`+
 `<div class="grid-stat" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0"><div class="box"><div class="kicker">TASKS</div><h2>${rows.length}</h2><p>仓库任务</p></div><div class="box"><div class="kicker">CHATGPT</div><h2>${queued.length}</h2><p>待领取</p></div><div class="box"><div class="kicker">WORKBUDDY</div><h2>${queue.length}</h2><p>已过审待发表</p></div><div class="box"><div class="kicker">PUBLISHED</div><h2>${published.length}</h2><p>已发表入档</p></div></div>`+
 `<section class="box"><div class="sectionbar"><h2>全流程状态</h2><span class="chip">${blocked.length?blocked.length+' 个异常任务':'严格去重 · 有回执才入档'}</span></div><div class="wf-path"><span>选题完成</span><span>→</span><span>GitHub 派单</span><span>→</span><span>ChatGPT 交付</span><span>→</span><span>质量验收</span><span>→</span><span>WorkBuddy 发表</span><span>→</span><span>回执入书架</span></div>${rows.length?rows.map(it=>`<div class="rowline"><div style="min-width:0"><strong>${wtArchiveHtml(it.title)}</strong><small>${wtArchiveHtml(it.task_id)} · ${wtArchiveDate(it.created_at)}</small>${it.issues?.length?`<small style="color:#a44">${wtArchiveHtml(it.issues.join('；'))}</small>`:''}</div><span class="chip">${wtArchiveStateLabel(it)}</span></div>`).join(''):'<p class="minor">无真实仓库任务；不显示模拟成果。</p>'}</section>`+
 `<section class="box" style="margin-top:20px"><h2>引擎 A：平台自生成</h2><p class="minor">保留自定义模型地址、API Key（仅服务器端安全存储）、剧本模型和画面模型的未来接口；当前不启用，不扣费，也不调用生图。</p><h2 style="margin-top:16px">引擎 B：Agent 协作（优先）</h2><p class="minor">平台自动派单需要用户已登录、私有仓库存在及服务端写入凭证。ChatGPT 自动领取需要独立定时任务，WorkBuddy 定时扫描须在其自身环境配置；网页浏览器不能直接唤醒两个 Agent。初次接入前请勿把本机 ZIP 当作已入仓。</p></section>`;
}
async function wtArchiveRefresh({silent=false}={}){if(wtArchiveBusy)return;wtArchiveBusy=true;wtArchiveError='';if(!silent&&ui.route==='archive')render();try{
 if(!wtArchiveAuth())throw Error('需要登录 WORLD/TOON 的个人账户，才能读取私有仓库');
 const result=await wtArchiveApi('sync');if(result.library?.schema!=='davylab.worldtoon.library.v1'||result.queue?.schema!=='davylab.worldtoon.workbuddy-queue.v1')throw Error('仓库目录格式不兼容');
 const a=result.library.items||[];const seenTask=new Set(),seenStory=new Set();const clean=[];
 for(const x of a){if(!x||!x.task_id||seenTask.has(x.task_id)||seenStory.has(x.dedupe_key))continue;seenTask.add(x.task_id);seenStory.add(x.dedupe_key);clean.push(x)}
 wtArchiveSnapshot={library:{...result.library,items:clean},queue:result.queue,repo:result.repo};wtArchiveLastSync=Date.now();
 if(!silent&&typeof notify==='function')notify(`仓库同步成功：${clean.length} 条任务、${result.queue.items?.length||0} 条待发表`);
 }catch(err){wtArchiveError=err.name==='AbortError'?'仓库访问超时':String(err.message||err);if(!silent&&typeof notify==='function')notify(wtArchiveError)}finally{wtArchiveBusy=false;if(['archive','library'].includes(ui.route))render()}}
function wtArchiveCanonicalURL(s){try{const u=new URL(s.trim()),url=new URLSearchParams();for(const [k,v] of Array.from(u.searchParams.entries()).sort(([a],[b])=>a.localeCompare(b))){if(!k.toLowerCase().startsWith('utm_')&&!['fbclid','gclid'].includes(k))url.append(k,v)}return u.hostname.toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'').toLowerCase()+'?'+url.toString()}catch{return ''}}
async function wtArchiveKey(p){const sources=(p.sourceURLs||'').split(/\s+/).map(wtArchiveCanonicalURL).filter(Boolean);let normalized=[...new Set(sources)].sort().join('\n');if(!normalized)normalized=String(p.title||'').toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('')}
async function wtArchivePushTask(p,o,prompt){if(!wtArchiveAuth())throw Error('未登录：任务 ZIP 已保存在本机，但尚未自动派单到 GitHub');const key=await wtArchiveKey(p);if(!/^[a-f0-9]{64}$/.test(key))throw Error('去重指纹生成失败');
 const task={schema:'davylab.worldtoon.task.v2',task_id:o.task_id,title:p.title,subtitle:p.subtitle||'',category:p.category||'',status:'queued',dedupe_key:key,created_at:o.created_at||new Date().toISOString(),producer:'ChatGPT',publisher:'WorkBuddy',mode:o.mode,editorial:{sources:o.source?.urls||[],fact_notes:o.source?.verified_facts||'',fictionalization:o.adaptation?.strategy||'',disclaimer:o.adaptation?.disclaimer||''},panels:o.panels||[],characters:o.adaptation?.characters||'',description:o.story||'',original_task_schema:o.schema};
 const outcome=await wtArchiveApi('tasks',{method:'POST',body:JSON.stringify({task,prompt})});p.handoff={...p.handoff,repository:WT_ARCHIVE_REPO,repoQueuedAt:new Date().toISOString(),repoTaskPath:outcome.path,repoDedupeKey:key,repoCommit:outcome.commit};setChange(p,'GitHub 仓库正式派单：'+(outcome.existing?'已存在同一任务':'新工单'));return outcome;
}
function wtArchiveAutopoll(){if(['archive','library'].includes(location.hash.split('/')[1])&&wtArchiveAuth()&&Date.now()-wtArchiveLastSync>300000&&!wtArchiveBusy)wtArchiveRefresh({silent:true})}
document.addEventListener('click',ev=>{if(ev.target.closest('[data-archive="refresh"]')){ev.preventDefault();wtArchiveRefresh();}});
const wtArchiveOldLibrary=library;library=function(){return wtArchiveSection()+wtArchiveOldLibrary()};
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#/archive')||location.hash.startsWith('#/library'))wtArchiveAutopoll()});
setInterval(wtArchiveAutopoll,300000);
queueMicrotask(()=>{if(location.hash.startsWith('#/archive'))parseRoute();wtArchiveAutopoll()});