/**
 * 021 검토함 · 사진 · 수집 리뷰 검증 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_021,
  PROD_RLS_STATE,
  ROLLBACK_021,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const ADMIN = '00000000-0000-0000-0000-00000000ad01';
const PLACE = '00000000-0000-0000-0000-000000000001';
let db: PGlite;

async function as<T>(role: 'anon' | 'authenticated', userId: string | null, run: () => Promise<T>) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId ?? ''}', false); SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`
    INSERT INTO locations (id, name, region, category_main, curator_visited) VALUES ('${PLACE}', '르프리크', '건대/성수/왕십리', '카페', true);
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'operator@example.com');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  await db.exec(MIGRATION_021);
});

afterAll(async () => {
  await db.close();
});

describe('검토함', () => {
  it('같은 출처·키로 다시 수집해도 한 줄로 유지된다', async () => {
    const upsert = `INSERT INTO place_intake (source, source_key, name, suggested_status)
                    VALUES ('odiga_vault', '서울/성동구/성수 - 르프리크', '르프리크', 'visited')
                    ON CONFLICT (source, source_key) DO UPDATE SET name = EXCLUDED.name`;
    await db.exec(upsert);
    await db.exec(upsert);
    expect(await count(db, 'SELECT count(*) FROM place_intake')).toBe(1);
    expect(await count(db, `SELECT count(*) FROM place_intake WHERE status = 'pending'`)).toBe(1);
  });

  it('정해진 상태값만 받는다', async () => {
    await expect(db.query(`UPDATE place_intake SET status = 'maybe'`)).rejects.toThrow();
  });
});

describe('사진', () => {
  it('같은 원본 파일은 한 번만, 대표 사진은 장소당 하나만', async () => {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM place_intake LIMIT 1`);
    await db.exec(`INSERT INTO place_photos (intake_id, place_id, source, local_path, is_cover)
                   VALUES ('${rows[0].id}', '${PLACE}', 'own', '/odiga/르프리크/IMG_1.jpeg', true)`);
    await expect(db.query(`INSERT INTO place_photos (intake_id, source, local_path)
                           VALUES ('${rows[0].id}', 'own', '/odiga/르프리크/IMG_1.jpeg')`)).rejects.toThrow();
    await expect(db.query(`INSERT INTO place_photos (place_id, source, url, is_cover)
                           VALUES ('${PLACE}', 'official', 'https://img/2.jpg', true)`)).rejects.toThrow();
  });

  it('장소나 검토 항목 없이 떠도는 사진은 못 만든다', async () => {
    await expect(db.query(`INSERT INTO place_photos (source, url) VALUES ('web', 'https://img/3.jpg')`)).rejects.toThrow();
  });
});

describe('권한', () => {
  it('사이트는 고른 사진만 보고, 검토함·수집 리뷰는 못 본다', async () => {
    await db.exec(`INSERT INTO place_photos (place_id, source, url, status) VALUES
                     ('${PLACE}', 'own', 'https://img/selected.jpg', 'selected'),
                     ('${PLACE}', 'web', 'https://img/suggested.jpg', 'suggested');
                   INSERT INTO external_reviews (place_id, source, excerpt) VALUES ('${PLACE}', 'kakao', '빵이 맛있어요')`);
    await as('anon', null, async () => {
      expect(await count(db, 'SELECT count(*) FROM place_photos')).toBe(1);
      expect(await count(db, 'SELECT count(*) FROM place_intake')).toBe(0);
      expect(await count(db, 'SELECT count(*) FROM external_reviews')).toBe(0);
      await expect(db.query(`INSERT INTO place_intake (source, source_key, name) VALUES ('manual', 'x', 'x')`)).rejects.toThrow();
    });
  });

  it('admin은 검토 결과를 저장한다', () =>
    as('authenticated', ADMIN, async () => {
      const { affectedRows } = await db.query(
        `UPDATE place_intake SET status = 'visited', decided_at = now(), place_id = '${PLACE}'`,
      );
      expect(affectedRows).toBe(1);
      expect(await count(db, 'SELECT count(*) FROM external_reviews')).toBe(1);
    }));

  it('public 테이블 중 RLS가 꺼진 것이 없다', async () => {
    expect(await count(db, `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                            WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`)).toBe(0);
  });
});

describe('다시 적용 · 되돌리기', () => {
  it('두 번 적용해도 오류 없이 데이터가 그대로다', async () => {
    const before = await count(db, 'SELECT count(*) FROM place_photos');
    await db.exec(MIGRATION_021);
    expect(await count(db, 'SELECT count(*) FROM place_photos')).toBe(before);
  });

  it('되돌리면 새 테이블만 지운다', async () => {
    await db.exec(ROLLBACK_021);
    expect(await count(db, `SELECT count(*) FROM information_schema.tables WHERE table_name = 'place_intake'`)).toBe(0);
    expect(await count(db, 'SELECT count(*) FROM places')).toBeGreaterThan(0);
  });
});
