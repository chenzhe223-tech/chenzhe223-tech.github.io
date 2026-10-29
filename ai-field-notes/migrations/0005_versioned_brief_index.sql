-- AI Field Notes V2 migration 0005: versioned index for public DAVY Radar signals.
-- The scheduled Worker only indexes public briefing metadata; course content is not auto-published by this job.

CREATE TABLE IF NOT EXISTS brief_items (
  item_id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'DAVY Radar',
  published_at TEXT,
  category TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  report_date TEXT NOT NULL,
  source_generated_at TEXT,
  collection_type TEXT NOT NULL DEFAULT 'global_news'
    CHECK (collection_type IN ('global_top5','global_news','china_ai_news')),
  is_top_pick INTEGER NOT NULL DEFAULT 0 CHECK (is_top_pick IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current','archived')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  refreshed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brief_items_current_date
  ON brief_items(status, report_date, is_top_pick, collection_type, sort_order);
CREATE INDEX IF NOT EXISTS idx_brief_items_source_url
  ON brief_items(source, url);

CREATE TABLE IF NOT EXISTS brief_item_versions (
  version_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES brief_items(item_id) ON DELETE CASCADE,
  version_seq INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  published_at TEXT,
  category TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  report_date TEXT NOT NULL,
  source_generated_at TEXT,
  collection_type TEXT NOT NULL,
  is_top_pick INTEGER NOT NULL DEFAULT 0 CHECK (is_top_pick IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE(item_id, content_hash),
  UNIQUE(item_id, version_seq)
);
CREATE INDEX IF NOT EXISTS idx_brief_item_versions_seq
  ON brief_item_versions(item_id, version_seq DESC);

INSERT OR IGNORE INTO schema_migrations(version,name)
VALUES ('0005','versioned_davy_radar_brief_index');
