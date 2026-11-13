/* Workspace-scoped character identities and project names. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.WTCharacterContinuity=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 let fallbackSequence=0;
 function newId(){
  try{if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID()}catch{}
  fallbackSequence++;
  return 'character-'+Date.now().toString(36)+'-'+fallbackSequence.toString(36);
 }
 function normalizeWorkspace(data){
  if(!data||typeof data!=='object')return data;
  if(!Array.isArray(data.characters))data.characters=[];
  const seen=new Set();
  for(const character of data.characters){
   if(!character||typeof character!=='object')continue;
   let identity=String(character.characterId||character.id||'').trim();
   if(!identity||seen.has(identity))identity=newId();
   seen.add(identity);
   character.characterId=identity;
   if(!character.id)character.id=identity;
   if(character.originalName==null)character.originalName=String(character.name||'');
   if(!Array.isArray(character.comicNames))character.comicNames=[];
   character.comicNames=character.comicNames.filter(x=>x&&typeof x==='object'&&String(x.projectId||'').trim())
    .map(x=>({projectId:String(x.projectId),name:String(x.name||'').trim()}));
  }
  return data;
 }
 function normalizedRole(candidate){
  const role=String(candidate?.role||candidate?.genderRole||candidate?.characterRole||'').trim().toLowerCase();
  if(/female|woman|girl|女主|女性主角/.test(role))return 'female_lead';
  if(/male|man|boy|男主|男性主角/.test(role))return 'male_lead';
  if(/lead|main|主角/.test(role)||candidate?.isLead===true)return 'unresolved';
  return '';
 }
 function setComicName(data,characterId,projectId,name){
  normalizeWorkspace(data);
  const character=data.characters.find(x=>x.characterId===String(characterId));
  if(!character||!projectId)return false;
  const key=String(projectId),value=String(name||'').trim();
  const index=character.comicNames.findIndex(x=>x.projectId===key);
  if(!value){if(index>=0)character.comicNames.splice(index,1);return true}
  if(index>=0)character.comicNames[index].name=value;
  else character.comicNames.push({projectId:key,name:value});
  return true;
 }
 function displayName(data,characterId,projectId){
  const character=(data?.characters||[]).find(x=>String(x?.characterId||x?.id||'')===String(characterId));
  if(!character)return '';
  const alias=(character.comicNames||[]).find(x=>String(x?.projectId||'')===String(projectId));
  return String(alias?.name||character.originalName||character.name||'');
 }
 function upsertGenerated(data,project,candidates){
  normalizeWorkspace(data);
  if(!project||typeof project!=='object')return {added:0,linked:0,unresolved:[]};
  const projectId=String(project.id||'');
  if(!Array.isArray(project.characterRefs))project.characterRefs=[];
  let added=0,linked=0;const unresolved=[];
  for(const candidate of (Array.isArray(candidates)?candidates:[]).slice(0,12)){
   if(!candidate||typeof candidate!=='object'||!String(candidate.name||'').trim())continue;
   const role=normalizedRole(candidate);
   if(role==='unresolved'){
    unresolved.push({...candidate,reviewStatus:'needs_role_confirmation'});continue;
   }
   if(!role)continue;
   let character=candidate.characterId
    ?data.characters.find(x=>x.characterId===String(candidate.characterId))
    :data.characters.find(x=>x.originProjectId===projectId&&x.originRole===role);
   if(character){
    setComicName(data,character.characterId,projectId,candidate.comicName||candidate.name);
    linked++;
   }else{
    const id=newId(),originalName=String(candidate.originalName||candidate.name).trim();
    character={id,characterId:id,name:originalName,originalName,
     type:['虚构角色','拟人化角色','抽象象征'].includes(candidate.type)?candidate.type:'虚构角色',
     description:String(candidate.look||candidate.description||'').slice(0,1800),
     costume:String(candidate.clothes||candidate.costume||'').slice(0,400),
     colors:String(candidate.colors||'').slice(0,220),traits:String(candidate.symbol||candidate.traits||'').slice(0,950),
     personality:String(candidate.nature||candidate.personality||'').slice(0,1200),portrait:'',
     origin:'ai-draft',originProjectId:projectId,originRole:role,aiModel:String(candidate.aiModel||''),
     comicNames:[],bibleVersion:1,reviewStatus:'pending_approval'};
    data.characters.push(character);
    setComicName(data,character.characterId,projectId,candidate.comicName||candidate.name);
    added++;
   }
   if(!project.characterRefs.some(x=>x.characterId===character.characterId))
    project.characterRefs.push({characterId:character.characterId,role,comicName:String(candidate.comicName||candidate.name).trim()});
  }
  return {added,linked,unresolved};
 }
 function linkExisting(data,project,characterId,options={}){
  normalizeWorkspace(data);
  if(!project?.id)return {ok:false,reason:'missing_project'};
  if(project.handoff?.repoQueuedAt||project.creativeDirection?.approval?.lock_hash)
   return {ok:false,reason:'approved_work_requires_new_revision'};
  const character=data.characters.find(c=>c?.characterId===String(characterId));
  if(!character)return {ok:false,reason:'character_not_found'};
  if(character.reviewStatus==='pending_approval')
   return {ok:false,reason:'character_awaits_author_review'};
  if(!Array.isArray(project.characterRefs))project.characterRefs=[];
  const existing=project.characterRefs.find(x=>x.characterId===character.characterId);
  if(existing)return {ok:true,linked:false,characterId:character.characterId};
  const comicName=String(options.comicName||character.originalName||character.name||'').trim();
  const ref={characterId:character.characterId,role:String(options.role||'support'),
   comicName,characterVersion:String(character.bibleVersion||character.version||1),
   overrides:JSON.parse(JSON.stringify(options.overrides||{}))};
  project.characterRefs.push(ref);
  project.characterBibleNeedsReview=true;
  return {ok:true,linked:true,characterId:character.characterId};
 }
 function lockProjectBible(data,project){
  normalizeWorkspace(data);
  if(!project?.id)throw Error('角色锁定要求有效漫画项目');
  if(project.handoff?.repoQueuedAt||project.creativeDirection?.approval?.lock_hash)
   throw Error('已派单或创意锁定项目不得静默改写角色版本');
  const refs=Array.isArray(project.characterRefs)?project.characterRefs:[];
  if(!refs.length)throw Error('请先选择至少一个角色档案');
  const seen=new Set();
  const characters=refs.map(ref=>{
   const c=data.characters.find(x=>x?.characterId===String(ref.characterId));
   if(!c)throw Error('角色档案不存在：'+ref.characterId);
   if(c.reviewStatus==='pending_approval')throw Error('角色草稿尚未获作者确认：'+(c.originalName||c.name));
   if(seen.has(c.characterId))throw Error('角色身份重复：'+c.characterId);
   seen.add(c.characterId);
   const o=ref.overrides&&typeof ref.overrides==='object'?ref.overrides:{};
   return {characterId:c.characterId,version:String(c.bibleVersion||c.version||1),
    originalName:String(c.originalName||c.name||''),
    comicName:String(ref.comicName||c.originalName||c.name||''),
    gender:String(o.gender??c.gender??'未指定'),
    age:String(o.age??c.age??'未指定'),
    occupation:String(o.occupation??c.occupation??''),
    role:String(ref.role||'support'),
    appearance:String(o.appearance??c.description??c.appearance??''),
    costume:String(o.costume??c.costume??''),
    personality:String(o.personality??c.personality??''),
    traits:String(o.traits??c.traits??''),
    portrait:String(c.portrait||''),
    referenceLicense:String(c.referenceLicense||'未核验')};
  });
  const revision=Math.max(0,Number(project.characterBible?.revision)||0)+1;
  const snapshot={schema:'worldtoon.character-bible.v1',projectId:String(project.id),
   revision,lockedAt:new Date().toISOString(),characters};
  project.characterBible=snapshot;
  project.characterBibleNeedsReview=false;
  return snapshot;
 }
 function getLockedCharacter(project,characterId){
  const found=project?.characterBible?.characters?.find(x=>x.characterId===String(characterId));
  return found?JSON.parse(JSON.stringify(found)):null;
 }
 function validateProjectBible(project){
  const bible=project?.characterBible;
  const refs=Array.isArray(project?.characterRefs)?project.characterRefs:[];
  if(!bible||bible.schema!=='worldtoon.character-bible.v1')
   return {ok:false,issues:['character_bible_not_locked']};
  const issues=[];
  if(project.characterBibleNeedsReview)issues.push('character_bible_needs_review');
  for(const ref of refs){
   if(!bible.characters.some(x=>x.characterId===ref.characterId))
    issues.push('character_ref_not_locked:'+ref.characterId);
  }
  for(const panel of project.panels||[]){
   for(const id of Array.isArray(panel.characterIds)?panel.characterIds:[]){
    if(!bible.characters.some(x=>x.characterId===id))issues.push('panel_character_not_locked:'+id);
   }
  }
  return {ok:issues.length===0,issues};
 }
 return {normalizeWorkspace,upsertGenerated,setComicName,displayName,linkExisting,lockProjectBible,getLockedCharacter,validateProjectBible};
});
