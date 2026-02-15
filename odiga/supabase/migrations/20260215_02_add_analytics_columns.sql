-- odiga: 분석용 컬럼 추가

-- 검색 로그에 분석 필드 추가
ALTER TABLE odiga_search_logs
  ADD COLUMN IF NOT EXISTS activity_type text,
  ADD COLUMN IF NOT EXISTS response_type text DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS selected_place_id uuid,
  ADD COLUMN IF NOT EXISTS selected_place_name text,
  ADD COLUMN IF NOT EXISTS regenerate_count smallint DEFAULT 0;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_activity_type ON odiga_search_logs (activity_type);
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_response_type ON odiga_search_logs (response_type);
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_selected_place ON odiga_search_logs (selected_place_id);
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_created_at_date ON odiga_search_logs (created_at);
