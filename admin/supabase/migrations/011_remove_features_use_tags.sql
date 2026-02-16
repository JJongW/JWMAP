-- 011: feature JSONB 제거, tag 중심 스키마로 전환
-- 목표:
-- 1) locations/attractions/reviews 의 features 데이터를 tags(text[])로 안전 이관
-- 2) features 컬럼 제거
-- 3) 검색 뷰(locations_search, attractions_search)를 features 없는 형태로 재생성

-- 0) reviews.tags 컬럼 준비
ALTER TABLE IF EXISTS reviews
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 1) locations: features -> tags 백필 (features 컬럼이 있을 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'features'
  ) THEN
    UPDATE locations l
    SET tags = COALESCE((
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM UNNEST(
        COALESCE(l.tags, '{}'::text[]) ||
        ARRAY[
          CASE WHEN l.features ? 'solo_ok' AND l.features->>'solo_ok' = 'true' THEN '혼밥' END,
          CASE WHEN l.features ? 'quiet' AND l.features->>'quiet' = 'true' THEN '조용한 분위기' END,
          CASE WHEN l.features ? 'wait_short' AND l.features->>'wait_short' = 'true' THEN '웨이팅 적음' END,
          CASE WHEN l.features ? 'date_ok' AND l.features->>'date_ok' = 'true' THEN '데이트' END,
          CASE WHEN l.features ? 'group_ok' AND l.features->>'group_ok' = 'true' THEN '모임' END,
          CASE WHEN l.features ? 'parking' AND l.features->>'parking' = 'true' THEN '주차 가능' END,
          CASE WHEN l.features ? 'pet_friendly' AND l.features->>'pet_friendly' = 'true' THEN '반려동물 동반' END,
          CASE WHEN l.features ? 'reservation' AND l.features->>'reservation' = 'true' THEN '예약 가능' END,
          CASE WHEN l.features ? 'late_night' AND l.features->>'late_night' = 'true' THEN '심야 영업' END
        ]::text[]
      ) AS u(tag)
      WHERE tag IS NOT NULL AND btrim(tag) <> ''
    ), '{}'::text[])
    WHERE l.features IS NOT NULL;
  END IF;
END
$$;

-- 2) attractions: features -> tags 백필 (테이블/컬럼 존재 시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attractions' AND column_name = 'features'
  ) THEN
    UPDATE attractions a
    SET tags = COALESCE((
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM UNNEST(
        COALESCE(a.tags, '{}'::text[]) ||
        ARRAY[
          CASE WHEN a.features ? 'solo_ok' AND a.features->>'solo_ok' = 'true' THEN '혼밥' END,
          CASE WHEN a.features ? 'quiet' AND a.features->>'quiet' = 'true' THEN '조용한 분위기' END,
          CASE WHEN a.features ? 'wait_short' AND a.features->>'wait_short' = 'true' THEN '웨이팅 적음' END,
          CASE WHEN a.features ? 'date_ok' AND a.features->>'date_ok' = 'true' THEN '데이트' END,
          CASE WHEN a.features ? 'group_ok' AND a.features->>'group_ok' = 'true' THEN '모임' END,
          CASE WHEN a.features ? 'parking' AND a.features->>'parking' = 'true' THEN '주차 가능' END,
          CASE WHEN a.features ? 'pet_friendly' AND a.features->>'pet_friendly' = 'true' THEN '반려동물 동반' END,
          CASE WHEN a.features ? 'reservation' AND a.features->>'reservation' = 'true' THEN '예약 가능' END,
          CASE WHEN a.features ? 'late_night' AND a.features->>'late_night' = 'true' THEN '심야 영업' END
        ]::text[]
      ) AS u(tag)
      WHERE tag IS NOT NULL AND btrim(tag) <> ''
    ), '{}'::text[])
    WHERE a.features IS NOT NULL;
  END IF;
END
$$;

-- 3) reviews: features -> tags 백필 (테이블/컬럼 존재 시)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'features'
  ) THEN
    UPDATE reviews r
    SET tags = COALESCE((
      SELECT ARRAY_AGG(DISTINCT tag)
      FROM UNNEST(
        COALESCE(r.tags, '{}'::text[]) ||
        ARRAY[
          CASE WHEN r.features ? 'solo_ok' AND r.features->>'solo_ok' = 'true' THEN '혼밥' END,
          CASE WHEN r.features ? 'quiet' AND r.features->>'quiet' = 'true' THEN '조용한 분위기' END,
          CASE WHEN r.features ? 'wait_short' AND r.features->>'wait_short' = 'true' THEN '웨이팅 적음' END,
          CASE WHEN r.features ? 'date_ok' AND r.features->>'date_ok' = 'true' THEN '데이트' END,
          CASE WHEN r.features ? 'group_ok' AND r.features->>'group_ok' = 'true' THEN '모임' END,
          CASE WHEN r.features ? 'parking' AND r.features->>'parking' = 'true' THEN '주차 가능' END,
          CASE WHEN r.features ? 'pet_friendly' AND r.features->>'pet_friendly' = 'true' THEN '반려동물 동반' END,
          CASE WHEN r.features ? 'reservation' AND r.features->>'reservation' = 'true' THEN '예약 가능' END,
          CASE WHEN r.features ? 'late_night' AND r.features->>'late_night' = 'true' THEN '심야 영업' END
        ]::text[]
      ) AS u(tag)
      WHERE tag IS NOT NULL AND btrim(tag) <> ''
    ), '{}'::text[])
    WHERE r.features IS NOT NULL;
  END IF;
END
$$;

-- 4) tags 인덱스 보강 (테이블 존재 시)
CREATE INDEX IF NOT EXISTS idx_locations_tags ON locations USING GIN (tags);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'attractions' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attractions_tags ON attractions USING GIN (tags)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reviews' AND relkind = 'r') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_tags ON reviews USING GIN (tags)';
  END IF;
END
$$;

-- 5) 컬럼 드롭 전 의존 뷰 제거
DROP VIEW IF EXISTS locations_search;
DROP VIEW IF EXISTS attractions_search;

-- 6) features 컬럼 제거
ALTER TABLE IF EXISTS locations DROP COLUMN IF EXISTS features;
ALTER TABLE IF EXISTS attractions DROP COLUMN IF EXISTS features;
ALTER TABLE IF EXISTS reviews DROP COLUMN IF EXISTS features;

-- 7) 검색 뷰 재생성 (features 제거 후)
CREATE TABLE IF NOT EXISTS location_stats (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  popularity_score numeric DEFAULT 0,
  last_activity_at timestamptz
);

CREATE OR REPLACE VIEW locations_search AS
SELECT
  l.*,
  ls.popularity_score
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'attractions' AND relkind = 'r') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW attractions_search AS
      SELECT
        a.*,
        NULL::double precision AS trust_score,
        NULL::double precision AS popularity_score
      FROM attractions a
    $v$;
  END IF;
END
$$;

-- 8) 코멘트
COMMENT ON COLUMN locations.tags IS '검색/추천용 태그 배열';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attractions' AND column_name = 'tags'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN attractions.tags IS ''검색/추천용 태그 배열''';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'tags'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN reviews.tags IS ''사용자 방문 태그 배열''';
  END IF;
END
$$;
