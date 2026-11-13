-- DAVYLAB Topic Studio · CloudBase PostgreSQL schema (NOT executed).
-- Deploy ONLY if the chosen CloudBase environment is confirmed PostgreSQL.
-- Existing topic drafts remain local until the owner manually authorizes migration.
-- Tencent CloudBase PG: auth.uid() RETURNS text, not UUID.
BEGIN;
CREATE TABLE IF NOT EXISTS public.davylab_editorial_docs (
  doc_id TEXT NOT NULL,
  user_id VARCHAR(64) NOT NULL DEFAULT auth.uid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('topic', 'research', 'growth', 'settings', 'published_record')),
  payload JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doc_type, doc_id)
);
CREATE INDEX IF NOT EXISTS idx_davylab_docs_owner_updated
  ON public.davylab_editorial_docs (user_id, updated_at DESC);
ALTER TABLE public.davylab_editorial_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.davylab_editorial_docs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.davylab_editorial_docs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.davylab_editorial_docs TO authenticated;
DROP POLICY IF EXISTS davylab_docs_select_own ON public.davylab_editorial_docs;
DROP POLICY IF EXISTS davylab_docs_insert_own ON public.davylab_editorial_docs;
DROP POLICY IF EXISTS davylab_docs_update_own ON public.davylab_editorial_docs;
DROP POLICY IF EXISTS davylab_docs_delete_own ON public.davylab_editorial_docs;
CREATE POLICY davylab_docs_select_own ON public.davylab_editorial_docs
 FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY davylab_docs_insert_own ON public.davylab_editorial_docs
 FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY davylab_docs_update_own ON public.davylab_editorial_docs
 FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid()))
 WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY davylab_docs_delete_own ON public.davylab_editorial_docs
 FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.davylab_editorial_enforce_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.revision <> OLD.revision + 1 THEN
      RAISE EXCEPTION 'DAVYLAB_CONFLICT: expected next revision %', OLD.revision+1;
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_davylab_editorial_revision ON public.davylab_editorial_docs;
CREATE TRIGGER trg_davylab_editorial_revision
 BEFORE UPDATE ON public.davylab_editorial_docs
 FOR EACH ROW EXECUTE FUNCTION public.davylab_editorial_enforce_revision();
COMMIT;
-- REQUIRED PRE-PRODUCTION QA: (1) logged-out read denied, (2) other owner denied,
-- (3) owner permitted, (4) stale revision denied, (5) local snapshot unchanged.
