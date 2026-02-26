-- ============================================================
-- 015: search_logs · click_logs · touch_location_activity RPC
--
-- Project(Vite) 앱이 사용자 검색/클릭 이벤트를 기록하는 테이블.
-- touch_location_activity RPC: 장소 클릭/맵 열기 시 location_stats 갱신.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. search_logs: 사용자 검색 1회 = 1행
--    INSERT at submit → UPDATE on click/map-open
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query            text NOT NULL DEFAULT '',
  parsed           jsonb DEFAULT NULL,           -- raw LLM 응답 (백엔드 전용)
  result_count     integer DEFAULT 0,
  llm_ms           integer DEFAULT 0,
  db_ms            integer DEFAULT 0,
  total_ms         integer DEFAULT 0,
  clicked_place_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  clicked_rank     integer DEFAULT NULL,
  opened_map       boolean DEFAULT false,
  map_provider     text DEFAULT NULL
                     CHECK (map_provider IS NULL OR map_provider IN ('naver', 'kakao')),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at
  ON search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_clicked_place_id
  ON search_logs(clicked_place_id);

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_logs_insert ON search_logs;
CREATE POLICY search_logs_insert
  ON search_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS search_logs_update ON search_logs;
CREATE POLICY search_logs_update
  ON search_logs FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS search_logs_select ON search_logs;
CREATE POLICY search_logs_select
  ON search_logs FOR SELECT
  TO authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- 2. click_logs: 장소별 클릭 액션 기록
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS click_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  action_type text NOT NULL
                CHECK (action_type IN (
                  'view_detail', 'open_naver', 'open_kakao',
                  'marker_click', 'list_click', 'copy_address'
                )),
  search_id   uuid REFERENCES search_logs(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_logs_location_id
  ON click_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_created_at
  ON click_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_click_logs_search_id
  ON click_logs(search_id);

ALTER TABLE click_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS click_logs_insert ON click_logs;
CREATE POLICY click_logs_insert
  ON click_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS click_logs_select ON click_logs;
CREATE POLICY click_logs_select
  ON click_logs FOR SELECT
  TO authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- 3. touch_location_activity(p_location_id uuid)
--    장소 클릭/맵 열기 시 location_stats.last_activity_at 갱신
--    SECURITY DEFINER: anon도 호출 가능, 직접 테이블 쓰기 불필요
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_location_activity(p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO location_stats (location_id, popularity_score, last_activity_at)
  VALUES (p_location_id, 0, now())
  ON CONFLICT (location_id)
  DO UPDATE SET last_activity_at = now();
END;
$$;
