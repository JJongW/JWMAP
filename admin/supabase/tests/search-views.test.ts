/**
 * 026 사이트 검색 뷰의 추천하는 이유 = 공개 추천 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_021,
  MIGRATION_022,
  MIGRATION_023,
  MIGRATION_026,
  PROD_RLS_STATE,
  ROLLBACK_026,
  applyCurationMigrations,
  createBaseDb,
} from '../dev/curationDb';

const VISITED = '00000000-0000-0000-0000-000000000001';
const CANDIDATE = '00000000-0000-0000-0000-000000000002';
const WISH = '00000000-0000-0000-0000-000000000003';
const SPOT = '00000000-0000-0000-0000-0000000000a1';
let db: PGlite;

const anonRow = async (view: string, id: string) => {
  await db.exec('SET ROLE anon');
  try {
    return (await db.query<{ short_desc: string | null; recommend_basis: string | null }>(
      `SELECT short_desc, recommend_basis FROM ${view} WHERE id = '${id}'`,
    )).rows[0];
  } finally {
    await db.exec('RESET ROLE');
  }
};

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`
    INSERT INTO locations (id, name, region, curator_visited, short_desc) VALUES
      ('${VISITED}', '가본 카페', '강남', true, '예전 한줄 설명'),
      ('${CANDIDATE}', '안 가본 카페', '강남', false, '사진으로 보기엔 맛있어 보임'),
      ('${WISH}', '추천받은 카페', '강남', false, NULL);
    INSERT INTO attractions (id, name, region, curator_visited, short_desc) VALUES ('${SPOT}', '미술관', '종로', true, '조용해요');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  await db.exec(MIGRATION_021);
  await db.exec(MIGRATION_022);
  await db.exec(MIGRATION_023);
  await db.exec(`INSERT INTO recommendations (place_id, body, status, source, basis, published_at)
                 VALUES ('${WISH}', '친구가 크루아상이 맛있대요', 'published', 'operator', 'friend', now())`);
  await db.exec(MIGRATION_026);
});

afterAll(async () => {
  await db.close();
});

describe('026', () => {
  it('공개 추천이 있으면 그 문장과 근거', async () => {
    expect(await anonRow('locations_search', WISH)).toEqual({ short_desc: '친구가 크루아상이 맛있대요', recommend_basis: 'friend' });
  });

  it('공개 추천이 없으면 가본 곳만 예전 한줄 설명', async () => {
    expect((await anonRow('locations_search', VISITED)).short_desc).toBe('예전 한줄 설명');
    expect((await anonRow('locations_search', CANDIDATE)).short_desc).toBeNull();
    expect((await anonRow('attractions_search', SPOT)).short_desc).toBe('조용해요');
  });

  it('예전 테이블 값은 그대로', async () => {
    expect((await db.query<{ short_desc: string }>(`SELECT short_desc FROM locations WHERE id = '${CANDIDATE}'`)).rows[0].short_desc)
      .toBe('사진으로 보기엔 맛있어 보임');
  });

  it('숨긴 장소는 빠지고, 다시 적용·되돌리기가 된다', async () => {
    await db.exec(`UPDATE places SET visit_status = 'hidden' WHERE id = '${VISITED}'`);
    expect(await anonRow('locations_search', VISITED)).toBeUndefined();
    await db.exec(MIGRATION_026);
    await db.exec(ROLLBACK_026);
    const { rows } = await db.query<{ short_desc: string }>(`SELECT short_desc FROM locations_search WHERE id = '${CANDIDATE}'`);
    expect(rows[0].short_desc).toBe('사진으로 보기엔 맛있어 보임');
  });
});
