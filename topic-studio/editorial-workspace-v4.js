/* DAVYLAB Editorial Workspace V4.
 * Visual-only navigation: preserves all discovery data, topic actions, and filters.
 * Supports keyboard navigation, hash deep links, and a non-JS stacked fallback.
 */
(function(){
"use strict";
const page=document.getElementById("section-discover");
const nav=page?.querySelector(".discover-quicknav");
if(!page||!nav)return;
const sourceNodes={radar:page.querySelector(".opportunity-hub"),xnews:page.querySelector(".xnews-hub"),finance:page.querySelector(".finance-hub")};
const links=[...nav.querySelectorAll("[data-discover-target]")];
const sourceFor=id=>id==="opportunityTitle"?"radar":id==="xnewsTitle"?"xnews":id==="financeTitle"||id==="financeDiscovery"?"finance":null;
const initialHash=window.location.hash;
let saved="";
try{saved=window.sessionStorage.getItem("davylab-discovery-active-source")||""}catch{}
function markActive(type){
 const next=type==="xnews"?"xnews":type==="finance"?"finance":"radar";
 page.dataset.activeSource=next;
 for(const link of links){
  const isActive=sourceFor(link.dataset.discoverTarget)===next;
  if(isActive){link.setAttribute("aria-current","page");link.setAttribute("aria-label",({radar:"编辑精选",xnews:"海外观点",finance:"财经资讯"}[next])+"：当前查看的来源")}
  else {link.removeAttribute("aria-current");link.removeAttribute("aria-label")}
 }
 try{window.sessionStorage.setItem("davylab-discovery-active-source",next)}catch{}
}
function nextScrollTarget(type){return type==="finance"?sourceNodes.finance:page.querySelector(".discover-index")}
function setSource(type,scroll=true){
 markActive(type);
 if(scroll){
  const header=nextScrollTarget(type);
  if(header?.scrollIntoView){
   const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
   header.scrollIntoView({behavior:reduced?"instant":"smooth",block:"start"});
  }
 }
}
function openDetail(target){
 const targetEl=document.getElementById(target);
 if(!targetEl||targetEl.tagName!=="DETAILS")return false;
 targetEl.open=true;
 const reduced=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
 targetEl.scrollIntoView({behavior:reduced?"instant":"smooth",block:"start"});
 return true;
}
markActive(sourceFor(initialHash.slice(1))||((initialHash.includes("xnews")?"xnews":saved)));
page.classList.add("discover-tabs-ready");
// Capture beats the retired V3 anchor delegate and prevents hidden-panel deep links.
nav.addEventListener("click",event=>{
 const link=event.target.closest?.("a[data-discover-target]");
 if(!link||!nav.contains(link))return;
 const id=link.dataset.discoverTarget;
 const type=sourceFor(id);
 if(type){
  event.preventDefault();
  event.stopImmediatePropagation();
  setSource(type);
  return;
 }
 if(openDetail(id)){
  event.preventDefault();
  event.stopImmediatePropagation();
 }
},true);
window.addEventListener("hashchange",()=>{
 const id=window.location.hash.slice(1);
 const type=sourceFor(id);
 if(type)setSource(type,false);
 else openDetail(id);
});
window.DAVYLABEditorialWorkspace={version:"4.0.0",setSource,getActiveSource:()=>page.dataset.activeSource};
})();