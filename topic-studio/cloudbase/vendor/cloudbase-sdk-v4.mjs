/**
 * DAVYLAB · CloudBase official browser SDK loader
 * Pinned to the exact Tencent Cloud CDN release documented in:
 * https://docs.cloudbase.net/api-reference/webv4/initialization
 * It is a public client SDK, NOT an admin key or private credential.
 * Only invoked by the explicit account/login UI; no anonymous login.
 *
 * IMPORTANT: CloudBase SDK v4 is currently labelled Beta by Tencent.
 * The automatic-sync production activation remains false until the
 * target environment's real auth/RLS/CAS and cross-device tests pass.
 */
const SDK_URL = "https://static.cloudbase.net/cloudbase-js-sdk/4.1.0/cloudbase.full.js";
const SHARED_LOAD = "__DAVYLAB_OFFICIAL_CLOUDBASE_V4_LOAD__";
function sdkReady() {
  const api = window.cloudbase;
  return api && typeof api.init === "function" ? api : null;
}
function loadScript(){
  if(sdkReady())return Promise.resolve(sdkReady());
  if(window[SHARED_LOAD])return window[SHARED_LOAD];
  window[SHARED_LOAD]=new Promise((resolve,reject)=>{
    const tag=document.createElement("script");
    tag.src=SDK_URL;
    tag.async=true;
    tag.crossOrigin="anonymous";
    tag.referrerPolicy="no-referrer";
    tag.onload=()=>{
      const loaded=sdkReady();
      if(loaded)resolve(loaded);
      else reject(new Error("OFFICIAL_CLOUDBASE_SDK_MISSING_GLOBAL"));
    };
    tag.onerror=()=>reject(new Error("OFFICIAL_CLOUDBASE_SDK_CDN_UNAVAILABLE"));
    document.head.appendChild(tag);
  }).catch(err=>{delete window[SHARED_LOAD];throw err});
  return window[SHARED_LOAD];
}
const cloudbase=await loadScript();
export default cloudbase;
export { SDK_URL };
