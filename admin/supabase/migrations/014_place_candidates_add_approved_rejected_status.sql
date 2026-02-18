-- place_candidates.status에 approved/rejected 추가
-- 기존값(pending/matched/ignored/new_place)도 유지

ALTER TABLE place_candidates
  DROP CONSTRAINT IF EXISTS place_candidates_status_check;

ALTER TABLE place_candidates
  ADD CONSTRAINT place_candidates_status_check
  CHECK (status IN ('pending', 'matched', 'ignored', 'new_place', 'approved', 'rejected'));
