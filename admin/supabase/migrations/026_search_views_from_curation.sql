-- ============================================================
-- 026: 사이트 검색 뷰가 새 큐레이션 테이블 기준으로 "추천하는 이유"를 준다
--
-- 사이트 카드·추천 계산은 locations_search / attractions_search의 short_desc를 추천하는 이유로 쓴다.
--   short_desc     = 공개된 추천 문장(recommendations.status = published)의 최신 문장
--                    없으면 가본 곳만 예전 한줄 설명. 안 가본 곳의 예전 문장(019에서 초안이 된 것)은 내보내지 않는다
--   recommend_basis = 공개 추천의 근거 (visited / friend / research / wishlist). 안 가본 곳 표시에 쓴다
-- 칸 순서를 운영 뷰와 같게 명시하고, 끝에 recommend_basis를 더한다.
-- 예전 테이블 행은 바꾸지 않는다. 되돌리기: rollback/026_search_views_from_curation_down.sql (023 정의로)
-- ============================================================

DROP VIEW IF EXISTS public.locations_search;
CREATE VIEW public.locations_search WITH (security_invoker = on) AS
SELECT
  l.id, l.name, l.region, l.lon, l.lat, l.memo, l.address, l.rating, l."imageUrl", l.created_at, l.event_tags,
  l.sub_region,
  coalesce(rec.body, CASE WHEN l.curator_visited IS TRUE THEN l.short_desc END) AS short_desc,
  l.visit_date, l.price_level, l.naver_place_id, l.kakao_place_id, l.province, l.tags, l.category_main,
  l.category_sub, l.curator_visited, l.region_id, l.category_id, l.curation_level,
  ls.popularity_score,
  'food'::text AS content_type,
  rec.basis AS recommend_basis
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id
LEFT JOIN LATERAL (
  SELECT r.body, r.basis FROM recommendations r
  WHERE r.place_id = l.id AND r.status = 'published'
  ORDER BY r.published_at DESC NULLS LAST, r.updated_at DESC
  LIMIT 1
) rec ON true
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = l.id AND p.visit_status <> 'hidden');

DROP VIEW IF EXISTS public.attractions_search;
CREATE VIEW public.attractions_search WITH (security_invoker = on) AS
SELECT
  a.id, a.name, a.region, a.sub_region, a.category_main, a.category_sub, a.lon, a.lat, a.address, a.memo,
  coalesce(rec.body, CASE WHEN a.curator_visited IS TRUE THEN a.short_desc END) AS short_desc,
  a.rating, a.curation_level, a.price_level, a.tags, a."imageUrl", a.event_tags, a.naver_place_id,
  a.kakao_place_id, a.visit_date, a.curator_visited, a.content_type, a.created_at,
  NULL::double precision AS trust_score,
  NULL::double precision AS popularity_score,
  rec.basis AS recommend_basis
FROM attractions a
LEFT JOIN LATERAL (
  SELECT r.body, r.basis FROM recommendations r
  WHERE r.place_id = a.id AND r.status = 'published'
  ORDER BY r.published_at DESC NULLS LAST, r.updated_at DESC
  LIMIT 1
) rec ON true
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = a.id AND p.visit_status <> 'hidden');

GRANT SELECT ON public.locations_search, public.attractions_search TO anon, authenticated, service_role;
