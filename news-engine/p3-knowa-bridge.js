/* KNOWA P3: a client-side read-only historical selector in original /studio page.
 * Choosing a lead writes ONLY the existing browser-local topic pool entry; existing
 * KNOWA director and production flows remain authoritative. No automatic publishing.
 */
(function(){
 "use strict";
 const detail=document.getElementById("neP3KnowaDetails");
 const mount=document.getElementById("neP3Knowa");
 if(!detail||!mount)return;
 function id(text){
  let value=2166136261;
  for(const ch of String(text))value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;
  return "ne-p3-"+value.toString(36);
 }
 detail.addEventListener("toggle",()=>{
  if(!detail.open)return;
  if(!window.DAVYLABNewsP3){mount.textContent="历史组件暂不可用，请继续使用现有知识选题池。";return}
  window.DAVYLABNewsP3.mount(mount,{name:"KNOWA",onSelect:function(row){
   if(row?.publishable!==false||!row.source_url?.startsWith("https://"))return;
   let url;try{url=new URL(row.source_url)}catch{return}
   if(url.protocol!=="https:"||url.username||url.password)return;
   const key="knowa:radar:pool:v1";
   let saved=[];try{const read=JSON.parse(localStorage.getItem(key)||"[]");if(Array.isArray(read))saved=read}catch{}
   if(saved.some(x=>x.sourceUrl===url.href)){
    const note=document.getElementById("neP3KnowaNote");
    if(note)note.textContent="这条原文已经在 KNOWA 选题池。";
    return;
   }
   const title=String(row.title||"").trim().slice(0,180);
   if(title.length<5)return;
   const score=Number(row.editorial_score?.total);
   saved.unshift({
    id:id(url.href),title,category:"AI 技术与产业 · 待核验",mode:"latest",
    summary:"新闻历史线索，非科学研究结论；必须对照原文独立核验。"+String(row.summary||"").slice(0,300),
    published:String(row.latest_seen||row.issue_date||"").slice(0,10),
    sourceName:"DAVYLAB News Engine · "+String(row.source||"媒体原文").slice(0,75),
    sourceUrl:url.href,score:Number.isFinite(score)?Math.min(100,Math.max(0,score)):0,
    scoreReason:"News Engine P2 规则评分，非真实阅读量；事实、科研论文及版权必须独立复核",
    scoreBreakdown:row.editorial_score?.parts||null,
    verificationStatus:"source_not_independently_verified",publishable:false,
    issueDate:row.latest_seen||row.issue_date||""
   });
   try{
    localStorage.setItem(key,JSON.stringify(saved.slice(0,600)));
    location.reload(); // Existing KNOWA /api/topics + local pool merge rehydrates native editor
   }catch{
    const note=document.getElementById("neP3KnowaNote");
    if(note)note.textContent="本机选题池不可写，请手动打开原文并保存。";
   }
  }});
 });
})();
