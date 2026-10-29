/**
 * 022 새 테이블 기준 + 예전 테이블로 옮겨 쓰기 + 검토함 결정 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_021,
  MIGRATION_022,
  PROD_RLS_STATE,
  ROLLBACK_022,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const ADMIN = '00000000-0000-0000-0000-00000000ad01';
const CAFE = '00000000-0000-0000-0000-000000000001';
const SPOT = '00000000-0000-0000-0000-0000000000a1';
let db: PGlite;

const one = async <T = Record<string, unknown>>(sql: string) => (await db.query<T>(sql)).rows[0];

async function asAdmin<T>(run: () => Promise<T>) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${ADMIN}', false); SET ROLE authenticated`);
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
    INSERT INTO locations (id, name, region, category_main, category_sub, curation_level, curator_visited, short_desc, "imageUrl")
      VALUES ('${CAFE}', '르프리크', '건대/성수/왕십리', '카페', '디저트카페', 3, false, '사진으로 보기엔 빵이 맛있어 보임', NULL);
    INSERT INTO attractions (id, name, region, category_main, curation_level)
      VALUES ('${SPOT}', '작은 미술관', '종로/중구', '전시', 2);
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'operator@example.com');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  await db.exec(MIGRATION_021);
  await db.exec(MIGRATION_022);
});

afterAll(async () => {
  await db.close();
});

describe('기존 값 복사', () => {
  it('카테고리·추천 강도를 places로 가져온다', async () => {
    expect(await one(`SELECT category_main, category_sub, curation_level FROM places WHERE id = '${CAFE}'`))
      .toEqual({ category_main: '카페', category_sub: '디저트카페', curation_level: 3 });
    expect((await one<{ curation_level: number }>(`SELECT curation_level FROM places WHERE id = '${SPOT}'`)).curation_level).toBe(2);
  });
});

describe('admin이 새 테이블에 쓰면 사이트가 읽는 예전 테이블도 바뀐다', () => {
  it('장소 정보', () =>
    asAdmin(async () => {
      await db.exec(`UPDATE places SET name = '르프리크 성수', curation_level = 4 WHERE id = '${CAFE}'`);
      expect(await one(`SELECT name, curation_level FROM locations WHERE id = '${CAFE}'`))
        .toEqual({ name: '르프리크 성수', curation_level: 4 });
    }));

  it('방문 기록 → 가봤음 + 방문일', () =>
    asAdmin(async () => {
      await db.exec(`INSERT INTO visits (place_id, visited_on, visited_on_precision, source)
                     VALUES ('${CAFE}', '2025-07-27', 'day', 'operator')`);
      expect((await one<{ visit_status: string }>(`SELECT visit_status FROM places WHERE id = '${CAFE}'`)).visit_status).toBe('visited');
      expect(await one(`SELECT curator_visited, visit_date::text AS visit_date FROM locations WHERE id = '${CAFE}'`))
        .toEqual({ curator_visited: true, visit_date: '2025-07-27' });
    }));

  it('추천 문장 공개 → short_desc, 내리면 그 문장만 비운다', () =>
    asAdmin(async () => {
      const { id } = await one<{ id: string }>(`INSERT INTO recommendations (place_id, body, status, source, published_at)
        VALUES ('${CAFE}', '크루아상 결이 살아 있고 창가 자리가 밝아요.', 'published', 'operator', now()) RETURNING id`);
      expect((await one<{ short_desc: string }>(`SELECT short_desc FROM locations WHERE id = '${CAFE}'`)).short_desc)
        .toBe('크루아상 결이 살아 있고 창가 자리가 밝아요.');
      await db.exec(`UPDATE recommendations SET status = 'hidden' WHERE id = '${id}'`);
      expect((await one<{ short_desc: string | null }>(`SELECT short_desc FROM locations WHERE id = '${CAFE}'`)).short_desc).toBeNull();
    }));

  it('대표 사진 고르기 → imageUrl', () =>
    asAdmin(async () => {
      await db.exec(`INSERT INTO place_photos (place_id, source, url, status, is_cover)
                     VALUES ('${CAFE}', 'own', 'https://res.cloudinary.com/x/oomap/1.jpg', 'selected', true)`);
      expect((await one<{ imageUrl: string }>(`SELECT "imageUrl" FROM locations WHERE id = '${CAFE}'`)).imageUrl)
        .toBe('https://res.cloudinary.com/x/oomap/1.jpg');
    }));

  it('볼거리는 attractions로 간다', () =>
    asAdmin(async () => {
      await db.exec(`UPDATE places SET visit_status = 'visited' WHERE id = '${SPOT}'`);
      expect((await one<{ curator_visited: boolean }>(`SELECT curator_visited FROM attractions WHERE id = '${SPOT}'`)).curator_visited).toBe(true);
    }));
});

describe('확인 필요 화면', () => {
  it('admin은 019 검토 뷰를 읽고, 사이트(anon)는 못 읽는다', async () => {
    await asAdmin(async () => {
      await db.query('SELECT * FROM curation_review_duplicates');
      await db.query('SELECT * FROM curation_review_untyped_places');
      await db.query('SELECT * FROM curation_review_unmapped_tags');
    });
    await db.exec('SET ROLE anon');
    try {
      await expect(db.query('SELECT * FROM curation_review_duplicates')).rejects.toThrow();
    } finally {
      await db.exec('RESET ROLE');
    }
  });
});

describe('검토함 결정', () => {
  const intake = (key: string, name: string, extra = '') =>
    one<{ id: string }>(`INSERT INTO place_intake (source, source_key, name, region_hint, category_hint, raw${extra ? ', matched_place_id' : ''})
      VALUES ('odiga_vault', '${key}', '${name}', '관악구 · 봉천', '작업카페',
              '{"first_taken_at": "2025-03-16T14:44:35+09:00"}'${extra ? `, '${extra}'` : ''}) RETURNING id`);

  it('새 장소를 가봤음으로 정하면 장소·방문·사진 연결·사이트용 행이 생긴다', async () => {
    const { id } = await intake('서울/관악구/봉천 - 작업카페 - 스패즈', '스패즈');
    await db.exec(`INSERT INTO place_photos (intake_id, source, local_path) VALUES ('${id}', 'own', '/odiga/스패즈/1.jpg')`);
    const pid = await asAdmin(async () =>
      (await one<{ pid: string }>(`SELECT admin_decide_intake('${id}', 'visited') AS pid`)).pid);
    expect(await one(`SELECT name, visit_status, legacy_table FROM places WHERE id = '${pid}'`))
      .toEqual({ name: '스패즈', visit_status: 'visited', legacy_table: 'locations' });
    expect(await one(`SELECT curator_visited, visit_date::text AS visit_date FROM locations WHERE id = '${pid}'`))
      .toEqual({ curator_visited: true, visit_date: '2025-03-16' });
    expect(await count(db, `SELECT count(*) FROM place_photos WHERE place_id = '${pid}'`)).toBe(1);
    expect((await one<{ status: string }>(`SELECT status FROM place_intake WHERE id = '${id}'`)).status).toBe('visited');

    // 다시 결정해도 방문이 늘지 않는다
    await asAdmin(() => db.query(`SELECT admin_decide_intake('${id}', 'visited')`));
    expect(await count(db, `SELECT count(*) FROM visits WHERE place_id = '${pid}'`)).toBe(1);
  });

  it('이미 있는 장소에 연결하면 새로 만들지 않는다', async () => {
    const before = await count(db, 'SELECT count(*) FROM places');
    const { id } = await intake('서울/성동구/성수 - 르프리크', '르프리크', CAFE);
    const pid = await asAdmin(async () =>
      (await one<{ pid: string }>(`SELECT admin_decide_intake('${id}', 'visited') AS pid`)).pid);
    expect(pid).toBe(CAFE);
    expect(await count(db, 'SELECT count(*) FROM places')).toBe(before);
  });

  it('안 가봤지만 추천: 후보로 두고 근거를 남긴다', async () => {
    const { id } = await intake('kakao/123', '가보고 싶은 카페');
    const pid = await asAdmin(async () =>
      (await one<{ pid: string }>(`SELECT admin_decide_intake('${id}', 'recommend_unvisited', NULL, 'locations', '지인 추천') AS pid`)).pid);
    expect((await one<{ visit_status: string }>(`SELECT visit_status FROM places WHERE id = '${pid}'`)).visit_status).toBe('candidate');
    expect(await count(db, `SELECT count(*) FROM visits WHERE place_id = '${pid}'`)).toBe(0);
    expect((await one<{ unvisited_basis: string }>(`SELECT unvisited_basis FROM place_intake WHERE id = '${id}'`)).unvisited_basis).toBe('지인 추천');
  });

  it('제외는 장소를 만들지 않는다', async () => {
    const before = await count(db, 'SELECT count(*) FROM places');
    const { id } = await intake('kakao/999', '안 갈 곳');
    await asAdmin(() => db.query(`SELECT admin_decide_intake('${id}', 'excluded')`));
    expect(await count(db, 'SELECT count(*) FROM places')).toBe(before);
  });

  it('사이트(anon)는 결정 함수를 못 쓴다', async () => {
    const { id } = await intake('kakao/555', '몰래');
    await db.exec('SET ROLE anon');
    try {
      await expect(db.query(`SELECT admin_decide_intake('${id}', 'visited')`)).rejects.toThrow();
    } finally {
      await db.exec('RESET ROLE');
    }
  });
});

describe('다시 적용 · 되돌리기', () => {
  it('두 번 적용해도 값이 그대로다', async () => {
    const snap = async () => (await db.query('SELECT id, name, curation_level, visit_status FROM places ORDER BY id')).rows;
    const first = await snap();
    await db.exec(MIGRATION_022);
    expect(await snap()).toEqual(first);
  });

  it('되돌리면 트리거만 없어지고 데이터는 남는다', async () => {
    await db.exec(ROLLBACK_022);
    await db.exec(`UPDATE places SET name = '바뀐 이름' WHERE id = '${CAFE}'`);
    expect((await one<{ name: string }>(`SELECT name FROM locations WHERE id = '${CAFE}'`)).name).toBe('르프리크 성수');
    expect(await count(db, `SELECT count(*) FROM visits`)).toBeGreaterThan(0);
  });
});
