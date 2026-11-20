import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {orbitCss,orbitHtml,orbitScript} from '../src/orbit.js';
test('home: approved local globe and six categories',async()=>{
 const response=await worker.fetch(new Request('https://knowa.test/'),{});
 const html=await response.text();
 assert.equal(response.status,200);
 for(const id of ['orbit-scene','orbit-toggle','orbit-drawer','voice-button','refresh-tiles']) assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/assets\/knowa-blue-marble\.webp/);
 assert.equal((orbitHtml.match(/class="orbit-pill"/g)||[]).length,6);
 assert.match(orbitScript,/90000/);
 assert.match(orbitScript,/prefers-reduced-motion/);
 assert.match(html,/class="mobile-tabs"/);
 assert.match(html,/class="topnav"/);
 assert.match(orbitCss,/#[0-9a-f]{6}/i);
});
test('asset: original approved NASA Blue Marble served locally',async()=>{
 const response=await worker.fetch(new Request('https://knowa.test/assets/knowa-blue-marble.webp'),{});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'image/webp');
 const image=new Uint8Array(await response.arrayBuffer());
 assert.equal(image.length,96868);
 assert.equal(String.fromCharCode(...image.slice(0,4)),'RIFF');
 assert.equal(String.fromCharCode(...image.slice(8,12)),'WEBP');
});
test('free knowledge discovery API and source retained',async()=>{
 const html=await(await worker.fetch(new Request('https://knowa.test/'),{})).text();
 assert.match(html,/api\/discover\?batch=/);
 assert.match(html,/api\/ask/);
 assert.match(html,/slice\(part\*3,part\*3\+3\)/);
 const response=await worker.fetch(new Request('https://knowa.test/api/discover?batch=2'),{});
 const data=await response.json();
 assert.equal(data.total,36);
 assert.equal(data.cards.length,9);
});
test('AI quota still fails closed when disabled',async()=>{
 const response=await worker.fetch(new Request('https://knowa.test/api/health'),{AI_ENABLED:'false',DAILY_AI_LIMIT:'0'});
 const data=await response.json();
 assert.equal(data.version,'2.0.0-p1');
 assert.equal(data.aiConfigured,false);
});
