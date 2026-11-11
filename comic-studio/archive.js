/* WORLD/TOON v2.5 · GitHub comic archive adapter. No model calls and no auto publication. */
'use strict';
const WT_ARCHIVE_REPO='chenzhe223-tech/worldtoon';
const WT_ARCHIVE_URL='https://github.com/'+WT_ARCHIVE_REPO;
const WT_ARCHIVE_CLIENT_REV='3.0.0';
let wtArchiveSnapshot=null,wtArchiveError='',wtArchiveBusy=false,wtArchiveLastSync=0,wtSharedStandalone=null;
const wtArchiveHtml=v=>typeof e==='function'?e(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wtArchiveAuth=()=>typeof wtSession!=='undefined'&&wtSession?.access_token||'';
async function wtArchiveApi(path,options={}){
  const headers=new Headers(options.headers||{});const access=wtArchiveAuth();
  if(access)headers.set('authorization','Bearer '+access);
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),String(path).startsWith('assets?')?45000:15000);
  // Cache-bust GETs until existing clients upgrade their older, API-caching Service Worker.
  const method=String(options.method||'GET').toUpperCase();
  const endpoint='/api/archive/'+path+(method==='GET'?'?rev='+WT_ARCHIVE_CLIENT_REV+'&_='+Date.now():'');
  try{const res=await fetch(endpoint,{...options,headers,signal:controller.signal,cache:'no-store'});
    const body=await res.json().catch(()=>({error:'归档服务响应异常'}));if(!res.ok)throw Error(body.error||('HTTP '+res.status));return body;
  }finally{clearTimeout(timeout)}
}
function wtArchiveStateLabel(row){const names={queued:'等待 ChatGPT 领取',claimed:'ChatGPT 制作中',workbuddy_received:'WorkBuddy 已领取',draft_uploaded:'公众号草稿已核验',failed:'发布执行失败',blocked:'质量审查未通过',cancelled:'已取消',ready_for_workbuddy:'待 WorkBuddy 发表',publishing:'公众号发表中',published:'已发表并入档'};return names[row.status]||'未确认状态';}
function wtArchiveDate(d){try{return d?new Date(d).toLocaleDateString('zh-CN'):'—'}catch{return '—'}}
function wtArchiveSection(){const items=(wtArchiveSnapshot?.library?.items||[]).filter(x=>x.status==='published');const cards=items.slice(0,9).map(it=>`<article class="box" style="min-width:0"><div class="kicker">ARCHIVED / ${wtArchiveHtml(it.task_id)}</div><h3>${wtArchiveHtml(it.title)}</h3><p class="minor">${wtArchiveDate(it.receipt?.published_at)} · 第 ${Number(it.revision)||1} 版 · 正式发表回执</p><div class="buttons"><a class="button dark" href="${wtArchiveHtml(it.receipt?.url||'#')}" target="_blank" rel="noopener noreferrer">阅读公众号漫画 ↗</a></div></article>`).join('');
 return `<section class="box" style="margin-bottom:24px"><div class="sectionbar"><div><div class="kicker">GITHUB / PUBLISHED ARCHIVE</div><h2>仓库已发表漫画</h2></div><a class="button" href="#/archive">查看仓库同步状态 ↗</a></div>${items.length?`<div class="cards2">${cards}</div>`:`<p class="minor">${wtArchiveSnapshot?'仓库尚无经过回执核验的已发表作品。':'尚未从独立仓库取得正式目录；本机作品仍保留在下方。'}</p>`}</section>`;
}
// Shared publication index is read-only. Matching a public article never grants a private QA approval.
const WT_SHARED_PUBLICATION_SOURCE='https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/blob/main/topic-studio/data/published-articles.json';
function wtPublicationTitle(v){return String(v||'').normalize('NFKC').toLowerCase().replace(/[：:]\s*漫画改编\s*$/,'').replace(/[\s\p{P}\p{S}]/gu,'')}
function wtPublicationMatches(p){
 const shared=wtArchiveSnapshot?.shared_publications||wtSharedStandalone,items=Array.isArray(shared?.articles)?shared.articles:[];
 const tid=String(p?.handoff?.taskId||p?.handoff?.repoTaskId||'');
 const row=(wtArchiveSnapshot?.library?.items||[]).find(x=>x.task_id===tid);
 const linked=tid?items.filter(x=>x.task_id===tid):[];
 const name=wtPublicationTitle(p?.title||'');
 // Legacy records without task ID are suggestions, never automatic proof of comic publication.
 const suggested=name?items.filter(x=>!x.task_id&&wtPublicationTitle(x.title)===name):[];
 const published= row?.status==='published'&&row?.receipt?.status==='published'?row.receipt:null;
 return {shared,tid,row,linked,suggested,published};
}
function wtSharedLink(a){
 const url=String(a?.url||'');
 if(!/^https:\/\/mp\.weixin\.qq\.com\/s\//.test(url))return '';
 return '<a href="'+wtArchiveHtml(url)+'" rel="noopener noreferrer" target="_blank">'+wtArchiveHtml(a.title||'阅读公众号文章')+' ↗</a>';
}
function wtSharedHandoffPanel(p){
 const {shared,tid,linked,suggested,published}=wtPublicationMatches(p);
 const total=shared?.status==='synced'?shared.total:'—';
 const last=shared?.last_synced_at?wtArchiveHtml(shared.last_synced_at):'暂无成功同步记录';
 let info='';
 if(published){
  info='<p class="wt-shared-confirm">已收到独立仓库核验的正式发表回执。<a href="'+wtArchiveHtml(published.url)+'" target="_blank" rel="noopener noreferrer">阅读已发表漫画 ↗</a></p>';
 }else if(linked.length){
  const a=linked[0];info='<p class="wt-shared-pending">共享档案已按任务编号 <strong>'+wtArchiveHtml(tid)+'</strong> 关联公众号文章。等待私有仓库 WorkBuddy 回执与图片 SHA/作者审核复核后，才会计入正式已发表。</p><div class="wt-shared-article">'+wtSharedLink(a)+'</div>';
 }else if(suggested.length){
  info='<p class="wt-shared-pending">发现标题相近的公众号文章，仅作为候选；缺少相同任务编号，不能自动认定为漫画成果。</p><div class="wt-shared-article">'+wtSharedLink(suggested[0])+'</div>';
 }else{
  info='<p class="wt-shared-empty">共享档案内暂未发现与当前漫画工单直接关联的已发表文章。不会据此修改当前作品状态。</p>';
 }
 const status=shared?.status==='synced'?'已读取 '+total+' 篇公众号文章':shared?.status==='unavailable'?'共享档案暂不可用':'等待首次读取';
 return '<section class="wt-shared-panel" aria-label="公众号发表档案同步">'+
  '<div class="wt-shared-head"><div><span class="wt-shared-eyebrow">PUBLISHED CONTENT SYNC</span><h2>公众号发表归档</h2></div><button type="button" class="button" data-archive="refresh">⟳ 读取共享档案</button></div>'+
  '<div class="wt-shared-source"><strong>'+wtArchiveHtml(status)+'</strong><span>上次同步 '+last+'</span></div>'+
  info+
  '<p class="wt-shared-meta">来源：<a href="'+WT_SHARED_PUBLICATION_SOURCE+'" target="_blank" rel="noopener noreferrer">GitHub 共享文章档案 ↗</a> · 由 WorkBuddy 同步公众号后台真实发表记录；平台仅作读取，不直接写入共享库。</p>'+
  '<details class="wt-shared-manual"><summary>备用：手工补录公众号链接</summary><div class="wf-form"><div class="field"><label for="wfReceipt">仅在共享档案无法自动关联时使用</label><input id="wfReceipt" type="url" placeholder="https://mp.weixin.qq.com/s/..." value="'+wtArchiveHtml(p?.handoff?.receipt||'')+'"></div><button class="button" data-wf="receipt">记录人工回执</button></div><p class="minor">手工录入只保存本地线索，不会伪造 WorkBuddy 的已发表回执或改变 GitHub 正式状态。</p></details></section>';
}
function wtSharedDeskCard(){
 const shared=wtArchiveSnapshot?.shared_publications||wtSharedStandalone;
 const total=shared?.status==='synced'?String(shared.total):'—';
 const items=Array.isArray(shared?.articles)?shared.articles:[];
 const linked=items.filter(a=>a.task_id&&(wtArchiveSnapshot?.library?.items||[]).some(t=>t.task_id===a.task_id));
 const latest=items.slice(0,3).map(a=>'<li>'+wtSharedLink(a)+' <time>'+wtArchiveHtml(a.publishedAt||'')+'</time></li>').join('');
 const status=shared?.status==='synced'?'已从公众号共享库读取':'未能读取共享库';
 return '<section class="wt-dash-panel wt-shared-desk"><header class="wt-dash-section-title"><div><p class="wt-dash-eyebrow">SHARED PUBLICATIONS</p><h2>公众号发表档案 <span class="wt-dash-count">'+total+'</span></h2></div><a href="'+WT_SHARED_PUBLICATION_SOURCE+'" target="_blank" rel="noopener noreferrer">查看共享档案 ↗</a></header>'+
  '<div class="wt-shared-desk-body"><p>'+wtArchiveHtml(status)+' · 已明确关联 WORLD/TOON 工单 '+linked.length+' 条 · 未关联内容不会视为漫画已发表。</p>'+
  (latest?'<ul>'+latest+'</ul>':'<p class="wt-shared-empty">当前无可展示的正式公众号文章。</p>')+'</div></section>';
}
function wtArchiveDesk(){
 const snap=wtArchiveSnapshot,rows=snap?.library?.items||[],queue=snap?.queue?.items||[];
 // Verified GitHub catalog remains authoritative; pending local work is never silently hidden.
 const remoteIds=new Set(rows.map(x=>x.task_id));
 const pendingLocal=(typeof activeProjects==='function'?activeProjects():[])
  .filter(p=>p?.handoff?.taskId&&!remoteIds.has(p.handoff.taskId))
  .map(p=>({title:p.title||'未命名创作',category:p.category||'',task_id:p.handoff.taskId,
    created_at:p.handoff.taskAt||p.updatedAt||'',repoQueuedAt:p.handoff.repoQueuedAt||null,
    repoError:p.handoff.repoError||''}))
  .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
 const count=n=>snap?String(n):'—';
 const queued=rows.filter(x=>x.status==='queued');
 const work=rows.filter(x=>['workbuddy_received','draft_uploaded','publishing'].includes(x.status));
 const published=rows.filter(x=>x.status==='published');
 const blocked=rows.filter(x=>['blocked','failed'].includes(x.status));
 const condition=wtArchiveBusy?'正在同步':wtArchiveError?(wtArchiveError.includes('登录')?'请先登录':'同步失败'):snap?.mode==='private_authenticated'?'私有仓库已连接':snap?.mode==='public_readonly'?'公开仓库 · 只读':'未连接';
 const connectionTone=wtArchiveError?'alert':snap?.mode==='private_authenticated'?'good':'pending';
 const time=snap&&wtArchiveLastSync?new Date(wtArchiveLastSync).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false}):'尚未同步';
 const stats=[['01','仓库任务',rows.length,'工单总数'],['02','ChatGPT 待领取',queued.length,'等待内容创作'],['03','WorkBuddy 待处理',queue.length,'处理中 '+work.length+' 条'],['04','已发表入档',published.length,'仅统计真实回执']];
 const cards=stats.map(s=>'<article class="wt-dash-kpi"><span class="wt-dash-kpi-label">'+s[0]+' / '+s[1]+'</span><strong>'+count(s[2])+'</strong><small>'+wtArchiveHtml(s[3])+'</small></article>').join('');
 const steps=['选题入池','GitHub 派单','ChatGPT 创作','质量验收','WorkBuddy 发表','回执归档'].map((s,i)=>'<li><small>'+String(i+1).padStart(2,'0')+'</small><span>'+s+'</span></li>').join('');
 const types={queued:'wait',claimed:'active',ready_for_workbuddy:'active',workbuddy_received:'active',draft_uploaded:'active',publishing:'active',blocked:'warn',failed:'warn',published:'success'};
 const localItems=pendingLocal.map(it=>{
   const sent=!!it.repoQueuedAt;
   const status=sent?'GitHub 已提交 · 待索引同步':'本地任务 · 尚未入仓';
   const detail=it.repoError||(!sent?'请进入制作交接重新派单；本地 ZIP 不等于 GitHub 正式工单。':'提交记录已保存，等待仓库索引确认。');
   return '<article class="wt-dash-task"><div class="wt-dash-task-main"><small>'+
    wtArchiveHtml((it.category?it.category+' · ':'')+it.task_id)+' · '+wtArchiveDate(it.created_at)+
    '</small><h3><a class="wt-dash-task-link" href="#/handoff">'+wtArchiveHtml(it.title)+' ↗</a></h3>'+
    '<p class="wt-dash-issue">'+wtArchiveHtml(detail)+'</p></div><span class="wt-dash-status wt-dash-status--'+
    (sent?'active':'warn')+'">'+wtArchiveHtml(status)+'</span></article>';
  }).join('');
 const items=localItems+rows.map(it=>{
  const issues=Array.isArray(it.issues)&&it.issues.length?'<p class="wt-dash-issue">'+wtArchiveHtml(it.issues.join('；'))+'</p>':'';
  const meta=(it.category?wtArchiveHtml(it.category)+' · ':'')+wtArchiveHtml(it.task_id)+' · '+wtArchiveDate(it.created_at);
  return '<article class="wt-dash-task"><div class="wt-dash-task-main"><small>'+meta+'</small><h3><a class="wt-dash-task-link" href="'+WT_ARCHIVE_URL+'/tree/main/tasks/'+encodeURIComponent(it.task_id)+'" target="_blank" rel="noopener noreferrer">'+wtArchiveHtml(it.title)+' ↗</a></h3>'+issues+'</div><span class="wt-dash-status wt-dash-status--'+(types[it.status]||'wait')+'">'+wtArchiveHtml(wtArchiveStateLabel(it))+'</span></article>';
 }).join('');
 const empty=snap?'当前无仓库任务，可前往制作交接中心创建。':'尚未读取私有仓库。请登录后刷新；未连接不代表没有任务。';
 const message=wtArchiveError?'<p class="wt-dash-error">'+wtArchiveHtml(wtArchiveError)+'</p>':'';
 return '<div class="wt-dash">'+
  '<header class="wt-dash-head"><div><p class="wt-dash-eyebrow">WORLD/TOON / PRODUCTION DESK</p><h1>生产调度中心</h1><p>从任务派发到成果发表，一处掌握生产进度。</p></div>'+
  '<div class="wt-dash-actions"><button class="button dark" data-archive="refresh" '+(wtArchiveBusy?'disabled':'')+'>'+(wtArchiveBusy?'正在同步…':'⟳ 刷新任务')+'</button><a class="button" href="'+WT_ARCHIVE_URL+'" target="_blank" rel="noopener noreferrer">查看 GitHub ↗</a></div></header>'+
  '<section class="wt-dash-connect" aria-label="仓库连接"><div class="wt-dash-connect-info"><div class="wt-dash-connect-title"><span class="wt-dash-dot wt-dash-dot--'+connectionTone+'"></span><strong>'+wtArchiveHtml(condition)+'</strong><span class="wt-dash-private">'+(snap?.visibility==='private'?'PRIVATE':'GITHUB')+'</span></div><p>chenzhe223-tech / worldtoon · 上次同步 '+wtArchiveHtml(time)+'</p>'+message+'</div><div class="wt-dash-connect-actions"><a href="#/handoff">制作交接 ↗</a><a href="#/account">账户与同步 ↗</a></div></section>'+
  (snap?.mode==='public_readonly'?'<p class="wt-dash-notice">当前仓库公开只读，未发表素材禁止写入。</p>':'')+
  '<section class="wt-dash-metrics" aria-label="任务统计">'+cards+'</section>'+
  wtSharedDeskCard()+
  '<section class="wt-dash-panel wt-dash-workflow"><header class="wt-dash-section-title"><div><p class="wt-dash-eyebrow">WORKFLOW</p><h2>交付流程</h2></div><span>双轨创作 · 统一验收</span></header><ol class="wt-dash-steps">'+steps+'</ol></section>'+
  '<section class="wt-dash-panel wt-dash-queue"><header class="wt-dash-section-title"><div><p class="wt-dash-eyebrow">LIVE QUEUE</p><h2>当前任务 <span class="wt-dash-count">'+count(rows.length+pendingLocal.length)+'</span></h2></div><a href="#/handoff">新建制作任务 ↗</a></header>'+
  (pendingLocal.length?'<p class="wt-dash-notice">'+pendingLocal.length+' 条本地创建任务尚未进入 GitHub 正式索引，已单独列出；不计入仓库工单统计。</p>':'')+
   (blocked.length?'<p class="wt-dash-notice">'+blocked.length+' 条任务需要复核，暂不进入自动发表队列。</p>':'')+
  '<div class="wt-dash-tasklist">'+(items||'<p class="wt-dash-empty">'+wtArchiveHtml(empty)+'</p>')+'</div></section>'+
  '<div class="wt-dash-tracks"><article><span>TRACK A / 接口预留</span><h3>平台自主生产</h3><p>保留自定义模型接口，当前未启用 AI 生图与收费推理。</p></article><article class="wt-dash-track-current"><span>TRACK B / 当前流程</span><h3>Agent 协作交付</h3><p>平台派单 → ChatGPT 创作 → GitHub 验收 → WorkBuddy 发表 → 回执归档。</p></article></div></div>';
}
async function wtArchiveRefresh({silent=false}={}){if(wtArchiveBusy)return;wtArchiveBusy=true;wtArchiveError='';if(!silent&&ui.route==='archive')render();try{
 /* Public catalog can be read without login; private catalog remains owner-authenticated on Worker. */
 const result=await wtArchiveApi('sync');if(result.library?.schema!=='davylab.worldtoon.library.v1'||result.queue?.schema!=='davylab.worldtoon.workbuddy-queue.v1')throw Error('仓库目录格式不兼容');
 const a=result.library.items||[];const seenTask=new Set(),seenStory=new Set();const clean=[];
 for(const x of a){if(!x||!x.task_id||seenTask.has(x.task_id)||seenStory.has(x.dedupe_key))continue;seenTask.add(x.task_id);seenStory.add(x.dedupe_key);clean.push(x)}
 wtSharedStandalone=result.shared_publications||wtSharedStandalone;wtArchiveSnapshot={library:{...result.library,items:clean},queue:result.queue,shared_publications:result.shared_publications||wtSharedStandalone||{status:'unavailable',articles:[],total:null},repo:result.repo,mode:result.mode||'unknown',visibility:result.visibility||'unknown',configured:result.configured===true};wtArchiveLastSync=Date.now();
 if(!silent&&typeof notify==='function')notify(`仓库同步成功：${clean.length} 条任务、${result.queue.items?.length||0} 条待发表`);
 }catch(err){wtArchiveSnapshot=null;wtArchiveLastSync=0;wtArchiveError=err.name==='AbortError'?'仓库访问超时':String(err.message||err);try{wtSharedStandalone=await wtArchiveApi('publications')}catch{wtSharedStandalone={status:'unavailable',articles:[],total:null}}if(!silent&&typeof notify==='function')notify(wtArchiveError)}finally{wtArchiveBusy=false;if(['archive','library','handoff'].includes(ui.route))render()}}
function wtArchiveCanonicalURL(s){try{const u=new URL(s.trim()),url=new URLSearchParams();for(const [k,v] of Array.from(u.searchParams.entries()).sort(([a],[b])=>a.localeCompare(b))){if(!k.toLowerCase().startsWith('utm_')&&!['fbclid','gclid'].includes(k))url.append(k,v)}return u.hostname.toLowerCase().replace(/^www\./,'')+decodeURIComponent(u.pathname).replace(/\/$/,'').toLowerCase()+'?'+url.toString()}catch{return ''}}
async function wtArchiveKey(p){const sources=validSources(p).map(wtArchiveCanonicalURL).filter(Boolean);let normalized=[...new Set(sources)].sort().join('\n');if(!normalized)normalized=String(p.title||'').toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');if(p.creativeRevision){if(!/^r[2-9][0-9]*-[a-z0-9]{8}$/.test(p.creativeRevision))throw Error('创意修订版本号不合法');normalized+='\nrevision:'+p.creativeRevision}if(p.seriesId&&p.seriesEpisode){normalized+='\nseries:'+p.seriesId+':'+p.seriesEpisode}const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('')}
async function wtArchivePushTask(p,o,prompt){if(!wtDirector?.approved?.(p))throw Error('请先在创意导演台确认并锁定画风、人物与九格剧情');if(!wtArchiveAuth())throw Error('未登录：任务 ZIP 已保存在本机，但尚未自动派单到 GitHub');const key=await wtArchiveKey(p);if(!/^[a-f0-9]{64}$/.test(key))throw Error('去重指纹生成失败');
 const task={schema:'davylab.worldtoon.task.v2',task_id:o.task_id,title:p.title,subtitle:p.subtitle||'',category:p.category||'',status:'queued',dedupe_key:key,created_at:o.created_at||new Date().toISOString(),producer:o.producer||'ChatGPT',publisher:'WorkBuddy',panel_count:p.panels.length,series:o.series||undefined,mode:o.mode,research_required:o.research_required===true,verification_status:o.verification_status||'pending_research',editorial:{sources:o.source?.urls||[],candidate_summary:o.source?.candidate_summary||'',fact_notes:o.source?.fact_notes||'',verified_facts:o.source?.verified_facts||'',verification_status:o.source?.verification_status||'',fictionalization:o.adaptation?.strategy||'',disclaimer:o.adaptation?.disclaimer||''},panels:o.panels||[],characters:o.adaptation?.characters||'',description:o.story||'',creative_direction:o.creative_direction||null,creative_revision:p.creativeRevision||undefined,original_task_schema:o.schema};
 const outcome=await wtArchiveApi('tasks',{method:'POST',body:JSON.stringify({task,prompt})});p.handoff={...p.handoff,repository:WT_ARCHIVE_REPO,repoQueuedAt:new Date().toISOString(),repoTaskPath:outcome.path,repoDedupeKey:key,repoCommit:outcome.commit};setChange(p,'GitHub 仓库正式派单：'+(outcome.existing?'已存在同一任务':'新工单'));return outcome;
}
function wtArchiveAutopoll(){if(['archive','library','handoff'].includes(location.hash.split('/')[1])&&document.visibilityState==='visible'&&Date.now()-wtArchiveLastSync>900000&&!wtArchiveBusy)wtArchiveRefresh({silent:true})}
document.addEventListener('click',ev=>{if(ev.target.closest('[data-archive="refresh"]')){ev.preventDefault();wtArchiveRefresh();}});
// Keep the producer handoff tied to the same source-of-truth as the archive.
function wtArchiveHandoffBanner(){
 const snap=wtArchiveSnapshot,mode=snap?.mode,ready=snap?.queue?.items?.length||0;
 const label=wtArchiveBusy?'扫描中':wtArchiveError?'私有仓授权待配置':mode==='public_readonly'?'公开只读 · 禁止派单':mode==='private_authenticated'?'私有仓库已连接':'等待仓库同步';
 const detail=mode==='public_readonly'?'需先改为 Private 并配置 Worker 安全写入权限；本地任务 ZIP 不等于正式入仓。':
             mode==='private_authenticated'?'任务写入仓库后由 ChatGPT 领取；作品验收后进入 WorkBuddy 队列。':
             '平台将自动查询仓库，没收到真实提交和回执之前不会声称完成。';
 return '<section class="box" style="margin-bottom:18px"><div class="sectionbar"><div><div class="kicker">TWO-TRACK / WORKFLOW STATUS</div><h3>Agent 协作交付 · '+wtArchiveHtml(label)+'</h3></div><a class="button" href="#/archive">查看完整状态 ↗</a></div><p class="minor">'+wtArchiveHtml(detail)+'</p><div class="buttons"><button class="button" data-archive="refresh">⟳ 同步仓库</button><span class="chip">待 WorkBuddy 发表：'+ready+'</span><span class="chip">A 轨大模型：停用</span></div></section>';
}
const wtArchiveBaseWorkflow=wtWorkflow;
wtWorkflow=function(){return wtArchiveHandoffBanner()+wtArchiveBaseWorkflow()};

const wtArchiveOldLibrary=library;library=function(){return wtArchiveSection()+wtArchiveOldLibrary()};
window.addEventListener('hashchange',()=>{if(['archive','library','handoff'].includes(location.hash.split('/')[1]))wtArchiveAutopoll()});
setInterval(wtArchiveAutopoll,900000);
queueMicrotask(()=>{if(location.hash.startsWith('#/archive'))parseRoute();wtArchiveAutopoll()});