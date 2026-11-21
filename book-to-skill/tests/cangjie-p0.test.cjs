'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const bridge=require('../cangjie-bridge.js');
function fixture(){
  const clauses=Array.from({length:8},(_,i)=>({
    id:'1.0.'+(i+1),chapter:1,page:i<5?9:10,end_page:i<5?9:10,
    text:i===7?'术语与结构说明。':'承包人应按第 '+(i+1)+' 项规定进行合同计价与复核。'
  }));
  return {files:{
    'sample/clause-index.json':JSON.stringify(clauses),
    'sample/manifest.json':JSON.stringify({generation:'source-grounded-structure-v2'}),
    'sample/SKILL.md':'original-skill-source'
  },quality:{status:'needs_review',parsed_clauses:8,flagged_clauses:[{id:'1.0.8'}]}};
}
const meta={slug:'sample',pdfName:'example.pdf',hash:'abcd1234',pages:226,title:'example'};
test('deterministic candidate package preserves original source output',()=>{
  const src=fixture(),generated=bridge.extend(src,meta);
  assert.equal(src.files['sample/SKILL.md'],'original-skill-source');
  assert.equal(generated.files['sample/SKILL.md'],'original-skill-source');
  assert.equal(generated.cangjie.candidates,7);
  assert.equal(generated.cangjie.active_skills,0);
  const report=JSON.parse(generated.files['sample/cangjie-p0/manifest.json']);
  assert.equal(report.validation.source,'pending');
  assert.equal(report.validation.official_compile,'not_run');
  assert.equal(report.active_skill_count,0);
  assert.equal(report.parsed_clauses,8);
  assert.match(generated.files['sample/cangjie-p0/coverage-audit.md'],/1\.0\.8/);
  assert.match(generated.files['sample/cangjie-p0/candidates/clause-1-0-1.md'],/NEEDS_REVIEW/);
});
test('rejects unsupported format and unreliable provenance',()=>{
  assert.throws(()=>bridge.extend({files:{},quality:{}},meta),/V2/);
  const src=fixture();const clauses=JSON.parse(src.files['sample/clause-index.json']);
  clauses[0].page=null;src.files['sample/clause-index.json']=JSON.stringify(clauses);
  assert.throws(()=>bridge.extend(src,meta),/页码/);
});
test('all source clauses are audited, including those not selected',()=>{
 const x=bridge.extend(fixture(),meta);
 const audit=x.files['sample/cangjie-p0/coverage-audit.md'];
 for(let i=1;i<=8;i++)assert.match(audit,new RegExp('1\\.0\\.'+i));
 assert.match(x.files['sample/cangjie-p0/needs-review.md'],/表格/);
});
