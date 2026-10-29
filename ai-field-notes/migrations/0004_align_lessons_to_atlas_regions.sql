-- AI Field Notes V2 migration 0004: only attach lessons to regions they actually teach.
-- The base camp is a starting marker, and Prompt Canyon remains a future dedicated topic.
UPDATE atlas_regions SET track_id = NULL, primary_lesson_id = NULL WHERE region_key IN ('origin','prompt');
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES ('0004_align_lessons_to_atlas_regions','align_lesson_links_with_region_scope');
