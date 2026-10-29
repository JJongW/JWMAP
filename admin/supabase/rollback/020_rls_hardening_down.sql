-- 020 되돌리기: private.rls_backup_020에 저장한 RLS 상태와 정책을 그대로 복원한다.
-- 복원하면 보안 경고도 다시 생긴다. 사이트가 깨졌을 때 임시로만 쓴다.
DO $$
DECLARE
  b   record;
  p   jsonb;
  pol record;
BEGIN
  FOR b IN SELECT * FROM private.rls_backup_020 LOOP
    CONTINUE WHEN to_regclass(format('public.%I', b.table_name)) IS NULL;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = b.table_name LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, b.table_name);
    END LOOP;
    FOR p IN SELECT * FROM jsonb_array_elements(b.policies) LOOP
      EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s',
        p->>'name', b.table_name, p->>'permissive', p->>'cmd',
        (SELECT string_agg(quote_ident(r), ', ') FROM jsonb_array_elements_text(p->'roles') r),
        CASE WHEN p->>'qual' IS NULL THEN '' ELSE format(' USING (%s)', p->>'qual') END,
        CASE WHEN p->>'with_check' IS NULL THEN '' ELSE format(' WITH CHECK (%s)', p->>'with_check') END);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I %s ROW LEVEL SECURITY', b.table_name,
                   CASE WHEN b.rls_on THEN 'ENABLE' ELSE 'DISABLE' END);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public.search_logs') IS NOT NULL THEN
    GRANT UPDATE ON public.search_logs TO anon;
  END IF;
END $$;

ALTER VIEW IF EXISTS public.locations_search RESET (security_invoker);
ALTER VIEW IF EXISTS public.attractions_search RESET (security_invoker);

DROP FUNCTION IF EXISTS private.is_admin();
DROP TABLE IF EXISTS private.admin_users;
-- private.rls_backup_020은 다시 적용할 때를 위해 남긴다.
