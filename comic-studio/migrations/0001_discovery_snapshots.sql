-- WORLD/TOON Discovery Cache v2 · isolated from AI usage_counts
-- Writes are performed only by the scheduled Worker, never anonymous clients.
CREATE TABLE IF NOT EXISTS wt_discovery_snapshots (
 source TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL,
 item_count INTEGER NOT NULL DEFAULT 0,
 collected_at TEXT NOT NULL,
 last_attempt_at TEXT NOT NULL,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS wt_discovery_snapshots_collected ON wt_discovery_snapshots(collected_at);
