'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = path.join(ROOT, 'keypocket', 'data', 'skill-radar', 'snapshots');
const API_FILE = path.join(ROOT, 'keypocket', 'api', 'skill-radar.json');
const RETENTION_DAYS = 400;
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function localDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
function dateOffset(date, days) {
  const d = new Date(date + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function normalizeRepo(repo) {
  if (!repo || repo.archived || repo.disabled || repo.fork || !repo.full_name || !repo.html_url) return null;
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(repo.html_url);
  if (!match) return null;
  return {
    id: Number(repo.id),
    fullName: match[1] + '/' + match[2],
    owner: match[1],
    repoName: match[2],
    url: 'https://github.com/' + match[1] + '/' + match[2],
    description: String(repo.description || '').slice(0, 500),
    stars: Math.max(0, Number(repo.stargazers_count) || 0),
    forks: Math.max(0, Number(repo.forks_count) || 0),
    openIssues: Math.max(0, Number(repo.open_issues_count) || 0),
    language: repo.language || '',
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 20) : [],
    pushedAt: repo.pushed_at || null,
    updatedAt: repo.updated_at || null,
    archived: false,
    fork: false,
    defaultBranch: repo.default_branch || 'main'
  };
}
function validSkillPath(filePath) {
  const parts = String(filePath || '').split('/').filter(Boolean);
  if (!parts.length || parts[parts.length - 1].toLowerCase() !== 'skill.md') return false;
  if (parts.slice(0, -1).some(part => /^(examples?|docs?|tutorials?|samples?|fixtures?|tests?|archive|archives)$/i.test(part))) return false;
  if (parts.length === 1) return true;
  return parts.slice(0, -1).some(part => /^(skills|\.claude|\.agents|\.github)$/i.test(part));
}
function relevanceScore(repo, paths) {
  const text = [repo.fullName, repo.description, ...(repo.topics || []), ...paths].join(' ').toLowerCase();
  let score = 30;
  if ((repo.topics || []).some(x => /agent-skills|claude-skills|codex-skills/i.test(x))) score += 35;
  if (/agent skill|agent skills|skill\.md/.test(text)) score += 25;
  if (/\/skills\/|\.claude\/skills|\.agents\/skills/.test(text)) score += 20;
  if (/awesome|tutorial|course|learning|prompt.?collection|resource.?list/.test(text)) score -= 25;
  if (/skill/.test(repo.repoName.toLowerCase())) score += 10;
  return Math.max(0, Math.min(100, score));
}
async function githubJson(endpoint) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'KeyPocket-Skill-Radar'
  };
  if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(API + endpoint, { headers, signal: AbortSignal.timeout(25000) });
    } catch (error) {
      lastError = error;
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (response.ok) return response.json();
    const detail = await response.text().catch(() => '');
    lastError = new Error('GitHub API HTTP ' + response.status + ' for ' + endpoint + ': ' + detail.slice(0, 300));
    if (response.status !== 403 && response.status !== 429 && response.status < 500) break;
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    const waitMs = reset > Date.now() ? Math.min(reset - Date.now() + 1000, 30000) : 2000 * (attempt + 1);
    await sleep(waitMs);
  }
  throw lastError || new Error('GitHub API request failed.');
}
async function searchCandidates() {
  const queries = [
    '"SKILL.md" in:readme archived:false fork:false stars:>=5',
    '"Agent Skills" in:readme archived:false fork:false stars:>=5',
    'topic:agent-skills archived:false fork:false stars:>=5'
  ];
  const found = new Map();
  for (const query of queries) {
    const result = await githubJson('/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=100');
    for (const item of result.items || []) {
      const repo = normalizeRepo(item);
      if (repo) found.set(repo.fullName.toLowerCase(), repo);
    }
  }
  return [...found.values()]
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, 180);
}
async function verifySkillRepository(repo) {
  const tree = await githubJson('/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.repoName)
    + '/git/trees/' + encodeURIComponent(repo.defaultBranch) + '?recursive=1');
  if (tree.truncated) return null;
  const paths = (tree.tree || []).filter(item => item.type === 'blob' && validSkillPath(item.path))
    .map(item => item.path).slice(0, 12);
  if (!paths.length) return null;
  return {
    ...repo,
    skillFiles: paths,
    readmeRelevance: relevanceScore(repo, paths),
    verifiedAt: new Date().toISOString()
  };
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { out[index] = await fn(items[index]); }
      catch (error) { out[index] = null; console.warn('Skipped verification:', items[index].fullName, error.message); }
    }
  });
  await Promise.all(workers);
  return out.filter(Boolean);
}
function addSnapshotHistory(snapshots, current) {
  const prior = snapshots.filter(item => item.date !== current.date);
  return [...prior, current].sort((a, b) => a.date.localeCompare(b.date))
    .filter(item => item.date >= dateOffset(current.date, RETENTION_DAYS));
}
function buildRepositoryIndex(snapshots) {
  const currentSnapshot = snapshots[snapshots.length - 1];
  if (!currentSnapshot) return [];
  const historyByRepo = new Map();
  for (const snapshot of snapshots) {
    for (const repo of snapshot.repos || []) {
      const key = repo.fullName.toLowerCase();
      if (!historyByRepo.has(key)) historyByRepo.set(key, []);
      historyByRepo.get(key).push({ date: snapshot.date, stars: repo.stars, forks: repo.forks });
    }
  }
  // Current boards only include repositories verified in the latest daily run.
  // Older repositories remain in daily archives but do not masquerade as current results.
  return (currentSnapshot.repos || []).map(repo => {
    const history = historyByRepo.get(repo.fullName.toLowerCase()) || [];
    return { ...repo, firstObservedAt: history[0]?.date || currentSnapshot.date, history };
  });
}
function buildBoards(snapshots, date) {
  const index = buildRepositoryIndex(snapshots);
  const periods = { month: 30, quarter: 90, year: 365 };
  const boards = {};
  const periodStatus = {};
  for (const [period, days] of Object.entries(periods)) {
    const cutoff = dateOffset(date, days);
    const rows = [];
    for (const repo of index) {
      const baseline = repo.history.filter(point => point.date <= cutoff).slice(-1)[0];
      if (!baseline) continue;
      const current = repo.history[repo.history.length - 1];
      const spanDays = Math.round((Date.parse(current.date) - Date.parse(baseline.date)) / 86400000);
      if (spanDays < days - 7) continue;
      rows.push({
        ...repo,
        starGrowth: current.stars - baseline.stars,
        forkGrowth: current.forks - baseline.forks,
        baselineDate: baseline.date,
        growthWindowDays: spanDays,
        rankingBasis: 'observed_star_growth'
      });
    }
    rows.sort((a, b) => b.starGrowth - a.starGrowth || b.stars - a.stars || a.fullName.localeCompare(b.fullName));
    boards[period] = rows.slice(0, 10);
    periodStatus[period] = rows.length ? 'available' : 'collecting_history';
  }
  boards.all = index
    .map(repo => ({ ...repo, starGrowth: null, forkGrowth: null, baselineDate: repo.firstObservedAt,
      growthWindowDays: null, rankingBasis: 'current_stars' }))
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, 10);
  periodStatus.all = boards.all.length ? 'available' : 'collecting_history';
  return { boards, periodStatus, repositories: index };
}
function selfTest() {
  const snapshots = [
    { date: '2026-01-01', repos: [{ fullName: 'a/a', stars: 100, forks: 10 }] },
    { date: '2026-01-31', repos: [{ fullName: 'a/a', stars: 150, forks: 15 }] }
  ];
  const result = buildBoards(snapshots, '2026-01-31');
  assert.equal(result.boards.month.length, 1);
  assert.equal(result.boards.month[0].starGrowth, 50);
  assert.equal(result.boards.quarter.length, 0);
  assert.equal(result.boards.all[0].stars, 150);
  assert.equal(validSkillPath('.claude/skills/reviewer/SKILL.md'), true);
  assert.equal(validSkillPath('docs/tutorial/SKILL.md'), false);
  assert.equal(validSkillPath('README.md'), false);
  console.log('PASS: Skill Radar ranking, historical baseline and SKILL.md path validation.');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  if (!TOKEN) throw new Error('GITHUB_TOKEN is required. The workflow must grant contents:read.');
  const date = localDate();
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(API_FILE), { recursive: true });
  const candidates = await searchCandidates();
  if (!candidates.length) throw new Error('GitHub repository search returned no verified candidates.');
  const verified = await mapLimit(candidates, 8, verifySkillRepository);
  if (!verified.length) throw new Error('No repositories with a verified SKILL.md path were found; previous published data is preserved.');
  const snapshot = {
    schemaVersion: 1,
    date,
    collectedAt: new Date().toISOString(),
    source: 'GitHub REST API repository search + recursive Git trees',
    queryCount: 3,
    candidatesChecked: candidates.length,
    repositoriesVerified: verified.length,
    repos: verified
  };
  const snapshotFile = path.join(SNAPSHOT_DIR, date + '.json');
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2) + '\n');
  const priorFiles = fs.readdirSync(SNAPSHOT_DIR).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const loaded = [];
  for (const name of priorFiles) {
    const raw = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, name), 'utf8'));
    if (raw.date !== date && raw.date >= dateOffset(date, RETENTION_DAYS)) loaded.push(raw);
  }
  const history = addSnapshotHistory(loaded, snapshot);
  for (const name of priorFiles) {
    const d = name.slice(0, 10);
    if (d < dateOffset(date, RETENTION_DAYS)) fs.rmSync(path.join(SNAPSHOT_DIR, name), { force: true });
  }
  const built = buildBoards(history, date);
  const payload = {
    schemaVersion: 1,
    updatedAt: snapshot.collectedAt,
    historyStartedAt: history[0].date,
    retainedFrom: history[0].date,
    dataCoverageDays: Math.max(0, Math.round((Date.parse(date) - Date.parse(history[0].date)) / 86400000)),
    snapshotCount: history.length,
    totalRepositories: built.repositories.length,
    verifiedRepositoryCount: verified.length,
    source: snapshot.source,
    periodStatus: built.periodStatus,
    boards: built.boards,
    repositories: built.repositories
  };
  fs.writeFileSync(API_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log('Skill Radar snapshot ' + date + ': ' + verified.length + ' verified repositories; retained ' + history.length + ' daily samples.');
  console.log('Board coverage: ' + JSON.stringify(payload.periodStatus));
  console.log('Output: ' + path.relative(ROOT, API_FILE));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
