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


const artRequest = (overrides = {}) => req({
  action: "generateAlbumArt",
  prompt: "square abstract memory artwork, blue ocean and soft light",
  seed: 123,
  width: 600,
  height: 600,
  ...overrides
});
test("generates album art through Workers AI and returns PNG without secret fields", async () => {
  const calls = [];
  const imageEnv = { ...env, AI: { run: async (model, input) => {
    calls.push({ model, input });
    return new Uint8Array([137, 80, 78, 71]);
  } } };
  const res = await worker.fetch(artRequest(), imageEnv);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /image\/png/);
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [137, 80, 78, 71]);
  assert.equal(calls[0].model, "@cf/stabilityai/stable-diffusion-xl-base-1.0");
  assert.equal(calls[0].input.prompt, "square abstract memory artwork, blue ocean and soft light");
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(res.headers.get("x-deepseek-api-key"), null);
});
test("rejects album-art requests from disallowed origins", async () => {
  const res = await worker.fetch(artRequest(), { ...env, AI: { run: async () => new Uint8Array([1]) } });
  const request = new Request("https://worker.test/", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ action: "generateAlbumArt", prompt: "art", width: 600, height: 600 }) });
  const denied = await worker.fetch(request, { ...env, AI: { run: async () => new Uint8Array([1]) } });
  assert.equal(denied.status, 403);
  assert.equal(res.status, 200);
});
test("rejects non-POST album-art requests", async () => {
  const res = await worker.fetch(req(null, { method: "GET" }), { ...env, AI: { run: async () => new Uint8Array([1]) } });
  assert.equal(res.status, 405);
});
test("rejects oversized album-art request bodies", async () => {
  const request = new Request("https://worker.test/", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "Content-Length": "12001" }, body: JSON.stringify({ action: "generateAlbumArt", prompt: "x", width: 600, height: 600 }) });
  const res = await worker.fetch(request, { ...env, AI: { run: async () => new Uint8Array([1]) } });
  assert.equal(res.status, 413);
});
test("rejects empty and overlong album-art prompts", async () => {
  for (const prompt of ["", " ".repeat(401), "x".repeat(401)]) {
    const res = await worker.fetch(artRequest({ prompt }), { ...env, AI: { run: async () => new Uint8Array([1]) } });
    assert.equal(res.status, 400);
  }
});
test("rejects album-art dimensions outside 256 to 1024", async () => {
  for (const dims of [{ width: 255, height: 600 }, { width: 1025, height: 600 }, { width: 600, height: 255 }, { width: 600, height: 1025 }]) {
    const res = await worker.fetch(artRequest(dims), { ...env, AI: { run: async () => new Uint8Array([1]) } });
    assert.equal(res.status, 400);
  }
});
test("maps Workers AI failures to a controlled image error without stack details", async () => {
  const res = await worker.fetch(artRequest(), { ...env, AI: { run: async () => { throw new Error("private upstream stack and secret"); } } });
  assert.equal(res.status, 502);
  const data = await res.json();
  assert.equal(data.error, "ai_image_generation_failed");
  assert.equal(JSON.stringify(data).includes("private upstream stack"), false);
  assert.equal(JSON.stringify(data).includes("test-only-key"), false);
});
test("returns a controlled error when Workers AI binding is missing", async () => {
  const { AI, ...withoutAI } = { ...env, AI: undefined };
  const res = await worker.fetch(artRequest(), withoutAI);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "ai_image_service_not_configured");
});

test("enforces the existing Worker rate limiter for album-art requests", async () => {
  let called = false;
  const limitedEnv = { ...env, AI_RATE_LIMITER: { limit: async () => ({ success: false }) }, AI: { run: async () => { called = true; return new Uint8Array([1]); } } };
  const res = await worker.fetch(artRequest(), limitedEnv);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, "request_rate_limited");
  assert.equal(called, false);
});
test("maps album-art timeout to a controlled 504 response", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => originalSetTimeout(fn, 0);
  try {
    const res = await worker.fetch(artRequest(), { ...env, AI: { run: async () => new Promise(() => {}) } });
    assert.equal(res.status, 504);
    const data = await res.json();
    assert.equal(data.error, "ai_image_timeout");
    assert.equal(JSON.stringify(data).includes("test-only-key"), false);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
