-- ============================================================
-- 018: Oomap 큐레이션 모델 — "직접 가본 사람의 이유가 있는 장소"
--
-- 추가만 한다. 기존 locations / attractions / tags / location_tags / attraction_tags 는
-- 바꾸거나 지우지 않는다 (지금 화면이 그대로 읽는다). 데이터 채우기는 019.
--
-- 서로 섞이지 않게 나눈 개념
--   places                 장소 자체 (이름·위치·식별자). id는 기존 locations/attractions id를 그대로 쓴다
--   taxonomy_terms         분류 사전: 장소 종류(place_type) / 추천하는 이유(reason) / 이런 때(situation)
--   place_terms            장소 ↔ 분류 (여러 개). 제안(suggested) → 운영자 확인(confirmed)
--   visits                 운영자 방문 경험 (한 장소에 여러 번)
--   visit_terms            방문 때의 상황 분류
--   recommendations        추천: 자연스러운 문장 + 누구에게 / 조건 / 주의점 (한 장소에 여러 개)
--   recommendation_visits  추천의 근거가 된 방문
--   recommendation_terms   추천 ↔ 이유·상황 분류
--   source_notes           운영자가 적은 원문 메모 보존 (고치지 않는다)
--   place_facts            확인 가능한 시설 정보 (와이파이·콘센트·주차·영업시간 …) + 출처·확인 시점
--
-- 되돌리기: admin/supabase/rollback/018_019_curation_model_down.sql (새 테이블만 지운다)
-- ============================================================

-- ── 장소 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 기존 데이터에서 온 경우 출처 테이블 (id는 원본과 같다)
  legacy_table    text CHECK (legacy_table IN ('locations', 'attractions')),
  name            text NOT NULL,
  address         text,
  lat             double precision,
  lon             double precision,
  province        text,
  region          text,
  sub_region      text,
  kakao_place_id  text,
  naver_place_id  text,
  image_url       text,
  price_level     smallint CHECK (price_level BETWEEN 1 AND 4),
  -- visited: 운영자 방문 기록 있음 / candidate: 아직 안 가본 후보 / hidden: 화면에서 숨김 (삭제 대신)
  visit_status    text NOT NULL DEFAULT 'candidate' CHECK (visit_status IN ('visited', 'candidate', 'hidden')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 중복이 실제로 있어서(카카오 ID 3쌍) unique를 걸지 않고 검토 뷰(019)로 드러낸다
CREATE INDEX IF NOT EXISTS idx_places_kakao_place_id ON places(kakao_place_id);
CREATE INDEX IF NOT EXISTS idx_places_region ON places(region);
CREATE INDEX IF NOT EXISTS idx_places_visit_status ON places(visit_status);

-- ── 분류 사전 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('place_type', 'reason', 'situation')),
  slug               text NOT NULL,
  label              text NOT NULL,
  parent_id          uuid REFERENCES taxonomy_terms(id) ON DELETE SET NULL,
  -- food: 주로 맛집·카페 / space: 주로 볼거리 / both
  mode               text NOT NULL DEFAULT 'both' CHECK (mode IN ('food', 'space', 'both')),
  -- 운영자 문장에서 근거로 찾을 말
  text_hints         text[] NOT NULL DEFAULT '{}',
  -- 기존 태그 / 기존 category_main·category_sub 중 이 분류의 근거로 볼 수 있는 값 (이관용)
  legacy_tags        text[] NOT NULL DEFAULT '{}',
  legacy_categories  text[] NOT NULL DEFAULT '{}',
  -- 새 분류를 열어 둔다: AI·운영자가 제안한 분류는 proposed로 들어오고, 확인되면 active
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'proposed', 'retired')),
  created_by         text NOT NULL DEFAULT 'seed' CHECK (created_by IN ('seed', 'operator', 'ai')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxonomy_terms_kind_slug_unique UNIQUE (kind, slug)
);

-- ── 장소 ↔ 분류 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS place_terms (
  place_id     uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  term_id      uuid NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  -- AI·규칙·기존 태그에서 온 것은 suggested. 운영자가 확인해야 confirmed
  status       text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  source       text NOT NULL CHECK (source IN ('operator', 'legacy_category', 'legacy_tag', 'rule', 'ai')),
  -- 근거: '#태그', '카공카페로 등록', 원문 일부 등
  evidence     text,
  confidence   real CHECK (confidence BETWEEN 0 AND 1),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, term_id)
);
CREATE INDEX IF NOT EXISTS idx_place_terms_term ON place_terms(term_id, status);

-- ── 원문 메모 보존 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id       uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  origin         text NOT NULL CHECK (origin IN ('short_desc', 'memo', 'kakao_memo', 'operator')),
  -- 원문 그대로 (trim 하지 않는다)
  raw_text       text NOT NULL,
  -- 화면에서 어떻게 쓸지 판단용 분류. 원문은 바꾸지 않는다
  classified_as  text NOT NULL DEFAULT 'unknown'
                   CHECK (classified_as IN ('operator_note', 'auto_generated', 'address', 'unknown')),
  legacy_table   text,
  legacy_column  text,
  imported_at    timestamptz NOT NULL DEFAULT now()
);
-- 기존 컬럼에서 온 원문은 장소당 한 번만 (019를 다시 돌려도 중복되지 않게)
CREATE UNIQUE INDEX IF NOT EXISTS uq_source_notes_legacy
  ON source_notes(place_id, origin) WHERE origin IN ('short_desc', 'memo');

-- ── 방문 경험 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id           uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  visited_on         date,
  -- 방문일을 어디까지 아는지. 기존 데이터는 대부분 unknown
  visited_on_precision text NOT NULL DEFAULT 'unknown'
                       CHECK (visited_on_precision IN ('day', 'month', 'year', 'unknown')),
  time_slot          text,            -- 예: '평일 오후', '주말 저녁'
  companions         text,            -- 예: '혼자', '친구 둘'
  situation_note     text,            -- 어떤 상황에서 갔는지
  experience_note    text,            -- 무엇을 직접 경험했는지 (먹은 것·본 것·한 것)
  disclosure         text CHECK (disclosure IN ('paid', 'invited', 'sponsored')),
  source             text NOT NULL CHECK (source IN ('operator', 'legacy_flag', 'kakao_saved')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_place ON visits(place_id);

CREATE TABLE IF NOT EXISTS visit_terms (
  visit_id     uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  term_id      uuid NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  source       text NOT NULL CHECK (source IN ('operator', 'legacy_tag', 'rule', 'ai')),
  evidence     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, term_id)
);

-- ── 추천 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id        uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  body            text NOT NULL,      -- 추천하는 이유 (자연스러운 문장)
  fits_for        text,               -- 누구에게 잘 맞는지
  conditions      text,               -- 이럴 때 추천 (예: 평일 오후, 창가 자리)
  caveats         text,               -- 주의할 점
  -- draft는 화면에 나가지 않는다. 미방문 장소의 문장, AI 초안은 draft로 시작
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  source          text NOT NULL CHECK (source IN ('operator', 'legacy_short_desc', 'ai_draft')),
  source_note_id  uuid REFERENCES source_notes(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_recommendations_place ON recommendations(place_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recommendations_source_note
  ON recommendations(source_note_id) WHERE source_note_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recommendation_visits (
  recommendation_id  uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  visit_id           uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  PRIMARY KEY (recommendation_id, visit_id)
);

CREATE TABLE IF NOT EXISTS recommendation_terms (
  recommendation_id  uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  term_id            uuid NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
  source             text NOT NULL CHECK (source IN ('operator', 'rule', 'ai')),
  evidence           text,
  confidence         real CHECK (confidence BETWEEN 0 AND 1),
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recommendation_id, term_id)
);

-- ── 확인 가능한 시설 정보 ─────────────────────────────────
-- '작업하기 좋음' 같은 개인 인상은 reason(분류)으로, 와이파이·콘센트 같은 확인 가능한 사실은 여기로
CREATE TABLE IF NOT EXISTS place_facts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  field       text NOT NULL CHECK (field IN (
                'wifi', 'power_outlet', 'parking', 'reservation', 'takeout', 'delivery',
                'pet_friendly', 'accessibility', 'no_kids_zone', 'hours', 'admission_fee', 'phone', 'other')),
  value       jsonb NOT NULL,          -- 예: {"available": true} / {"text": "10:00-21:00"}
  status      text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'outdated')),
  source      text NOT NULL CHECK (source IN ('operator', 'legacy_tag', 'kakao', 'naver', 'google', 'official', 'visitor')),
  source_url  text,
  checked_at  timestamptz,             -- 언제 확인했는지. NULL이면 확인한 적 없음
  evidence    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- 같은 출처의 같은 값은 한 번만. 값이 다르면(주차 가능/불가) 둘 다 남겨 충돌로 검토한다
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_facts_source_value ON place_facts(place_id, field, source, value);

-- ── RLS: 읽기만 공개, 쓰기는 service role(관리자)만 ────────────
ALTER TABLE places                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_terms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_terms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_terms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_terms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_facts            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS places_public_read ON places;
CREATE POLICY places_public_read ON places FOR SELECT TO anon, authenticated
  USING (visit_status <> 'hidden');

DROP POLICY IF EXISTS taxonomy_terms_public_read ON taxonomy_terms;
CREATE POLICY taxonomy_terms_public_read ON taxonomy_terms FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- 제안 상태 분류·초안 추천은 공개하지 않는다
DROP POLICY IF EXISTS place_terms_public_read ON place_terms;
CREATE POLICY place_terms_public_read ON place_terms FOR SELECT TO anon, authenticated
  USING (status = 'confirmed');

DROP POLICY IF EXISTS visits_public_read ON visits;
CREATE POLICY visits_public_read ON visits FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS visit_terms_public_read ON visit_terms;
CREATE POLICY visit_terms_public_read ON visit_terms FOR SELECT TO anon, authenticated
  USING (status = 'confirmed');

DROP POLICY IF EXISTS recommendations_public_read ON recommendations;
CREATE POLICY recommendations_public_read ON recommendations FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS recommendation_visits_public_read ON recommendation_visits;
CREATE POLICY recommendation_visits_public_read ON recommendation_visits FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS recommendation_terms_public_read ON recommendation_terms;
CREATE POLICY recommendation_terms_public_read ON recommendation_terms FOR SELECT TO anon, authenticated
  USING (status = 'confirmed');

-- 시설 정보는 확인 여부(status, checked_at)와 함께 공개한다
DROP POLICY IF EXISTS place_facts_public_read ON place_facts;
CREATE POLICY place_facts_public_read ON place_facts FOR SELECT TO anon, authenticated USING (true);

-- source_notes(원문)는 공개 정책 없음 → 관리자만 읽는다
