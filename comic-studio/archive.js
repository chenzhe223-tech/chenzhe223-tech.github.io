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
function wtArchiveDesk(){const snap=wtArchiveSnapshot;const rows=snap?.library?.items||[];const queue=snap?.queue?.items||[];const published=rows.filter(x=>x.status==='published');const blocked=rows.filter(x=>x.status==='blocked');const queued=rows.filter(x=>x.status==='queued');const status=wtArchiveBusy?'正在检测仓库…':wtArchiveError?'仓库连接未完成':snap?.mode==='public_readonly'?'公开仓库 · 只读同步':snap?'私有目录已同步':'尚未获取仓库目录';
 return heroHeader('PRODUCTION SYSTEM / TWO-TRACK AI','双轨运行中心','双引擎并行：平台 AI 生图接口仅保留；正式生产采用平台派单、ChatGPT 制作、GitHub 交付、WorkBuddy 公众号发表和回执归档。',`<button class="button dark" data-archive="refresh">⟳ 扫描仓库</button><a class="button" href="${WT_ARCHIVE_URL}" target="_blank" rel="noopener noreferrer">查看独立仓库 ↗</a>`)+
 `<div class="box" style="margin-top:22px"><div class="kicker">CONNECTION / ${wtArchiveHtml(status)}</div><h2>GitHub · ${WT_ARCHIVE_REPO}</h2><p class="minor">${wtArchiveHtml(wtArchiveError||(snap?('上次同步：'+new Date(wtArchiveLastSync).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false})+' · '+(snap.mode==='public_readonly'?'当前公开只读，不允许提交未发表素材':'私有仓库目录已验证')+' · 未经发表回执不登记正式作品'):'已创建独立漫画仓库。公开状态仅允许读取目录；启用真实派单前必须改为 Private 并配置受限服务器凭证。'))}</p><div class="buttons"><a class="button" href="#/handoff">进入制作交接中心 ↗</a><a class="button" href="#/account">登录工作区 ↗</a></div></div>`+
 `${snap?.mode==='public_readonly'?'<div class="notice" style="margin:16px 0">仓库当前是公开的：漫画任务与未发表素材禁止写入。将仓库改为 Private 并在 Cloudflare 配置安全凭证后，才能自动派单与私有同步。</div>':''}<div class="grid-stat" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:20px 0"><div class="box"><div class="kicker">TASKS</div><h2>${rows.length}</h2><p>仓库任务</p></div><div class="box"><div class="kicker">CHATGPT</div><h2>${queued.length}</h2><p>待领取</p></div><div class="box"><div class="kicker">WORKBUDDY</div><h2>${queue.length}</h2><p>已过审待发表</p></div><div class="box"><div class="kicker">PUBLISHED</div><h2>${published.length}</h2><p>已发表入档</p></div></div>`+
 `<section class="box"><div class="sectionbar"><h2>全流程状态</h2><span class="chip">${blocked.length?blocked.length+' 个异常任务':'严格去重 · 有回执才入档'}</span></div><div class="wf-path"><span>选题完成</span><span>→</span><span>GitHub 派单</span><span>→</span><span>ChatGPT 交付</span><span>→</span><span>质量验收</span><span>→</span><span>WorkBuddy 发表</span><span>→</span><span>回执入书架</span></div>${rows.length?rows.map(it=>`<div class="rowline"><div style="min-width:0"><strong>${wtArchiveHtml(it.title)}</strong><small>${wtArchiveHtml(it.task_id)} · ${wtArchiveDate(it.created_at)}</small>${it.issues?.length?`<small style="color:#a44">${wtArchiveHtml(it.issues.join('；'))}</small>`:''}</div><span class="chip">${wtArchiveStateLabel(it)}</span></div>`).join(''):'<p class="minor">无真实仓库任务；不显示模拟成果。</p>'}</section>`+
 `<div class="cards2" style="margin-top:20px"><section class="box"><div class="kicker">TRACK A / API RESERVED · INACTIVE</div><h2>平台自生成</h2><p class="minor">预留自定义模型服务地址与 API 接入能力。当前停用生图，不调用付费模型，不在浏览器保存 API Key。</p><span class="chip">接口预留 · 暂不开发</span></section><section class="box"><div class="kicker">TRACK B / GITHUB FIRST</div><h2>Agent 协作生产</h2><p class="minor">平台派单 → ChatGPT 九图制作 → GitHub 校验与去重 → WorkBuddy 公众号贴图发表 → 回执写回 → 漫画书架归档。</p><div class="buttons"><a class="button dark" href="#/handoff">打开任务交接 ↗</a><a class="button" href="${WT_ARCHIVE_URL}" target="_blank" rel="noopener noreferrer">查看仓库 ↗</a></div></section></div>`;
}
async function wtArchiveRefresh({silent=false}={}){if(wtArchiveBusy)return;wtArchiveBusy=true;wtArchiveError='';if(!silent&&ui.route==='archive')render();try{
 /* Public catalog can be read without login; private catalog remains owner-authenticated on Worker. */
 const result=await wtArchiveApi('sync');if(result.library?.schema!=='davylab.worldtoon.library.v1'||result.queue?.schema!=='davylab.worldtoon.workbuddy-queue.v1')throw Error('仓库目录格式不兼容');
 const a=result.library.items||[];const seenTask=new Set(),seenStory=new Set();const clean=[];
 for(const x of a){if(!x||!x.task_id||seenTask.has(x.task_id)||seenStory.has(x.dedupe_key))continue;seenTask.add(x.task_id);seenStory.add(x.dedupe_key);clean.push(x)}
 wtArchiveSnapshot={library:{...result.library,items:clean},queue:result.queue,repo:result.repo,mode:result.mode||'unknown',visibility:result.visibility||'unknown',configured:result.configured===true};wtArchiveLastSync=Date.now();
 if(!silent&&typeof notify==='function')notify(`仓库同步成功：${clean.length} 条任务、${result.queue.items?.length||0} 条待发表`);
 }catch(err){wtArchiveError=err.name==='AbortError'?'仓库访问超时':String(err.message||err);if(!silent&&typeof notify==='function')notify(wtArchiveError)}finally{wtArchiveBusy=false;if(['archive','library','handoff'].includes(ui.route))render()}}
function wtArchiveCanonicalURL(s){try{const u=new URL(s.trim()),url=new URLSearchParams();for(const [k,v] of Array.from(u.searchParams.entries()).sort(([a],[b])=>a.localeCompare(b))){if(!k.toLowerCase().startsWith('utm_')&&!['fbclid','gclid'].includes(k))url.append(k,v)}return u.hostname.toLowerCase().replace(/^www\./,'')+decodeURIComponent(u.pathname).replace(/\/$/,'').toLowerCase()+'?'+url.toString()}catch{return ''}}
async function wtArchiveKey(p){const sources=validSources(p).map(wtArchiveCanonicalURL).filter(Boolean);let normalized=[...new Set(sources)].sort().join('\n');if(!normalized)normalized=String(p.title||'').toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('')}
async function wtArchivePushTask(p,o,prompt){if(!wtArchiveAuth())throw Error('未登录：任务 ZIP 已保存在本机，但尚未自动派单到 GitHub');const key=await wtArchiveKey(p);if(!/^[a-f0-9]{64}$/.test(key))throw Error('去重指纹生成失败');
 const task={schema:'davylab.worldtoon.task.v2',task_id:o.task_id,title:p.title,subtitle:p.subtitle||'',category:p.category||'',status:'queued',dedupe_key:key,created_at:o.created_at||new Date().toISOString(),producer:'ChatGPT',publisher:'WorkBuddy',mode:o.mode,research_required:o.research_required===true,verification_status:o.verification_status||'pending_research',editorial:{sources:o.source?.urls||[],candidate_summary:o.source?.candidate_summary||'',fact_notes:o.source?.fact_notes||'',verified_facts:o.source?.verified_facts||'',verification_status:o.source?.verification_status||'',fictionalization:o.adaptation?.strategy||'',disclaimer:o.adaptation?.disclaimer||''},panels:o.panels||[],characters:o.adaptation?.characters||'',description:o.story||'',original_task_schema:o.schema};
 const outcome=await wtArchiveApi('tasks',{method:'POST',body:JSON.stringify({task,prompt})});p.handoff={...p.handoff,repository:WT_ARCHIVE_REPO,repoQueuedAt:new Date().toISOString(),repoTaskPath:outcome.path,repoDedupeKey:key,repoCommit:outcome.commit};setChange(p,'GitHub 仓库正式派单：'+(outcome.existing?'已存在同一任务':'新工单'));return outcome;
}
function wtArchiveAutopoll(){if(['archive','library','handoff'].includes(location.hash.split('/')[1])&&Date.now()-wtArchiveLastSync>300000&&!wtArchiveBusy)wtArchiveRefresh({silent:true})}
document.addEventListener('click',ev=>{if(ev.target.closest('[data-archive="refresh"]')){ev.preventDefault();wtArchiveRefresh();}});
// Keep the producer handoff tied to the same source-of-truth as the archive.
function wtArchiveHandoffBanner(){
 const snap=wtArchiveSnapshot,mode=snap?.mode,ready=snap?.queue?.items?.length||0;
 const label=wtArchiveBusy?'扫描中':wtArchiveError?'暂不可用':mode==='public_readonly'?'公开只读 · 禁止派单':mode==='private_authenticated'?'私有仓库已连接':'等待仓库同步';
 const detail=mode==='public_readonly'?'需先改为 Private 并配置 Worker 安全写入权限；本地任务 ZIP 不等于正式入仓。':
             mode==='private_authenticated'?'任务写入仓库后由 ChatGPT 领取；作品验收后进入 WorkBuddy 队列。':
             '平台将自动查询仓库，没收到真实提交和回执之前不会声称完成。';
 return '<section class="box" style="margin-bottom:18px"><div class="sectionbar"><div><div class="kicker">TWO-TRACK / WORKFLOW STATUS</div><h3>Agent 协作交付 · '+wtArchiveHtml(label)+'</h3></div><a class="button" href="#/archive">查看完整状态 ↗</a></div><p class="minor">'+wtArchiveHtml(detail)+'</p><div class="buttons"><button class="button" data-archive="refresh">⟳ 同步仓库</button><span class="chip">待 WorkBuddy 发表：'+ready+'</span><span class="chip">A 轨大模型：停用</span></div></section>';
}
const wtArchiveBaseWorkflow=wtWorkflow;
wtWorkflow=function(){return wtArchiveHandoffBanner()+wtArchiveBaseWorkflow()};

const wtArchiveOldLibrary=library;library=function(){return wtArchiveSection()+wtArchiveOldLibrary()};
window.addEventListener('hashchange',()=>{if(['archive','library','handoff'].includes(location.hash.split('/')[1]))wtArchiveAutopoll()});
setInterval(wtArchiveAutopoll,300000);
queueMicrotask(()=>{if(location.hash.startsWith('#/archive'))parseRoute();wtArchiveAutopoll()});