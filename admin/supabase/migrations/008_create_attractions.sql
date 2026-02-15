-- Separate domain table for non-food places (exhibitions/popups/shops)
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
  features jsonb DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  "imageUrl" text DEFAULT '',
  event_tags text[] DEFAULT '{}',
  naver_place_id text,
  kakao_place_id text,
  visit_date date,
  curator_visited boolean DEFAULT true,
  content_type text DEFAULT 'space',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attractions_region ON attractions(region);
CREATE INDEX IF NOT EXISTS idx_attractions_category_main ON attractions(category_main);
CREATE INDEX IF NOT EXISTS idx_attractions_created_at ON attractions(created_at DESC);
