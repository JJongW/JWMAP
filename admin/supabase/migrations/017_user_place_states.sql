-- ============================================================
-- 017: user_place_states
--
-- Anonymous-session based place state for JWMAP.
-- Stores "want to go" and "visited" states outside localStorage
-- while still allowing the client to use localStorage as a cache.
-- ============================================================

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
CREATE INDEX IF NOT EXISTS idx_user_place_states_saved
  ON user_place_states(is_saved)
  WHERE is_saved = true;
CREATE INDEX IF NOT EXISTS idx_user_place_states_visited
  ON user_place_states(is_visited)
  WHERE is_visited = true;

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

