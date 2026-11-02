const API = 'https://api.github.com';
const VAULT_REPO = 'keypocket-cloud-vault';
const VAULT_PATH = 'keypocket-vault.v2.json';
const MAX_BODY = 8 * 1024 * 1024;

const enc = new TextEncoder();
const dec = new TextDecoder();
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...headers } });
}
function b64url(bytes) {
  let raw = '';
  for (let i=0;i<bytes.length;i+=0x8000) raw += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(text) {
  const raw = atob(String(text).replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4 - String(text).length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
function toB64(bytes) {
  let raw = '';
  for (let i=0;i<bytes.length;i+=0x8000) raw += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(raw);
}
function fromPem(pem) {
  const body = String(pem).replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  return Uint8Array.from(atob(body), c => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign','verify']);
}
async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return body + '.' + b64url(mac);
}
async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || token.length > 8192) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, fromB64url(parts[1]), enc.encode(parts[0]));
    if (!valid) return null;
    const data = JSON.parse(dec.decode(fromB64url(parts[0])));
    if (!data.exp || data.exp < Math.floor(Date.now()/1000)) return null;
    return data;
  } catch { return null; }
}
function cors(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = env.APP_ORIGIN || 'https://chenzhe223-tech.github.io';
  if (origin !== allowed) return {};
  return { 'Access-Control-Allow-Origin':allowed, 'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS', 'Access-Control-Allow-Headers':'Authorization,Content-Type', 'Vary':'Origin' };
}
async function githubFetch(path, token, init = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: {
      Accept:'application/vnd.github+json',
      Authorization:'Bearer '+token,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'KeyPocket-GitHub-App',
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? (()=>{try{return JSON.parse(text)}catch{return text}})() : null;
  if (!response.ok) {
    const message = data && typeof data === 'object' ? data.message : 'GitHub API request failed';
    throw new Error('GitHub HTTP '+response.status+': '+message);
  }
  return data;
}
async function appJwt(env) {
  const now = Math.floor(Date.now()/1000);
  const header = b64url(enc.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload = b64url(enc.encode(JSON.stringify({iat:now-30,exp:now+540,iss:String(env.GITHUB_APP_ID)})));
  const input = header+'.'+payload;
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', fromPem(env.GITHUB_APP_PRIVATE_KEY),
    { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,enc.encode(input)));
  return input+'.'+b64url(signature);
}
async function installationToken(env, installationId) {
  const jwt = await appJwt(env);
  const result = await githubFetch('/app/installations/'+encodeURIComponent(installationId)+'/access_tokens',jwt,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      repositories:[VAULT_REPO],
      permissions:{contents:'write',metadata:'read'}
    })
  });
  return result.token;
}
function getBearer(request) {
  const value = request.headers.get('Authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}
async function session(request, env) {
  return verifyToken(getBearer(request),env.SESSION_SECRET);
}
function validEnvelope(value) {
  return !!value && typeof value==='object' &&
    typeof value.salt==='string' && value.salt.length>=20 && value.salt.length<=128 &&
    Number.isInteger(value.iterations) && value.iterations>=100000 && value.iterations<=1000000 &&
    typeof value.iv==='string' && value.iv.length>=12 && value.iv.length<=64 &&
    typeof value.data==='string' && value.data.length>=24 && value.data.length<=MAX_BODY*1.5;
}
async function repositories(env, installationId) {
  const jwt=await appJwt(env);
  const data=await githubFetch('/app/installations/'+encodeURIComponent(installationId)+'/repositories?per_page=100',jwt);
  return data.repositories || [];
}
async function vaultSha(token, account) {
  try {
    const data=await githubFetch('/repos/'+encodeURIComponent(account)+'/'+VAULT_REPO+'/contents/'+VAULT_PATH,token);
    return data.sha || null;
  } catch(e) {
    if (String(e.message).includes('HTTP 404')) return null;
    throw e;
  }
}
async function handler(request, env) {
  const url=new URL(request.url), path=url.pathname;
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(request,env)});
  if(path==='/health'&&request.method==='GET') return json({ok:true,service:'keypocket-vault-api',version:2});
  if(path==='/github/install'&&request.method==='GET') {
    if(!env.GITHUB_APP_SLUG||!env.SESSION_SECRET) return json({error:'GitHub App Worker is not configured.'},503);
    const returnUrl=new URL(url.searchParams.get('return_url')||'/keypocket/',env.APP_ORIGIN);
    if(returnUrl.origin!==env.APP_ORIGIN||!returnUrl.pathname.startsWith('/keypocket/')) return json({error:'Invalid application return URL.'},400);
    const state=await signToken({kind:'install-state',returnUrl:returnUrl.href,nonce:crypto.randomUUID(),exp:Math.floor(Date.now()/1000)+600},env.SESSION_SECRET);
    return Response.redirect('https://github.com/apps/'+encodeURIComponent(env.GITHUB_APP_SLUG)+'/installations/new?state='+encodeURIComponent(state),302);
  }
  if(path==='/github/callback'&&request.method==='GET') {
    const state=await verifyToken(url.searchParams.get('state'),env.SESSION_SECRET);
    if(!state||state.kind!=='install-state') return json({error:'Invalid or expired GitHub installation state.'},400);
    const installationId=url.searchParams.get('installation_id'), setup=url.searchParams.get('setup_action');
    if(!installationId||!['install','update'].includes(setup||'')) return json({error:'GitHub App installation was cancelled or incomplete.'},400);
    try {
      const jwt=await appJwt(env);
      const installation=await githubFetch('/app/installations/'+encodeURIComponent(installationId),jwt);
      const account=installation.account?.login;
      const repos=await repositories(env,installationId);
      const vault=repos.find(x=>x.name===VAULT_REPO && x.private===true);
      if(!vault) {
        const returnUrl=new URL(state.returnUrl);
        returnUrl.hash='kp_v2_github_error='+encodeURIComponent('请先创建私有仓库 '+VAULT_REPO+'，再将 GitHub App 安装到该仓库。');
        return Response.redirect(returnUrl.href,302);
      }
      const token=await signToken({
        kind:'keypocket-github-session',
        installationId:Number(installationId),
        account,repository:VAULT_REPO,
        exp:Math.floor(Date.now()/1000)+7*86400
      },env.SESSION_SECRET);
      const returnUrl=new URL(state.returnUrl);
      returnUrl.hash='kp_v2_github_session='+encodeURIComponent(token);
      return Response.redirect(returnUrl.href,302);
    } catch(e) { return json({error:e.message||'GitHub installation verification failed.'},502); }
  }
  if(path.startsWith('/github/')) {
    const auth=await session(request,env);
    if(!auth||auth.kind!=='keypocket-github-session'||!auth.installationId||auth.repository!==VAULT_REPO) return json({error:'GitHub App session expired. Please reconnect.'},401,cors(request,env));
    const headers=cors(request,env);
    try {
      const token=await installationToken(env,auth.installationId);
      const repo=await githubFetch('/repos/'+encodeURIComponent(auth.account)+'/'+VAULT_REPO,token);
      if(repo.private!==true) return json({error:'The KeyPocket vault repository must be private.'},403,headers);
      if(path==='/github/status'&&request.method==='GET') {
        return json({connected:true,account:auth.account,repository:VAULT_REPO,private:true,permissions:{contents:'write',metadata:'read'}},200,headers);
      }
      if(path==='/github/vault'&&request.method==='GET') {
        const data=await githubFetch('/repos/'+encodeURIComponent(auth.account)+'/'+VAULT_REPO+'/contents/'+VAULT_PATH,token);
        if(!data.content) return json({error:'No KeyPocket backup file exists yet.'},404,headers);
        const bytes=Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
        const payload=JSON.parse(dec.decode(bytes));
        if(!validEnvelope(payload)) return json({error:'Vault file is not a valid encrypted KeyPocket V2 envelope.'},422,headers);
        return json(payload,200,headers);
      }
      if(path==='/github/vault'&&request.method==='PUT') {
        const text=await request.text();
        if(text.length>MAX_BODY) return json({error:'Encrypted backup exceeds the 8 MB request limit.'},413,headers);
        let payload;
        try{payload=JSON.parse(text)}catch{return json({error:'Invalid JSON payload.'},400,headers)}
        if(!validEnvelope(payload)) return json({error:'Only a valid encrypted KeyPocket envelope can be stored.'},422,headers);
        const bytes=enc.encode(JSON.stringify(payload));
        let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
        const sha=await vaultSha(token,auth.account);
        const saved=await githubFetch('/repos/'+encodeURIComponent(auth.account)+'/'+VAULT_REPO+'/contents/'+VAULT_PATH,token,{
          method:'PUT',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({message:'chore(keypocket): update encrypted vault backup',content:btoa(binary),...(sha?{sha}:{})})
        });
        return json({saved:true,repository:VAULT_REPO,path:VAULT_PATH,commit:saved.commit?.sha||null},200,headers);
      }
      if(path==='/github/disconnect'&&request.method==='POST') return json({disconnected:true},200,headers);
      return json({error:'Not found.'},404,headers);
    } catch(e) { return json({error:e.message||'GitHub vault request failed.'},502,headers); }
  }
  return json({error:'Not found.'},404,cors(request,env));
}
export default { async fetch(request,env) {
  try { return await handler(request,env); }
  catch(e) { return json({error:e.message||'Internal error.'},500,cors(request,env)); }
} };
