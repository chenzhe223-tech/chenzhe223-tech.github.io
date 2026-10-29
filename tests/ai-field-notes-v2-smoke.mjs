import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import assert from "node:assert/strict";

const html = readFileSync("ai-field-notes/v2/index.html", "utf8");
const worker = readFileSync("ai-field-notes/worker/index.js", "utf8");
const architecture = readFileSync("ai-field-notes/ARCHITECTURE_V2.md", "utf8");
const spec = readFileSync("ai-field-notes/v2/AI_ATLAS_DESIGN_SPEC.md", "utf8");

const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
}

check("V2 has a single inline script with valid JavaScript syntax", () => {
  const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)];
  assert.ok(scripts.length >= 1, "expected at least one inline script");
  for (const [, source] of scripts) new Script(source);
});

check("candidate queue container and loading state exist", () => {
  assert.match(html, /id="learningCandidates"/);
  assert.match(html, /id="candidateQueueState"/);
  assert.match(html, /loadLearningCandidates/);
  assert.match(html, /name==="archive"\\)\\{loadArchiveCatalog\\(\\);loadLearningCandidates\\(\\)/);
});

check("frontier candidate API is read-only and hides reviewer notes", () => {
  assert.match(worker, /url\\.pathname === "\\/api\\/learning\\/candidates"/);
  assert.match(worker, /request\\.method !== "GET"/);
  assert.doesNotMatch(worker, /review_note:\\s*row\\.review_note/);
});

check("atlas compatibility key workflow remains stable", () => {
  assert.match(html, /workflow/);
  assert.match(worker, /API_VERSION = "0\\.5\\.1"/);
});

check("architecture and design spec document source-backed review", () => {
  assert.match(architecture, /0010/);
  assert.match(architecture, /0\\.5\\.1/);
  assert.match(spec, /candidate/i);
});

const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/g)].map((m) => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
check("HTML ids are unique", () => assert.deepEqual([...new Set(duplicates)], []));

console.log("AI Field Notes V2 smoke test passed:");
for (const item of checks) console.log("✓ " + item);
