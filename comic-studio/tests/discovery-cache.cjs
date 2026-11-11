'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const worker=fs.readFileSync(path.join(root,'worker.js'),'utf8');
const frontend=fs.readFileSync(path.join(root,'extension.js'),'utf8');
const snapshots=new Map();
function db(){
 return {prepare(sql){
  return {args:[],bind(...args){this.args=args;return this},
   async all(){if(sql.includes('wt_discovery_snapshots'))return {results:[...snapshots.values()].map(x=>({...x}))};throw Error('Unexpected SQL: '+sql)},
   async run(){
    if(sql.startsWith('INSERT INTO wt_discovery_snapshots')){
     const [source,payload,count,collected,lastAttempt]=this.args;
     snapshots.set(source,{source,payload,item_count:count,collected_at:collected,last_attempt_at:lastAttempt,last_error:null});
     return {success:true};
    }
    if(sql.startsWith('UPDATE wt_discovery_snapshots')){
     const [last_attempt_at,last_error,source]=this.args;const row=snapshots.get(source);
     if(row)Object.assign(row,{last_attempt_at,last_error});return {success:true};
    }throw Error('Unexpected SQL: '+sql);
   }
  }
 }};
}
let failUpstream=false;
const fakeFetch=async url=>{
 if(failUpstream)throw Error('upstream temporarily offline');
 if(String(url).startsWith('https://gutendex.com/books/'))return new Response(JSON.stringify({results:[
  {id:314,title:'Original Classic Fiction',authors:[{name:'Public Domain Author'}],languages:['en']},
  {id:315,title:'Another Old Tale',authors:[{name:'Writer'}],languages:['en']}
 ]}),{status:200,headers:{'content-type':'application/json'}});
 throw Error('Unexpected external URL: '+url);
};
const c={URL,URLSearchParams,Response,Headers,TextEncoder,Date,AbortSignal,fetch:fakeFetch,console,crypto:require('node:crypto').webcrypto};
vm.runInNewContext(worker.replace('export default {async fetch(','const exportedWorker={async fetch(')+
 '\nglobalThis.testCatalog={wtDiscoveryRead,wtRefreshOneSource,wtDiscoveryScheduled};',c);
const api=c.testCatalog;
(async()=>{
 const empty=await (await api.wtDiscoveryRead({DB:db()},new URL('https://example.org/api/comic/catalog?source=all'))).json();
 assert.equal(empty.ready,false);
 assert.equal(empty.items.length,0);
 assert.equal(empty.initializing,true);
 const result=await api.wtRefreshOneSource({DB:db()},'classics');
 assert.equal(result.ok,true);
 const stored=snapshots.get('classics');
 assert.equal(stored.item_count,2);
 const only=await (await api.wtDiscoveryRead({DB:db()},new URL('https://example.org/api/comic/catalog?source=classics'))).json();
 assert.equal(only.items.length,2);
 assert.equal(only.items[0].source_id,'gutenberg');
 assert.equal(only.method,'d1_snapshot_read');
 assert.equal(only.items[0].verification_status,'pending_research');
 // The same story may arrive through two feeds: one URL appears only once in all-source view.
 const duplicated={source:'news',payload:JSON.stringify({items:[only.items[0],{
  title:'Different science event',url:'https://example.org/real',source:'Example',source_id:'news',category:'科学'
 }]}),item_count:2,collected_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),last_error:null};
 snapshots.set('news',duplicated);
 const aggregate=await (await api.wtDiscoveryRead({DB:db()},new URL('https://example.org/api/comic/catalog?source=all'))).json();
 assert.equal(aggregate.items.length,3,'Deduplicate cached URL across separate source snapshots');
 assert.ok(aggregate.items.some(x=>x.category==='经典故事'));
 const before=snapshots.get('classics').payload;failUpstream=true;
 const failed=await api.wtRefreshOneSource({DB:db()},'classics');
 assert.equal(failed.ok,false);
 assert.equal(snapshots.get('classics').payload,before,'failed collection must never replace last good payload');
 assert.ok(snapshots.get('classics').last_error);
 const stale=await (await api.wtDiscoveryRead({DB:db()},new URL('https://example.org/api/comic/catalog?source=classics'))).json();
 assert.equal(stale.items.length,2,'last-good snapshot visible during upstream outage');
 assert.ok(stale.warnings.length>0);
 const invalid=await api.wtDiscoveryRead({DB:db()},new URL('https://example.org/api/comic/catalog?source=invalid'));
 assert.equal(invalid.status,400);
 assert.ok(worker.includes('async scheduled(controller,env,ctx){await wtDiscoveryScheduled(controller,env)}'),'Worker must have cron entrypoint');
 const readFn=frontend.slice(frontend.indexOf('async function wtFetchNews()'),frontend.indexOf('async function wtSaveNews('));
 assert.ok(readFn.includes('/api/comic/catalog?source=all'),'UI reads cached all-source inventory');
 assert.ok(readFn.includes('limit=500'),'Expanded discovery request must not cut off newly added editorial sources');
 assert.ok(!readFn.includes('/api/comic/discover'),'UI never directly scrapes external sources');
 assert.ok(frontend.includes("case'source':wtSource=val;wtCategory='全部';wtVisibleCount=12;render()"),'source tabs only change local state');
 assert.ok(frontend.includes("cache_source===wtSource"),'local source filtering');
 assert.ok(frontend.includes("case'category':wtCategory=val;wtVisibleCount=12;render()"),'category tabs only change local state');
 assert.ok(frontend.includes("worldtoon_catalog_cache_v2"),'last-good client fallback');
 console.log('WORLD/TOON catalog v2 QA: D1 cold-cache, refresh, source union, local switching, stale-on-failure and rights flags PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
