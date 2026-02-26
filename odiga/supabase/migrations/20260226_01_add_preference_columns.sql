-- odiga: intent 파싱 결과 preference 컬럼 4개 추가
--
-- intent.ts가 파싱하는 special_context·noise_preference·
-- budget_sensitivity·walking_preference가 log.ts에서 삽입되나
-- 스키마에 컬럼이 없어 데이터가 유실되던 문제 수정.

ALTER TABLE odiga_search_logs
  ADD COLUMN IF NOT EXISTS special_context      text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS noise_preference     text DEFAULT NULL
    CHECK (noise_preference IS NULL OR noise_preference IN ('quiet', 'balanced', 'lively', 'unknown')),
  ADD COLUMN IF NOT EXISTS budget_sensitivity   text DEFAULT NULL
    CHECK (budget_sensitivity IS NULL OR budget_sensitivity IN ('tight', 'moderate', 'flexible', 'unknown')),
  ADD COLUMN IF NOT EXISTS walking_preference   text DEFAULT NULL
    CHECK (walking_preference IS NULL OR walking_preference IN ('short', 'moderate', 'relaxed', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_noise_preference
  ON odiga_search_logs (noise_preference);
CREATE INDEX IF NOT EXISTS idx_odiga_search_logs_budget_sensitivity
  ON odiga_search_logs (budget_sensitivity);
