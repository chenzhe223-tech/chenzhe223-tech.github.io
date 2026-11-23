/* DAVYLAB Science Search V2: deterministic, offline fuzzy/Chinese-to-English matching.
   Keyword mapping aids discovery only; it is not machine translation or semantic fact-checking.
   UMD for browser and Node regression tests. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.DAVYLABScienceSearch=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const CONCEPTS=Object.freeze([
 ["纳米塑料","nanoplastic",["nanoplastic","nanoplastics"]],
 ["微塑料","microplastic",["microplastic","microplastics"]],
 ["塑料污染","plastic pollution",["plastic","pollution"]],
 ["塑料","plastic",["plastic","polymer"]],
 ["肝脏","liver",["liver","hepatic"]],
 ["免疫细胞","macrophage",["macrophage","immune cell"]],
 ["免疫","immune",["immune","immunity","immunology"]],
 ["癌症","cancer",["cancer","tumor","tumour","oncology"]],
 ["肿瘤","tumor",["tumor","tumour","cancer"]],
 ["脑科学","neuroscience",["brain","neural","neuron"]],
 ["神经","neural",["neural","neurons","nervous"]],
 ["阿尔茨海默","alzheimer",["alzheimer","dementia"]],
 ["人工智能","artificial intelligence",["artificial intelligence","machine learning","AI"]],
 ["大模型","large language model",["large language model","language model","LLM"]],
 ["机器学习","machine learning",["machine learning","deep learning"]],
 ["机器人","robot",["robot","robotics"]],
 ["气候变化","climate change",["climate","warming"]],
 ["碳排放","carbon emissions",["carbon","emissions"]],
 ["全球变暖","global warming",["global warming","climate"]],
 ["能源","energy",["energy","power"]],
 ["电池","battery",["battery","batteries"]],
 ["太阳能","solar",["solar","photovoltaic"]],
 ["量子","quantum",["quantum"]],
 ["宇宙","cosmos",["universe","cosmic","galaxy"]],
 ["天文","astronomy",["astronomy","astrophysics"]],
 ["生物多样性","biodiversity",["biodiversity","ecosystems"]],
 ["蛋白质","protein",["protein","proteins"]],
 ["基因","gene",["gene","genome","genetic"]],
 ["病毒","virus",["virus","viral"]],
 ["抗生素","antibiotic",["antibiotic","antimicrobial"]],
 ["糖尿病","diabetes",["diabetes","diabetic"]],
 ["肥胖","obesity",["obesity","obese"]],
 ["心脏","heart",["heart","cardiac","cardiovascular"]],
 ["衰老","aging",["aging","ageing","senescence"]],
 ["儿童","children",["child","children","pediatric"]],
 ["海洋","ocean",["ocean","marine","sea"]],
 ["微生物","microbe",["microbe","microbial","bacteria"]],
 ["环境","environment",["environment","ecology"]]
]);
const norm=s=>String(s??"").normalize("NFKC").toLowerCase().replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}./-]+/gu," ").trim().replace(/\s+/g," ");
function translate(raw){
 let q=String(raw??"").normalize("NFKC").trim();
 if(!q)return {query:"",translated:"",tokens:[],aliases:[],unknownChinese:false};
 const aliases=[],replacements=[];
 for(const [ch,en,syn] of CONCEPTS){
  if(q.includes(ch)){q=q.split(ch).join(" "+en+" ");replacements.push(ch);aliases.push(...syn);}
 }
 const unknownChinese=/[\u3400-\u9fff]/u.test(q);
 const translated=norm(q);
 const tokens=translated.split(/\s+/).filter(t=>t.length>1);
 return {query:norm(raw),translated,tokens,aliases:[...new Set(aliases.map(norm))],unknownChinese,replacements};
}
function editDistance(a,b,max=1){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(a[i-1]!==b[j-1]?1:0));
  row=next;
  if(Math.min(...row)>max)return max+1;
 }
 return row[b.length];
}
function matchScore(record,input){
 const info=typeof input==="string"?translate(input):input;
 if(!info?.query)return 1;
 const hay=norm([record.title,record.summary,record.authors,record.doi].filter(Boolean).join(" "));
 const full=info.translated;
 if(!full)return 0;
 if(hay.includes(info.query))return 120;
 if(hay.includes(full))return 105;
 if(info.tokens.length){
  const words=hay.split(/\s+/);
  const found=info.tokens.map(t=>hay.includes(t)||words.some(w=>w.startsWith(t)||t.length>=5&&editDistance(t,w,t.length>9?2:1)<=(t.length>9?2:1)));
  if(found.every(Boolean))return 80;
  if(found.filter(Boolean).length>=2&&found.length>=3)return 35;
  if(found.length===1&&found[0])return 70;
 }
 // Do not let one translated synonym satisfy a multi-topic (AND) query.
 if(info.tokens.length>1)return 0;
 if(info.aliases.some(t=>t.length>3&&hay.includes(t)))return 25;
 return 0;
}
function onlineTerm(query){
 const info=translate(query);
 if(info.unknownChinese)return "";
 return info.translated.slice(0,160);
}
return Object.freeze({VERSION:"2.0.0",translate,matchScore,onlineTerm,normalize:norm});
});
