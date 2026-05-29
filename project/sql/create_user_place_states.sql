-- Supabase SQL Editor에서 실행하세요.
-- JWMAP 가보고 싶음/다녀왔어요 상태를 익명 session_id 기준으로 저장합니다.

CREATE TABLE IF NOT EXISTS user_place_states (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NOT NULL,
  location_id  uuid NOT NULL,
  content_type text NOT NULL DEFAULT 'food'
                 CHECK (content_type IN ('food', 'space')),
  is_saved     boolean NOT NULL DEFAULT false,
  is_visited   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_place_states_unique UNIQUE (session_id, location_id, content_type)
);

CREATE INDEX IF NOT EXISTS idx_user_place_states_session_id
  ON user_place_states(session_id);
CREATE INDEX IF NOT EXISTS idx_user_place_states_location_id
  ON user_place_states(location_id);

ALTER TABLE user_place_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_place_states_insert ON user_place_states;
CREATE POLICY user_place_states_insert
  ON user_place_states FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS user_place_states_update ON user_place_states;
CREATE POLICY user_place_states_update
  ON user_place_states FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_place_states_select_own_session ON user_place_states;
CREATE POLICY user_place_states_select_own_session
  ON user_place_states FOR SELECT
  TO anon, authenticated
  USING (true);
