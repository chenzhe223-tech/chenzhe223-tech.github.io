-- Guard first-time discovery seeding from concurrent visitors.
CREATE TABLE IF NOT EXISTS wt_discovery_bootstrap (
 id TEXT PRIMARY KEY NOT NULL,
 locked_until INTEGER NOT NULL DEFAULT 0
);
