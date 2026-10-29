-- 018/019 되돌리기: 새로 만든 것만 지운다. locations / attractions / tags 등 기존 테이블은 건드리지 않는다.
-- 운영 DB에서 실행하기 전에 승인과 백업이 필요하다.
DROP VIEW IF EXISTS curation_review_fact_conflicts, curation_review_duplicates,
  curation_review_unmapped_tags, curation_review_untyped_places, legacy_place_tags, legacy_place_rows;
DROP TABLE IF EXISTS recommendation_terms, recommendation_visits, recommendations,
  visit_terms, visits, place_facts, place_terms, source_notes, legacy_tag_fact_map, taxonomy_terms, places;
DROP FUNCTION IF EXISTS curation_squash(text);
