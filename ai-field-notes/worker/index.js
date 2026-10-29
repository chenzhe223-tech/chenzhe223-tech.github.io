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
