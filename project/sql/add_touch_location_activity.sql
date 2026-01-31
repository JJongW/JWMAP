-- touch_location_activity RPC (fix 404 on /rest/v1/rpc/touch_location_activity)
-- Run in Supabase SQL Editor

ALTER TABLE locations ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

CREATE OR REPLACE FUNCTION touch_location_activity(loc_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE locations SET last_activity_at = now() WHERE id = loc_id;
$$;

GRANT EXECUTE ON FUNCTION touch_location_activity(uuid) TO anon;
GRANT EXECUTE ON FUNCTION touch_location_activity(uuid) TO authenticated;
