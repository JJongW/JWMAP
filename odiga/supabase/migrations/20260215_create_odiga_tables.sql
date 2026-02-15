-- odiga: AI 산책 코스 추천 CLI 테이블

-- 검색 로그
CREATE TABLE IF NOT EXISTS odiga_search_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_query text NOT NULL,
  region text,
  vibe text[] DEFAULT '{}',
  people_count smallint,
  mode text,
  season text,
  selected_course jsonb,
  parse_error_fields text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 저장된 코스
CREATE TABLE IF NOT EXISTS odiga_saved_courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  course_hash text UNIQUE NOT NULL,
  course_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_created_at ON odiga_search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_region ON odiga_search_logs (region);
CREATE INDEX IF NOT EXISTS idx_odiga_saved_courses_hash ON odiga_saved_courses (course_hash);
