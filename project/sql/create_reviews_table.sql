-- reviews 테이블 생성
-- Supabase SQL 에디터에서 실행하세요

-- 1. reviews 테이블 생성
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID, -- 익명 리뷰 가능 (nullable)
  user_display_name TEXT, -- 표시 이름 (nullable, 기본값 '익명')
  one_liner TEXT NOT NULL, -- 한 줄 리뷰 (필수)
  visit_type TEXT NOT NULL DEFAULT 'first' CHECK (visit_type IN ('first', 'revisit')), -- 첫방문/재방문
  tags TEXT[] DEFAULT '{}', -- 선택한 방문 태그 (예: {'혼밥', '조용한 분위기'})
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id) WHERE user_id IS NOT NULL;

-- 3. RLS (Row Level Security) 정책 설정 (선택사항)
-- 익명 사용자도 리뷰를 읽고 작성할 수 있도록 설정
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 리뷰를 읽을 수 있음
CREATE POLICY "Anyone can read reviews"
  ON reviews
  FOR SELECT
  USING (true);

-- 모든 사용자가 리뷰를 작성할 수 있음
CREATE POLICY "Anyone can create reviews"
  ON reviews
  FOR INSERT
  WITH CHECK (true);

-- 4. 코멘트 추가 (선택사항)
COMMENT ON TABLE reviews IS '커뮤니티 리뷰 테이블';
COMMENT ON COLUMN reviews.location_id IS '장소 ID (locations 테이블 참조)';
COMMENT ON COLUMN reviews.user_id IS '사용자 ID (익명 리뷰 가능)';
COMMENT ON COLUMN reviews.user_display_name IS '표시 이름 (기본값: 익명)';
COMMENT ON COLUMN reviews.one_liner IS '한 줄 리뷰 (필수)';
COMMENT ON COLUMN reviews.visit_type IS '방문 유형: first(첫방문) 또는 revisit(재방문)';
COMMENT ON COLUMN reviews.tags IS '선택한 방문 태그 배열';
