const assert=require("node:assert/strict");
const fs=require("node:fs");
const worker=fs.readFileSync("comic-studio/worker.js","utf8");
const brief=fs.readFileSync("comic-studio/briefing.js","utf8");
const section=worker.match(/h\.set\('content-security-policy',("[^"]+")\)/)?.[1]||"";
assert.ok(section,"WorldToon security policy must remain explicit");
assert.ok(section.includes("connect-src 'self' https://qjyqaydfezbpeimpvlcb.supabase.co https://davylab-news-api.chenzhe223.workers.dev;"),
 "Exact existing CSP supabase + new source-only DAVYLAB News API origin");
const connect=section.match(/connect-src ([^;]+);/)?.[1]||"";
assert.equal(connect,"\u0027self\u0027 https://qjyqaydfezbpeimpvlcb.supabase.co https://davylab-news-api.chenzhe223.workers.dev",
 "Only the two exactly named services may receive fetch/XHR; existing img-src policy is unchanged");
assert.ok(section.includes("frame-ancestors 'none'")&&section.includes("object-src 'none'"),
 "Preserve protections unrelated to P1");
assert.ok(brief.includes("BRIEF_NEWS_API='https://davylab-news-api.chenzhe223.workers.dev/"),
 "News Engine consumer must point to the exact approved origin");
assert.ok(worker.includes("await wtDiscoveryScheduled(controller,env)"),"Preserve WorldToon scheduled behavior");
console.log("PASS: WorldToon News Engine P1 CSP allowlist is exact, minimal and old safeguards remain");
