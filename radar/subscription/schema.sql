PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  interests_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','active','unsubscribed')),
  consent_at TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmation_token_hash TEXT,
  unsubscribe_token_hash TEXT NOT NULL,
  last_sent_date TEXT,
  last_send_status TEXT,
  last_send_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_last_sent ON subscribers(last_sent_date);

CREATE TABLE IF NOT EXISTS send_log (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','skipped','failed')),
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id)
);

CREATE INDEX IF NOT EXISTS idx_send_log_date ON send_log(report_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_send_log_daily_once ON send_log(report_date, subscriber_id);


-- Keep older email unsubscribe links valid until the subscriber opts out.
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token_hash TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_subscriber ON unsubscribe_tokens(subscriber_id);
