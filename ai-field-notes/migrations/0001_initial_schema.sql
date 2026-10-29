-- AI Field Notes V2 - Cloudflare D1 initial schema
-- This migration is for the isolated ai-field-notes-dev database.
-- Keep versioned learning content immutable after publication; progress links to exact lesson IDs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Identity provider tokens/secrets are intentionally not stored here.
CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email_at_provider TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_subject)
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);

-- Store only a hash of opaque session tokens, never the raw bearer token.
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expiry ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS learning_tracks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  access_tier TEXT NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_releases (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES learning_tracks(id) ON DELETE RESTRICT,
  version_label TEXT NOT NULL,
  version_seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  release_notes TEXT NOT NULL DEFAULT '',
  source_manifest_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(track_id, version_label),
  UNIQUE(track_id, version_seq)
);
CREATE INDEX IF NOT EXISTS idx_releases_status_published ON knowledge_releases(status, published_at);

-- A lesson row belongs to one immutable release. Updated course content gets new lesson IDs in a new release.
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES knowledge_releases(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content_markdown TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  access_tier TEXT NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'pro')),
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(release_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_lessons_release_order ON lessons(release_id, sort_order);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  score REAL,
  state_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user_updated ON lesson_progress(user_id, updated_at);

CREATE TABLE IF NOT EXISTS learning_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_notes_user_updated ON learning_notes(user_id, updated_at);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('lesson', 'release', 'brief_item', 'source', 'search')),
  resource_id TEXT NOT NULL,
  title_snapshot TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT,
  verified_at TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'stale', 'unavailable', 'rejected')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_key)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON knowledge_sources(verification_status, verified_at);

CREATE TABLE IF NOT EXISTS source_lesson_links (
  source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'supports',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(source_id, lesson_id, relation_type)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('one_time', 'subscription')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  entitlement_code TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_code TEXT NOT NULL REFERENCES products(product_code) ON DELETE RESTRICT,
  payment_provider TEXT NOT NULL,
  provider_order_id TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  provider_event_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  UNIQUE(payment_provider, provider_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_code TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('purchase', 'subscription', 'admin_grant', 'promotion')),
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entitlement_code, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_code_status ON entitlements(user_id, entitlement_code, status, valid_until);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  feature_code TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1 CHECK (units >= 0),
  period_day TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_user_feature_day ON usage_events(user_id, feature_code, period_day);

CREATE TABLE IF NOT EXISTS refresh_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'review', 'published', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  source_manifest_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_status_created ON refresh_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_resource_created ON audit_events(resource_type, resource_id, created_at);

INSERT OR IGNORE INTO schema_migrations(version, name) VALUES ('0001', 'initial_learning_platform_schema');
