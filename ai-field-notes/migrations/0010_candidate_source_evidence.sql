-- AI Field Notes V2 migration 0010: retain deduplicated source snapshots behind draft candidates.

CREATE TABLE IF NOT EXISTS knowledge_candidate_sources (
  candidate_key TEXT NOT NULL REFERENCES knowledge_candidates(candidate_key) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'DAVY Radar',
  published_at TEXT,
  report_date TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  matched_topics_json TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY(candidate_key, source_key)
);
CREATE INDEX IF NOT EXISTS idx_candidate_sources_key_date
  ON knowledge_candidate_sources(candidate_key, published_at DESC, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_sources_url
  ON knowledge_candidate_sources(url);

INSERT OR IGNORE INTO schema_migrations(version,name)
VALUES ('0010','store_source_evidence_for_learning_candidates');
