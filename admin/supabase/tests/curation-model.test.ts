/**
 * 018/019 큐레이션 모델 마이그레이션 검증 (개발 DB: PGlite)
 * 운영 DB에는 접속하지 않는다.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { TAXONOMY } from '../../../project/src/utils/taxonomy';
import {
  ROLLBACK,
  MIGRATION_019,
  applyCurationMigrations,
  count,
  createBaseDb,
  legacyFingerprint,
} from '../dev/curationDb';

const ID = {
  visitedCafe: '00000000-0000-0000-0000-000000000001',
  candidateCafe: '00000000-0000-0000-0000-000000000002',
  addressOnly: '00000000-0000-0000-0000-000000000003',
  weirdCategory: '00000000-0000-0000-0000-000000000004',
  duplicateCafe: '00000000-0000-0000-0000-000000000005',
  gallery: '00000000-0000-0000-0000-0000000000a1',
  untypedExhibit: '00000000-0000-0000-0000-0000000000a2',
};

let db: PGlite;
let before: Record<string, string>;

beforeAll(async () => {
  db = await createBaseDb();
  await db.exec(`
    INSERT INTO locations (id, name, address, region, category_main, category_sub, short_desc, memo, tags,
                           curator_visited, visit_date, kakao_place_id, "imageUrl", price_level) VALUES
      ('${ID.visitedCafe}', '창가 카페', '서울 성동구 성수이로 1', '건대/성수/왕십리', '카페', '카공카페',
        '커피가 진하고 창가 자리가 넓어서 평일 오후에 노트북 하기 편해요.', '가게 뒤 주차장 있음\n분위기: 차분한 · 방문 많음',
        ARRAY['커피 맛집', '주차가능', '주차불가', '뜩재ㅣㄹ'], true, '2026-09-01', '111', 'https://img/1.jpg', 2),
      ('${ID.candidateCafe}', '안 가본 카페', '서울 마포구 와우산로 2', '홍대/합정/마포/연남', '카페', '커피',
        '사진으로 보기엔 빵이 맛있어 보임', NULL, ARRAY['베이커리카페'], false, NULL, '222', NULL, 0),
      ('${ID.addressOnly}', '주소만 있는 곳', '서울 광진구 자양로 3', '건대/성수/왕십리', '라멘', '일식',
        '서울 광진구 자양로 3', '', ARRAY['포장가능'], true, NULL, '333', NULL, NULL),
      ('${ID.weirdCategory}', '이상한 분류', '서울 어딘가 4', '종로/중구', '주거시설', '빌라,주택',
        NULL, NULL, '{}', false, NULL, NULL, NULL, NULL),
      ('${ID.duplicateCafe}', '창가 카페 (중복)', '서울 성동구 성수이로 1', '건대/성수/왕십리', '카페', '커피',
        NULL, NULL, '{}', false, NULL, '111', NULL, NULL);
    INSERT INTO attractions (id, name, address, region, category_main, category_sub, short_desc, tags, curator_visited) VALUES
      ('${ID.gallery}', '동네 미술관', '서울 종로구 삼청로 5', '종로/중구', '전시/문화', '미술관',
        '비 오는 날 조용히 작품 보기 좋아요', ARRAY['실내', '산책'], true),
      ('${ID.untypedExhibit}', '분류 없는 전시', '서울 중구 6', '종로/중구', '전시/문화', NULL, NULL, ARRAY['전시'], false);
    INSERT INTO tags (id, name, type, domain) VALUES ('10000000-0000-0000-0000-000000000001', '작업하기 좋음', 'feature', 'food');
    INSERT INTO location_tags (location_id, tag_id) VALUES ('${ID.visitedCafe}', '10000000-0000-0000-0000-000000000001');
  `);
  before = await legacyFingerprint(db);
  await applyCurationMigrations(db);
});

afterAll(async () => {
  await db.close();
});

const one = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];

describe('기존 데이터 보존', () => {
  it('기존 테이블을 바꾸거나 지우지 않는다', async () => {
    expect(await legacyFingerprint(db)).toEqual(before);
  });

  it('장소 id·카카오 id·사진을 그대로 옮긴다', async () => {
    expect(await count(db, 'SELECT count(*) FROM places')).toBe(7);
    const row = await one<{ kakao_place_id: string; image_url: string; legacy_table: string }>(
      `SELECT kakao_place_id, image_url, legacy_table FROM places WHERE id = '${ID.visitedCafe}'`,
    );
    expect(row).toEqual({ kakao_place_id: '111', image_url: 'https://img/1.jpg', legacy_table: 'locations' });
  });

  it('범위를 벗어난 가격대(0)는 비워 두고 원본은 남긴다', async () => {
    expect(await one(`SELECT price_level FROM places WHERE id = '${ID.candidateCafe}'`)).toEqual({ price_level: null });
  });

  it('원문 메모를 손대지 않고 보존하고, 출처만 분류한다', async () => {
    const notes = (
      await db.query<{ place_id: string; origin: string; raw_text: string; classified_as: string }>(
        'SELECT place_id, origin, raw_text, classified_as FROM source_notes ORDER BY place_id, origin',
      )
    ).rows;
    expect(notes).toContainEqual({
      place_id: ID.visitedCafe,
      origin: 'memo',
      raw_text: '가게 뒤 주차장 있음\n분위기: 차분한 · 방문 많음',
      classified_as: 'auto_generated',
    });
    expect(notes).toContainEqual(expect.objectContaining({ place_id: ID.addressOnly, origin: 'short_desc', classified_as: 'address' }));
    expect(notes.filter((n) => n.place_id === ID.addressOnly && n.origin === 'memo')).toHaveLength(0); // 빈 문자열은 옮기지 않음
  });
});

describe('방문 · 추천', () => {
  it('직접 방문한 곳만 방문 기록이 생기고, 방문일은 아는 경우만', async () => {
    const visits = (await db.query<{ place_id: string; visited_on: string | null; visited_on_precision: string }>(
      `SELECT place_id, to_char(visited_on, 'YYYY-MM-DD') AS visited_on, visited_on_precision FROM visits ORDER BY place_id`,
    )).rows;
    expect(visits.map((v) => v.place_id).sort()).toEqual([ID.visitedCafe, ID.addressOnly, ID.gallery].sort());
    expect(visits.find((v) => v.place_id === ID.visitedCafe)).toMatchObject({ visited_on: '2026-09-01', visited_on_precision: 'day' });
    expect(visits.find((v) => v.place_id === ID.gallery)).toMatchObject({ visited_on: null, visited_on_precision: 'unknown' });
  });

  it('운영자 문장만 추천이 되고, 안 가본 곳의 문장은 draft', async () => {
    const recs = (await db.query<{ place_id: string; status: string }>('SELECT place_id, status FROM recommendations')).rows;
    expect(recs).toContainEqual({ place_id: ID.visitedCafe, status: 'published' });
    expect(recs).toContainEqual({ place_id: ID.candidateCafe, status: 'draft' });
    expect(recs.find((r) => r.place_id === ID.addressOnly)).toBeUndefined();
  });

  it('추천은 같은 장소의 방문을 근거로 연결된다', async () => {
    expect(
      await count(db, `SELECT count(*) FROM recommendation_visits rv JOIN recommendations r ON r.id = rv.recommendation_id
                       WHERE r.place_id = '${ID.visitedCafe}'`),
    ).toBe(1);
  });
});

describe('분류', () => {
  const termsOf = async (placeId: string) =>
    (await db.query<{ slug: string; status: string; source: string }>(
      `SELECT t.slug, pt.status, pt.source FROM place_terms pt JOIN taxonomy_terms t ON t.id = pt.term_id
       WHERE pt.place_id = '${placeId}' ORDER BY t.slug`,
    )).rows;

  it('분류 사전이 화면(project/src/utils/taxonomy.ts)과 같다', async () => {
    const rows = (await db.query<{ kind: string; slug: string; label: string }>('SELECT kind, slug, label FROM taxonomy_terms')).rows;
    expect(rows.map((r) => `${r.kind}:${r.slug}:${r.label}`).sort()).toEqual(
      TAXONOMY.map((t) => `${t.kind}:${t.slug}:${t.label}`).sort(),
    );
  });

  it('운영자가 고른 기존 분류는 confirmed, 태그에서 온 것은 suggested', async () => {
    expect(await termsOf(ID.visitedCafe)).toEqual([
      { slug: 'cafe', status: 'confirmed', source: 'legacy_category' },
      { slug: 'coffee', status: 'suggested', source: 'legacy_tag' },
      { slug: 'work', status: 'suggested', source: 'legacy_tag' }, // location_tags 의 '작업하기 좋음'
    ]);
    expect(await termsOf(ID.gallery)).toEqual([
      { slug: 'gallery', status: 'confirmed', source: 'legacy_category' },
      { slug: 'rainy_day', status: 'suggested', source: 'legacy_tag' },
      { slug: 'walk', status: 'suggested', source: 'legacy_tag' },
    ]);
  });

  it('분류가 애매한 곳은 태그 근거로 제안만 하거나 미분류로 남긴다', async () => {
    expect(await termsOf(ID.untypedExhibit)).toEqual([
      { slug: 'exhibition', status: 'suggested', source: 'legacy_tag' },
      { slug: 'gallery', status: 'suggested', source: 'legacy_tag' },
    ]);
    const untyped = (await db.query<{ id: string }>('SELECT id FROM curation_review_untyped_places')).rows.map((r) => r.id);
    expect(untyped).toEqual([ID.weirdCategory]);
  });

  it('운영자 문장에서 이유·상황을 규칙으로 제안한다 (확정하지 않음)', async () => {
    const rows = (await db.query<{ slug: string; status: string; evidence: string }>(
      `SELECT t.slug, rt.status, rt.evidence FROM recommendation_terms rt
       JOIN taxonomy_terms t ON t.id = rt.term_id JOIN recommendations r ON r.id = rt.recommendation_id
       WHERE r.place_id = '${ID.visitedCafe}' ORDER BY t.slug`,
    )).rows;
    expect(rows).toEqual([
      { slug: 'coffee', status: 'suggested', evidence: '커피' },
      { slug: 'weekday_afternoon', status: 'suggested', evidence: '평일' },
      { slug: 'work', status: 'suggested', evidence: '노트북' },
    ]);
  });

  it('매핑되지 않은 태그는 미분류로 남긴다', async () => {
    const tags = (await db.query<{ tag: string }>('SELECT tag FROM curation_review_unmapped_tags')).rows.map((r) => r.tag);
    expect(tags).toEqual(['뜩재ㅣㄹ']);
  });
});

describe('시설 정보 · 중복', () => {
  it('주차·포장 같은 사실은 시설 정보로, 확인 전 상태와 출처를 남긴다', async () => {
    const facts = (await db.query<{ field: string; status: string; source: string; checked_at: string | null }>(
      `SELECT field, status, source, checked_at FROM place_facts WHERE place_id = '${ID.addressOnly}'`,
    )).rows;
    expect(facts).toEqual([{ field: 'takeout', status: 'unverified', source: 'legacy_tag', checked_at: null }]);
  });

  it('서로 다른 값(주차 가능/불가)은 둘 다 남기고 충돌로 드러낸다', async () => {
    expect(await count(db, `SELECT count(*) FROM curation_review_fact_conflicts WHERE place_id = '${ID.visitedCafe}'`)).toBe(1);
  });

  it('중복으로 보이는 장소를 지우지 않고 검토 목록에 올린다', async () => {
    const dup = await one<{ place_ids: string[] }>(`SELECT place_ids FROM curation_review_duplicates WHERE matched_by = 'kakao_place_id'`);
    expect(dup.place_ids).toEqual([ID.visitedCafe, ID.duplicateCafe]);
    expect(await count(db, 'SELECT count(*) FROM places')).toBe(7);
  });
});

describe('다시 돌리기 · 공개 범위 · 되돌리기', () => {
  it('019를 다시 돌려도 결과가 같다', async () => {
    const tables = ['places', 'source_notes', 'visits', 'recommendations', 'recommendation_visits', 'place_terms', 'recommendation_terms', 'place_facts', 'taxonomy_terms'];
    const snapshot = async () => Promise.all(tables.map((t) => count(db, `SELECT count(*) FROM ${t}`)));
    const first = await snapshot();
    await db.exec(MIGRATION_019);
    expect(await snapshot()).toEqual(first);
  });

  it('anon 에게는 확정된 분류·공개 추천만 보이고 원문 메모는 안 보인다', async () => {
    await db.exec('SET ROLE anon');
    try {
      expect(await count(db, `SELECT count(*) FROM recommendations WHERE status <> 'published'`)).toBe(0);
      expect(await count(db, `SELECT count(*) FROM place_terms WHERE status <> 'confirmed'`)).toBe(0);
      expect(await count(db, 'SELECT count(*) FROM source_notes')).toBe(0);
      await expect(db.query('SELECT * FROM curation_review_duplicates')).rejects.toThrow();
    } finally {
      await db.exec('RESET ROLE');
    }
  });

  it('되돌리기는 새 테이블만 지우고 기존 데이터는 그대로 둔다', async () => {
    await db.exec(ROLLBACK);
    expect(await legacyFingerprint(db)).toEqual(before);
    expect(await count(db, `SELECT count(*) FROM information_schema.tables WHERE table_name = 'places'`)).toBe(0);
  });
});
