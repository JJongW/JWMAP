/**
 * 020 RLS 정리 검증 (개발 DB: PGlite, 운영 RLS 상태를 재현)
 * 운영 DB에는 접속하지 않는다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  PROD_RLS_STATE,
  ROLLBACK_020,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const ADMIN = '00000000-0000-0000-0000-00000000ad01';
const STRANGER = '00000000-0000-0000-0000-00000000ad02';
const PLACE = '00000000-0000-0000-0000-000000000001';
const SPOT = '00000000-0000-0000-0000-0000000000a1';

let db: PGlite;

async function as<T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, run: () => Promise<T>) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId ?? ''}', false); SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

const rows = async (sql: string) => (await db.query(sql)).rows.length;
const affected = async (sql: string) => (await db.query(sql)).affectedRows ?? 0;

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`
    INSERT INTO locations (id, name, region, category_main) VALUES ('${PLACE}', '창가 카페', '건대/성수/왕십리', '카페');
    INSERT INTO attractions (id, name, region, category_main) VALUES ('${SPOT}', '작은 미술관', '종로/중구', '전시');
    INSERT INTO location_stats (location_id, popularity_score) VALUES ('${PLACE}', 3);
    INSERT INTO reviews (location_id, one_liner) VALUES ('${PLACE}', '창가가 좋아요');
    INSERT INTO search_logs (query, created_at) VALUES ('오래된 검색', now() - interval '2 hours');
    INSERT INTO daily_checklist (task_type, date) VALUES ('collect', '2026-10-29');
    INSERT INTO weekly_checklist (task_type, week_start) VALUES ('review', '2026-10-26');
    INSERT INTO generated_drafts (caption) VALUES ('초안');
    INSERT INTO task_approvals (approved_by) VALUES ('operator');
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'operator@example.com');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  // 020 적용 뒤 가입한 계정은 admin이 아니다
  await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${STRANGER}', 'stranger@example.com')`);
});

afterAll(async () => {
  await db.close();
});

describe('020 적용 전 운영 상태 (재현 확인)', () => {
  it('기존 상태에서는 anon이 볼거리를 지울 수 있었다', async () => {
    const fresh = await createBaseDb();
    await fresh.exec(PROD_RLS_STATE);
    await fresh.exec(`INSERT INTO attractions (id, name) VALUES ('${SPOT}', '작은 미술관'); SET ROLE anon`);
    expect((await fresh.query('DELETE FROM attractions')).affectedRows).toBe(1);
    await fresh.close();
  });
});

describe('사이트(anon)', () => {
  it('장소·볼거리·검색 뷰·리뷰·태그를 읽는다', () =>
    as('anon', null, async () => {
      expect(await rows('SELECT * FROM locations')).toBe(1);
      expect(await rows('SELECT * FROM attractions')).toBe(1);
      expect(await rows('SELECT * FROM locations_search WHERE popularity_score = 3')).toBe(1);
      expect(await rows('SELECT * FROM attractions_search')).toBe(1);
      expect(await rows('SELECT * FROM reviews')).toBe(1);
      expect(await rows('SELECT * FROM tags')).toBe(0);
      expect(await rows('SELECT * FROM places')).toBeGreaterThanOrEqual(0);
    }));

  it('리뷰·클릭 로그·검색 로그를 남기고, 방금 검색에 클릭을 덧붙인다', () =>
    as('anon', null, async () => {
      await db.exec(`INSERT INTO reviews (location_id, one_liner) VALUES ('${PLACE}', '또 갈래요')`);
      await db.exec(`INSERT INTO click_logs (location_id, action_type) VALUES ('${PLACE}', 'detail')`);
      const { rows: inserted } = await db.query<{ id: string }>(
        `INSERT INTO search_logs (query, parsed) VALUES ('성수 카페', NULL) RETURNING id`,
      );
      const id = inserted[0].id;
      expect(await affected(`UPDATE search_logs SET clicked_place_id = '${PLACE}', clicked_rank = 1 WHERE id = '${id}'`)).toBe(1);
      expect(await affected(`UPDATE search_logs SET opened_map = true, map_provider = 'kakao' WHERE id = '${id}'`)).toBe(1);
      await db.exec(`SELECT touch_location_activity('${PLACE}')`);
    }));

  it('장소를 추가·수정·삭제하지 못한다', () =>
    as('anon', null, async () => {
      await expect(db.query(`INSERT INTO locations (name) VALUES ('몰래 추가')`)).rejects.toThrow();
      await expect(db.query(`INSERT INTO attractions (name) VALUES ('몰래 추가')`)).rejects.toThrow();
      expect(await affected(`UPDATE locations SET name = '바뀜'`)).toBe(0);
      expect(await affected('DELETE FROM attractions')).toBe(0);
      expect(await affected('DELETE FROM reviews')).toBe(0);
    }));

  it('운영 데이터와 남의 검색 기록은 못 본다', () =>
    as('anon', null, async () => {
      for (const table of ['daily_checklist', 'weekly_checklist', 'generated_drafts', 'task_approvals', 'agent_tasks', 'click_logs',
                           'odiga_saved_courses', 'odiga_search_logs', 'raw_sns_posts', 'place_candidates']) {
        expect(await rows(`SELECT * FROM ${table}`), table).toBe(0);
      }
      expect(await rows(`SELECT * FROM search_logs WHERE query = '오래된 검색'`)).toBe(0);
      expect(await affected(`UPDATE search_logs SET clicked_rank = 9 WHERE query = '오래된 검색'`)).toBe(0);
    }));

  it('검색 로그의 LLM 결과나 클릭 외 칸은 쓰지 못한다', () =>
    as('anon', null, async () => {
      await expect(db.query(`INSERT INTO search_logs (query, parsed) VALUES ('x', '{"fake":true}')`)).rejects.toThrow();
      await expect(db.query(`UPDATE search_logs SET query = '바뀜'`)).rejects.toThrow();
    }));
});

describe('로그인 계정', () => {
  it('admin은 장소·태그·운영 데이터를 읽고 쓴다', () =>
    as('authenticated', ADMIN, async () => {
      expect(await affected(`UPDATE locations SET short_desc = '창가 자리' WHERE id = '${PLACE}'`)).toBe(1);
      await db.exec(`INSERT INTO tags (name) VALUES ('카공')`);
      await db.exec(`INSERT INTO odiga_saved_courses (course) VALUES ('{}')`);
      expect(await affected(`UPDATE daily_checklist SET done = true`)).toBe(1);
      expect(await affected(`UPDATE weekly_checklist SET completed = true`)).toBe(1);
      expect(await rows('SELECT * FROM generated_drafts')).toBe(1);
      expect(await rows(`SELECT * FROM search_logs WHERE query = '오래된 검색'`)).toBe(1);
      expect(await affected(`DELETE FROM reviews WHERE one_liner = '또 갈래요'`)).toBe(1);
    }));

  it('020 뒤 가입한 계정은 읽기만 된다', () =>
    as('authenticated', STRANGER, async () => {
      expect(await rows('SELECT * FROM locations')).toBe(1);
      expect(await affected('DELETE FROM attractions')).toBe(0);
      expect(await rows('SELECT * FROM daily_checklist')).toBe(0);
      await expect(db.query(`INSERT INTO tags (name) VALUES ('몰래')`)).rejects.toThrow();
    }));

  it('엔진 테이블은 service role만 다룬다', async () => {
    await as('authenticated', ADMIN, async () => {
      expect(await rows('SELECT * FROM task_approvals')).toBe(0);
    });
    await as('service_role', null, async () => {
      expect(await rows('SELECT * FROM task_approvals')).toBe(1);
    });
  });
});

describe('정리 상태 · 다시 적용 · 되돌리기', () => {
  it('public 테이블 중 RLS가 꺼진 것이 없고 쓰기 정책에 USING true가 없다', async () => {
    expect(await count(db, `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                            WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`)).toBe(0);
    expect(await count(db, `SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
                              AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                              AND tablename <> 'user_place_states'
                              AND (qual = 'true' OR with_check = 'true')`)).toBe(0);
  });

  it('두 번 적용해도 정책이 같다', async () => {
    const snapshot = async () =>
      (await db.query(`SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
                       WHERE schemaname = 'public' ORDER BY 1, 2`)).rows;
    const first = await snapshot();
    await db.exec(MIGRATION_020);
    expect(await snapshot()).toEqual(first);
  });

  it('되돌리면 이전 RLS 상태와 정책으로 돌아간다', async () => {
    await db.exec(ROLLBACK_020);
    expect(await count(db, `SELECT count(*) FROM pg_class WHERE relname = 'locations' AND relrowsecurity`)).toBe(0);
    expect(await count(db, `SELECT count(*) FROM pg_policies WHERE policyname = 'attractions_delete_all'`)).toBe(1);
    await as('anon', null, async () => {
      expect(await rows('SELECT * FROM daily_checklist')).toBe(1);
    });
  });
});
