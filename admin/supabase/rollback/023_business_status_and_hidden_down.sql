-- 023 되돌리기: 검색 뷰에서 숨김 거르기만 없앤다 (content_type 칸은 남긴다. 뷰 칸은 줄일 수 없다)
-- 추가한 칸·인덱스·채워 넣은 places 행은 그대로 둔다.
CREATE OR REPLACE VIEW locations_search WITH (security_invoker = on) AS
SELECT l.*, ls.popularity_score, 'food'::text AS content_type
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id;

CREATE OR REPLACE VIEW attractions_search WITH (security_invoker = on) AS
SELECT a.*, NULL::double precision AS trust_score, NULL::double precision AS popularity_score
FROM attractions a;
