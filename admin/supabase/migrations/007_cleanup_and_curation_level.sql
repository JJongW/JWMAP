-- 007: locations 테이블 정리 + curation_level 추가
-- locations_search view가 삭제 대상 컬럼을 참조하므로 DROP → 재생성

-- 1. 기존 view 삭제
DROP VIEW IF EXISTS locations_search;

-- 2. 사용하지 않는 컬럼 삭제
ALTER TABLE locations DROP COLUMN IF EXISTS trust_score;
ALTER TABLE locations DROP COLUMN IF EXISTS last_verified_at;
ALTER TABLE locations DROP COLUMN IF EXISTS last_activity_at;

-- 3. curation_level 추가
ALTER TABLE locations ADD COLUMN IF NOT EXISTS curation_level smallint;

-- 4. view 재생성 (삭제된 컬럼 제외, curation_level 추가)
CREATE VIEW locations_search AS
SELECT
    l.id,
    l.name,
    l.region,
    l.lon,
    l.lat,
    l.memo,
    l.address,
    l.rating,
    l."imageUrl",
    l.created_at,
    l.event_tags,
    l.sub_region,
    l.short_desc,
    l.visit_date,
    l.price_level,
    l.naver_place_id,
    l.kakao_place_id,
    l.features,
    l.province,
    l.tags,
    l.category_main,
    l.category_sub,
    l.curator_visited,
    l.curation_level,
    ls.popularity_score
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id;
