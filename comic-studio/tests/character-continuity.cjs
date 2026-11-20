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
 const data={characters:[],projects:[]},project={id:'v4-multi',characterEnrollmentMode:'all'};
 const cast=[
  {role:'female_lead',name:'林晚',gender:'女',look:'左眼绿色',clothes:'蓝外套'},
  {role:'female_lead',name:'许晴',gender:'女',look:'双马尾',clothes:'红外套'},
  {role:'supporting',name:'机械猫',gender:'自定义',age:'成年',profession:'机械工程师',look:'银色机体',clothes:'白马甲'}
 ];
 const result=WTCharacterContinuity.upsertGenerated(data,project,cast);
 assert.equal(result.added,3,'V4 registers full cast, including supporting roles');
 assert.equal(project.characterRefs.length,3);
 assert.equal(new Set(project.characterRefs.map(x=>x.characterId)).size,3,'different people of same role never collapse');
 assert.equal(data.characters.find(x=>x.name==='机械猫').gender,'自定义');
 assert.equal(data.characters.find(x=>x.name==='机械猫').profession,'机械工程师');
 assert.ok(project.characterRefs.every(r=>r.pending_author_review===true),'AI draft characters still require author approval');
 const twice=WTCharacterContinuity.upsertGenerated(data,project,cast);
 assert.equal(twice.added,0,'retry is idempotent for all cast members');
 assert.equal(data.characters.length,3);
}
console.log('PASS: legacy profiles, same-name separation, project aliases, and idempotent lead enrollment');
