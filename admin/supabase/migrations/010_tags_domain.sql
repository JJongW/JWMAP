-- 010: tags 도메인 분리 (food / space)
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS domain text;

UPDATE tags
SET domain = COALESCE(domain, 'food')
WHERE domain IS NULL;

ALTER TABLE tags
ALTER COLUMN domain SET DEFAULT 'food';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tags_domain_check'
  ) THEN
    ALTER TABLE tags
    ADD CONSTRAINT tags_domain_check CHECK (domain IN ('food', 'space'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tags_domain ON tags(domain);
CREATE INDEX IF NOT EXISTS idx_tags_domain_type ON tags(domain, type);