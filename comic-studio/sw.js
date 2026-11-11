/* WORLD/TOON offline shell v2.7.1. Authenticated APIs must NEVER be cached. */
'use strict';
const CACHE='davylab-comic-press-v4.2.1-story-options';
const CORE=['./','./index.html','./app.js','./archive.js','./styles.css','./style-v3.css','./style-v3.js','./creative-director.js','./creative-pilot.js','./comic-engine.js','./creative-director.css','./extension.js','./briefing.js','./personalize.js','./personalize.css','./favicon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('davylab-comic-press-')&&key!==CACHE).map(key=>caches.delete(key)));
    // Defensive cleanup if an older worker stored private API data in this cache.
    const cache=await caches.open(CACHE);
    await Promise.all((await cache.keys()).filter(req=>{
      const path=new URL(req.url).pathname;
      return path.startsWith('/api/')||path==='/health';
    }).map(req=>cache.delete(req)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  // Strict network-only: status, session, private GitHub indexes, quota, and all API calls.
  // Never return a cached public-only snapshot to a newly authenticated user.
  if(url.pathname.startsWith('/api/')||url.pathname==='/health')return;
  const code=/\.(?:html|js|css)$/.test(url.pathname)||url.pathname.endsWith('/');
  if(code){
    event.respondWith(fetch(req).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
      return response;
    }).catch(()=>caches.match(req)));
  }else{
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
      return response;
    })));
  }
});
