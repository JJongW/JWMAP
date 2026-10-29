#!/usr/bin/env node
/**
 * odiga 사진 폴더(외장 드라이브 01_Places) → 검토함(place_intake) + 사진 후보(place_photos)
 *
 *   node scripts/odiga-vault-intake.mjs                 # 드라이런: 결과 JSON만 만든다 (DB에 쓰지 않음)
 *   node scripts/odiga-vault-intake.mjs --apply         # 운영 DB에 쓴다 (service role, 021 적용 후)
 *
 * 폴더 규칙: 01_Places/<시도>/<구>/<동네 - (카테고리 -) 장소명>/사진들
 * 직접 찍은 사진이 있는 폴더라 suggested_status = visited, 가장 이른 촬영일을 방문일 후보로 둔다.
 * 사진 파일은 올리지 않고 경로만 남긴다 (업로드는 admin에서 고른 뒤).
 */
import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanId, keywordSearch, panel, sleep, summarize } from './lib/kakao.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const VAULT = arg('--vault', '/Volumes/One Touch/작업 폴더/odiga/01_Places');
const OUT = arg('--out', path.join(REPO, 'docs/db-overhaul/odiga-vault-intake.json'));

const PHOTO = /\.(jpe?g|heic|png|webp)$/i;
const nfc = (s) => s.normalize('NFC');
const squash = (s) => nfc(s).replace(/\(.*?\)|[\s·\-_:]/g, '').toLowerCase();

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
        }),
    );
  } catch {
    return {};
  }
}

/** 사진 촬영일 (sips). 못 읽으면 null */
function takenAt(file) {
  try {
    const out = execFileSync('sips', ['-g', 'creation', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/creation: (\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}+09:00` : null;
  } catch {
    return null;
  }
}

/** 장소 폴더 찾기: 사진이 있는 폴더 중 이름에 ' - '가 있거나 구 아래에 있는 것 */
function findPlaceFolders(dir, parts = []) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    const files = readdirSync(full).filter((f) => !f.startsWith('._') && !f.startsWith('.'));
    const photos = files.filter((f) => PHOTO.test(f));
    const segs = [...parts, nfc(entry.name)];
    if (photos.length && (entry.name.includes(' - ') || segs.length >= 3)) {
      found.push({ full, segs, photos });
    } else {
      found.push(...findPlaceFolders(full, segs));
    }
  }
  return found;
}

function describeFolder(segs) {
  const folder = segs[segs.length - 1];
  const pieces = folder.split(/\s+-\s+|-\s+/).map((s) => s.trim()).filter(Boolean);
  const name = pieces[pieces.length - 1];
  const neighborhood = pieces.length > 1 ? pieces[0].replace(':', '/') : null;
  const category = pieces.length > 2 ? pieces.slice(1, -1).join(' / ') : null;
  return { name, neighborhood, category, province: segs[0], district: segs.length >= 3 ? segs[1] : null };
}

async function fetchPlaces(env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/rest/v1/places?select=id,name,region,sub_region,address,visit_status,kakao_place_id&offset=${offset}&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`places ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function matchPlace(info, places) {
  const target = squash(info.name);
  const hits = places.filter((p) => {
    const n = squash(p.name);
    return n === target || (target.length >= 3 && (n.includes(target) || target.includes(n) && n.length >= 3));
  });
  if (hits.length <= 1) return { place: hits[0] ?? null, note: hits.length ? 'name' : null };
  // 여러 곳이면 동네·구 이름이 주소/지역에 들어간 곳
  const hints = [info.neighborhood, info.district].filter(Boolean).flatMap((h) => h.split('/'));
  const local = hits.filter((p) => hints.some((h) => `${p.address ?? ''} ${p.region ?? ''} ${p.sub_region ?? ''}`.includes(h.replace(/역$/, ''))));
  if (local.length === 1) return { place: local[0], note: 'name+area' };
  return { place: null, note: `ambiguous: ${hits.map((p) => `${p.name}(${p.region ?? '?'})`).join(', ')}` };
}

async function main() {
  const projectEnv = readEnv(path.join(REPO, 'project/.env'));
  const places = await fetchPlaces(projectEnv);
  const folders = findPlaceFolders(VAULT);

  const items = folders.map(({ full, segs, photos }) => {
    const info = describeFolder(segs);
    const shots = photos
      .map((file) => ({ local_path: nfc(path.join(full, file)), taken_at: takenAt(path.join(full, file)) }))
      .sort((a, b) => (a.taken_at ?? '9').localeCompare(b.taken_at ?? '9'));
    const { place, note } = matchPlace(info, places);
    return {
      source: 'odiga_vault',
      source_key: segs.join('/'),
      name: info.name,
      province: info.province,
      region_hint: [info.district, info.neighborhood].filter(Boolean).join(' · ') || null,
      category_hint: info.category,
      matched_place_id: place?.id ?? null,
      match_note: note,
      suggested_status: 'visited',
      raw: {
        folder: segs.join('/'),
        photo_count: shots.length,
        first_taken_at: shots.find((s) => s.taken_at)?.taken_at ?? null,
        matched_visit_status: place?.visit_status ?? null,
      },
      photos: shots,
    };
  });

  // 카카오에서 같은 곳 찾기: 주소·좌표·카카오 ID를 채우고, 카카오 ID로 DB 중복을 다시 본다
  const byKakao = new Map(places.filter((p) => p.kakao_place_id).map((p) => [cleanId(p.kakao_place_id), p]));
  const queue = [...items];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          const area = item.region_hint?.split(' · ').pop()?.split('/')[0] ?? '';
          const docs = await keywordSearch(`${item.name} ${area}`.trim(), null);
          const hit = docs.find((d) => squash(d.place_name) === squash(item.name)) ?? docs.find((d) => squash(d.place_name).includes(squash(item.name)));
          if (hit) {
            const raw = await panel(hit.id);
            const k = raw ? summarize(raw) : null;
            Object.assign(item, { kakao_place_id: hit.id, address: hit.road_address_name || hit.address_name, lat: Number(hit.y), lon: Number(hit.x) });
            item.raw.kakao_category = hit.category_name;
            item.raw.kakao_status = k?.status ?? 'missing';
            item.kakao = k;
            const dbHit = byKakao.get(hit.id);
            if (dbHit && dbHit.id !== item.matched_place_id) {
              item.matched_place_id = dbHit.id;
              item.match_note = 'kakao_id';
              item.raw.matched_visit_status = dbHit.visit_status;
            }
          }
        } catch (error) {
          item.raw.kakao_error = error.message;
        }
        await sleep(200);
      }
    }),
  );

  const summary = {
    with_kakao: items.filter((i) => i.kakao_place_id).length,
    kakao_closed: items.filter((i) => i.raw.kakao_status && i.raw.kakao_status !== 'Y').length,
    folders: items.length,
    photos: items.reduce((n, i) => n + i.photos.length, 0),
    matched: items.filter((i) => i.matched_place_id).length,
    matched_but_not_visited: items.filter((i) => i.matched_place_id && i.raw.matched_visit_status !== 'visited').length,
    new_places: items.filter((i) => !i.matched_place_id && !i.match_note).length,
    ambiguous: items.filter((i) => i.match_note?.startsWith('ambiguous')).length,
    with_date: items.filter((i) => i.raw.first_taken_at).length,
  };
  writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), summary, items: items.map(({ kakao, ...rest }) => ({ ...rest, kakao_reviews: kakao?.reviews?.length ?? 0 })) }, null, 1));
  console.log(JSON.stringify(summary));
  console.log(`saved ${path.relative(REPO, OUT)}`);

  if (!APPLY) return;
  const adminEnv = readEnv(path.join(REPO, 'admin/.env.local'));
  const url = adminEnv.NEXT_PUBLIC_SUPABASE_URL || projectEnv.VITE_SUPABASE_URL;
  const key = adminEnv.SUPABASE_SERVICE_ROLE_KEY || adminEnv.SUPABASE_SERVICE_KEY || projectEnv.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error('service role 키(SUPABASE_SERVICE_KEY)를 찾지 못했어요');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  for (const { photos, kakao, ...intake } of items) {
    const res = await fetch(`${url}/rest/v1/place_intake?on_conflict=source,source_key`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(intake),
    });
    if (!res.ok) throw new Error(`place_intake ${res.status} ${await res.text()}`);
    const [row] = await res.json();
    const photoRows = photos.map((p, i) => ({
      intake_id: row.id,
      place_id: intake.matched_place_id,
      source: 'own',
      local_path: p.local_path,
      taken_at: p.taken_at,
      sort_order: i,
    }));
    const pr = await fetch(`${url}/rest/v1/place_photos?on_conflict=local_path`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(photoRows),
    });
    if (!pr.ok) throw new Error(`place_photos ${pr.status} ${await pr.text()}`);
    if (kakao) {
      const placeUrl = `https://place.map.kakao.com/${intake.kakao_place_id}`;
      const extra = [
        ['external_reviews?on_conflict=source,external_id', [
          ...kakao.reviews.map((v) => ({ intake_id: row.id, place_id: intake.matched_place_id, source: 'kakao', external_id: v.id, excerpt: v.excerpt, rating: v.rating, written_at: v.written_at, source_url: placeUrl })),
          ...kakao.blogs.map((v) => ({ intake_id: row.id, place_id: intake.matched_place_id, source: 'blog', external_id: v.id, excerpt: v.excerpt, rating: null, written_at: v.written_at, source_url: v.url })),
        ].filter((v) => v.external_id && v.excerpt)],
        ['place_photos?on_conflict=url', kakao.store_photos.map((ph, i) => ({ intake_id: row.id, place_id: intake.matched_place_id, source: 'official', url: ph.url, source_url: placeUrl, status: 'suggested', sort_order: 100 + i }))],
      ];
      for (const [target, rows] of extra) {
        if (!rows.length) continue;
        const er = await fetch(`${url}/rest/v1/${target}`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(rows) });
        if (!er.ok) throw new Error(`${target.split('?')[0]} ${er.status} ${await er.text()}`);
      }
    }
  }
  console.log(`applied ${items.length} intake rows`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
