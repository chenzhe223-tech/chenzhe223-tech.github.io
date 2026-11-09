import {createClient} from "npm:@supabase/supabase-js@2.57.0";
import {unzipSync,strFromU8} from "npm:fflate@0.8.2";
const SITE="https://chenzhe223-tech.github.io";
const REPO="chenzhe223-tech/workbuddy-workspace",BASE="https://api.github.com/repos/"+REPO;
const H={"Access-Control-Allow-Origin":SITE,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(v,c=200)=>new Response(JSON.stringify(v),{status:c,headers:H});
const fail=(s,c=422)=>{throw Object.assign(new Error(s),{status:c})};
const TAG=/^ai-explorations-(20\d{2}-W(?:0[1-9]|[1-4]\d|5[0-3]))-v([1-9]\d*)$/;
async function api(path,token){
 const r=await fetch(BASE+path,{headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"DAVYLAB-GitHub-Sync"},signal:AbortSignal.timeout(14000)});
 if(!r.ok)fail("GitHub returned "+r.status+" for "+path,r.status===404?404:502);
 return r.json();
}
async function file(path,token,ref="main"){
 const q="/contents/"+path.split("/").map(encodeURIComponent).join("/")+"?ref="+encodeURIComponent(ref);
 const d=await api(q,token);
 if(d.type!=="file"||d.encoding!=="base64"||!d.content)fail("Missing source file "+path,422);
 return JSON.parse(atob(d.content.replace(/\s/g,"")));
}
async function zipAssets(asset,token){
 if(asset.size>45000000)fail("ZIP exceeds 45 MB safety threshold",422);
 const r=await fetch(BASE+"/releases/assets/"+asset.id,{
  headers:{"Authorization":"Bearer "+token,"Accept":"application/octet-stream","X-GitHub-Api-Version":"2022-11-28","User-Agent":"DAVYLAB-GitHub-Sync"},
  signal:AbortSignal.timeout(25000)
 });
 if(!r.ok)fail("GitHub release ZIP unavailable, HTTP "+r.status,502);
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes[0]!==80||bytes[1]!==75)fail("GitHub response is not a ZIP (asset media redirect/access issue)",502);
 const files=unzipSync(bytes);
 if(!files["manifest.json"]||!files["validated-manifest.json"])fail("ZIP has no editorial QA evidence");
 const m=JSON.parse(strFromU8(files["manifest.json"]));
 const qa=JSON.parse(strFromU8(files["validated-manifest.json"]));
 const posters=Object.keys(files).filter(n=>/^images\/0[1-9]_[^/]+\.png$/.test(n));
 if(posters.length!==9)fail("ZIP must include exactly 9 PNG files");
 for(const item of qa.images||[]){
  const contents=files[item.file];
  if(!contents||contents.length<100000)fail("Missing actual poster file "+item.file);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",contents))).map(b=>b.toString(16).padStart(2,"0")).join("");
  if(hash!==item.sha256)fail("Image SHA256 mismatch in ZIP "+item.file);
 }
 return {m,qa,files};
}
const news=m=>m.news.map(x=>({title:String(x.title||""),url:String(x.url||x.source_url||""),published_at:x.published_at||x.published||null}));
const skills=m=>m.skills.map(x=>({name:String(x.name||x.title||""),url:String(x.url||"")}));
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:H,status:204});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 if(req.headers.get("origin")&&req.headers.get("origin")!==SITE)return reply({error:"Origin forbidden"},403);
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!jwt)return reply({error:"Authentication required"},401);
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!service)return reply({error:"Server unavailable"},503);
 const userRes=await createClient(url,anon,{auth:{persistSession:false}}).auth.getUser(jwt);
 const user=userRes.data?.user;if(userRes.error||!user)return reply({error:"Invalid login"},401);
 const db=createClient(url,service,{auth:{persistSession:false}});
 const owner=await db.from("explorations_sync_owners").select("enabled").eq("user_id",user.id).maybeSingle();
 if(owner.error)return reply({error:"Permission check failed"},500);
 if(!owner.data?.enabled)return reply({error:"Not authorized to sync private delivery repository"},403);
 let body={};try{body=await req.json()}catch{return reply({error:"Invalid JSON"},400)}
 const del=db.from("explorations_deliveries");
 if(body.action==="list"){
  const r=await del.select("id,issue,revision,github_tag,github_release_url,github_zip_name,github_zip_sha256,status,wechat_status,published_in_studio_at,github_created_at,last_synced_at,news,skills,posters").eq("user_id",user.id).order("issue",{ascending:false}).order("revision",{ascending:false}).limit(100);
  return r.error?reply({error:r.error.message},500):reply({items:r.data||[]});
 }
 if(body.action==="poster"){
  const id=String(body.delivery_id||""),slot=Number(body.slot);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(slot)||slot<1||slot>9)return reply({error:"Invalid poster request"},400);
  const r=await del.select("github_tag,github_zip_name,posters").eq("user_id",user.id).eq("id",id).maybeSingle();
  if(r.error)return reply({error:r.error.message},500);
  if(!r.data)return reply({error:"Edition not found"},404);
  const image=(r.data.posters||[]).find(x=>Number(x.slot)===slot);
  if(!image||!/^images\/0[1-9]_[a-z0-9._-]+\.png$/i.test(image.file))return reply({error:"No verified poster for that slot"},404);
  const githubToken=Deno.env.get("EXPLORATIONS_GITHUB_TOKEN")||"";
  if(!githubToken)return reply({error:"Private GitHub access not configured"},503);
  try{
   const release=await api("/releases/tags/"+encodeURIComponent(r.data.github_tag),githubToken);
   const asset=(release.assets||[]).find(a=>a.name===r.data.github_zip_name&&a.state==="uploaded");
   if(!asset)fail("Release ZIP not found",404);
   const {files}=await zipAssets(asset,githubToken);
   const content=files[image.file];
   if(!content)fail("Poster not found in Release",404);
   return new Response(content,{status:200,headers:{...H,"Content-Type":"image/png","Content-Disposition":"inline","Cache-Control":"private, max-age=60"}});
  }catch(e){return reply({error:String(e.message||e)},Number(e.status)||502)}
 }
 if(body.action!=="sync")return reply({error:"Unknown action"},400);
 const token=Deno.env.get("EXPLORATIONS_GITHUB_TOKEN")||"";
 if(!token)return reply({error:"Private GitHub access not configured; add EXPLORATIONS_GITHUB_TOKEN in Supabase Edge Function secrets",code:"GITHUB_TOKEN_MISSING"},503);
 try{
  let index;try{index=await file("ai-explorations/releases/index.json",token)}catch(e){if(Number(e.status)===404)return reply({status:"ok",imported:0,updated:0,skipped:0,warnings:[],repository:REPO,empty:true,message:"GitHub has not published a verified release yet"});throw e}
  if(!Array.isArray(index.releases))fail("Release index malformed");
  let imported=0,updated=0,skipped=0;const warnings=[],seen=new Set();
  for(const e of index.releases.slice(0,60)){
   try{
    if(e.status!=="ready_for_workbuddy"){skipped++;continue}
    const match=TAG.exec(String(e.tag||""));
    if(!match||match[1]!==e.issue||Number(match[2])!==Number(e.revision)){skipped++;continue}
    const id=e.issue+":"+e.revision;if(seen.has(id)){skipped++;continue}seen.add(id);
    const previously=await del.select("id").eq("user_id",user.id).eq("issue",e.issue).eq("revision",Number(e.revision)).maybeSingle();
    if(previously.error)throw previously.error;
    if(previously.data){skipped++;continue}
    const release=await api("/releases/tags/"+encodeURIComponent(e.tag),token);
    if(release.draft||release.prerelease||release.tag_name!==e.tag)fail("No verified release");
    const asset=(release.assets||[]).find(x=>x.name===e.zip_asset&&x.state==="uploaded"&&x.size>=150000);
    if(!asset)fail("Missing released ZIP");
    const {m,qa}=await zipAssets(asset,token);
    if(m.ready_for_qa!==true||m.producer!=="ChatGPT"||m.issue!==e.issue||Number(m.revision)!==Number(e.revision))fail("Incomplete ChatGPT approval");
    if(!Array.isArray(m.news)||m.news.length!==7||!Array.isArray(m.skills)||m.skills.length!==5)fail("7+5 selection incomplete");
    if(qa.machine_checks!=="passed"||qa.issue!==e.issue||Number(qa.revision)!==Number(e.revision)||!Array.isArray(qa.images)||qa.images.length!==9)fail("Nine PNG verification missing");
    if(new Set(qa.images.map(x=>Number(x.slot))).size!==9)fail("Poster slots mismatch");
    const row={user_id:user.id,issue:e.issue,revision:Number(e.revision),github_tag:e.tag,github_release_url:release.html_url,github_zip_name:e.zip_asset,github_zip_sha256:e.zip_sha256||null,source_manifest:{producer:"ChatGPT",quality:"machine_verified",editorial_review:"producer_declared"},news:news(m),skills:skills(m),posters:qa.images.map(x=>({slot:x.slot,file:x.file,width:x.width,height:x.height,sha256:x.sha256,role:x.role||""})),last_synced_at:new Date().toISOString(),github_created_at:release.published_at||release.created_at};
    const existing=await del.select("id").eq("user_id",user.id).eq("issue",e.issue).eq("revision",Number(e.revision)).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data){const rr=await del.update(Object.fromEntries(Object.entries(row).filter(([k])=>k!=="user_id"))).eq("id",existing.data.id).eq("user_id",user.id);if(rr.error)throw rr.error;updated++}
    else{const rr=await del.insert({...row,status:"studio_published",wechat_status:"not_verified"});if(rr.error)throw rr.error;imported++}
   }catch(err){warnings.push(String(e.tag||e.issue)+": "+String(err.message||err).slice(0,110))}
  }
  return reply({status:"ok",imported,updated,skipped,warnings,repository:REPO});
 }catch(err){return reply({error:String(err.message||err),code:"SYNC_FAILED"},Number(err.status)||502)}
});