-- 개발용: 운영 DB의 기존 테이블(마이그레이션 001 이전에 대시보드에서 만든 것 포함)을 같은 컬럼으로 재현한다.
-- 018/019 마이그레이션을 로컬(PGlite)에서 검증할 때만 쓴다. 운영 DB에는 실행하지 않는다.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text,
  sub_region text,
  province text,
  lon double precision,
  lat double precision,
  address text,
  memo text,
  short_desc text,
  rating double precision,
  "imageUrl" text,
  event_tags jsonb DEFAULT '[]',
  visit_date date,
  price_level smallint,
  naver_place_id text,
  kakao_place_id text,
  tags text[] DEFAULT '{}',
  category_main text,
  category_sub text,
  curator_visited boolean,
  region_id uuid,
  category_id uuid,
  curation_level smallint,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text,
  sub_region text,
  category_main text,
  category_sub text,
  lon double precision,
  lat double precision,
  address text,
  memo text,
  short_desc text,
  rating double precision,
  curation_level smallint,
  price_level smallint,
  tags text[] DEFAULT '{}',
  "imageUrl" text,
  event_tags jsonb DEFAULT '[]',
  naver_place_id text,
  kakao_place_id text,
  visit_date date,
  curator_visited boolean,
  content_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  domain text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE location_tags (
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight real,
  source text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (location_id, tag_id)
);

CREATE TABLE attraction_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Supabase처럼 새 테이블은 anon/authenticated가 SELECT 권한을 갖고, 실제 공개 여부는 RLS 정책이 정한다
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
