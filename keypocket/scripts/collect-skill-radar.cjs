'use strict';
const GH_API='https://api.github.com';
const GH_HEADERS={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'KeyPocket-Skill-Radar-Collector'};
const QUERIES=['skill in:name,description','agentskills in:name,description','claude skill in:name,description','codex skill in:name,description','mcp skill in:name,description'];
const BLOCKED_NAME=/(^awesome-|tutorial|course|roadmap|learning-path|interview-questions|cheatsheet)/i;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function requireEnv(name){const value=process.env[name];if(!value)throw new Error('Missing required environment variable: '+name);return value;}
async function fetchJson(url,headers=GH_HEADERS,attempt=0){
 const response=await fetch(url,{headers});
 if((response.status===403||response.status===429)&&attempt<2){
  const remaining=response.headers.get('x-ratelimit-remaining'),reset=Number(response.headers.get('x-ratelimit-reset'))*1000;
  const wait=remaining==='0'&&reset>0?Math.min(90000,Math.max(1000,reset-Date.now()+1000)):15000;
  console.warn('GitHub API rate limited; waiting '+wait+' ms');await sleep(wait);return fetchJson(url,headers,attempt+1);
 }
 if(!response.ok)throw new Error('GitHub API '+response.status+' for '+url+': '+(await response.text()).slice(0,400));
 return response.json();
}
async function readmeScore(repo,token){
 const url='https://raw.githubusercontent.com/'+repo.full_name+'/'+encodeURIComponent(repo.default_branch||'main')+'/README.md';
 try{
  const response=await fetch(url,{headers:{Authorization:'Bearer '+token,'User-Agent':GH_HEADERS['User-Agent']}});
  if(!response.ok)return 0;
  const s=(await response.text()).slice(0,250000).toLowerCase();let score=0;
  if(/(^|\n)#{1,3}\s*(skill|skills|agent skill)/m.test(s))score+=22;
  if(/(^|\n)[^\n]*\bskill\.md\b/m.test(s)||/\/skills\//.test(s))score+=25;
  if(s.includes('agentskills.io')||s.includes('agent skills'))score+=22;
  if(s.includes('claude code')||s.includes('anthropic'))score+=10;
  if(s.includes('openai codex')||s.includes('codex cli'))score+=10;
  if(s.includes('model context protocol')||/\bmcp\b/.test(s))score+=8;
  if(/install|usage|configuration|requirements/.test(s))score+=3;
  return Math.min(100,score);
 }catch{return 0;}
}
function initialRelevance(repo){
 const name=(repo.name||'').toLowerCase(),desc=(repo.description||'').toLowerCase(),topics=(repo.topics||[]).map(x=>String(x).toLowerCase());let score=0;
 if(name.includes('skill'))score+=30;if(desc.includes('skill'))score+=20;
 if(topics.some(x=>['skill','agent-skill','agent-skills','claude-skill','codex-skill'].includes(x)))score+=24;
 if(topics.some(x=>['mcp','ai-agent','agent','llm'].includes(x)))score+=10;
 if(/claude|codex|mcp|agent/.test(name+' '+desc))score+=12;return Math.min(100,score);
}
function relevant(repo,readme){
 if(repo.private||repo.archived||repo.fork||repo.disabled||BLOCKED_NAME.test(repo.name||''))return false;
 const text=((repo.name||'')+' '+(repo.description||'')+' '+(repo.topics||[]).join(' ')).toLowerCase();
 return /skill|agent|mcp|codex|claude|prompt/.test(text)&&(readme>=15||initialRelevance(repo)>=35);
}
async function githubSearch(query,token){
 const data=await fetchJson(GH_API+'/search/repositories?q='+encodeURIComponent(query)+'&sort=stars&order=desc&per_page=100',{...GH_HEADERS,Authorization:'Bearer '+token});
 return data.items||[];
}
async function mapLimit(items,limit,fn){
 const output=new Array(items.length);let next=0;
 async function worker(){while(true){const i=next++;if(i>=items.length)return;output[i]=await fn(items[i],i);}}
 await Promise.all(Array.from({length:limit},worker));return output;
}
async function supabaseUpsert(base,key,table,rows,conflict){
 for(let offset=0;offset<rows.length;offset+=100){
  const response=await fetch(base+'/rest/v1/'+table+'?on_conflict='+encodeURIComponent(conflict),{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify(rows.slice(offset,offset+100))
  });
  if(!response.ok)throw new Error('Supabase '+table+' upsert failed ('+response.status+'): '+(await response.text()).slice(0,1000));
 }
}
async function main(){
 const githubToken=requireEnv('GITHUB_TOKEN'),supabaseUrl=requireEnv('SUPABASE_URL').replace(/\/$/,''),serviceKey=requireEnv('SUPABASE_SERVICE_ROLE_KEY');
 const found=new Map();
 for(const query of QUERIES){
  for(const repo of await githubSearch(query,githubToken))if(repo&&!repo.private&&!repo.archived&&!repo.fork&&repo.full_name&&Number.isSafeInteger(repo.id))found.set(repo.id,repo);
  await sleep(350);
 }
 const candidates=[...found.values()].sort((a,b)=>initialRelevance(b)-initialRelevance(a)||(b.stargazers_count||0)-(a.stargazers_count||0)).slice(0,220);
 console.log('Unique public repository candidates: '+candidates.length);
 const scored=await mapLimit(candidates,10,async repo=>({repo,readme:await readmeScore(repo,githubToken)}));
 const accepted=scored.filter(x=>relevant(x.repo,x.readme)).sort((a,b)=>b.readme-a.readme||(b.repo.stargazers_count||0)-(a.repo.stargazers_count||0)).slice(0,200);
 if(!accepted.length)throw new Error('No relevant public repositories passed the Skill filters; preserving the last valid leaderboard.');
 const sampledAt=new Date(),sampledOn=sampledAt.toISOString().slice(0,10);
 const repos=accepted.map(({repo,readme})=>({
  id:repo.id,full_name:repo.full_name,owner:repo.owner?.login||repo.full_name.split('/')[0],repo_name:repo.name,
  description:repo.description||null,html_url:repo.html_url,stars:Number(repo.stargazers_count)||0,forks:Number(repo.forks_count)||0,
  language:repo.language||null,topics:Array.isArray(repo.topics)?repo.topics:[],pushed_at:repo.pushed_at||null,updated_at:repo.updated_at||null,
  archived:!!repo.archived,fork:!!repo.fork,default_branch:repo.default_branch||'main',readme_relevance:readme,sampled_at:sampledAt.toISOString()
 }));
 const snapshots=accepted.map(({repo})=>({
  repo_id:repo.id,sampled_on:sampledOn,stars:Number(repo.stargazers_count)||0,forks:Number(repo.forks_count)||0,
  open_issues:Number(repo.open_issues_count)||0,pushed_at:repo.pushed_at||null,sampled_at:sampledAt.toISOString()
 }));
 await supabaseUpsert(supabaseUrl,serviceKey,'keypocket_skill_repos',repos,'id');
 await supabaseUpsert(supabaseUrl,serviceKey,'keypocket_skill_snapshots',snapshots,'repo_id,sampled_on');
 console.log(JSON.stringify({sampledOn,candidates:candidates.length,accepted:repos.length,snapshots:snapshots.length,top:repos.slice(0,10).map(x=>({repo:x.full_name,stars:x.stars,readme_relevance:x.readme_relevance}))},null,2));
}
main().catch(error=>{console.error(error.stack||error.message||error);process.exitCode=1;});
