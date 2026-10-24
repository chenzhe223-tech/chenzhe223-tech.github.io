/**
 * MelodyMe server-side DeepSeek adapter for Cloudflare Workers.
 * Required secret: DEEPSEEK_API_KEY
 * Optional vars: ALLOWED_ORIGIN (exact production origin), DEEPSEEK_MODEL
 * Never deploy without a rate-limit rule at the edge.
 */
const MAX_BODY_BYTES = 12000;
const ACTIONS = new Set(["analyzeMemory","inferMusicCandidates","compareTrackVersions","generateMemoryStory","generateSocialCopy","planPosterComposition"]);
const SYSTEM = `You are MelodyMe, a careful music-memory creative assistant. Return only valid JSON matching the requested task. Never invent verified music facts, album covers, release years, or URLs. Separate AI hypotheses from catalog-verified facts. Do not claim the user experienced events not present in their story. Keep user-facing explanations concise.`;
const schemas = {
 analyzeMemory: {people_clues:[],life_stage:"unknown",age_clues:[],time_clues:[],location_clues:[],relationship_clues:[],emotion_clues:[],music_keywords:[],genre_clues:[],era_candidates:[],narrative_direction:"",missing_information:[],confidence:"low|medium|high",reasoning_summary:""},
 inferMusicCandidates: {candidates:[{title:"",artist:"",version_type:"unknown",album:"",album_year:null,track_year:null,search_query:"",status:"ai_inferred",reason_summary:""}],missing_information:[]},
 compareTrackVersions: {comparisons:[{candidate_id:"",reason_summary:"",era_fit:"low|medium|high",evidence_needed:[]}],recommendation:""},
 generateMemoryStory: {title:"",story:"",core_line:"",memory_summary:"",poster_title:"",poster_subtitle:"",song_connection:""},
 generateSocialCopy: {copy:""},
 planPosterComposition: {recommended_style:"",palette:[],composition:"",typography:"",image_treatment:"",text_density:"",visual_motifs:[],reason_summary:""}
};
function json(data,status,origin,allowed){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":origin||allowed,"vary":"Origin"}})}
function boundedString(v,min=1,max=8000){return typeof v==="string"&&v.trim().length>=min&&v.length<=max}
function validOutput(action,result){
 if(!result||typeof result!=="object"||Array.isArray(result))return false;
 const has=(key)=>Object.prototype.hasOwnProperty.call(result,key);
 const arr=(key,max=30)=>Array.isArray(result[key])&&result[key].length<=max;
 switch(action){
  case "analyzeMemory": return ["people_clues","age_clues","time_clues","location_clues","relationship_clues","emotion_clues","music_keywords","genre_clues","era_candidates","missing_information"].every(k=>arr(k))&&boundedString(result.life_stage,1,100)&&["low","medium","high"].includes(result.confidence)&&boundedString(result.narrative_direction,1,1000)&&boundedString(result.reasoning_summary,1,1000);
  case "inferMusicCandidates": return arr("candidates",8)&&result.candidates.length>0&&result.candidates.every(c=>c&&boundedString(c.title,1,200)&&boundedString(c.artist,1,200)&&boundedString(c.search_query,1,300)&&boundedString(c.reason_summary,1,1000)&&["ai_inferred","catalog_verified","unverified"].includes(c.status)&& (c.album_year===null||Number.isInteger(c.album_year))&&(c.track_year===null||Number.isInteger(c.track_year)))&&arr("missing_information");
  case "compareTrackVersions": return arr("comparisons",8)&&boundedString(result.recommendation,1,1200)&&result.comparisons.every(c=>c&&boundedString(c.candidate_id,1,100)&&boundedString(c.reason_summary,1,1000)&&["low","medium","high"].includes(c.era_fit)&&arr("evidence_needed",10));
  case "generateMemoryStory": return ["title","story","core_line","memory_summary","poster_title","poster_subtitle","song_connection"].every(k=>boundedString(result[k],1,2000));
  case "generateSocialCopy": return boundedString(result.copy,1,3000);
  case "planPosterComposition": return boundedString(result.recommended_style,1,100)&&arr("palette",12)&&boundedString(result.composition,1,1500)&&boundedString(result.typography,1,1000)&&boundedString(result.image_treatment,1,1000)&&boundedString(result.text_density,1,100)&&arr("visual_motifs",20)&&boundedString(result.reason_summary,1,1000);
  default: return false;
 }
}
function validInput(action,input){
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 if(action==="analyzeMemory"||action==="inferMusicCandidates"||action==="generateMemoryStory"||action==="generateSocialCopy"||action==="planPosterComposition")return typeof input.story==="string"&&input.story.trim().length>0&&input.story.length<=8000;
 if(action==="compareTrackVersions")return Array.isArray(input.candidates)&&input.candidates.length>0&&input.candidates.length<=8&&input.candidates.every(c=>c&&typeof c==="object"&&boundedString(c.id||c.candidate_id,1,100)&&boundedString(c.title,1,200)&&boundedString(c.artist,1,200));
 return false;
}
export default {
 async fetch(request,env){
  const allowed=env.ALLOWED_ORIGIN||"https://chenzhe223-tech.github.io";
  const origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS"){
   if(origin!==allowed)return new Response(null,{status:403,headers:{"vary":"Origin"}});
   return new Response(null,{status:204,headers:{"access-control-allow-origin":allowed,"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"86400","vary":"Origin"}});
  }
  if(origin!==allowed)return json({error:"origin_not_allowed"},403,origin,allowed);
  if(request.method!=="POST")return json({error:"method_not_allowed"},405,origin,allowed);
  if(!env.DEEPSEEK_API_KEY)return json({error:"ai_service_not_configured",message:"AI 服务尚未配置，请稍后重试。"},503,origin,allowed);
  const length=Number(request.headers.get("content-length")||0);
  if(length>MAX_BODY_BYTES)return json({error:"payload_too_large"},413,origin,allowed);
  let body;try{body=await request.json()}catch{return json({error:"invalid_json"},400,origin,allowed)}
  if(new TextEncoder().encode(JSON.stringify(body)).length>MAX_BODY_BYTES)return json({error:"payload_too_large"},413,origin,allowed);
  const {action,input}=body||{};
  if(!ACTIONS.has(action)||!validInput(action,input))return json({error:"invalid_request"},400,origin,allowed);
  const model=env.DEEPSEEK_MODEL||"deepseek-chat";
  const taskSchema=schemas[action];
  const prompt="Task: "+action+"\nExpected JSON shape: "+JSON.stringify(taskSchema)+"\nUser input JSON: "+JSON.stringify(input)+"\nReturn JSON only. Values marked unknown/null must remain unknown when unsupported. For music candidates, provide search_query for catalog verification, not invented URLs or image URLs. User-facing rationale must be a brief evidence summary, not hidden chain-of-thought.";
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch("https://api.deepseek.com/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+env.DEEPSEEK_API_KEY,"content-type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}],response_format:{type:"json_object"},temperature:0.4,max_tokens:1800}),signal:controller.signal});
   if(!response.ok){const status=response.status;return json({error:status===429?"ai_rate_limited":status>=500?"ai_provider_unavailable":"ai_request_failed",message:"AI 服务暂时无法完成请求。"},status===429?429:502,origin,allowed)}
   const data=await response.json();const content=data?.choices?.[0]?.message?.content;
   let result;try{result=JSON.parse(content)}catch{return json({error:"invalid_model_output",message:"AI 返回格式无法验证，请重试。"},502,origin,allowed)}
   if(!validOutput(action,result))return json({error:"invalid_model_output",message:"AI 返回内容未通过结构校验，请重试。"},502,origin,allowed);
   return json({ok:true,action,model,result,source:"deepseek",generated_at:new Date().toISOString()},200,origin,allowed)
  }catch(error){return json({error:error?.name==="AbortError"?"ai_timeout":"ai_network_error",message:"AI 服务暂时不可用，请稍后重试。"},504,origin,allowed)}
  finally{clearTimeout(timeout)}
 }
};
