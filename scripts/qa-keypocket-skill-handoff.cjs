'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const app = read('keypocket/app.js');
const appHtml = read('keypocket/index.html');
const radarHtml = read('radar/daily/index.html');

function constantValue(source, name) {
  const line = source.split('\n').find((entry) => new RegExp('^const\\s+' + name + '\\s*=').test(entry));
  assert.ok(line, 'missing constant: ' + name);
  const match = line.match(/=\s*["']([^"']+)["']/);
  assert.ok(match, 'constant value must be a quoted string: ' + name);
  return match[1];
}

const radarQueueKey = constantValue(radarHtml, 'KEYPOCKET_PENDING_SKILL_KEY');
const keyPocketQueueKey = constantValue(app, 'KEYPOCKET_PENDING_SKILL_KEY');
assert.equal(radarQueueKey, keyPocketQueueKey, 'Radar and KeyPocket must share the same queue key');

assert.match(radarHtml, /data-kp-skill-save="1"/, 'daily brief must render a KeyPocket collection action');
assert.match(radarHtml, /KEYPOCKET_APP_URL="https:\/\/chenzhe223-tech\.github\.io\/keypocket\/"/, 'handoff must target the production KeyPocket app');
assert.match(radarHtml, /window\.localStorage\.setItem\(KEYPOCKET_PENDING_SKILL_KEY,JSON\.stringify\(queue\)\)/, 'Radar must enqueue metadata before opening KeyPocket');
assert.match(radarHtml, /protocol!=="https:"/, 'Radar handoff must reject non-HTTPS repositories');
assert.match(radarHtml, /hostname\.toLowerCase\(\)!=="github\.com"/, 'Radar handoff must reject non-GitHub URLs');

assert.match(app, /function canonicalSkillRepoUrl/, 'KeyPocket must validate incoming repository URLs');
assert.match(app, /function readPendingRadarSkills/, 'KeyPocket must validate the pending queue');
assert.match(app, /await putItem\(await sealProject\(project\)\)/, 'Skill project metadata must use the existing encrypted project store');
assert.match(app, /projects\.find\(p=>canonicalSkillRepoUrl\(p\.repoUrl\)\.toLowerCase\(\)===repoUrl\.toLowerCase\(\)\)/, 'imports must deduplicate by canonical repository URL');
assert.match(app, /window\.addEventListener\('storage'/, 'an already-open KeyPocket tab must notice new handoffs');
assert.match(app, /if\(!cryptoKey\).*请先解锁 KeyPocket/s, 'incoming Skills must wait for vault unlock before import UI');
assert.match(app, /window\.localStorage\.removeItem|writePendingRadarSkills|removePendingRadarSkill/, 'the pending queue must be manageable');

assert.match(appHtml, /id="importRadarSkillsBtn"/, 'KeyPocket must expose a manual pending-import entry point');
assert.match(appHtml, /app\.js\?v=kp-radar-skill-bridge-1/, 'KeyPocket must use a cache-busted app bundle');

console.log('PASS: Radar-to-KeyPocket Skill handoff source contract');
console.log('PASS: shared local queue key:', keyPocketQueueKey);
console.log('PASS: GitHub URL validation, encrypted project save, duplicate check and queue UI are wired');
