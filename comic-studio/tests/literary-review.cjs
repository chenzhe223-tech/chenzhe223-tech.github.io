'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const director=read('creative-director.js'),app=read('app.js'),extension=read('extension.js'),ui=read('story-discovery-ui.js');
assert.ok(extension.trimEnd().endsWith(ui.trimEnd()),'runtime book discovery must embed canonical UI');
assert.ok(extension.includes("story.mode=isNobel(x)?'literary_review'"),'Nobel book search defaults to literary review');
assert.ok(extension.includes("nobel=x.category==='诺奖文学'||x.source_id==='nobel_literature'"),'Nobel feed route enabled');
assert.ok(extension.includes("p.storySourceSelection?.adaptation==='literary_review'"),'unverified built-in AI script must not invent literary facts');

function region(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,start+' expected in source');
 return source.slice(a,b);
}
const directorCtx={isLiteraryProject:p=>p.literaryResearchScope==='topic_literature_v2',ensure:p=>p.creativeDirection,clean:x=>String(x||'').trim(),
 shotOf:i=>['wide','close','medium','high','low','medium','detail','two-shot','wide'][i],
 style:()=>({material:'原创新材料',lighting:'柔和电影光'})};
vm.runInNewContext(region(director,'function localStoryboardCore(','function applyStoryboard(')+'\nthis.storyboard=localStoryboard;',directorCtx);
const project={literaryResearchScope:'topic_literature_v2',id:'fixture-review',title:'读懂某部文学作品',sourceTitle:'未核验的作品',
 storySourceSelection:{adaptation:'literary_review',rights:'copyrighted'},panels:Array.from({length:9},(_,i)=>({id:i})),
 creativeDirection:{cast:[{name:'虚构读者'},{name:'虚构编辑'}],styleId:'western-cinematic',arcId:'explain'},
 description:'独立评论，不复刻原著' };
const panels=directorCtx.storyboard(project);
assert.equal(panels.length,9);
assert.match(panels[0].title,/主人公/);
assert.match(panels[3].title,/命运/);
assert.match(panels[7].title,/现实困境/);
for(const [i,x] of panels.entries()){
 assert.ok(x.scene.includes('【待文学研究】'),i+' unverified placeholder');
 assert.ok(x.prompt.includes('禁止生图'),'unverified draft cannot be rendered '+i);
 assert.ok(!x.scene.includes('再现书中第'),'no invented chapter summaries');
}
const projectsCtx={now:()=>new Date('2026-11-20T00:00:00Z').toISOString(),
 uid:()=> 'stable-fixture',makePanel:i=>({index:i+1,scene:'',image:''})};
vm.runInNewContext(region(app,'function emptyProject(topic)','const sampleTopic=')+'\nthis.empty=emptyProject;',projectsCtx);
const nobelTopic=projectsCtx.empty({id:'nobel-item',title:'待核验的诺奖文学作品',category:'诺奖文学',source:'https://example.org/verified-lead',sourceId:'nobel_literature',rightsStatus:'copyright_permission_required'});
assert.equal(nobelTopic.storySourceSelection.adaptation,'literary_review','saved Nobel topic defaults to commentary instead of plot adaptation');
assert.equal(nobelTopic.panels.length,9);
assert.equal(nobelTopic.literaryResearchScope,'topic_literature_v2');
assert.equal(nobelTopic.handoff.mode,'hotspot');
assert.equal(nobelTopic.storySourceSelection.license_attested,false);
assert.match(nobelTopic.disclosure,/非原著漫画改编/);
const ordinary=projectsCtx.empty({id:'general-item',title:'普通新闻',category:'AI 科技',source:'https://example.org/news'});
assert.equal(ordinary.storySourceSelection,undefined,'other source categories unaffected');
const appCtx={};
vm.runInNewContext(region(app,'function wfLiteraryReview(p)','function wfCanTask(')+
 region(app,'function wfProductionBible(','function wfDirectPrompt(')+
 '\nthis.bible=wfProductionBible;this.jobs=wfSingleImageJobs;this.guide=wfLiteraryReviewGuide;this.scoped=wfLiteraryResearchRequired;',appCtx);
assert.equal(appCtx.scoped(nobelTopic),true);
assert.equal(appCtx.scoped({...nobelTopic,literaryResearchScope:undefined}),false);
assert.equal(appCtx.scoped(ordinary),false);
const task={
 task_id:'WT-0123456789abcdef0123',title:'未核验文学导读',
 source:{candidate_summary:'一条未核查书目线索'},
 adaptation:{characters:'',source_selection:{adaptation:'literary_review'},literary_review:{
  schema:'davylab.worldtoon.literary-review.v1',mode:'editorial_criticism_not_plot_adaptation',
  dimensions:['what_the_book_is_about','life_philosophy','meaning_for_everyday_readers'],panel_ranges:[[1,4],[5,7],[8,9]]}},
 creative_direction:{
  approval:{author_approved:true,lock_hash:'locked'},
  style_id:'western-cinematic',visual_rules:{palette:['#234']},
  characters:[{name:'虚构读者',look:'黑发，圆脸',role:'读者',clothes:'蓝色外套'},{name:'虚构编辑',look:'短发，眼镜',role:'编辑',clothes:'白色衬衫'}],
  storyboard:panels.map((x,i)=>({index:i+1,title:x.title,shot:'camera-'+i,scene:x.scene,caption:x.caption,dialogue:x.dialogue})),
  cover_brief:'一页原创文学评论杂志封面'
 }};
const bible=appCtx.bible({...project,panels},task);
assert.equal(bible.literary_review.mode,'editorial_criticism_not_plot_adaptation');
assert.deepEqual(Array.from(bible.panels.map(x=>x.editorial_dimension)),
 ['what_the_book_is_about','what_the_book_is_about','what_the_book_is_about','what_the_book_is_about',
 'life_philosophy','life_philosophy','life_philosophy',
 'meaning_for_everyday_readers','meaning_for_everyday_readers']);
const jobs=appCtx.jobs({...project,panels},task,bible);
assert.equal(jobs.jobs.length,10);
assert.ok(jobs.jobs.every(x=>x.prompt.includes('NO contact sheet')));
assert.ok(jobs.jobs.slice(0,9).every(x=>x.prompt.includes('ORIGINAL LITERARY COMMENTARY, NOT BOOK PLOT ADAPTATION')));
assert.ok(jobs.jobs.slice(0,9).every(x=>x.no_text===true));
assert.ok(appCtx.guide(project).includes('讲了什么')&&appCtx.guide(project).includes('人生哲学')&&appCtx.guide(project).includes('普通人'));
assert.ok(app.includes("ss?.adaptation==='literary_review'"),'rights gate recognizes criticism mode without treating it as a licensed plot adaptation');
console.log('WORLD/TOON literary-review PASS: Nobel feed and book search routes, three axes, original storyboard, 10 isolated image jobs and copyright guards');
