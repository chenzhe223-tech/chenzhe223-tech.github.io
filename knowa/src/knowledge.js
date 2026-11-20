import { discoveryItems } from './discover.js';

// Read-only seed assets: preserve original source URLs and do not invent editorial approval.
export const KNOWLEDGE_VERSION='2.0-p0-20261120';
export const knowledgeEntries=discoveryItems.map(row=>Object.freeze({
 id:row.id,title:row.question,category:row.category,summary:row.answer,
 evidence:[{provider:row.provider,url:row.url,kind:'external-reference'}],
 reviewStatus:'source-review-pending',revision:KNOWLEDGE_VERSION,
 reviewedAt:null, updatedAt:null
}));
const clean=value=>String(value??'').trim().toLocaleLowerCase('zh-CN').replace(/\s+/g,'');
export const findKnowledge=id=>knowledgeEntries.find(x=>x.id===id)||null;
export const knowledgeCategories=()=>[...new Set(knowledgeEntries.map(x=>x.category))].map(name=>({name,count:knowledgeEntries.filter(x=>x.category===name).length}));
const publicEntry=x=>({id:x.id,title:x.title,category:x.category,summary:x.summary,reviewStatus:x.reviewStatus,revision:x.revision,reviewedAt:x.reviewedAt,updatedAt:x.updatedAt,evidence:x.evidence.map(e=>({...e}))});
export function searchKnowledge({q='',category='',limit=36}={}){
 const term=clean(q).slice(0,100);
 const cat=knowledgeCategories().some(x=>x.name===category)?category:'';
 const max=Number(limit);
 const cap=Number.isSafeInteger(max)?Math.max(1,Math.min(50,max)):36;
 const items=knowledgeEntries.filter(x=>(!cat||x.category===cat)&&(!term||clean(x.title+' '+x.summary+' '+x.category+' '+x.evidence.map(e=>e.provider).join(' ')).includes(term)));
 return {total:items.length,query:term,category:cat,revision:KNOWLEDGE_VERSION,entries:items.slice(0,cap).map(publicEntry)};
}
