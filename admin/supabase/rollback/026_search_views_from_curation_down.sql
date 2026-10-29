-- 026 되돌리기: 023의 검색 뷰로 (예전 short_desc 그대로, 숨긴 장소 제외)
DROP VIEW IF EXISTS public.locations_search;
CREATE VIEW public.locations_search WITH (security_invoker = on) AS
SELECT l.*, ls.popularity_score, 'food'::text AS content_type
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = l.id AND p.visit_status <> 'hidden');

DROP VIEW IF EXISTS public.attractions_search;
CREATE VIEW public.attractions_search WITH (security_invoker = on) AS
SELECT a.*, NULL::double precision AS trust_score, NULL::double precision AS popularity_score
FROM attractions a
WHERE EXISTS (SELECT 1 FROM places p WHERE p.id = a.id AND p.visit_status <> 'hidden');

GRANT SELECT ON public.locations_search, public.attractions_search TO anon, authenticated, service_role;
