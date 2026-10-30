-- 027 되돌리기: admin_decide_intake를 022 정의로
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
