-- Search ranking & activity tracking
-- Run in Supabase SQL editor

-- 1. location_stats table (for popularity_score)
CREATE TABLE IF NOT EXISTS location_stats (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  popularity_score numeric DEFAULT 0
);
COMMENT ON TABLE location_stats IS 'Aggregated stats for search ranking (popularity_score)';

-- 2. locations: trust_score, last_activity_at
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS trust_score numeric DEFAULT 0;
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

COMMENT ON COLUMN locations.trust_score IS 'Ranking hint: higher = more trusted';
COMMENT ON COLUMN locations.last_activity_at IS 'Updated when place is clicked or map opened';

-- 3. View for search (LEFT JOIN location_stats)
CREATE OR REPLACE VIEW locations_search AS
SELECT
  l.*,
  ls.popularity_score
FROM locations l
LEFT JOIN location_stats ls ON l.id = ls.location_id;

-- 4. RPC for last_activity_at (no new HTTP endpoints; call from existing flows)
CREATE OR REPLACE FUNCTION touch_location_activity(loc_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE locations
  SET last_activity_at = now()
  WHERE id = loc_id;
$$;
