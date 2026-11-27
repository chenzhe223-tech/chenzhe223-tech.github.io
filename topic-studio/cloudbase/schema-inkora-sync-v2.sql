-- INKORA BY DAVYLAB / excess-tiglon-d6gjc77qr6fa193f2 ONLY.
-- Execute AFTER schema-postgres-p1-excess-tiglon.sql in the private SQL console.
-- Additive: no existing business table is modified except the INKORA-owned table.
BEGIN;
DO $guard$
BEGIN
 IF to_regclass('public.davylab_ts_v1_documents') IS NULL
 OR to_regprocedure('public.davylab_ts_v1_is_allowed()') IS NULL
 OR to_regprocedure('public.davylab_ts_v1_put(text,text,jsonb,integer)') IS NULL THEN
  RAISE EXCEPTION 'INKORA_BASE_SCHEMA_REQUIRED';
 END IF;
END $guard$;

CREATE OR REPLACE FUNCTION public.davylab_ts_v1_sync_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
 OR NOT public.davylab_ts_v1_is_allowed() THEN
  RAISE EXCEPTION 'DAVYLAB_OWNER_NOT_ALLOWED' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('schema',2,'owner_allowed',true,'revision_cas',true,'tombstones',true);
END $body$;
REVOKE ALL ON FUNCTION public.davylab_ts_v1_sync_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.davylab_ts_v1_sync_capabilities() TO authenticated;

CREATE OR REPLACE FUNCTION public.davylab_ts_v1_delete(
 p_type text,p_id text,p_expected_revision integer
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
 caller text;
 previous_revision integer;
 previous_deleted timestamptz;
 stamp timestamptz;
BEGIN
 IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL
 OR NOT public.davylab_ts_v1_is_allowed() THEN
  RAISE EXCEPTION 'DAVYLAB_OWNER_NOT_ALLOWED' USING ERRCODE='42501';
 END IF;
 caller:=auth.uid();
 IF p_type IS NULL OR p_id IS NULL OR length(p_id) NOT BETWEEN 1 AND 512
 OR p_expected_revision IS NULL OR p_expected_revision<1
 OR NOT (p_type IN ('topic','published_record')
    OR (p_type='research' AND p_id LIKE 'brief:%')
    OR (p_type='growth' AND p_id ~ '^(experiments|posters|metrics|reviews):.+$')) THEN
  RAISE EXCEPTION 'DAVYLAB_INVALID_DELETE_DOCUMENT' USING ERRCODE='22023';
 END IF;
 SELECT revision,deleted_at INTO previous_revision,previous_deleted
 FROM public.davylab_ts_v1_documents
 WHERE owner_uid=caller AND doc_type=p_type AND doc_id=p_id FOR UPDATE;
 IF NOT FOUND OR previous_revision<>p_expected_revision THEN
  RAISE EXCEPTION 'DAVYLAB_REVISION_CONFLICT' USING ERRCODE='40001';
 END IF;
 IF previous_deleted IS NOT NULL THEN
  RETURN jsonb_build_object('doc_type',p_type,'doc_id',p_id,'revision',previous_revision,'deleted_at',previous_deleted);
 END IF;
 stamp:=clock_timestamp();
 -- Keep prior payload for conflict diagnosis / private recovery; never physically delete.
 UPDATE public.davylab_ts_v1_documents
 SET deleted_at=stamp,updated_at=stamp,revision=previous_revision+1
 WHERE owner_uid=caller AND doc_type=p_type AND doc_id=p_id AND revision=previous_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'DAVYLAB_REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('doc_type',p_type,'doc_id',p_id,'revision',previous_revision+1,'deleted_at',stamp);
END $body$;
REVOKE ALL ON FUNCTION public.davylab_ts_v1_delete(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.davylab_ts_v1_delete(text,text,integer) TO authenticated;
COMMIT;
-- Keep production activation disabled until genuine authenticated, cross-account,
-- stale-revision, tombstone and Windows/iPhone tests pass. No owner UID in source.
