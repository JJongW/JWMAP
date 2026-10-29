-- ============================================================
-- 023: 영업 상태 · 숨긴 장소를 사이트에서 빼기 · 수집 데이터 중복 방지
--
--   places.business_status   카카오 점검 결과 (open / closed / closed_suspect / moved / unknown)
--   locations_search·attractions_search
--       - 숨긴(hidden) 장소를 뺀다. 사이트는 이 뷰를 읽는다.
--         anon은 RLS 때문에 숨긴 장소의 places 행을 못 보므로 "places에 보이는 행만"으로 거른다.
--         그래서 먼저 places에 없는 예전 행을 채워 넣는다 (019 이후 예전 입력폼으로 들어온 곳).
--       - 사이트가 요청하는 content_type 칸을 locations_search에 더한다 (지금 400 오류의 원인)
--   external_reviews.external_id, place_photos.url  다시 수집해도 중복으로 쌓이지 않게
-- 장소·행을 지우지 않는다. 폐업 장소는 visit_status = hidden 으로 숨긴다.
-- 되돌리기: admin/supabase/rollback/023_business_status_and_hidden_down.sql
-- ============================================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS business_status text NOT NULL DEFAULT 'unknown'
  CHECK (business_status IN ('open', 'closed', 'closed_suspect', 'moved', 'unknown'));
ALTER TABLE places ADD COLUMN IF NOT EXISTS business_checked_at timestamptz;

ALTER TABLE external_reviews ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_external_reviews_source_id ON external_reviews(source, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_photos_url ON place_photos(url);

-- places에 없는 예전 행 채우기 (id 그대로). 예전 행을 다시 쓰지 않도록 이 동안 트리거를 끈다
ALTER TABLE places DISABLE TRIGGER trg_sync_place_to_legacy;
INSERT INTO places (id, legacy_table, name, address, lat, lon, province, region, sub_region, kakao_place_id,
                    naver_place_id, image_url, price_level, category_main, category_sub, curation_level, visit_status)
SELECT l.id, 'locations', l.name, l.address, l.lat, l.lon, l.province, l.region, l.sub_region, l.kakao_place_id,
       l.naver_place_id, l."imageUrl", CASE WHEN l.price_level BETWEEN 1 AND 4 THEN l.price_level END,
       l.category_main, l.category_sub, CASE WHEN l.curation_level BETWEEN 1 AND 5 THEN l.curation_level END,
       CASE WHEN l.curator_visited IS TRUE THEN 'visited' ELSE 'candidate' END
FROM locations l WHERE NOT EXISTS (SELECT 1 FROM places p WHERE p.id = l.id)
ON CONFLICT (id) DO NOTHING;
INSERT INTO places (id, legacy_table, name, address, lat, lon, region, sub_region, kakao_place_id,
                    naver_place_id, image_url, price_level, category_main, category_sub, curation_level, visit_status)
SELECT a.id, 'attractions', a.name, a.address, a.lat, a.lon, a.region, a.sub_region, a.kakao_place_id,
       a.naver_place_id, a."imageUrl", CASE WHEN a.price_level BETWEEN 1 AND 4 THEN a.price_level END,
       a.category_main, a.category_sub, CASE WHEN a.curation_level BETWEEN 1 AND 5 THEN a.curation_level END,
       CASE WHEN a.curator_visited IS TRUE THEN 'visited' ELSE 'candidate' END
FROM attractions a WHERE NOT EXISTS (SELECT 1 FROM places p WHERE p.id = a.id)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE places ENABLE TRIGGER trg_sync_place_to_legacy;

-- 사이트 검색 뷰: 기존 칸 순서를 유지하고 끝에만 더한다
CREATE OR REPLACE VIEW locations_search WITH (security_invoker = on) AS
SELECT l.*, ls.popularity_score, 'food'::text AS content_type
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = l.id AND p.visit_status <> 'hidden');

CREATE OR REPLACE VIEW attractions_search WITH (security_invoker = on) AS
SELECT a.*, NULL::double precision AS trust_score, NULL::double precision AS popularity_score
FROM attractions a
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = a.id AND p.visit_status <> 'hidden');
