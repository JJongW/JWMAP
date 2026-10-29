-- ============================================================
-- 019: 기존 데이터 → 큐레이션 모델(018) 채우기
--
-- 원칙
--   * 읽기만: locations / attractions / tags / location_tags / attraction_tags 는 바꾸지 않는다.
--   * 다시 돌려도 같은 결과: 모든 INSERT는 ON CONFLICT DO NOTHING / NOT EXISTS.
--   * ID·링크·사진 보존: places.id = 원본 id, kakao/naver id, imageUrl 그대로.
--   * 원문 보존: short_desc / memo 원문을 source_notes 에 손대지 않고 복사.
--   * 자동 확정 금지: 태그·문장에서 뽑은 이유·상황은 suggested. 운영자가 고른 기존 분류(category)만 confirmed.
--   * 근거가 없으면 붙이지 않는다: 매핑되지 않는 분류·태그는 검토 뷰(curation_review_*)에 미분류로 남긴다.
--
-- 분류 사전 seed 는 project/src/utils/taxonomy.ts 와 같다 (slug 를 바꾸면 양쪽 같이).
-- ============================================================

-- ── 0. 분류 사전 ──────────────────────────────────────────
INSERT INTO taxonomy_terms (kind, slug, label, mode, text_hints, legacy_tags, legacy_categories)
VALUES
  ('place_type', 'cafe', '카페', 'food', '{}'::text[], '{}'::text[], ARRAY['카페']),
  ('place_type', 'bakery', '베이커리·디저트', 'food', '{}'::text[], ARRAY['베이커리카페', '디저트카페'], ARRAY['디저트']),
  ('place_type', 'restaurant', '식당', 'food', '{}'::text[], '{}'::text[], ARRAY['밥', '면', '국물', '고기요리', '해산물', '간편식', '양식', '양식·퓨전', '돈까스', '라멘', '치킨']),
  ('place_type', 'bar', '술집', 'food', '{}'::text[], ARRAY['칵테일바', '피맥', '수제맥주'], ARRAY['술안주', '술집']),
  ('place_type', 'museum', '박물관', 'space', '{}'::text[], '{}'::text[], ARRAY['박물관']),
  ('place_type', 'gallery', '미술관·전시관', 'space', '{}'::text[], ARRAY['미술관', '전시', '전시회', '전시장', '무료전시', '현대미술'], ARRAY['미술관', '전시관', '복합문화공간']),
  ('place_type', 'park', '공원·정원', 'space', '{}'::text[], '{}'::text[], ARRAY['공원/정원', '식물원/수목원', '산/등산']),
  ('place_type', 'street', '거리·동네', 'space', ARRAY['거리', '골목'], '{}'::text[], '{}'::text[]),
  ('place_type', 'bookstore', '서점·도서관', 'space', '{}'::text[], ARRAY['독립서점', '도서관'], ARRAY['독립서점', '도서관']),
  ('place_type', 'shop', '소품샵·편집숍', 'space', '{}'::text[], ARRAY['소품샵'], ARRAY['소품샵', '문구점', '라이프스타일숍', '편집샵']),
  ('place_type', 'viewpoint', '전망대', 'space', '{}'::text[], '{}'::text[], ARRAY['전망대']),
  ('place_type', 'heritage', '궁궐·유적', 'space', '{}'::text[], '{}'::text[], ARRAY['역사/유적', '궁궐/왕릉', '유적지', '사찰']),
  ('place_type', 'market', '시장', 'space', '{}'::text[], '{}'::text[], ARRAY['전통시장']),
  ('reason', 'coffee', '커피', 'food', ARRAY['커피', '원두', '드립', '라떼'], ARRAY['커피 맛집', '커피', '핸드드립전문점', '로스팅전문', '스페셜티카페'], '{}'::text[]),
  ('reason', 'dessert', '디저트·빵', 'food', ARRAY['케이크', '빵', '디저트', '타르트', '쿠키'], ARRAY['수제케이크', '수제디저트', '소금빵', '빵지순례', '에그타르트', '휘낭시에', '케이크', '디저트', '구움과자', '마들렌'], '{}'::text[]),
  ('reason', 'food', '음식 맛', 'food', ARRAY['맛있', '맛집'], '{}'::text[], '{}'::text[]),
  ('reason', 'view', '전망·뷰', 'both', ARRAY['전망', '뷰', '야경', '창밖', '통창', '풍경', '루프탑', '한강'], ARRAY['한강뷰', '루프탑있는', '야경'], ARRAY['전망대']),
  ('reason', 'work', '작업·공부', 'food', ARRAY['작업', '노트북', '콘센트', '공부', '카공'], ARRAY['작업하기 좋음'], ARRAY['카공카페']),
  ('reason', 'walk', '산책', 'space', ARRAY['산책', '걷기'], ARRAY['산책', '산책로'], '{}'::text[]),
  ('reason', 'exhibition', '전시 보기', 'space', ARRAY['전시', '작품'], ARRAY['전시', '전시회', '체험형전시', '무료전시', '현대미술'], '{}'::text[]),
  ('reason', 'photo', '사진 찍기', 'both', ARRAY['사진'], ARRAY['포토존', '사진맛집', '포토스팟'], '{}'::text[]),
  ('reason', 'mood', '분위기', 'both', ARRAY['분위기', '감성'], ARRAY['분위기', '감성카페', '분위기좋은', '빈티지분위기', '앤틱한', '감성', '아늑한분위기'], '{}'::text[]),
  ('reason', 'books', '책 읽기', 'space', ARRAY['책'], ARRAY['책 많음', '독립서점'], '{}'::text[]),
  ('reason', 'browse', '구경·쇼핑', 'space', ARRAY['구경', '소품'], ARRAY['소품 다양', '쇼핑', '선물'], '{}'::text[]),
  ('reason', 'nature', '꽃·자연', 'space', ARRAY['꽃', '단풍', '숲'], ARRAY['벚꽃명소', '벚꽃길', '단풍명소', '장미명소', '꽃', '온실', '식물원'], '{}'::text[]),
  ('situation', 'solo', '혼자', 'both', ARRAY['혼자', '혼밥'], ARRAY['혼밥', '혼밥 가능', '혼술'], '{}'::text[]),
  ('situation', 'date', '데이트', 'both', ARRAY['데이트'], ARRAY['데이트', '데이트코스', '소개팅', '실내데이트', '홍대데이트'], '{}'::text[]),
  ('situation', 'gathering', '여럿이 모일 때', 'both', ARRAY['모임', '회식'], ARRAY['모임', '친목모임', '회식', '단체'], '{}'::text[]),
  ('situation', 'quiet', '조용히 있고 싶을 때', 'both', ARRAY['조용'], ARRAY['조용함', '조용한 분위기', '조용한'], '{}'::text[]),
  ('situation', 'rainy_day', '비 오는 날', 'both', ARRAY['비 오는', '실내'], ARRAY['실내', '실내데이트', '실내놀거리'], '{}'::text[]),
  ('situation', 'weekday_afternoon', '평일 오후', 'both', ARRAY['평일'], '{}'::text[], '{}'::text[]),
  ('situation', 'with_kids', '아이와 함께', 'both', ARRAY['아이'], ARRAY['아이와함께', '어린이'], '{}'::text[]),
  ('situation', 'with_family', '가족과', 'both', ARRAY['가족', '부모님'], ARRAY['가족', '가족나들이'], '{}'::text[]),
  ('situation', 'with_pet', '반려견과', 'both', ARRAY['강아지', '반려견'], ARRAY['반려견동반', '애견동반카페'], '{}'::text[]),
  ('situation', 'gift', '선물 고를 때', 'both', ARRAY['선물'], ARRAY['선물하기 좋음', '선물'], '{}'::text[])
ON CONFLICT (kind, slug) DO NOTHING;

-- 공백·대소문자 차이를 없앤 비교용 ('주차 가능' = '주차가능')
CREATE OR REPLACE FUNCTION curation_squash(value text) RETURNS text
  LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT lower(regexp_replace(coalesce(value, ''), '\s', '', 'g')) $$;

-- 확인 가능한 시설 정보로 옮길 기존 태그 (개인 인상이 아니라 사실로 확인할 수 있는 것)
CREATE TABLE IF NOT EXISTS legacy_tag_fact_map (
  tag    text PRIMARY KEY,
  field  text NOT NULL,
  value  jsonb NOT NULL
);
ALTER TABLE legacy_tag_fact_map ENABLE ROW LEVEL SECURITY;
INSERT INTO legacy_tag_fact_map (tag, field, value) VALUES
  ('주차가능',       'parking',       '{"available": true}'),
  ('주차 가능',      'parking',       '{"available": true}'),
  ('주차불가',       'parking',       '{"available": false}'),
  ('주차불가능',     'parking',       '{"available": false}'),
  ('주차공간 협소',  'parking',       '{"available": true, "note": "공간 협소"}'),
  ('예약가능',       'reservation',   '{"available": true}'),
  ('예약 가능',      'reservation',   '{"available": true}'),
  ('포장가능',       'takeout',       '{"available": true}'),
  ('배달가능',       'delivery',      '{"available": true}'),
  ('반려견동반',     'pet_friendly',  '{"available": true}'),
  ('애견동반카페',   'pet_friendly',  '{"available": true}'),
  ('이동약자접근',   'accessibility', '{"available": true}'),
  ('노키즈존',       'no_kids_zone',  '{"available": true}'),
  ('무료입장',       'admission_fee', '{"free": true}'),
  ('무료',           'admission_fee', '{"free": true}'),
  ('무료전시',       'admission_fee', '{"free": true}'),
  ('와이파이',       'wifi',          '{"available": true}'),
  ('콘센트',         'power_outlet',  '{"available": true}')
ON CONFLICT (tag) DO NOTHING;

-- ── 1. 장소: 원본 id 그대로 ───────────────────────────────
INSERT INTO places (id, legacy_table, name, address, lat, lon, province, region, sub_region,
                    kakao_place_id, naver_place_id, image_url, price_level, visit_status, created_at)
SELECT l.id, 'locations', l.name, l.address, l.lat, l.lon, l.province, l.region, l.sub_region,
       l.kakao_place_id, l.naver_place_id, l."imageUrl",
       CASE WHEN l.price_level BETWEEN 1 AND 4 THEN l.price_level END,
       CASE WHEN l.curator_visited IS TRUE THEN 'visited' ELSE 'candidate' END,
       coalesce(l.created_at, now())
FROM locations l
ON CONFLICT (id) DO NOTHING;

INSERT INTO places (id, legacy_table, name, address, lat, lon, province, region, sub_region,
                    kakao_place_id, naver_place_id, image_url, price_level, visit_status, created_at)
SELECT a.id, 'attractions', a.name, a.address, a.lat, a.lon, NULL, a.region, a.sub_region,
       a.kakao_place_id, a.naver_place_id, a."imageUrl",
       CASE WHEN a.price_level BETWEEN 1 AND 4 THEN a.price_level END,
       CASE WHEN a.curator_visited IS TRUE THEN 'visited' ELSE 'candidate' END,
       coalesce(a.created_at, now())
FROM attractions a
ON CONFLICT (id) DO NOTHING;

-- 이관에서 같이 쓰는 원본 묶음
CREATE OR REPLACE VIEW legacy_place_rows WITH (security_invoker = on) AS
  SELECT id, 'locations'::text AS legacy_table, short_desc, memo, address, category_main, category_sub,
         curator_visited, visit_date
  FROM locations
  UNION ALL
  SELECT id, 'attractions', short_desc, memo, address, category_main, category_sub,
         curator_visited, visit_date
  FROM attractions;

CREATE OR REPLACE VIEW legacy_place_tags WITH (security_invoker = on) AS
  SELECT l.id AS place_id, t.tag FROM locations l CROSS JOIN LATERAL unnest(coalesce(l.tags, '{}'::text[])) AS t(tag)
  UNION
  SELECT a.id, t.tag FROM attractions a CROSS JOIN LATERAL unnest(coalesce(a.tags, '{}'::text[])) AS t(tag)
  UNION
  SELECT lt.location_id, tg.name FROM location_tags lt JOIN tags tg ON tg.id = lt.tag_id
  UNION
  SELECT at.location_id, tg.name FROM attraction_tags at JOIN tags tg ON tg.id = at.tag_id;

-- ── 2. 원문 메모 보존 ─────────────────────────────────────
-- 분류 규칙은 project/src/utils/curation.ts classifyNote 와 같다 (주소 → 자동 정리 → 운영자 글/확인 전)
INSERT INTO source_notes (place_id, origin, raw_text, classified_as, legacy_table, legacy_column)
SELECT r.id, n.origin, n.raw_text,
       CASE
         WHEN btrim(n.raw_text) = btrim(coalesce(r.address, ''))
           OR (btrim(n.raw_text) ~ '^(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)\S*\s'
               AND btrim(n.raw_text) ~ '\d') THEN 'address'
         WHEN n.raw_text ~ '분위기:|방문 많음|^\[배치 수집\]|운영시간:|입장료:|전화번호:|⏰|💰|🚗|🚇|^https?://\S+$|- (리뷰|리뷰 메모|지도 소개|해시태그|카맵 평점|카맵 후기 수|공식 URL|대중교통):' THEN 'auto_generated'
         -- short_desc 는 운영자가 추천 문장을 쓰는 칸. memo 는 외부 소개 문구가 섞여 있어 확인 전(unknown)으로 둔다
         WHEN n.origin = 'short_desc' THEN 'operator_note'
         ELSE 'unknown'
       END,
       r.legacy_table, n.origin
FROM legacy_place_rows r
CROSS JOIN LATERAL (VALUES ('short_desc', r.short_desc), ('memo', r.memo)) AS n(origin, raw_text)
WHERE n.raw_text IS NOT NULL AND btrim(n.raw_text) <> ''
ON CONFLICT DO NOTHING;

-- ── 3. 방문 경험: 기존 '직접 방문' 표시 → 방문 1건 (날짜는 아는 경우만) ──
INSERT INTO visits (place_id, visited_on, visited_on_precision, source)
SELECT r.id, r.visit_date, CASE WHEN r.visit_date IS NOT NULL THEN 'day' ELSE 'unknown' END, 'legacy_flag'
FROM legacy_place_rows r
WHERE r.curator_visited IS TRUE
  AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.place_id = r.id AND v.source = 'legacy_flag');

-- ── 4. 추천: 운영자 글로 보이는 short_desc 만 ──────────────
-- 방문한 곳은 published, 아직 안 가본 곳의 문장은 draft (방문 주장을 만들지 않는다)
INSERT INTO recommendations (place_id, body, status, source, source_note_id, published_at)
SELECT n.place_id, btrim(n.raw_text),
       CASE WHEN p.visit_status = 'visited' THEN 'published' ELSE 'draft' END,
       'legacy_short_desc', n.id,
       CASE WHEN p.visit_status = 'visited' THEN now() END
FROM source_notes n
JOIN places p ON p.id = n.place_id
WHERE n.origin = 'short_desc' AND n.classified_as = 'operator_note'
ON CONFLICT DO NOTHING;

-- 추천의 근거 = 같은 장소의 기존 방문
INSERT INTO recommendation_visits (recommendation_id, visit_id)
SELECT r.id, v.id
FROM recommendations r
JOIN visits v ON v.place_id = r.place_id AND v.source = 'legacy_flag'
WHERE r.source = 'legacy_short_desc'
ON CONFLICT DO NOTHING;

-- ── 5. 장소 종류 ──────────────────────────────────────────
-- 운영자가 등록할 때 고른 기존 분류(category_sub 우선, 없으면 category_main) → confirmed
INSERT INTO place_terms (place_id, term_id, status, source, evidence)
SELECT DISTINCT ON (r.id, t.id) r.id, t.id, 'confirmed', 'legacy_category',
       coalesce(nullif(r.category_main, ''), '-') || ' > ' || coalesce(nullif(r.category_sub, ''), '-')
FROM legacy_place_rows r
JOIN taxonomy_terms t ON t.kind = 'place_type'
 AND (r.category_sub = ANY (t.legacy_categories) OR r.category_main = ANY (t.legacy_categories))
ORDER BY r.id, t.id
ON CONFLICT DO NOTHING;

-- ── 6. 기존 태그 → 장소 종류·이유·상황 제안 (suggested) ──────
INSERT INTO place_terms (place_id, term_id, status, source, evidence)
SELECT DISTINCT ON (lt.place_id, t.id) lt.place_id, t.id, 'suggested', 'legacy_tag', '#' || lt.tag
FROM legacy_place_tags lt
JOIN places p ON p.id = lt.place_id
JOIN taxonomy_terms t
  ON EXISTS (SELECT 1 FROM unnest(t.legacy_tags) AS h(hint) WHERE curation_squash(h.hint) = curation_squash(lt.tag))
ORDER BY lt.place_id, t.id, lt.tag
ON CONFLICT DO NOTHING;

-- ── 7. 운영자 문장 → 이유·상황 제안 (규칙, suggested) ───────
INSERT INTO recommendation_terms (recommendation_id, term_id, status, source, evidence)
SELECT r.id, t.id, 'suggested', 'rule',
       (SELECT h.hint FROM unnest(t.text_hints) AS h(hint) WHERE position(h.hint IN r.body) > 0 LIMIT 1)
FROM recommendations r
JOIN taxonomy_terms t ON t.kind IN ('reason', 'situation')
WHERE EXISTS (SELECT 1 FROM unnest(t.text_hints) AS h(hint) WHERE position(h.hint IN r.body) > 0)
ON CONFLICT DO NOTHING;

-- ── 8. 기존 태그 → 확인 가능한 시설 정보 (확인 전) ──────────
INSERT INTO place_facts (place_id, field, value, status, source, checked_at, evidence)
SELECT DISTINCT lt.place_id, m.field, m.value, 'unverified', 'legacy_tag', NULL::timestamptz, '#' || lt.tag
FROM legacy_place_tags lt
JOIN places p ON p.id = lt.place_id
JOIN legacy_tag_fact_map m ON curation_squash(m.tag) = curation_squash(lt.tag)
ON CONFLICT DO NOTHING;

-- ── 9. 운영자 검토용 뷰 (미분류·중복·충돌) ──────────────────
-- 장소 종류를 하나도 못 정한 곳
CREATE OR REPLACE VIEW curation_review_untyped_places WITH (security_invoker = on) AS
SELECT p.id, p.name, p.legacy_table, r.category_main, r.category_sub
FROM places p
JOIN legacy_place_rows r ON r.id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id
  WHERE pt.place_id = p.id AND t.kind = 'place_type' AND pt.status <> 'rejected'
);

-- 어떤 분류·시설 정보로도 옮기지 않은 기존 태그 (원본 태그는 그대로 남아 있다)
CREATE OR REPLACE VIEW curation_review_unmapped_tags WITH (security_invoker = on) AS
SELECT lt.tag, count(DISTINCT lt.place_id) AS place_count
FROM legacy_place_tags lt
WHERE NOT EXISTS (
        SELECT 1 FROM taxonomy_terms t, unnest(t.legacy_tags) AS h(hint)
        WHERE curation_squash(h.hint) = curation_squash(lt.tag))
  AND NOT EXISTS (SELECT 1 FROM legacy_tag_fact_map m WHERE curation_squash(m.tag) = curation_squash(lt.tag))
GROUP BY lt.tag;

-- 같은 장소가 두 번 들어간 것으로 보이는 경우 (카카오 ID 또는 이름+주소)
CREATE OR REPLACE VIEW curation_review_duplicates WITH (security_invoker = on) AS
SELECT 'kakao_place_id'::text AS matched_by, kakao_place_id AS key, array_agg(id ORDER BY created_at) AS place_ids
FROM places WHERE kakao_place_id IS NOT NULL AND kakao_place_id <> ''
GROUP BY kakao_place_id HAVING count(*) > 1
UNION ALL
SELECT 'name_address', name || ' / ' || coalesce(address, ''), array_agg(id ORDER BY created_at)
FROM places GROUP BY name, address HAVING count(*) > 1;

-- 같은 시설 정보가 서로 다른 값으로 들어온 경우 (예: 주차 가능 + 주차 불가)
CREATE OR REPLACE VIEW curation_review_fact_conflicts WITH (security_invoker = on) AS
SELECT place_id, field, array_agg(value ORDER BY value::text) AS values
FROM place_facts
GROUP BY place_id, field
HAVING count(DISTINCT value) > 1;

-- 검토 뷰·이관 보조 뷰는 관리자만 (security_invoker 라 원본 테이블 RLS 도 그대로 적용된다)
REVOKE ALL ON legacy_place_rows, legacy_place_tags, curation_review_untyped_places,
  curation_review_unmapped_tags, curation_review_duplicates, curation_review_fact_conflicts
  FROM anon, authenticated;
