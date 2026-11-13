/* DAVYLAB Discovery V3: jump to modules; reveal collapsed toolbox details. */
(function(){
"use strict";
const page=document.getElementById("section-discover");
if(!page)return;
const navigation=page.querySelector(".discover-quicknav");
if(!navigation)return;
navigation.addEventListener("click",function(event){
 const link=event.target.closest("a[data-discover-target]");
 if(!link||!navigation.contains(link))return;
 const id=link.dataset.discoverTarget;
 const section=document.getElementById(id);
 if(!section)return;
 if(section.tagName==="DETAILS")section.open=true;
 // Native anchor behavior retains keyboard access and browser history.
 // Avoid animated scrolling for users requesting reduced motion.
 const prefersReduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(section.tagName==="DETAILS"){
   event.preventDefault();
   section.scrollIntoView({behavior:prefersReduced?"instant":"smooth",block:"start"});
 }
});
})();