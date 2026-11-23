const assert=require("node:assert/strict"),fs=require("node:fs");
const worker=fs.readFileSync("comic-studio/worker.js","utf8");
const html=fs.readFileSync("comic-studio/index.html","utf8");
const widget=fs.readFileSync("news-engine/p3-widget.js","utf8");
const css=fs.readFileSync("comic-studio/news-history-p3.css","utf8");
const a=widget.indexOf("const css=["),b=widget.indexOf('].join("");',a);
assert.ok(a>0&&b>a);
const expected=JSON.parse("["+widget.slice(a+"const css=[".length,b)+"]").join("\n")+"\n";
assert.equal(css,expected,"External CSS must be exactly P3 canonical source");
assert.ok(worker.includes("briefing\\.js|news-history-p3\\.js|news-history-p3\\.css|archive\\.js"),
 "Cloudflare Worker must serve both first party P3 files");
assert.match(worker,/script-src 'self'; style-src 'self' https:\/\/fonts\.googleapis\.com/,"WorldToon strict CSP preserved");
assert.ok(html.includes('href="news-history-p3.css?v=20261123-p3" data-ne-p3-css'));
assert.ok(html.includes('src="news-history-p3.js?v=20261123-p3" defer'));
assert.ok(widget.includes('document.querySelector("link[data-ne-p3-css]")'),
 "No extra CSP-blocked inline style from WorldToon history widget");
const copies=["comic-studio/news-history-p3.js","topic-studio/news-history-p3.js"];
assert.ok(copies.every(x=>fs.readFileSync(x,"utf8")===widget),"Audited widget copies must be exact");
console.log("PASS: WorldToon explicit static file allowlist + strict CSP; P3 CSS source integrity; shared script identity");
