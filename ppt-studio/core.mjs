export const THEMES = {
  ocean: { name:'深海蓝', ink:'14243d', accent:'2563eb', muted:'5b6b86', background:'ffffff', pale:'eaf2ff' },
  midnight: { name:'深空黑', ink:'f7faff', accent:'82b5ff', muted:'c0cbea', background:'101827', pale:'20314f' },
  violet: { name:'极光紫', ink:'1b1644', accent:'6753df', muted:'777194', background:'ffffff', pale:'f0eefe' },
  emerald: { name:'雨后青', ink:'123c3b', accent:'138a83', muted:'5b7c78', background:'ffffff', pale:'e9f7f4' },
};
export const TYPES = ['cover','content','section','closing'];
export const MAX_SLIDES=80;
export const uid = () => (globalThis.crypto?.randomUUID?.() || `s_${Date.now()}_${Math.random().toString(36).slice(2)}`);
export function freshDeck(title='未命名演示') {
  return { version:1, title: String(title).trim().slice(0,100) || '未命名演示', theme:'ocean', updatedAt:Date.now(), slides:[{id:uid(),type:'cover',title:String(title).trim()||'未命名演示',body:'',notes:'',source:''}] };
}
export function parseOutline(input,title='新演示文稿') {
  const lines=String(input).replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
  const deck=freshDeck(title);
  const pages=[];let current=null;
  for(const line of lines){
    const heading=/^#{1,3}\s+(.+)$/.exec(line);
    if (heading){if(current)pages.push(current); current={id:uid(),type:'content',title:heading[1].slice(0,110),body:'',notes:'',source:''};continue;}
    if (!current){current={id:uid(),type:'content',title:line.replace(/^[-*]\s*/, '').slice(0,110),body:'',notes:'',source:''};continue;}
    const s=line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');
    current.body+=(current.body?'\n':'')+s;
  }
  if(current)pages.push(current);
  if(pages.length===0) throw new Error('请至少输入一行内容。');
  if(pages.length>MAX_SLIDES-1) throw new Error(`最多支持 ${MAX_SLIDES} 页，请缩减大纲。`);
  deck.slides.push(...pages);
  return deck;
}
export function validateDeck(deck){
  const problems=[];
  if(!deck || !Array.isArray(deck.slides) || deck.slides.length===0) return ['演示文稿为空'];
  if(deck.slides.length>MAX_SLIDES)problems.push(`超过 ${MAX_SLIDES} 页限制`);
  deck.slides.forEach((s,i)=>{
    if(!s.title?.trim()) problems.push(`第 ${i+1} 页缺少标题`);
    if((s.title||'').length>90) problems.push(`第 ${i+1} 页标题过长，可能溢出`);
    const max=s.type==='cover'?320:600;
    if((s.body||'').length>max) problems.push(`第 ${i+1} 页正文超过建议字数 ${max}`);
    if(s.body?.split('\n').length>8) problems.push(`第 ${i+1} 页超过 8 行，建议拆页`);
  });
  return problems;
}
export function assertDeck(json){
  if(!json || !Array.isArray(json.slides) || !json.slides.length || json.slides.length>MAX_SLIDES) throw new Error('无效演示项目或页数超限');
  const slides=json.slides.map((s)=>({id:uid(),type:TYPES.includes(s.type)?s.type:'content',title:String(s.title??'').slice(0,250),body:String(s.body??'').slice(0,8000),notes:String(s.notes??'').slice(0,8000),source:String(s.source??'').slice(0,1000)}));
  return { version:1,title:String(json.title||'导入演示').slice(0,100),theme:THEMES[json.theme]?json.theme:'ocean',updatedAt:Date.now(),slides};
}
export function pptxColor(hex){return String(hex).replace('#','').toUpperCase();}
export function safeFilename(str){return (String(str)||'DAVYLAB-PPT').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70)||'DAVYLAB-PPT';}