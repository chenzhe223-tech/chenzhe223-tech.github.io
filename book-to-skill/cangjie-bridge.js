'use strict';
/**
 * DAVYLAB Cangjie P0 bridge (candidate-only, no automatic promotion).
 * Adapts the RIA-TV++ review workflow from kangarooking/cangjie-skill (MIT, v2.5.0).
 * No external model calls, secrets, PDF uploads, or executable "verified" skills.
 * Source: https://github.com/kangarooking/cangjie-skill
 */
(function (root) {
  const asText = x => String(x === undefined || x === null ? '' : x);
  const md = x => asText(x).replace(/\r/g, '').replace(/</g, '&lt;');
  const candidateRegex = /应当|必须|应由|应按|应在|应符合|应采用|应明确|应编制|不得|不应|严禁|可按|宜|计算|计价|费率|公式|风险|支付|结算/;
  const VERSION = 'cangjie-p0-candidates-v1';
  const LIMIT = 16;
  function extend(built, meta) {
    if (!built || !built.files || !meta || !meta.slug) throw new Error('缺少原始结构化 Skill 或元信息。');
    const prefix = meta.slug + '/';
    const sourceIndex = built.files[prefix + 'clause-index.json'];
    if (!sourceIndex || !built.quality) {
      throw new Error('仓颉 P0 试验仅支持已通过 V2 编号条文提取的 PDF；请先使用默认来源索引模式。');
    }
    let clauses;
    try { clauses = JSON.parse(sourceIndex); } catch (_) { throw new Error('条文索引 JSON 无法读取，已阻止生成候选包。'); }
    if (!Array.isArray(clauses) || clauses.length < 6 || clauses.some(c => !c.id || !c.text || !Number.isFinite(c.page))) {
      throw new Error('来源条文不完整或缺少可靠物理页码，已阻止候选包导出。');
    }
    const sorted = clauses.slice().sort((a,b) => String(a.id).localeCompare(String(b.id), undefined, {numeric:true}));
    const chosen = sorted.filter(c => candidateRegex.test(c.text)).slice(0, LIMIT);
    const out = {...built.files};
    const folder = prefix + 'cangjie-p0/';
    const metaLine = '来源：' + md(meta.pdfName) + ' | SHA-256：' + md(meta.hash) + ' | PDF 页数：' + Number(meta.pages||0);
    const selected = new Set(chosen.map(c => c.id));
    const fullRef = c => '第 ' + c.page + (c.end_page && c.end_page!==c.page ? '–' + c.end_page : '') + ' 物理页 / 条款 ' + c.id;
    const q= built.quality;
    out[folder+'README.md'] =
      '# 仓颉 RIA-TV++ · P0 待核验候选包\n\n'+metaLine+
      '\n\n状态：**NEEDS_REVIEW — 不可作为已验证的专家 Skill 安装使用**。\n\n'+
      '这是 DAVYLAB 本地来源索引的增量适配器，并未运行仓颉 Python 编译器、五个 AI 提取 Agent 或 AI 语义蒸馏。\n'+
      '原有全文条文、原文页码、质量报告保持不变。候选卡只用于后续人工/Agent 三重验证。\n\n'+
      '参考项目：https://github.com/kangarooking/cangjie-skill （MIT，v2.5.0）\n\n'+
      '工作顺序：核对源 PDF → 人工审查候选 → V1 来源充分性 → V2 可执行性 → V3 任务增益 → RIA 卡补全 → 实际输出测试 → 使用官方编译器。\n\n'+
      '阻断条件：表格未结构化、来源断裂、条文边界异常或需要未经核验的专业判断，均不得晋级为 active Skill。\n';
    out[folder+'PIPELINE_STATE.md'] =
      '# 流水线状态\n\n- 来源结构索引：已生成（尚需核对）\n'+
      '- 阶段 0 整体理解：未执行 AI 深度阅读\n'+
      '- 阶段 1 五维提取：只生成规则型候选草稿；五个 AI Agent 未执行\n'+
      '- 阶段 1.5 三重来源验证：未执行\n'+
      '- 阶段 1.6 晋级门：未执行\n'+
      '- 阶段 2 RIA++：仅空白结构模板，未形成 active 能力\n'+
      '- 阶段 3 关系链接：未执行\n'+
      '- 阶段 4 压力测试：未执行\n'+
      '- 阶段 5 官方编译：未执行\n\n当前状态：NEEDS_REVIEW。不得把候选视作完整 Skill。\n';
    out[folder+'coverage-audit.md'] = '# 条文覆盖审计（所有已解析编号条款）\n\n'+metaLine+
      '\n\n已解析 '+sorted.length+' 条；候选卡 '+chosen.length+' 条；余下只在原始结构索引中待检索。以下“已索引”仅表示程序定位到条文，不表示内容已正确恢复。\n\n'+
      sorted.map(c=>'- '+c.id+' | PDF '+c.page+' 页 | '+(selected.has(c.id)?'候选卡待审核':'结构索引待审核')).join('\n')+'\n\n'+
      '第 13 章和附录表格不在结构化条文候选覆盖范围内，须回查原始 PDF。\n';
    const candidateRecords=[];
    for (const c of chosen) {
      const code=String(c.id).replace(/[^0-9.]/g,'');
      const path='candidates/clause-'+code.replace(/\./g,'-')+'.md';
      const ref=fullRef(c);
      const card =
        '# 条款 '+md(c.id)+' · 待审核候选\n\n'+
        '**状态：NEEDS_REVIEW，尚未通过任何知识验证，不可安装为可执行 Skill。**\n\n'+
        '## R — 来源背景（仅结构定位）\n'+md(meta.pdfName)+'；'+ref+'。\n\n'+
        '## I — 候选意图（待人工提炼）\n待判断此条款是否对应一个独立业务任务，禁止凭关键词自动推定适用场景。\n\n'+
        '## A1 — 原文证据\n'+md(c.text)+'\n\n'+
        '## A2 — 执行步骤（待 AI 语义蒸馏和人工核验）\n未生成；须同时核对适用条件、例外条款及交叉引用。\n\n'+
        '## E — 输入、输出与验收（待验证）\n未生成；须以真实业务测试检验。\n\n'+
        '## B — 边界与风险\n不得把本候选卡当作正式法律或造价咨询依据；表格、公式和外部标准必须回原文复核。\n';
      out[folder+path] = card;
      candidateRecords.push({id:'clause-'+code,source_clause:c.id,source_page:c.page,end_page:c.end_page||c.page,status:'needs_review',verified:false,promoted:false,card:path});
    }
    out[folder+'needs-review.md'] =
      '# 人工与 Agent 复核清单\n\n'+
      '1. 对比原始 PDF：页数、跨页条款、标点和段落是否完整。\n'+
      '2. 确认第 13 章和附录表格未结构化的风险，并记录缺失项目。\n'+
      '3. 对全部条款检查是否遗漏，而非只抽查前 '+LIMIT+' 条候选。\n'+
      '4. 提取可执行的操作方法时，必须标注来源条款、条件、例外和跨条款关联。\n'+
      '5. V1/V2/V3 三重验证不通过时，仅保留参考或待核验状态。\n'+
      '6. 设计至少 1 个正向和 1 个边界/反例测试，失败不得晋级。\n'+
      '7. 最终交付前使用仓颉官方编译与校验，不要把本候选 ZIP 冒充官方 Cangjie Skill Pack。\n\n'+
      '解析器报告：'+asText(q.status)+'；疑似异常条款 '+(q.flagged_clauses||[]).length+' 条。具体见上级目录 quality-report.json。\n';
    out[folder+'manifest.json'] = JSON.stringify({
      schema: VERSION, source:meta.pdfName, source_sha256:meta.hash, source_pages:Number(meta.pages||0),
      source_index:'../clause-index.json', license_attribution:'Methodology inspired by kangarooking/cangjie-skill (MIT, v2.5.0)',
      parsed_clauses:sorted.length, candidates:candidateRecords,
      validation:{source:'pending',executability:'pending',task_gain:'pending',output_eval:'pending',official_compile:'not_run'},
      active_skill_count:0, table_recovery:'not_verified', semantic_model:'not_used', export_type:'audit_candidates_only'
    },null,2)+'\n';
    const originalManifest=prefix+'manifest.json';
    if (out[originalManifest]) {
      try { const manifest=JSON.parse(out[originalManifest]); manifest.cangjie_p0={status:'needs_review',candidates:chosen.length,active_skills:0,semantic_model:'none'};out[originalManifest]=JSON.stringify(manifest,null,2)+'\n'; } catch (_) {}
    }
    return {...built,files:out,cangjie:{status:'needs_review',candidates:chosen.length,active_skills:0,parsed:sorted.length}};
  }
  const api={extend,version:VERSION};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CangjieP0=api;
})(typeof window!=='undefined'?window:globalThis);
