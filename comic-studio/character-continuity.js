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
     origin:'ai-draft',reviewStatus:'pending_author_confirmation',version:1,originProjectId:projectId,originRole:role,aiModel:String(candidate.aiModel||''),
     comicNames:[]};
    data.characters.push(character);
    setComicName(data,character.characterId,projectId,candidate.comicName||candidate.name);
    added++;
   }
   if(!project.characterRefs.some(x=>x.characterId===character.characterId)){
    const pending=character.origin==='ai-draft'||character.reviewStatus==='pending_author_confirmation';
    const snapshot=pending?null:{characterId:character.characterId,version:Math.max(1,Number(character.version)||1),
      originalName:String(character.originalName||character.name||''),gender:String(character.gender||''),
      age:String(character.age||''),profession:String(character.profession||''),
      description:String(character.description||''),costume:String(character.costume||''),
      traits:String(character.traits||''),personality:String(character.personality||''),
      colors:String(character.colors||''),portrait:String(character.portrait||'')};
    project.characterRefs.push({characterId:character.characterId,role,
      comicName:String(candidate.comicName||candidate.name).trim(),
      ...(pending?{pending_author_review:true}:{version:snapshot.version,snapshot})});
   }
  }
  return {added,linked,unresolved};
 }
 return {normalizeWorkspace,upsertGenerated,setComicName,displayName};
});
