import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyAiCap,aiGateReady,reserveAiQuota} from '../src/quota.js';
const base={AI_ENABLED:'true',DEEPSEEK_API_KEY:'test-key-NOT-LIVE',DAILY_AI_LIMIT:'3'};
test('AI off or no key never reserves',async()=>{
  let calls=0;const AI_QUOTA={getByName:()=>{calls++;throw Error('must not touch quota')}};
  for(const env of [{...base,AI_QUOTA,AI_ENABLED:'false'},{...base,AI_QUOTA,DEEPSEEK_API_KEY:''},{...base,AI_QUOTA,DAILY_AI_LIMIT:'0'},{...base,AI_QUOTA,DAILY_AI_LIMIT:'1000'}]){
    assert.equal((await reserveAiQuota(env)).allowed,false);
  }assert.equal(calls,0);
});
test('valid quota must be small positive integer',()=>{
  assert.equal(dailyAiCap({...base}),3);assert.equal(dailyAiCap({...base,DAILY_AI_LIMIT:'1.1'}),0);assert.equal(dailyAiCap({...base,DAILY_AI_LIMIT:'10'}),10);assert.equal(dailyAiCap({...base,DAILY_AI_LIMIT:'11'}),0);
});
test('missing DO binding fails closed',async()=>{assert.equal(aiGateReady(base),false);assert.equal((await reserveAiQuota(base)).allowed,false)});
test('quota permits exactly configured reservations',async()=>{
  let used=0;const env={...base,AI_QUOTA:{getByName:(name)=>{assert.equal(name,'knowa-global-paid-ai');return {reserve:async (day,cap)=>{assert.equal(day,'2026-11-19');assert.equal(cap,3);return ++used<=cap}}}}};
  for(let i=0;i<3;i++)assert.equal((await reserveAiQuota(env,new Date('2026-11-19T01:00:00Z'))).allowed,true);
  assert.deepEqual(await reserveAiQuota(env,new Date('2026-11-19T01:00:00Z')),{allowed:false,reason:'quota-exhausted'});
});
test('quota backend fails closed without issuing paid call',async()=>{
  const env={...base,AI_QUOTA:{getByName:()=>({reserve:async()=>{throw Error('quota failed')}})}};
  assert.deepEqual(await reserveAiQuota(env),{allowed:false,reason:'quota-unavailable'});
});
