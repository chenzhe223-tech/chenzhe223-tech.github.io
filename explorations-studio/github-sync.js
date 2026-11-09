// DAVYLAB editorial delivery archive. This module never fetches the private GitHub repo directly.
let deliveries=[],loaded=false,working=false,openedId="";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const studio=()=>window.ProductionStudio;
const textState=(id,msg,isError=false)=>{const e=$(id);if(e){e.textContent=msg;e.dataset.error=String(isError)}};
function status(s,err=false){textState("githubSyncStatus",s,err);textState("githubArchiveStatus",s,err)}
const snippet=a=>Array.isArray(a)?a.length:0;
function archiveRows(){const q=($("githubArchiveQuery")?.value||"").trim().toLowerCase();
 const list=deliveries.filter(x=>!q||[x.issue,...(x.news||[]).map(n=>n.title),...(x.skills||[]).map(sk=>sk.name)].join(" ").toLowerCase().includes(q));
 $("githubArchiveRows").innerHTML=list.map(x=>'<tr><td><strong>'+esc(x.issue)+'</strong></td><td>V'+esc(x.revision)+'</td><td><span class="chip current">已发表 · Studio</span></td><td>'+esc(snippet(x.posters))+'/9</td><td>'+esc(x.wechat_status==="not_verified"?"未核实发表":x.wechat_status)+'</td><td><button class="linkbutton" type="button" data-open="'+esc(x.id)+'">查看档案</button></td></tr>').join("")||'<tr><td colspan="6">暂无通过 GitHub 质量验收的正式周刊。未上传完整九图的草稿不会被收录。</td></tr>';
 $("githubArchiveRows").querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{window.switchView?.("assets");open(b.dataset.open)}));
}
function draw(){
 $("githubDeliveries").innerHTML=deliveries.map(x=>'<article class="github-delivery-card"><div class="github-delivery-cover"><small>AI EXPLORATIONS · BY DAVYLAB</small><strong>'+esc(x.issue)+'</strong><small>EDITION '+esc(x.revision)+'</small></div><div class="github-delivery-content"><span class="chip current">Studio 已发表</span><h3>AI Explorations · '+esc(x.issue)+'</h3><div class="github-delivery-meta">ChatGPT 完成 · '+esc(snippet(x.posters))+' 张 PNG<br>7 条新闻 · 5 个 Skill<br>微信发表：'+esc(x.wechat_status==="not_verified"?"尚未核实":"已回写："+x.wechat_status)+'</div><div class="github-delivery-actions"><button type="button" class="btn" data-open="'+esc(x.id)+'">查看本期</button><a href="'+esc(x.github_release_url)+'" rel="noopener noreferrer" target="_blank" class="quiet-link">GitHub 成果 ↗</a></div></div></article>').join("")||'<div class="empty">目前还没有完整通过 GitHub 验收的九图成品。尚未上传或未通过 QA 的批次不会视作已发表。</div>';
 $("githubDeliveries").querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>open(b.dataset.open)));
 archiveRows();
 const released=$("mReleased"),archived=$("mArchived"),all=$("mAll");if(released)released.textContent=deliveries.length;if(archived)archived.textContent=deliveries.length;if(all)all.textContent=deliveries.length;
}
let currentPreviewUrl=null;
async function previewPoster(deliveryId,slot,button){
 if(currentPreviewUrl){URL.revokeObjectURL(currentPreviewUrl);currentPreviewUrl=null}
 const container=$("githubPosterPreview");if(!container)return;
 container.innerHTML='<div class="studio-status">正在安全读取私有 GitHub 的原始 PNG …</div>';
 button.disabled=true;
 try{
  const blob=await studio().githubPoster(deliveryId,slot);
  if(blob.type!=="image/png")throw Error("服务器未返回 PNG 文件");
  currentPreviewUrl=URL.createObjectURL(blob);
  container.innerHTML='<figure style="margin:12px 0"><img style="width:min(100%,420px);height:auto;display:block;border:1px solid var(--line);border-radius:5px" alt="第'+slot+'张真实 PNG 预览"><figcaption class="footnote">第 '+slot+' 张 · GitHub 私有 Release 原图 · 仅供查看</figcaption></figure>';
  container.querySelector("img").src=currentPreviewUrl;
 }catch(e){container.textContent="预览失败："+e.message}
 finally{button.disabled=false}
}
function open(id){const x=deliveries.find(r=>r.id===id);if(!x)return;
 if(currentPreviewUrl){URL.revokeObjectURL(currentPreviewUrl);currentPreviewUrl=null}
 openedId=id;const box=$("githubDeliveryDetails");box.hidden=false;
 const posterHtml=(x.posters||[]).slice().sort((a,b)=>a.slot-b.slot).map(p=>'<button type="button" class="github-poster-item" data-preview="'+esc(p.slot)+'" title="查看真实 PNG"><strong>'+String(p.slot).padStart(2,"0")+'</strong><span>'+esc(p.role==="news"?"新闻贴图":"Skill 推荐")+'</span><small>'+esc(p.width)+'×'+esc(p.height)+' · 查看 ↗</small></button>').join("");
 box.innerHTML='<div class="eyebrow">ARCHIVE RECORD / '+esc(x.issue)+'</div><h3>第 '+esc(x.issue)+' 期 · V'+esc(x.revision)+'</h3><p class="github-delivery-meta">ChatGPT 创作成品已同步至 Studio。点击下方九张素材可查看 GitHub 私有 Release 的真实 PNG；公众号正式发表需 WorkBuddy 独立确认。</p><div class="github-posters">'+posterHtml+'</div><div id="githubPosterPreview"></div><a class="btn dark" href="'+esc(x.github_release_url)+'" target="_blank" rel="noopener noreferrer">下载完整九图素材包 ↗</a><h3>精选新闻</h3><div class="list">'+(x.news||[]).map(n=>'<div class="item"><span>'+esc(n.title)+'</span><a class="quiet-link" href="'+esc(n.url)+'" target="_blank" rel="noopener noreferrer">原文 ↗</a></div>').join("")+'</div><h3>推荐 Skill</h3><div class="list">'+(x.skills||[]).map(n=>'<div class="item"><span>'+esc(n.name)+'</span><a class="quiet-link" href="'+esc(n.url)+'" target="_blank" rel="noopener noreferrer">项目 ↗</a></div>').join("")+'</div>';
 box.querySelectorAll("[data-preview]").forEach(btn=>btn.addEventListener("click",()=>previewPoster(x.id,Number(btn.dataset.preview),btn)));
 box.scrollIntoView({block:"start",behavior:"smooth"});
}
async function list(){
 if(!studio()?.isLogged()){status("请先登录；私有 GitHub 仓库的正式素材仅对授权账号同步。");deliveries=[];draw();return}
 try{const data=await studio().githubRequest("list");deliveries=data.items||[];loaded=true;draw();const t=deliveries.length?"已同步存档 "+deliveries.length+" 个正式版本。点击刷新可检查 GitHub 新交付。":"尚未发现已验收的 GitHub 正式素材包。点击“刷新 · 同步 GitHub”主动拉取最新成果。";status(t)}
 catch(e){status("读取档案失败："+e.message,true)}
}
async function refresh(){
 if(working)return;
 if(!studio()?.isLogged()){studio()?.openAccount();status("请先登录授权账号后同步私有仓库。");return}
 working=true;for(const id of ["githubSyncResults","githubSyncArchive"]){if($(id))$(id).disabled=true}
 status("正在向 GitHub 私有仓库核对正式 Release、九图清单与版本…");
 try{
  const data=await studio().githubRequest("sync");
  await list();
  if(data.warnings?.length)status("同步完成：新增 "+data.imported+"、更新 "+data.updated+"；"+data.warnings.length+" 个版本未通过核验（不予收录）。",true);
  else status("同步成功：新增 "+data.imported+" 期，更新 "+data.updated+" 期。全部收录到成果工作台与历史档案室。");
 }catch(e){const msg=e.code==="GITHUB_TOKEN_MISSING"?"私有仓库同步尚需配置服务端 GitHub 访问凭证；不会把仓库内容公开或虚报同步。":"同步失败："+e.message;status(msg,true)}
 finally{working=false;for(const id of ["githubSyncResults","githubSyncArchive"]){if($(id))$(id).disabled=false}}
}
let initialized=false;
function init(){if(initialized)return;initialized=true;
 $("githubSyncResults")?.addEventListener("click",refresh);
 $("githubSyncArchive")?.addEventListener("click",refresh);
 $("githubArchiveQuery")?.addEventListener("input",archiveRows);
}
window.GithubLibrary={onShow(){init();list()},refresh,load:list,open};
init();