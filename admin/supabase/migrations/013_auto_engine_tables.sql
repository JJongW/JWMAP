-- ============================================================
-- 013: jwm-auto-engine 연동 테이블
--
-- SNS 수집 → 트렌드 분석 → 콘텐츠 자동 생성 파이프라인용
-- jwm-auto-engine (service_role)에서 쓰기, admin에서 조회/관리
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. raw_sns_posts: 수집된 SNS 원본 게시물
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_sns_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      text NOT NULL CHECK (platform IN ('instagram', 'threads')),
  author_handle text NOT NULL DEFAULT '',
  content       text NOT NULL DEFAULT '',
  hashtags      text[] DEFAULT '{}',
  media_urls    text[] DEFAULT '{}',
  region        text NOT NULL DEFAULT '',
  posted_at     timestamptz NOT NULL DEFAULT now(),
  collected_at  timestamptz NOT NULL DEFAULT now(),
  raw_json      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now(),

  -- 동일 게시물 중복 방지
  UNIQUE (platform, author_handle, posted_at)
);

CREATE INDEX IF NOT EXISTS idx_raw_sns_posts_platform
  ON raw_sns_posts(platform);
CREATE INDEX IF NOT EXISTS idx_raw_sns_posts_region
  ON raw_sns_posts(region);
CREATE INDEX IF NOT EXISTS idx_raw_sns_posts_posted_at
  ON raw_sns_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_sns_posts_hashtags_gin
  ON raw_sns_posts USING GIN (hashtags);

ALTER TABLE raw_sns_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raw_sns_posts_select_all ON raw_sns_posts;
CREATE POLICY raw_sns_posts_select_all
  ON raw_sns_posts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS raw_sns_posts_insert_all ON raw_sns_posts;
CREATE POLICY raw_sns_posts_insert_all
  ON raw_sns_posts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS raw_sns_posts_update_all ON raw_sns_posts;
CREATE POLICY raw_sns_posts_update_all
  ON raw_sns_posts FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS raw_sns_posts_delete_all ON raw_sns_posts;
CREATE POLICY raw_sns_posts_delete_all
  ON raw_sns_posts FOR DELETE
  TO anon, authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- 2. place_candidates: 추출된 장소 후보
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS place_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'other'
                    CHECK (category IN ('cafe', 'restaurant', 'bar', 'shop', 'gallery', 'other')),
  region          text NOT NULL DEFAULT '',
  mention_count   integer DEFAULT 0,
  sample_contexts text[] DEFAULT '{}',
  confidence      double precision DEFAULT 0.0
                    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source_date     date NOT NULL DEFAULT CURRENT_DATE,
  -- locations 테이블과 매칭된 경우 연결 (nullable)
  matched_location_id uuid DEFAULT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'matched', 'ignored', 'new_place')),
  created_at      timestamptz DEFAULT now(),

  UNIQUE (name, region, source_date)
);

CREATE INDEX IF NOT EXISTS idx_place_candidates_region
  ON place_candidates(region);
CREATE INDEX IF NOT EXISTS idx_place_candidates_status
  ON place_candidates(status);
CREATE INDEX IF NOT EXISTS idx_place_candidates_source_date
  ON place_candidates(source_date DESC);
CREATE INDEX IF NOT EXISTS idx_place_candidates_confidence
  ON place_candidates(confidence DESC);

ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS place_candidates_select_all ON place_candidates;
CREATE POLICY place_candidates_select_all
  ON place_candidates FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS place_candidates_insert_all ON place_candidates;
CREATE POLICY place_candidates_insert_all
  ON place_candidates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS place_candidates_update_all ON place_candidates;
CREATE POLICY place_candidates_update_all
  ON place_candidates FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS place_candidates_delete_all ON place_candidates;
CREATE POLICY place_candidates_delete_all
  ON place_candidates FOR DELETE
  TO anon, authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- 3. daily_trend_reports: 일별 트렌드 분석 리포트
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_trend_reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date           date NOT NULL,
  region                text NOT NULL DEFAULT '',
  total_posts_analyzed  integer DEFAULT 0,
  places                jsonb DEFAULT '[]'::jsonb,
  tone_analysis         jsonb DEFAULT '{}'::jsonb,
  top_keywords          jsonb DEFAULT '[]'::jsonb,
  platforms             jsonb DEFAULT '{}'::jsonb,
  created_at            timestamptz DEFAULT now(),

  -- 지역+날짜 기준 하나의 리포트만 존재
  UNIQUE (report_date, region)
);

CREATE INDEX IF NOT EXISTS idx_daily_trend_reports_date
  ON daily_trend_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_trend_reports_region
  ON daily_trend_reports(region);

ALTER TABLE daily_trend_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_trend_reports_select_all ON daily_trend_reports;
CREATE POLICY daily_trend_reports_select_all
  ON daily_trend_reports FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS daily_trend_reports_insert_all ON daily_trend_reports;
CREATE POLICY daily_trend_reports_insert_all
  ON daily_trend_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS daily_trend_reports_update_all ON daily_trend_reports;
CREATE POLICY daily_trend_reports_update_all
  ON daily_trend_reports FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS daily_trend_reports_delete_all ON daily_trend_reports;
CREATE POLICY daily_trend_reports_delete_all
  ON daily_trend_reports FOR DELETE
  TO anon, authenticated
  USING (true);


-- ────────────────────────────────────────────────────────────
-- 4. generated_drafts: 생성된 콘텐츠 초안
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_drafts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date       date NOT NULL,
  region            text NOT NULL DEFAULT '',
  time_slot         text NOT NULL
                      CHECK (time_slot IN ('morning', 'lunch', 'evening')),
  scheduled_time    timestamptz,
  caption           text NOT NULL DEFAULT '',
  hashtags          text[] DEFAULT '{}',
  referenced_places text[] DEFAULT '{}',
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'published', 'rejected')),
  editor_note       text DEFAULT '',
  generated_at      timestamptz DEFAULT now(),
  approved_at       timestamptz,
  published_at      timestamptz,
  created_at        timestamptz DEFAULT now(),

  -- 날짜+지역+시간대 기준 하나의 초안만 존재
  UNIQUE (report_date, region, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_generated_drafts_date
  ON generated_drafts(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_generated_drafts_status
  ON generated_drafts(status);
CREATE INDEX IF NOT EXISTS idx_generated_drafts_region
  ON generated_drafts(region);
CREATE INDEX IF NOT EXISTS idx_generated_drafts_hashtags_gin
  ON generated_drafts USING GIN (hashtags);

ALTER TABLE generated_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_drafts_select_all ON generated_drafts;
CREATE POLICY generated_drafts_select_all
  ON generated_drafts FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS generated_drafts_insert_all ON generated_drafts;
CREATE POLICY generated_drafts_insert_all
  ON generated_drafts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS generated_drafts_update_all ON generated_drafts;
CREATE POLICY generated_drafts_update_all
  ON generated_drafts FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS generated_drafts_delete_all ON generated_drafts;
CREATE POLICY generated_drafts_delete_all
  ON generated_drafts FOR DELETE
  TO anon, authenticated
  USING (true);
