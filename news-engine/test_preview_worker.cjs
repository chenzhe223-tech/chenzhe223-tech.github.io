/* Offline contract tests for isolated preview Worker; no external network or deployments. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
(async()=>{
  const template=fs.readFileSync("news-engine/preview-worker.js","utf8");
  const source=template.replace('"__DAVYLAB_EDITOR_HTML__"',JSON.stringify(fs.readFileSync("news-engine/editor.html","utf8")));
  const worker=(await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"))).default;
  const realFetch=globalThis.fetch;
  try{
    globalThis.fetch=async url=>{
      if(String(url).includes("/news-engine/editor.html"))
        return new Response("<html><title>DAVYLAB News Engine</title><form id='editorForm'></form></html>",
          {status:200,headers:{"content-length":"81"}});
      if(String(url).includes("/radar/data/latest.json"))
        return Response.json({report_date:"2026-11-22",status:"ok",sources_ok:9,sources_total:10,api_key:"never_expose"});
      throw Error("untrusted network fetch");
    };
    const request=(path,method="GET")=>worker.fetch(new Request("https://preview.invalid"+path,{method}));
    let r=await request("/");
    assert.equal(r.status,200);
    let page=await r.text();
    assert.match(page,/进入在线审稿台/);
    assert.match(r.headers.get("content-security-policy"),/connect-src 'none'/);
    r=await request("/editor");
    assert.equal(r.status,200);
    assert.match(await r.text(),/editorForm/);
    r=await request("/api/health");
    let data=await r.json();
    assert.equal(data.production_publishing,false);
    assert.equal(data.ai_inference,"disabled");
    r=await request("/api/radar-status");
    assert.equal(r.status,200);
    data=await r.json();
    assert.equal(data.report_date,"2026-11-22");
    assert.equal(data.read_only,true);
    assert.equal(data.api_key,undefined);
    r=await request("/api/publish","POST");
    assert.equal(r.status,405);
    r=await request("/api/ai","POST");
    assert.equal(r.status,405);
    r=await request("/random");
    assert.equal(r.status,404);
    globalThis.fetch=async()=>{throw Error("origin down")};
    r=await request("/editor");
    assert.equal(r.status,200,"bundled editor must work when GitHub origin is offline");
    r=await request("/api/radar-status");
    assert.equal(r.status,503,"Radar status should fail closed without affecting editor");
    assert.equal((await r.json()).error,"upstream_unavailable");
    console.log("Preview Worker offline QA: 9 contracts PASS; no network or production mutations");
  }finally{globalThis.fetch=realFetch;}
})().catch(e=>{console.error(e);process.exitCode=1});
