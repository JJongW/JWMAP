-- 022 되돌리기: 트리거·함수·admin 쓰기 권한을 없앤다.
-- 추가한 칸(category_main, category_sub, curation_level, basis)과 그동안 쓴 데이터는 남긴다.
DROP FUNCTION IF EXISTS admin_decide_intake(uuid, text, uuid, text, text);
DROP TRIGGER IF EXISTS trg_sync_cover_photo ON place_photos;
DROP TRIGGER IF EXISTS trg_sync_recommendation_to_legacy ON recommendations;
DROP TRIGGER IF EXISTS trg_sync_visit_to_place ON visits;
DROP TRIGGER IF EXISTS trg_sync_place_to_legacy ON places;
DROP FUNCTION IF EXISTS sync_cover_photo();
DROP FUNCTION IF EXISTS sync_recommendation_to_legacy();
DROP FUNCTION IF EXISTS sync_visit_to_place();
DROP FUNCTION IF EXISTS sync_place_to_legacy();
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['places', 'taxonomy_terms', 'place_terms', 'source_notes', 'visits', 'visit_terms',
                           'recommendations', 'recommendation_visits', 'recommendation_terms', 'place_facts',
                           'legacy_tag_fact_map'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
  END LOOP;
END $$;
REVOKE SELECT ON legacy_place_rows, legacy_place_tags, curation_review_untyped_places,
  curation_review_unmapped_tags, curation_review_duplicates, curation_review_fact_conflicts FROM authenticated;
