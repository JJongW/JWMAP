-- Add FK columns to locations for normalized references
-- These are optional FKs; existing text-based columns remain for backward compatibility

ALTER TABLE locations ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_region_id ON locations(region_id);
CREATE INDEX IF NOT EXISTS idx_locations_category_id ON locations(category_id);
