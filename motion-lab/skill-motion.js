(()=>{
 const canvas=document.querySelector('canvas'),status=document.querySelector('[role=status]'),buttons=[...document.querySelectorAll('button')];
 let frame=0;
 try{
  const draft=JSON.parse(decodeURIComponent(location.hash.slice(1)));
  if(!Array.isArray(draft.items)||!draft.items.length||draft.items.length>10||
   !draft.items.every(x=>typeof x.name==='string'&&typeof x.metric==='string'&&Number.isInteger(x.rank))||
   ![0,1,2,3,4].includes(draft.style)||![0,1,2,3,4,5].includes(draft.color))throw Error();
  function animate(done){
   cancelAnimationFrame(frame);const start=performance.now();
   function step(now){const t=(now-start)/2400;SkillPoster.draw(canvas,draft,t);if(t<1.4)frame=requestAnimationFrame(step);else done?.();}
   step(start);
  }
  buttons[0].onclick=()=>animate();
  buttons[1].onclick=()=>SkillPoster.png(draft).catch(e=>status.textContent=e.message);
  buttons[2].onclick=()=>{
   let stream;
   try{
    stream=canvas.captureStream(30);
    const recorder=new MediaRecorder(stream),chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());buttons.forEach(b=>b.disabled=false);
     if(!chunks.length){status.textContent='录制未生成视频，可导出动态 HTML。';return;}
     SkillPoster.download(new Blob(chunks,{type:recorder.mimeType}),'KeyPocket.'+(recorder.mimeType.includes('mp4')?'mp4':'webm'));status.textContent='视频已生成';};
    recorder.start();buttons.forEach(b=>b.disabled=true);status.textContent='正在录制，请保持窗口可见';animate(()=>recorder.stop());
   }catch{stream?.getTracks().forEach(t=>t.stop());status.textContent='当前浏览器无法录制，可导出动态 HTML。';}
  };
  buttons[3].onclick=async()=>{
   try{
    const read=async path=>{const r=await fetch(path);if(!r.ok)throw Error();return r.text();};
    const renderer=await read('./skill-poster.js');
    const data=JSON.stringify(draft).replace(/</g,'\\u003c');
    const output='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>KeyPocket Skill 推荐榜</title><style>body{margin:0;background:#171717;display:grid;place-items:center;height:100dvh}canvas{max-width:100%;max-height:100vh}</style><canvas></canvas><script>'+renderer+'\nconst draft='+data+';const start=performance.now();function tick(t){SkillPoster.draw(document.querySelector("canvas"),draft,(t-start)/2400);if(t-start<3400)requestAnimationFrame(tick)}requestAnimationFrame(tick);<'+ '/script>';
    SkillPoster.download(new Blob([output],{type:'text/html'}),'KeyPocket-motion.html');
   }catch{status.textContent='导出失败，请联网后重试。';}
  };
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)SkillPoster.draw(canvas,draft);else animate();
 }catch{buttons.forEach(b=>b.disabled=true);canvas.hidden=true;status.textContent='请从 KeyPocket 榜单选择 1–10 个项目并打开动态海报。';}
})();
