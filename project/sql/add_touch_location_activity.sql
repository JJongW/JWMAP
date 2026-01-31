-- touch_location_activity RPC (fix 404 on /rest/v1/rpc/touch_location_activity)
-- Run in Supabase SQL Editor
-- Parameter: p_location_id (matches frontend rpc call)
-- Requires: location_stats table (from add_search_ranking_columns.sql)

ALTER TABLE location_stats ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

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
