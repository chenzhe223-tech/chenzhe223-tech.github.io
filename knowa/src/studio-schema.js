// KNOWA 2.0 knowledge authoring schema. A local user check is not editorial verification.
export const STUDIO_SCHEMA = 'knowa-knowledge-draft-v1';
export function validateStudioDraft(d) {
 const errors=[];
 if(!d || typeof d!=='object' || Array.isArray(d))return {valid:false,errors:['草稿格式不正确']};
 if(typeof d.title!=='string'||d.title.trim().length<4||d.title.trim().length>90)errors.push('标题须为4至90字');
 const allowed=['自然地理','宇宙科学','生物世界','历史人文','科学发现','生活常识'];
 if(!allowed.includes(d.category))errors.push('请选择已有知识领域');
 if(typeof d.body!=='string'||d.body.trim().length<30||d.body.trim().length>4500)errors.push('科普解释须为30至4500字');
 if(typeof d.provider!=='string'||d.provider.trim().length<2||d.provider.trim().length>100)errors.push('请填写来源机构');
 try{const url=new URL(d.sourceUrl);if(url.protocol!=='https:')errors.push('来源仅允许 HTTPS 网址')}catch{errors.push('来源网址无效')}
 if(typeof d.scope==='string'&&d.scope.length>500)errors.push('口径说明最多500字');
 if(typeof d.changeReason==='string'&&d.changeReason.length>240)errors.push('修订说明最多240字');
 return {valid:errors.length===0,errors};
}
export function makeStudioExport(d) {
 const check=validateStudioDraft(d);
 if(!check.valid) return {ok:false,errors:check.errors};
 const src=new URL(d.sourceUrl).href;
 const now=new Date().toISOString();
 return {ok:true,package:{
  schema:'knowa-knowledge-draft-v1',id:String(d.id||'').slice(0,100),
  title:d.title.trim(),category:d.category,body:d.body.trim(),scope:String(d.scope||'').slice(0,500),
  evidence:[{provider:d.provider.trim(),url:src,note:String(d.sourceNote||'').slice(0,400)}],
  reviewStatus:'source-review-pending',selfCheck:d.selfCheck===true,
  disclaimer:'本文件为个人编辑草稿；自查不代表平台或第三方已完成事实审校。',
  revision:Number.isSafeInteger(d.revision)?d.revision:0,
  createdAt:typeof d.createdAt==='string'?d.createdAt:now,exportedAt:now,
  changeReason:String(d.changeReason||'').slice(0,240)
 }};
}
