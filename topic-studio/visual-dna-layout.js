/* DAVYLAB Topic Studio · Visual DNA layout configuration */
(function(root){
 "use strict";
 const LAYOUTS=["editorial","balanced","vertical","compact","bento","split"];
 const NAVIGATIONS=["left","right","top","bottom","floating","hidden"];
 const defaults={
  layout:{preset:"editorial",contentWidth:"full",customWidth:1600,gap:18,columns:"auto"},
  navigation:{mode:"left",sidebarWidth:225,collapsed:false,drawerOpen:false}
 };
 function clamp(value,min,max,fallback){if(value===null||value===undefined||value==="")return fallback;const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
 function normalize(input){
  const x=input&&typeof input==="object"?input:{};
  const l=x.layout&&typeof x.layout==="object"?x.layout:{};
  const n=x.navigation&&typeof x.navigation==="object"?x.navigation:{};
  return {
   layout:{
    preset:LAYOUTS.includes(l.preset)?l.preset:defaults.layout.preset,
    contentWidth:["full","wide","standard","custom"].includes(l.contentWidth)?l.contentWidth:"full",
    customWidth:clamp(l.customWidth,960,2400,1600),
    gap:clamp(l.gap,8,32,18),
    columns:[2,3,"auto"].includes(l.columns)?l.columns:"auto"
   },
   navigation:{
    mode:NAVIGATIONS.includes(n.mode)?n.mode:"left",
    sidebarWidth:clamp(n.sidebarWidth,176,320,225),
    collapsed:!!n.collapsed,
    drawerOpen:!!n.drawerOpen
   }
  };
 }
 function merge(base,stored){
  const safe=stored&&typeof stored==="object"?stored:{};
  return {...base,...safe,layout:{...(base.layout||{}),...(safe.layout||{})},navigation:{...(base.navigation||{}),...(safe.navigation||{})}};
 }
 function resetLayout(settings){return {...settings,layout:{...defaults.layout},navigation:{...settings.navigation,mode:"left",sidebarWidth:225,collapsed:false,drawerOpen:false}}}
 function resetNavigation(settings){return {...settings,navigation:{...defaults.navigation}}}
 root.DavyLayoutConfig={LAYOUTS,NAVIGATIONS,defaults,normalize,merge,resetLayout,resetNavigation};
})(typeof window!=="undefined"?window:globalThis);
