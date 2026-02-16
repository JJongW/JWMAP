-- Admin 코스 등록 파이프라인용 스키마 보강

CREATE TABLE IF NOT EXISTS odiga_saved_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_hash text UNIQUE NOT NULL,
  course_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE odiga_saved_courses
  ADD COLUMN IF NOT EXISTS source_query text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS vibe text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS season text,
  ADD COLUMN IF NOT EXISTS people_count smallint,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS response_type text DEFAULT 'course',
  ADD COLUMN IF NOT EXISTS place_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS validation_reason text,
  ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE odiga_saved_courses
SET place_ids = COALESCE(
  (
    SELECT array_agg(step -> 'place' ->> 'id')
    FROM jsonb_array_elements(COALESCE(course_data -> 'steps', '[]'::jsonb)) AS step
    WHERE (step -> 'place' ->> 'id') IS NOT NULL
  ),
  '{}'
)
WHERE place_ids IS NULL OR cardinality(place_ids) = 0;

UPDATE odiga_saved_courses
SET validation_status = CASE
  WHEN cardinality(COALESCE(place_ids, '{}')) >= 2 THEN 'verified'
  ELSE 'invalid'
END
WHERE validation_status IS NULL OR validation_status = 'unchecked';

CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_hash ON odiga_saved_courses (course_hash);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_region ON odiga_saved_courses (region);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_activity_type ON odiga_saved_courses (activity_type);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_validation_status ON odiga_saved_courses (validation_status);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_usage_count ON odiga_saved_courses (usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_place_ids_gin ON odiga_saved_courses USING GIN (place_ids);
