-- 개발용: 2026-10-29 운영 DB의 RLS 상태(pg_policies 결과와 anon 읽기 확인)를 PGlite에 재현한다.
-- base_schema.sql 다음에 실행한다. 운영 DB에는 실행하지 않는다.

-- Supabase auth 흉내: auth.uid()는 요청 JWT의 sub를 읽는다
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- Supabase 기본값처럼 테이블 권한은 모두 주고, 막는 건 RLS가 한다
GRANT USAGE ON SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE location_stats (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  popularity_score numeric DEFAULT 0,
  last_activity_at timestamptz
);
CREATE VIEW locations_search AS
  SELECT l.*, ls.popularity_score FROM locations l LEFT JOIN location_stats ls ON l.id = ls.location_id;
CREATE VIEW attractions_search AS SELECT a.* FROM attractions a;

CREATE FUNCTION touch_location_activity(p_location_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO location_stats (location_id, popularity_score, last_activity_at)
  VALUES (p_location_id, 0, now())
  ON CONFLICT (location_id) DO UPDATE SET last_activity_at = now();
END $$;
GRANT EXECUTE ON FUNCTION touch_location_activity(uuid) TO anon, authenticated;

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_display_name text,
  one_liner text NOT NULL DEFAULT '',
  visit_type text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE TABLE search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  query text NOT NULL DEFAULT '',
  parsed jsonb,
  result_count integer DEFAULT 0,
  llm_ms integer DEFAULT 0,
  db_ms integer DEFAULT 0,
  total_ms integer DEFAULT 0,
  clicked_place_id uuid,
  clicked_rank integer,
  opened_map boolean DEFAULT false,
  map_provider text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE click_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  search_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE user_place_states (
  session_id text NOT NULL,
  location_id uuid NOT NULL,
  content_type text NOT NULL,
  is_saved boolean DEFAULT false,
  is_visited boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, location_id, content_type)
);
CREATE TABLE generated_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), caption text, status text DEFAULT 'draft');
CREATE TABLE place_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, status text DEFAULT 'pending');
CREATE TABLE raw_sns_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), body text);
CREATE TABLE daily_trend_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), summary text);
CREATE TABLE daily_checklist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_type text, date date, done boolean DEFAULT false);
CREATE TABLE weekly_checklist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_type text, week_start date, completed boolean DEFAULT false);
CREATE TABLE odiga_saved_courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course jsonb);
CREATE TABLE odiga_search_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raw_query text);
CREATE TABLE agent_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requested_by text);
CREATE TABLE task_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), approved_by text);
CREATE TABLE execution_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), output text);

-- 운영과 같은 정책 (RLS 켜진 테이블)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attractions', 'attraction_tags', 'daily_trend_reports', 'generated_drafts',
                           'place_candidates', 'raw_sns_posts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)', t || '_select_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t || '_insert_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t || '_update_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true)', t || '_delete_all', t);
  END LOOP;
END $$;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can create reviews" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
ALTER TABLE user_place_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_place_states_insert ON user_place_states FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY user_place_states_select_own_session ON user_place_states FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY user_place_states_update ON user_place_states FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 정책은 있지만 RLS가 꺼져 있어 anon이 읽히는 테이블
CREATE POLICY admin_read ON odiga_saved_courses FOR SELECT TO authenticated USING (true);
CREATE POLICY admin_read ON odiga_search_logs FOR SELECT TO authenticated USING (true);
-- locations, tags, location_tags, location_stats, search_logs, click_logs, daily_checklist, weekly_checklist,
-- agent_tasks, task_approvals, execution_logs: RLS 꺼짐 (운영에서 anon으로 읽힘)
