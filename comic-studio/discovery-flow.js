/* Source-aware vocabulary and display states for the WORLD/TOON discovery desk. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WTDiscoveryFlow=api})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const categories=[
  {id:'all',label:'综合检索',contentKind:'mixed',destination:'single_story'},
  {id:'drama',label:'短剧与网剧题名线索',contentKind:'drama_metadata',destination:'single_story'},
  {id:'novel',label:'小说与文学目录',contentKind:'book_metadata',destination:'single_story'},
  {id:'news',label:'全球新闻',contentKind:'news',destination:'single_story'},
  {id:'literary_series',label:'公版文学与系列灵感',contentKind:'literature',destination:'series_planner'},
  {id:'nobel_literature',label:'诺奖作品索引',contentKind:'literature',destination:'series_planner'},
  {id:'academic_events',label:'学术议题',contentKind:'academic',destination:'single_story'},
  {id:'history',label:'历史题材',contentKind:'history',destination:'single_story'},
  {id:'arxiv',label:'AI 与科技议题',contentKind:'research',destination:'single_story'}
 ];
 function card(item={}){
  const rank=Number.isFinite(Number(item.rank_snapshot))&&item.rank_snapshot!==null&&item.rank_snapshot!=='';
  const id=String(item.identity_status||''),kind=String(item.source_kind||'');
  const identityLabel=id==='title_mentioned_in_source'?'来源提及该题名 · 上架身份待核对':id==='book_title_match'?'书目题名命中 · 不是剧情章节':id==='curated_title_match'?'精选索引题名命中 · '+String(item.verified_on||item.snapshot_date||'日期待核'):'作品身份待核对';
  const def=categories.find(x=>x.id===item.source_id)||categories.find(x=>x.id===(item.type==='drama'?'drama':'novel'))||categories[0];
  return {title:String(item.title||''),summary:String(item.summary||'仅检索到公开来源线索，请查看原文并核对题名。'),sourceName:String(item.source_name||'公开资料'),sourceUrl:/^https:\/\//i.test(String(item.source||''))?String(item.source):'',publishedDate:String(item.published||item.source_date||'').slice(0,10),identityLabel,heatLabel:rank?'第三方榜单记录（非红果官方数据）':'未核实热度',heatEvidenceDate:rank?String(item.verified_on||item.snapshot_date||'日期待核'):'',rightsLabel:item.rights==='public_domain_us'?'公版候选（按地区核对）':'版权待核实',rightsNote:String(item.rights_note||'请核对作品身份、原作版本和改编权限。'),contentKind:kind||def.contentKind,storyDestination:Array.isArray(item.series_episodes)&&item.series_episodes.length>=3?'series_planner':def.destination};
 }
 function errorState(kind){if(kind==='empty')return {title:'没有匹配结果',message:'试试作品原名、作者名或不同分类；空结果不会用虚构剧情补齐。'};if(kind==='timeout')return {title:'搜索超时',message:'当前来源未能及时返回，请稍后重试或换一个关键词。'};return {title:'来源暂不可用',message:'检索服务失败或部分来源离线；页面会明确显示失败，不把缓存或推测当成实时结果。'}}
 return {categories,card,errorState};
});
