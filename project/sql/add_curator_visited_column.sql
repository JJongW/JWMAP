-- locations 테이블에 curator_visited 컬럼 추가
-- 주인장이 직접 다녀온 장소인지 구분 (true: 다녀옴, false: 미방문)
-- Supabase SQL 에디터에서 실행하세요

-- 1. curator_visited 컬럼 추가 (BOOLEAN, 기본값 true - 기존 데이터 호환)
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS curator_visited BOOLEAN DEFAULT true;

-- 2. 컬럼 코멘트
COMMENT ON COLUMN locations.curator_visited IS '주인장이 직접 다녀온 장소인지. false면 큐레이터 직접 방문 배지 미표시';

-- 3. 기존 NULL 처리 (혹시 있다면 true로)
UPDATE locations
SET curator_visited = true
WHERE curator_visited IS NULL;
