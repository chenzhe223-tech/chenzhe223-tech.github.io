/* WORLD/TOON regression: a stale service worker must not cache GitHub/private API responses. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const archive=fs.readFileSync(path.join(__dirname,'../archive.js'),'utf8');
const events={};
const cache={
  addAll:async()=>{},
  keys:async()=>[],
  delete:async()=>true,
  put:async()=>{}
};
const caches={
  open:async()=>cache,
  keys:async()=>['davylab-comic-press-v2.3-personal-studio','davylab-comic-press-v4.3.0-story-identity'],
  delete:async()=>true,
  match:async()=>null
};
vm.runInNewContext(sw,{
  self:{
    location:{origin:'https://worldtoon.chenzhe223.workers.dev'},
    addEventListener:(name,handler)=>{events[name]=handler;},
    skipWaiting:()=>{},
    clients:{claim:async()=>{}}
  }, caches,URL,fetch:async()=>({ok:true,clone(){return this;}}),
  Promise
},{filename:'sw.js'});
function isIntercepted(url,method='GET'){
  let intercepted=false;
  events.fetch({request:{url,method},respondWith:()=>{intercepted=true;}});
  return intercepted;
}
for(const route of ['/api/archive/sync','/api/archive/status','/api/config','/api/news','/api/comic/story-search','/health']){
  assert.equal(isIntercepted('https://worldtoon.chenzhe223.workers.dev'+route),false,route+' must use network directly');
}
assert.equal(isIntercepted('https://worldtoon.chenzhe223.workers.dev/archive.js'),true,'static scripts can use offline fallback');
assert.equal(isIntercepted('https://worldtoon.chenzhe223.workers.dev/'),true,'offline app shell is allowed');
assert.match(archive,/WT_ARCHIVE_CLIENT_REV='3\.0\.0'/);
assert.match(archive,/\?rev='/);
assert.match(archive,/wtArchiveSnapshot=null,wtArchiveError=''.*wtArchiveLastSync=0/);
console.log('PASS: auth APIs bypass SW cache, static shell retains offline fallback, stale dashboard cleared');

