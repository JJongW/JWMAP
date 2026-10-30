-- ============================================================
-- 027: 검토함 결정이 카카오 ID로 기존 장소를 먼저 찾는다
--
-- 022의 admin_decide_intake는 검토 항목에 연결된 장소(matched_place_id)가 없으면 새 장소를 만들었다.
-- 이름이 달라 이름 대조에서 빠진 곳(사진 폴더 "브라운헤이브" ↔ DB "브라운헤이븐 미아")이나
-- 같은 가게가 두 폴더에 있는 경우, 같은 카카오 장소가 두 번 생겼다.
--   - 연결된 장소가 없으면 같은 카카오 ID를 가진 숨기지 않은 장소에 연결한다
--   - 새로 만들 장소에 좌표가 없으면 알아보기 쉬운 오류를 낸다 (예전 테이블은 좌표가 필수라 저장이 막힌다)
-- 되돌리기: rollback/027_intake_link_by_kakao_id_down.sql (022 정의로)
-- ============================================================

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
  kid       text;
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
  -- 카카오 ID 끝의 '.0'은 예전 입력에서 붙은 것이라 떼고 비교한다
  kid := nullif(regexp_replace(btrim(coalesce(it.kakao_place_id, '')), '\.0+$', ''), '');
  IF pid IS NULL AND kid IS NOT NULL THEN
    SELECT p.id INTO pid FROM places p
    WHERE regexp_replace(btrim(p.kakao_place_id), '\.0+$', '') = kid AND p.visit_status <> 'hidden'
    ORDER BY p.created_at
    LIMIT 1;
  END IF;

  IF pid IS NULL THEN
    IF it.lat IS NULL OR it.lon IS NULL THEN
      RAISE EXCEPTION '좌표가 없어 새 장소를 만들 수 없어요: %. 기존 장소에 연결하거나 위치를 먼저 채워 주세요', it.name;
    END IF;
    INSERT INTO places (legacy_table, name, address, lat, lon, province, region, kakao_place_id, naver_place_id,
                        category_main, visit_status)
    VALUES (p_legacy_table, it.name, it.address, it.lat, it.lon, it.province, it.region_hint, kid,
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

  UPDATE place_intake SET status = p_status, decided_at = now(), place_id = pid, matched_place_id = coalesce(matched_place_id, pid)
  WHERE id = p_intake_id;
  RETURN pid;
END $$;

REVOKE ALL ON FUNCTION admin_decide_intake(uuid, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_decide_intake(uuid, text, uuid, text, text) TO authenticated;
