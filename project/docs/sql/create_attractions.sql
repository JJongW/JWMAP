-- project(frontend)에서 볼거리 모드가 참조하는 별도 테이블
-- 실행 위치: Supabase SQL Editor

CREATE TABLE IF NOT EXISTS attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text NOT NULL,
  sub_region text,
  category_main text,
  category_sub text,
  lon double precision NOT NULL,
  lat double precision NOT NULL,
  address text NOT NULL,
  memo text DEFAULT '',
  short_desc text,
  rating double precision DEFAULT 0,
  curation_level smallint,
  price_level smallint,
  tags text[] DEFAULT '{}',
  event_tags text[] DEFAULT '{}',
  "imageUrl" text DEFAULT '',
  naver_place_id text,
  kakao_place_id text,
  visit_date date,
  curator_visited boolean DEFAULT true,
  content_type text DEFAULT 'space',
  created_at timestamptz DEFAULT now(),
  last_verified_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_attractions_region ON attractions(region);
CREATE INDEX IF NOT EXISTS idx_attractions_category_main ON attractions(category_main);
CREATE INDEX IF NOT EXISTS idx_attractions_created_at ON attractions(created_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attractions'
      AND column_name = 'imageurl'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'attractions'
      AND column_name = 'imageUrl'
  ) THEN
    EXECUTE 'ALTER TABLE public.attractions RENAME COLUMN imageurl TO "imageUrl"';
  END IF;
END
$$;

-- 검색 뷰 (space 모드에서 우선 조회)
DROP VIEW IF EXISTS attractions_search;
CREATE VIEW attractions_search AS
SELECT
  a.id,
  a.name,
  a.region,
  a.sub_region,
  a.category_main,
  a.category_sub,
  a.lon,
  a.lat,
  a.memo,
  a.address,
  a.rating,
  a."imageUrl",
  a.created_at,
  a.event_tags,
  a.short_desc,
  a.visit_date,
  a.price_level,
  a.naver_place_id,
  a.kakao_place_id,
  a.tags,
  a.curator_visited,
  a.curation_level,
  a.content_type,
  NULL::double precision AS trust_score,
  NULL::double precision AS popularity_score
FROM attractions a;

-- 관리자 태그 조인
CREATE TABLE IF NOT EXISTS attraction_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (location_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_attraction_tags_location ON attraction_tags(location_id);
CREATE INDEX IF NOT EXISTS idx_attraction_tags_tag ON attraction_tags(tag_id);

-- RLS (현재 정책: 익명/인증 모두 허용)
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attraction_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attractions_select_all ON attractions;
DROP POLICY IF EXISTS attractions_insert_all ON attractions;
DROP POLICY IF EXISTS attractions_update_all ON attractions;
DROP POLICY IF EXISTS attractions_delete_all ON attractions;

CREATE POLICY attractions_select_all
ON attractions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY attractions_insert_all
ON attractions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY attractions_update_all
ON attractions
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY attractions_delete_all
ON attractions
FOR DELETE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS attraction_tags_select_all ON attraction_tags;
DROP POLICY IF EXISTS attraction_tags_insert_all ON attraction_tags;
DROP POLICY IF EXISTS attraction_tags_update_all ON attraction_tags;
DROP POLICY IF EXISTS attraction_tags_delete_all ON attraction_tags;

CREATE POLICY attraction_tags_select_all
ON attraction_tags
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY attraction_tags_insert_all
ON attraction_tags
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY attraction_tags_update_all
ON attraction_tags
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY attraction_tags_delete_all
ON attraction_tags
FOR DELETE
TO anon, authenticated
USING (true);
