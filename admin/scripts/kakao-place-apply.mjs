#!/usr/bin/env node
/**
 * 카카오 점검 결과(kakao-place-check.json) → 운영 DB 반영 (service role, 023 적용 후)
 *
 *   node scripts/kakao-place-apply.mjs                         # 무엇이 바뀔지 개수만
 *   node scripts/kakao-place-apply.mjs --apply                 # 영업 상태·카카오 ID 정리·잘못된 좌표(50km+)·영업시간/전화·리뷰·가게 사진
 *   node scripts/kakao-place-apply.mjs --apply --hide-closed   # + 폐업 의심 장소를 숨김(사이트에서 빠짐, 행은 남음)
 *   node scripts/kakao-place-apply.mjs --apply --fix-location  # + 위치가 바뀐 곳의 주소·좌표를 카카오 값으로
 *
 * 이름이 다른 곳(renamed)은 운영자가 붙인 이름일 수 있어 바꾸지 않는다.
 * 리뷰·가게 사진은 admin에서 참고용으로만 보이고 사이트에는 운영자가 고른 사진만 나간다.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const HIDE_CLOSED = args.includes('--hide-closed');
const FIX_LOCATION = args.includes('--fix-location');
const reportArg = args.indexOf('--report');
const REPORT = reportArg >= 0 ? args[reportArg + 1] : path.join(REPO, 'docs/db-overhaul/kakao-place-check.json');
const CONCURRENCY = 4;

function readEnv(file) {
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
}
const env = readEnv(path.join(REPO, 'project/.env'));
const KEY = env.SUPABASE_SERVICE_KEY;
const db = async (pathAndQuery, method, body, prefer = 'return=minimal') => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
};

function plan(r) {
  const now = new Date().toISOString();
  const k = r.kakao;
  const placeUrl = r.kakao_place_id ? `https://place.map.kakao.com/${r.kakao_place_id}` : null;
  const status = r.verdict.includes('closed_suspect') ? 'closed_suspect' : r.verdict.includes('moved') ? 'moved' : k ? 'open' : 'unknown';
  const patch = { business_status: status, business_checked_at: now };
  if (['id_found', 'id_changed', 'id_cleaned'].some((v) => r.verdict.includes(v))) patch.kakao_place_id = r.kakao_place_id;
  // 좌표가 50km 넘게 틀린 곳은 이전이 아니라 입력 오류라 카카오 값으로 고친다
  if (r.verdict.includes('bad_coords') && k) Object.assign(patch, { address: patch.address ?? k.address, lat: k.lat, lon: k.lon });
  if (HIDE_CLOSED && status === 'closed_suspect') patch.visit_status = 'hidden';
  if (FIX_LOCATION && status === 'moved' && k) Object.assign(patch, { address: k.address, lat: k.lat, lon: k.lon });

  const facts = [];
  if (k?.hours?.length) facts.push({ place_id: r.id, field: 'hours', value: { text: k.hours.join(' / ') }, source: 'kakao', source_url: placeUrl, checked_at: now });
  if (k?.phone) facts.push({ place_id: r.id, field: 'phone', value: { text: k.phone }, source: 'kakao', source_url: placeUrl, checked_at: now });

  const reviews = [
    ...(k?.reviews ?? []).map((v) => ({ place_id: r.id, source: 'kakao', external_id: v.id, excerpt: v.excerpt, rating: v.rating, written_at: v.written_at, source_url: placeUrl })),
    ...(k?.blogs ?? []).map((v) => ({ place_id: r.id, source: 'blog', external_id: v.id, excerpt: v.excerpt, rating: null, written_at: v.written_at, source_url: v.url })),
  ].filter((v) => v.external_id && v.excerpt);

  const photos = (k?.store_photos ?? []).map((ph, i) => ({ place_id: r.id, source: 'official', url: ph.url, source_url: placeUrl, status: 'suggested', sort_order: 100 + i }));
  return { patch, facts, reviews, photos, status };
}

async function main() {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'));
  const rows = report.results.filter((r) => r.id && !r.verdict.includes('error'));
  const plans = rows.map((r) => ({ r, ...plan(r) }));
  const tally = (s) => plans.filter((p) => p.status === s).length;
  console.log(JSON.stringify({
    places: plans.length,
    open: tally('open'),
    closed_suspect: tally('closed_suspect'),
    moved: tally('moved'),
    hide: plans.filter((p) => p.patch.visit_status === 'hidden').length,
    fix_location: plans.filter((p) => p.patch.lat !== undefined).length,
    bad_coords_fixed: plans.filter((p) => p.r.verdict.includes('bad_coords')).length,
    kakao_id_filled: plans.filter((p) => p.patch.kakao_place_id).length,
    facts: plans.reduce((n, p) => n + p.facts.length, 0),
    reviews: plans.reduce((n, p) => n + p.reviews.length, 0),
    store_photos: plans.reduce((n, p) => n + p.photos.length, 0),
  }));
  if (!APPLY) return;

  const queue = [...plans];
  let done = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          await db(`places?id=eq.${item.r.id}`, 'PATCH', item.patch);
          if (item.facts.length) await db('place_facts?on_conflict=place_id,field,source,value', 'POST', item.facts, 'resolution=ignore-duplicates,return=minimal');
          if (item.reviews.length) await db('external_reviews?on_conflict=source,external_id', 'POST', item.reviews, 'resolution=ignore-duplicates,return=minimal');
          if (item.photos.length) await db('place_photos?on_conflict=url', 'POST', item.photos, 'resolution=ignore-duplicates,return=minimal');
        } catch (error) {
          failures.push(`${item.r.name}: ${error.message}`);
        }
        done += 1;
        if (done % 100 === 0) console.log(`${done}/${plans.length}`);
      }
    }),
  );
  console.log(JSON.stringify({ applied: done - failures.length, failed: failures.length }));
  failures.slice(0, 10).forEach((f) => console.error(f));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
