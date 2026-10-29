-- ============================================================
-- 020: RLS 정리 (Supabase 보안 경고 rls_disabled_in_public · sensitive_columns_exposed 대응)
--
-- 원칙
--   - public 스키마의 모든 테이블에 RLS를 켠다.
--   - 사이트(anon)는 장소·태그·리뷰 읽기와 로그·리뷰 기록만 한다.
--   - 쓰기와 운영 데이터 읽기는 private.admin_users에 있는 로그인 계정(admin)만 한다.
--   - jmw-auto-engine · odiga-api · admin 코스 빌더는 service role이라 RLS 영향이 없다.
--   - 데이터는 지우지 않는다. 바꾸기 전 RLS 상태와 정책을 private.rls_backup_020에 남겨
--     rollback/020_rls_hardening_down.sql로 되돌릴 수 있다.
--
-- 적용 전 확인: select id, email, created_at from auth.users;
--   여기 있는 계정이 모두 admin이 된다. 모르는 계정이 있으면 먼저 지운다.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 0. 되돌리기용 스냅샷 (처음 적용할 때만 저장)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.rls_backup_020 (
  table_name text PRIMARY KEY,
  rls_on     boolean NOT NULL,
  policies   jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.rls_backup_020 (table_name, rls_on, policies)
SELECT c.relname,
       c.relrowsecurity,
       coalesce((
         SELECT jsonb_agg(jsonb_build_object(
                  'name', p.policyname, 'permissive', p.permissive, 'cmd', p.cmd,
                  'roles', p.roles, 'qual', p.qual, 'with_check', p.with_check))
         FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname
       ), '[]'::jsonb)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ON CONFLICT (table_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 1. admin 판별
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.admin_users (
  user_id  uuid PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- 지금 있는 계정을 admin으로 등록한다. 이후 가입한 계정은 자동으로 admin이 되지 않는다.
INSERT INTO private.admin_users (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.admin_users WHERE user_id = (SELECT auth.uid()))
$$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. 테이블별 정책
--    public_read : 누구나 읽기 + admin 쓰기
--    admin_only  : admin만 읽기·쓰기 (anon은 아무것도 못 함)
--    service_only: 정책 없음 (service role만)
--    018/019 큐레이션 테이블과 user_place_states는 그대로 둔다.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  public_read  text[] := ARRAY['locations', 'attractions', 'tags', 'location_tags', 'attraction_tags',
                               'location_stats', 'location_images', 'regions', 'categories', 'reviews'];
  admin_only   text[] := ARRAY['generated_drafts', 'place_candidates', 'raw_sns_posts', 'daily_trend_reports',
                               'daily_checklist', 'weekly_checklist', 'odiga_saved_courses', 'odiga_search_logs',
                               'search_logs', 'click_logs'];
  service_only text[] := ARRAY['agent_tasks', 'task_approvals', 'execution_logs'];
  t   text;
  pol record;
BEGIN
  FOREACH t IN ARRAY public_read || admin_only || service_only LOOP
    CONTINUE WHEN to_regclass(format('public.%I', t)) IS NULL;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- 기존 정책(USING true 쓰기 포함)은 백업에 남기고 지운다
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    CONTINUE WHEN t = ANY (service_only);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      t || '_admin_all', t);
    IF t = ANY (public_read) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
                     t || '_public_read', t);
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. 사이트가 anon으로 남기는 기록
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.reviews') IS NOT NULL THEN
    CREATE POLICY reviews_anon_insert ON public.reviews FOR INSERT TO anon, authenticated
      WITH CHECK (location_id IS NOT NULL AND char_length(one_liner) BETWEEN 1 AND 500);
  END IF;

  IF to_regclass('public.click_logs') IS NOT NULL THEN
    CREATE POLICY click_logs_anon_insert ON public.click_logs FOR INSERT TO anon, authenticated
      WITH CHECK (location_id IS NOT NULL);
  END IF;

  IF to_regclass('public.search_logs') IS NOT NULL THEN
    -- 검색 직후 id를 받고(INSERT ... RETURNING id), 같은 세션에서 클릭·지도 열기를 덧붙인다.
    -- 그래서 anon은 최근 1시간 행만 보고 고칠 수 있고, 고칠 수 있는 칸도 클릭 정보로 한정한다.
    -- LLM 해석 결과(parsed)는 서버(service role)만 쓴다.
    CREATE POLICY search_logs_anon_insert ON public.search_logs FOR INSERT TO anon, authenticated
      WITH CHECK (parsed IS NULL AND char_length(query) <= 500);
    CREATE POLICY search_logs_anon_recent_read ON public.search_logs FOR SELECT TO anon
      USING (created_at > now() - interval '1 hour');
    CREATE POLICY search_logs_anon_recent_update ON public.search_logs FOR UPDATE TO anon
      USING (created_at > now() - interval '1 hour')
      WITH CHECK (created_at > now() - interval '1 hour');
  END IF;
END $$;

DO $$
DECLARE
  col text;
BEGIN
  IF to_regclass('public.search_logs') IS NULL THEN RETURN; END IF;
  REVOKE UPDATE ON public.search_logs FROM anon;
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'search_logs'
      AND column_name IN ('clicked_place_id', 'clicked_rank', 'opened_map', 'map_provider')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.search_logs TO anon', col);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. 뷰는 호출한 사람 권한으로, 함수는 search_path 고정
-- ────────────────────────────────────────────────────────────
ALTER VIEW IF EXISTS public.locations_search SET (security_invoker = on);
ALTER VIEW IF EXISTS public.attractions_search SET (security_invoker = on);

DO $$
BEGIN
  IF to_regprocedure('public.touch_location_activity(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.touch_location_activity(uuid) SET search_path = public;
  END IF;
END $$;
