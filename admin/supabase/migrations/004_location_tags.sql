-- location_tags: many-to-many relationship
CREATE TABLE IF NOT EXISTS location_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (location_id, tag_id)
);

CREATE INDEX idx_location_tags_location ON location_tags(location_id);
CREATE INDEX idx_location_tags_tag ON location_tags(tag_id);
