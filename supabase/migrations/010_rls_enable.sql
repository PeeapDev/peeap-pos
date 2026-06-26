-- 010_rls_enable.sql
--
-- Lock down the POS database at the row level.
--
-- Context: the app connects to this Supabase project EXCLUSIVELY with the
-- service-role key (see src/lib/supabase.ts and the storefront server
-- components in src/app/**). The service_role bypasses RLS, so enabling RLS
-- with NO policies does not affect any application code path.
--
-- What it DOES fix: NEXT_PUBLIC_SUPABASE_ANON_KEY is inlined into the
-- client bundle (it has the NEXT_PUBLIC_ prefix). With RLS disabled, anyone
-- who reads that key out of the bundle can use their own supabase-js client
-- to SELECT/INSERT/UPDATE/DELETE every table — full tenant compromise.
-- Enabling RLS with no anon/authenticated policies makes that key inert:
-- the anon and authenticated roles can no longer see or write any row.
--
-- This is the Supabase-recommended secure-by-default posture. If a future
-- feature needs direct client (anon) reads, add a narrow SELECT policy for
-- exactly that table/columns — do not disable RLS.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
      FROM pg_tables
     WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END
$$;

-- Sanity: report any public table still without RLS (should return none).
-- SELECT tablename FROM pg_tables t
--   WHERE schemaname='public'
--     AND NOT EXISTS (
--       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
--        WHERE n.nspname='public' AND c.relname=t.tablename AND c.relrowsecurity
--     );
