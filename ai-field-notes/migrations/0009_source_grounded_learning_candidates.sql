-- AI Field Notes V2 migration 0009: source-grounded draft candidates for future learning tracks.
-- Candidates are generated from public Radar metadata only; they are not published lessons.

CREATE TABLE IF NOT EXISTS knowledge_candidates (
  candidate_key TEXT PRIMARY KEY,
  region_key TEXT NOT NULL REFERENCES atlas_regions(region_key) ON DELETE RESTRICT,
  candidate_title TEXT NOT NULL,
  candidate_summary TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '',
  source_manifest_json TEXT NOT NULL DEFAULT '[]',
  matched_topics_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('needs_review','in_review','approved','rejected','converted')),
  source_count INTEGER NOT NULL DEFAULT 0,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_report_date TEXT NOT NULL,
  last_content_hash TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_review
  ON knowledge_candidates(status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_region
  ON knowledge_candidates(region_key, status);

INSERT OR IGNORE INTO schema_migrations(version,name)
VALUES ('0009','source_grounded_learning_candidates');
