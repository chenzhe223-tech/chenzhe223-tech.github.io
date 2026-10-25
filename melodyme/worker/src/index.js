/**
 * MelodyMe server-side DeepSeek adapter for Cloudflare Workers.
 * Required secret: DEEPSEEK_API_KEY
 * Optional vars: ALLOWED_ORIGIN (exact production origin), DEEPSEEK_MODEL
 * Never deploy without a rate-limit rule at the edge.
 */
const MAX_BODY_BYTES = 12000;
const ACTIONS = new Set(["analyzeMemory","inferMusicCandidates","compareTrackVersions","generateMemoryStory","generateSocialCopy","planPosterComposition","generateAlbumArt","searchMusic","resolveCities"]);
const IMAGE_MODELS = ["@cf/stabilityai/stable-diffusion-xl-base-1.0", "@cf/black-forest-labs/flux-1-schnell"];
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
 if(action==="searchMusic")return typeof input.song==="string"&&input.song.length<=120&&typeof input.artist==="string"&&input.artist.length<=120&&(input.song.trim().length>0||input.artist.trim().length>0);
 if(action==="resolveCities")return Array.isArray(input.cities)&&input.cities.length===4&&input.cities.every(v=>typeof v==="string"&&v.trim().length>0&&v.length<=80)&&new Set(input.cities.map(v=>v.trim().replace(/\\s/g,"").toLowerCase())).size===4;
 if(action==="generateAlbumArt")return boundedString(input.prompt,1,6000)&&Number.isInteger(input.width)&&input.width>=256&&input.width<=1024&&Number.isInteger(input.height)&&input.height>=256&&input.height<=1024&&(input.seed===undefined||(Number.isInteger(input.seed)&&input.seed>=0&&input.seed<=2147483647));
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
  if(env.AI_RATE_LIMITER){
   const ip=request.headers.get("cf-connecting-ip")||"unknown";
   try{
    const limit=await env.AI_RATE_LIMITER.limit({key:ip});
    if(!limit.success)return json({error:"request_rate_limited",message:"请求过于频繁，请稍后再试。"},429,origin,allowed);
   }catch{return json({error:"rate_limiter_unavailable",message:"服务保护机制暂不可用，请稍后重试。"},503,origin,allowed)}
  }
  const length=Number(request.headers.get("content-length")||0);
  if(length>MAX_BODY_BYTES)return json({error:"payload_too_large"},413,origin,allowed);
  let body;try{body=await request.json()}catch{return json({error:"invalid_json"},400,origin,allowed)}
  if(new TextEncoder().encode(JSON.stringify(body)).length>MAX_BODY_BYTES)return json({error:"payload_too_large"},413,origin,allowed);
  const {action}=body||{};
  const input=action==="generateAlbumArt"?body:(body||{}).input;
  if(!ACTIONS.has(action)||!validInput(action,input))return json({error:"invalid_request",message:"请求参数无效，请检查输入。"},400,origin,allowed);
  if(action==="resolveCities"){
   if(!env.AMAP_REST_KEY)return json({error:"amap_not_configured",message:"高德地图服务尚未配置。请在 Cloudflare Worker 中设置 AMAP_REST_KEY 后重试。"},503,origin,allowed);
   const cities=input.cities.map(v=>String(v).trim());
   const resolved=await Promise.all(cities.map(async(name,index)=>{
    const url="https://restapi.amap.com/v3/geocode/geo?address="+encodeURIComponent(name)+"&key="+encodeURIComponent(env.AMAP_REST_KEY);
    try{
     const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(9000)});
     if(!response.ok)throw new Error("amap_http_"+response.status);
     const data=await response.json();
     if(data.status!=="1"||!Array.isArray(data.geocodes)||!data.geocodes.length)throw new Error(data.info||"city_not_found");
     const item=data.geocodes[0],parts=String(item.location||"").split(",");
     const lng=Number(parts[0]),lat=Number(parts[1]);
     if(!Number.isFinite(lng)||!Number.isFinite(lat))throw new Error("invalid_coordinates");
     return {index,name,matchedName:item.city||item.district||item.formatted_address||name,formattedAddress:item.formatted_address||name,province:item.province||"",city:Array.isArray(item.city)?item.city[0]||"":item.city||"",adcode:item.adcode||"",lng,lat,source:"高德地图地理编码"};
    }catch(error){return {index,name,error:String(error&&error.message||error)}}
   }));
   const failed=resolved.filter(v=>v.error);
   if(failed.length)return json({error:"city_geocoding_failed",message:"部分城市未能通过高德地图核验，请检查城市名称后重试。",failed:failed.map(v=>({index:v.index,name:v.name}))},422,origin,allowed);
   const seen=new Set();
   for(const city of resolved){const key=city.lng.toFixed(3)+","+city.lat.toFixed(3);if(seen.has(key))return json({error:"duplicate_resolved_city",message:"有两个输入匹配到同一地点，请填写四个不同的城市。",duplicate:city.name},422,origin,allowed);seen.add(key)}
   return json({ok:true,action:"resolveCities",source:"AMap Web Service geocoding",cities:resolved.map(({index,name,matchedName,formattedAddress,province,city,adcode,lng,lat,source})=>({index,name,matchedName,formattedAddress,province,city,adcode,lng,lat,source}))},200,origin,allowed);
  }
  if(action==="searchMusic"){
   const song=String(input.song||"").trim(),artist=String(input.artist||"").trim();
   const aliases={"遇见":"Encounter","晴天":"Sunny Day","后来":"Later","小幸运":"A Little Happiness","演员":"Actor","稻香":"Rice Field","夜曲":"Nocturne"};
   const queries=[];
   const add=(term,country)=>{term=String(term||"").trim();if(!term)return;const key=country+"|"+term;if(!queries.some(q=>q.key===key))queries.push({key,term,country})};
   for(const country of ["CN","TW","HK","US"]){add([song,artist].filter(Boolean).join(" "),country);add(song,country)}
   if(artist)add(artist+" "+song,"TW");
   if(aliases[song]){add([aliases[song],artist].filter(Boolean).join(" "),"US");add(aliases[song],"US")}
   const settled=await Promise.all(queries.map(async q=>{try{const url="https://itunes.apple.com/search?term="+encodeURIComponent(q.term)+"&entity=song&limit=25&country="+q.country+"&media=music";const response=await fetch(url,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error("itunes_http_"+response.status);const data=await response.json();return {results:Array.isArray(data.results)?data.results:[],error:null}}catch(error){return {results:[],error:String(error&&error.message||error)}}}));
   const merged=[],seen=new Set();for(const batch of settled)for(const track of batch.results){if(!track||!track.trackName||!track.artistName||!track.artworkUrl100)continue;const key=String(track.trackId||"")+":"+String(track.trackName).toLowerCase()+":"+String(track.artistName).toLowerCase();if(!seen.has(key)){seen.add(key);merged.push(track)}}
   const norm=v=>String(v||"").toLowerCase().normalize("NFKC").replace(/[\\s\\-—_.,，。:：'’"“”()（）\\[\\]【】《》]/g,"");
   const alias=norm(aliases[song]||"");
   const score=t=>{const title=norm(t.trackName),want=norm(song),name=norm(t.artistName),wantArtist=norm(artist);let n=0;if(want){if(title===want||alias&&title===alias)n+=120;else if(title.includes(want)||want.includes(title)||alias&&(title.includes(alias)||alias.includes(title)))n+=55}if(wantArtist){if(name===wantArtist)n+=100;else if(name.includes(wantArtist)||wantArtist.includes(name))n+=45}if(t.previewUrl)n+=2;return n};
   merged.sort((a,b)=>score(b)-score(a));
   if(!merged.length&&settled.every(x=>x.error))return json({error:"music_catalog_unavailable",message:"音乐目录暂时无法连接，请检查网络或稍后重试。"},502,origin,allowed);
   return json({ok:true,action:"searchMusic",results:merged.slice(0,25),queries:queries.length,failedQueries:settled.filter(x=>x.error).length},200,origin,allowed);
  }
  if(action==="generateAlbumArt"){
   if(!env.AI||typeof env.AI.run!=="function")return json({error:"ai_image_service_not_configured",message:"AI 封面服务暂不可用。"},503,origin,allowed);
   const controller=new AbortController();
   let timeoutId;
   try{
    const generation=(async()=>{
     let lastError;
     for(const modelName of IMAGE_MODELS){
      try{
       // Primary model: @cf/stabilityai/stable-diffusion-xl-base-1.0.
       // Free fallback: @cf/black-forest-labs/flux-1-schnell, when enabled for this account.
       const generated=await env.AI.run(modelName,{prompt:input.prompt,width:input.width,height:input.height,seed:input.seed===undefined?1:input.seed},{signal:controller.signal});
       const image=generated&&typeof generated==="object"&&"image" in generated?generated.image:generated;
       if(image instanceof ArrayBuffer)return {model:modelName,body:new Uint8Array(image)};
       if(ArrayBuffer.isView(image))return {model:modelName,body:new Uint8Array(image.buffer,image.byteOffset,image.byteLength)};
       if(typeof ReadableStream!=="undefined"&&image instanceof ReadableStream)return {model:modelName,body:image};
       if(typeof Blob!=="undefined"&&image instanceof Blob)return {model:modelName,body:image.stream()};
       throw new Error("empty_image_result");
      }catch(error){lastError=error}
     }
     throw lastError||new Error("image_generation_failed");
    })();
    const timedOut=new Promise((_,reject)=>{timeoutId=setTimeout(()=>{controller.abort();reject(new Error("image_generation_timeout"))},25000)});
    const output=await Promise.race([generation,timedOut]);
    return new Response(output.body,{status:200,headers:{"content-type":"image/png","cache-control":"no-store","access-control-allow-origin":allowed,"vary":"Origin","x-melodyme-model":output.model}});
   }catch(error){
    const timedOut=error&&error.message==="image_generation_timeout";
    return json({error:timedOut?"ai_image_timeout":"ai_image_generation_failed",message:timedOut?"AI 封面生成超时，请稍后重试。":"AI 封面生成暂不可用，请稍后重试。"},timedOut?504:502,origin,allowed);
   }finally{clearTimeout(timeoutId)}
  }
  if(!env.DEEPSEEK_API_KEY)return json({error:"ai_service_not_configured",message:"AI 服务尚未配置，请稍后重试。"},503,origin,allowed);
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
