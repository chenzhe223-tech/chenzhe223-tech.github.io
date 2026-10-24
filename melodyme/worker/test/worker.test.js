import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORIGIN = "https://chenzhe223-tech.github.io";
const env = { ALLOWED_ORIGIN: ORIGIN, DEEPSEEK_API_KEY: "test-only-key", DEEPSEEK_MODEL: "deepseek-chat" };
function req(body, options = {}) {
  return new Request("https://worker.test/", {
    method: options.method || "POST",
    headers: { Origin: options.origin || ORIGIN, "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.method === "GET" || options.method === "OPTIONS" ? undefined : JSON.stringify(body)
  });
}
test("rejects requests from unapproved origins", async () => {
  const res = await worker.fetch(req({action:"generateSocialCopy",input:{story:"x"}},{origin:"https://evil.example"}), env);
  assert.equal(res.status,403);
});
test("rejects unsupported methods", async () => {
  const res = await worker.fetch(req(null,{method:"GET"}), env);
  assert.equal(res.status,405);
});
test("rejects malformed JSON", async () => {
  const request = new Request("https://worker.test/", {method:"POST",headers:{Origin:ORIGIN,"Content-Type":"application/json"},body:"{"});
  const res = await worker.fetch(request, env);
  assert.equal(res.status,400);
});
test("rejects unknown action and empty story", async () => {
  let res = await worker.fetch(req({action:"surprise",input:{story:"hello"}}),env);
  assert.equal(res.status,400);
  res = await worker.fetch(req({action:"generateSocialCopy",input:{story:"   "}}),env);
  assert.equal(res.status,400);
});
test("does not call provider when secret is absent", async () => {
  const res = await worker.fetch(req({action:"generateSocialCopy",input:{story:"A school trip"}}), {ALLOWED_ORIGIN:ORIGIN});
  assert.equal(res.status,503);
});
test("calls DeepSeek and returns parsed JSON for a valid response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url,"https://api.deepseek.com/chat/completions");
    assert.match(init.headers.authorization,/^Bearer test-only-key$/);
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({copy:"A memory in music."})}}]}),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const res = await worker.fetch(req({action:"generateSocialCopy",input:{story:"A school trip"}}),env);
    assert.equal(res.status,200);
    const data = await res.json();
    assert.equal(data.ok,true);
    assert.equal(data.result.copy,"A memory in music.");
  } finally { globalThis.fetch = originalFetch; }
});
test("maps provider throttling to a controlled response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("limited",{status:429});
  try {
    const res = await worker.fetch(req({action:"generateSocialCopy",input:{story:"A school trip"}}),env);
    assert.equal(res.status,429);
    assert.equal((await res.json()).error,"ai_rate_limited");
  } finally { globalThis.fetch = originalFetch; }
});
