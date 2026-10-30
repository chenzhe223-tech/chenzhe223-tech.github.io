import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync(new URL("../visual-dna-layout.js",import.meta.url),"utf8");
const context={};vm.runInNewContext(source,context);
const api=context.DavyLayoutConfig;
test("normalizes all six real layout presets",()=>{for(const preset of ["editorial","balanced","vertical","compact","bento","split"])assert.equal(api.normalize({layout:{preset}}).layout.preset,preset)});
test("normalizes all six navigation modes",()=>{for(const mode of ["left","right","top","bottom","floating","hidden"])assert.equal(api.normalize({navigation:{mode}}).navigation.mode,mode)});
test("rejects unknown values and clamps numeric controls",()=>{const x=api.normalize({layout:{preset:"unknown",gap:90,customWidth:200},navigation:{mode:"unknown",sidebarWidth:500}});assert.equal(x.layout.preset,"editorial");assert.equal(x.layout.gap,32);assert.equal(x.layout.customWidth,960);assert.equal(x.navigation.mode,"left");assert.equal(x.navigation.sidebarWidth,320)});
test("layout reset preserves theme, font and motion",()=>{const input={theme:"ocean",font:"serif",motion:{enabled:false},layout:{preset:"bento"},navigation:{mode:"right",sidebarWidth:260}};const x=api.resetLayout(input);assert.equal(x.theme,"ocean");assert.equal(x.font,"serif");assert.equal(x.motion.enabled,false);assert.equal(x.layout.preset,"editorial");assert.equal(x.navigation.mode,"left")});
test("navigation reset preserves layout",()=>{const input={layout:{preset:"split",gap:24},navigation:{mode:"hidden"}};const x=api.resetNavigation(input);assert.equal(x.layout.preset,"split");assert.equal(x.layout.gap,24);assert.equal(x.navigation.mode,"left")});
test("legacy and malformed settings fall back safely",()=>{assert.equal(api.normalize(null).layout.preset,"editorial");assert.equal(api.normalize({layout:{preset:"bento"}}).navigation.mode,"left")});

test("null numeric settings use defaults instead of minimum values",()=>{const x=api.normalize({layout:{gap:null,customWidth:null},navigation:{sidebarWidth:null}});assert.equal(x.layout.gap,18);assert.equal(x.layout.customWidth,1600);assert.equal(x.navigation.sidebarWidth,225)});
