-- AI Field Notes V2 migration 0003: do not assume first-time visitors have already learned topics.
-- The starting camp is an active starting point; all knowledge regions begin unexplored.
UPDATE atlas_regions SET default_state = 'unknown';
UPDATE atlas_regions SET default_state = 'exploring' WHERE region_key = 'origin';
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES ('0003','neutral_personal_atlas_starting_state');
