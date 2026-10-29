-- ============================================================
-- 024: 방문자 저장·방문 체크(user_place_states)를 자기 세션 것만
--
-- 지금은 정책이 USING (true)라 공개 키로 남의 저장 목록을 읽고 바꿀 수 있다 (보안 경고).
-- 사이트가 요청마다 x-oomap-session 헤더로 세션 ID를 보내므로(project/src/utils/session.ts)
-- 그 헤더와 같은 session_id 행만 읽고·넣고·고칠 수 있게 한다. 삭제는 하지 않는다.
--
-- 순서: 헤더를 보내는 사이트가 먼저 배포된 뒤에 적용한다 (그 전 버전은 저장 목록이 비어 보인다).
-- 되돌리기: admin/supabase/rollback/024_user_place_states_session_rls_down.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_session_id() RETURNS text
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT nullif(current_setting('request.headers', true)::json->>'x-oomap-session', '')
$$;

DROP POLICY IF EXISTS user_place_states_insert ON user_place_states;
DROP POLICY IF EXISTS user_place_states_select_own_session ON user_place_states;
DROP POLICY IF EXISTS user_place_states_update ON user_place_states;

CREATE POLICY user_place_states_insert ON user_place_states FOR INSERT TO anon, authenticated
  WITH CHECK (session_id = (SELECT public.request_session_id()));
CREATE POLICY user_place_states_select_own_session ON user_place_states FOR SELECT TO anon, authenticated
  USING (session_id = (SELECT public.request_session_id()));
CREATE POLICY user_place_states_update ON user_place_states FOR UPDATE TO anon, authenticated
  USING (session_id = (SELECT public.request_session_id()))
  WITH CHECK (session_id = (SELECT public.request_session_id()));
