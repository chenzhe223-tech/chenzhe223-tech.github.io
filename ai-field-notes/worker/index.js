const ALLOWED_ORIGIN = "https://chenzhe223-tech.github.io";
const API_VERSION = "0.5.1";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}


const RADAR_PUBLIC_JSON = "https://chenzhe223-tech.github.io/radar/data/latest.json";
const RADAR_DAILY_PAGE = "https://chenzhe223-tech.github.io/radar/daily/";

function canonicalBriefUrl(raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ["fbclid", "gclid", "ref"].includes(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch { return ""; }
}

// Lightweight content fingerprint for change detection; not an authentication hash.
function briefContentHash(item) {
  const value = JSON.stringify({
    title: item.title, summary: item.summary, why_it_matters: item.why_it_matters,
    source: item.source, url: item.url, published_at: item.published_at,
    category: item.category, region: item.region, tags: item.tags,
    collection_type: item.collection_type, is_top_pick: item.is_top_pick, sort_order: item.sort_order,
  });
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ (code + i), 0x85ebca6b);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

function normalizeRadarFeed(feed) {
  const reportDate = String(feed.report_date || new Date().toISOString().slice(0, 10));
  const generatedAt = feed.generated_at || null;
  const candidates = [
    ...(Array.isArray(feed.top5) ? feed.top5.map((item, i) => ({ item, collection_type: "global_top5", is_top_pick: 1, sort_order: i })) : []),
    ...(Array.isArray(feed.news) ? feed.news.map((item, i) => ({ item, collection_type: "global_news", is_top_pick: 0, sort_order: i })) : []),
    ...(Array.isArray(feed.china_ai_news) ? feed.china_ai_news.map((item, i) => ({ item, collection_type: "china_ai_news", is_top_pick: 0, sort_order: i })) : []),
  ];
  const seen = new Set(), normalized = [];
  for (const candidate of candidates) {
    const item = candidate.item || {};
    const url = canonicalBriefUrl(item.url || "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const tags = Array.isArray(item.topics) ? item.topics : (Array.isArray(item.tags) ? item.tags : []);
    const normalizedItem = {
      item_id: "radar:" + url, url,
      title: String(item.title_zh || item.title || item.title_en || "未命名简报线索").slice(0, 800),
      summary: String(item.summary_zh || item.summary || item.summary_en || "").slice(0, 6000),
      why_it_matters: String(item.why_it_matters_zh || item.why_it_matters || "").slice(0, 3000),
      source: String(item.source || item.publisher || "DAVY Radar").slice(0, 300),
      published_at: item.published || item.published_at || null,
      category: String(item.category_zh || item.category || item.category_en || item.daily_theme || "").slice(0, 200),
      region: String(item.region || "").slice(0, 100),
      tags, tags_json: JSON.stringify(tags),
      report_date: reportDate, source_generated_at: generatedAt,
      collection_type: candidate.collection_type,
      is_top_pick: candidate.is_top_pick, sort_order: candidate.sort_order,
    };
    normalizedItem.content_hash = briefContentHash(normalizedItem);
    normalized.push(normalizedItem);
    if (normalized.length >= 60) break;
  }
  return { reportDate, generatedAt, items: normalized };
}


const CANDIDATE_RULES = [
  {region_key:"hook",title:"Hook 事件触发与自动校验",terms:[{re:/\bhooks?\b|\bwebhooks?\b/i,label:"Hook"},{re:/钩子|事件触发|生命周期/,label:"事件触发"}]},
  {region_key:"harness",title:"Harness 执行环境与可靠性",terms:[{re:/\bharness\b|\bevals?\b|\bevaluations?\b|benchmark/i,label:"Harness / Eval"},{re:/评测|评估|基准测试|可靠性|错误恢复|上下文管理/,label:"评测与可靠性"}]},
  {region_key:"skill",title:"可复用 Skill 与任务方法",terms:[{re:/\bskills?\b/i,label:"Skill"},{re:/技能|可复用方法|技能库/,label:"可复用方法"}]},
  {region_key:"tools",title:"MCP 与外部工具集成",terms:[{re:/\bmcp\b|tool calling|tool use|function calling/i,label:"MCP / Tool calling"},{re:/工具调用|外部工具/,label:"工具调用"}]},
  {region_key:"knowledge",title:"RAG、知识库与可追溯检索",terms:[{re:/\brag\b|retrieval|embedding|vector database|knowledge base/i,label:"RAG / Retrieval"},{re:/知识库|检索增强|向量检索|向量数据库/,label:"知识检索"}]},
  {region_key:"agent",title:"Agent 规划、工具调用与任务验证",terms:[{re:/\bagents?\b|agentic/i,label:"Agent"},{re:/智能体|多智能体/,label:"智能体"}]},
  {region_key:"models",title:"模型能力、上下文与推理",terms:[{re:/\bllms?\b|foundation model|reasoning model|language model/i,label:"LLM / Reasoning"},{re:/模型能力|大语言模型|推理模型|多模态模型|模型上下文/,label:"模型能力"}]},
  {region_key:"workflow",title:"AI 工作流与业务自动化",terms:[{re:/\bworkflows?\b|automation|automate|pipeline/i,label:"Workflow / Automation"},{re:/工作流|自动化|流程编排/,label:"工作流"}]},
  {region_key:"creator",title:"AI 编程与应用构建",terms:[{re:/coding|code generation|\bide\b|app builder/i,label:"AI coding"},{re:/编程|AI开发|开发工具|应用构建/,label:"应用构建"}]},
  {region_key:"prompt",title:"提示词与上下文设计",terms:[{re:/prompt engineering|\bprompts?\b|context engineering/i,label:"Prompt / Context"},{re:/提示词|提示工程|上下文工程/,label:"提示词"}]},
];
function classifyRadarCandidate(item) {
  const text=[item.title,item.summary,item.why_it_matters,item.source,item.category,item.region,...(Array.isArray(item.tags)?item.tags:[])].filter(Boolean).join(" ");
  for(const rule of CANDIDATE_RULES){const terms=rule.terms.filter(x=>x.re.test(text)).map(x=>x.label);if(terms.length)return {rule,terms};}
  return null;
}
function candidateFingerprint(items) {
  const value=items.map(x=>x.content_hash).sort().join("|");let a=0x811c9dc5,b=0x9e3779b9;
  for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,0x01000193);b=Math.imul(b^(c+i),0x85ebca6b);}
  return (a>>>0).toString(16).padStart(8,"0")+(b>>>0).toString(16).padStart(8,"0");
}
async function discoverLearningCandidates(env,snapshot,now=new Date().toISOString()) {
  const groups=new Map();
  for(const item of snapshot.items){const found=classifyRadarCandidate(item);if(!found)continue;const key=found.rule.region_key;if(!groups.has(key))groups.set(key,{rule:found.rule,sources:[],topics:new Set()});const group=groups.get(key);group.sources.push({item,terms:found.terms});found.terms.forEach(t=>group.topics.add(t));}
  if(!groups.size)return {ok:true,candidate_regions:0,source_links:0};
  const writes=[];
  for(const [regionKey,group] of groups){
    const key="radar-topic:"+regionKey,topics=[...group.topics].slice(0,24);
    const summary=group.sources.length+" 条已公开简报线索与该知识区域主题词匹配。此条目仅是自动发现的候选方向，不是已验证的完整课程。";
    const rationale="基于 DAVY Radar 已发布的标题、摘要、类别与标签进行规则匹配（"+topics.slice(0,8).join("、")+"）。请人工核对原始来源、技术成熟度、适用版本和实操价值。";
    writes.push(env.DB.prepare(
      "INSERT INTO knowledge_candidates (candidate_key,region_key,candidate_title,candidate_summary,rationale,source_manifest_json,matched_topics_json,status,source_count,occurrence_count,first_seen_at,last_seen_at,last_report_date,last_content_hash,review_note,created_at,updated_at) VALUES (?,?,?,?,?,'[]',?,'needs_review',0,0,?,?,?,?, '',?,?) ON CONFLICT(candidate_key) DO UPDATE SET candidate_title=excluded.candidate_title,candidate_summary=excluded.candidate_summary,rationale=excluded.rationale,matched_topics_json=excluded.matched_topics_json,last_seen_at=excluded.last_seen_at,last_report_date=excluded.last_report_date,last_content_hash=excluded.last_content_hash,updated_at=excluded.updated_at"
    ).bind(key,regionKey,group.rule.title,summary,rationale,JSON.stringify(topics),now,now,snapshot.reportDate,candidateFingerprint(group.sources.map(x=>x.item)),now,now));
    for(const entry of group.sources){const item=entry.item,sourceKey=item.item_id+":"+item.content_hash;
      writes.push(env.DB.prepare(
        "INSERT INTO knowledge_candidate_sources (candidate_key,source_key,url,title,summary,why_it_matters,source,published_at,report_date,content_hash,matched_topics_json,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(candidate_key,source_key) DO UPDATE SET title=excluded.title,summary=excluded.summary,why_it_matters=excluded.why_it_matters,source=excluded.source,published_at=excluded.published_at,report_date=excluded.report_date,matched_topics_json=excluded.matched_topics_json,last_seen_at=excluded.last_seen_at"
      ).bind(key,sourceKey,item.url,item.title,item.summary,item.why_it_matters,item.source,item.published_at,item.report_date,item.content_hash,JSON.stringify(entry.terms),now,now));
    }
  }
  await env.DB.batch(writes);
  const updates=[];
  for(const regionKey of groups.keys()){
    const key="radar-topic:"+regionKey;
    const count=await env.DB.prepare("SELECT COUNT(*) occurrence_count,COUNT(DISTINCT url) source_count FROM knowledge_candidate_sources WHERE candidate_key=?").bind(key).first();
    const rows=await env.DB.prepare("SELECT source_key,url,title,summary,why_it_matters,source,published_at,report_date,content_hash,matched_topics_json,last_seen_at FROM knowledge_candidate_sources WHERE candidate_key=? ORDER BY COALESCE(published_at,last_seen_at) DESC,last_seen_at DESC LIMIT 12").bind(key).all();
    const manifest=(rows.results||[]).map(row=>({source_key:row.source_key,url:row.url,title:row.title,summary:row.summary,why_it_matters:row.why_it_matters,source:row.source,published_at:row.published_at,report_date:row.report_date,content_hash:row.content_hash,matched_topics:safeJson(row.matched_topics_json),last_seen_at:row.last_seen_at}));
    updates.push(env.DB.prepare("UPDATE knowledge_candidates SET source_count=?,occurrence_count=?,source_manifest_json=?,updated_at=? WHERE candidate_key=?").bind(count?.source_count||0,count?.occurrence_count||0,JSON.stringify(manifest),now,key));
  }
  await env.DB.batch(updates);
  return {ok:true,candidate_regions:groups.size,source_links:[...groups.values()].reduce((n,g)=>n+g.sources.length,0),note:"Rule-matched source candidates only; no course was generated or published."};
}

async function refreshRadarBriefIndex(env, trigger = "cron") {
  const startedAt = new Date().toISOString();
  const jobId = "radar-brief-refresh-" + Date.now().toString(36);
  await env.DB.prepare(
    "INSERT INTO refresh_jobs (id, job_type, target_key, status, attempt_count, source_manifest_json, error_message, created_at, updated_at, started_at) VALUES (?, 'radar_brief_refresh', 'latest', 'running', 1, ?, '', ?, ?, ?)"
  ).bind(jobId, JSON.stringify({ trigger, source: RADAR_PUBLIC_JSON }), startedAt, startedAt, startedAt).run();

  try {
    const response = await fetch(RADAR_PUBLIC_JSON, { headers: { Accept: "application/json" }, cf: { cacheTtl: 60, cacheEverything: true } });
    if (!response.ok) throw new Error("DAVY Radar source returned HTTP " + response.status);
    const feed = await response.json();
    const snapshot = normalizeRadarFeed(feed);
    if (!snapshot.items.length) throw new Error("DAVY Radar source contained no valid public URLs");

    const now = new Date().toISOString();
    const statements = [env.DB.prepare("UPDATE brief_items SET status = 'archived' WHERE status = 'current'")];
    const snapshotSql = `INSERT OR IGNORE INTO brief_item_versions (
      version_id, item_id, version_seq, title, summary, why_it_matters, source, url,
      published_at, category, region, tags_json, report_date, source_generated_at,
      collection_type, is_top_pick, sort_order, content_hash, recorded_at
    )
    SELECT b.item_id || ':' || b.content_hash, b.item_id,
      COALESCE((SELECT MAX(v.version_seq) + 1 FROM brief_item_versions v WHERE v.item_id = b.item_id), 1),
      b.title, b.summary, b.why_it_matters, b.source, b.url, b.published_at,
      b.category, b.region, b.tags_json, b.report_date, b.source_generated_at,
      b.collection_type, b.is_top_pick, b.sort_order, b.content_hash, ?
    FROM brief_items b
    WHERE b.item_id = ? AND (
      b.content_hash <> ? OR NOT EXISTS (
        SELECT 1 FROM brief_item_versions v WHERE v.item_id = b.item_id AND v.content_hash = b.content_hash
      )
    )`;
    for (const item of snapshot.items) {
      statements.push(env.DB.prepare(
        "INSERT OR IGNORE INTO brief_items (item_id, url, title, summary, why_it_matters, source, published_at, category, region, tags_json, report_date, source_generated_at, collection_type, is_top_pick, sort_order, content_hash, status, first_seen_at, last_seen_at, refreshed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?)"
      ).bind(item.item_id, item.url, item.title, item.summary, item.why_it_matters, item.source, item.published_at, item.category, item.region, item.tags_json, item.report_date, item.source_generated_at, item.collection_type, item.is_top_pick, item.sort_order, item.content_hash, now, now, now));
      statements.push(env.DB.prepare(snapshotSql).bind(now, item.item_id, item.content_hash));
      statements.push(env.DB.prepare(
        "UPDATE brief_items SET url = ?, title = ?, summary = ?, why_it_matters = ?, source = ?, published_at = ?, category = ?, region = ?, tags_json = ?, report_date = ?, source_generated_at = ?, collection_type = ?, is_top_pick = ?, sort_order = ?, content_hash = ?, status = 'current', last_seen_at = ?, refreshed_at = ? WHERE item_id = ? AND content_hash <> ?"
      ).bind(item.url, item.title, item.summary, item.why_it_matters, item.source, item.published_at, item.category, item.region, item.tags_json, item.report_date, item.source_generated_at, item.collection_type, item.is_top_pick, item.sort_order, item.content_hash, now, now, item.item_id, item.content_hash));
      statements.push(env.DB.prepare(
        "UPDATE brief_items SET status = 'current', last_seen_at = ?, refreshed_at = ?, report_date = ?, source_generated_at = ? WHERE item_id = ? AND content_hash = ?"
      ).bind(now, now, item.report_date, item.source_generated_at, item.item_id, item.content_hash));
      statements.push(env.DB.prepare(snapshotSql).bind(now, item.item_id, item.content_hash));
    }

    const results = await env.DB.batch(statements);
    const changes = (results || []).reduce((sum, result) => sum + (result.meta?.changes || 0), 0);
    let candidateSync={ok:false,error:"not_run"};
    try{candidateSync=await discoverLearningCandidates(env,snapshot,new Date().toISOString());}
    catch(err){candidateSync={ok:false,error:String(err?.message||err||"candidate sync failed").slice(0,500)};console.error("Radar learning-candidate sync failed:",candidateSync.error);}
    const finishedAt = new Date().toISOString();
    const manifest = { source: RADAR_PUBLIC_JSON, trigger, report_date: snapshot.reportDate, source_generated_at: snapshot.generatedAt, items_seen: snapshot.items.length, sql_statements: statements.length, d1_changes: changes, candidate_sync:candidateSync };
    await env.DB.prepare(
      "UPDATE refresh_jobs SET status = 'published', source_manifest_json = ?, error_message = ?, updated_at = ?, finished_at = ? WHERE id = ?"
    ).bind(JSON.stringify(manifest), candidateSync.ok?"":"candidate sync warning: "+(candidateSync.error||"unknown"), finishedAt, finishedAt, jobId).run();
    return { ok: true, ...manifest, finished_at: finishedAt };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = String(error?.message || error || "unknown error").slice(0, 800);
    await env.DB.prepare(
      "UPDATE refresh_jobs SET status = 'failed', error_message = ?, updated_at = ?, finished_at = ? WHERE id = ?"
    ).bind(message, finishedAt, finishedAt, jobId).run();
    console.error("Radar index refresh failed:", message);
    return { ok: false, error: message, finished_at: finishedAt };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "origin_not_allowed" }, 403, cors);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: true, service: "ai-field-notes-api", version: API_VERSION, database: "connected" }, 200, cors);
      } catch {
        return json({ ok: false, service: "ai-field-notes-api", version: API_VERSION, database: "unavailable" }, 503, cors);
      }
    }

    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405, { ...cors, Allow: "GET, OPTIONS" });
    }

    if (url.pathname === "/api/atlas/regions") {
      try {
        const result = await env.DB.prepare(
          `SELECT r.region_key AS id, r.title, r.subtitle, r.description, r.tags_json,
                  r.default_state, r.sort_order, r.is_frontier,
                  t.slug AS track_slug, t.title AS track_title,
                  l.id AS lesson_id, l.title AS lesson_title, l.summary AS lesson_summary,
                  l.access_tier AS lesson_access_tier, k.version_label AS lesson_version
           FROM atlas_regions r
           LEFT JOIN learning_tracks t ON t.id = r.track_id
           LEFT JOIN lessons l ON l.id = r.primary_lesson_id
           LEFT JOIN knowledge_releases k ON k.id = l.release_id AND k.status = 'published'
           ORDER BY r.sort_order`
        ).all();
        const items = (result.results || []).map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          description: row.description,
          tags: safeJson(row.tags_json),
          default_state: row.default_state,
          sort_order: row.sort_order,
          is_frontier: Boolean(row.is_frontier),
          track: row.track_slug ? { slug: row.track_slug, title: row.track_title } : null,
          lesson: row.lesson_id && row.lesson_version ? {
            id: row.lesson_id,
            title: row.lesson_title,
            summary: row.lesson_summary,
            access_tier: row.lesson_access_tier,
            version: row.lesson_version,
          } : null,
        }));
        return json({ items, source: "ai-field-notes-dev", generated_at: new Date().toISOString() }, 200, { ...cors, "Cache-Control": "public, max-age=60" });
      } catch {
        return json({ error: "atlas_regions_unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/api/brief/latest") {
      try {
        const result = await env.DB.prepare(
          `SELECT b.item_id AS id, b.title, b.summary, b.why_it_matters, b.source, b.url,
                  b.published_at, b.category, b.region, b.tags_json, b.report_date,
                  b.source_generated_at, b.collection_type, b.is_top_pick, b.sort_order,
                  (SELECT COUNT(*) FROM brief_item_versions v WHERE v.item_id = b.item_id) AS version_count
           FROM brief_items b
           WHERE b.status = 'current'
             AND b.report_date = (SELECT MAX(report_date) FROM brief_items WHERE status = 'current')
           ORDER BY b.is_top_pick DESC,
             CASE b.collection_type WHEN 'global_top5' THEN 0 WHEN 'global_news' THEN 1 ELSE 2 END,
             b.sort_order LIMIT 12`
        ).all();
        if ((result.results || []).length) {
          const lastRefresh = await env.DB.prepare(
            "SELECT finished_at FROM refresh_jobs WHERE job_type = 'radar_brief_refresh' AND status = 'published' ORDER BY created_at DESC LIMIT 1"
          ).first();
          const first = result.results[0];
          return json({
            report_date: first.report_date, generated_at: first.source_generated_at,
            synced_at: lastRefresh?.finished_at || null, status: "ok", source: "DAVY Radar", source_url: RADAR_DAILY_PAGE,
            items: result.results.map((item) => ({
              id: item.id, title: item.title, summary: item.summary, why_it_matters: item.why_it_matters,
              source: item.source, url: item.url, published_at: item.published_at, category: item.category,
              region: item.region, tags: safeJson(item.tags_json), collection_type: item.collection_type,
              is_top_pick: Boolean(item.is_top_pick), version_count: item.version_count,
            })),
          }, 200, { ...cors, "Cache-Control": "public, max-age=60" });
        }
      } catch {
        // Fall back to the existing public briefing if the scheduled index is not ready.
      }

      try {
        const upstream = await fetch(RADAR_PUBLIC_JSON, { headers: { Accept: "application/json" }, cf: { cacheTtl: 60, cacheEverything: true } });
        if (!upstream.ok) return json({ error: "brief_source_unavailable", upstream_status: upstream.status }, 502, cors);
        const brief = await upstream.json();
        const articles = Array.isArray(brief.top5) && brief.top5.length ? brief.top5 : (Array.isArray(brief.news) ? brief.news.slice(0, 5) : []);
        const items = articles.slice(0, 5).map((item, index) => ({
          id: String(item.canonical_id || item.id || item.url || ("radar-" + index)),
          title: item.title_zh || item.title || item.title_en || "未命名简报条目",
          summary: item.summary_zh || item.summary || item.summary_en || "",
          why_it_matters: item.why_it_matters_zh || item.why_it_matters || "",
          source: item.source || item.publisher || "DAVY Radar", url: canonicalBriefUrl(item.url || ""),
          published_at: item.published || item.published_at || null, category: item.category || item.daily_theme || "",
          tags: Array.isArray(item.topics) ? item.topics : (Array.isArray(item.tags) ? item.tags : []), version_count: 0,
        })).filter((item) => item.url.startsWith("https://") || item.url.startsWith("http://"));
        return json({ report_date: brief.report_date || null, generated_at: brief.generated_at || null, synced_at: null, status: brief.status || "unknown", source: "DAVY Radar", source_url: RADAR_DAILY_PAGE, items }, 200, { ...cors, "Cache-Control": "public, max-age=60" });
      } catch {
        return json({ error: "brief_source_unavailable" }, 502, cors);
      }
    }

    if (url.pathname === "/api/learning/candidates") {
      try {
        const result=await env.DB.prepare("SELECT c.candidate_key,c.region_key,r.title region_title,c.candidate_title,c.candidate_summary,c.rationale,c.source_manifest_json,c.matched_topics_json,c.status,c.source_count,c.occurrence_count,c.first_seen_at,c.last_seen_at,c.last_report_date,c.updated_at FROM knowledge_candidates c JOIN atlas_regions r ON r.region_key=c.region_key WHERE c.status IN ('needs_review','in_review') ORDER BY c.last_seen_at DESC,c.source_count DESC LIMIT 20").all();
        const items=(result.results||[]).map(row=>({id:row.candidate_key,region:{key:row.region_key,title:row.region_title},title:row.candidate_title,summary:row.candidate_summary,rationale:row.rationale,matched_topics:safeJson(row.matched_topics_json),status:row.status,source_count:row.source_count,occurrence_count:row.occurrence_count,first_seen_at:row.first_seen_at,last_seen_at:row.last_seen_at,report_date:row.last_report_date,updated_at:row.updated_at,sources:safeJson(row.source_manifest_json),review_required:true,published_as_course:false}));
        return json({count:items.length,items,generated_at:new Date().toISOString(),mode:"source-grounded-rule-candidates"},200,{...cors,"Cache-Control":"public, max-age=60"});
      } catch { return json({error:"learning_candidates_unavailable"},503,cors); }
    }

    if (url.pathname === "/api/brief/versions") {
      const canonical = canonicalBriefUrl(url.searchParams.get("url") || "");
      if (!canonical) return json({ error: "valid_source_url_required" }, 400, cors);
      try {
        const result = await env.DB.prepare(
          "SELECT version_seq, title, summary, why_it_matters, source, url, published_at, category, region, tags_json, report_date, collection_type, is_top_pick, content_hash, recorded_at FROM brief_item_versions WHERE item_id = ? ORDER BY version_seq DESC LIMIT 30"
        ).bind("radar:" + canonical).all();
        return json({ url: canonical, count: (result.results || []).length, versions: (result.results || []).map((item) => ({
          version_seq: item.version_seq, title: item.title, summary: item.summary, why_it_matters: item.why_it_matters,
          source: item.source, url: item.url, published_at: item.published_at, report_date: item.report_date,
          category: item.category, region: item.region, tags: safeJson(item.tags_json),
          is_top_pick: Boolean(item.is_top_pick), recorded_at: item.recorded_at,
        })) }, 200, { ...cors, "Cache-Control": "public, max-age=60" });
      } catch {
        return json({ error: "brief_versions_unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/api/search") {
      const rawQuery = (url.searchParams.get("q") || "").trim().slice(0, 120);
      const normalized = rawQuery.toLowerCase().replace(/[，。！？?!、,.;；:："'“”()（）]/g, " ");
      const latinTerms = normalized.match(/[a-z0-9][a-z0-9._-]*/g) || [];
      const cjkRuns = normalized.match(/[\u3400-\u9fff]+/g) || [];
      const stopWords = new Set(["如何","怎么","怎样","什么","哪些","可以","能否","请问","一个","一种","这个","那个","以及","对于","进行","帮我","如何用","怎么用"]);
      const cjkTerms = [];
      for (const run of cjkRuns) {
        if (run.length >= 2 && run.length <= 8 && !stopWords.has(run)) cjkTerms.push(run);
        // Add bigrams before trigrams so meaningful Chinese keywords survive the query-term cap.
        for (let i = 0; i < run.length - 1; i++) {
          const pair = run.slice(i, i + 2);
          if (!stopWords.has(pair)) cjkTerms.push(pair);
        }
        for (let i = 0; i < run.length - 2; i++) {
          const tri = run.slice(i, i + 3);
          if (!stopWords.has(tri)) cjkTerms.push(tri);
        }
      }
      let candidates = [...new Set([...latinTerms, ...cjkTerms].filter((term) => term.length >= 2 && !stopWords.has(term)))];
      // A lone "AI" query is useful; in longer questions it is too generic to dominate matching.
      if (candidates.length > 1) candidates = candidates.filter((term) => !["ai", "the", "how", "what"].includes(term));
      const terms = candidates.slice(0, 12);
      try {
        let sql = `SELECT l.id, l.slug, l.title, l.summary, l.content_markdown, l.content_json,
                          l.access_tier, l.estimated_minutes, t.slug AS track_slug,
                          t.title AS track_title, r.version_label
                   FROM lessons l
                   JOIN knowledge_releases r ON r.id = l.release_id
                   JOIN learning_tracks t ON t.id = r.track_id
                   WHERE r.status = 'published' AND t.status = 'published' AND l.access_tier = 'free'`;
        const params = [];
        if (terms.length) {
          const where = terms.map(() => "(lower(l.title) LIKE ? OR lower(l.summary) LIKE ? OR lower(l.content_markdown) LIKE ? OR lower(l.content_json) LIKE ? OR lower(t.title) LIKE ?)").join(" OR ");
          sql += " AND (" + where + ")";
          for (const term of terms) {
            const pattern = "%" + term + "%";
            params.push(pattern, pattern, pattern, pattern, pattern);
          }
          const ranking = terms.map(() => "(CASE WHEN lower(l.title) LIKE ? THEN 8 ELSE 0 END + CASE WHEN lower(t.title) LIKE ? THEN 6 ELSE 0 END + CASE WHEN lower(l.summary) LIKE ? THEN 3 ELSE 0 END + CASE WHEN lower(l.content_markdown) LIKE ? THEN 1 ELSE 0 END + CASE WHEN lower(l.content_json) LIKE ? THEN 2 ELSE 0 END)").join(" + ");
          sql += " ORDER BY (" + ranking + ") DESC, t.sort_order, l.sort_order";
          for (const term of terms) {
            const pattern = "%" + term + "%";
            params.push(pattern, pattern, pattern, pattern, pattern);
          }
        } else {
          sql += " ORDER BY t.sort_order, l.sort_order";
        }
        sql += " LIMIT 12";
        const statement = env.DB.prepare(sql);
        const result = await (params.length ? statement.bind(...params) : statement).all();
        const items = (result.results || []).map((row) => {
          const body = safeJson(row.content_json);
          return {
            id: row.id,
            slug: row.slug,
            title: row.title,
            summary: row.summary,
            excerpt: (row.content_markdown || "").slice(0, 280),
            tags: Array.isArray(body.tags) ? body.tags : [],
            access_tier: row.access_tier,
            estimated_minutes: row.estimated_minutes,
            track: { slug: row.track_slug, title: row.track_title },
            version: row.version_label,
            source_label: "AI Field Notes " + row.version_label,
          };
        });
        let briefs = [];
        let briefIndexAvailable = false;
        if (terms.length) {
          try {
            const currentCount = await env.DB.prepare(
              "SELECT COUNT(*) AS count FROM brief_items WHERE status = 'current' AND report_date = (SELECT MAX(report_date) FROM brief_items WHERE status = 'current')"
            ).first();
            if ((currentCount?.count || 0) > 0) {
              const where = terms.map(() => "(lower(b.title) LIKE ? OR lower(b.summary) LIKE ? OR lower(b.why_it_matters) LIKE ? OR lower(b.source) LIKE ? OR lower(b.category) LIKE ? OR lower(b.tags_json) LIKE ?)").join(" OR ");
              const searchParams = [];
              for (const term of terms) {
                const pattern = "%" + term + "%";
                searchParams.push(pattern, pattern, pattern, pattern, pattern, pattern);
              }
              const result = await env.DB.prepare(
                `SELECT b.item_id AS id, b.title, b.summary, b.why_it_matters, b.source, b.url,
                        b.published_at, b.category, b.region, b.tags_json, b.report_date,
                        b.collection_type, b.is_top_pick,
                        (SELECT COUNT(*) FROM brief_item_versions v WHERE v.item_id = b.item_id) AS version_count
                 FROM brief_items b
                 WHERE b.status = 'current'
                   AND b.report_date = (SELECT MAX(report_date) FROM brief_items WHERE status = 'current')
                   AND (${where})
                 ORDER BY b.is_top_pick DESC,
                   CASE b.collection_type WHEN 'global_top5' THEN 0 WHEN 'global_news' THEN 1 ELSE 2 END,
                   b.sort_order LIMIT 5`
              ).bind(...searchParams).all();
              briefs = (result.results || []).map((item) => ({
                id: item.id, title: item.title, summary: item.summary, why_it_matters: item.why_it_matters,
                source: item.source, url: item.url, published_at: item.published_at, category: item.category,
                tags: safeJson(item.tags_json), version_count: item.version_count, type: "brief",
              }));
              briefIndexAvailable = true;
            }
          } catch { briefIndexAvailable = false; }
          if (!briefIndexAvailable) {
            try {
              const sourceResponse = await fetch(RADAR_PUBLIC_JSON, { headers: { Accept: "application/json" }, cf: { cacheTtl: 60, cacheEverything: true } });
              if (sourceResponse.ok) {
                const sourceData = await sourceResponse.json();
                const sourceItems = [
                  ...(Array.isArray(sourceData.top5) ? sourceData.top5 : []),
                  ...(Array.isArray(sourceData.news) ? sourceData.news : []),
                  ...(Array.isArray(sourceData.china_ai_news) ? sourceData.china_ai_news : []),
                ];
                const seen = new Set();
                briefs = sourceItems.filter((item) => {
                  const url = canonicalBriefUrl(item.url || ""), key = url || item.title_zh || item.title;
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  const haystack = [item.title_zh, item.title, item.title_en, item.summary_zh, item.summary, item.summary_en, item.why_it_matters_zh, item.source, item.category].filter(Boolean).join(" ").toLowerCase();
                  return terms.some((term) => haystack.includes(term));
                }).slice(0, 5).map((item, index) => ({
                  id: String(item.canonical_id || item.id || item.url || ("radar-search-" + index)),
                  title: item.title_zh || item.title || item.title_en || "未命名简报",
                  summary: item.summary_zh || item.summary || item.summary_en || "",
                  source: item.source || item.publisher || "DAVY Radar", url: canonicalBriefUrl(item.url || ""),
                  published_at: item.published || item.published_at || null,
                  why_it_matters: item.why_it_matters_zh || item.why_it_matters || "",
                  type: "brief", version_count: 0,
                })).filter((item) => item.url.startsWith("https://") || item.url.startsWith("http://"));
              }
            } catch { briefs = []; }
          }
        }
        const courseItems = items.map((item) => ({ ...item, type: "lesson" }));
        return json({ query: rawQuery, count: courseItems.length + briefs.length, items: courseItems, briefs, mode: terms.length ? "keyword" : "catalog", terms }, 200, { ...cors, "Cache-Control": "public, max-age=30" });
      } catch {
        return json({ error: "search_unavailable" }, 503, cors);
      }
    }

    if (url.pathname === "/api/tracks") {
      try {
        const result = await env.DB.prepare(
          "SELECT id, slug, title, description, access_tier, sort_order, updated_at FROM learning_tracks WHERE status = 'published' ORDER BY sort_order, title"
        ).all();
        return json({ items: result.results || [] }, 200, { ...cors, "Cache-Control": "public, max-age=30" });
      } catch {
        return json({ error: "tracks_unavailable" }, 503, cors);
      }
    }

    const trackMatch = url.pathname.match(/^\/api\/tracks\/([^/]+)\/releases$/);
    if (trackMatch) {
      const slug = decodeURIComponent(trackMatch[1]);
      try {
        const track = await env.DB.prepare(
          "SELECT id, slug, title, description, access_tier FROM learning_tracks WHERE slug = ? AND status = 'published'"
        ).bind(slug).first();
        if (!track) return json({ error: "track_not_found" }, 404, cors);

        const result = await env.DB.prepare(
          "SELECT id, version_label, version_seq, release_notes, published_at FROM knowledge_releases WHERE track_id = ? AND status = 'published' ORDER BY version_seq DESC"
        ).bind(track.id).all();
        return json({ track, releases: result.results || [] }, 200, { ...cors, "Cache-Control": "public, max-age=30" });
      } catch {
        return json({ error: "releases_unavailable" }, 503, cors);
      }
    }

    const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/lessons$/);
    if (releaseMatch) {
      const releaseId = decodeURIComponent(releaseMatch[1]);
      try {
        const release = await env.DB.prepare(
          "SELECT id, track_id, version_label, status FROM knowledge_releases WHERE id = ? AND status = 'published'"
        ).bind(releaseId).first();
        if (!release) return json({ error: "release_not_found" }, 404, cors);

        const result = await env.DB.prepare(
          "SELECT id, slug, title, summary, access_tier, estimated_minutes, sort_order FROM lessons WHERE release_id = ? ORDER BY sort_order, title"
        ).bind(releaseId).all();
        return json({
          release: { id: release.id, track_id: release.track_id, version_label: release.version_label },
          items: (result.results || []).map((item) => ({
            ...item,
            locked: item.access_tier === "pro",
          })),
        }, 200, { ...cors, "Cache-Control": "public, max-age=30" });
      } catch {
        return json({ error: "lessons_unavailable" }, 503, cors);
      }
    }

    const lessonMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)$/);
    if (lessonMatch) {
      const lessonId = decodeURIComponent(lessonMatch[1]);
      try {
        const lesson = await env.DB.prepare(
          "SELECT l.id, l.slug, l.title, l.summary, l.content_markdown, l.content_json, l.access_tier, l.estimated_minutes, r.id AS release_id, r.version_label, r.status AS release_status FROM lessons l JOIN knowledge_releases r ON r.id = l.release_id WHERE l.id = ?"
        ).bind(lessonId).first();

        if (!lesson || lesson.release_status !== "published") {
          return json({ error: "lesson_not_found" }, 404, cors);
        }
        if (lesson.access_tier === "pro") {
          // Pro lesson bodies are never returned by this public unauthenticated endpoint.
          return json({ error: "authentication_required", locked: true }, 401, cors);
        }

        return json({
          lesson: {
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary,
            content_markdown: lesson.content_markdown,
            content_json: safeJson(lesson.content_json),
            access_tier: lesson.access_tier,
            estimated_minutes: lesson.estimated_minutes,
          },
          release: { id: lesson.release_id, version_label: lesson.version_label },
        }, 200, cors);
      } catch {
        return json({ error: "lesson_unavailable" }, 503, cors);
      }
    }

    return json({ error: "not_found" }, 404, cors);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(refreshRadarBriefIndex(env, "cron:" + String(controller.cron || "scheduled")));
  },
};

function safeJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
