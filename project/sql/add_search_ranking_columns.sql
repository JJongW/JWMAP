-- Search ranking & activity tracking
-- Run in Supabase SQL editor

-- 1. location_stats table (for popularity_score, last_activity_at)
CREATE TABLE IF NOT EXISTS location_stats (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  popularity_score numeric DEFAULT 0,
  last_activity_at timestamptz
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

-- 4. RPC for last_activity_at (INSERT/UPDATE location_stats)
CREATE OR REPLACE FUNCTION touch_location_activity(p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO location_stats (location_id, popularity_score, last_activity_at)
  VALUES (p_location_id, 0, now())
  ON CONFLICT (location_id)
  DO UPDATE SET last_activity_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION touch_location_activity(uuid) TO anon;
GRANT EXECUTE ON FUNCTION touch_location_activity(uuid) TO authenticated;
