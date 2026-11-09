'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
function response(value){return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}})}
const fakeFetch=async url=>{
 const u=String(url);
 if(u.startsWith('https://gutendex.com/books/'))return response({results:Array.from({length:32},(_,i)=>({
  id:i+100,title:'Classic Story '+(i+1),authors:[{name:'Example Author'}],languages:['en']
 }))});
 if(u.includes('wikidata.org/w/api.php'))return response({search:Array.from({length:12},(_,i)=>{
  const name=new URL(u).searchParams.get('search');return {id:'Q'+(1000+['三国','唐朝','丝绸之路','宋朝','秦朝'].indexOf(name)*20+i),
   label:'History: '+name+' #'+i,description:'historical concept'};
 })});
 if(u.includes('api.artic.edu/api/v1/artworks/search'))return response({data:[
  {id:42,image_id:'image-42',title:'Historic Portrait',is_public_domain:true,artist_display:'A. Artist',date_display:'1800'},
  {id:43,image_id:'image-43',title:'Copyright Restricted',is_public_domain:false,artist_display:'B.'}
 ]});
 if(u.includes('collectionapi.metmuseum.org/public/collection/v1/search'))return response({objectIDs:[4,5]});
 if(u.includes('collectionapi.metmuseum.org/public/collection/v1/objects/4'))return response({
  objectID:4,isPublicDomain:true,primaryImageSmall:'https://images.metmuseum.org/4.jpg',
  objectURL:'https://www.metmuseum.org/art/collection/search/4',title:'Historical Ship'});
 if(u.includes('collectionapi.metmuseum.org/public/collection/v1/objects/5'))return response({
  objectID:5,isPublicDomain:false,primaryImageSmall:'https://images.metmuseum.org/5.jpg',
  objectURL:'https://www.metmuseum.org/art/collection/search/5',title:'Restricted Object'});
 throw Error('Unexpected network request '+u);
};
const sb={Response,URL,URLSearchParams,AbortSignal,fetch:fakeFetch,console,Date,TextEncoder,crypto:require('node:crypto').webcrypto,Headers};
vm.runInNewContext(worker.replace('export default {async fetch(','const defaultWorker={async fetch(')+
 '\nglobalThis.wtTest={heritageDiscover,heritageVisuals,comicDiscover,heritageBook,heritageArt};',sb);
(async()=>{
 const e=sb.wtTest;
 const classics=await (await e.heritageDiscover('classics','',50)).json();
 assert.equal(classics.items.length,32,'Default Gutenberg should supply at least thirty story leads');
 assert.ok(classics.items.every(x=>x.rights_status==='check_jurisdiction'));
 assert.ok(classics.items.every(x=>x.evergreen&&x.verification_status==='pending_research'));
 const historical=await (await e.heritageDiscover('history','',70)).json();
 assert.ok(historical.items.length>=30,'At least thirty historical research leads in sample');
 assert.ok(historical.items.every(x=>x.source_id==='wikidata'&&x.rights_status==='metadata_attribution'));
 const art=await (await e.heritageVisuals(new URL('https://example.org/api/comic/visuals?q=ship'))).json();
 assert.equal(art.items.length,2,'Exclude all non-CC0 artwork');
 assert.ok(art.items.every(x=>x.license==='CC0'&&x.rights_verified===true));
 assert.equal(art.items.filter(x=>x.source==='The Met Open Access').length,1);
 assert.equal(art.items.filter(x=>x.source==='Art Institute of Chicago').length,1);
 const req=await (await e.comicDiscover(new URL('https://example.org/api/comic/discover?source=classics'))).json();
 assert.equal(req.items.length,32,'Evergreen source is routed');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('comic-visuals.js'));
 assert.ok(worker.includes('comic-visuals\\\\.js')||worker.includes('comic-visuals\\.js'));
 const js=fs.readFileSync(path.join(root,'comic-visuals.js'),'utf8');
 assert.ok(js.includes("x.license==='CC0'"),'Client filters license');
 const rankScript=fs.readFileSync(path.join(root,'ranking.js'),'utf8');
 const rankWin={};vm.runInNewContext(rankScript,{window:rankWin,Date,console});
 const classicScore=rankWin.wtEditorialRank.evaluate(classics.items[0],{now:Date.parse('2026-11-10T00:00:00Z')});
 assert.ok(classicScore.overall>=60,'Evergreen topics should not disappear due to historical dates');
 assert.equal(classicScore.method,'evergreen_rule_estimate');
 console.log('WORLD/TOON P0-P2 fixture QA: 32 classics, 60 historical leads, CC0 filtering and non-recency editorial scoring passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
