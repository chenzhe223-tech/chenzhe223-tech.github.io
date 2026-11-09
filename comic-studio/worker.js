// WORLD/TOON • By DAVYLAB • GitHub-backed Cloudflare Worker
// Keeps the existing workers.dev hostname and serves the comic-studio/ static bundle.
const ORIGIN='https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/comic-studio/';
const MIME={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json',md:'text/markdown; charset=utf-8'};
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/health')return Response.json({ok:true,app:'WORLD/TOON',version:'1.0',delivery:'GitHub-backed Cloudflare Worker',source:'comic-studio',at:new Date().toISOString()},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(path.includes('..')||!(/^(index\.html|app\.js|styles\.css|sw\.js|manifest\.webmanifest|favicon\.svg|assets\/[A-Za-z0-9_.%\-]+\.png)$/.test(path)||/^assets\//.test(path)))return new Response('Not found',{status:404});
  try{
   const isAsset=path.startsWith('assets/'),ttl=isAsset?3600:30;
   const target=ORIGIN+path;
   const upstream=await fetch(target,{cf:{cacheTtl:ttl,cacheEverything:true}});
   if(!upstream.ok)return new Response('Asset unavailable',{status:upstream.status===404?404:503});
   const ext=path.split('.').pop();
   const headers=new Headers({'content-type':MIME[ext]||'application/octet-stream','cache-control':isAsset?'public, max-age=3600':'public, max-age=30','x-worldtoon-version':'1.0','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(),microphone=(),geolocation=()'});
   if(!isAsset)headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
   return new Response(upstream.body,{status:200,headers});
  }catch{return new Response('Temporary origin error',{status:503})}
 }
};
