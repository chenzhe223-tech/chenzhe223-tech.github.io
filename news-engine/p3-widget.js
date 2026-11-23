/* DAVYLAB News Engine P3 · shared auditable browser widget (canonical source).
 * Read-only P2 published archive metadata. No AI, scraping, image reuse or auto-publish.
 * Copy identical bytes to comic-studio/news-history-p3.js & topic-studio/news-history-p3.js.
 */
(function(global){
 "use strict";
 const API="https://davylab-news-api.chenzhe223.workers.dev";
 const categories=[["all","全部主题"],["agents","智能体"],["models","模型"],["research","科研"],["products","产品"],["business","商业"],["safety","安全"],["creative","创作"],["other","其他"]];
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const safeUrl=value=>{try{const u=new URL(value);return u.protocol==="https:"&&u.hostname&&!u.username&&!u.password?u.href:""}catch{return""}};
 const css=[
 ".ne-p3{min-width:0;margin:16px 0;padding:18px;border:1px solid #d6e0ec;border-radius:16px;background:#fff;color:#172b45}",
 ".ne-p3 *{box-sizing:border-box}.ne-p3 h3{font-size:18px;line-height:1.4;margin:0 0 4px;color:#203954}",
 ".ne-p3 .ne-sub{color:#667990;font-size:12px;line-height:1.6;margin:2px 0 14px}",
 ".ne-p3-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));align-items:end;gap:9px;margin-bottom:12px}",
 ".ne-p3 label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#65758d;min-width:0}",
 ".ne-p3 input,.ne-p3 select{width:100%;min-width:0;padding:10px 11px;min-height:42px;font-size:14px;color:#1a2e48;border:1px solid #cfdbe9;border-radius:9px;background:#fff}",
 ".ne-p3 button,.ne-p3 .ne-link{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border-radius:9px;border:1px solid #bbccde;background:#f6f9fd;color:#163a64;text-decoration:none;cursor:pointer;font-size:13px}",
 ".ne-p3 button.ne-primary{background:#183f67;color:#fff;border-color:#183f67}.ne-p3 button:disabled{opacity:.5;cursor:wait}",
 ".ne-p3-status{font-size:12px;color:#59718a;margin:10px 0}",
 ".ne-p3-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}",
 ".ne-p3-card{min-width:0;display:flex;flex-direction:column;gap:8px;padding:15px;border:1px solid #dce5ef;border-radius:12px;background:#fbfcfe}",
 ".ne-p3-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#647990}.ne-p3-meta strong{font-size:12px;color:#204b72}",
 ".ne-p3-card h4{margin:0;font-size:15px;line-height:1.5;overflow-wrap:anywhere;color:#1d3351}",
 ".ne-p3-card p{margin:0;font-size:12px;line-height:1.65;color:#65768b;overflow-wrap:anywhere}",
 ".ne-p3-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:6px}",
 ".ne-p3-more{display:flex;justify-content:center;margin-top:14px}.ne-p3 .ne-p3-note{margin:12px 0 0;font-size:11px;line-height:1.5;color:#718397}",
 "@media(max-width:760px){.ne-p3{padding:12px;margin:12px 0}.ne-p3-grid{grid-template-columns:minmax(0,1fr)}.ne-p3-form{grid-template-columns:repeat(2,minmax(0,1fr))}.ne-p3-form label:first-child{grid-column:1/-1}}"
 ].join("");
 function ensureStyle(){
  if(document.getElementById("davylab-news-p3-style")||document.querySelector("link[data-ne-p3-css]"))return;
  const tag=document.createElement("style");tag.id="davylab-news-p3-style";tag.textContent=css;document.head.append(tag);
 }
 function mount(target,options={}){
  const root=typeof target==="string"?document.getElementById(target):target;
  if(!root)return null;
  if(root.__neP3)return root.__neP3;
  ensureStyle();
  root.classList.add("ne-p3");
  const cats=categories.map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join("");
  root.innerHTML='<h3>新闻历史检索 · News Engine</h3>'+
   '<p class="ne-sub">最多检索30期已发表 AI 日报，五维规则分不是社交热度或事实核验。</p>'+
   '<form class="ne-p3-form" data-ne-form>'+
    '<label>关键词<input name="q" type="search" maxlength="100" placeholder="公司、研究、模型、事件…"></label>'+
    '<label>历史范围<select name="days"><option value="7">最近7期</option><option value="14">最近14期</option><option value="30">最近30期</option></select></label>'+
    '<label>主题分类<select name="category">'+cats+'</select></label>'+
    '<label>地区<select name="region"><option value="all">中国与全球</option><option value="china">中国动态</option><option value="global">国际资讯</option></select></label>'+
    '<label>排序<select name="sort"><option value="score">规则评分</option><option value="latest">最新日期</option></select></label>'+
    '<button type="submit" class="ne-primary">搜索已发表新闻</button></form>'+
   '<div class="ne-p3-status" role="status" data-ne-status>只检索已发布期刊，非实时全网搜索。</div>'+
   '<div class="ne-p3-grid" data-ne-list></div>'+
   '<div class="ne-p3-more"><button type="button" data-ne-more hidden>加载更多</button></div>'+
   '<p class="ne-p3-note">全部新闻须人工查证原始出处；不可自动发表、挪用第三方图片或将编辑规则分当作阅读量。</p>';
  const form=root.querySelector("[data-ne-form]"),status=root.querySelector("[data-ne-status]"),
   list=root.querySelector("[data-ne-list]"),more=root.querySelector("[data-ne-more]");
  const state={results:[],offset:0,busy:false};
  function paint(){
   list.innerHTML=state.results.map((item,i)=>{
    const score=item.editorial_score||{},parts=score.parts||{},href=safeUrl(item.source_url);
    if(!href)return"";
    const n=Number(score.total),value=Number.isFinite(n)?Math.max(0,Math.min(100,n)):"—";
    const explanation="时效 "+(parts.timeliness??"?")+"/30 · 来源 "+(parts.traceability??"?")+
       "/20 · 实用 "+(parts.practicality??"?")+"/20 · 匹配 "+(parts.topic_match??"?")+
       "/20 · 编辑 "+(parts.editorial_priority??"?")+"/10";
    return '<article class="ne-p3-card" data-ne-card><div class="ne-p3-meta"><strong>规则分 '+value+
      '/100</strong><span>'+esc(item.topic_category||"other")+'</span><span>'+esc(item.latest_seen||item.issue_date||"")+'</span></div>'+
      '<h4>'+esc(item.title||"新闻线索")+'</h4><p>'+esc(item.summary||"请核对原文")+'</p>'+
      '<p>'+esc(explanation)+'</p><p>来源：'+esc(item.source||"未知媒体")+' · 首次收录 '+esc(item.first_seen||item.issue_date||"")+'</p>'+
      '<div class="ne-p3-actions"><a class="ne-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">核对原文</a>'+
      '<button type="button" data-ne-pick="'+i+'">加入'+esc(options.name||"当前")+'选题</button></div></article>';
   }).join("");
  }
  async function search(next=false){
   if(state.busy)return;
   const q=String(form.elements.q.value||"").trim();
   if(q.length===1){status.textContent="关键词至少2字；也可留空浏览全部。";return}
   const days=Number(form.elements.days.value),cat=form.elements.category.value,
    region=form.elements.region.value,sort=form.elements.sort.value;
   if(![7,14,30].includes(days)||!categories.some(x=>x[0]===cat)||
      !["all","china","global"].includes(region)||!["score","latest"].includes(sort))return;
   state.busy=true;more.disabled=true;const offset=next?state.offset:0;
   const query=new URLSearchParams({days:String(days),category:cat,region,q,sort,offset:String(offset),limit:"15"});
   status.textContent="正在查询已发布历史归档…";
   try{
    const route=q?"/api/v2/search":"/api/v2/news";
    const r=await fetch(API+route+"?"+query.toString(),{cache:"no-store",signal:AbortSignal.timeout(35000)});
    if(!r.ok)throw Error("接口 HTTP "+r.status);
    const d=await r.json();
    if(d?.schema_version!=="2.0.0"||d.publishable!==false||!Array.isArray(d.data)||d.data.length>15)
      throw Error("V2 响应结构不符");
    const fresh=d.data.filter(x=>x&&x.publishable===false&&
     x.verification_status==="requires_independent_fact_check"&&
     x.editorial_score?.method==="deterministic_rule_v2_not_social_heat"&&safeUrl(x.source_url));
    if(next)state.results.push(...fresh);else state.results=fresh;
    state.offset=offset+d.data.length;paint();
    const total=Number(d.total)||0;
    status.textContent="匹配 "+total+" 条 · 显示 "+state.results.length+
     " 条 · 有效期刊 "+d.scanned_issues+"/"+d.attempted_issues+
     (d.partial?" · 有缺失归档 "+(d.missing_issues?.length||0)+" 期":" · 归档完整")+" · 全部待核验";
    more.hidden=state.offset>=total||d.data.length===0;
   }catch(err){
    status.textContent="历史检索暂不可用："+String(err.message||err).slice(0,130)+"。原平台选题不受影响。";
    if(!next){state.results=[];state.offset=0;list.textContent="仍可使用原有选题池。"}
   }finally{state.busy=false;more.disabled=false}
  }
  form.addEventListener("submit",ev=>{ev.preventDefault();search()});
  more.addEventListener("click",()=>search(true));
  list.addEventListener("click",ev=>{
   const btn=ev.target.closest("[data-ne-pick]");if(!btn)return;
   const item=state.results[Number(btn.dataset.nePick)];
   if(!item||item.publishable!==false||!safeUrl(item.source_url))return;
   if(typeof options.onSelect==="function")options.onSelect({...item});
  });
  root.__neP3={search,state,version:"P3.0"};
  if(options.autoLoad!==false)search();
  return root.__neP3;
 }
 global.DAVYLABNewsP3={mount,version:"P3.0",api:API};
})(window);
