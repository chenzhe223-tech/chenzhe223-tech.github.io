'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
const library=JSON.parse(read('story-discovery.json'));
assert.equal(library.schema,'davylab.worldtoon.story-discovery.v1');
const jane=library.items.find(x=>x.id==='novel-jane-eyre-1847');
const wild=library.items.find(x=>x.id==='drama-ta-guo-fen-ye-2025');
assert.equal(jane.beats.length,6,'public-domain Jane Eyre must expose sourced story arcs');
assert.equal(wild.beats.length,4,'copyrighted He Guo Fen Ye must expose only supported public synopsis arcs');
assert.equal(wild.rights,'copyrighted');
assert.equal(library.items.filter(x=>x.rank_snapshot).length,10,'ten dated Hongguo third-party hot leads');
for(const x of library.items){assert.ok(x.source.startsWith('https://'));assert.ok(x.rights_note)}
const service=read('story-discovery-service.js'),uiCode=read('story-discovery-ui.js'),bundle=read('extension.js');
for(const [name,src] of [['service',service],['ui',uiCode],['bundle',bundle]])assert.doesNotThrow(()=>new vm.Script(src),name+' must parse');
assert.ok(bundle.trimEnd().endsWith(uiCode.trim()),'runtime extension must embed updated story UI');
assert.match(read('index.html'),/extension\.js\?v=4\.3\.0/,'browser must use fresh script');
assert.match(read('styles.css'),/\.story-discovery/,'mobile and desktop styles are served');
const worker=read('worker.js');
assert.ok(worker.includes(service.trim()),'deployed Worker must contain the canonical story search service');
assert.match(worker,/url\.pathname==='\/api\/comic\/story-search'&&request\.method==='GET'.*wtStorySearch/,'Worker must route live story searches');
assert.match(worker,/storySearch:true/,'health endpoint must advertise story search');
assert.ok(read('styles.css').trimEnd().endsWith(read('mobile-refine.css').trim()),'responsive styles must remain bundled in Worker-allowed CSS');
const waits={timeout:()=>({})};
let newsRows=[],newsSearchCalls=0;
const fetcher=async raw=>{
 const url=String(raw);
 if(url.endsWith('story-discovery.json'))return {ok:true,text:async()=>JSON.stringify(library)};
 if(url.includes('googleapis.com/books'))return {ok:true,json:async()=>({items:[{
  id:'testbook',volumeInfo:{title:'海边的故事',description:'一位年轻人回到远方海岸，决定直面家族与自己的过去。他在旅途中与伙伴相识，并尝试重建信任关系。',infoLink:'https://books.google.com/books?id=testbook'}
 }]})};
 if(url.includes('gutendex.com'))return {ok:true,json:async()=>({results:[]})};
 if(url.includes('news.google.com')){newsSearchCalls++;return {ok:true,text:async()=>'<rss><channel></channel></rss>'};}
 if(url.includes('/api/comic/story-search')){
  const res=await api.fetch({}, {},new URL(url,'https://site.example'));
  return {ok:res.status<400,json:async()=>res.body};
 }
 throw Error('unexpected mock fetch '+url);
};
const apiCtx={ORIGIN:'https://example.org/',RESULT_HEADERS:{},
 failure:(error,status=400)=>({status,body:{error}}),
 Response:{json:(body,opt)=>({status:opt?.status||200,body})},
 AbortSignal:waits,fetch:fetcher,parseRSS:()=>newsRows,URL};
vm.createContext(apiCtx);
vm.runInContext(service+'\nthis.__api=wtStorySearch;',apiCtx);
const api={fetch:apiCtx.__api};
const find=async(type,q)=>{
 const endpoint='https://site.example/api/comic/story-search?type='+type+(q?'&q='+encodeURIComponent(q):'');
 const res=await api.fetch({}, {},new URL(endpoint));
 assert.equal(res.status,200);
 assert.ok(Array.isArray(res.body.items));
 return res.body.items;
};
(async()=>{
 const dr=await find('drama','《他过分野》');
 assert.ok(dr.some(x=>x.title==='他过分野'&&x.beats.length===4));
 const j=await find('novel','简爱');
 assert.ok(j.some(x=>x.title==='简·爱'&&x.beats.length===6));
 const searchesBeforeHot=newsSearchCalls;
 const hot=await find('drama','');
 assert.equal(hot.filter(x=>x.rank_snapshot).length,10,'ten verified third-party hot snapshot titles');
 assert.equal(hot[0].rank_snapshot,1,'hot list sorted by its explicit dated ranking');
 assert.equal(newsSearchCalls,searchesBeforeHot,'unscoped live news must not masquerade as named hot dramas');
 newsRows=[
  {title:'红果短剧《他过分野》上线报道',source:'媒体 A',url:'https://news.example/item/1',published:'2026-11-11'},
  {title:'红果短剧行业趋势观察',source:'媒体 B',url:'https://news.example/item/2',published:'2026-11-11'}
 ];
 const named=await find('drama','他过分野');
 const namedLead=named.find(x=>x.source_kind==='web_search_lead');
 assert.ok(namedLead,'named search should retain the matching attributable article');
 assert.equal(namedLead.identity_status,'title_mentioned_in_source');
 assert.equal(namedLead.verification_status,'source_lead_unverified');
 assert.ok(!named.some(x=>x.title==='红果短剧行业趋势观察'),'unrelated search results must not appear as the selected work');
 assert.equal(newsSearchCalls,searchesBeforeHot+1);
 const book=await find('novel','海边的故事');
 assert.ok(book.some(x=>x.source_kind==='book_metadata'));
 const listeners={},projects=[],routes=[];
 const els={'#story-rights-url':{value:''},'#story-rights-consent':{checked:false},'#story-selected-count':{textContent:''}};
 const browserCtx={
  window:{},document:{addEventListener(t,fn){(listeners[t]||(listeners[t]=[])).push(fn)},
    querySelector:t=>els[t]||null},wtLive:()=>'<p>existing discovery catalog</p>',
  render(){},notify(){},persist(){},nav:r=>routes.push(r),
  data:{projects},ui:{route:'live'},emptyProject:()=>({id:'proj-'+(projects.length+1),panels:[],handoff:{}}),
  makePanel:i=>({id:i,title:'',scene:'',image:''}),now:()=>new Date().toISOString(),
  e:v=>String(v??'').replace(/&/g,'&amp;'),
  fetch:fetcher,AbortController:class{constructor(){this.signal={}}abort(){}},
  setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},URL
 };
 vm.createContext(browserCtx);vm.runInContext(uiCode,browserCtx);
 const ux=browserCtx.window.WTStoryDiscovery;
 assert.match(browserCtx.wtLive(),/红果热剧/);
 assert.match(browserCtx.wtLive(),/existing discovery catalog/);
 await ux.search('简爱','novel',true);let s=ux.state();
 ux.choose(s.items.findIndex(x=>x.title==='简·爱'));s=ux.state();
 assert.equal(ux.beatOptions(s.selected).length,6);
 assert.equal(s.mode,'faithful');
 for(const fn of listeners.change||[])fn({target:{dataset:{storyBeat:'jane-1'},checked:true}});
 ux.createProjectFromStory();
 assert.equal(projects[0].storySourceSelection.selected_beats[0].id,'jane-1');
 assert.equal(projects[0].storySourceSelection.rights,'public_domain_us');
 assert.equal(routes[0],'workspace/'+projects[0].id+'/1');
 await ux.search('他过分野','drama',true);s=ux.state();
 ux.choose(s.items.findIndex(x=>x.title==='他过分野'));
 assert.equal(ux.state().mode,'original','protected stories must default to independent original');
 for(const fn of listeners.change||[])fn({target:{dataset:{storyBeat:'wild-1'},checked:true}});
 ux.createProjectFromStory();
 assert.equal(projects[0].storySourceSelection.adaptation,'original');
 assert.match(projects[0].ideaSeed,/独立原创/);
 const a=read('app.js'),from=a.indexOf('function wfCanTask('),to=a.indexOf('function wfTaskObject(');
 const rightsContext={wtDirector:{readiness:()=>[]}};vm.createContext(rightsContext);
 vm.runInContext(a.slice(from,to)+'this.__gate=wfCanTask;',rightsContext);
 const mock={title:'待授权作品',storySourceSelection:{rights:'copyrighted',adaptation:'faithful',license_url:'',license_attested:false}};
 assert.ok(rightsContext.__gate(mock).some(x=>x.includes('改编授权')),'unlicensed faithful adaptation must not dispatch');
 mock.storySourceSelection.license_url='https://example.com/authorized/license';
 mock.storySourceSelection.license_attested=true;
 assert.equal(rightsContext.__gate(mock).length,0,'rights evidence only clears this gate, not QA or final author approval');
 console.log('WORLD/TOON STORY SEARCH PASS: sourced title match, dates, no invented hot results, UI handoff and copyright gates');
})().catch(e=>{console.error(e);process.exitCode=1});

