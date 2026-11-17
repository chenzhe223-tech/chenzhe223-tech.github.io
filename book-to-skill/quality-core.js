'use strict';
// Source-grounded converter for numbered standards and regulatory PDFs.
// Never presents inferred commentary as a verbatim authoritative quotation.
(function (root) {
  const pmark=/^<<<PDF_PAGE:(\d+)>>>$/;
  const reClause=/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,3})\s*(?=[\u3400-\u9fff])(.+)$/;
  const reSection=/^(\d{1,2})\s*\.\s*(\d{1,2})\s+([^\d.].{1,45})$/;
  const reChapter=/^(\d{1,2})\s+([^\d\s.].{1,42})$/;
  const reFooter=/^[-–—]?\s*\d{1,3}\s*[-–—]$/;
  const reTop=/^(?:目\s*录|上海市建设工程工程量清单计价应用规则\s*\(?2025\)?|主编单位|批准部门)$/;
  const safe=(s)=>String(s||'').replace(/\r/g,'').trim();
  const isCJK=(ch)=>/[\u3400-\u9fff]/.test(ch||'');
  const join=(a,b)=>{ if(!a)return b;if(!b)return a;const l=a[a.length-1],r=b[0];return a+(isCJK(l)||isCJK(r)||/[-（(、，。；：:]/.test(l)?'':' ')+b;};
  const normCode=(a,b,c)=>[Number(a),Number(b),Number(c)].join('.');
  function segment(text) {
    const rows=String(text||'').split(/\n/);let page=0, pages=[],clause=null,clauses=[],section='',headings=new Map(),seenClause=false;
    let inAppendix=false;
    function flush(){if(!clause)return;
      const body=clause.lines.reduce((s,l)=>join(s,l),'').replace(/\s+/g,' ').trim();
      if(body){clause.text=body;clause.charCount=body.length;clause.hasEnd=/[。；;.!?）)]$/.test(body);delete clause.lines;clauses.push(clause);}clause=null;
    }
    function addLine(line){if(clause){clause.lines.push(line);clause.endPage=page;}}
    for(let n=0;n<rows.length;n++){
      const line=safe(rows[n]); if(!line)continue;
      let pm=line.match(pmark);if(pm){page=Number(pm[1]);pages.push({page,text:[]});continue;}
      if(page>0&&pages.length){pages[pages.length-1].text.push(line);}
      if(reFooter.test(line)||reTop.test(line)||/^第\s*\d+\s*页$/.test(line))continue;
      const appendix=/^附\s*录\s*[A-ZＡ-Ｚ]\s+/.test(line);
      if(appendix && seenClause){flush();inAppendix=true;continue;}
      if(inAppendix)continue;
      const chm=line.match(reChapter);
      if(chm){const i=Number(chm[1]);if(i>=1&&i<=13&&CHT[i]&&line.replace(/\s/g,'').includes(CHT[i])&&line.length<48){
        flush();section=line;headings.set(i,line);continue;
      }}
      if(reSection.test(line)){section=line;continue;}
      let m=line.match(reClause);
      if(m){let major=Number(m[1]);if(major<1||major>13){addLine(line);continue;}
        if(major===13){flush();inAppendix=true;continue;}
        flush();seenClause=true;
        clause={id:normCode(m[1],m[2],m[3]),chapter:major,section, page:page||null,endPage:page||null,lines:[m[4]],startLine:n+1};
        continue;
      }
      if(!seenClause)continue;
      if(/^\d{2,}[\s|]+\d{6,}/.test(line)&&page>=40){flush();inAppendix=true;continue;}
      if(clause)addLine(line);
    }
    flush();
    return {clauses,headings,pages};
  }
  function classify(c){const t=c.text;
    const types=[];
    if(/不得|不应|不可以|严禁|禁止|不得再|不予/.test(t))types.push('禁止／限制');
    if(/应当|必须|应由|应按|应在|应符合|应采用|应根据|应明确|应列|应编制|应计|应向|应以/.test(t))types.push('义务／要求');
    if(/\b宜\b|宜采用|宜按/.test(t))types.push('推荐');
    if(/可按|可由|可以|可采用|可参照|可明确|可不|可合理/.test(t))types.push('许可／可选');
    if(/=|＝|×|乘以|按照.*计算|计算公式|计算方法/.test(t))types.push('计价／计算');
    if(c.chapter===2)types.push('定义');
    return types.length?types:['其他规定'];
  }
  const CHT={1:'总则',2:'术语',3:'基本规定',4:'工程量清单编制',5:'最高投标限价编制',6:'投标报价编制',7:'合同工程计量',8:'合同价款调整',9:'合同价款期中支付',10:'工程结算与支付',11:'合同价款争议的解决',12:'工程计价成果与档案管理'};
  const codeSort=(a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true});
  function format(c){return '**'+c.id+'**（PDF 第 '+c.page+(c.endPage&&c.endPage!==c.page?'–'+c.endPage:'')+' 页，'+classify(c).join('／')+'）\n\n'+c.text+'\n';}
  function build(text,title,slug,pdfName,hash,totalPages){
    const parsed=segment(text);const clauses=parsed.clauses.sort(codeSort);
    if(clauses.length<6 || !clauses.some(x=>x.chapter===1)){
      if(/^\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{1,3}\s*/m.test(text))throw new Error('识别到编号条文但无法可靠构建完整章节，请检查 PDF 文字层或改用高保真提取器，已阻止低质量 Skill 导出。');
      return null;
    }
    const top=slug+'/';const files={};const grouped=new Map();for(const c of clauses){if(!grouped.has(c.chapter))grouped.set(c.chapter,[]);grouped.get(c.chapter).push(c);}
    const chapterIndex=[];
    for(const [chapter,arr] of [...grouped.entries()].sort((a,b)=>a[0]-b[0])){
      const file='chapters/ch'+String(chapter).padStart(2,'0')+'.md';
      chapterIndex.push({chapter,title:parsed.headings.get(chapter)||CHT[chapter]||('第 '+chapter+' 章'),file,count:arr.length});
      files[top+file]='# '+(parsed.headings.get(chapter)||CHT[chapter]||('第 '+chapter+' 章'))+'\n\n'+
        '> 本文件是原文条款的连续文字整理，页码按 PDF 物理页计算。应以原始 PDF 为准。\n\n'+
        arr.map(format).join('\n---\n\n');
    }
    const glossary=clauses.filter(x=>x.chapter===2);
    const limits=clauses.filter(x=>classify(x).includes('禁止／限制'));
    const methods=clauses.filter(x=>classify(x).includes('计价／计算'));
    const review=clauses.filter(x=>!x.hasEnd || x.text.length<9 || x.text.length>3500);
    const priorities=['1.0.2','1.0.4','1.0.6','3.1.1','3.1.6','3.2.1','3.2.11','3.3.1','3.3.5','3.4.8'];
    const selected=priorities.map(id=>clauses.find(c=>c.id===id)).filter(Boolean);
    files[top+'glossary.md']='# 术语与定义（条款原文）\n\n'+glossary.map(format).join('\n---\n\n');
    files[top+'checks.md']='# 规则核查清单（按完整条文引用）\n\n> 这是供人工核查的索引，不替代原始规范及法律意见。\n\n'+selected.map((c,i)=>'## '+(i+1)+'. '+c.id+'\n\n'+format(c)).join('\n');
    files[top+'constraints.md']='# 禁止、限制与排除事项\n\n> 以下条款中出现限制性措辞，不代表整段只有禁止性要求。请结合适用条件核对全文。\n\n'+(limits.length?limits.map(format).join('\n---\n\n'):'未在已解析的条文中发现相关字样。');
    files[top+'methods.md']='# 计价方法与公式核查索引\n\n> 按原文列出包含计算和计价表述的条款，未自动推导公式。\n\n'+(methods.length?methods.map(format).join('\n---\n\n'):'未在已解析条文中检出公式或计算措辞。');
    files[top+'workflows.md']='# 使用路径：依据章节定位业务\n\n> 本文件是**索引**，不是 AI 语义生成的操作流程，也不是原文自带的“Framework”。\n\n'+chapterIndex.map(c=>'- **'+c.title+'**：查看 ['+c.file+']('+c.file+')，共 '+c.count+' 条完整编号条款').join('\n')+'\n\n## 典型使用方法\n1. 根据业务场景定位章节。\n2. 查看完整条文及适用条件。\n3. 根据条款编号回到原始 PDF 复核。\n4. 需要合同判断时，结合合同文件和适用标准进行人工审核。\n';
    if(parsed.pages.length){for(let i=0;i<parsed.pages.length;i+=20){
      const group=parsed.pages.slice(i,i+20);
      files[top+'source-pages/pages-'+String(group[0].page).padStart(3,'0')+'-'+String(group[group.length-1].page).padStart(3,'0')+'.md'] =
      '# 原始页级文字：PDF 第 '+group[0].page+'–'+group[group.length-1].page+' 页\n\n> PDF 提取的纯文本，**表格列关系未经过复核**；请以 PDF 原件为准。\n\n'+
      group.map(p=>'## PDF 第 '+p.page+' 页\n\n'+p.text.join('\n')).join('\n\n---\n\n');
    }}
    const suspicious=review.map(c=>({id:c.id,page:c.page,end_page:c.endPage,chars:c.charCount,reason:!c.hasEnd?'未以典型结束标点结尾':c.text.length<9?'过短':'过长，疑似跨版面内容'}));
    const quality={status:suspicious.length?'needs_review':'structured_index_ready',source_pages:totalPages,parsed_clauses:clauses.length,numbered_chapters:grouped.size,definitions:glossary.length,prohibitions:limits.length,calculation_related:methods.length, flagged_clauses:suspicious,coverage_note:'只对正文第 1–12 章中可可靠识别的编号条款做结构化；第 13 章补充计量标准及附录表格保留页级原文，但未做表格列结构恢复，不能直接用于自动算量或作为完整权威依据。',semantic_model:'not_used',audit:'禁止切分条文、禁止静默截断。'};
    files[top+'quality-report.json']=JSON.stringify(quality,null,2)+'\n';
    files[top+'clause-index.json']=JSON.stringify(clauses.map(c=>({id:c.id,chapter:c.chapter,section:c.section,page:c.page,end_page:c.endPage,text:c.text,types:classify(c)})),null,2)+'\n';
    const summary=chapterIndex.map(c=>'- ['+c.title+']('+c.file+')：'+c.count+' 条').join('\n');
    files[top+'SKILL.md']='---\nname: '+JSON.stringify(slug)+'\ndescription: '+JSON.stringify('由'+pdfName+'形成的来源可追溯条文索引；按章节检索条款并回到原 PDF 复核，表格未经完整结构恢复。')+'\n---\n\n# '+title+'\n\n'+
      '> **版本说明：资料型 Skill（规则与术语索引），不是已经完成 AI 深度语义提炼的专家代理。**\n\n'+
      '## 使用规则\n- 优先读取本 Skill 的对应章节全文；不要使用截断片段。\n- 回答时引用精确条款编号和 PDF 物理页。\n- 区分“规范原文”“执行建议”“模型推断”，禁止把推断表述为原文规定。\n- 对第 13 章补充计量标准及附录中的表格：本版尚未验证表格列结构，**不得据此自动算量或下权威结论**。\n- 若发生缺页、表格未提取、条文边界异常，提示用户检查原 PDF。\n\n## 正文章节\n'+summary+'\n\n'+
      '## 辅助索引\n- [术语与定义](glossary.md)\n- [执行检查清单](checks.md)\n- [禁止与限制](constraints.md)\n- [计价方法与公式](methods.md)\n- [业务索引](workflows.md)\n- [条文 JSON](clause-index.json)\n- [质量报告](quality-report.json)\n\n'+
      '## 来源\n'+pdfName+'；PDF 共 '+totalPages+' 页；文件 SHA-256：'+hash+'。本 Skill 的章编号与物理页码供检索用，正式核验请引用原 PDF。\n';
    files[top+'manifest.json']=JSON.stringify({source:pdfName,sha256:hash,pages:totalPages,generation:'source-grounded-structure-v2',semantic_model:'none',generated_at:new Date().toISOString(),clauses:clauses.length,chapter_count:grouped.size,quality_flag:suspicious.length?'needs_review':'structured_index_ready',copyright:'Use only sources you are licensed to process; generated content may be restricted.'},null,2)+'\n';
    return {files,counts:{chapters:grouped.size,frameworks:clauses.length,rules:clauses.length},quality};
  }
  const api={segment,classify,build};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.BookSkillQuality=api;
})(typeof window!=='undefined'?window:globalThis);
