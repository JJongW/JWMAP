-- odiga_saved_courses: 메타데이터 + 검증 상태 + 재사용 집계 컬럼 추가

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

-- 기존 데이터 백필: course_data.steps[*].place.id → place_ids
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

-- course_data 안에 vibe/mode가 있는 경우 기본값 백필
UPDATE odiga_saved_courses
SET
  vibe = CASE
    WHEN vibe IS NULL OR cardinality(vibe) = 0 THEN COALESCE(
      (
        SELECT array_agg(value::text)
        FROM jsonb_array_elements_text(COALESCE(course_data -> 'vibes', '[]'::jsonb)) AS value
      ),
      '{}'
    )
    ELSE vibe
  END,
  mode = COALESCE(mode, course_data ->> 'mode'),
  response_type = COALESCE(response_type, 'course');

-- 기본 검증 상태 백필
UPDATE odiga_saved_courses
SET validation_status = CASE
  WHEN cardinality(COALESCE(place_ids, '{}')) >= 2 THEN 'verified'
  ELSE 'invalid'
END
WHERE validation_status IS NULL OR validation_status = 'unchecked';

CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_region ON odiga_saved_courses (region);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_activity_type ON odiga_saved_courses (activity_type);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_response_type ON odiga_saved_courses (response_type);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_validation_status ON odiga_saved_courses (validation_status);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_last_used_at ON odiga_saved_courses (last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_usage_count ON odiga_saved_courses (usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_vibe_gin ON odiga_saved_courses USING GIN (vibe);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_place_ids_gin ON odiga_saved_courses USING GIN (place_ids);
