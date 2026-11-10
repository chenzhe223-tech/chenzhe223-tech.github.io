// WORLD/TOON V3 production-facing regression: never confuse metadata with artwork.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(base,'style-v3.js'),'utf8');
const worker=fs.readFileSync(path.join(base,'worker.js'),'utf8');
const page=fs.readFileSync(path.join(base,'index.html'),'utf8');
const css=fs.readFileSync(path.join(base,'style-v3.css'),'utf8');
const events={};
const scope={
 window:{}, document:{addEventListener:(name,fn)=>{events[name]=fn;}},
 selected:()=>({creativeDirection:{styleId:'chinese-historical-epic',quality:'Premium'}}),
 render(){}, mediaSrc:()=>'', notify(){}, saveFile(){}, setChange(){},
};
vm.runInNewContext(script,scope,{filename:'style-v3.js'});
const lib=scope.window.WTStyleV3;
assert.equal(lib.CATALOG.length,20);
assert.equal(new Set(lib.CATALOG.map(x=>x.style_id)).size,20);
assert.ok(lib.CATALOG.every(x=>x.reference.status==='not_licensed'&&x.sample.status==='not_generated'));
assert.ok(lib.CATALOG.every(x=>!lib.isReference(x.reference)&&!lib.isSample(x.sample)));
assert.ok(lib.CATALOG.every(x=>!Object.values(x.quality_capability).some(Boolean)));
assert.equal(lib.STYLE_GUIDES.length,20);
assert.ok(lib.CATALOG.every(x=>lib.isGuide(x.guide)));
const crypto=require('node:crypto');
const assetHashes=new Set();
for(const [i,style] of lib.CATALOG.entries()){
 const imagePath=path.join(base,'assets',`style-${String(i+1).padStart(2,'0')}.webp`);
 const bytes=fs.readFileSync(imagePath);
 assert.ok(bytes.byteLength>10000,`missing valid reference image: ${imagePath}`);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),style.guide.sha256);
 assetHashes.add(style.guide.sha256);
}
assert.equal(assetHashes.size,20,'style references must be 20 different images');

const cards=lib.cards({styleId:'chinese-historical-epic'});
assert.equal((cards.match(/data-director-style=/g)||[]).length,20);
assert.match(cards,/data-wt-v3-query/);
assert.equal((cards.match(/原创风格参考 · 非成品/g)||[]).length,20);
assert.equal((cards.match(/\.webp/g)||[]).length,20);
const detail=lib.detail({styleId:'chinese-historical-epic',quality:'Premium'});
assert.match(detail,/真实生成样张/);
assert.match(detail,/原创画风参考/);
assert.match(detail,/style-01\.webp/);
assert.match(detail,/未通过真实生图能力验证/);
assert.match(detail,/data-wt-v3-export-lock/);
const sha='a'.repeat(64);
scope.selected=()=>({creativeDirection:{styleId:'chinese-historical-epic',quality:'Premium',
 pilot:{panelImage:'media:original',panelSha256:sha,panelDimensions:{width:1080,height:1440}},
 pilotApproval:{pilot_frame_sha256:sha,repo_commit:'verified',approved_at:'2026-11-10T08:00:00Z'}}});
scope.mediaSrc=()=>'/media/real-original.png';
const proof=lib.detail({styleId:'chinese-historical-epic',quality:'Premium'});
assert.match(proof,/1080×1440/);
assert.match(proof,/私有仓已核验批准/);
assert.match(proof,/导出已批准风格锁定档案/);
assert.match(worker,/style-v3\\\.js/);
assert.match(worker,/style-v3\\\.css/);
assert.match(worker,/webp:'image\/webp'/);
assert.match(worker,/png\|webp/);
assert.ok(page.indexOf('style-v3.js')<page.indexOf('creative-director.js'));
assert.match(css,/max-width:650px/);
console.log('V3 regression: 20 verified original WebP images, truthful sample badges, route and layout PASS');
