-- ============================================================
-- 021: 검토함(intake) · 장소 사진 · 수집한 리뷰
--
-- 운영자가 빈칸을 채우는 대신, 수집기가 모아 온 장소를 검토함에 쌓고
-- 운영자는 admin에서 "가봤음 / 안 가봤지만 추천 / 나중에 / 제외"만 고른다.
--
--   place_intake     수집기가 가져온 장소 1건 (odiga 폴더, 카카오 저장 목록, 인스타 …)
--   place_photos     장소 사진. 출처(직접 찍음 / 가게 공식 / 웹)와 원본 위치를 함께 남긴다
--   external_reviews 다른 곳에 올라온 리뷰 발췌 (추천 문장 초안의 참고용, 공개하지 않음)
--
-- 모두 admin만 읽고 쓴다 (020의 private.is_admin). 수집기는 service role로 쓴다.
-- 되돌리기: admin/supabase/rollback/021_intake_and_photos_down.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS place_intake (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- odiga_vault: 외장 드라이브 odiga/01_Places 폴더 / kakao_saved: 카카오맵 저장 목록 / instagram / manual
  source            text NOT NULL CHECK (source IN ('odiga_vault', 'kakao_saved', 'instagram', 'naver_saved', 'manual')),
  -- 같은 출처에서 다시 수집해도 한 줄로 유지하는 키 (폴더 경로, 카카오 장소 ID 등)
  source_key        text NOT NULL,
  name              text NOT NULL,
  province          text,
  region_hint       text,
  category_hint     text,
  address           text,
  lat               double precision,
  lon               double precision,
  kakao_place_id    text,
  naver_place_id    text,
  -- 이미 있는 장소와 같은 곳으로 보이면 연결 (확인 전 제안)
  matched_place_id  uuid REFERENCES places(id) ON DELETE SET NULL,
  match_note        text,
  -- 수집 원본 (폴더명, 저장 메모, 폴더 이름 등). 고치지 않는다
  raw               jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 직접 찍은 사진이 있으면 수집기가 visited로 미리 제안한다
  suggested_status  text CHECK (suggested_status IN ('visited', 'recommend_unvisited', 'later', 'excluded')),
  -- pending: 검토 전 / visited: 가봤음 / recommend_unvisited: 안 가봤지만 추천 / later: 나중에 갈 곳 / excluded: 제외
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'visited', 'recommend_unvisited', 'later', 'excluded')),
  -- 안 가봤지만 추천하는 근거 (지인 추천, 직접 찾아봄 …)
  unvisited_basis   text,
  decided_at        timestamptz,
  -- 검토 결과로 만들어지거나 연결된 장소
  place_id          uuid REFERENCES places(id) ON DELETE SET NULL,
  collected_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_key)
);
CREATE INDEX IF NOT EXISTS idx_place_intake_status ON place_intake(status, collected_at);
CREATE INDEX IF NOT EXISTS idx_place_intake_kakao ON place_intake(kakao_place_id);

CREATE TABLE IF NOT EXISTS place_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id     uuid REFERENCES places(id) ON DELETE CASCADE,
  intake_id    uuid REFERENCES place_intake(id) ON DELETE CASCADE,
  -- own: 운영자가 직접 찍음 / official: 가게·기관이 올린 공식 이미지 / web: 그 밖의 웹 이미지
  source       text NOT NULL CHECK (source IN ('own', 'official', 'web')),
  source_url   text,
  local_path   text,
  -- 업로드된 주소 (Cloudinary). 업로드 전이면 비어 있다
  url          text,
  width        int,
  height       int,
  taken_at     timestamptz,
  lat          double precision,
  lon          double precision,
  -- suggested: 후보 / selected: 사이트에 쓸 사진 / rejected: 안 씀
  status       text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'selected', 'rejected')),
  is_cover     boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (place_id IS NOT NULL OR intake_id IS NOT NULL)
);
-- NULL끼리는 겹쳐도 되므로 일반 unique로 둔다 (수집기 upsert의 on_conflict 대상)
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_photos_local ON place_photos(local_path);
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_photos_cover ON place_photos(place_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS idx_place_photos_place ON place_photos(place_id, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_place_photos_intake ON place_photos(intake_id);

CREATE TABLE IF NOT EXISTS external_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id      uuid REFERENCES places(id) ON DELETE CASCADE,
  intake_id     uuid REFERENCES place_intake(id) ON DELETE CASCADE,
  source        text NOT NULL CHECK (source IN ('kakao', 'naver', 'google', 'instagram', 'blog', 'other')),
  source_url    text,
  excerpt       text NOT NULL,
  rating        numeric,
  written_at    date,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (place_id IS NOT NULL OR intake_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_external_reviews_place ON external_reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_external_reviews_intake ON external_reviews(intake_id);

-- ── 권한: admin만 ──────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['place_intake', 'place_photos', 'external_reviews'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      t || '_admin_all', t);
  END LOOP;
END $$;

-- 사이트는 공개 장소의 고른 사진만 본다
DROP POLICY IF EXISTS place_photos_public_read ON place_photos;
CREATE POLICY place_photos_public_read ON place_photos FOR SELECT TO anon
  USING (status = 'selected' AND url IS NOT NULL AND place_id IS NOT NULL);
