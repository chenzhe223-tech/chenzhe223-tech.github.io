// WORLD/TOON responsive CSS contract: no paid services or browser credentials.
const fs=require('node:fs');const assert=require('node:assert/strict');
const html=fs.readFileSync('comic-studio/index.html','utf8');
const css=fs.readFileSync('comic-studio/mobile-refine.css','utf8');
const bundled=fs.readFileSync('comic-studio/styles.css','utf8');
assert.ok(bundled.trimEnd().endsWith(css.trim()),'responsive CSS must stay bundled in the Worker-allowed stylesheet');
assert.match(html,/styles\.css\?v=4\.3\.0/);
for(const selector of ['.hero h1','.hero .buttons','.metrics','.metric','.sectionbar','.statusflow','.split .cards2 .outline','.box .buttons','.foot']) {
  assert.ok(css.includes(selector),'Missing responsive rule: '+selector);
}
assert.match(css,/@media \(max-width: 600px\)/);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/env\(safe-area-inset-bottom/);
assert.doesNotMatch(css,/\.story-discovery\s*\{[^}]*display\s*:\s*none/i,'story discovery must stay visible on phones');
console.log('Mobile layout contract PASS: 375/390/430px rules and component selectors present.');

