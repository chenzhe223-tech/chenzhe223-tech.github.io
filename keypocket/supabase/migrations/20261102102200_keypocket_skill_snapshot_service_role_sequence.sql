-- Identity sequence is used by the service-role-only daily Skill Radar collector.
grant usage, select on sequence public.keypocket_skill_snapshots_id_seq to service_role;
