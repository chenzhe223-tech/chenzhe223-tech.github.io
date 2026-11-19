import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
test('KNOWA homepage uses actual logo and versioned favicon, not placeholder',async()=>{
  const r=await worker.fetch(new Request('https://know.test/'),{});
  const html=await r.text();
  assert.equal(r.status,200);
  assert.match(html,/class="brand-icon"/);
  assert.match(html,/assets\/knowa-icon\.webp\?v=20261119/);
  assert.match(html,/rel="icon" type="image\/svg\+xml"/);
  assert.doesNotMatch(html,/class="logo">知<\/div>/);
  assert.match(html,/By DAVYLAB/);
});
test('favicon svg is self-contained and gives the same star-book-orbit identity',async()=>{
  const res=await worker.fetch(new Request('https://know.test/favicon.svg'),{});
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/image\/svg\+xml/);
  const svg=await res.text();
  assert.match(svg,/viewBox="0 0 256 256"/);
  assert.match(svg,/ellipse/);assert.match(svg,/path/);
});
test('actual cropped logo asset is a valid 2346-byte WebP image',async()=>{
  const res=await worker.fetch(new Request('https://know.test/assets/knowa-icon.webp'),{});
  assert.equal(res.status,200);
  assert.match(res.headers.get('content-type'),/image\/webp/);
  const b=new Uint8Array(await res.arrayBuffer());
  assert.equal(b.length,2346);
  assert.equal(new TextDecoder().decode(b.slice(0,4)),'RIFF');
  assert.equal(new TextDecoder().decode(b.slice(8,12)),'WEBP');
});
test('legacy favicon path redirects to brand asset',async()=>{
  const res=await worker.fetch(new Request('https://know.test/favicon.ico'),{});
  assert.equal(res.status,302);
  assert.match(res.headers.get('location'),/favicon\.svg\?v=20261119/);
});
