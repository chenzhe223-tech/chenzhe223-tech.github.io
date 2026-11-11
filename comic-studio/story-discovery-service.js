/* WORLD/TOON · Source-grounded drama / novel discovery endpoint.
 * Injected into the existing Cloudflare Worker after source verification.
 * This module searches only public metadata, never copies complete protected story text.
 */
const WT_STORY_SEARCH_ALLOWED=['all','drama','novel'];
const wtStoryClean=v=>String(v??'').replace(/<[^>]{0,500}>/g,' ').replace(/&(?:amp|nbsp);/gi,' ').replace(/\s+/g,' ').trim();
const wtStoryUrl=v=>{try{const u=new URL(String(v||''));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
async function wtStoryCurated(){
 const r=await fetch(ORIGIN+'story-discovery.json',{signal:AbortSignal.timeout(8500)});
 if(!r.ok)throw Error('剧情资源索引不可用 HTTP '+r.status);
 const s=await r.text();if(s.length>100000)throw Error('剧情索引文件异常');
 const x=JSON.parse(s);
 if(x.schema!=='davylab.worldtoon.story-discovery.v1'||!Array.isArray(x.items))throw Error('剧情索引版本不兼容');
 return {at:x.verified_on,items:x.items.filter(v=>v?.title&&wtStoryUrl(v.source)).slice(0,50)};
}
async function wtStoryBooks(q){
 const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('intitle:'+q)+'&maxResults=8&printType=books';
 const r=await fetch(url,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Google Books HTTP '+r.status);
 const j=await r.json();
 return (j.items||[]).slice(0,8).map(x=>{
  const v=x.volumeInfo||{},title=wtStoryClean(v.title||'').slice(0,150),
    source=wtStoryUrl(v.canonicalVolumeLink||v.infoLink);
  if(!title||!source)return null;
  return {id:'books-'+String(x.id||'').slice(0,70),title,type:'novel',author:wtStoryClean((v.authors||[]).join('、')).slice(0,180),
   source,source_name:'Google Books · 图书元数据',source_kind:'book_metadata',
   summary:wtStoryClean(v.description||'').slice(0,750),
   rights:'unknown',rights_note:'检索到书目不等于获得改编许可，请核对原著版权和发行地区。',
   beats:[],verified_on:new Date().toISOString().slice(0,10)};
 }).filter(Boolean);
}
async function wtStoryPublicBooks(q){
 const u='https://gutendex.com/books/?search='+encodeURIComponent(q);
 const r=await fetch(u,{signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Gutendex HTTP '+r.status);
 const j=await r.json();
 return (j.results||[]).slice(0,6).map(v=>({
  id:'gutendex-'+v.id,title:wtStoryClean(v.title).slice(0,150),type:'classic',
  author:wtStoryClean((v.authors||[]).map(x=>x.name).join('、')).slice(0,180),
  source:'https://www.gutenberg.org/ebooks/'+v.id,source_name:'Project Gutenberg · 开放图书目录',
  source_kind:'public_domain_catalog',summary:'目录检索到此经典书籍；尚未自动读取原著分章节正文。请查看原文后选择剧情。',
  rights:'public_domain_us',rights_note:'仅为美国公版目录候选，需另行核对实际使用地区及具体版本的权利。',
  beats:[],verified_on:new Date().toISOString().slice(0,10)
 }));
}
async function wtStoryDramaSearch(q){
 // Search live Google News RSS for independently attributable title leads.
 // Search results are not treated as episodes or official Hongguo viewing metrics.
 const qq=q?('"'+q+'" 红果短剧 剧情'):('红果短剧 热播榜 新剧');
 const endpoint='https://news.google.com/rss/search?q='+encodeURIComponent(qq)+'&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';
 const r=await fetch(endpoint,{signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Google News RSS HTTP '+r.status);
 const rss=await r.text();
 if(rss.length>1700000||!rss.includes('<rss'))throw Error('新闻检索格式异常');
 return parseRSS(rss,'娱乐').slice(0,12).map((x,i)=>({
   id:'news-'+i+'-'+(x.published||'').slice(0,20),title:wtStoryClean(x.title).slice(0,165),
   type:'drama',source:wtStoryUrl(x.url),source_name:wtStoryClean(x.source||'Google News 来源').slice(0,100),
   source_kind:'web_search_lead',rights:'unknown',rights_note:'网络检索线索不是剧集本身，未验证完整剧情或改编权。',
   summary:'搜索引擎发现的公开报道线索；请点开原文核对。此卡不提供未核实的分集情节。',
   beats:[],published:x.published||'',verified_on:new Date().toISOString().slice(0,10)
 })).filter(x=>x.source&&x.title);
}
async function wtStorySearch(request,env,url){
 const type=url.searchParams.get('type')||'all',q=String(url.searchParams.get('q')||'').trim().slice(0,90);
 if(!WT_STORY_SEARCH_ALLOWED.includes(type))return failure('未知剧情搜索类型',400);
 if(q&&q.length<2)return failure('至少输入两个字符才能搜索',400);
 const notes=[],merged=[];let curated;
 try{curated=await wtStoryCurated();const key=q.toLowerCase().replace(/[\s·・]/g,'');
  for(const v of curated.items){
   if(type==='drama'&&v.type!=='drama')continue;
   if(type==='novel'&&v.type==='drama')continue;
   if(q&&!([v.title,...(v.aliases||[])].some(s=>String(s||'').toLowerCase().replace(/[\s·・]/g,'').includes(key))))continue;
   merged.push({...v,source_status:'editorial_reviewed',snapshot_date:curated.at});
  }
 }catch(e){notes.push('精选索引不可用：'+String(e.message||e).slice(0,85))}
 const jobs=[];
 if(q&&type!=='drama'){
  jobs.push({name:'Google Books',fn:()=>wtStoryBooks(q)});
  jobs.push({name:'Gutendex',fn:()=>wtStoryPublicBooks(q)});
 }
 if(type!=='novel')jobs.push({name:'Google News RSS',fn:()=>wtStoryDramaSearch(q)});
 const results=await Promise.allSettled(jobs.map(x=>x.fn()));
 for(let i=0;i<results.length;i++){
  const res=results[i];if(res.status==='fulfilled')merged.push(...res.value);
  else notes.push(jobs[i].name+' 暂不可用：'+String(res.reason?.message||res.reason).slice(0,90));
 }
 const clean=[],seen=new Set();
 for(const item of merged){
  const title=wtStoryClean(item.title).slice(0,160),source=wtStoryUrl(item.source);
  if(!title||!source)continue;
  const key=title.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').slice(0,120);
  if(seen.has(key))continue;
  seen.add(key);clean.push({...item,title,source});
 }
 // No fake fallback plot or rankings. Fail honestly on total outages, but keep verified curated matches.
 if(!clean.length&&notes.length)return Response.json({items:[],warnings:notes,error:'暂未找到匹配来源；可更换关键词或稍后重试',searched_at:new Date().toISOString()},{headers:{...RESULT_HEADERS,'cache-control':'public,max-age=120'}});
 return Response.json({schema:'davylab.worldtoon.story-search.v1',items:clean.slice(0,35),query:q,type,warnings:notes,
  searched_at:new Date().toISOString(),source_policy:'公共书目/报道线索和人工核对索引；非原著全文、非红果官方榜单、不代表改编授权',
  model_generated:false},{headers:{...RESULT_HEADERS,'cache-control':'public,max-age=180,stale-while-revalidate=300'}});
}
