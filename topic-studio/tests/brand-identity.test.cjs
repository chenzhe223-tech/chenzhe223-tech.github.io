"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"brand/brand-studio.css"),"utf8");
const assets=[
 "brand/davylab-studio-mark.svg",
 "brand/davylab-studio-lockup.svg",
 "brand/davylab-studio-symbol.svg",
 "brand/inkora-mark.svg",
];
for(const filename of assets){
 const source=fs.readFileSync(path.join(root,filename),"utf8");
 assert.match(source,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(source,/<title/);
 assert.match(source,/<\/svg>\s*$/);
 assert.match(source,/#[0-9A-Fa-f]{6}/);
 assert.doesNotMatch(source,/<script|onload=|javascript:|data:|<foreignObject/i);
}
assert.ok(html.includes('rel="icon" type="image/svg+xml" href="./brand/inkora-mark.svg"'));
assert.ok(html.includes('class="brand-symbol" src="./brand/inkora-mark.svg"'));
assert.ok(html.includes('class="crumb-brand-mark" src="./brand/inkora-mark.svg"'));
assert.ok(html.includes('class="footer-brand"'));
assert.ok(html.includes('brand/brand-studio.css?v=20261114-b1'));
assert.equal((html.match(/class="brand-symbol"/g)||[]).length,1);
assert.equal((html.match(/class="crumb-brand-mark"/g)||[]).length,1);
assert.match(css,/--dl-brand-navy:#142B40/);
assert.match(css,/--dl-brand-blue:#2D78D7/);
assert.match(css,/#appNavigation \.brand-symbol/);
assert.match(css,/#appNavigation \.nav\.active:before/);
assert.match(css,/\.topbar \.crumb \.crumb-brand-name/);
assert.match(css,/\.mobile-app-cover:before/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css,/linear-gradient|radial-gradient/);
assert.ok(html.includes('id="section-research"')&&html.includes('id="section-growth"'));
console.log("PASS DAVYLAB Editorial brand vectors, favicon, navigation/masthead, mobile, focus and asset contracts");

const inkora=fs.readFileSync(path.join(root,"inkora-theme.css"),"utf8");
assert(html.includes("<title>INKORA · 墨界 · AI 创作平台</title>"));
assert(html.includes('data-inkora-theme="inkora"')&&html.includes('data-visual-theme="inkora"'));
assert(inkora.includes("--paper:#F4F3F0")&&inkora.includes("--card:#FFFFFF")&&inkora.includes("--nav:#202121"));
assert(inkora.includes("inkora-paper-brush.svg")&&inkora.includes(":not(#atPreview *)"));
const illustration=fs.readFileSync(path.join(root,"brand/inkora-paper-brush.svg"),"utf8");
assert(illustration.includes("<svg")&&illustration.includes("纸张、毛笔与墨迹"));
assert.doesNotMatch(illustration,/<script|onload=|javascript:|<foreignObject/i);
console.log("PASS INKORA paper-white brand and preview isolation contracts");
