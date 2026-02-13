-- regions: hierarchical region table (province → district → sub_region)
CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level smallint NOT NULL CHECK (level IN (1, 2, 3)),  -- 1=시도, 2=구군, 3=동읍면
  parent_id uuid REFERENCES regions(id) ON DELETE CASCADE,
  path text NOT NULL,  -- '서울', '서울/강남', '서울/강남/역삼동'
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (path)
);

CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_id);
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
CREATE INDEX IF NOT EXISTS idx_regions_path ON regions(path);
