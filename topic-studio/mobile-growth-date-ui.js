/* DAVYLAB Growth Lab · iOS Safari date field bridge (2026-11-15)
 * Visible equal-width shell, real native input overlay for the OS date picker.
 * No shadow state or new storage: existing input IDs and save logic stay intact.
 */
(function(){
 "use strict";
 const ids=["growthStartDate","growthDeadline"];
 function syncOne(input){
   const display=document.getElementById(input.id+"Display");
   if(!display)return;
   const value=input.value;
   display.textContent=/^\d{4}-\d{2}-\d{2}$/.test(value)?value.replace(/-/g,"/"):"选择日期";
   display.classList.toggle("is-placeholder",!value);
 }
 function sync(){
   for(const id of ids){
     const input=document.getElementById(id);
     if(input)syncOne(input);
   }
 }
 for(const id of ids){
   const input=document.getElementById(id);
   if(!input)continue;
   input.addEventListener("input",sync);
   input.addEventListener("change",sync);
   // A native date input fills the shell, so a real touch still opens iOS' own picker.
   // Desktop browsers expose showPicker() which also permits clicking the text area.
   input.addEventListener("click",()=>{
     if(typeof input.showPicker==="function"){
       try{input.showPicker()}catch{/* iOS/Safari falls back to its native tap */ }
     }
   });
 }
 // Existing renderGrowthTarget assigns date values programmatically.
 // Keep the visual text synchronized after saving/importing data.
 if(typeof window.renderGrowthTarget==="function"){
   const existing=window.renderGrowthTarget;
   window.renderGrowthTarget=function(...args){
     const result=existing.apply(this,args);
     sync();
     return result;
   };
 }
 sync();
 window.DAVYLABGrowthDateUI={sync,version:"2.0"};
})();
