-- odiga: user_feedbacks 컬럼 추가 (log.ts에서 이미 사용 중이나 스키마에 누락됨)
ALTER TABLE odiga_search_logs
  ADD COLUMN IF NOT EXISTS user_feedbacks text[] DEFAULT '{}';
