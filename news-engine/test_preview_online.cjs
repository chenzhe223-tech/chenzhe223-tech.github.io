/* Live HTTP smoke against a separate Worker staging domain; no production writes. */
const assert=require("node:assert/strict");
const ORIGIN="https://davylab-news-engine-preview.chenzhe223.workers.dev";
async function probe(path, method="GET") {
  const response=await fetch(ORIGIN+path,{method,signal:AbortSignal.timeout(20000),redirect:"error",cache:"no-store"});
  return response;
}
(async()=>{
  const home=await probe("/");
  assert.equal(home.status,200,"staging homepage must respond 200");
  assert.match(await home.text(),/DAVYLAB News Engine|NEWS ENGINE/i);
  const editor=await probe("/editor");
  assert.equal(editor.status,200,"staging online editor must respond 200");
  assert.match(await editor.text(),/id="editorForm"/);
  const health=await probe("/api/health");
  assert.equal(health.status,200,"isolated health API must respond 200");
  const flags=await health.json();
  assert.equal(flags.production_publishing,false);
  assert.equal(flags.ai_inference,"disabled");
  assert.equal(flags.ecosystem_writes,false);
  const radar=await probe("/api/radar-status");
  assert.equal(radar.status,200,"read-only Radar status must respond 200");
  const state=await radar.json();
  assert.equal(state.read_only,true);
  assert.match(state.report_date,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(state.up_to_date,state.report_date===state.today);
  const denied=await probe("/api/ai","POST");
  assert.equal(denied.status,405,"AI must not allow anonymous inference");
  const banned=await probe("/api/publish","POST");
  assert.equal(banned.status,405,"preview must not publish");
  console.log(JSON.stringify({staging:"live",health:"ok",editor:"ok",radar_date:state.report_date,
    radar_up_to_date:state.up_to_date,ai_inference:"off",publishing:"off"}));
})().catch(error=>{console.error("STAGING SMOKE FAILED:",error);process.exitCode=1});
