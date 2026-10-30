/**
 * 027 검토함 결정이 카카오 ID로 기존 장소에 연결 (개발 DB: PGlite)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MIGRATION_020,
  MIGRATION_021,
  MIGRATION_022,
  MIGRATION_023,
  MIGRATION_027,
  PROD_RLS_STATE,
  ROLLBACK_027,
  applyCurationMigrations,
  count,
  createBaseDb,
} from '../dev/curationDb';

const ADMIN = '00000000-0000-0000-0000-00000000ad01';
const HAVEN = '00000000-0000-0000-0000-000000000001';
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

const intake = (key: string, name: string, kakao: string | null, coords = true) =>
  one<{ id: string }>(`INSERT INTO place_intake (source, source_key, name, region_hint, kakao_place_id, lat, lon, raw)
    VALUES ('odiga_vault', '${key}', '${name}', '강북구 · 미아', ${kakao ? `'${kakao}'` : 'NULL'},
            ${coords ? '37.61, 127.03' : 'NULL, NULL'}, '{"first_taken_at": "2025-10-11T12:00:00+09:00"}') RETURNING id`);

const decide = (id: string) =>
  asAdmin(async () => (await one<{ pid: string }>(`SELECT admin_decide_intake('${id}', 'visited') AS pid`)).pid);

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(PROD_RLS_STATE);
  await db.exec(`
    INSERT INTO locations (id, name, region, kakao_place_id) VALUES ('${HAVEN}', '브라운헤이븐 미아', '노원/도봉/강북', '1927901650.0');
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'operator@example.com');
  `);
  await applyCurationMigrations(db);
  await db.exec(MIGRATION_020);
  await db.exec(MIGRATION_021);
  await db.exec(MIGRATION_022);
  await db.exec(MIGRATION_023);
  await db.exec(MIGRATION_027);
});

afterAll(async () => {
  await db.close();
});

describe('027', () => {
  it('이름이 달라도 카카오 ID가 같으면 기존 장소에 방문이 붙는다', async () => {
    const { id } = await intake('서울/강북구/미아 - 브라운헤이브', '브라운헤이브', '1927901650');
    expect(await decide(id)).toBe(HAVEN);
    expect(await count(db, `SELECT count(*) FROM places WHERE name LIKE '브라운%'`)).toBe(1);
    expect(await count(db, `SELECT count(*) FROM visits WHERE place_id = '${HAVEN}' AND source = 'odiga_vault'`)).toBe(1);
    expect((await one<{ m: string }>(`SELECT matched_place_id AS m FROM place_intake WHERE id = '${id}'`)).m).toBe(HAVEN);
  });

  it('같은 가게가 두 폴더에 있어도 장소는 하나', async () => {
    const a = await intake('서울/마포구/연희 - 텀어스 연희', '텀어스 연희', '555');
    const b = await intake('서울/서대문구/연희 - 텀어스', '텀어스', '555');
    const pa = await decide(a.id);
    expect(await decide(b.id)).toBe(pa);
    expect(await count(db, `SELECT count(*) FROM places WHERE kakao_place_id = '555'`)).toBe(1);
  });

  it('숨긴 장소에는 연결하지 않는다', async () => {
    await db.exec(`UPDATE places SET visit_status = 'hidden' WHERE kakao_place_id = '555'`);
    const c = await intake('서울/마포구/연희 - 텀어스 2', '텀어스', '555');
    const pc = await decide(c.id);
    expect((await one<{ visit_status: string }>(`SELECT visit_status FROM places WHERE id = '${pc}'`)).visit_status).toBe('visited');
  });

  it('좌표 없는 새 장소는 알아보기 쉬운 오류를 낸다', async () => {
    const { id } = await intake('서울/용산구/남영 - 키보에다마메', '키보에다마메', null, false);
    await expect(decide(id)).rejects.toThrow(/좌표가 없어/);
    expect((await one<{ status: string }>(`SELECT status FROM place_intake WHERE id = '${id}'`)).status).toBe('pending');
  });

  it('되돌리면 022 함수로 돌아간다', async () => {
    await db.exec(ROLLBACK_027);
    const { id } = await intake('서울/강북구/미아 - 브라운헤이브 2', '브라운헤이브', '1927901650');
    expect(await decide(id)).not.toBe(HAVEN);
  });
});
