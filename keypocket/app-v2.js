/* KeyPocket V2.0 additive runtime — preserve the v1 IndexedDB and AES-GCM format. */
'use strict';
const KP2 = {
  prefix: 'kpv2:',
  deviceKey: 'kp.v2.device-id',
  autoSyncKey: 'kp.v2.auto-sync',
  migratedKey: 'kp.v2.legacy-migrated',
  syncTable: 'keypocket_sync_items',
  metaTable: 'keypocket_sync_meta',
  backupTable: 'keypocket_backup_snapshots',
  devicesTable: 'keypocket_devices',
  radarTable: 'keypocket_skill_repos',
  historyTable: 'keypocket_skill_snapshots',
  snapshotTimer: 0,
  syncTimer: 0,
  syncBusy: false,
  initialized: false,
  board: 'monthly',
  workerUrl: window.KP_V2_GITHUB_WORKER_URL || '',
  radarRows: [],
  radarHistory: [],
  cloudKey: null
};
const kp2AllItems = allItems;
const kp2PutItem = putItem;
const kp2DeleteItem = deleteItem;
const kp2WriteItems = writeItems;
function kp2System(row) { return !!row?.id && String(row.id).startsWith(KP2.prefix); }
function kp2Id(kind, value) { return KP2.prefix + kind + ':' + value; }
function kp2Device() {
  let id = localStorage.getItem(KP2.deviceKey);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KP2.deviceKey, id); }
  return id;
}
function kp2Time(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '未知时间' : d.toLocaleString();
}
function kp2Status(id, message, error = false) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.toggle('ok', !error);
}
function kp2Rows() { return kp2AllItems(); }
function kp2RawRows() { return kp2AllItemsRaw(); }
function kp2AllItemsRaw() { return new Promise((resolve, reject) => {
  const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
  req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
});}
function kp2RawGet(id) { return new Promise((resolve, reject) => {
  const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});}
async function kp2RawPut(row) { return kp2PutItem(row); }
async function kp2RawRemove(id) { return kp2DeleteItemRaw(id); }
function kp2DeleteItemRaw(id) { return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id);
  tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
});}
function kp2WriteRaw(rows, clear = false) { return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
  if (clear) store.clear();
  for (const row of rows) store.put(row);
  tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('本地事务中止'));
});}
function kp2LocalSnapshotSchedule() {
  if (!cryptoKey || !db) return;
  clearTimeout(KP2.snapshotTimer);
  KP2.snapshotTimer = setTimeout(async () => {
    try {
      await kp2CreateLocalSnapshot('autosave', 'latest');
      await kp2CreateLocalSnapshot('daily', new Date().toISOString().slice(0, 10));
      await kp2CreateLocalSnapshot('monthly', new Date().toISOString().slice(0, 7));
      kp2Status('kp2BackupStatus', '自动保存成功：本地加密检查点已更新。', false);
      kp2ScheduleCloudSync();
      if (kp2GitHubSession()?.token) kp2GitHubBackup().catch(e => kp2Status('kp2GitHubStatus', 'GitHub 自动备份待重试：' + e.message, true));
    } catch (e) {
      kp2Status('kp2BackupStatus', '本地自动备份失败：' + (e.message || '请检查存储空间'), true);
    }
  }, 900);
}
async function kp2CreateLocalSnapshot(type, key) {
  if (!cryptoKey) return null;
  const now = Date.now();
  const rows = (await kp2AllItemsRaw()).filter(x => x.id !== 'vault-meta' && x.kind !== 'kp2-snapshot');
  const payload = await encryptJson({
    schemaVersion: 2, snapshotType: type, periodKey: key,
    createdAt: now, items: rows
  }, cryptoKey);
  const id = kp2Id('snapshot', type + ':' + key);
  const existing = await kp2RawGet(id);
  if (existing && type !== 'autosave') return id;
  await kp2WriteRaw([{
    id, kind: 'kp2-snapshot', snapshotType: type, periodKey: key,
    createdAt: now, itemCount: rows.length,
    recordCount: records.length, projectCount: projects.length,
    iv: payload.iv, data: payload.data
  }]);
  await kp2PruneLocalSnapshots();
  kp2RenderBackups();
  return id;
}
async function kp2ImportantSnapshot(reason) {
  try { await kp2CreateLocalSnapshot('milestone', reason + ':' + Date.now()); }
  catch (e) { console.warn('KeyPocket milestone snapshot failed', e); }
}
async function kp2PruneLocalSnapshots() {
  const rows = (await kp2AllItemsRaw()).filter(x => x.kind === 'kp2-snapshot');
  const keep = new Set();
  for (const [kind, limit] of [['autosave', 1], ['daily', 30], ['monthly', 12], ['milestone', 24]]) {
    rows.filter(x => x.snapshotType === kind).sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit).forEach(x => keep.add(x.id));
  }
  for (const row of rows) if (!keep.has(row.id)) await kp2DeleteItemRaw(row.id);
}
async function kp2RestoreLocalSnapshot(id) {
  const row = await kp2RawGet(id);
  if (!row || row.kind !== 'kp2-snapshot') throw Error('本地快照不存在。');
  const decoded = await decryptJson({ iv: row.iv, data: row.data }, cryptoKey);
  if (decoded.schemaVersion !== 2 || !Array.isArray(decoded.items)) throw Error('快照格式无效。');
  await kp2ImportantSnapshot('restore-before');
  const all = await kp2AllItemsRaw();
  const snapshots = all.filter(x => x.kind === 'kp2-snapshot');
  await kp2WriteRaw([{ ...vault }, ...decoded.items, ...snapshots], true);
  await kp2Reload();
  kp2RenderEverything();
  showToast('已从本地历史版本恢复 ' + decoded.items.length + ' 项数据');
}
async function kp2Reload() {
  const rows = (await kp2AllItemsRaw()).filter(x => x.id !== 'vault-meta' && !kp2System(x));
  records = await Promise.all(rows.filter(x => x.kind !== 'project' && !String(x.id).startsWith('project:')).map(openRecord));
  projects = await Promise.all(rows.filter(x => x.kind === 'project' || String(x.id).startsWith('project:')).map(openProject));
}
async function kp2ExpireTrash() {
  const rows = (await kp2AllItemsRaw()).filter(x => x.kind === 'kp2-trash');
  for (const row of rows) if (Number(row.expiresAt) <= Date.now()) await kp2DeleteItemRaw(row.id);
}
async function kp2Trash(type, id) {
  if (!cryptoKey) throw Error('请先解锁 KeyPocket。');
  const dbId = type === 'project' ? 'project:' + id : id;
  const wrapped = await kp2RawGet(dbId);
  if (!wrapped) throw Error('原记录不存在，未执行删除。');
  const deletedAt = Date.now();
  await kp2ImportantSnapshot('before-delete');
  await kp2RawPut({
    id: kp2Id('trash', type + ':' + id), kind: 'kp2-trash',
    entityType: type, entityId: String(id), deletedAt,
    expiresAt: deletedAt + 30 * 86400000, version: deletedAt,
    deviceId: kp2Device(), wrapped
  });
  await kp2DeleteItemRaw(dbId);
  if (type === 'project') projects = projects.filter(x => x.id !== id);
  else records = records.filter(x => x.id !== id);
  render(); renderProjects(); kp2RenderTrash(); kp2LocalSnapshotSchedule();
  showToast((type === 'project' ? '项目 / Skill' : 'API Key') + ' 已移入回收站，保留 30 天');
}
async function kp2RestoreTrash(id) {
  const row = await kp2RawGet(id);
  if (!row || row.kind !== 'kp2-trash') throw Error('回收站条目不存在。');
  if (row.expiresAt <= Date.now()) throw Error('该条目已超过 30 天保留期限。');
  if (await kp2RawGet(row.wrapped.id)) throw Error('相同 ID 已存在，请先解决冲突。');
  await kp2ImportantSnapshot('before-trash-restore');
  const entity = row.entityType === 'project' ? await openProject(row.wrapped) : await openRecord(row.wrapped);
  entity.updatedAt = Date.now();
  const wrapped = row.entityType === 'project' ? await sealProject(entity) : await sealRecord(entity);
  await kp2RawPut(wrapped); await kp2DeleteItemRaw(id);
  if (row.entityType === 'project') projects.push(entity); else records.push(entity);
  render(); renderProjects(); kp2RenderTrash(); kp2LocalSnapshotSchedule();
  showToast('记录已恢复，原 ID 和关联信息保留');
}
async function kp2PermanentlyDelete(id) {
  if (!confirm('永久删除后无法从回收站恢复。确定继续吗？')) return;
  await kp2ImportantSnapshot('before-permanent-delete');
  await kp2DeleteItemRaw(id);
  kp2RenderTrash(); kp2LocalSnapshotSchedule();
  showToast('此设备的回收站副本已永久删除；云端墓碑保留以防旧设备重新上传。');
}
async function kp2BatchRestore() {
  const ids = [...document.querySelectorAll('[data-kp2-trash-check]:checked')].map(x => x.value);
  let ok = 0, failed = 0;
  for (const id of ids) { try { await kp2RestoreTrash(id); ok++; } catch (e) { failed++; } }
  showToast('批量恢复 ' + ok + ' 条' + (failed ? '，' + failed + ' 条未恢复' : ''));
}
async function kp2RenderTrash() {
  const host = document.getElementById('kp2TrashRows');
  if (!host) return;
  try {
    const rows = (await kp2AllItemsRaw()).filter(x => x.kind === 'kp2-trash').sort((a, b) => b.deletedAt - a.deletedAt);
    if (!rows.length) { host.innerHTML = '<div class="kp2-empty">回收站为空。删除项目、Skill 和 API Key 会保留 30 天。</div>'; return; }
    const cards = await Promise.all(rows.map(async row => {
      let label = row.entityId;
      try {
        const value = row.entityType === 'project' ? await openProject(row.wrapped) : await openRecord(row.wrapped);
        label = value.name || value.providerName || row.entityId;
      } catch {}
      const days = Math.max(0, Math.ceil((row.expiresAt - Date.now()) / 86400000));
      return '<article class="kp2-row"><input type="checkbox" data-kp2-trash-check value="' + esc(row.id) + '"><div class="kp2-row-copy"><strong>' + esc(label) + '</strong><small>' + (row.entityType === 'project' ? '项目 / Skill' : 'API Key') + ' · 删除于 ' + esc(kp2Time(row.deletedAt)) + ' · 剩余 ' + days + ' 天</small></div><button class="btn" data-kp2-restore="' + esc(row.id) + '">恢复</button><button class="btn danger" data-kp2-purge="' + esc(row.id) + '">永久删除</button></article>';
    }));
    host.innerHTML = cards.join('');
  } catch (e) { kp2Status('kp2TrashStatus', '回收站读取失败：' + e.message, true); }
}
async function kp2RenderBackups() {
  const host = document.getElementById('kp2LocalSnapshots');
  if (!host) return;
  const rows = (await kp2AllItemsRaw()).filter(x => x.kind === 'kp2-snapshot').sort((a, b) => b.createdAt - a.createdAt);
  const counts = Object.fromEntries(['autosave','daily','monthly','milestone'].map(k => [k, rows.filter(x => x.snapshotType === k).length]));
  const summary = document.getElementById('kp2BackupSummary');
  if (summary) summary.textContent = '本地加密检查点：' + counts.autosave + ' 个；每日 ' + counts.daily + '/30；月度归档 ' + counts.monthly + '/12；重要操作 ' + counts.milestone + ' 个。最近：' + (rows[0] ? kp2Time(rows[0].createdAt) : '无');
  host.innerHTML = rows.length ? rows.map(x => '<article class="kp2-row"><div class="kp2-row-copy"><strong>' + esc(({autosave:'自动保存检查点',daily:'每日快照',monthly:'月度归档',milestone:'重要操作快照'})[x.snapshotType] || '历史快照') + '</strong><small>' + esc(x.periodKey) + ' · ' + esc(kp2Time(x.createdAt)) + ' · ' + x.itemCount + ' 项</small></div><button class="btn" data-kp2-local-restore="' + esc(x.id) + '">恢复此版本</button></article>').join('') : '<div class="kp2-empty">解锁后会自动创建加密检查点。</div>';
  const cloud = document.getElementById('kp2CloudHint');
  if (cloud) cloud.textContent = kpSession()?.access_token ? '登录同步账号后，成功同步时自动创建云端加密快照。' : '尚未登录。当前只有本地快照，不能防止浏览器数据被清除。';
}
function kp2RenderEverything() {
  kp2RenderTrash(); kp2RenderBackups(); kp2RenderSync();
  kp2RenderGitHub();
}
function kp2Headers(extra = {}) {
  const session = kpSession();
  if (!session?.access_token) throw Error('请先登录同步账号。');
  return Object.assign({ apikey: KP_SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, extra);
}
async function kp2Rest(table, method = 'GET', query = '', body, extra = {}) {
  const response = await fetch(KP_SUPABASE_URL + '/rest/v1/' + table + (query ? '?' + query : ''), {
    method, headers: kp2Headers(extra), body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!response.ok) throw Error(data?.message || data?.hint || data?.error || ('Supabase HTTP ' + response.status));
  return data;
}
async function kp2SharedKey() {
  const userId = kpSession()?.user?.id;
  if (!userId || !window.kpSyncMasterPassword) throw Error('请重新登录并解锁本地密钥库。');
  const query = 'select=user_id,key_salt,iterations&user_id=eq.' + encodeURIComponent(userId) + '&limit=1';
  let rows = await kp2Rest(KP2.metaTable, 'GET', query);
  let meta = rows?.[0];
  if (!meta) {
    const candidate = { user_id: userId, key_salt: toB64(randomBytes(16)), iterations: 310000, schema_version: 2 };
    try { await kp2Rest(KP2.metaTable, 'POST', 'on_conflict=user_id', candidate, { Prefer: 'resolution=merge-duplicates,return=minimal' }); } catch {}
    rows = await kp2Rest(KP2.metaTable, 'GET', query); meta = rows?.[0];
  }
  if (!meta?.key_salt) throw Error('云端加密配置初始化失败。');
  const salt = fromB64(meta.key_salt);
  if (salt.length !== 16) throw Error('云端加密参数无效。');
  return { key: await deriveKey(window.kpSyncMasterPassword, salt, Number(meta.iterations) || 310000), salt: meta.key_salt, iterations: Number(meta.iterations) || 310000 };
}
async function kp2EnsureDevice() {
  const userId = kpSession().user.id, id = kp2Device();
  await kp2Rest(KP2.devicesTable, 'POST', 'on_conflict=user_id,device_id', {
    user_id: userId, device_id: id,
    device_label: /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone / iPad 浏览器' : /Android/.test(navigator.userAgent) ? 'Android 浏览器' : 'Desktop 浏览器',
    last_seen_at: new Date().toISOString(), revoked_at: null
  }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
}
function kp2Compare(a, b) {
  const av = Number(a?.version || 0), bv = Number(b?.version || 0);
  if (av !== bv) return av > bv ? 1 : -1;
  const at = String(a?.updated_at || ''), bt = String(b?.updated_at || '');
  if (at !== bt) return at > bt ? 1 : -1;
  const ad = String(a?.device_id || ''), bd = String(b?.device_id || '');
  return ad === bd ? 0 : ad > bd ? 1 : -1;
}
async function kp2LocalStates(shared) {
  const rows = await kp2AllItemsRaw(), result = new Map();
  for (const raw of rows) {
    if (raw.id === 'vault-meta' || raw.kind === 'kp2-snapshot' || raw.kind === 'kp2-trash' || kp2System(raw)) continue;
    const type = raw.kind === 'project' || String(raw.id).startsWith('project:') ? 'project' : 'key';
    const plain = type === 'project' ? await openProject(raw) : await openRecord(raw);
    const version = Math.max(1, Math.trunc(Number(plain.updatedAt) || Date.now()));
    const state = { entity_type:type, entity_id:String(plain.id), version, updated_at:new Date(version).toISOString(), device_id:plain._kpSyncDeviceId || kp2Device(), deleted_at:null, plain };
    const key = type + ':' + plain.id;
    if (!result.has(key) || kp2Compare(state, result.get(key)) > 0) result.set(key, state);
  }
  for (const trash of rows.filter(x => x.kind === 'kp2-trash')) {
    const plain = trash.entityType === 'project' ? await openProject(trash.wrapped) : await openRecord(trash.wrapped);
    const version = Math.max(Number(trash.version) || 0, Number(trash.deletedAt) || 1);
    const state = { entity_type:trash.entityType, entity_id:String(trash.entityId), version, updated_at:new Date(version).toISOString(), device_id:trash.deviceId || kp2Device(), deleted_at:new Date(trash.deletedAt).toISOString(), plain };
    const key = state.entity_type + ':' + state.entity_id;
    if (!result.has(key) || kp2Compare(state, result.get(key)) > 0) result.set(key, state);
  }
  for (const row of result.values()) row.payload = await encryptJson(row.plain, shared.key);
  return result;
}
async function kp2ApplyRemote(row, shared) {
  const plain = await decryptJson(row.payload, shared.key);
  if (!plain || typeof plain.id !== 'string') throw Error('云端密文无法解密；本地数据未修改。');
  plain.updatedAt = Number(row.version) || Date.parse(row.updated_at) || Date.now();
  plain._kpSyncDeviceId = row.device_id;
  const type = row.entity_type, id = String(row.entity_id);
  const dbId = type === 'project' ? 'project:' + id : id;
  const trashId = kp2Id('trash', type + ':' + id);
  const existing = await kp2RawGet(trashId);
  if (row.deleted_at) {
    const deletedAt = Date.parse(row.deleted_at) || Date.now();
    if (deletedAt + 30 * 86400000 <= Date.now()) {
      await kp2DeleteItemRaw(dbId);
      if (type === 'project') projects = projects.filter(x => x.id !== id); else records = records.filter(x => x.id !== id);
      return;
    }
    const wrapped = type === 'project' ? await sealProject(plain) : await sealRecord(plain);
    await kp2RawPut({ id:trashId, kind:'kp2-trash', entityType:type, entityId:id, deletedAt:Date.parse(row.deleted_at) || Date.now(), expiresAt:(Date.parse(row.deleted_at) || Date.now())+30*86400000, version:Number(row.version), deviceId:row.device_id, wrapped });
    await kp2DeleteItemRaw(dbId);
    if (type === 'project') projects = projects.filter(x => x.id !== id); else records = records.filter(x => x.id !== id);
  } else {
    const wrapped = type === 'project' ? await sealProject(plain) : await sealRecord(plain);
    await kp2RawPut(wrapped);
    if (existing) await kp2DeleteItemRaw(trashId);
    if (type === 'project') { projects = projects.filter(x => x.id !== id); projects.push(plain); }
    else { records = records.filter(x => x.id !== id); records.push(plain); }
  }
}
async function kp2MigrateLegacy(shared) {
  if (localStorage.getItem(KP2.migratedKey) === '1') return;
  const response = await kpCloudRequest('GET'), legacy = Array.isArray(response) ? response[0] : null;
  if (legacy?.payload) {
    const old = legacy.payload, key = await deriveKey(window.kpSyncMasterPassword, fromB64(old.salt), Number(old.iterations) || 310000);
    const decoded = await decryptJson({ iv:old.iv, data:old.data }, key);
    if (decoded?.schemaVersion !== 1 || !Array.isArray(decoded.records) || !Array.isArray(decoded.projects)) throw Error('旧版云端资料无法识别，未改动任何数据。');
    for (const item of decoded.records) if (!records.some(x => x.id === item.id)) { await kp2PutItem(await sealRecord(item)); records.push(item); }
    for (const item of decoded.projects) if (!projects.some(x => x.id === item.id)) { await kp2PutItem(await sealProject(item)); projects.push(item); }
    showToast('旧版云端资料已导入本机，正在转入 V2 增量同步');
  }
  localStorage.setItem(KP2.migratedKey, '1');
}
async function kp2CloudSnapshot(shared, type) {
  const now = new Date(), day = now.toISOString().slice(0,10), period = type === 'monthly' ? day.slice(0,7) : day;
  const trashRows = (await kp2AllItemsRaw()).filter(x => x.kind === 'kp2-trash');
  const trash = [];
  for (const row of trashRows) {
    const value = row.entityType === 'project' ? await openProject(row.wrapped) : await openRecord(row.wrapped);
    trash.push({ entityType:row.entityType, entityId:row.entityId, deletedAt:row.deletedAt, expiresAt:row.expiresAt, value });
  }
  const encrypted = await encryptJson({ schemaVersion:2, createdAt:now.toISOString(), records, projects, trash }, shared.key);
  await kp2Rest(KP2.backupTable, 'POST', 'on_conflict=user_id,device_id,snapshot_type,period_key', {
    user_id:kpSession().user.id, device_id:kp2Device(), snapshot_type:type, period_key:period,
    schema_version:2, record_count:records.length+projects.length,
    payload:{ salt:shared.salt, iterations:shared.iterations, iv:encrypted.iv, data:encrypted.data }, created_at:now.toISOString()
  }, { Prefer:'resolution=ignore-duplicates,return=minimal' });
}
async function kp2PruneCloudSnapshots() {
  const rows = await kp2Rest(KP2.backupTable, 'GET', 'select=id,snapshot_type,created_at&order=created_at.desc&limit=500');
  const drop = [];
  for (const [kind, max] of [['daily',30],['monthly',12],['milestone',24]]) (rows || []).filter(x => x.snapshot_type === kind).slice(max).forEach(x => drop.push(x.id));
  for (const id of drop) await kp2Rest(KP2.backupTable, 'DELETE', 'id=eq.' + encodeURIComponent(id));
}
async function kp2SyncNow() {
  if (KP2.syncBusy) return;
  if (!cryptoKey || !window.kpSyncMasterPassword) throw Error('请先解锁本地密钥库。');
  if (!kpSession()?.access_token) throw Error('请先登录同步账号。');
  KP2.syncBusy = true; kp2Status('kp2SyncStatus', '正在准备加密增量同步…');
  try {
    const shared = await kp2SharedKey(); KP2.cloudKey = shared.key; await kp2EnsureDevice(); await kp2MigrateLegacy(shared);
    const remote = await kp2Rest(KP2.syncTable, 'GET', 'select=entity_type,entity_id,version,device_id,updated_at,deleted_at,payload,schema_version&order=updated_at.asc&limit=10000');
    const rm = new Map((remote || []).map(x => [x.entity_type+':'+x.entity_id,x]));
    const lm = await kp2LocalStates(shared), all = new Set([...rm.keys(),...lm.keys()]);
    let pushed=0,pulled=0,unchanged=0;
    for (const id of all) {
      const local=lm.get(id), cloud=rm.get(id);
      if (local && (!cloud || kp2Compare(local,cloud)>0)) {
        await kp2Rest('rpc/keypocket_upsert_sync_item','POST','',{
          p_entity_type:local.entity_type,p_entity_id:local.entity_id,p_version:local.version,p_device_id:local.device_id,
          p_updated_at:local.updated_at,p_deleted_at:local.deleted_at,p_payload:local.payload
        });
        pushed++;
      } else if (cloud && (!local || kp2Compare(cloud,local)>0)) {
        await kp2ApplyRemote(cloud,shared); pulled++;
      } else unchanged++;
    }
    render(); renderProjects();
    await kp2CloudSnapshot(shared,'daily'); await kp2CloudSnapshot(shared,'monthly'); await kp2PruneCloudSnapshots();
    const message='同步完成：上传 '+pushed+' 条，下载 '+pulled+' 条，未变化 '+unchanged+' 条。服务器只保存客户端加密密文。';
    kp2Status('kp2SyncStatus',message); kpSyncStatus(message);
    kp2RenderEverything(); kp2RenderDevices();
    return { pushed, pulled, unchanged };
  } finally { KP2.syncBusy=false; }
}
function kp2ScheduleCloudSync() {
  if (localStorage.getItem(KP2.autoSyncKey)==='0' || !kpSession()?.access_token || !navigator.onLine || !cryptoKey) return;
  clearTimeout(KP2.syncTimer);
  KP2.syncTimer=setTimeout(()=>kp2SyncNow().catch(e=>kp2Status('kp2SyncStatus','自动同步待重试：'+e.message,true)),1600);
}
async function kp2RestoreCloudSnapshot(id) {
  if (!confirm('云端快照会替换当前设备数据。恢复前会自动创建当前版本快照。确定继续？')) return;
  const shared=await kp2SharedKey();
  const rows=await kp2Rest(KP2.backupTable,'GET','select=id,payload&id=eq.'+encodeURIComponent(id)+'&limit=1');
  if (!rows?.[0]?.payload) throw Error('云端快照不存在。');
  const body=await decryptJson({ iv:rows[0].payload.iv, data:rows[0].payload.data },shared.key);
  if (body.schemaVersion!==2 || !Array.isArray(body.records) || !Array.isArray(body.projects)) throw Error('云端快照格式不兼容。');
  await kp2ImportantSnapshot('before-cloud-restore');
  const next=[{...vault}];
  for (const x of body.records) next.push(await sealRecord(x));
  for (const x of body.projects) next.push(await sealProject(x));
  for (const x of (body.trash||[])) {
    const wrapped=x.entityType==='project'?await sealProject(x.value):await sealRecord(x.value);
    next.push({ id:kp2Id('trash',x.entityType+':'+x.entityId),kind:'kp2-trash',entityType:x.entityType,entityId:x.entityId,deletedAt:x.deletedAt,expiresAt:x.expiresAt,version:x.deletedAt,deviceId:kp2Device(),wrapped });
  }
  const snapshots=(await kp2AllItemsRaw()).filter(x=>x.kind==='kp2-snapshot');
  await kp2WriteRaw([...next,...snapshots],true); await kp2Reload(); render(); renderProjects(); await kp2SyncNow();
  showToast('已从云端加密快照恢复并同步');
}

/* GitHub Skill Radar uses observed snapshot deltas; current Stars are never passed off as growth. */
const KP2_PERIODS={
  monthly:{label:'月度 Top 10',days:30,min:25,max:40},
  quarterly:{label:'季度 Top 10',days:90,min:75,max:110},
  yearly:{label:'年度 Top 10',days:365,min:340,max:390},
  all:{label:'累计 Top 10'}
};
async function kp2PublicGet(table,query) {
  const response=await fetch(KP_SUPABASE_URL+'/rest/v1/'+table+'?'+query,{headers:{apikey:KP_SUPABASE_KEY,Accept:'application/json'}});
  if(!response.ok) throw Error('Skill Radar 读取失败（HTTP '+response.status+'）');
  return response.json();
}
async function kp2LoadRadar() {
  const host=document.getElementById('kp2RadarRows'); if(!host||host.dataset.loading==='1')return;
  host.dataset.loading='1';host.textContent='正在读取公开 GitHub 历史快照…';
  try {
    const repos=await kp2PublicGet(KP2.radarTable,'select=id,full_name,owner,repo_name,description,html_url,stars,forks,language,topics,pushed_at,updated_at,readme_relevance,sampled_at&archived=eq.false&fork=eq.false&order=stars.desc&limit=250');
    KP2.radarRows=repos||[];
    if(!repos?.length){host.innerHTML='<div class="kp2-empty">尚无经过核实的榜单数据。需部署每日采集任务并配置 GitHub 与 Supabase 服务端凭据；不会展示虚构 Top 10。</div>';return;}
    const ids=repos.map(x=>x.id),history=[];
    for(let i=0;i<ids.length;i+=80){
      const batch=ids.slice(i,i+80);
      const part=await kp2PublicGet(KP2.historyTable,'select=repo_id,sampled_on,stars,forks&repo_id=in.('+batch.join(',')+')&order=sampled_on.desc&limit=10000');
      history.push(...(part||[]));
    }
    KP2.radarHistory=history;
    const dates=history.map(x=>x.sampled_on).sort();
    const updated=document.getElementById('kp2RadarUpdated');
    if(updated)updated.textContent='最新采集：'+kp2Time(Math.max(...repos.map(x=>Date.parse(x.sampled_at)||0)))+' · 历史起始：'+(dates[0]||'首次采集尚未完成');
    kp2RenderRadar();
  } catch(e){host.innerHTML='<div class="kp2-empty">榜单读取失败：'+esc(e.message)+'</div>';}
  finally{host.dataset.loading='0';}
}
function kp2BoardRows() {
  const period=KP2_PERIODS[KP2.board],list=[];
  if(KP2.board==='all') return KP2.radarRows.slice().sort((a,b)=>b.stars-a.stars).slice(0,10).map((repo,i)=>({repo,rank:i+1,basis:'当前累计 Stars'}));
  for(const repo of KP2.radarRows){
    const history=KP2.radarHistory.filter(x=>String(x.repo_id)===String(repo.id)).sort((a,b)=>b.sampled_on.localeCompare(a.sampled_on));
    const baseline=history.find(x=>{
      const days=(Date.now()-Date.parse(x.sampled_on+'T00:00:00Z'))/86400000;
      return days>=period.min&&days<=period.max;
    });
    if(!baseline)continue;
    const starsDelta=Math.max(0,Number(repo.stars)-Number(baseline.stars));
    const forksDelta=Math.max(0,Number(repo.forks)-Number(baseline.forks));
    list.push({repo,starsDelta,forksDelta,baseline:baseline.sampled_on,relevance:Number(repo.readme_relevance)||0});
  }
  if(!list.length)return [];
  const maxS=Math.max(1,...list.map(x=>x.starsDelta)),maxF=Math.max(1,...list.map(x=>x.forksDelta));
  list.forEach(x=>x.score=70*x.starsDelta/maxS+20*x.forksDelta/maxF+10*x.relevance/100);
  return list.sort((a,b)=>b.score-a.score||b.starsDelta-a.starsDelta||b.repo.stars-a.repo.stars).slice(0,10).map((x,i)=>({...x,rank:i+1}));
}
function kp2RenderRadar() {
  const host=document.getElementById('kp2RadarRows');if(!host)return;
  const items=kp2BoardRows();
  if(!items.length){host.innerHTML='<div class="kp2-empty"><strong>'+esc(KP2_PERIODS[KP2.board].label)+'正在积累真实历史数据</strong><p>本周期需要与对应历史快照比较 Stars/Forks。尚未达到周期长度时不会假造增长榜。</p><p>综合分：Stars 增长 70% + Forks 增长 20% + README 相关性 10%。累计榜以当前 Stars 排序。该分数不代表安装量或实际用户数。</p></div>';return;}
  host.innerHTML=items.map(x=>{
    const r=x.repo,delta=x.starsDelta===undefined?'累计 Stars 排名':'近周期 +'+x.starsDelta.toLocaleString()+' Stars / +'+x.forksDelta.toLocaleString()+' Forks';
    return '<article class="kp2-skill"><span class="kp2-rank">#'+x.rank+'</span><div class="kp2-skill-copy"><strong>'+esc(r.full_name)+'</strong><p>'+esc(r.description||'暂无描述')+'</p><small>★ '+Number(r.stars).toLocaleString()+' · Fork '+Number(r.forks).toLocaleString()+' · '+esc(r.language||'未标注')+' · '+esc(delta)+(x.baseline?' · 对比 '+esc(x.baseline):'')+'</small></div><div class="kp2-actions"><a class="btn" href="'+esc(r.html_url)+'" target="_blank" rel="noopener noreferrer">查看仓库</a><button class="btn primary" data-kp2-radar-save="'+esc(r.id)+'">一键收录</button></div></article>';
  }).join('');
}
async function kp2SaveRadar(id) {
  const repo=KP2.radarRows.find(x=>String(x.id)===String(id));if(!repo)throw Error('Skill 项目不存在。');
  const url=canonicalSkillRepoUrl(repo.html_url);if(!url)throw Error('GitHub URL 无效。');
  if(projects.some(x=>canonicalSkillRepoUrl(x.repoUrl)===url)){showToast('此 Skill 已经收录。');return;}
  const now=Date.now(),item=normalizeProject({
    id:crypto.randomUUID(),name:repo.repo_name+' · Skill',repoUrl:url,appUrl:'',
    category:githubCategory(repo),stack:[repo.language,...(repo.topics||[]).slice(0,4)].filter(Boolean).join(', ').slice(0,160),
    notes:'来源：KeyPocket Skill Radar\n原生作者：'+repo.owner+'\nGitHub Stars：'+repo.stars+'；Forks：'+repo.forks+'\n采集时间：'+String(repo.sampled_at||'').slice(0,10)+'\n'+(repo.description||''),
    tags:['Skill','Skill Radar',...(repo.topics||[]).slice(0,4)].join(', ').slice(0,200),favorite:true,createdAt:now,updatedAt:now
  });
  await putItem(await sealProject(item));projects.push(item);renderProjects();showToast('Skill 已加密收录');
}

/* GitHub App bridge: stateless signed session, no third-party cookie dependency. */
(function captureGitHubCallback() {
  try {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    const token = fragment.get('kp_v2_github_session');
    const error = fragment.get('kp_v2_github_error');
    if (token) {
      localStorage.setItem('kp.v2.github-session', JSON.stringify({ token, connectedAt: Date.now() }));
      history.replaceState({}, '', location.pathname + location.search);
    } else if (error) {
      sessionStorage.setItem('kp.v2.github-error', error);
      history.replaceState({}, '', location.pathname + location.search);
    }
  } catch (e) { console.warn('KeyPocket GitHub callback could not be stored', e); }
})();
function kp2GitHubSession() { try{return JSON.parse(localStorage.getItem('kp.v2.github-session')||'null');}catch{return null;} }
function kp2GitHubStore(value) { if(value)localStorage.setItem('kp.v2.github-session',JSON.stringify(value));else localStorage.removeItem('kp.v2.github-session'); }
function kp2GitHubHeaders() { const s=kp2GitHubSession();if(!s?.token)throw Error('请先绑定 GitHub App。');return {Authorization:'Bearer '+s.token,'Content-Type':'application/json'}; }
function kp2RenderGitHub() {
  const state=document.getElementById('kp2GitHubState'),detail=document.getElementById('kp2GitHubDetail'),button=document.getElementById('kp2GitHubConnect');
  const session=kp2GitHubSession();
  if(state)state.textContent=session?'GitHub 已绑定：'+(session.account||'已授权账户'):'GitHub 尚未绑定';
  if(detail)detail.textContent=session?'授权范围仅限安装时选择的 keypocket-cloud-vault 私有仓库。最近状态：'+kp2Time(session.connectedAt):'需要安装 KeyPocket GitHub App。App 私钥仅存放在 Cloudflare Worker Secret。';
  if(button)button.textContent=session?'重新授权 / 管理安装':'连接 GitHub 账户';
}
async function kp2GitHubConnect() {
  if(!KP2.workerUrl){kp2Status('kp2GitHubStatus','Worker 地址未配置。请部署 keypocket-vault-api 后设置 KP_V2_GITHUB_WORKER_URL。',true);return;}
  const url=KP2.workerUrl.replace(/\/$/,'')+'/github/install?return_url='+encodeURIComponent(location.origin+location.pathname);
  window.location.assign(url);
}
async function kp2GitHubStatus() {
  const session=kp2GitHubSession();
  if(!session?.token) {kp2RenderGitHub();return;}
  const response=await fetch(KP2.workerUrl.replace(/\/$/,'')+'/github/status',{headers:kp2GitHubHeaders()});
  const data=await response.json();if(!response.ok)throw Error(data.error||'GitHub 状态读取失败。');
  if(!data.connected){kp2GitHubStore(null);kp2RenderGitHub();return;}
  kp2GitHubStore({...session,account:data.account,repository:data.repository,lastChecked:Date.now()});kp2RenderGitHub();
}
async function kp2GitHubDisconnect() {
  if(!confirm('解除 KeyPocket GitHub 连接？不会删除本地密钥库或私有仓库文件。'))return;
  kp2GitHubStore(null);kp2RenderGitHub();kp2Status('kp2GitHubStatus','本设备 GitHub 授权已解除；私有备份仓库未删除。');
}
async function kp2GitHubBackup() {
  const session=kp2GitHubSession();if(!session?.token)throw Error('请先绑定 GitHub App。');
  const shared=await kp2SharedKey(),rows=await kp2AllItemsRaw();
  const trash=[];
  for(const item of rows.filter(x=>x.kind==='kp2-trash')){
    const plain=item.entityType==='project'?await openProject(item.wrapped):await openRecord(item.wrapped);
    trash.push({entityType:item.entityType,entityId:item.entityId,deletedAt:item.deletedAt,expiresAt:item.expiresAt,plain});
  }
  const encrypted=await encryptJson({schemaVersion:2,createdAt:new Date().toISOString(),records,projects,trash},shared.key);
  const response=await fetch(KP2.workerUrl.replace(/\/$/,'')+'/github/vault',{method:'PUT',headers:kp2GitHubHeaders(),body:JSON.stringify({salt:shared.salt,iterations:shared.iterations,iv:encrypted.iv,data:encrypted.data})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'GitHub 私有仓库备份失败。');
  kp2Status('kp2GitHubStatus','加密备份已写入 '+(result.repository||'keypocket-cloud-vault')+' 私有仓库。');
}
async function kp2GitHubRestore() {
  if(!confirm('从 GitHub 私有仓库恢复会替换本机当前数据。先创建本地安全快照。继续吗？'))return;
  const response=await fetch(KP2.workerUrl.replace(/\/$/,'')+'/github/vault',{headers:kp2GitHubHeaders()});
  const file=await response.json();if(!response.ok)throw Error(file.error||'GitHub 备份读取失败。');
  const shared=await kp2SharedKey();
  const decoded=await decryptJson({iv:file.iv,data:file.data},shared.key);
  if(decoded.schemaVersion!==2||!Array.isArray(decoded.records)||!Array.isArray(decoded.projects))throw Error('GitHub 备份文件格式无效。');
  await kp2ImportantSnapshot('before-github-restore');
  const next=[{...vault},...await Promise.all(decoded.records.map(sealRecord)),...await Promise.all(decoded.projects.map(sealProject))];
  for(const x of decoded.trash||[]){
    const wrapped=x.entityType==='project'?await sealProject(x.plain):await sealRecord(x.plain);
    next.push({id:kp2Id('trash',x.entityType+':'+x.entityId),kind:'kp2-trash',entityType:x.entityType,entityId:x.entityId,deletedAt:x.deletedAt,expiresAt:x.expiresAt,version:x.deletedAt,deviceId:kp2Device(),wrapped});
  }
  const snapshots=(await kp2AllItemsRaw()).filter(x=>x.kind==='kp2-snapshot');
  await kp2WriteRaw([...next,...snapshots],true);await kp2Reload();render();renderProjects();
  kp2Status('kp2GitHubStatus','GitHub 私有加密备份已恢复。');kp2LocalSnapshotSchedule();
}

/* Minimal V2 navigation and panels; existing visual language is retained. */
function kp2InstallUi() {
  const nav=document.querySelector('.module-tabs');if(!nav||document.getElementById('kp2Views'))return;
  for(const [id,label] of [['radar','✦ Skill Radar'],['trash','回收站'],['backups','自动备份'],['sync','同步中心'],['github','GitHub 账户']]){
    const btn=document.createElement('button');btn.type='button';btn.className='module-tab';btn.dataset.module=id;btn.textContent=label;nav.appendChild(btn);
  }
  const holder=document.createElement('div');holder.id='kp2Views';
  holder.innerHTML=
  '<section id="kp2RadarPanel" class="kp2-panel hidden"><div class="kp2-head"><div><small>GLOBAL OPEN-SOURCE DISCOVERY</small><h2>Skill Radar</h2><p>每个榜单最多展示 10 个真实 GitHub 仓库。周期增长以历史快照计算。</p></div><button class="btn" id="kp2RadarRefresh">刷新榜单</button></div><div class="kp2-periods"><button class="active" data-kp2-period="monthly">月度 Top 10</button><button data-kp2-period="quarterly">季度 Top 10</button><button data-kp2-period="yearly">年度 Top 10</button><button data-kp2-period="all">累计 Top 10</button></div><p class="kp2-muted" id="kp2RadarUpdated">读取数据中…</p><div class="kp2-note">评分口径：Stars 增长 70% + Forks 增长 20% + README 相关性 10%；累计榜按当前 Stars。综合分不是安装量或用户数量。</div><div id="kp2RadarRows"></div></section>'+
  '<section id="kp2TrashPanel" class="kp2-panel hidden"><div class="kp2-head"><div><h2>回收站</h2><p>保留 30 天，支持单条和批量恢复。</p></div><button class="btn primary" id="kp2BatchRestore">恢复所选</button></div><p id="kp2TrashStatus" class="kp2-muted">删除的 API Key、Skill 和项目资料会列在这里。</p><div id="kp2TrashRows"></div></section>'+
  '<section id="kp2BackupPanel" class="kp2-panel hidden"><div class="kp2-head"><div><h2>自动备份</h2><p>本地检查点和云端加密快照分别显示。</p></div><button class="btn primary" id="kp2MakeSnapshot">立即创建快照</button></div><div class="kp2-note"><strong>本地自动快照</strong><p id="kp2BackupSummary">正在读取…</p><small>防抖写入；每日最多 30 个，月度归档最多 12 个。</small></div><p id="kp2BackupStatus" class="kp2-muted"></p><div id="kp2LocalSnapshots"></div><div class="kp2-note"><strong>云端加密快照</strong><p id="kp2CloudHint">登录同步账号后可用。</p><button class="btn" id="kp2LoadCloud">刷新云端历史</button></div><div id="kp2CloudSnapshots"></div></section>'+
  '<section id="kp2SyncPanel" class="kp2-panel hidden"><div class="kp2-head"><div><h2>同步中心</h2><p>逐条增量同步、版本比较、墓碑传播和断网重试。</p></div><button class="btn primary" id="kp2SyncNow">立即同步</button></div><div class="kp2-note"><p id="kp2SyncStatus">尚未同步。</p><small>不同设备必须使用同一 KeyPocket 本地解锁密码派生共享云端加密密钥。</small></div><label class="kp2-toggle"><input id="kp2AutoSync" type="checkbox" checked> 网络恢复后自动同步</label><h3>已绑定设备</h3><div id="kp2Devices">登录后自动登记。</div></section>'+
  '<section id="kp2GitHubPanel" class="kp2-panel hidden"><div class="kp2-head"><div><h2>GitHub 账户</h2><p>只备份 KeyPocket 数据，不读取其他私有仓库源码。</p></div></div><div class="kp2-note"><strong id="kp2GitHubState">尚未绑定</strong><p id="kp2GitHubDetail">授权 KeyPocket GitHub App 后显示账户信息。</p><small>最小权限：Metadata 只读、Contents 读写。请只选择 keypocket-cloud-vault 私有仓库。</small></div><div class="kp2-buttons"><button class="btn primary" id="kp2GitHubConnect">连接 GitHub</button><button class="btn" id="kp2GitHubCheck">检查连接</button><button class="btn" id="kp2GitHubBackup">备份到 GitHub</button><button class="btn" id="kp2GitHubRestore">从 GitHub 恢复</button><button class="btn ghost" id="kp2GitHubDisconnect">解除绑定</button></div><p id="kp2GitHubStatus" class="kp2-muted">未绑定不会显示已连接。</p></section>';
  const main=document.getElementById('projectView');main?.parentNode.insertBefore(holder,main.nextSibling);
  const style=document.createElement('style');style.textContent='.kp2-panel{margin:20px 0}.kp2-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px}.kp2-head h2{margin:2px 0 6px;font-size:23px;color:#203149}.kp2-head p{margin:0;color:#6d7a8b;font-size:13px;line-height:1.6}.kp2-head small{font-size:10px;letter-spacing:.14em;color:#557390}.kp2-periods,.kp2-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.kp2-periods button{border:1px solid #dce4ed;background:#fff;border-radius:20px;padding:8px 13px;color:#526278}.kp2-periods button.active{background:#eaf2fb;border-color:#a4bbd2;color:#244a70}.kp2-note{background:#f8fafc;border:1px solid #e2e8ef;border-radius:12px;padding:14px 16px;margin:12px 0;color:#556579;font-size:13px;line-height:1.7}.kp2-note p{margin:6px 0}.kp2-note small,.kp2-muted{font-size:11px;color:#8995a3}.kp2-row,.kp2-skill{display:flex;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid #edf0f4}.kp2-row-copy,.kp2-skill-copy{flex:1;min-width:0}.kp2-row-copy strong,.kp2-skill-copy strong{display:block;overflow-wrap:anywhere;color:#293b52}.kp2-row-copy small,.kp2-skill-copy small{display:block;color:#8290a1;font-size:11px;margin-top:5px}.kp2-skill{align-items:flex-start}.kp2-rank{width:34px;height:34px;display:grid;place-items:center;flex:none;border-radius:10px;background:#edf3f9;color:#315b7e;font-weight:700}.kp2-skill-copy p{margin:5px 0;color:#6e7c8d;font-size:12px;line-height:1.5}.kp2-actions{display:flex;gap:6px;flex-wrap:wrap}.kp2-empty{padding:26px 16px;border:1px dashed #d8e0e9;border-radius:12px;text-align:center;color:#6b7a8c;line-height:1.7;font-size:13px;margin:12px 0}.kp2-toggle{display:flex;gap:8px;align-items:center;margin:15px 0;color:#536276;font-size:13px}.kp2-toggle input,.kp2-row>input{width:17px;height:17px}.kp2-muted{margin:12px 0;line-height:1.6}.kp2-muted.error{color:#b93636}.kp2-muted.ok{color:#147d55}@media(max-width:640px){.kp2-head h2{font-size:21px}.kp2-skill{flex-wrap:wrap}.kp2-actions{width:100%;padding-left:46px}.kp2-row{flex-wrap:wrap}.module-tabs{overflow-x:auto;flex-wrap:nowrap}.module-tab{white-space:nowrap}}';
  document.head.appendChild(style);
  const on=(id,event,fn)=>document.getElementById(id)?.addEventListener(event,fn);
  on('kp2BatchRestore','click',kp2BatchRestore);
  on('kp2MakeSnapshot','click',async()=>{try{await kp2ImportantSnapshot('manual');kp2Status('kp2BackupStatus','本地快照创建成功。');await kp2RenderBackups();}catch(e){kp2Status('kp2BackupStatus',e.message,true);}});
  on('kp2LoadCloud','click',kp2LoadCloudBackups);
  on('kp2SyncNow','click',()=>kp2SyncNow().catch(e=>kp2Status('kp2SyncStatus','同步失败：'+e.message,true)));
  on('kp2AutoSync','change',e=>{localStorage.setItem(KP2.autoSyncKey,e.target.checked?'1':'0');if(e.target.checked)kp2ScheduleCloudSync();});
  const auto=document.getElementById('kp2AutoSync');if(auto)auto.checked=localStorage.getItem(KP2.autoSyncKey)!=='0';
  on('kp2RadarRefresh','click',kp2LoadRadar);
  on('kp2GitHubConnect','click',kp2GitHubConnect);
  on('kp2GitHubCheck','click',()=>kp2GitHubStatus().catch(e=>kp2Status('kp2GitHubStatus',e.message,true)));
  on('kp2GitHubDisconnect','click',kp2GitHubDisconnect);
  on('kp2GitHubBackup','click',()=>kp2GitHubBackup().catch(e=>kp2Status('kp2GitHubStatus',e.message,true)));
  on('kp2GitHubRestore','click',()=>kp2GitHubRestore().catch(e=>kp2Status('kp2GitHubStatus',e.message,true)));
  holder.addEventListener('click',async e=>{
    const actions=[
      ['[data-kp2-restore]',x=>kp2RestoreTrash(x.dataset.kp2Restore)],
      ['[data-kp2-purge]',x=>kp2PermanentlyDelete(x.dataset.kp2Purge)],
      ['[data-kp2-local-restore]',x=>confirm('恢复会替换当前设备数据。继续？')?kp2RestoreLocalSnapshot(x.dataset.kp2LocalRestore):null],
      ['[data-kp2-radar-save]',x=>kp2SaveRadar(x.dataset.kp2RadarSave)],
      ['[data-kp2-cloud-restore]',x=>kp2RestoreCloudSnapshot(x.dataset.kp2CloudRestore)]
    ];
    for(const [selector,fn] of actions){const el=e.target.closest(selector);if(el){try{await fn(el);}catch(err){showToast('操作未完成：'+err.message);}return;}}
    const period=e.target.closest('[data-kp2-period]');
    if(period){KP2.board=period.dataset.kp2Period;holder.querySelectorAll('[data-kp2-period]').forEach(x=>x.classList.toggle('active',x===period));kp2RenderRadar();}
  });
  /* Capture destructive actions from the existing key and project cards before v1 handlers. */
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-action="delete"],[data-project-action="delete"]');if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();
    const card=button.closest('[data-id],[data-project-id]');
    const project=button.hasAttribute('data-project-action')||!!card?.hasAttribute('data-project-id');
    const id=project?(card?.dataset.projectId):(button.dataset.id||card?.dataset.id);
    if(!id)return;
    const item=project?projects.find(x=>x.id===id):records.find(x=>x.id===id);
    if(!confirm('将「'+(item?.name||id)+'」移入回收站？可在 30 天内恢复。'))return;
    try{await kp2Trash(project?'project':'key',id);if(!project)closeModal();}catch(err){showToast('删除失败，原记录保留：'+err.message);}
  },true);
}
async function kp2LoadCloudBackups() {
  try{
    const rows=await kp2Rest(KP2.backupTable,'GET','select=id,snapshot_type,period_key,record_count,created_at&order=created_at.desc&limit=100');
    const host=document.getElementById('kp2CloudSnapshots');
    if(host)host.innerHTML=(rows||[]).map(x=>'<article class="kp2-row"><div class="kp2-row-copy"><strong>'+esc(x.snapshot_type==='daily'?'云端每日快照':x.snapshot_type==='monthly'?'云端月度归档':'重要操作快照')+'</strong><small>'+esc(x.period_key)+' · '+esc(kp2Time(x.created_at))+' · '+Number(x.record_count)+' 项</small></div><button class="btn" data-kp2-cloud-restore="'+esc(x.id)+'">恢复</button></article>').join('')||'<div class="kp2-empty">暂无云端快照。</div>';
  }catch(e){kp2Status('kp2CloudHint','云端快照读取失败：'+e.message,true);}
}
async function kp2RenderDevices() {
  const host=document.getElementById('kp2Devices');if(!host||!kpSession()?.access_token)return;
  try{
    const rows=await kp2Rest(KP2.devicesTable,'GET','select=device_id,device_label,last_seen_at,revoked_at&order=last_seen_at.desc');
    host.innerHTML=(rows||[]).map(x=>'<div class="kp2-row"><div class="kp2-row-copy"><strong>'+esc(x.device_label)+'</strong><small>'+esc(kp2Time(x.last_seen_at))+(x.revoked_at?' · 已撤销':' · 已绑定')+'</small></div></div>').join('')||'暂无设备';
  }catch(e){host.textContent='设备信息读取失败：'+e.message;}
}
function kp2RenderSync() {
  const node=document.getElementById('kp2SyncStatus');
  if(node&&!kpSession()?.access_token)node.textContent='尚未登录同步账号。登录后启用跨设备增量同步；本地保存不受网络影响。';
}
function kp2Module(name) {
  const panels={radar:'kp2RadarPanel',trash:'kp2TrashPanel',backups:'kp2BackupPanel',sync:'kp2SyncPanel',github:'kp2GitHubPanel'};
  const panel=panels[name],active=!!panel;
  for(const selector of ['.stats','.list-head','#cards','.footer'])document.querySelectorAll('#mainView '+selector).forEach(x=>x.classList.toggle('hidden',active||name==='projects'));
  document.querySelector('#mainView .toolbar')?.classList.toggle('hidden',active||name==='projects');
  document.getElementById('projectView')?.classList.toggle('hidden',active||name!=='projects');
  Object.values(panels).forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  if(panel)document.getElementById(panel)?.classList.remove('hidden');
  document.querySelectorAll('[data-module]').forEach(x=>x.classList.toggle('active',x.dataset.module===name));
  if(name==='radar')kp2LoadRadar();
  if(name==='trash')kp2RenderTrash();
  if(name==='backups')kp2RenderBackups();
  if(name==='sync'){kp2RenderSync();kp2RenderDevices();}
  if(name==='github')kp2RenderGitHub();
}
function kp2RenderGitHub() {
  const session=kp2GitHubSession();
  const state=document.getElementById('kp2GitHubState'),detail=document.getElementById('kp2GitHubDetail');
  if(state)state.textContent=session?'已绑定 GitHub：'+(session.account||'已授权账户'):'GitHub 尚未绑定';
  if(detail)detail.textContent=session?'私有仓库：'+(session.repository||'keypocket-cloud-vault')+' · 最近授权 '+kp2Time(session.connectedAt):'安装 KeyPocket GitHub App 后显示账户及专用私有仓库状态。';
}
function kp2SetModuleSwitch() {
  const original=setModule;
  setModule=function(name){original(name);kp2Module(name);};
  document.querySelectorAll('[data-module]').forEach(x=>x.addEventListener('click',()=>kp2Module(x.dataset.module)));
}
function kp2Unlock(locked) {
  if(locked||KP2.initialized)return;
  KP2.initialized=true;
  kp2InstallUi();kp2SetModuleSwitch();
  kp2ExpireTrash().catch(()=>{});
  kp2CreateLocalSnapshot('daily',new Date().toISOString().slice(0,10)).catch(e=>kp2Status('kp2BackupStatus','首次快照失败：'+e.message,true));
  kp2CreateLocalSnapshot('monthly',new Date().toISOString().slice(0,7)).catch(()=>{});
  kp2RenderEverything();
  if(kpSession()?.access_token&&navigator.onLine)kp2ScheduleCloudSync();
  if(kp2GitHubSession()?.token&&KP2.workerUrl)kp2GitHubStatus().catch(e=>kp2Status('kp2GitHubStatus','GitHub 连接检查失败：'+e.message,true));
}
const kp2SetView=setView;
setView=function(locked){kp2SetView(locked);if(!locked)setTimeout(()=>kp2Unlock(false),0);};
allItems=async function(){return (await kp2AllItemsRaw()).filter(x=>!kp2System(x));};
putItem=async function(item){const result=await kp2PutItem(item);if(item?.id!=='vault-meta'&&!kp2System(item))kp2LocalSnapshotSchedule();return result;};
writeItems=async function(items,clear=false){if(clear&&cryptoKey)await kp2ImportantSnapshot('before-replace');const result=await kp2WriteItems(items,clear);kp2LocalSnapshotSchedule();return result;};
deleteItem=async function(id){
  const key=records.find(x=>x.id===id);if(key)return kp2Trash('key',id);
  const project=projects.find(x=>x.id===String(id).replace(/^project:/,''));
  if(project)return kp2Trash('project',project.id);
  return kp2DeleteItemRaw(id);
};
window.addEventListener('online',()=>{if(cryptoKey&&kpSession()?.access_token)kp2ScheduleCloudSync();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cryptoKey&&kpSession()?.access_token)kp2ScheduleCloudSync();});
