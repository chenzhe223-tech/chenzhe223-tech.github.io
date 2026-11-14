'use strict';
const assert=require('node:assert/strict');
const WTCharacterContinuity=require('../character-continuity.js');

function workspace(){return {characters:[
 {id:'legacy-1',name:'沈知夏',description:'旧版角色',portrait:'media:portrait-1'},
 {id:'legacy-2',name:'沈知夏',description:'另一个同名角色'}
 ],projects:[]}}

{
 const data=workspace();
 WTCharacterContinuity.normalizeWorkspace(data);
 assert.equal(data.characters[0].id,'legacy-1');
 assert.equal(data.characters[0].name,'沈知夏');
 assert.equal(data.characters[0].originalName,'沈知夏');
 assert.ok(data.characters[0].characterId);
 assert.ok(data.characters[1].characterId);
 assert.notEqual(data.characters[0].characterId,data.characters[1].characterId,'same names must remain distinct identities');
 assert.equal(data.characters[0].portrait,'media:portrait-1');
}

{
 const data=workspace();
 WTCharacterContinuity.normalizeWorkspace(data);
 const project={id:'project-a',title:'雨夜回声'};
 const candidates=[
  {role:'female_lead',name:'林晚',look:'短发',clothes:'米色外套'},
  {role:'male_lead',name:'顾行舟',look:'黑发',clothes:'深色风衣'},
  {role:'supporting',name:'周叔',look:'灰发',clothes:'旧夹克'}
 ];
 const first=WTCharacterContinuity.upsertGenerated(data,project,candidates);
 assert.equal(first.added,2,'only explicitly identified leads should be enrolled');
 assert.equal(first.unresolved.length,0);
 const female=data.characters.find(x=>x.name==='林晚');
 assert.equal(WTCharacterContinuity.displayName(data,female.characterId,'project-a'),'林晚');
 assert.equal(project.characterRefs[0].characterId,female.characterId);
 WTCharacterContinuity.setComicName(data,female.characterId,'project-a','夜莺');
 assert.equal(WTCharacterContinuity.displayName(data,female.characterId,'project-a'),'夜莺');
 assert.equal(female.originalName,'林晚','editing a comic name must not rename the original identity');
 const second=WTCharacterContinuity.upsertGenerated(data,project,candidates);
 assert.equal(second.added,0,'retry must not create duplicate lead profiles');
 assert.equal(data.characters.filter(x=>x.originProjectId==='project-a').length,2);
}

{
 const data=workspace();
 WTCharacterContinuity.normalizeWorkspace(data);
 const first=data.characters[0];
 WTCharacterContinuity.setComicName(data,first.characterId,'project-b','银杏');
 assert.equal(WTCharacterContinuity.displayName(data,first.characterId,'project-b'),'银杏');
 assert.equal(WTCharacterContinuity.displayName(data,first.characterId,'project-c'),'沈知夏');
}


{
 const data={characters:[{id:'c-1',characterId:'c-1',originalName:'叶澜',description:'白色短发',costume:'蓝色外套',gender:'自定义',age:'29',occupation:'调查员',reviewStatus:'pending_approval',bibleVersion:1}]};
 const story={id:'chapter-1',panels:[{characterIds:['c-1']}]};
 const pending=WTCharacterContinuity.linkExisting(data,story,'c-1');
 assert.equal(pending.ok,false,'unapproved AI character draft cannot enter a locked project');
 data.characters[0].reviewStatus='approved';
 const linked=WTCharacterContinuity.linkExisting(data,story,'c-1',{comicName:'夜舟',role:'lead',overrides:{costume:'风衣'}});
 assert.equal(linked.ok,true);
 assert.equal(linked.linked,true);
 assert.equal(WTCharacterContinuity.linkExisting(data,story,'c-1').linked,false,'retry reuses the same role without duplicating it');
 const bible=WTCharacterContinuity.lockProjectBible(data,story);
 assert.equal(bible.characters[0].characterId,'c-1');
 assert.equal(bible.characters[0].version,'1');
 assert.equal(bible.characters[0].comicName,'夜舟');
 assert.equal(bible.characters[0].costume,'风衣');
 assert.equal(WTCharacterContinuity.validateProjectBible(story).ok,true);
 data.characters[0].description='完全不同的长发';
 data.characters[0].costume='红色裙装';
 data.characters[0].bibleVersion=2;
 assert.equal(WTCharacterContinuity.getLockedCharacter(story,'c-1').appearance,'白色短发','future library edits must not mutate the work');
 assert.equal(WTCharacterContinuity.getLockedCharacter(story,'c-1').costume,'风衣','project costume overrides are frozen');
 const separate={id:'chapter-2',panels:[]};
 WTCharacterContinuity.linkExisting(data,separate,'c-1',{comicName:'雪崖'});
 const newer=WTCharacterContinuity.lockProjectBible(data,separate);
 assert.equal(newer.characters[0].version,'2','new works use the updated character version');
 assert.equal(data.characters[0].originalName,'叶澜','new works do not rewrite original identity');
 story.panels[0].characterIds=['c-1','missing-person'];
 assert.equal(WTCharacterContinuity.validateProjectBible(story).ok,false,'panels may only reference locked characters');
 story.handoff={repoQueuedAt:'true'};
 assert.equal(WTCharacterContinuity.linkExisting(data,story,'c-1').ok,false,'dispatched productions cannot mutate a role version');
 assert.throws(()=>WTCharacterContinuity.lockProjectBible(data,story),/不得静默改写/);
}

console.log('PASS: legacy profiles, same-name separation, project aliases, and idempotent lead enrollment');
