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
assert.match(app, /await (?:putItem\(await sealProject\(project\)\)|persistProject\(project\))/, 'Skill project metadata must use the existing encrypted project store and persistence queue');

assert.match(app, /if\(a==='favorite'&&r\).*?persistRecord\(r\)/, 'API Key favourites must use the same encrypted autosave queue');
assert.match(app, /async function kpPruneExpiredTrash/, 'expired recycle-bin records must be safely purged');
assert.match(app, /Number\(item\.deletedAt\)===Number\(d\.deletedAt\)/, 'expiry cleanup must not purge a newer record reusing the same ID');
assert.match(app, /after-import-replace/, 'replace import must snapshot the resulting imported vault');
assert.match(app, /after-import-merge/, 'merge import must snapshot the resulting merged vault');
assert.match(app, /await kpPruneExpiredTrash\(\)/, 'recycle-bin display must process expired tombstones');
assert.match(app, /projects\.find\(p=>canonicalSkillRepoUrl\(p\.repoUrl\)\.toLowerCase\(\)===repoUrl\.toLowerCase\(\)\)/, 'imports must deduplicate by canonical repository URL');
assert.match(app, /window\.addEventListener\('storage'/, 'an already-open KeyPocket tab must notice new handoffs');
assert.match(app, /if\(!cryptoKey\).*请先解锁 KeyPocket/s, 'incoming Skills must wait for vault unlock before import UI');
assert.match(app, /window\.localStorage\.removeItem|writePendingRadarSkills|removePendingRadarSkill/, 'the pending queue must be manageable');

assert.match(appHtml, /id="importRadarSkillsBtn"/, 'KeyPocket must expose a manual pending-import entry point');
assert.match(appHtml, /app\.js\?v=[^"]+/, 'KeyPocket must use a cache-busted app bundle');

assert.match(app, /KP_SNAPSHOT_LATEST_ID='kp\.snapshot\.latest'/, 'local backups must use one stable latest-only slot');
assert.match(app, /id:KP_SNAPSHOT_LATEST_ID,kind:'local-encrypted-snapshot'/, 'local backups must overwrite the latest encrypted snapshot');
assert.doesNotMatch(app, /KP_SNAPSHOT_KEEP/, 'local backup history retention must be removed');
assert.match(app, /snapshot_type:'milestone',period_key:'latest'/, 'cloud backup must use one account-wide latest snapshot slot');
assert.match(app, /id=neq\.'\+encodeURIComponent\(latest\.id\)/, 'cloud backup must prune older account snapshots only after upsert');
assert.match(app, /&order=created_at\.desc&limit=1/, 'cloud backup center must display only the latest snapshot');
assert.match(app, /上一份有效备份保持不变/, 'failed local backup must preserve the previous valid snapshot');

assert.match(appHtml, /id="visualSettingsBtn"/, 'KeyPocket must expose the visual and motion settings menu');
assert.match(app, /KP_VISUAL_PREF_KEY='kp\.visual\.preferences\.v1'/, 'visual preferences must use a dedicated local settings key');
assert.match(app, /function kpApplyVisualPrefs/, 'visual preferences must apply to the UI');
assert.match(app, /function kpOpenVisualStudio/, 'visual studio settings panel must be interactive');
assert.match(app, /QORE 冰雾玻璃/, 'visual presets must include the QORE theme');
assert.match(app, /Editorial 纸感/, 'visual presets must include the Editorial theme');
assert.match(app, /Ocean Mist/, 'visual presets must include the Ocean Mist theme');
assert.match(app, /阳光 Sunshine/, 'visual presets must include the Sunshine theme');
assert.match(app, /薄荷 Mint/, 'visual presets must include the Mint theme');
assert.match(app, /蜜桃 Peach/, 'visual presets must include the Peach theme');
assert.match(app, /薰衣草 Lavender/, 'visual presets must include the Lavender theme');
assert.match(app, /data-vtab="theme"/, 'visual studio must expose theme controls');
assert.match(app, /data-vtab="motion"/, 'visual studio must expose motion controls');
assert.match(app, /data-vtab="layout"/, 'visual studio must expose layout controls');
assert.match(app, /kp-motion-fade.*kp-motion-rise.*kp-motion-float.*kp-motion-glow.*kp-motion-slide/s, 'motion effects must be selectable');
assert.match(appHtml, /prefers-reduced-motion:reduce/, 'custom motion must respect reduced-motion preference');
assert.match(app, /localStorage\.setItem\(KP_VISUAL_PREF_KEY/, 'visual preferences must persist locally');
assert.match(app, /kpVisualReset/, 'visual settings must offer an independent reset action');

console.log('PASS: Radar-to-KeyPocket Skill handoff source contract');
console.log('PASS: KeyPocket visual and motion customization source contract');
console.log('PASS: shared local queue key:', keyPocketQueueKey);
console.log('PASS: GitHub URL validation, encrypted project save, duplicate check and queue UI are wired');
