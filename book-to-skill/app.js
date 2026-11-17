'use strict';
// The online edition is local-only by design: no user PDF is uploaded.
const SAMPLE = [
'Chapter 1: Source Integrity',
'Framework: Evidence Gate - Require a source URL, date and confidence note before publication.',
'Definition: Source trace - A pointer from a generated claim to its source.',
'Rule: Verify publication dates separately from event dates.',
'Technique: Maintain an evidence log for every published claim.',
'Avoid: Treating a model answer as independent verification.',
'Chapter 2: Controlled Execution',
'Framework: Three-Stage Action - Prepare, verify, and then commit a change.',
'Rule: Require explicit authorization before changing paid resources.',
'Technique: Record test evidence and rollback notes before deployment.',
'Chapter 3: Recovery',
'Framework: Budget and Retry Gate - Retry transient failures inside a fixed budget.',
'Rule: Stop rather than retry on 401 or 403 responses.',
'Avoid: Infinite retry loops that hide faults and increase bills.'
].join('\n');
let currentFile=null, selectedPDF=null, generated=null, filename='', processing=false, cancelRequested=false;
const MAX_PDF_BYTES=40*1024*1024, MAX_EXTRACT_CHARS=5_000_000;
const $=id=>document.getElementById(id);
const escapeSlug=s=>s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,62);
const sha=async bytes=>{const d=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');};
const linesOf=s=>s.replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
function chaptersOf(text){
 const lines=linesOf(text);let groups=[], cur=null;
 const chapter=/^(?:chapter\s+\d+[.:：\s-]*\S.{0,89}|第\s*[零〇一二三四五六七八九十百千0-9]+\s*(?:章|编|篇)\s*.{0,85}|[1-9]\d?\s+[\u3400-\u9fff].{1,55})$/i;
 for(const line of lines){
  if(chapter.test(line)&&groups.length<160){cur={title:line,lines:[]};groups.push(cur);}
  else if(cur){cur.lines.push(line);}
  else{cur={title:'Document Notes',lines:[line]};groups.push(cur);}
 }
 if(!groups.length)throw new Error('没有检测到可转换的文本内容。');
 // After the 160th heading, preserve further content in the final chapter instead of silently dropping text.
 return groups.filter(x=>x.lines.length);
}
function analyze(ch){
 const out={frameworks:[],rules:[],techniques:[],glossary:[],avoids:[],examples:[]};
 const kinds={framework:'frameworks',框架:'frameworks',rule:'rules',principle:'rules',规则:'rules',原则:'rules',technique:'techniques',method:'techniques',技巧:'techniques',方法:'techniques',definition:'glossary',定义:'glossary',avoid:'avoids','anti-pattern':'avoids',避免:'avoids',反模式:'avoids',example:'examples',示例:'examples'};
 for(const line of ch.lines){let m=line.match(/^(?:[•*\-]\s*)?(Framework|框架|Rule|Principle|规则|原则|Technique|Method|技巧|方法|Definition|定义|Avoid|Anti-pattern|避免|反模式|Example|示例)\s*[:：]\s*(.+)$/i);if(!m)continue;
   const val=m[2].replace(/\s+/g,' ').trim().slice(0,280), dest=kinds[m[1].toLowerCase()];if(val&&!out[dest].includes(val))out[dest].push(val);
 }
 // Regulatory texts normally express rules as numbered obligations instead of "Rule:" labels.
 // Only retain explicit source sentences; no interpretation or invented legal conclusions.
 if(!out.rules.length){for(const line of ch.lines){
  if(line.length>=12&&/(?:必须|不得|不应|严禁|应当|应按|应由|应在|应根据|应符合|应计|应采用|应确定|应编制|应列|宜采用|可按|\bAlways\b|\bDo not\b)/i.test(line)){
   const val=line.slice(0,280);if(!out.rules.includes(val))out.rules.push(val);
  }
  if(out.rules.length>=28)break;
 }}
 return out;
}
function splitValue(v){let m=v.split(/\s+[–—-]\s+|\s*[:：]\s*/,2);return m.length===1?[v,'']:[m[0],v.slice(m[0].length).replace(/^\s*[–—:\-]\s*/, '')];}
function buildFiles(text, title, slug, pdfName, hash, pages){
 const chapters=chaptersOf(text).map((c,i)=>Object.assign({},c,{no:i+1,data:analyze(c)}));const root=slug+'/';const out={};
 const chapterKeys=[];let glossary=[],patterns=[], allrules=[];
 for(const ch of chapters){
  const name='chapters/ch'+String(ch.no).padStart(2,'0')+'-'+(escapeSlug(ch.title.replace(/^(chapter\s*\d+[:.\s-]*)/i,''))||'notes')+'.md';chapterKeys.push(name);
  const d=ch.data;
  const section=(name,arr)=>'## '+name+'\n'+(arr.length?arr.map(x=>'- '+x).join('\n'):'- 未在原文检测到明确条目')+'\n\n';
  out[root+name]='# '+ch.title+'\n\n## 核心说明\n本文件仅从上传文档中提炼明确标记的知识；没有根据推测补充未证实的观点。\n\n'+section('Frameworks · 框架',d.frameworks)+section('Rules · 规则',d.rules)+section('Techniques · 技巧',d.techniques)+section('Anti-patterns · 反模式',d.avoids)+section('Examples · 示例',d.examples)+'## 溯源\n原始文档：'+pdfName+'，章节：'+ch.title+'。\n';
  glossary.push(...d.glossary.map(x=>'**'+splitValue(x)[0]+'** — '+(splitValue(x)[1]||'原文未提供进一步定义')+'（'+ch.title+'）'));
  patterns.push(...d.frameworks.map(x=>'- **'+splitValue(x)[0]+'** — '+(splitValue(x)[1]||'详见章节')+'（'+ch.title+'）'));
  allrules.push(...d.rules);
 }
 out[root+'glossary.md']='# 术语表\n\n'+(glossary.length?Array.from(new Set(glossary)).sort().join('\n\n'):'未从原文识别到“Definition/定义”条目。')+'\n';
 out[root+'patterns.md']='# 框架与模式\n\n'+(patterns.length?Array.from(new Set(patterns)).join('\n'):'未识别到显式“Framework/框架”条目。')+'\n';
 out[root+'cheatsheet.md']='# 快速参考\n\n'+(allrules.length?Array.from(new Set(allrules)).map((x,i)=>(i+1)+'. '+x).join('\n'):'没有检测到显式规则，请人工核对原始 PDF。')+'\n';
 const yamlName=JSON.stringify(slug), desc=JSON.stringify('来自 '+pdfName+' 的结构化知识索引，用于按需查阅框架、规则和实践技巧');
 out[root+'SKILL.md']='---\nname: '+yamlName+'\ndescription: '+desc+'\n---\n\n# '+title+'\n\n> 本 Skill 由 Book to Skill Studio 的本地规则模式生成，未经 AI 深度语义提炼。\n> 来源：'+pdfName+'。处理原文时请保留出处并复核规则。\n\n## 使用方式\n根据主题读取下列章节文件，优先引用原文明确标记的框架、定义和规则。不得凭空编造方法论。\n\n## 章节索引\n'+chapters.map((c,i)=>'- ['+c.title+']('+chapterKeys[i]+')').join('\n')+'\n\n## 参考资料\n- [术语表](glossary.md)\n- [框架和模式](patterns.md)\n- [快速参考](cheatsheet.md)\n';
 const items={chapters:chapters.length,frameworks:chapters.reduce((a,c)=>a+c.data.frameworks.length,0),rules:allrules.length};
 out[root+'manifest.json']=JSON.stringify({source:pdfName,sha256:hash,pages:pages,extraction:'pdf.js (browser local)',generation:'explicit-rule local',generated_at:new Date().toISOString(),counts:items,copyright:'Use only documents you are allowed to process; keep third-party derivatives private.'},null,2)+'\n';
 return {files:out,counts:items};
}
function u16(a,p,v){a[p]=v&255;a[p+1]=(v>>>8)&255;}
function u32(a,p,v){u16(a,p,v);u16(a,p+2,v>>>16);}
function crc(data){let x=-1;for(let i=0;i<data.length;i++){x^=data[i];for(let k=0;k<8;k++)x=(x>>>1)^((x&1)?0xedb88320:0);}return (x^-1)>>>0;}
function makeZip(files){const te=new TextEncoder();const locals=[],central=[];let offset=0;
 for(const [path,txt] of Object.entries(files)){const name=te.encode(path),data=te.encode(txt),check=crc(data),loc=new Uint8Array(30+name.length+data.length),cen=new Uint8Array(46+name.length);
  u32(loc,0,0x04034b50);u16(loc,4,20);u16(loc,6,2048);u16(loc,8,0);u32(loc,14,check);u32(loc,18,data.length);u32(loc,22,data.length);u16(loc,26,name.length);loc.set(name,30);loc.set(data,30+name.length);
  u32(cen,0,0x02014b50);u16(cen,4,20);u16(cen,6,20);u16(cen,8,2048);u32(cen,16,check);u32(cen,20,data.length);u32(cen,24,data.length);u16(cen,28,name.length);u32(cen,42,offset);cen.set(name,46);
  locals.push(loc);central.push(cen);offset+=loc.length;}
 const csize=central.reduce((a,x)=>a+x.length,0),end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,central.length);u16(end,10,central.length);u32(end,12,csize);u32(end,16,offset);
 return new Blob([...locals,...central,end],{type:'application/zip'});
}
// A single page is retained at a time; the PDF text is processed in short batches.
function joinTextItems(prev,next){
 if(!prev)return '';
 const a=prev.slice(-1),b=next.slice(0,1);
 if(/[\u3400-\u9fff\uff00-\uffef]/.test(a+b)||/[\s.,:;()\[\]{}%\/\-]/.test(a+b))return '';
 return ' ';
}
async function extractPdf(file,onProgress=()=>{},shouldCancel=()=>false){
 if(!file||!file.name.toLowerCase().endsWith('.pdf'))throw new Error('仅支持 PDF 文件，请上传 .pdf。');
 if(file.size>MAX_PDF_BYTES)throw new Error('PDF 超过 40 MB 安全上限。建议压缩文件或按章节拆分。');
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength<8||new TextDecoder('latin1').decode(new Uint8Array(bytes.slice(0,5)))!=='%PDF-')throw new Error('文件不符合 PDF 标准：缺少 %PDF- 文件头。');
 if(!window.pdfjsLib)throw new Error('PDF.js 加载失败，请检查网络连接或 CDN 是否被拦截。');
 const hash=await sha(bytes); // Before pdf.js potentially transfers/detaches the ArrayBuffer to its worker.
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 let doc;
 try{doc=await pdfjsLib.getDocument({data:new Uint8Array(bytes)}).promise;}
 catch(e){throw new Error('无法解析 PDF：文件可能损坏或已加密。'+(e&&e.message?' '+e.message:''));}
 const total=doc.numPages;
 const result=[];let chars=0,visibleChars=0;
 try{
  onProgress(0,total);
  for(let p=1;p<=total;p++){
   if(shouldCancel())throw new Error('转换已取消，未生成文件。');
   const page=await doc.getPage(p);
   try{
    const content=await page.getTextContent();let lines=[],lastY=null,part='';
    for(const item of content.items){
     const str=(item.str||'').trim();if(!str)continue;
     const y=item.transform?item.transform[5]:0;
     if(lastY!==null&&Math.abs(lastY-y)>3){if(part.trim())lines.push(part.trim());part='';}
     part+=joinTextItems(part,str)+str;lastY=y;
     if(item.hasEOL){if(part.trim())lines.push(part.trim());part='';lastY=null;}
    }
    if(part.trim())lines.push(part.trim());
    const pageText=lines.join('\n');chars+=pageText.length;visibleChars+=pageText.replace(/\s/g,'').length;
    if(chars>MAX_EXTRACT_CHARS)throw new Error('提取文字量超过安全上限（500 万字符），请按章节拆分 PDF 后处理。');
    result.push(pageText);
   }finally{if(typeof page.cleanup==='function')page.cleanup();}
   if(p%4===0||p===total){onProgress(p,total);await new Promise(resolve=>setTimeout(resolve,0));}
   if(p===80&&visibleChars<20)throw new Error('前 80 页未检测到可提取文字，可能是扫描 PDF，请先使用 OCR 转成文字型 PDF。');
  }
  if(visibleChars<50)throw new Error('未检测到足够的可提取文字。该 PDF 可能是扫描件，请先 OCR 后重试。');
  return {text:result.join('\n'),pages:total,hash};
 }finally{try{if(typeof doc.destroy==='function')await doc.destroy();}catch(_){/* keep original error */}}
}
function updateProgress(done,total,label){
 const box=$('progress');if(!box)return;
 box.hidden=false;
 $('progressBar').value=total?Math.round(done/total*100):0;
 $('progressText').textContent=label||('正在读取第 '+done+' / '+total+' 页（'+Math.round(done/total*100)+'%）');
}
function showError(msg){$('error').textContent=msg;$('error').hidden=false;}
function clearError(){$('error').hidden=true;}
function setBusy(v){$('run').textContent=v?'取消转换':'生成 Agent Skill';$('choose').disabled=v;$('sample').disabled=v;$('pdfInput').disabled=v;if(!v)$('progress').hidden=true;}
function render(){if(!generated)return;$('results').hidden=false;$('placeholder').hidden=true;
 $('stat-chapters').textContent=generated.counts.chapters;$('stat-frameworks').textContent=generated.counts.frameworks;$('stat-files').textContent=Object.keys(generated.files).length;
 const tabs=$('fileList');tabs.replaceChildren();for(const path of Object.keys(generated.files)){const b=document.createElement('button');b.type='button';b.className='file-tab';b.textContent=path.split('/').slice(1).join('/');b.title=path;b.onclick=()=>{currentFile=path;renderCode();};tabs.appendChild(b);}
 currentFile=Object.keys(generated.files).find(x=>x.endsWith('/SKILL.md'));renderCode();}
function renderCode(){for(const b of $('fileList').children)b.classList.toggle('active',currentFile.endsWith(b.textContent));$('fileCode').textContent=generated.files[currentFile];}
function sample(){selectedPDF=null;filename='reliable-agent-workflows-example.txt';$('fileName').textContent='内置原创示例 · 3 个章节（文本）';$('sourceType').textContent='当前：结构化文本示例，非 PDF 提取测试';$('title').value='Reliable Agent Workflows';$('slug').value='reliable-agent-workflows';clearError();}
async function go(){
 if(processing){cancelRequested=true;updateProgress(0,0,'正在取消，请完成当前页面后停止…');return;}
 processing=true;cancelRequested=false;clearError();generated=null;
 $('results').hidden=true;$('placeholder').hidden=false;$('success').textContent='';setBusy(true);
 try{
  let text,pages=0,hash,source;
  if(selectedPDF){
   const r=await extractPdf(selectedPDF,(done,total)=>updateProgress(done,total),()=>cancelRequested);
   text=r.text;pages=r.pages;hash=r.hash;source=selectedPDF.name;
  }else{
   if(filename!=='reliable-agent-workflows-example.txt')throw new Error('请上传 PDF 或先选择内置示例。');
   text=SAMPLE;source=filename;hash=await sha(new TextEncoder().encode(text));
  }
  if(cancelRequested)throw new Error('转换已取消，未生成文件。');
  updateProgress(1,1,'正在生成 Skill 文件…');
  const slug=escapeSlug($('slug').value)||('book-'+hash.slice(0,8));
  if(!/^[a-z][a-z0-9-]{0,62}$/.test(slug))throw new Error('Skill 标识必须以字母开头，只能包含小写字母、数字、连字符。');
  const title=($('title').value||source.replace(/\.[a-z]+$/i,'')).trim().slice(0,90);
  const built=buildFiles(text,title,slug,source,hash,pages);
  if(cancelRequested)throw new Error('转换已取消，未生成文件。');
  generated={...built,slug};render();
  $('success').textContent='已生成 '+Object.keys(generated.files).length+' 个文件 · '+pages+' 页 · 本地规则模式';
 }catch(e){showError(e.message||String(e));}
 finally{processing=false;cancelRequested=false;setBusy(false);}
}
function download(){if(!generated)return;const url=URL.createObjectURL(makeZip(generated.files));const a=document.createElement('a');a.href=url;a.download=generated.slug+'-agent-skill.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function init(){
 $('choose').addEventListener('click',()=>$('pdfInput').click());$('pdfInput').addEventListener('change',e=>{if(processing)return;const f=e.target.files[0];if(!f)return;selectedPDF=f;filename=f.name;$('fileName').textContent=f.name+' · '+Math.ceil(f.size/1024)+' KB';$('sourceType').textContent='本地 PDF 文本提取 · 不会上传至服务器';$('title').value=f.name.replace(/\.pdf$/i,'');$('slug').value=escapeSlug(f.name.replace(/\.pdf$/i,''));clearError();});
 $('sample').onclick=sample;$('run').onclick=go;$('download').onclick=download;$('copy').onclick=async()=>{if(currentFile&&generated){try{await navigator.clipboard.writeText(generated.files[currentFile]);$('success').textContent='已复制 '+currentFile;}catch(e){showError('复制失败，请手动选择文本。');}}};
 const zone=$('drop');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('over');});zone.addEventListener('dragleave',()=>zone.classList.remove('over'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');let f=e.dataTransfer.files[0];if(f&&!processing){selectedPDF=f;filename=f.name;$('fileName').textContent=f.name+' · '+Math.ceil(f.size/1024)+' KB';$('title').value=f.name.replace(/\.pdf$/i,'');$('slug').value=escapeSlug(f.name.replace(/\.pdf$/i,''));$('sourceType').textContent='本地 PDF 文本提取 · 不会上传至服务器';}});
}
window.BookSkillCore={chaptersOf,analyze,buildFiles,makeZip,extractPdf};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}