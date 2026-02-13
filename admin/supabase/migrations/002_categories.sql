-- categories: hierarchical category table (main → sub)
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level smallint NOT NULL CHECK (level IN (1, 2)),  -- 1=대분류, 2=소분류
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (name, level, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
