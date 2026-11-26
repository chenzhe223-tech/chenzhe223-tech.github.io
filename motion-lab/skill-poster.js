const SkillPoster=(()=>{
 const colors=[['#efe9db','#25221d','#97592d'],['#101a2e','#eef4ff','#8bbfff'],['#133b32','#f6f0df','#dfbf7c'],['#321d31','#fff0f4','#f197ad'],['#202120','#f7f6ed','#b5ed48'],['#102f37','#ecfff8','#73d9c3']];
 const mastheads=['THE SKILL REVIEW','ÉDITION','SKILL INDEX','OFF / GRID','IN FOCUS'];
 function draw(canvas,draft,time=1){
  const {items,style,color,format,date,weekly}=draft;
  const h=format===2?1920:1440;
  if(canvas.width!==1080||canvas.height!==h){canvas.width=1080;canvas.height=h;}
  const ctx=canvas.getContext('2d'),[paper,ink,accent]=colors[color];
  const rect=(x,y,w,height,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,w,height);};
  const type=(value,x,y,font,fill,max=940)=>{ctx.fillStyle=fill;ctx.font=font;ctx.fillText(value,x,y,max);};
  rect(0,0,1080,h,paper);
  if(style===0)rect(64,84,952,8,ink);
  if(style===1){ctx.beginPath();ctx.arc(890,150,116,0,Math.PI*2);ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.stroke();}
  if(style===2)for(let x=60;x<1040;x+=60)rect(x,70,1,h-160,accent+'44');
  if(style===3){ctx.save();ctx.translate(800,65);ctx.rotate(-.17);rect(-80,0,330,105,accent);ctx.restore();}
  if(style===4){rect(0,0,1080,90,ink);rect(0,h-92,1080,92,ink);}
  type('KEYPOCKET   /   BY DAVYLAB',66,148,'600 25px sans-serif',ink);
  type(mastheads[style],60,274,['bold 102px serif','italic 136px serif','bold 100px monospace','1000 118px sans-serif','italic bold 128px serif'][style],ink);
  type(weekly?'一周增星 · Skill 推荐榜':'累计 Stars · Skill 推荐榜',66,350,'bold 50px sans-serif',ink);
  const step=Math.min(140,(h-565)/items.length);
  items.forEach((item,i)=>{
   const progress=Math.min(1,Math.max(0,time*1.65-i*.055));
   ctx.save();ctx.globalAlpha=progress;ctx.translate((1-progress)*55,0);
   const y=440+i*step;
   rect(66,y-18,948,2,accent);
   type(String(item.rank).padStart(2,'0'),66,y+37,'bold 38px serif',accent,76);
   type(item.name,155,y+37,'600 43px sans-serif',ink,650);
   ctx.textAlign='right';type(item.metric,1010,y+36,'bold 32px monospace',ink,180);ctx.textAlign='left';ctx.restore();
  });
  type('GITHUB   /   '+date,68,h-119,'500 25px monospace',ink);
 }
 function download(blob,name){
  if(!blob)throw Error('浏览器未能生成文件');
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60000);
 }
 async function png(draft){
  const canvas=document.createElement('canvas');draw(canvas,draft);download(await new Promise(resolve=>canvas.toBlob(resolve)),'KeyPocket-'+draft.date+'.png');
 }
 return {draw,download,png};
})();
