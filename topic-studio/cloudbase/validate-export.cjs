#!/usr/bin/env node
"use strict";
// P0 local/offline validator. Does NOT call CloudBase or upload content.
const fs=require("node:fs");
const crypto=require("node:crypto");
const path=require("node:path");
const filename=process.argv[2];
if(!filename){console.error("Usage: node validate-export.cjs <local-topic-export.json>");process.exit(2)}
let document;
try{
 const size=fs.statSync(filename).size;
 if(size>10*1024*1024)throw Error("File exceeds 10MB; review before migrating");
 document=JSON.parse(fs.readFileSync(filename,"utf8"));
}catch(err){console.error("Invalid local JSON: "+err.message);process.exit(2)}
const list=Array.isArray(document)?document:document?.topics;
if(!Array.isArray(list)){console.error("Expected exported array or {topics: [...]}; no data changed");process.exit(2)}
const seen=new Set();let dup=0,invalid=0,scheduled=0,visual=0,nonDraft=0;
const kinds={};
for(const t of list){
 if(!t||typeof t!=="object"||Array.isArray(t)||typeof t.title!=="string"||!t.title.trim()){invalid++;continue}
 const id=String(t.id||"");
 if(!id||seen.has(id)){if(id)dup++;else invalid++;continue}
 seen.add(id);
 if(t.plannedDate)scheduled++;
 if(t.visualPlan)visual++;
 if(t.status==="published"||t.status==="approved")nonDraft++;
 kinds[t.format||"unknown"]=(kinds[t.format||"unknown"]||0)+1;
}
const summary={
 mode:"OFFLINE_DRY_RUN_NO_CLOUD_WRITE",
 filename:path.basename(filename),
 sha256:crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex"),
 total:list.length,valid:seen.size,duplicates:dup,invalid,
 plannedDates:scheduled,visualPlans:visual,existingApprovedOrPublished:nonDraft,
 formats:kinds,
 safeToAutoMigrate:false,
 next:"Keep the original export. Verify CloudBase DB type, login and owner-only rules first."
};
console.log(JSON.stringify(summary,null,2));
if(dup||invalid)process.exitCode=1;
