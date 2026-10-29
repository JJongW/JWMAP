/**
 * 023 영업 상태 · 숨긴 장소 거르기 · 수집 중복 방지 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_021,
  MIGRATION_022,
  MIGRATION_023,
  MIGRATION_025,
  PROD_RLS_STATE,
  ROLLBACK_023,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const OPEN = '00000000-0000-0000-0000-000000000001';
const CLOSED = '00000000-0000-0000-0000-000000000002';
const LATE = '00000000-0000-0000-0000-000000000003';
const SPOT = '00000000-0000-0000-0000-0000000000a1';
let db: PGlite;

async function anon<T>(run: () => Promise<T>) {
  await db.exec('SET ROLE anon');
  try {
    return await run();
  } finally {
    await db.exec('RESET ROLE');
  }
}

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`
    INSERT INTO locations (id, name, region, price_level) VALUES
      ('${OPEN}', '영업 중', '건대/성수/왕십리', 0), ('${CLOSED}', '폐업한 곳', '건대/성수/왕십리', 2);
    INSERT INTO attractions (id, name, region) VALUES ('${SPOT}', '작은 미술관', '종로/중구');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  await db.exec(MIGRATION_021);
  await db.exec(MIGRATION_022);
  // 019 이후 예전 입력폼으로 들어온 행 (places에 없음)
  await db.exec(`INSERT INTO locations (id, name, region, price_level) VALUES ('${LATE}', '나중에 들어온 곳', '강남', 0)`);
  await db.exec(MIGRATION_023);
});

afterAll(async () => {
  await db.close();
});

describe('023', () => {
  it('places에 없던 예전 행을 채우고, 예전 행 값은 바꾸지 않는다', async () => {
    expect(await count(db, `SELECT count(*) FROM places WHERE id = '${LATE}'`)).toBe(1);
    expect(await count(db, `SELECT price_level FROM locations WHERE id = '${LATE}'`)).toBe(0);
  });

  it('검색 뷰에 content_type이 있고, 숨긴 장소는 사이트에서 빠진다', async () => {
    await db.exec(`UPDATE places SET visit_status = 'hidden', business_status = 'closed' WHERE id = '${CLOSED}'`);
    await anon(async () => {
      expect(await count(db, `SELECT count(*) FROM locations_search WHERE content_type = 'food'`)).toBe(2);
      expect(await count(db, `SELECT count(*) FROM locations_search WHERE id = '${CLOSED}'`)).toBe(0);
      expect(await count(db, `SELECT count(*) FROM attractions_search`)).toBe(1);
    });
    // 행은 지우지 않는다
    expect(await count(db, `SELECT count(*) FROM locations WHERE id = '${CLOSED}'`)).toBe(1);
  });

  it('다시 숨김을 풀면 돌아온다', async () => {
    await db.exec(`UPDATE places SET visit_status = 'candidate' WHERE id = '${CLOSED}'`);
    await anon(async () => {
      expect(await count(db, `SELECT count(*) FROM locations_search WHERE id = '${CLOSED}'`)).toBe(1);
    });
  });

  it('같은 리뷰·같은 사진 주소는 한 번만', async () => {
    const review = `INSERT INTO external_reviews (place_id, source, external_id, excerpt) VALUES ('${OPEN}', 'kakao', '16866885', '맛있어요')
                    ON CONFLICT (source, external_id) DO NOTHING`;
    await db.exec(review);
    await db.exec(review);
    expect(await count(db, 'SELECT count(*) FROM external_reviews')).toBe(1);
    await db.exec(`INSERT INTO place_photos (place_id, source, url) VALUES ('${OPEN}', 'official', 'https://t1.kakaocdn.net/a')`);
    await expect(db.query(`INSERT INTO place_photos (place_id, source, url) VALUES ('${OPEN}', 'official', 'https://t1.kakaocdn.net/a')`)).rejects.toThrow();
  });

  it('025: 지난 정보로 표시한 값은 정보 충돌에서 빠진다', async () => {
    await db.exec(MIGRATION_025);
    await db.exec(`INSERT INTO place_facts (place_id, field, value, source) VALUES
                     ('${OPEN}', 'parking', '{"available": true}', 'legacy_tag'),
                     ('${OPEN}', 'parking', '{"available": false}', 'operator')`);
    expect(await count(db, 'SELECT count(*) FROM curation_review_fact_conflicts')).toBe(1);
    await db.exec(`UPDATE place_facts SET status = 'outdated' WHERE source = 'legacy_tag' AND field = 'parking'`);
    expect(await count(db, 'SELECT count(*) FROM curation_review_fact_conflicts')).toBe(0);
  });

  it('두 번 적용해도 되고, 되돌리면 숨김 거르기만 없어진다', async () => {
    await db.exec(MIGRATION_023);
    await db.exec(`UPDATE places SET visit_status = 'hidden' WHERE id = '${CLOSED}'`);
    await db.exec(ROLLBACK_023);
    await anon(async () => {
      expect(await count(db, `SELECT count(*) FROM locations_search WHERE id = '${CLOSED}'`)).toBe(1);
    });
  });
});
