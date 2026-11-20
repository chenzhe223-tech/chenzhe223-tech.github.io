import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {validateStudioDraft,makeStudioExport,STUDIO_SCHEMA} from '../src/studio-schema.js';
const valid={id:'d-test',title:'为什么海水是咸的？',category:'自然地理',body:'海水中存在盐分与陆地岩石风化和海底热液活动等过程有关，这些盐分长期在海洋中积累并参与物质循环。',provider:'NOAA',sourceUrl:'https://oceanservice.noaa.gov/facts/whysalty.html',scope:'解释原因',revision:1};
test('schema rejects unsafe and incomplete knowledge drafts',()=>{
 assert.equal(validateStudioDraft(valid).valid,true);
 for(const d of [{...valid,sourceUrl:'javascript:alert(1)'},{...valid,sourceUrl:'http://example.com'},{...valid,provider:''},{...valid,body:'短'},{...valid,title:'短'},{...valid,category:'未授权分类'}])assert.equal(validateStudioDraft(d).valid,false);
});
test('export preserves provenance without claiming verified state',()=>{
 const result=makeStudioExport({...valid,selfCheck:true});
 assert.equal(result.ok,true);assert.equal(result.package.schema,STUDIO_SCHEMA);
 assert.equal(result.package.reviewStatus,'source-review-pending');
 assert.equal(result.package.selfCheck,true);assert.equal(result.package.evidence[0].provider,'NOAA');
 assert.equal(makeStudioExport({...valid,sourceUrl:'data:text/html,x'}).ok,false);
});
test('Studio page offers real editing controls, local drafts and JSON and PNG exports',async()=>{
 const res=await worker.fetch(new Request('https://knowa.test/studio'),{});
 assert.equal(res.status,200);
 const html=await res.text();
 for(const marker of ['id="editor-form"','id="draft-title"','id="draft-body"','id="draft-provider"','id="draft-url"','id="preview-title"','id="save-version"','id="import-btn"','id="export-json"','id="export-poster"','id="self-check"','id="version-history"']) assert.ok(html.includes(marker),marker);
 assert.match(html,/localStorage.setItem/);assert.match(html,/canvas.width=1200/);assert.match(html,/canvas.height=1600/);
 assert.match(html,/来源待复核/);assert.match(html,/function validateStudioDraft/);assert.match(res.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('new Studio does not expose anonymous write API and previous pages survive',async()=>{
 const post=await worker.fetch(new Request('https://knowa.test/api/studio',{method:'POST',body:'{}'}),{});
 assert.equal(post.status,404);
 const status=await(await worker.fetch(new Request('https://knowa.test/api/health'),{AI_ENABLED:'false',DAILY_AI_LIMIT:'0'})).json();
 assert.equal(status.version,'2.0.0-p1');assert.equal(status.studioMode,'local-drafts');assert.equal(status.aiConfigured,false);
 assert.equal((await worker.fetch(new Request('https://knowa.test/api/knowledge/k01'),{})).status,200);
 const article=await(await worker.fetch(new Request('https://knowa.test/knowledge/k01'),{})).text();
 assert.match(article,/studio\?seed=k01/);
 const home=await(await worker.fetch(new Request('https://knowa.test/'),{})).text();
 assert.match(home,/href="\/studio"/);
});