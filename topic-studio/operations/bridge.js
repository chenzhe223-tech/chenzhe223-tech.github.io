/* DAVYLAB operations: read-only legacy adapters; never changes source localStorage or publish approvals. */
(function(root,factory){const out=factory(root?.DAVYLABOperations||(typeof module==="object"?require("./core.js"):null));if(typeof module==="object"&&module.exports)module.exports=out;if(root)root.DAVYLABOperationsBridge=out;})(typeof window!=="undefined"?window:null,function(core){
"use strict";if(!core)throw Error("OPERATIONS_CORE_REQUIRED");
const urlOk=v=>typeof v==="string"&&/^https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+(?:\?.*)?$/.test(v);
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const kindOf=x=>String(x||"").includes("贴图")?"post":"article";
function publishedArchive(snapshot){
 if(!snapshot||!Array.isArray(snapshot.articles)||snapshot.account_name!=="DAVYLAB"||snapshot.sync_status!=="synced_via_browser")return {items:[],rejected:0,reason:"UNVERIFIED_ARCHIVE"};
 const seen=new Set(),items=[];let rejected=0;
 for(const row of snapshot.articles.slice(0,2500)){
  if(!row||!urlOk(row.url)||!row.title||!validDate(row.publishedAt)||row.source!=="WeChat Official Account backend"){rejected++;continue}
  const articleId=row.url.split("/s/")[1].split("?")[0];
  if(seen.has(articleId)){rejected++;continue}seen.add(articleId);
  const kind=kindOf(row.format),id=core.stableId("wx_"+articleId,kind);
  items.push({id,topicId:null,kind,title:String(row.title).slice(0,180),phase:"published",readOnly:true,origin:"verified-public-archive",archiveUrl:row.url,publishedAt:row.publishedAt,verifiedBy:"workbuddy-browser",sourceSyncAt:snapshot.last_synced_at||null});
 }
 return {items,rejected,reason:null};
}
function legacyReviews(reviews,archiveAssets){
 const byUrl=new Map(archiveAssets.filter(x=>x.archiveUrl).map(x=>[x.archiveUrl,x]));
 const dates={};const metrics=[];let ignored=0;
 for(const r of (Array.isArray(reviews)?reviews:[]).slice(0,2000)){
  const asset=byUrl.get(r?.url);const age=Number(r?.checkpoint);
  if(!asset||![7,30].includes(age)||!validDate(asset.publishedAt)){ignored++;continue}
  const target=new Date(asset.publishedAt+"T00:00:00Z");target.setUTCDate(target.getUTCDate()+age);const expected=target.toISOString().slice(0,10);
  const val=r.reads;
  if(!Number.isSafeInteger(val)||val<0){ignored++;continue}
  const key=asset.id+"::wechat::"+expected;
  if(metrics.some(x=>x.key===key)){ignored++;continue}
  metrics.push({...core.metric({assetId:asset.id,platform:"wechat",day:expected,views:val,source:"growth-lab-manual",collectedAt:typeof r.reviewDate==="string"?r.reviewDate+"T12:00:00+08:00":undefined}),key,checkpoint:age,reportedAt:r.reviewDate||null});
  dates[asset.id]=asset.publishedAt;
 }
 return {metrics,releaseDates:dates,ignored};
}
function mergePreview(current,archive,reviewResult){
 const assets=[...current.assets],metrics=[...current.metrics],releaseDates={...current.releaseDates};let added=0,updated=0,metricsAdded=0;
 for(const incoming of archive.items){
 const i=assets.findIndex(a=>a.id===incoming.id);
 if(i<0){assets.push(incoming);added++}
 else if(assets[i].origin==="verified-public-archive"){assets[i]={...assets[i],...incoming};updated++}
 }
 const index=new Set(metrics.map(x=>x.assetId+"::"+x.platform+"::"+x.day));
 for(const m of reviewResult.metrics){const key=m.assetId+"::"+m.platform+"::"+m.day;if(index.has(key))continue;metrics.push(m);index.add(key);metricsAdded++}
 for(const [k,v] of Object.entries(reviewResult.releaseDates))if(!releaseDates[k])releaseDates[k]=v;
 return {next:{...current,assets,metrics,releaseDates},added,updated,metricsAdded};
}
return Object.freeze({publishedArchive,legacyReviews,mergePreview});
});