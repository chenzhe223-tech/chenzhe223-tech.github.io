const ALLOWED_ORIGIN = "https://chenzhe223-tech.github.io";
const API_VERSION = "0.1.0";

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
        const upstream = await fetch("https://chenzhe223-tech.github.io/radar/data/latest.json", {
          headers: { Accept: "application/json" },
          cf: { cacheTtl: 120, cacheEverything: true },
        });
        if (!upstream.ok) return json({ error: "brief_source_unavailable", upstream_status: upstream.status }, 502, cors);
        const brief = await upstream.json();
        const articles = Array.isArray(brief.top5) && brief.top5.length
          ? brief.top5
          : (Array.isArray(brief.news) ? brief.news.slice(0, 5) : []);
        const items = articles.slice(0, 5).map((item, index) => ({
          id: String(item.canonical_id || item.id || item.url || ("radar-" + index)),
          title: item.title_zh || item.title || item.title_en || "未命名简报条目",
          summary: item.summary_zh || item.summary || item.summary_en || "",
          why_it_matters: item.why_it_matters_zh || item.why_it_matters || "",
          source: item.source || item.publisher || "DAVY Radar",
          url: item.url || "",
          published_at: item.published || item.published_at || null,
          category: item.category || item.daily_theme || "",
          tags: Array.isArray(item.topics) ? item.topics : (Array.isArray(item.tags) ? item.tags : []),
        })).filter((item) => item.url.startsWith("https://") || item.url.startsWith("http://"));
        return json({
          report_date: brief.report_date || null,
          generated_at: brief.generated_at || null,
          status: brief.status || "unknown",
          source: "DAVY Radar",
          source_url: "https://chenzhe223-tech.github.io/radar/daily/",
          items,
        }, 200, { ...cors, "Cache-Control": "public, max-age=120" });
      } catch {
        return json({ error: "brief_source_unavailable" }, 502, cors);
      }
    }

    if (url.pathname === "/api/search") {
      const rawQuery = (url.searchParams.get("q") || "").trim().slice(0, 120);
      const normalized = rawQuery.toLowerCase().replace(/[，。！？?!、,.;；:："'“”()（）]/g, " ");
      const latinTerms = normalized.match(/[a-z0-9][a-z0-9._-]*/g) || [];
      const cjkRuns = normalized.match(/[\\u3400-\\u9fff]+/g) || [];
      const stopWords = new Set(["如何","怎么","怎样","什么","哪些","可以","能否","请问","一个","一种","这个","那个","以及","对于","进行","帮我","如何用","怎么用"]);
      const cjkTerms = [];
      for (const run of cjkRuns) {
        if (run.length >= 2 && run.length <= 8 && !stopWords.has(run)) cjkTerms.push(run);
        for (let i = 0; i < run.length - 2; i++) {
          const tri = run.slice(i, i + 3);
          if (!stopWords.has(tri)) cjkTerms.push(tri);
        }
        for (let i = 0; i < run.length - 1; i++) {
          const pair = run.slice(i, i + 2);
          if (!stopWords.has(pair)) cjkTerms.push(pair);
        }
      }
      const terms = [...new Set([...latinTerms, ...cjkTerms].filter((term) => term.length >= 2 && !stopWords.has(term)))].slice(0, 12);
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
          const where = terms.map(() => "(lower(l.title) LIKE ? OR lower(l.summary) LIKE ? OR lower(l.content_markdown) LIKE ? OR lower(t.title) LIKE ?)").join(" OR ");
          sql += " AND (" + where + ")";
          for (const term of terms) {
            const pattern = "%" + term + "%";
            params.push(pattern, pattern, pattern, pattern);
          }
          const ranking = terms.map(() => "(CASE WHEN lower(l.title) LIKE ? THEN 8 ELSE 0 END + CASE WHEN lower(t.title) LIKE ? THEN 6 ELSE 0 END + CASE WHEN lower(l.summary) LIKE ? THEN 3 ELSE 0 END + CASE WHEN lower(l.content_markdown) LIKE ? THEN 1 ELSE 0 END)").join(" + ");
          sql += " ORDER BY (" + ranking + ") DESC, t.sort_order, l.sort_order";
          for (const term of terms) {
            const pattern = "%" + term + "%";
            params.push(pattern, pattern, pattern, pattern);
          }
        } else {
          sql += " ORDER BY t.sort_order, l.sort_order";
        }
        sql += " LIMIT 12";
        const result = await env.DB.prepare(sql).bind(...params).all();
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
        return json({ query: rawQuery, count: items.length, items, mode: terms.length ? "keyword" : "catalog", terms }, 200, { ...cors, "Cache-Control": "public, max-age=30" });
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
};

function safeJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
