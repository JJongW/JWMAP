-- ============================================================
-- 016: reviews 테이블 명시적 생성
--
-- Project(Vite) 앱에서 사용자가 장소 리뷰를 작성하는 테이블.
-- Admin에서 리뷰 목록 조회·삭제 관리.
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id           uuid DEFAULT NULL,         -- 인증 사용자 (optional)
  user_display_name text NOT NULL DEFAULT '익명',
  one_liner         text NOT NULL DEFAULT '',
  visit_type        text NOT NULL DEFAULT 'first'
                      CHECK (visit_type IN ('first', 'repeat', 'regular')),
  tags              text[] DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_location_id
  ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_tags_gin
  ON reviews USING GIN (tags);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_insert ON reviews;
CREATE POLICY reviews_insert
  ON reviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS reviews_delete ON reviews;
CREATE POLICY reviews_delete
  ON reviews FOR DELETE
  TO authenticated
  USING (true);
