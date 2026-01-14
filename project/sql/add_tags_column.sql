-- locations 테이블에 tags 컬럼 추가
-- Supabase SQL 에디터에서 실행하세요

-- 1. tags 컬럼 추가 (TEXT 배열 타입, nullable)
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 2. tags 컬럼에 대한 코멘트 추가 (선택사항)
COMMENT ON COLUMN locations.tags IS 'LLM 추천 태그 배열: 예) [''혼밥'', ''조용한 분위기'']';

-- 3. tags 인덱스 추가 (성능 최적화 - GIN 인덱스는 배열 검색에 최적화됨)
CREATE INDEX IF NOT EXISTS idx_locations_tags ON locations USING GIN (tags);

-- 4. 기존 데이터 확인 (선택사항)
-- tags가 NULL인 경우 빈 배열로 설정하려면 아래 쿼리 실행
UPDATE locations
SET tags = '{}'
WHERE tags IS NULL;

-- 5. 결과 확인 (선택사항)
-- SELECT 
--   id,
--   name,
--   tags,
--   array_length(tags, 1) as tag_count
-- FROM locations
-- WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
-- LIMIT 10;
