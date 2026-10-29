#!/usr/bin/env node
/**
 * 카카오 장소 상태 점검 (로그인 불필요, 읽기만)
 *
 *   node scripts/kakao-place-check.mjs                 # DB의 모든 장소 점검 → docs/db-overhaul/kakao-place-check.json
 *   node scripts/kakao-place-check.mjs --limit 50      # 일부만
 *   node scripts/kakao-place-check.mjs --ids 123,456   # 카카오 ID 목록만 (저장 목록 수집 결과 확인용)
 *
 * 장소마다
 *   - 카카오 ID가 있으면 상세(panel3)로 영업 상태·이름·주소·좌표·영업시간·가게 사진·리뷰를 가져온다
 *   - ID가 없으면 이름+좌표로 카카오 검색해서 같은 곳을 찾는다
 * 그리고 DB 값과 비교해 판정한다
 *   ok · closed_suspect(상태≠Y 또는 상세 없음) · moved(150m~50km) · bad_coords(50km 넘음: DB 좌표 오류)
 *   renamed · not_found · id_found(ID 없던 곳) · id_changed(다시 등록됨) · id_cleaned('123.0' 형태 정리)
 * DB에는 쓰지 않는다. 반영은 검토 후 별도로 한다.
 */
import { writeFileSync } from 'fs';
import path from 'path';
import { REPO, checkOne, fetchPlaces, sleep } from './lib/kakao.mjs';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(arg('--limit') ?? 0);
const IDS = arg('--ids')?.split(',').map((s) => s.trim()).filter(Boolean);
const OUT = arg('--out') ?? path.join(REPO, 'docs/db-overhaul/kakao-place-check.json');
const CONCURRENCY = 4;
const PAUSE_MS = 250;

async function main() {
  let places = IDS ? IDS.map((id) => ({ id: null, name: '', kakao_place_id: id, lat: null, lon: null })) : await fetchPlaces();
  if (LIMIT) places = places.slice(0, LIMIT);

  // 같은 카카오 ID를 가진 DB 장소 (중복)
  const byKakao = new Map();
  for (const p of places) if (p.kakao_place_id) byKakao.set(p.kakao_place_id, [...(byKakao.get(p.kakao_place_id) ?? []), p.id]);

  const queue = [...places];
  const results = [];
  let n = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let place = queue.shift(); place; place = queue.shift()) {
        try {
          results.push(await checkOne(place));
        } catch (error) {
          results.push({ ...place, verdict: ['error'], error: error.message });
        }
        n += 1;
        if (n % 100 === 0) console.log(`${n}/${places.length}`);
        await sleep(PAUSE_MS);
      }
    }),
  );

  const count = (flag) => results.filter((r) => r.verdict.includes(flag)).length;
  const summary = {
    checked: results.length,
    ok: count('ok'),
    closed_suspect: count('closed_suspect'),
    moved: count('moved'),
    renamed: count('renamed'),
    not_found: count('not_found'),
    id_found: count('id_found'),
    id_changed: count('id_changed'),
    id_cleaned: count('id_cleaned'),
    bad_coords: count('bad_coords'),
    error: count('error'),
    duplicate_kakao_ids: [...byKakao.values()].filter((ids) => ids.length > 1).length,
    with_reviews: results.filter((r) => r.kakao?.reviews?.length).length,
    with_store_photos: results.filter((r) => r.kakao?.store_photos?.length).length,
  };
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), summary, results }, null, 1));
  console.log(JSON.stringify(summary));
  console.log(`saved ${path.relative(REPO, OUT)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
