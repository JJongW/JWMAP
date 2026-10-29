-- 025: '정보 충돌' 검토 목록에서 지난 정보(outdated)는 빼고 본다
-- 운영자나 정리 스크립트가 지난 정보로 표시한 값은 더 이상 충돌로 세지 않는다.
CREATE OR REPLACE VIEW curation_review_fact_conflicts WITH (security_invoker = on) AS
SELECT place_id, field, array_agg(value ORDER BY value::text) AS values
FROM place_facts
WHERE status <> 'outdated'
GROUP BY place_id, field
HAVING count(DISTINCT value) > 1;
