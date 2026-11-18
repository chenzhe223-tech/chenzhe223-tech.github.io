/* DAVYLAB Operations Core — isolated, no publishing, no credentials. MIT-inspired ideas; independently implemented. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.DAVYLABOperations=api;})(typeof window!=="undefined"?window:null,function(){
"use strict";
const VERSION="0.1.0";
const PHASES=Object.freeze(["draft","approved","in_wechat_draft","published"]);
const TASK_STATES=Object.freeze(["planned","preparing","qa_passed","awaiting_user","draft_saved","preview_passed","published","blocked"]);
const MAX_RECORDS=2000;
function validId(v){return typeof v==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(v);}
function assertId(v){if(!validId(v))throw Error("INVALID_ID");return v;}
function isoDate(v){if(typeof v!=="string"||!/^\d{4}-\d\d-\d\d$/.test(v)||Number.isNaN(Date.parse(v+"T00:00:00Z")))throw Error("INVALID_DATE");return v;}
function stableId(topicId,kind="article"){assertId(topicId);if(!["article","post","video"].includes(kind))throw Error("INVALID_KIND");return kind+"_"+topicId;}
function makeAsset({topicId,kind="article",title,sourceUrl="",visualPlan=null}){
const id=stableId(topicId,kind);return {id,topicId,kind,title:String(title||"").trim().slice(0,180),sourceUrl,visualPlan,phase:"draft",approval:null,packageId:null,platforms:{},createdAt:new Date().toISOString()};}
function transition(asset,to,evidence={}){
if(!asset||!PHASES.includes(asset.phase)||!PHASES.includes(to))throw Error("INVALID_PHASE");
if(PHASES.indexOf(to)!==PHASES.indexOf(asset.phase)+1)throw Error("INVALID_TRANSITION");
if(to==="approved"&&(!evidence.explicitApproval||!evidence.approvedBy||!evidence.packageId))throw Error("APPROVAL_REQUIRED");
if(to==="in_wechat_draft"&&(!evidence.draftReceipt||!evidence.qaPassed))throw Error("DRAFT_RECEIPT_REQUIRED");
if(to==="published"&&(!evidence.permanentUrl||!/^https:\/\/mp\.weixin\.qq\.com\/s\//.test(evidence.permanentUrl)||!evidence.explicitPublishAuthorization||!evidence.previewPassed||!evidence.backendVerified))throw Error("PUBLISH_EVIDENCE_REQUIRED");
return {...asset,phase:to,approval:to==="approved"?{by:evidence.approvedBy,at:new Date().toISOString(),packageId:evidence.packageId}:asset.approval,packageId:to==="approved"?evidence.packageId:asset.packageId,proof:{...(asset.proof||{}),[to]:{...evidence,at:new Date().toISOString()}}};
}
function upsertTask(tasks,record){
if(!Array.isArray(tasks)||tasks.length>MAX_RECORDS)throw Error("TASK_LIMIT");assertId(record.assetId);
if(!/^[a-z][a-z0-9_-]{1,39}$/.test(record.platform||""))throw Error("INVALID_PLATFORM");
if(!TASK_STATES.includes(record.status))throw Error("INVALID_TASK_STATE");
const key=record.assetId+"::"+record.platform;
const idx=tasks.findIndex(x=>x.assetId+"::"+x.platform===key);
const old=tasks[idx];
if(old&&["draft_saved","published"].includes(old.status)&&!["draft_saved","published"].includes(record.status))throw Error("LOCKED_TASK_CANNOT_REGRESS");
if(record.status==="published"&&!(record.permanentUrl&&record.backendVerified&&record.explicitPublishAuthorization))throw Error("TASK_PUBLISH_PROOF_REQUIRED");
const next={...(old||{}),...record,key,updatedAt:new Date().toISOString()};
return idx<0?[...tasks,next]:tasks.map((x,i)=>i===idx?next:x);
}
function metric({assetId,platform,day,views=null,shares=null,followers=null,source="manual",collectedAt=null}){
assertId(assetId);isoDate(day);
const count=x=>x===null||x===undefined||x===""?null:Number.isSafeInteger(x)&&x>=0?x:(()=>{throw Error("INVALID_METRIC")})();
return {assetId,platform,day,views:count(views),shares:count(shares),followers:count(followers),source,collectedAt:collectedAt||new Date().toISOString()};
}
function sameAge(records,id,comparisonId,ageDays,releaseDates){
if(![1,3,7,30].includes(ageDays))throw Error("UNSUPPORTED_AGE");
function view(assetId){const date=releaseDates[assetId];if(!date)return {value:null,reason:"missing-published-date"};isoDate(date);
const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+ageDays);
const target=d.toISOString().slice(0,10);
const matching=records.filter(r=>r.assetId===assetId&&r.day===target&&Number.isSafeInteger(r.views));
if(!matching.length)return {value:null,reason:"not-collected",day:target};
return {value:matching.reduce((s,r)=>s+r.views,0),day:target};}
const current=view(id),previous=view(comparisonId);
return {ageDays,current,previous,ratio:current.value===null||previous.value===null||previous.value===0?null:current.value/previous.value};
}
function utm({source="wechat",medium="article",campaign}){
assertId(campaign);const q=new URLSearchParams({utm_source:source,utm_medium:medium,utm_campaign:campaign});return q.toString();}
function parseAttribution(search){const params=new URLSearchParams(String(search||"").replace(/^\?/,""));const campaign=params.get("utm_campaign");if(!campaign||!validId(campaign))return null;return {campaign,source:(params.get("utm_source")||"unknown").slice(0,80),medium:(params.get("utm_medium")||"unknown").slice(0,80)};}
function joinAttribution(visits,conversions){return visits.map(v=>({...v,conversions:conversions.filter(c=>c.campaign===v.campaign).length}));}
return Object.freeze({VERSION,PHASES,TASK_STATES,stableId,makeAsset,transition,upsertTask,metric,sameAge,utm,parseAttribution,joinAttribution});
});
