'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('V1 local database and crypto formats remain available', () => {
  const app = read('app.js');
  assert.match(app, /keypocket-local-v1/);
  assert.match(app, /AES-GCM/);
  assert.match(app, /PBKDF2/);
  assert.match(app, /310000/);
  assert.match(app, /function sealRecord/);
  assert.match(app, /function openRecord/);
});

test('V2 autosave, snapshots and trash use existing encrypted IndexedDB records', () => {
  const app = read('app-v2.js');
  assert.match(app, /kp2CreateLocalSnapshot/);
  assert.match(app, /encryptJson/);
  assert.match(app, /kp2RestoreLocalSnapshot/);
  assert.match(app, /kp2Trash/);
  assert.match(app, /expiresAt/);
  assert.match(app, /30 \* 86400000/);
});

test('V2 sync is per-record and the RPC compares server versions', () => {
  const app = read('app-v2.js');
  const sql = read('supabase/migrations/20261102102000_keypocket_v2_encrypted_sync_backup_devices.sql');
  assert.match(app, /keypocket_sync_items/);
  assert.match(app, /keypocket_upsert_sync_item/);
  assert.match(app, /p_deleted_at/);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /excluded\.version\s*>\s*public\.keypocket_sync_items\.version/i);
  assert.match(sql, /payload \? 'iv'/);
});

test('Skill Radar preserves real daily samples and does not synthesize growth', () => {
  const collector = read('scripts/collect-skill-radar.cjs');
  const app = read('app-v2.js');
  const sql = read('supabase/migrations/20261102102100_keypocket_skill_radar_historical_snapshots.sql');
  assert.match(collector, /sampled_on/);
  assert.match(collector, /readme_relevance/);
  assert.match(collector, /repo_id,sampled_on/);
  assert.match(app, /KP2_PERIODS/);
  assert.match(app, /正在积累真实历史数据/);
  assert.match(sql, /unique\(repo_id,sampled_on\)/i);
});

test('GitHub Worker accepts only a fixed encrypted vault payload and repository', () => {
  const worker = read('worker/github-app/src/index.js');
  assert.match(worker, /keypocket-cloud-vault/);
  assert.match(worker, /keypocket-vault\.v2\.json/);
  assert.match(worker, /GITHUB_APP_PRIVATE_KEY/);
  assert.match(worker, /SESSION_SECRET/);
  assert.match(worker, /validEnvelope/);
  assert.match(worker, /permissions:\{contents:'write',metadata:'read'\}/);
  assert.doesNotMatch(worker, /console\.log\(.*token/i);
});

test('Static HTML loads V1 before V2 and permits the configured Worker origin', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('app.js?v=kp-v2-') < html.indexOf('app-v2.js?v=kp-v2-'));
  assert.match(html, /https:\/\/\*\.workers\.dev/);
});
