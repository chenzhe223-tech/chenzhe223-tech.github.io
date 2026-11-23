import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../src/index.js';
import {factoryHtml} from '../src/factory.js';

test('production factory is a real three-output workspace, with 6 poster themes',async()=>{
 const response=await worker.fetch(new Request('https://knowa.test/studio/production'),{});
 assert.equal(response.status,200);
 const html=await response.text();
 for(const label of ['科普文章','贴图海报','科普视频','id="download-md"','id="download-html"','id="download-png"','id="download-video"','id="poster-canvas"','id="video-canvas"','id="source-entry"','id="export-log"'])assert.ok(html.includes(label),label);
 assert.match(html,/1080 × 1440/);
 assert.match(html,/9:16/);
 assert.match(html,/来源待复核/);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal((html.match(/class="swatch"/g)||[]).length,0); // generated client-side
});
test('production client JavaScript is syntactically valid and exports actual media',()=>{
 const start=factoryHtml.indexOf('<script>'),end=factoryHtml.lastIndexOf('</script>');
 assert.ok(start>=0&&end>start);
 const code=factoryHtml.slice(start+8,end);
 assert.doesNotThrow(()=>new vm.Script(code,{filename:'knowa-content-factory-client.js'}));
 for(const marker of ['canvas.captureStream','MediaRecorder','toBlob','JSON.parse','createObjectURL','decodeAudioData','articleMd','articleHtml','drawPoster','drawVideo','来源待复核'])assert.ok(code.includes(marker),marker);
 for(const style of ['深海蓝','科学白','矿物绿','石墨黑','海洋蓝','赭石红'])assert.ok(code.includes(style),style);
 assert.match(factoryHtml,/width="1080" height="1440"/);
});
test('production output is local only; legacy knowledge and AI spend safety intact',async()=>{
 const home=await(await worker.fetch(new Request('https://knowa.test/'),{})).text();
 assert.match(home,/href="\/studio"/);
 const studio=await(await worker.fetch(new Request('https://knowa.test/studio'),{})).text();
 assert.match(studio,/id="open-factory"/);
 assert.match(studio,/\/studio\/production\?draft=/);
 assert.equal((await worker.fetch(new Request('https://knowa.test/api/knowledge/k06'),{})).status,200);
 const health=await(await worker.fetch(new Request('https://knowa.test/api/health'),{AI_ENABLED:'false',DAILY_AI_LIMIT:'0'})).json();
 assert.equal(health.version,'2.0.0-p3');
 assert.equal(health.studioMode,'dual-track-production');
 assert.equal(health.aiConfigured,false);
 const post=await worker.fetch(new Request('https://knowa.test/api/production',{method:'POST',body:'{}'}),{});
 assert.equal(post.status,404);
});
