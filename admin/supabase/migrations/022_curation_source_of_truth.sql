-- ============================================================
-- 022: 새 큐레이션 테이블을 기준으로 삼기
--
-- admin은 이제 places / visits / recommendations / place_photos 에 쓴다.
-- 사이트는 아직 locations / attractions 를 읽으므로, 트리거가 같은 내용을 예전 테이블에 옮겨 쓴다.
--   places            → 이름·주소·좌표·지역·카테고리·추천 강도·방문 여부·대표 사진
--   visits            → 장소를 visited로, 가장 최근 방문일을 visit_date로
--   recommendations   → 공개된 추천 문장을 short_desc로 (내리면 같은 문장일 때만 비운다)
--   place_photos      → 고른 대표 사진을 places.image_url로
-- 예전 테이블에서 새 테이블로는 옮기지 않는다 (한 방향). 예전 행은 지우지 않는다.
--
-- 그 밖에
--   - places에 카테고리·추천 강도 칸 추가 (기존 값 복사)
--   - 방문 출처에 odiga_vault(직접 찍은 사진), 추천에 basis(가본 곳인지, 안 가봤다면 근거)
--   - 새 테이블에 admin 쓰기 권한 (020의 private.is_admin)
--   - 검토함 결정 함수 admin_decide_intake
-- 되돌리기: admin/supabase/rollback/022_curation_source_of_truth_down.sql
-- ============================================================

-- ── 1. 칸 추가 ────────────────────────────────────────────
ALTER TABLE places ADD COLUMN IF NOT EXISTS category_main  text;
ALTER TABLE places ADD COLUMN IF NOT EXISTS category_sub   text;
-- 1 가볍게 · 2 괜찮음 · 3 운영자 추천 · 4 대표픽 · 5 대표픽 중 최고 (사이트 배지 기준과 같다)
ALTER TABLE places ADD COLUMN IF NOT EXISTS curation_level smallint CHECK (curation_level BETWEEN 1 AND 5);

ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'visited'
  CHECK (basis IN ('visited', 'friend', 'research', 'wishlist'));

ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_source_check;
ALTER TABLE visits ADD CONSTRAINT visits_source_check
  CHECK (source IN ('operator', 'legacy_flag', 'kakao_saved', 'odiga_vault'));

-- 기존 값 복사 (비어 있는 칸만)
UPDATE places p SET category_main  = coalesce(p.category_main, l.category_main),
                    category_sub   = coalesce(p.category_sub, l.category_sub),
                    curation_level = coalesce(p.curation_level, l.curation_level)
FROM locations l WHERE p.id = l.id AND p.legacy_table = 'locations';
UPDATE places p SET category_main  = coalesce(p.category_main, a.category_main),
                    category_sub   = coalesce(p.category_sub, a.category_sub),
                    curation_level = coalesce(p.curation_level, a.curation_level)
FROM attractions a WHERE p.id = a.id AND p.legacy_table = 'attractions';

-- ── 2. admin 쓰기 권한 ───────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['places', 'taxonomy_terms', 'place_terms', 'source_notes', 'visits', 'visit_terms',
                           'recommendations', 'recommendation_visits', 'recommendation_terms', 'place_facts',
                           'legacy_tag_fact_map'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- admin "확인 필요" 화면이 019 검토 뷰를 읽는다 (security_invoker라 원본 테이블 RLS가 그대로 적용된다)
GRANT SELECT ON legacy_place_rows, legacy_place_tags, curation_review_untyped_places,
  curation_review_unmapped_tags, curation_review_duplicates, curation_review_fact_conflicts TO authenticated;

-- ── 3. 예전 테이블로 옮겨 쓰기 ─────────────────────────────
CREATE OR REPLACE FUNCTION sync_place_to_legacy() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.legacy_table = 'locations' THEN
    INSERT INTO locations AS l (id, name, address, lat, lon, province, region, sub_region, kakao_place_id,
                                naver_place_id, price_level, category_main, category_sub, curation_level,
                                curator_visited, "imageUrl")
    VALUES (NEW.id, NEW.name, NEW.address, NEW.lat, NEW.lon, NEW.province, NEW.region, NEW.sub_region,
            NEW.kakao_place_id, NEW.naver_place_id, NEW.price_level, NEW.category_main, NEW.category_sub,
            NEW.curation_level, NEW.visit_status = 'visited', NEW.image_url)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, address = EXCLUDED.address, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
      province = EXCLUDED.province, region = EXCLUDED.region, sub_region = EXCLUDED.sub_region,
      kakao_place_id = EXCLUDED.kakao_place_id, naver_place_id = EXCLUDED.naver_place_id,
      price_level = EXCLUDED.price_level, category_main = EXCLUDED.category_main,
      category_sub = EXCLUDED.category_sub, curation_level = EXCLUDED.curation_level,
      curator_visited = EXCLUDED.curator_visited, "imageUrl" = EXCLUDED."imageUrl";
  ELSIF NEW.legacy_table = 'attractions' THEN
    INSERT INTO attractions AS a (id, name, address, lat, lon, region, sub_region, kakao_place_id,
                                  naver_place_id, price_level, category_main, category_sub, curation_level,
                                  curator_visited, "imageUrl")
    VALUES (NEW.id, NEW.name, NEW.address, NEW.lat, NEW.lon, NEW.region, NEW.sub_region,
            NEW.kakao_place_id, NEW.naver_place_id, NEW.price_level, NEW.category_main, NEW.category_sub,
            NEW.curation_level, NEW.visit_status = 'visited', NEW.image_url)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, address = EXCLUDED.address, lat = EXCLUDED.lat, lon = EXCLUDED.lon,
      region = EXCLUDED.region, sub_region = EXCLUDED.sub_region,
      kakao_place_id = EXCLUDED.kakao_place_id, naver_place_id = EXCLUDED.naver_place_id,
      price_level = EXCLUDED.price_level, category_main = EXCLUDED.category_main,
      category_sub = EXCLUDED.category_sub, curation_level = EXCLUDED.curation_level,
      curator_visited = EXCLUDED.curator_visited, "imageUrl" = EXCLUDED."imageUrl";
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_place_to_legacy ON places;
CREATE TRIGGER trg_sync_place_to_legacy
  AFTER INSERT OR UPDATE ON places
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 3)
  EXECUTE FUNCTION sync_place_to_legacy();

-- 방문 기록이 생기면 장소는 visited, 예전 테이블 visit_date는 가장 최근 방문일
CREATE OR REPLACE FUNCTION sync_visit_to_place() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pid    uuid := coalesce(NEW.place_id, OLD.place_id);
  latest date;
  ltable text;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    UPDATE places SET visit_status = 'visited', updated_at = now()
    WHERE id = pid AND visit_status <> 'visited';
  END IF;
  SELECT max(visited_on) INTO latest FROM visits WHERE place_id = pid;
  SELECT legacy_table INTO ltable FROM places WHERE id = pid;
  IF ltable = 'locations' THEN
    UPDATE locations SET visit_date = latest WHERE id = pid AND visit_date IS DISTINCT FROM latest AND latest IS NOT NULL;
  ELSIF ltable = 'attractions' THEN
    UPDATE attractions SET visit_date = latest WHERE id = pid AND visit_date IS DISTINCT FROM latest AND latest IS NOT NULL;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_visit_to_place ON visits;
CREATE TRIGGER trg_sync_visit_to_place
  AFTER INSERT OR UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION sync_visit_to_place();

-- 공개 추천 문장 → short_desc. 내리면 short_desc가 그 문장일 때만 비운다 (원문은 source_notes에 남아 있다)
CREATE OR REPLACE FUNCTION sync_recommendation_to_legacy() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pid      uuid := coalesce(NEW.place_id, OLD.place_id);
  ltable   text;
  latest   text;
BEGIN
  SELECT legacy_table INTO ltable FROM places WHERE id = pid;
  IF ltable IS NULL THEN RETURN NULL; END IF;

  SELECT body INTO latest FROM recommendations
  WHERE place_id = pid AND status = 'published'
  ORDER BY published_at DESC NULLS LAST, updated_at DESC LIMIT 1;

  IF latest IS NOT NULL THEN
    EXECUTE format('UPDATE %I SET short_desc = $1 WHERE id = $2 AND short_desc IS DISTINCT FROM $1', ltable)
      USING latest, pid;
  ELSIF TG_OP <> 'INSERT' AND OLD.status = 'published' THEN
    EXECUTE format('UPDATE %I SET short_desc = NULL WHERE id = $1 AND short_desc = $2', ltable)
      USING pid, OLD.body;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_recommendation_to_legacy ON recommendations;
CREATE TRIGGER trg_sync_recommendation_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON recommendations
  FOR EACH ROW EXECUTE FUNCTION sync_recommendation_to_legacy();

-- 고른 대표 사진 → places.image_url (→ 예전 테이블 imageUrl)
CREATE OR REPLACE FUNCTION sync_cover_photo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.place_id IS NOT NULL AND NEW.is_cover AND NEW.status = 'selected' AND NEW.url IS NOT NULL THEN
    UPDATE places SET image_url = NEW.url, updated_at = now()
    WHERE id = NEW.place_id AND image_url IS DISTINCT FROM NEW.url;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_cover_photo ON place_photos;
CREATE TRIGGER trg_sync_cover_photo
  AFTER INSERT OR UPDATE ON place_photos
  FOR EACH ROW EXECUTE FUNCTION sync_cover_photo();

-- ── 4. 검토함 결정 ────────────────────────────────────────
-- visited / recommend_unvisited: 장소를 연결하거나 새로 만들고, 사진을 장소에 붙인다.
--   visited면 방문 기록을 만든다 (odiga 사진이면 첫 촬영일을 방문일로).
-- later / excluded: 검토함 상태만 바꾼다.
-- 호출한 사람 권한으로 실행된다 (admin만 places에 쓸 수 있다).
CREATE OR REPLACE FUNCTION admin_decide_intake(
  p_intake_id    uuid,
  p_status       text,
  p_place_id     uuid DEFAULT NULL,
  p_legacy_table text DEFAULT 'locations',
  p_basis        text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  it        place_intake%ROWTYPE;
  pid       uuid;
  first_day date;
  vsource   text;
BEGIN
  SELECT * INTO it FROM place_intake WHERE id = p_intake_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'intake % not found', p_intake_id; END IF;
  IF p_status NOT IN ('visited', 'recommend_unvisited', 'later', 'excluded') THEN
    RAISE EXCEPTION 'unknown status %', p_status;
  END IF;

  IF p_status IN ('later', 'excluded') THEN
    UPDATE place_intake SET status = p_status, decided_at = now() WHERE id = p_intake_id;
    RETURN it.place_id;
  END IF;

  pid := coalesce(p_place_id, it.place_id, it.matched_place_id);
  IF pid IS NULL THEN
    INSERT INTO places (legacy_table, name, address, lat, lon, province, region, kakao_place_id, naver_place_id,
                        category_main, visit_status)
    VALUES (p_legacy_table, it.name, it.address, it.lat, it.lon, it.province, it.region_hint, it.kakao_place_id,
            it.naver_place_id, it.category_hint, 'candidate')
    RETURNING id INTO pid;
  END IF;

  UPDATE place_photos SET place_id = pid WHERE intake_id = p_intake_id AND place_id IS DISTINCT FROM pid;

  IF p_status = 'visited' THEN
    vsource := CASE WHEN it.source IN ('odiga_vault', 'kakao_saved') THEN it.source ELSE 'operator' END;
    -- 같은 출처의 방문은 한 번만 (같은 검토 항목을 다시 결정해도 늘지 않게)
    IF NOT EXISTS (SELECT 1 FROM visits WHERE place_id = pid AND source = vsource) THEN
      first_day := (it.raw->>'first_taken_at')::timestamptz::date;
      INSERT INTO visits (place_id, visited_on, visited_on_precision, source)
      VALUES (pid, first_day, CASE WHEN first_day IS NULL THEN 'unknown' ELSE 'day' END, vsource);
    END IF;
  ELSE
    UPDATE place_intake SET unvisited_basis = coalesce(p_basis, unvisited_basis) WHERE id = p_intake_id;
  END IF;

  UPDATE place_intake SET status = p_status, decided_at = now(), place_id = pid WHERE id = p_intake_id;
  RETURN pid;
END $$;

REVOKE ALL ON FUNCTION admin_decide_intake(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_decide_intake(uuid, text, uuid, text, text) TO authenticated;
