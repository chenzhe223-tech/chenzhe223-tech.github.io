/* Isolated, read-only online preview. Never connects to the Radar publisher. */
const EDITOR_HTML = "__DAVYLAB_EDITOR_HTML__";
const RADAR_URLS = [
  "https://raw.githubusercontent.com/chenzhe223-tech/chenzhe223-tech.github.io/main/radar/data/latest.json",
  "https://chenzhe223-tech.github.io/radar/data/latest.json"
];
const BASE_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "access-control-allow-origin": "null",
};
const SITE = [
"<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>",
"<meta name='robots' content='noindex,nofollow'><title>DAVYLAB News Engine · 独立预览</title>",
"<style>*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#152238;font:15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif}header{height:70px;background:#fff;border-bottom:1px solid #e3e8ef;display:flex;align-items:center;justify-content:space-between;padding:0 max(22px,calc((100vw - 1080px)/2))}b{letter-spacing:-.02em}small{color:#718095}main{max-width:1080px;margin:0 auto;padding:52px 22px}.eyebrow{font-size:12px;letter-spacing:.16em;color:#4979c8;font-weight:800}h1{font-size:clamp(32px,5vw,55px);line-height:1.15;letter-spacing:-.055em;margin:18px 0}p{max-width:660px;color:#53647c;margin:0 0 28px}.button{display:inline-flex;background:#193d69;color:white;text-decoration:none;font-weight:750;border-radius:12px;padding:12px 19px}.button.secondary{background:#fff;color:#193d69;border:1px solid #cbd5e1;margin-left:8px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:48px 0}.card{background:white;border:1px solid #e3e8ef;border-radius:18px;padding:25px;min-height:150px}.card h2{font-size:16px;margin:0 0 8px}.card p{font-size:13px;margin:0}footer{font-size:12px;color:#7a899c;border-top:1px solid #e3e8ef;padding:22px 0}code{font-size:12px;color:#435d7a}@media(max-width:750px){.cards{grid-template-columns:1fr}main{padding-top:38px}.button.secondary{margin:10px 0 0}}</style></head>",
"<body><header><b>DAVYLAB <span style='color:#4779be'>/ NEWS ENGINE</span></b><small>STAGING · BY DAVYLAB</small></header>",
"<main><div class='eyebrow'>独立预览 · 只读安全模式</div><h1>新闻发现、研究与创作<br>在一个工作台完成。</h1>",
"<p>目前提供在线审稿编辑器、修订版 JSON 导出和正式 Radar 只读状态监测。新闻采集与 AI 调用仍在独立验收；所有未核实内容禁止自动发布。</p>",
"<a class='button' href='/editor'>进入在线审稿台</a><a class='button secondary' href='/api/radar-status'>查看日报发布状态</a>",
"<div class='cards'><section class='card'><h2>01 · 事实证据</h2><p>保留来源链接与版权记录，必须人工核验才可进入发布环节。</p></section>",
"<section class='card'><h2>02 · 多端编辑</h2><p>导入草稿，编辑正文及媒体，导出新的修订版本；不写入生产数据。</p></section>",
"<section class='card'><h2>03 · 安全隔离</h2><p>不触碰 radar/daily、不发布微信文章、不消耗模型 API。</p></section></div>",
"<footer>Preview only · <code>/api/health</code> · 发布开关 OFF · 日报原有流水线保持独立</footer></main></body></html>"
].join("");
function html(body, code=200) {
  return new Response(body,{status:code,headers:{...BASE_HEADERS,"content-type":"text/html; charset=utf-8",
    "content-security-policy":"default-src 'none';style-src 'unsafe-inline';script-src 'unsafe-inline';img-src https: data: blob:;connect-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'"}});
}
function json(body, code=200) {
  return new Response(JSON.stringify(body),{status:code,headers:{...BASE_HEADERS,"content-type":"application/json; charset=utf-8"}});
}
async function trustedRead(url, maxBytes) {
  const response=await fetch(url,{redirect:"follow",headers:{"accept":"text/plain,application/json,text/html"}});
  if(!response.ok) throw new Error("upstream unavailable");
  const len=Number(response.headers.get("content-length")||0);
  if(len>maxBytes) throw new Error("oversized upstream");
  const text=await response.text();
  if(text.length>maxBytes) throw new Error("oversized upstream");
  return text;
}
export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method!=="GET"&&request.method!=="HEAD") return json({error:"read_only"},405);
    try{
      if(url.pathname==="/"||url.pathname==="/index.html") return html(SITE);
      if(url.pathname==="/favicon.ico") return new Response(null,{status:204,headers:BASE_HEADERS});
      if(url.pathname==="/editor"){
        if(!EDITOR_HTML.includes("DAVYLAB News Engine")||!EDITOR_HTML.includes("editorForm")) throw new Error("editor bundle missing");
        return html(EDITOR_HTML);
      }
      if(url.pathname==="/api/health") return json({service:"DAVYLAB News Engine",environment:"isolated_preview",
        production_publishing:false,ai_inference:"disabled",ecosystem_writes:false,editor:"available_via_editor"});
      if(url.pathname==="/api/radar-status"){
        let raw=null;
        for(const source of RADAR_URLS){
          try { raw=await trustedRead(source,800000); break; } catch (_) { /* try known public fallback */ }
        }
        if(!raw) throw new Error("Radar public sources unavailable");
        const data=JSON.parse(raw);
        if(typeof data.report_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(data.report_date))
          throw new Error("invalid Radar state");
        const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
        return json({source:"main/radar/data/latest.json",read_only:true,report_date:data.report_date,
          today,up_to_date:data.report_date===today,report_status:String(data.status||"unknown"),
          sources_ok:Number(data.sources_ok||0),sources_total:Number(data.sources_total||0)});
      }
      return json({error:"not_found"},404);
    }catch(error){
      return json({error:"upstream_unavailable",detail:"Preview unavailable; Radar production is not affected"},503);
    }
  }
};
