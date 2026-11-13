/* DAVYLAB Topic Pool Reliability · source-first saved topic locator.
   Does not create or delete topics; restores visibility after status/format/search filters.
*/
(function(){
"use strict";
const by=id=>document.getElementById(id);
const original=function(v){try{const u=new URL(String(v||""),location.href);return u.protocol==="https:"||u.protocol==="http:"?u.origin+u.pathname.replace(/\/$/,"")+u.search:""}catch{return""}};
function reset(){
 if(typeof libraryStatus!=="undefined")libraryStatus="all";
 const query=by("searchTopics"),type=by("formatFilter");
 if(query)query.value="";
 if(type)type.value="all";
 document.querySelectorAll("#libraryFilters [data-status]").forEach(button=>{
   const isAll=button.dataset.status==="all";
   button.classList.toggle("active",isAll);
   button.setAttribute("aria-pressed",String(isAll));
 });
 if(typeof renderTopics==="function")renderTopics();
}
function persisted(){
 try{const a=JSON.parse(localStorage.getItem("davylab-topic-studio-v1")||"[]");return Array.isArray(a)?a:[]}catch{return[]}
}
function locate(sourceUrl){
 const key=original(sourceUrl);
 const local=typeof topics!=="undefined"&&Array.isArray(topics)?topics:[];
 return local.find(t=>original(t.sourceUrl)===key && key)||null;
}
function reveal(sourceUrl){
 const item=locate(sourceUrl);
 reset();
 if(typeof changeSection==="function")changeSection("library");
 if(!item){if(typeof toast==="function")toast("当前浏览器未找到该收藏，请核对本机数据或导入备份");return false}
 const confirmed=persisted().some(t=>t.id===item.id);
 if(!confirmed){if(typeof toast==="function")toast("选题尚未写入本地存储，请重新收藏或检查浏览器存储空间");return false}
 const itemElement=[...document.querySelectorAll("#topicList .topiccard")].find(node=>node.dataset.topicId===item.id);
 if(itemElement){
  itemElement.classList.add("topiccard-focused");
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  itemElement.scrollIntoView({behavior:reduced?"instant":"smooth",block:"center"});
  setTimeout(()=>itemElement.classList.remove("topiccard-focused"),2500);
 }
 if(typeof toast==="function")toast("已定位收藏：《"+(item.title||"未命名").slice(0,20)+"》");
 return true;
}
by("libraryShowAll")?.addEventListener("click",()=>{reset();if(typeof toast==="function")toast("已显示当前浏览器全部选题")});
window.DAVYLABTopicPool={reset,reveal,locate,persisted};
})();