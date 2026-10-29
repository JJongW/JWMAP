#!/usr/bin/env node
/**
 * 카카오맵 즐겨찾기(공개 폴더) → 점검 → 검토함
 * 공개 폴더는 로그인 없이 읽힌다. 공유 링크(kko.to/…)나 map_user_id로 시작한다.
 *
 *   node scripts/kakao-saved-collect.mjs --link https://kko.to/<공유링크>      # 드라이런: 결과 JSON만
 *   node scripts/kakao-saved-collect.mjs --user <map_user_id> --apply         # 새 장소를 검토함에 넣는다 (service role)
 *   node scripts/kakao-saved-collect.mjs --from-report --apply                # 이미 만든 결과 JSON으로 검토함에 넣기 (다시 조회 안 함)
 *   node scripts/kakao-saved-collect.mjs --from-report --recheck-closed        # 상세 없는 곳을 이름으로 다시 찾아 ID가 바뀐 곳을 살린다
 *   옵션: --folders 4453423,4471271 (일부 폴더만) · --skip-folders 1,2 (기본: 남의 목록 폴더 3개) · --concurrency 6
 *   즐겨찾기 별 색은 폴더마다 쓰는 법이 달라 가봤음 추정에 쓰지 않는다 (원본으로만 남긴다)
 *
 * 장소마다
 *   1. 여러 폴더에 같은 장소가 있으면 하나로 합치고 폴더 이름을 모두 남긴다
 *   2. 카카오 상세로 영업 상태·주소·좌표·카테고리·리뷰·가게 사진을 가져온다 (상세가 없으면 폐업 의심)
 *   3. DB와 중복 검사: 카카오 ID, 없으면 이름+300m 이내
 * 결과
 *   in_db          이미 DB에 있음 → 검토함에 넣지 않는다 (폐업 여부는 kakao-place-check가 맡는다)
 *   new            DB에 없고 영업 중 → 검토함 (리뷰·가게 사진 같이)
 *   new_closed     DB에 없고 카카오 상세가 없음 → 넣지 않고 보고서에만
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import {
  REPO,
  cleanId,
  keywordSearch,
  distanceM,
  env,
  panel,
  sleep,
  squash,
  summarize,
  withRetry,
} from './lib/kakao.mjs';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const CONCURRENCY = Number(arg('--concurrency') ?? 5);
const OUT = arg('--out') ?? path.join(REPO, 'docs/db-overhaul/kakao-saved.json');
const ONLY = arg('--folders')?.split(',').map(Number);
// 남의 목록을 모아 둔 폴더(흑백요리사·카카오 동네맛집·우체국 추천)는 나중에 따로 본다
const DEFAULT_SKIP = [15551231, 18355917, 22749712];
const SKIP = arg('--skip-folders')?.split(',').map(Number) ?? DEFAULT_SKIP;
const FROM_REPORT = args.includes('--from-report');
const RECHECK_CLOSED = args.includes('--recheck-closed');
const SPACE_FOLDER = /볼거리|전시|공원|산책|여행/;

const kakaoGet = (url) =>
  withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://map.kakao.com/' } });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return res.json();
  });

async function resolveUser() {
  if (arg('--user')) return arg('--user');
  const link = arg('--link');
  if (!link) throw new Error('--link 또는 --user가 필요해요');
  const res = await fetch(link, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  const folderId = new URL(res.url).searchParams.get('folderid');
  if (!folderId) throw new Error(`공유 링크에서 폴더를 못 찾았어요: ${res.url}`);
  const info = await kakaoGet(`https://map.kakao.com/folder/info?folderId=${folderId}`);
  const userId = info.folders?.[0]?.map_user_id ?? info.map_user_id;
  if (!userId) throw new Error('폴더 주인을 못 찾았어요');
  return String(userId);
}

async function fetchDbPlaces() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/places?select=id,name,lat,lon,kakao_place_id,visit_status&offset=${from}&limit=1000`,
      { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) throw new Error(`places ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function regionHint(address) {
  // "서울 성동구 연무장5길 9-16" → "서울 성동구"
  return address ? address.split(' ').slice(0, 2).join(' ') : null;
}

async function main() {
  if (FROM_REPORT) {
    const report = JSON.parse(readFileSync(OUT, 'utf8'));
    const { folders } = await kakaoGet(`https://map.kakao.com/folder/list?map_user_id=${report.map_user_id}`);
    const skipTitles = new Set(folders.filter((f) => SKIP.includes(f.folderid)).map((f) => f.title));
    // 남의 목록 폴더에만 있는 장소는 뺀다 (내 폴더에도 있으면 그 폴더만 남긴다)
    const results = report.results
      .map((r) => ({ ...r, folders: r.folders.filter((f) => !skipTitles.has(f)) }))
      .filter((r) => r.folders.length > 0);
    console.log(`결과 파일에서 ${results.length}곳 (제외 폴더: ${[...skipTitles].join(', ') || '없음'})`);
    if (RECHECK_CLOSED) {
      await recheckClosed(results);
      writeFileSync(OUT, JSON.stringify({ ...report, rechecked_at: new Date().toISOString(), results: report.results.map((r) => results.find((x) => x.recheck && (x.previous_kakao_place_id ?? x.kakao_place_id) === r.kakao_place_id) ?? r) }, null, 1));
    }
    return applyResults(results);
  }
  const userId = await resolveUser();
  const { folders } = await kakaoGet(`https://map.kakao.com/folder/list?map_user_id=${userId}`);
  const targets = folders.filter((f) => (!ONLY || ONLY.includes(f.folderid)) && !SKIP.includes(f.folderid));
  console.log(`폴더 ${targets.length}개: ${targets.map((f) => `${f.title}(${f.favorite_cnt})`).join(', ')}`);

  // 1. 폴더별 장소 → 카카오 ID로 합치기
  const saved = new Map();
  let short = 0;
  for (const folder of targets) {
    const { favorites = [] } = await kakaoGet(`https://map.kakao.com/favorite/list?folderid=${folder.folderid}`);
    if (favorites.length < folder.favorite_cnt) short += folder.favorite_cnt - favorites.length;
    for (const fav of favorites) {
      if (fav.type !== 'PLACE' || !fav.key) continue;
      const id = cleanId(fav.key);
      const entry = saved.get(id) ?? { kakao_place_id: id, name: fav.display1, area: fav.display2, folders: [], colors: [], memos: [], saved_at: fav.created_at };
      entry.folders.push(folder.title);
      // 즐겨찾기 별 색 (01~07). 폴더마다 다를 수 있어 폴더와 짝으로 남긴다
      entry.colors.push({ folder: folder.title, color: fav.color ?? null });
      if (fav.memo?.trim()) entry.memos.push(fav.memo.trim());
      if (fav.created_at < entry.saved_at) entry.saved_at = fav.created_at;
      saved.set(id, entry);
    }
    await sleep(200);
  }
  console.log(`저장된 장소 ${saved.size}곳 (폴더 간 중복 합침${short ? `, 목록에서 빠진 ${short}건` : ''})`);

  // 2. 카카오 상세 + 3. DB 중복 검사
  const db = await fetchDbPlaces();
  const byKakao = new Map(db.filter((p) => p.kakao_place_id).map((p) => [cleanId(p.kakao_place_id), p]));
  const queue = [...saved.values()];
  const results = [];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const raw = await panel(item.kakao_place_id);
          const kakao = raw ? summarize(raw) : null;
          let match = byKakao.get(item.kakao_place_id) ?? null;
          let matchedBy = match ? 'kakao_id' : null;
          if (!match && kakao) {
            match = db.find((p) => squash(p.name) === squash(kakao.name ?? item.name) && (distanceM(p, kakao) ?? 0) < 300) ?? null;
            if (match) matchedBy = 'name_300m';
          }
          const verdict = match ? 'in_db' : kakao && kakao.status === 'Y' ? 'new' : 'new_closed';
          results.push({ ...item, verdict, matched_place_id: match?.id ?? null, matched_by: matchedBy, matched_visit_status: match?.visit_status ?? null, kakao });
        } catch (error) {
          results.push({ ...item, verdict: 'error', error: error.message });
        }
        if (results.length % 200 === 0) console.log(`${results.length}/${saved.size}`);
        await sleep(200);
      }
    }),
  );

  const count = (v) => results.filter((r) => r.verdict === v).length;
  const summary = {
    folders: targets.length,
    saved_places: saved.size,
    in_db: count('in_db'),
    in_db_by_name: results.filter((r) => r.matched_by === 'name_300m').length,
    new: count('new'),
    new_closed: count('new_closed'),
    error: count('error'),
    new_space: results.filter((r) => r.verdict === 'new' && r.folders.some((f) => SPACE_FOLDER.test(f))).length,
  };
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), map_user_id: userId, summary, results }, null, 1));
  console.log(JSON.stringify(summary));
  console.log(`saved ${path.relative(REPO, OUT)}`);
  if (!APPLY) return;
  return applyResults(results);
}

/**
 * 상세가 없는 곳은 이전·재등록으로 ID만 바뀌었을 수 있다.
 * 같은 이름(+ 저장할 때 지역)으로 다시 찾아 영업 중이면 새 ID로 바꾼다. 못 찾으면 폐업 의심 그대로.
 */
async function recheckClosed(results) {
  const db = await fetchDbPlaces();
  const byKakao = new Map(db.filter((p) => p.kakao_place_id).map((p) => [cleanId(p.kakao_place_id), p]));
  const targets = results.filter((r) => r.verdict === 'new_closed');
  let revived = 0;
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const area = (r.area ?? '').split(' ').slice(0, 2).join(' ');
        const docs = await keywordSearch(`${r.name} ${area}`.trim(), null).catch(() => []);
        const hit = docs.find((d) => squash(d.place_name) === squash(r.name)) ?? docs.find((d) => squash(d.place_name).includes(squash(r.name)));
        if (hit && hit.id !== r.kakao_place_id) {
          const raw = await panel(hit.id).catch(() => null);
          const kakao = raw ? summarize(raw) : null;
          if (kakao?.status === 'Y') {
            const match = byKakao.get(hit.id) ?? null;
            Object.assign(r, {
              previous_kakao_place_id: r.kakao_place_id,
              kakao_place_id: hit.id,
              kakao,
              verdict: match ? 'in_db' : 'new',
              matched_place_id: match?.id ?? null,
              matched_by: match ? 'kakao_id' : null,
              recheck: 'id_changed',
            });
            revived += 1;
          }
        }
        if (!r.recheck) r.recheck = 'still_missing';
        await sleep(200);
      }
    }),
  );
  console.log(`폐업 의심 ${targets.length}곳 다시 확인: ID 바뀐 영업 중 ${revived}곳, 여전히 없음 ${targets.length - revived}곳`);
}

async function applyResults(results) {
  const tally = (v) => results.filter((r) => r.verdict === v).length;
  console.log(JSON.stringify({ new: tally('new'), in_db: tally('in_db'), new_closed: tally('new_closed') }));
  if (!APPLY) return;

  // 검토함에 넣기 (새 장소만)
  const key = env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const post = async (pathAndQuery, body, prefer) => {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`, { method: 'POST', headers: { ...headers, Prefer: prefer }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${pathAndQuery.split('?')[0]} ${res.status} ${await res.text()}`);
    return res.status === 201 || res.status === 200 ? res.json().catch(() => null) : null;
  };
  let done = 0;
  for (const r of results.filter((x) => x.verdict === 'new')) {
    const k = r.kakao;
    const [row] = await post('place_intake?on_conflict=source,source_key', {
      source: 'kakao_saved',
      source_key: r.kakao_place_id,
      name: k.name ?? r.name,
      province: k.address?.split(' ')[0] ?? null,
      region_hint: regionHint(k.address),
      category_hint: r.folders.some((f) => SPACE_FOLDER.test(f)) ? `볼거리 · ${k.category ?? ''}` : k.category,
      address: k.address,
      lat: k.lat,
      lon: k.lon,
      kakao_place_id: r.kakao_place_id,
      raw: { folders: r.folders, colors: r.colors, memo: r.memos.join(' / ') || null, saved_at: r.saved_at, kakao_category: k.category, hours: k.hours, rating: k.rating, review_count: k.review_count },
    }, 'resolution=merge-duplicates,return=representation');
    const placeUrl = `https://place.map.kakao.com/${r.kakao_place_id}`;
    const reviews = [
      ...k.reviews.map((v) => ({ intake_id: row.id, source: 'kakao', external_id: v.id, excerpt: v.excerpt, rating: v.rating, written_at: v.written_at, source_url: placeUrl })),
      ...k.blogs.map((v) => ({ intake_id: row.id, source: 'blog', external_id: v.id, excerpt: v.excerpt, rating: null, written_at: v.written_at, source_url: v.url })),
    ].filter((v) => v.external_id && v.excerpt);
    if (reviews.length) await post('external_reviews?on_conflict=source,external_id', reviews, 'resolution=ignore-duplicates,return=minimal');
    const photos = k.store_photos.map((ph, i) => ({ intake_id: row.id, source: 'official', url: ph.url, source_url: placeUrl, status: 'suggested', sort_order: 100 + i }));
    if (photos.length) await post('place_photos?on_conflict=url', photos, 'resolution=ignore-duplicates,return=minimal');
    done += 1;
    if (done % 100 === 0) console.log(`검토함 ${done}`);
  }
  console.log(`검토함에 ${done}곳 넣었어요`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
