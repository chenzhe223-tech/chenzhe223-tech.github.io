import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../src/index.js';
import {generateExternalTask,EXTERNAL_TARGETS,EXTERNAL_STYLES} from '../src/external-task.js';
import {externalTaskHtml} from '../src/external-page.js';

const source={topic:'土星为什么平均密度比水低？',facts:'土星的平均密度低于水。请依据权威天文学资料核验其气体构成、密度和类比适用条件。',sourceName:'NASA',sourceUrl:'https://science.nasa.gov/saturn/'};
test('all six external model targets receive explicit capability gates',()=>{
 assert.equal(EXTERNAL_TARGETS.length,6);
 for(const target of EXTERNAL_TARGETS){
   const r=generateExternalTask({...source,target,kind:'full'});
   assert.equal(r.ok,true);
   assert.match(r.prompt,new RegExp(target));
   assert.match(r.prompt,/不得.*(声称|假称|伪造)|不得把规划稿写成已渲染成品/);
   assert.match(r.prompt,/video_final\.mp4/);
   assert.match(r.prompt,/article\.md/);
   assert.match(r.prompt,/poster_01\.png/);
   assert.match(r.prompt,/production_manifest\.json/);
   assert.match(r.prompt,/QA\.md/);
 }
});
test('topic-only assignment requires research first, never invents sources',()=>{
 const r=generateExternalTask({topic:'为什么海水是咸的？',target:'Gemini'});
 assert.equal(r.ok,true);
 assert.match(r.prompt,/先找到至少2条高质量原始来源/);
 assert.match(r.prompt,/不得声称已核实/);
 assert.match(r.prompt,/不.*补造机构/);
 assert.equal(r.source.url,null);
});
test('duration, independent posters and flexible media modes are enforced',()=>{
 const short=generateExternalTask({...source,kind:'video',duration:12});
 assert.equal(short.storyboard.length,4);
 assert.deepEqual(short.storyboard.map(x=>x.seconds),[3,3,3,3]);
 assert.doesNotMatch(short.prompt,/【B｜科普贴图/);
 const thirty=generateExternalTask({...source,kind:'video',duration:30});
 assert.equal(thirty.storyboard.length,6);
 assert.equal(thirty.storyboard.reduce((sum,x)=>sum+x.seconds,0),30);
 const images=generateExternalTask({...source,kind:'poster',imageCount:9});
 assert.equal(images.ok,true);
 assert.match(images.prompt,/9 张彼此独立/);
 assert.match(images.prompt,/禁止合并为拼图/);
 assert.match(images.prompt,/poster_09\.png/);
 assert.doesNotMatch(images.prompt,/【A｜科普视频/);
 const article=generateExternalTask({...source,kind:'article',articleLength:1800});
 assert.match(article.prompt,/约 1800 字/);
 assert.doesNotMatch(article.prompt,/【A｜科普视频/);
 assert.equal(EXTERNAL_STYLES.length,6);
});
test('invalid title and non-HTTPS sources fail; future guardrails remain unchanged',()=>{
 assert.equal(generateExternalTask({topic:'中'}).ok,false);
 assert.equal(generateExternalTask({...source,sourceUrl:'http://untrusted.example'}).ok,false);
 assert.equal(generateExternalTask({...source,sourceUrl:'javascript:alert(1)'}).ok,false);
 assert.equal(generateExternalTask({...source,requirements:'画面全程静态且不能使用真实人物肖像'}).ok,true);
 const many=generateExternalTask({...source,kind:'poster',imageCount:100});
 assert.equal(many.imageCount,9);
});
test('real /studio/external page exposes complete task generation, copying and files',async()=>{
 const r=await worker.fetch(new Request('https://knowa.test/studio/external'),{});
 assert.equal(r.status,200);
 const html=await r.text();
 for(const marker of ['id="task-form"','id="target"','id="kind"','id="duration"','id="imageCount"','id="articleLength"','id="requirements"','id="prompt"','id="copy"','id="download-md"','id="download-json"','id="seed"'])assert.ok(html.includes(marker),marker);
 assert.match(html,/轨道 A｜平台内制作/);
 assert.match(html,/轨道 B｜第三方任务包/);
 assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const a=html.indexOf('<script>'),b=html.lastIndexOf('</script>');
 assert.ok(a>=0&&b>a);
 const js=html.slice(a+8,b);
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'knowa-external-task-client.js'}));
 assert.match(js,/generateExternalTask/);
 assert.match(js,/navigator\.clipboard/);
 assert.match(js,/JSON\.stringify/);
 assert.match(js,/task-generated-not-executed/);
 assert.match(js,/localStorage\.setItem/);
});
test('legacy internal maker and encyclopedia pages remain, no anonymous publish API',async()=>{
 const prod=await(await worker.fetch(new Request('https://knowa.test/studio/production'),{})).text();
 assert.match(prod,/轨道 B｜第三方任务包/);
 const studio=await(await worker.fetch(new Request('https://knowa.test/studio'),{})).text();
 assert.match(studio,/生成第三方制作指令/);
 const health=await(await worker.fetch(new Request('https://knowa.test/api/health'),{AI_ENABLED:'false',DAILY_AI_LIMIT:'0'})).json();
 assert.equal(health.version,'2.0.0-p3');
 assert.equal(health.studioMode,'dual-track-production');
 assert.equal(health.aiConfigured,false);
 assert.equal((await worker.fetch(new Request('https://knowa.test/api/knowledge/k01'),{})).status,200);
 assert.equal((await worker.fetch(new Request('https://knowa.test/api/external-dispatch',{method:'POST',body:'{}'}),{})).status,404);
});
