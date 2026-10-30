/**
 * 개발용 DB 준비: PGlite(메모리 PostgreSQL)에 기존 테이블을 재현하고 018/019를 적용한다.
 * 테스트(supabase/tests)와 드라이런 스크립트(scripts/curation-dryrun.ts)가 같이 쓴다.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';

const SUPABASE_DIR = path.resolve(__dirname, '..');
const read = (relative: string) => readFileSync(path.join(SUPABASE_DIR, relative), 'utf8');

export const BASE_SCHEMA = read('dev/base_schema.sql');
export const MIGRATION_018 = read('migrations/018_curation_model.sql');
export const MIGRATION_019 = read('migrations/019_backfill_curation_model.sql');
export const ROLLBACK = read('rollback/018_019_curation_model_down.sql');
export const PROD_RLS_STATE = read('dev/prod_rls_state.sql');
export const MIGRATION_020 = read('migrations/020_rls_hardening.sql');
export const ROLLBACK_020 = read('rollback/020_rls_hardening_down.sql');
export const MIGRATION_021 = read('migrations/021_intake_and_photos.sql');
export const ROLLBACK_021 = read('rollback/021_intake_and_photos_down.sql');
export const MIGRATION_022 = read('migrations/022_curation_source_of_truth.sql');
export const ROLLBACK_022 = read('rollback/022_curation_source_of_truth_down.sql');
export const MIGRATION_023 = read('migrations/023_business_status_and_hidden.sql');
export const ROLLBACK_023 = read('rollback/023_business_status_and_hidden_down.sql');
export const MIGRATION_024 = read('migrations/024_user_place_states_session_rls.sql');
export const ROLLBACK_024 = read('rollback/024_user_place_states_session_rls_down.sql');
export const MIGRATION_025 = read('migrations/025_fact_conflicts_ignore_outdated.sql');
export const MIGRATION_026 = read('migrations/026_search_views_from_curation.sql');
export const ROLLBACK_026 = read('rollback/026_search_views_from_curation_down.sql');
export const MIGRATION_027 = read('migrations/027_intake_link_by_kakao_id.sql');
export const ROLLBACK_027 = read('rollback/027_intake_link_by_kakao_id_down.sql');

export async function createBaseDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  return db;
}

export async function applyCurationMigrations(db: PGlite): Promise<void> {
  await db.exec(MIGRATION_018);
  await db.exec(MIGRATION_019);
}

/** 기존 테이블 내용의 지문. 마이그레이션 전후가 같아야 한다 (덮어쓰기·삭제 없음) */
export async function legacyFingerprint(db: PGlite): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of ['locations', 'attractions', 'tags', 'location_tags', 'attraction_tags']) {
    const { rows } = await db.query<{ hash: string | null; n: number }>(
      `SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) AS hash, count(*)::int AS n FROM ${table} t`,
    );
    result[table] = `${rows[0].n}:${rows[0].hash}`;
  }
  return result;
}

export async function count(db: PGlite, sql: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`SELECT (${sql})::int AS n`);
  return rows[0].n;
}
