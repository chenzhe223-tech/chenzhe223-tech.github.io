'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const planner=require('../series-planner.js');

const data={characters:[
 {id:'c1',characterId:'c1',name:'林晚',originalName:'林晚',description:'短发',costume:'米色外套',comicNames:[]},
 {id:'c2',characterId:'c2',name:'顾行舟',originalName:'顾行舟',description:'黑发',costume:'深色风衣',comicNames:[]}
],projects:[]};
const plan={seriesId:'series-test',seriesTitle:'雨夜回声',theme:'原创都市悬疑',audience:'成年读者',episodeCount:2,version:1,
 arc:'合伙人从银行密账追查到公益基金的虚假审计，并共同揭开幕后骗局。',
 bible:{world:'架空城市，所有机构与人物均虚构。',styleId:'western-cinematic',wardrobeRules:'林晚始终佩戴旧怀表；顾行舟保持深色风衣。',characterIds:['c1','c2'],characters:[{characterId:'c1',role:'female_lead',comicName:'夜莺',look:'短发',costume:'米色外套',traits:'旧怀表'},{characterId:'c2',role:'male_lead',comicName:'行舟',look:'黑发',costume:'深色风衣',traits:'银色钢笔'}]},
 episodes:[{episode:1,title:'雨夜账本',summary:'林晚收到匿名账本，发现基金审计日期被人篡改。',beats:['匿名账本出现','审计时间矛盾','旧怀表留下线索'],castIds:['c1','c2'],wardrobeNotes:'沿用系列固定服装',location:'雨夜银行档案室'},
 {episode:2,title:'档案室回声',summary:'顾行舟找出被替换的审计凭证，两人决定公开证据。',beats:['追查替换凭证','守门人阻挠','联手公开证据'],castIds:['c1','c2'],wardrobeNotes:'沿用系列固定服装',location:'旧档案室'}]};

assert.equal(planner.validatePlan(plan,data).ok,true);
assert.equal(planner.validatePlan({...plan,episodes:plan.episodes.slice(0,1)},data).ok,false,'all episodes must be present');
assert.equal(planner.validatePlan({...plan,episodes:plan.episodes.map(x=>({...x,castIds:['missing']}))},data).ok,false,'every cast ref must exist');
assert.equal(planner.validatePlan({...plan,bible:{...plan.bible,characters:plan.bible.characters.map(x=>({...x,costume:''}))}},data).ok,false,'fixed wardrobe must be recorded');
const created=planner.createEpisodes(data,plan);
assert.equal(created.length,2);
assert.equal(created[0].seriesId,'series-test');assert.equal(created[0].seriesEpisode,1);
assert.equal(created[0].seriesBible.characters[0].comicName,'夜莺');
assert.equal(created[0].panels.length,9);assert.ok(created[0].panels.every(x=>!x.scene),'new episodes enter the blank workbench');
data.projects.push(...created);
assert.equal(planner.createEpisodes(data,plan).length,0,'retry is idempotent');
assert.equal(planner.createEpisodes(data,{...plan,episodeCount:3,version:2,episodes:[...plan.episodes,{episode:3,title:'第三集',summary:'调查者确认幕后组织的资金路径，并找到可以公开的原始凭证。',beats:['线索汇合','风险逼近','证据落地'],castIds:['c1','c2'],wardrobeNotes:'沿用固定服装',location:'基金办公室'}]}).length,1,'new plan versions add missing episodes without mutating existing projects');
assert.equal(data.projects[0].seriesPlanVersion,1,'existing episode stays at its original plan version');
console.log('PASS: complete plan validation, cast refs, continuity bible, workbench creation and idempotent revisions');

const source=fs.readFileSync(path.join(__dirname,'..','worker.js'),'utf8');
const cast=[{characterId:'c1',role:'female_lead',comicName:'夜莺',look:'短发',costume:'米色外套'},{characterId:'c2',role:'male_lead',comicName:'行舟',look:'黑发',costume:'深色风衣'}];
function generated(count){return {arc:'两位合伙人揭开架空基金审计骗局，并公开证据。',bible:{world:'架空城市',styleId:'western-cinematic',wardrobeRules:'服装保持固定'},episodes:Array.from({length:count},(_,i)=>({episode:i+1,title:'第'+(i+1)+'集线索',summary:'角色通过新线索发现审计骗局中的关键矛盾并决定采取行动。',beats:['发现线索','遭遇阻碍','作出选择'],castIds:['c1','c2'],wardrobeNotes:'两人沿用固定服饰',location:'银行档案室'}))}}
const external=[];let malformed=false,nativeCalls=0;const sandbox={Response,Request,URL,Headers,AbortSignal,TextEncoder,TextDecoder,Date,console,crypto:require('node:crypto').webcrypto};
sandbox.fetch=async(url,opts)=>{if(String(url).endsWith('/auth/v1/user'))return Response.json({id:'author'});if(String(url)==='https://api.deepseek.com/chat/completions'){external.push({url,opts});return Response.json({model:'deepseek-chat',choices:[{message:{content:JSON.stringify(generated(2))}}]})}throw Error('Unexpected outbound '+url)};
vm.runInNewContext(source.replace('export default {async fetch(','const workerDefault={async fetch(')+'\nglobalThis.seriesRoute=wtSeriesPlanAI;',sandbox,{filename:'worker.js'});
const env={AI_ENABLED:'false',DB:{prepare(){return {bind(){return this},async first(){return {uses:1}}}}},AI:{async run(model,req){nativeCalls++;return {response:malformed?JSON.stringify(generated(1)):JSON.stringify(generated(2))}}}};
const request=(body,authorized=true)=>new Request('https://worldtoon.example/api/ai/series-plan',{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)});
(async()=>{
 const brief={provider:'native',seriesTitle:'雨夜回声',theme:'原创都市悬疑合伙人揭密',audience:'成年读者',episodeCount:2,originalityStatus:'original',cast};
 let response=await sandbox.seriesRoute(request(brief),env);assert.equal(response.status,503,'native series planning must honor the disabled AI spending gate');assert.equal(nativeCalls,0,'disabled native planning must never invoke the model');
 env.AI_ENABLED='true';response=await sandbox.seriesRoute(request(brief),env);assert.equal(response.status,200,await response.clone().text());let output=await response.json();assert.equal(output.episodes.length,2);assert.equal(output.draft,true);assert.equal(output.rightsCleared,false);assert.equal(nativeCalls,1);
 response=await sandbox.seriesRoute(request({...brief,provider:'deepseek',apiKey:'sk-series-request-only-123456'}),env);assert.equal(response.status,200,await response.clone().text());output=await response.json();assert.equal(output.provider,'deepseek');assert.equal(external.length,1);assert.equal(external[0].url,'https://api.deepseek.com/chat/completions');assert.equal(external[0].opts.headers.authorization,'Bearer sk-series-request-only-123456');assert.ok(!JSON.stringify(output).includes('sk-series-request-only-123456'));
 response=await sandbox.seriesRoute(request({...brief,originalityStatus:'authorized',source:{authorizationReference:''}}),env);assert.equal(response.status,400,'authorization claim needs a reference');
 response=await sandbox.seriesRoute(request(brief,false),env);assert.equal(response.status,401);
 malformed=true;response=await sandbox.seriesRoute(request(brief),env);assert.equal(response.status,502,'an incomplete model plan must not be accepted for project creation');
 console.log('PASS: authenticated native/DeepSeek series planning, request-scoped key, draft copyright status and authorization gates');
})().catch(err=>{console.error(err);process.exitCode=1});
