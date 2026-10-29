-- 024 되돌리기: 예전 정책(누구나)으로 돌린다. 보안 경고가 다시 생긴다.
DROP POLICY IF EXISTS user_place_states_insert ON user_place_states;
DROP POLICY IF EXISTS user_place_states_select_own_session ON user_place_states;
DROP POLICY IF EXISTS user_place_states_update ON user_place_states;
CREATE POLICY user_place_states_insert ON user_place_states FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY user_place_states_select_own_session ON user_place_states FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY user_place_states_update ON user_place_states FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP FUNCTION IF EXISTS public.request_session_id();
