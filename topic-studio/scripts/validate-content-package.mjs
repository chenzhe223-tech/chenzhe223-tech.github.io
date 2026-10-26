#!/usr/bin/env node
/**
 * Validates the GitHub-to-WorkBuddy handoff contract without external dependencies.
 * Run from repository root:
 *   node topic-studio/scripts/validate-content-package.mjs
 */
import fs from "node:fs";
import path from "node:path";

const pipelineRoot = path.resolve(process.argv[2] || "topic-studio/content-pipeline");
const queueFile = path.join(pipelineRoot, "queue.json");
const allowedStates = new Set([
  "proposed", "awaiting_approval", "approved", "generating", "qa_passed",
  "ready_for_workbuddy", "downloaded", "draft_saved", "preview_passed",
  "published", "needs_revision", "blocked", "failed"
]);
const allowedScopes = new Set(["none", "generate_only", "draft_only", "publish_after_approval"]);
const errors = [];
const warnings = [];
const exists = (p) => fs.existsSync(p);
const readJson = (p, label) => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (error) { errors.push(`${label}: invalid JSON (${error.message})`); return null; }
};
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const within = (base, relative) => {
  if (!nonEmpty(relative) || path.isAbsolute(relative)) return null;
  const resolved = path.resolve(base, relative);
  return resolved.startsWith(path.resolve(base) + path.sep) ? resolved : null;
};

if (!exists(queueFile)) {
  console.error(`FAIL: queue file not found: ${queueFile}`);
  process.exit(1);
}
const queue = readJson(queueFile, "queue.json");
if (!queue) process.exit(1);
if (queue.schema_version !== 1) errors.push("queue.json: schema_version must be 1");
if (!Array.isArray(queue.packages)) errors.push("queue.json: packages must be an array");

const seen = new Set();
const packagesRoot = path.join(pipelineRoot, "packages");
const entries = exists(packagesRoot) ? fs.readdirSync(packagesRoot, { withFileTypes: true }).filter(e => e.isDirectory()) : [];
const indexed = new Set((Array.isArray(queue.packages) ? queue.packages : []).map(p => p?.package_id).filter(nonEmpty));

for (const entry of entries) {
  const packageId = entry.name;
  const dir = path.join(packagesRoot, packageId);
  const manifestPath = path.join(dir, "manifest.json");
  if (!exists(manifestPath)) {
    warnings.push(`${packageId}: directory has no manifest.json; ignored unless indexed`);
    if (indexed.has(packageId)) errors.push(`${packageId}: indexed package has no manifest.json`);
    continue;
  }
  const manifest = readJson(manifestPath, `${packageId}/manifest.json`);
  if (!manifest) continue;
  if (manifest.package_id !== packageId) errors.push(`${packageId}: package_id must match directory name`);
  if (seen.has(packageId)) errors.push(`${packageId}: duplicate package ID`);
  seen.add(packageId);
  if (!allowedStates.has(manifest.state)) errors.push(`${packageId}: invalid state "${manifest.state}"`);
  if (!["newspic", "article"].includes(manifest.content_type)) errors.push(`${packageId}: content_type must be newspic or article`);
  if (!nonEmpty(manifest.title) && manifest.state !== "proposed" && manifest.state !== "awaiting_approval") {
    errors.push(`${packageId}: title is required after proposal stage`);
  }
  if (!manifest.approval || !allowedScopes.has(manifest.approval.scope)) errors.push(`${packageId}: invalid approval.scope`);
  if (manifest.state === "ready_for_workbuddy" || ["downloaded", "draft_saved", "preview_passed", "published"].includes(manifest.state)) {
    if (manifest.approval?.status !== "approved") errors.push(`${packageId}: handoff requires approval.status=approved`);
    if (!nonEmpty(manifest.approval?.approved_at)) errors.push(`${packageId}: handoff requires approval.approved_at`);
    if (!nonEmpty(manifest.approval?.approved_by)) errors.push(`${packageId}: handoff requires approval.approved_by`);
    if (!["draft_only", "publish_after_approval"].includes(manifest.approval?.scope)) {
      errors.push(`${packageId}: handoff requires draft_only or publish_after_approval scope`);
    }
    if (manifest.approval?.scope === "publish_after_approval" &&
        (!nonEmpty(manifest.approval?.evidence) || !nonEmpty(manifest.approval?.approved_proposal_sha256))) {
      errors.push(`${packageId}: publication requires approval evidence and approved proposal hash`);
    }
    if (!manifest.qa || manifest.qa.status !== "passed" || manifest.qa.machine_checks !== true || manifest.qa.visual_review !== true) {
      errors.push(`${packageId}: ready handoff requires QA status passed, machine_checks=true, visual_review=true`);
    }
  }

  const assets = manifest.assets || {};
  for (const key of ["proposal", "caption", "source_notes", "qa_report"]) {
    const file = assets[key];
    if (nonEmpty(file)) {
      const target = within(dir, file);
      if (!target) errors.push(`${packageId}: unsafe relative path in assets.${key}`);
      else if (!exists(target)) errors.push(`${packageId}: missing asset ${file}`);
    }
  }
  if (manifest.content_type === "article" && ["ready_for_workbuddy", "downloaded", "draft_saved", "preview_passed", "published"].includes(manifest.state)) {
    const target = within(dir, assets.article);
    if (!target || !exists(target)) errors.push(`${packageId}: article content file is missing`);
  }

  if (manifest.content_type === "newspic" && ["ready_for_workbuddy", "downloaded", "draft_saved", "preview_passed", "published"].includes(manifest.state)) {
    const titleLength = Array.from(manifest.title || "").length;
    if (titleLength > 20) errors.push(`${packageId}: newspic title is ${titleLength} Unicode code points (max 20)`);
    const pageFile = within(dir, assets.pages);
    if (!pageFile || !exists(pageFile)) {
      errors.push(`${packageId}: pages.json is missing`);
    } else {
      const pageData = readJson(pageFile, `${packageId}/${assets.pages}`);
      if (pageData) {
        if (!Array.isArray(pageData.pages) || pageData.pages.length < 6 || pageData.pages.length > 10) {
          errors.push(`${packageId}: newspic pages must contain 6-10 entries`);
        } else {
          pageData.pages.forEach((page, index) => {
            if (!nonEmpty(page.title)) errors.push(`${packageId}: page ${index + 1} title is missing`);
            const titleChars = Array.from(page.title || "").length;
            if (titleChars > 20) errors.push(`${packageId}: page ${index + 1} title exceeds 20 Unicode code points`);
            const bodyAndTags = String(page.body || "") + String(page.tags || "");
            if (Array.from(bodyAndTags).length > 300) errors.push(`${packageId}: page ${index + 1} body+tags exceeds 300 Unicode code points`);
            if (!nonEmpty(page.image)) errors.push(`${packageId}: page ${index + 1} image path is missing`);
          });
        }
      }
    }
    const images = Array.isArray(assets.images) ? assets.images : [];
    if (images.length < 6 || images.length > 10) errors.push(`${packageId}: assets.images must contain 6-10 image paths`);
    for (const image of images) {
      const target = within(dir, image);
      if (!target || !exists(target)) {
        errors.push(`${packageId}: missing or unsafe image path: ${image}`);
        continue;
      }
      const fd = fs.openSync(target, "r");
      const header = Buffer.alloc(24);
      const bytes = fs.readSync(fd, header, 0, 24, 0);
      fs.closeSync(fd);
      const isPng = bytes >= 24 && header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      if (!isPng) {
        errors.push(`${packageId}: image must be PNG: ${image}`);
        continue;
      }
      const width = header.readUInt32BE(16);
      const height = header.readUInt32BE(20);
      if (width !== 1080 || height !== 1440) errors.push(`${packageId}: ${image} is ${width}x${height}, expected 1080x1440`);
    }
  }
}

for (const row of Array.isArray(queue.packages) ? queue.packages : []) {
  if (!row || !nonEmpty(row.package_id) || !nonEmpty(row.path)) {
    errors.push("queue.json: each package needs package_id and path");
    continue;
  }
  if (seen.has(row.package_id) === false && row.path !== "") errors.push(`queue.json: indexed package ${row.package_id} does not exist`);
  if (seen.has(row.package_id) && row.path !== `packages/${row.package_id}`) errors.push(`queue.json: path for ${row.package_id} must be packages/${row.package_id}`);
  if (row.package_id && seen.has(row.package_id) === false) continue;
}
const packageDirs = new Set(entries.map(e => e.name));
for (const row of Array.isArray(queue.packages) ? queue.packages : []) {
  if (packageDirs.has(row?.package_id) && row.path !== `packages/${row.package_id}`) errors.push(`queue.json: unsafe/mismatched path for ${row.package_id}`);
}
for (const id of indexed) if (!packageDirs.has(id)) errors.push(`queue.json: package ${id} points to no directory`);

const result = {
  ok: errors.length === 0,
  pipeline_root: pipelineRoot,
  indexed_packages: Array.isArray(queue.packages) ? queue.packages.length : 0,
  package_directories: entries.length,
  errors,
  warnings
};
console.log(JSON.stringify(result, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
