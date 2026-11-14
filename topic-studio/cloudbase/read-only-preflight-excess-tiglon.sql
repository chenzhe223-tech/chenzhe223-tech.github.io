-- DAVYLAB Content Studio · PostgreSQL read-only preflight
-- Only use this in CloudBase environment excess-tiglon-d6gjc77qr6fa193f2.
-- No inserts/updates/deletes/DDL; does NOT display any user drafts or account secrets.
-- This SQL cannot distinguish CloudBase environment IDs: VERIFY console header first.
SELECT
  current_database() AS database_name,
  current_schema() AS active_schema,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AS role_anon_exists,
  EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AS role_authenticated_exists,
  to_regprocedure('auth.uid()') IS NOT NULL AS auth_uid_available,
  to_regprocedure('auth.role()') IS NOT NULL AS auth_role_available,
  to_regprocedure('auth.jwt()') IS NOT NULL AS auth_jwt_available;

-- Metadata only. Existing app tables must not be edited.
SELECT
  n.nspname AS schema_name, c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relkind IN ('r','p')
  AND c.relname IN (
   'cron_locks','dashboard_metrics','mail_board_snapshots',
   'davylab_ts_v1_allowed_owners','davylab_ts_v1_documents'
  )
ORDER BY c.relname;

-- Only policy NAMES, no stored user data.
SELECT tablename,policyname,cmd,roles
FROM pg_policies
WHERE schemaname='public'
  AND tablename='davylab_ts_v1_documents'
ORDER BY policyname;

-- Intentionally no SELECT from any business data table.
