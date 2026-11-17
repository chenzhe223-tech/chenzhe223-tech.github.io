import test from 'node:test';import assert from 'node:assert/strict';
import {freshDeck,parseOutline,validateDeck,assertDeck,safeFilename,THEMES,MAX_SLIDES} from '../core.mjs';
test('blank deck is editable and serializable',()=>{const d=freshDeck('演示');assert.equal(d.slides.length,1);assert.equal(d.slides[0].title,'演示');assert.equal(validateDeck(d).length,0)});
test('markdown headings create slides with content',()=>{const d=parseOutline('# 结论\n- 第一项\n- 第二项\n## 路线图\n1. A 阶段','年终汇报');assert.equal(d.slides.length,3);assert.equal(d.slides[1].title,'结论');assert.equal(d.slides[1].body,'第一项\n第二项');assert.equal(d.slides[2].body,'A 阶段')});
test('plain text import is supported',()=>{const d=parseOutline('核心观点\n内容一\n内容二');assert.equal(d.slides.length,2);assert.equal(d.slides[1].body,'内容一\n内容二')});
test('empty outline blocked',()=>assert.throws(()=>parseOutline('\n  \n'),/至少输入/));
test('too many slides are refused',()=>assert.throws(()=>parseOutline(Array(MAX_SLIDES).fill('# x').join('\n')),/最多支持/));
test('JSON import sanitized and has unique ids',()=>{const d=assertDeck({title:'a',theme:'not-a-theme',slides:[{type:'other',title:3,body:'x'},{type:'content',title:'B'}]});assert.equal(d.theme,'ocean');assert.equal(d.slides[0].title,'3');assert.notEqual(d.slides[0].id,d.slides[1].id)});
test('QA detects excessive content and missing heading',()=>{const d=freshDeck('x');d.slides[0].title='';d.slides[0].body='x'.repeat(800);assert.ok(validateDeck(d).length>=2)});
test('filename strips unsafe characters',()=>assert.equal(safeFilename('report/a:b?'), 'report_a_b_'));
test('themes have all required tokens',()=>Object.values(THEMES).forEach(t=>assert.ok(t.ink&&t.accent&&t.muted&&t.background)));

