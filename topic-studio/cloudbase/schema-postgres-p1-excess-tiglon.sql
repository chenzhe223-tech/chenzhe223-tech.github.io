-- DAVYLAB Content Studio · P1 additive CloudBase PG schema
-- TARGET ENVIRONMENT ONLY: excess-tiglon-d6gjc77qr6fa193f2 (ap-shanghai)
-- REVIEW-ONLY. NOT executed on the user's CloudBase.
-- Creates only public.davylab_ts_v1_* objects; existing cron_locks,
-- dashboard_metrics and mail_board_snapshots MUST remain untouched.
-- CloudBase PG auth.uid() returns TEXT. Do not cast to UUID.
--
-- DEPLOY GATES: authenticated test identity; owner allowlist inserted
-- manually in SQL console; anon/cross-account denial; concurrent CAS test.
-- PostgREST RPC permissions may NOT honor EXECUTE grants at gateway:
-- *every SECURITY DEFINER function enforces role + UID in its body*.
BEGIN;

DO $precheck$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL OR
     to_regprocedure('auth.role()') IS NULL OR
     to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'DAVYLAB_PG_AUTH_HELPERS_MISSING: wrong auth mode; stop migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'DAVYLAB_AUTH_ROLE_MISSING: stop migration';
  END IF;
END
$precheck$;

CREATE TABLE IF NOT EXISTS public.davylab_ts_v1_allowed_owners (
  owner_uid varchar(128) PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Console-only. DO NOT INSERT OWNER ID IN GIT OR THE PUBLIC PAGE.
REVOKE ALL ON TABLE public.davylab_ts_v1_allowed_owners FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.davylab_ts_v1_documents (
  owner_uid varchar(128) NOT NULL DEFAULT auth.uid(),
  doc_type text NOT NULL CHECK (doc_type IN ('topic','research','growth','settings','published_record')),
  doc_id varchar(512) NOT NULL CHECK (length(doc_id)>0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_uid, doc_type, doc_id)
);
CREATE INDEX IF NOT EXISTS davylab_ts_v1_updated_idx
 ON public.davylab_ts_v1_documents (owner_uid, updated_at DESC, doc_type);
ALTER TABLE public.davylab_ts_v1_documents ENABLE ROW LEVEL SECURITY;

-- Direct access: READ ONLY, owner-scoped. All writes use CAS RPC below.
-- There are intentionally no UPDATE/INSERT/DELETE grants for web clients.
REVOKE ALL ON TABLE public.davylab_ts_v1_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.davylab_ts_v1_documents TO authenticated;

-- SECURITY DEFINER is required only to check a private allowlist.
-- WARNING: CloudBase RPC may route calls regardless of EXECUTE grants.
CREATE OR REPLACE FUNCTION public.davylab_ts_v1_is_allowed()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  caller text := auth.uid();
  jwt_role text := auth.role();
BEGIN
  IF jwt_role IS DISTINCT FROM 'authenticated' OR caller IS NULL OR caller = ''
     OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.davylab_ts_v1_allowed_owners WHERE owner_uid = caller
  );
END
$body$;
REVOKE ALL ON FUNCTION public.davylab_ts_v1_is_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.davylab_ts_v1_is_allowed() TO authenticated;

-- Default deny non-allowlisted identities and any cross-account attempt.
DO $policy$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='davylab_ts_v1_documents' AND policyname='davylab_ts_v1_owner_read') THEN
    CREATE POLICY davylab_ts_v1_owner_read
      ON public.davylab_ts_v1_documents
      FOR SELECT TO authenticated
      USING (owner_uid = (SELECT auth.uid()) AND (SELECT public.davylab_ts_v1_is_allowed()));
  END IF;
END
$policy$;

-- Atomic compare-and-swap:
--   p_expected_revision = 0 : create a new record, no overwrite;
--   p_expected_revision = N : update only if server revision is N;
--   null, stale, unknown ID or wrong owner: fail closed.
-- Backend row lock ensures concurrent requests are serialized.
CREATE OR REPLACE FUNCTION public.davylab_ts_v1_put(
  p_type text, p_id text, p_payload jsonb, p_expected_revision integer
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $body$
DECLARE
  caller text;
  previous_revision integer;
  next_revision integer;
BEGIN
  -- EXPLICIT GATE: SECURITY DEFINER bypasses owner table RLS. Never rely
  -- on GRANT EXECUTE alone for a CloudBase RPC endpoint.
  IF auth.role() IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS NULL
     OR coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'DAVYLAB_AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.davylab_ts_v1_is_allowed() THEN
    RAISE EXCEPTION 'DAVYLAB_OWNER_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  caller := auth.uid();
  IF p_type IS NULL OR p_type NOT IN ('topic','research','growth','settings','published_record')
     OR p_id IS NULL OR length(p_id) NOT BETWEEN 1 AND 512
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 256000
     OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'DAVYLAB_INVALID_SYNC_DOCUMENT' USING ERRCODE = '22023';
  END IF;

  -- Do not synthesize an owner's ID from browser input.
  SELECT d.revision INTO previous_revision
  FROM public.davylab_ts_v1_documents AS d
  WHERE d.owner_uid=caller AND d.doc_type=p_type AND d.doc_id=p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_revision <> 0 THEN
      RAISE EXCEPTION 'DAVYLAB_REVISION_CONFLICT' USING ERRCODE = '40001';
    END IF;
    -- Concurrent create with same PK raises UNIQUE_VIOLATION; caller MUST
    -- reload remote record and surface a conflict, never overwrite.
    INSERT INTO public.davylab_ts_v1_documents
       (owner_uid, doc_type, doc_id, payload, revision)
    VALUES (caller, p_type, p_id, p_payload, 1);
    RETURN jsonb_build_object('doc_type',p_type,'doc_id',p_id,'revision',1,'inserted',true);
  END IF;

  IF previous_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'DAVYLAB_REVISION_CONFLICT' USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.davylab_ts_v1_documents
    WHERE owner_uid=caller AND doc_type=p_type AND doc_id=p_id
      AND deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'DAVYLAB_TOMBSTONE_REQUIRES_REVIEW' USING ERRCODE='40001';
  END IF;

  -- Even if request is retried with identical content, do not waste revision.
  IF EXISTS (
    SELECT 1 FROM public.davylab_ts_v1_documents
    WHERE owner_uid=caller AND doc_type=p_type AND doc_id=p_id
      AND payload=p_payload
  ) THEN
    RETURN jsonb_build_object('doc_type',p_type,'doc_id',p_id,
                              'revision',previous_revision,'unchanged',true);
  END IF;

  next_revision := previous_revision + 1;
  UPDATE public.davylab_ts_v1_documents AS d
    SET payload=p_payload,revision=next_revision,updated_at=now()
    WHERE d.owner_uid=caller AND d.doc_type=p_type AND d.doc_id=p_id
      AND d.revision=previous_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DAVYLAB_REVISION_CONFLICT' USING ERRCODE='40001';
  END IF;
  RETURN jsonb_build_object('doc_type',p_type,'doc_id',p_id,'revision',next_revision,'inserted',false);
END
$body$;

REVOKE ALL ON FUNCTION public.davylab_ts_v1_put(text,text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.davylab_ts_v1_put(text,text,jsonb,integer) TO authenticated;

COMMIT;

-- MANUAL ACTIVATION IN TARGET CLOUD CONSOLE ONLY:
-- 1. Create/login owner via CloudBase Authentication.
-- 2. Privately inspect the AUTHENTICATED user ID (not Tencent UIN/APPID).
-- 3. Insert ONLY that UID into public.davylab_ts_v1_allowed_owners.
-- 4. Test anon/other-owner denial before importing real content.
-- 5. Do not grant direct table INSERT/UPDATE/DELETE to authenticated.
