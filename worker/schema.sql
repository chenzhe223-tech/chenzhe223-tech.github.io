PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS subscribers (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL UNIQUE,
 topics_json TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','active','unsubscribed','bounced')),
 confirm_hash TEXT,
 unsubscribe_hash TEXT NOT NULL,
 consent_at TEXT,
 confirmed_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON subscribers(confirm_hash);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribe ON subscribers(unsubscribe_hash);
CREATE TABLE IF NOT EXISTS deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 subscriber_id INTEGER NOT NULL REFERENCES subscribers(id),
 report_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('sent','failed','skipped')),
 error TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(subscriber_id, report_date)
);
CREATE TABLE IF NOT EXISTS delivery_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 run_date TEXT NOT NULL,
 status TEXT NOT NULL,
 details TEXT NOT NULL,
 created_at TEXT NOT NULL
);
