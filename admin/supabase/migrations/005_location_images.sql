-- location_images: multi-image support per location
CREATE TABLE IF NOT EXISTS location_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_primary boolean DEFAULT false,
  sort_order int DEFAULT 0,
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_location_images_location ON location_images(location_id);
CREATE INDEX idx_location_images_primary ON location_images(location_id, is_primary) WHERE is_primary = true;
