/**
 * 024 user_place_states 세션별 RLS (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { MIGRATION_024, PROD_RLS_STATE, ROLLBACK_024, count, createBaseDb } from '../dev/curationDb';

const PLACE = '00000000-0000-0000-0000-000000000001';
let db: PGlite;

async function asSession<T>(session: string | null, run: () => Promise<T>) {
  const headers = session ? JSON.stringify({ 'x-oomap-session': session }) : '{}';
  await db.exec(`SELECT set_config('request.headers', '${headers}', false); SET ROLE anon`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.headers', '{}', false)`);
  }
}

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`INSERT INTO user_place_states (session_id, location_id, content_type, is_saved)
                 VALUES ('a-session', '${PLACE}', 'food', true), ('b-session', '${PLACE}', 'food', true)`);
  await db.exec(MIGRATION_024);
});

afterAll(async () => {
  await db.close();
});

describe('024', () => {
  it('자기 세션 행만 보인다', () =>
    asSession('a-session', async () => {
      expect(await count(db, 'SELECT count(*) FROM user_place_states')).toBe(1);
    }));

  it('헤더가 없으면 아무것도 안 보인다', () =>
    asSession(null, async () => {
      expect(await count(db, 'SELECT count(*) FROM user_place_states')).toBe(0);
    }));

  it('자기 세션으로만 넣고 고칠 수 있다', () =>
    asSession('a-session', async () => {
      await db.exec(`INSERT INTO user_place_states (session_id, location_id, content_type, is_saved)
                     VALUES ('a-session', '${PLACE}', 'space', true)`);
      await expect(db.query(`INSERT INTO user_place_states (session_id, location_id, content_type)
                             VALUES ('b-session', '${PLACE}', 'space')`)).rejects.toThrow();
      expect((await db.query(`UPDATE user_place_states SET is_saved = false WHERE session_id = 'b-session'`)).affectedRows).toBe(0);
      expect((await db.query(`UPDATE user_place_states SET is_visited = true`)).affectedRows).toBe(2);
    }));

  it('되돌리면 예전처럼 다 보인다', async () => {
    await db.exec(ROLLBACK_024);
    await asSession(null, async () => {
      expect(await count(db, 'SELECT count(*) FROM user_place_states')).toBe(3);
    });
  });
});
