#!/usr/bin/env node
/**
 * Contract tests for validate-content-package.mjs.
 * The dummy PNG fixtures intentionally provide only the header used by the validator;
 * they are not images for publishing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const validator = path.resolve("topic-studio/scripts/validate-content-package.mjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "davylab-content-package-test-"));
const pipeline = path.join(temp, "content-pipeline");
const packages = path.join(pipeline, "packages");
const pkgId = "case-pass";
const pkgDir = path.join(packages, pkgId);
const fail = (message) => { console.error("FAIL:", message); process.exitCode = 1; };
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value, null, 2)); }
function run(label, shouldPass, expectedText = "") {
  const result = spawnSync(process.execPath, [validator, pipeline], {encoding:"utf8"});
  const output = result.stdout + result.stderr;
  const passed = shouldPass ? result.status === 0 : result.status !== 0;
  const textOkay = !expectedText || output.includes(expectedText);
  if (!passed || !textOkay) {
    fail(label + " (exit=" + result.status + ")\n" + output);
  } else {
    console.log("PASS:", label);
  }
}
try {
  fs.mkdirSync(path.join(pkgDir, "images"), {recursive:true});
  const pngHeader = (width, height) => {
    const b = Buffer.alloc(24);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(b,0);
    b.writeUInt32BE(13,8); b.write("IHDR",12,"ascii");
    b.writeUInt32BE(width,16); b.writeUInt32BE(height,20);
    return b;
  };
  const images = Array.from({length:8},(_,i)=>"images/card-"+String(i+1).padStart(2,"0")+".png");
  for (const image of images) fs.writeFileSync(path.join(pkgDir,image),pngHeader(1080,1440));
  writeJson(path.join(pipeline,"queue.json"), {
    schema_version:1, updated_at:"2026-10-26T22:00:00+08:00",
    packages:[{package_id:pkgId,path:"packages/"+pkgId,updated_at:"2026-10-26T22:00:00+08:00"}]
  });
  fs.writeFileSync(path.join(pkgDir,"proposal.md"),"# Approved proposal\n");
  fs.writeFileSync(path.join(pkgDir,"caption.txt"),"Caption and sources.");
  fs.writeFileSync(path.join(pkgDir,"source-notes.md"),"Verified source notes.");
  writeJson(path.join(pkgDir,"qa-report.json"),{status:"passed",visual_review:true,machine_checks:true});
  const pages={pages:images.map((image,i)=>({title:"第"+(i+1)+"页",body:"一条清楚的内容结论。",tags:"",image}))};
  writeJson(path.join(pkgDir,"pages.json"),pages);
  const manifest={
    schema_version:1,package_id:pkgId,state:"ready_for_workbuddy",content_type:"newspic",
    title:"把任务交给更好的AI",created_at:"2026-10-26T22:00:00+08:00",
    source:{primary_url:"https://example.com/source",title:"Verified source",verification_status:"verified"},
    approval:{status:"approved",approved_at:"2026-10-26T22:00:00+08:00",approved_by:"owner",scope:"draft_only",approved_proposal_sha256:"",evidence:"批准此包生成并保存草稿"},
    assets:{proposal:"proposal.md",caption:"caption.txt",source_notes:"source-notes.md",qa_report:"qa-report.json",pages:"pages.json",images},
    qa:{status:"passed",machine_checks:true,visual_review:true,reviewed_at:"2026-10-26T22:00:00+08:00"},
    delivery:{workbuddy_status:"not_downloaded",mobile_preview:"not_checked"}
  };
  const manifestPath=path.join(pkgDir,"manifest.json");
  writeJson(manifestPath,manifest);
  run("valid ready package passes",true);
  manifest.title="这个标题长到超过二十个Unicode字符的示例测试";
  writeJson(manifestPath,manifest);
  run("overlength newspic title is rejected",false,"max 20");
  manifest.title="把任务交给更好的AI";
  manifest.approval.scope="publish_after_approval";
  manifest.approval.evidence="";
  manifest.approval.approved_proposal_sha256="";
  writeJson(manifestPath,manifest);
  run("publish scope without evidence/hash is rejected",false,"publication requires approval evidence");
  manifest.approval.scope="draft_only";
  manifest.approval.evidence="批准保存草稿";
  manifest.approval.approved_proposal_sha256="";
  fs.writeFileSync(path.join(pkgDir,images[0]),pngHeader(1000,1000));
  writeJson(manifestPath,manifest);
  run("wrong image dimensions are rejected",false,"expected 1080x1440");
  console.log(process.exitCode ? "Content package contract tests failed." : "All content package contract tests passed.");
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
if (process.exitCode) process.exit(process.exitCode);
