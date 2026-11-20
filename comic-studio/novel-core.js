/* WORLD/TOON · By DAVYLAB | Book-to-Comic structural distiller v1
 * Novel-focused, source-grounded index inspired by MIT book-to-skill's
 * chapter/evidence pattern. This module does NOT claim to perform LLM semantics.
 * Full source remains in memory until the user explicitly saves a private local copy.
 */
'use strict';
(function(root){
 const MAX_BYTES=40*1024*1024,MAX_CHARS=4_000_000,MAX_CHAPTERS=500;
 const subjects=[
  ['自由与束缚',/自由|束缚|囚禁|逃离|choice|freedom|liberty|prison/ig],
  ['孤独与归属',/孤独|寂寞|隔阂|独处|归属|lonely|loneliness|belong/ig],
  ['家庭与代际',/母亲|父亲|子女|家庭|妻子|丈夫|孩子|family|mother|father|child/ig],
  ['权力与反抗',/权力|统治|反抗|压迫|威胁|阶级|power|rebellion|oppress/ig],
  ['时间与记忆',/时间|回忆|往事|记忆|昨天|过去|memory|remember|past|time/ig],
  ['生死与存在',/死亡|生命|葬礼|病痛|活着|existence|death|life|mortal/ig],
  ['欲望与诱惑',/欲望|贪婪|金钱|渴望|诱惑|desire|greed|want|money/ig],
  ['信仰与怀疑',/信仰|上帝|宗教|祈祷|怀疑|faith|religion|doubt|god/ig],
  ['爱与失去',/爱情|爱人|拥抱|失去|离别|爱着|love|loss|beloved/ig],
  ['真相与谎言',/真相|谎言|秘密|欺骗|证据|truth|lie|secret|deceive/ig],
  ['尊严与人性',/尊严|羞耻|人性|羞辱|尊重|dignity|humanity|shame/ig],
  ['身份与偏见',/身份|偏见|排斥|歧视|陌生人|identity|prejudice|outcast/ig],
  ['希望与绝望',/希望|绝望|梦想|破灭|未来|hope|despair|dream/ig],
  ['自然与环境',/森林|大海|雨水|大地|田野|自然|nature|earth|forest|rain/ig]
 ];
 const nameStops=new Set(['突然','后来','然后','因为','但是','于是','没有','有人','自己','这个','那个','他们','我们','大家','故事','生活','主人','人们','老人','女人','男人','母亲','父亲','孩子','城市','世界','什么','只是','还是','可能','开始','结束','现在','从前','问题','一天','一切','时候','已经','这样','曾经','不能','自己','仿佛','发现','知道','正在','一个','这种','那些','一些','比如','通过']);
 const text=v=>String(v??'').replace(/\r\n?/g,'\n').normalize('NFC');
 const clean=v=>text(v).replace(/\s+/g,' ').trim();
 const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
 const heading=line=>{
  const x=clean(line);
  if(!x||x.length>85)return '';
  return /^(?:第[一二三四五六七八九十百千〇零两0-9]{1,9}[章节回卷部篇](?:\s*[：:\-·.].{0,55}|.{0,48})?|(?:chapter|part|book)\s+(?:[0-9ivxlcdm]+)(?:[\s.:-].{0,60})?|序章|楔子|引子|尾声|终章|后记|前言|序言)$/i.test(x)?x:'';
 };
 function chunkText(t,label='正文',locator='文本'){
  const blocks=t.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  const out=[];let buf='',n=0;
  function push(){if(buf.trim()){out.push({title:label+' · 第'+(++n)+'段',text:buf,location:locator+' / '+n,synthetic:true});buf=''}}
  for(const para of blocks){
   if(para.length>12000){
    push();
    for(let at=0;at<para.length;at+=9500){out.push({title:label+' · 第'+(++n)+'段',text:para.slice(at,at+9500),location:locator+' / '+n,synthetic:true})}
    continue;
   }
   if(buf.length+para.length>10500)push();
   buf+=(buf?'\n\n':'')+para;
  }
  push();
  return out;
 }
 function chapterize(units,kind='text'){
  if(!Array.isArray(units)||!units.length)throw Error('没有可分析的文字章节');
  const normalized=units.map((u,i)=>({text:text(u.text),location:clean(u.location||('正文 '+(i+1))),title:clean(u.title||'')}));
  const length=normalized.reduce((a,u)=>a+u.text.length,0);
  if(length<450)throw Error('正文不足450字，无法提取可信的长篇叙事线索');
  if(length>MAX_CHARS)throw Error('文本超过400万字符的处理上限，请按卷拆分后逐卷导入；系统不会暗中截断');
  let candidates=[];
  if(kind==='epub'){
   candidates=normalized.filter(u=>u.text.trim()).map((u,i)=>({title:(u.title||'章节 '+(i+1)).slice(0,85),text:u.text,location:u.location,synthetic:!u.title}));
  }else{
   let current=null,found=0;
   for(const unit of normalized){
    for(const raw of unit.text.split('\n')){
     if(/^<<<PAGE:\d+>>>$/.test(raw.trim()))continue;
     const h=heading(raw);
     if(h){found++;if(current?.text.trim())candidates.push(current);
      current={title:h,text:'',location:unit.location,synthetic:false};continue}
     if(!current)current={title:'开篇',text:'',location:unit.location,synthetic:true};
     current.text+=(current.text?'\n':'')+raw;
    }
   }
   if(current?.text.trim())candidates.push(current);
   // A PDF without chapter headings is indexed by page-block boundaries rather than claiming chapter titles.
   if(!found){
    candidates=[];
    if(kind==='pdf'){
     for(let k=0;k<normalized.length;k+=8){
      const slice=normalized.slice(k,k+8);
      const part=slice.map(v=>v.text).join('\n\n');
      if(part.trim())candidates.push(...chunkText(part,'PDF 页段 '+(k+1)+'–'+(k+slice.length),slice[0].location));
     }
    }else candidates=chunkText(normalized.map(x=>x.text).join('\n'),'原文片段',normalized[0].location);
   }
  }
  const filled=candidates.filter(c=>c.text.trim().length>0);
  if(!filled.length)throw Error('解析后不存在有效的小说正文');
  if(filled.length>MAX_CHAPTERS)throw Error('提取章节超过500个，请按卷分批处理；不截断章节');
  return filled.map((c,i)=>({id:'CH'+String(i+1).padStart(3,'0'),title:c.title||'章节 '+(i+1),
   text:c.text,location:c.location,synthetic:!!c.synthetic}));
 }
 function counts(s,re){re.lastIndex=0;const m=s.match(re);return m?m.length:0}
 function themes(chapters){
  const rank=subjects.map(([name,re])=>{
   const evidence=chapters.map(ch=>({chapter_id:ch.id,locator:ch.location,occurrences:counts(ch.text,re)}))
     .filter(x=>x.occurrences>0);
   return {name,mentions:evidence.reduce((a,x)=>a+x.occurrences,0),chapter_count:evidence.length,
    evidence:evidence.slice(0,7).map(x=>({chapter_id:x.chapter_id,locator:x.locator}))};
  }).filter(x=>x.mentions>=2).sort((a,b)=>b.chapter_count-a.chapter_count||b.mentions-a.mentions);
  return rank.slice(0,12);
 }
 function castCandidates(chapters){
  const score=new Map();
  for(const chapter of chapters){
   const regex=/([\u3400-\u9fff]{2,4})(?:轻声)?(?:说|问|喊|答|道|笑着说|哭着说|低声说|告诉|回答)/g;
   let m,seen=0;
   while((m=regex.exec(chapter.text))!==null&&seen++<4000){
    let name=m[1];if(name.length===4){const trimmed=name.slice(-2);if(!nameStops.has(trimmed))name=trimmed}
    if(nameStops.has(name)||name.length<2||name.length>4)continue;
    let a=score.get(name)||{name,mentions:0,evidence:new Set()};
    a.mentions++;a.evidence.add(chapter.id);score.set(name,a);
   }
  }
  return [...score.values()].filter(x=>x.mentions>=3&&x.evidence.size>=1)
    .sort((a,b)=>b.evidence.size-a.evidence.size||b.mentions-a.mentions).slice(0,15)
    .map(x=>({name:x.name,mentions:x.mentions,chapter_ids:[...x.evidence].slice(0,5),status:'heuristic_unverified'}));
 }
 function buildSkill(chapters,opts={}){
  if(!Array.isArray(chapters)||!chapters.length)throw Error('未提供原著正文');
  const charCount=chapters.reduce((n,c)=>n+c.text.length,0),ts=themes(chapters);
  if(charCount<450||charCount>MAX_CHARS)throw Error('文本字符数超出范围');
  const indexed=chapters.map(c=>{
   const matches=ts.filter(t=>t.evidence.some(e=>e.chapter_id===c.id)).slice(0,5).map(t=>t.name);
   return {chapter_id:c.id,title:c.title.slice(0,85),locator:c.location.slice(0,140),
    characters:c.text.length,theme_cues:matches,synthetic_chunk:c.synthetic===true,
    evidence_status:'needs_human_review'};
  });
  const local=ts.slice(0,7).map(x=>x.name);
  return {schema:'davylab.worldtoon.novel-skill.v1',
   origin:'Book-to-Skill-inspired chapter indexing; WorldToon novel-focused implementation',
   provenance:{file_name:clean(opts.fileName||'未命名来源').slice(0,180),file_type:opts.fileType||'text',
    sha256:opts.sha256||null,char_count:charCount,chapter_count:indexed.length,
    extraction:'browser_local_no_upload',bibliography_verified:false},
   rights:{mode:opts.rightsMode==='faithful'?'faithful':'literary_review',
    source_license_status:opts.rightsMode==='faithful'?'rights_evidence_pending':'not_claiming_adaptation_rights',
    external_file_transfer_approved:false},
   distillation:{level:'local_structural_index',semantic_model_used:false,
    semantic_status:'not_performed',editorial_fact_check:'pending',no_invented_plot:true},
   chapter_index:indexed,themes:ts,cast_candidates:castCandidates(chapters),
   three_axes:[{id:'overview',panels:[1,2,3],focus:'经核验的作品背景、内容与问题，不逐幕复刻'},
    {id:'philosophy',panels:[4,5,6],focus:'独立哲学评论，注明解释是编辑意见'},
    {id:'reader',panels:[7,8,9],focus:'原创当代普通人的生活与启发'}],
   cues:local,
   qa:{full_text_processed:true,chapter_index_complete:true,source_digest_present:/^[a-f0-9]{64}$/.test(opts.sha256||''),
    character_names_unverified:true,interpretation_not_yet_generated:true,
    rights_pending_verification:true,ready_for_publication:false},
   notes:'此报告只对全文做本地结构索引和词汇线索统计，没有调用大模型。主题词出现≠能证明作品哲学，名字候选可能误判。真正文学理解需基于原文与可信研究作独立核验。'};
 }
 async function script(url,check){
  if(check())return;
  await new Promise((resolve,reject)=>{
   const el=document.createElement('script');el.src=url;el.async=true;
   el.onload=()=>resolve();el.onerror=()=>reject(Error('读取解析依赖失败；请检查浏览器网络或 CDN 配置：'+url));
   document.head.appendChild(el);
  });
 }
 async function unpackPdf(bytes){
  await script('/vendor/pdf.min.js',()=>!!root.pdfjsLib);
  root.pdfjsLib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js';
  const d=await root.pdfjsLib.getDocument({data:new Uint8Array(bytes)}).promise,units=[];
  try{
   if(d.numPages>2500)throw Error('超过2500页，请按卷处理；不截断');
   for(let i=1;i<=d.numPages;i++){
    const page=await d.getPage(i),content=await page.getTextContent();
    let line='',ys=[],texts=[];
    // Preserve text-item order and basic paragraph breaks; do not invent a continuous chapter.
    for(const item of content.items){
     const val=String(item.str||'');if(!val)continue;
     const y=Number(item.transform?.[5]??0),last=ys[ys.length-1];
     if(last!=null&&Math.abs(last-y)>5){texts.push(line);line=''}
     const a=line.slice(-1),b=val.slice(0,1);
     const addSpace=line&&!(/[\u3400-\u9fff\uff00-\uffef]/.test(a+b)||/[\s.,:;()\[\]{}%\/\-]/.test(a+b))?' ':'';
     line+=addSpace+val;ys.push(y);
     if(item.hasEOL){texts.push(line);line=''};
    }
    if(line)texts.push(line);
    units.push({location:'PDF 第 '+i+' 页',text:texts.join('\n')});
   }
  }finally{await d.destroy()}
  if(units.reduce((n,u)=>n+u.text.length,0)<450)
   throw Error('PDF 文字层不足，可能是扫描件；请先合法 OCR 处理后导入。不能把空内容当作小说全文');
  return units;
 }
 async function unpackEpub(bytes){
  await script('/vendor/jszip.min.js',()=>!!root.JSZip);
  const zip=await root.JSZip.loadAsync(bytes),container=zip.file('META-INF/container.xml');
  if(!container)throw Error('EPUB 不包含 META-INF/container.xml');
  const dom=new DOMParser(),cx=dom.parseFromString(await container.async('string'),'application/xml');
  const rootfile=cx.querySelector('rootfile')?.getAttribute('full-path');
  if(!rootfile||rootfile.includes('..')||!zip.file(rootfile))throw Error('EPUB OPF 目录缺失或路径不安全');
  const pathBase=rootfile.includes('/')?rootfile.slice(0,rootfile.lastIndexOf('/')+1):'';
  const opf=dom.parseFromString(await zip.file(rootfile).async('string'),'application/xml');
  const listed=[...opf.querySelectorAll('manifest > item')];
  const manifest=new Map(listed.map(el=>[el.getAttribute('id'),el.getAttribute('href')]));
  const refs=[...opf.querySelectorAll('spine > itemref')];
  if(!refs.length||refs.length>2000)throw Error('EPUB 缺少有效章节目录或超过2000章节');
  const units=[];let total=0;
  for(const node of refs){
   const href=manifest.get(node.getAttribute('idref'));if(!href)continue;
   const raw=decodeURIComponent(href.split('#')[0]).replace(/^\.\//,'');
   const pathname=(pathBase+raw).replace(/\/\.\//g,'/');
   if(pathname.includes('..')||pathname.startsWith('/')||!zip.file(pathname))continue;
   const entry=zip.file(pathname),size=Number(entry?._data?.uncompressedSize||0);
   if(size>2_500_000)throw Error('EPUB 单章解压超过2.5MB，已安全停止');
   const html=await entry.async('string');total+=html.length;
   if(total>MAX_CHARS*2)throw Error('EPUB 正文过大，须按卷拆分；未截断');
   const doc=dom.parseFromString(html,'application/xhtml+xml');
   if(doc.querySelector('parsererror'))continue;
   for(const x of [...doc.querySelectorAll('script,style,nav')])x.remove();
   const body=doc.querySelector('body'),h=body?.querySelector('h1,h2,h3');
   const bodyText=body?.textContent||'';
   const title=clean(h?.textContent||'').slice(0,85)||'EPUB 正文段 '+(units.length+1);
   if(bodyText.trim())units.push({text:bodyText,title,location:'EPUB '+pathname});
  }
  if(!units.length)throw Error('EPUB 的 spine 中未找到可用正文');
  return units;
 }
 async function extractFile(file){
  if(!file||typeof file.arrayBuffer!=='function')throw Error('请选择小说文件');
  if(file.size>MAX_BYTES||file.size<30)throw Error('支持 30B–40MB 的文件；超大作品请按卷拆分');
  const ext=(file.name.match(/\.([^.]+)$/)?.[1]||'').toLowerCase();
  if(!['txt','md','pdf','epub'].includes(ext))throw Error('首版仅支持 TXT、Markdown、文字层 PDF 和 EPUB');
  const bytes=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const sha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  let units;
  if(ext==='pdf')units=await unpackPdf(bytes);
  else if(ext==='epub')units=await unpackEpub(bytes);
  else{
   const bom=new Uint8Array(bytes.slice(0,3));let decoded;
   try{decoded=new TextDecoder(bom[0]===255&&bom[1]===254?'utf-16le':'utf-8',{fatal:true}).decode(bytes)}
   catch{decoded=new TextDecoder('gb18030').decode(bytes)}
   if(decoded.startsWith('\ufeff'))decoded=decoded.slice(1);
   units=[{text:decoded,location:'文本首段'}];
  }
  const chapters=chapterize(units,ext);
  return {chapters,sha256,ext,fileName:file.name,fileSize:file.size,byteSource:bytes};
 }
 const api={heading,chunkText,chapterize,buildSkill,extractFile};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.WTNovelCore=api;
})(typeof window!=='undefined'?window:globalThis);
