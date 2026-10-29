/**
 * 카카오 장소 조회 공용 코드 (로그인 불필요)
 *   panel(id)          장소 상세 (영업 상태·주소·좌표·영업시간·가게 사진·리뷰)
 *   keywordSearch()    카카오 로컬 키워드 검색 (REST 키)
 *   checkOne(place)    DB 장소 하나를 카카오와 비교해 판정
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export { REPO };

export function readEnv(file) {
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
export const env = readEnv(path.join(REPO, 'project/.env'));
/** 글자 수로 자르다 생긴 반쪽 이모지(짝 없는 서로게이트)를 없앤다. 남기면 DB 저장 요청 JSON이 깨진다 */
export const cleanText = (s, max = 300) =>
  [...(s ?? '')].slice(0, max).join('').replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '').trim();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const squash = (s) => (s ?? '').normalize('NFC').replace(/\(.*?\)|[\s·\-_.,]/g, '').toLowerCase();

export function distanceM(a, b) {
  if (a.lat == null || b.lat == null) return null;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export async function withRetry(fn, tries = 3) {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (i >= tries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

/** 카카오 장소 상세. 없으면 null */
export async function panel(kakaoId) {
  return withRetry(async () => {
    const res = await fetch(`https://place-api.map.kakao.com/places/panel3/${kakaoId}`, {
      headers: { pf: 'web', Referer: 'https://place.map.kakao.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`panel3 ${res.status}`);
    return res.json();
  });
}

export async function keywordSearch(query, near) {
  const params = new URLSearchParams({ query, size: '5' });
  if (near?.lat != null) {
    params.set('x', String(near.lon));
    params.set('y', String(near.lat));
    params.set('radius', '2000');
  }
  return withRetry(async () => {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
      headers: { Authorization: `KakaoAK ${env.VITE_KAKAO_RESTFUL_API_KEY}` },
    });
    if (!res.ok) throw new Error(`keyword ${res.status}`);
    return (await res.json()).documents ?? [];
  });
}

/** panel3에서 쓸 값만 */
export function summarize(p) {
  const s = p.summary ?? {};
  const reviews = (p.kakaomap_review?.reviews ?? [])
    .map((r) => ({ id: String(r.review_id), excerpt: cleanText(r.contents), rating: r.star_rating ?? null, written_at: r.registered_at?.slice(0, 10) ?? null }))
    .filter((r) => r.excerpt);
  const blogs = (p.blog_review?.reviews ?? []).map((b) => ({
    id: String(b.review_id),
    excerpt: cleanText([b.title, b.contents].filter(Boolean).join(' — ')),
    url: b.outlink ?? b.url ?? b.link ?? null,
    written_at: b.date?.slice(0, 10) ?? null,
  }));
  // 가게(업주)가 올린 사진만 official로 본다
  const storePhotos = (p.menu?.menus?.photos ?? []).concat(p.photos?.photos ?? [])
    .filter((ph) => ph && ph.url && (ph.type === 'MYSTORE' || ph.type === 'POI'))
    .map((ph) => ({ url: ph.url.replace(/^http:/, 'https:'), type: ph.type ?? null }));
  return {
    status: s.status ?? null,
    name: s.name ?? null,
    category: [s.category?.name1, s.category?.name2, s.category?.name3].filter(Boolean).join(' > ') || null,
    address: s.address?.road ?? s.address?.disp ?? null,
    lat: s.point?.lat ?? null,
    lon: s.point?.lon ?? null,
    phone: s.phone_numbers?.[0]?.tel ?? null,
    hours_headline: p.open_hours?.headline?.display_text ?? null,
    hours: (p.open_hours?.week_from_today?.week_periods?.[0]?.days ?? [])
      .map((d) => `${d.day_of_the_week_desc} ${d.on_days?.start_end_time_desc ?? d.off_days_desc ?? '휴무'}`),
    review_count: p.kakaomap_review?.score_set?.review_count ?? null,
    rating: p.kakaomap_review?.score_set?.average_score ?? null,
    reviews: reviews.slice(0, 8),
    blogs: blogs.slice(0, 5),
    store_photos: storePhotos.slice(0, 12),
    updated_at: s.meta?.updated_at ?? null,
  };
}

export function judge(place, k) {
  const flags = [];
  if (!k) return ['closed_suspect'];
  if (k.status && k.status !== 'Y') flags.push('closed_suspect');
  const moved = distanceM(place, k);
  // 50km 넘게 차이 나면 이전이 아니라 DB 좌표가 잘못 들어간 것 (위도·경도 뒤바뀜 등)
  if (moved != null && moved > 50000) flags.push('bad_coords');
  else if (moved != null && moved > 150) flags.push('moved');
  if (k.name && squash(k.name) !== squash(place.name) && !squash(k.name).includes(squash(place.name)) && !squash(place.name).includes(squash(k.name))) {
    flags.push('renamed');
  }
  return flags.length ? flags : ['ok'];
}

export async function fetchPlaces() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/places?select=id,name,address,lat,lon,kakao_place_id,visit_status,legacy_table&order=name&offset=${from}&limit=1000`,
      { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) throw new Error(`places ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

/** DB에 '688054969.0'처럼 숫자로 저장된 ID가 있다 */
export const cleanId = (id) => (id == null ? null : String(id).trim().replace(/\.0+$/, '') || null);

export async function findByName(place) {
  const pick = (docs) =>
    docs.find((d) => squash(d.place_name) === squash(place.name)) ?? docs.find((d) => squash(d.place_name).includes(squash(place.name)));
  return pick(await keywordSearch(place.name, place)) ?? (place.lat != null ? pick(await keywordSearch(place.name, null)) : undefined);
}

export async function checkOne(place) {
  const stored = place.kakao_place_id;
  let kakaoId = cleanId(stored);
  let found = null;
  if (!kakaoId) {
    // 근처에서 못 찾으면 지역 없이 한 번 더 (좌표가 틀렸을 수도 있다)
    const hit = await findByName(place);
    if (!hit) return { ...place, verdict: ['not_found'], kakao: null };
    kakaoId = hit.id;
    found = hit.id;
  }
  let raw = await panel(kakaoId);
  let idChanged = false;
  if (!raw && !found) {
    // 상세가 없으면 같은 이름으로 다시 등록됐는지 본다 (없으면 폐업 의심)
    const hit = await findByName(place);
    if (hit && hit.id !== kakaoId) {
      raw = await panel(hit.id);
      if (raw) {
        kakaoId = hit.id;
        idChanged = true;
      }
    }
  }
  const kakao = raw ? summarize(raw) : null;
  const verdict = judge(place, kakao);
  if (found) verdict.unshift('id_found');
  if (idChanged) verdict.unshift('id_changed');
  if (!found && !idChanged && kakaoId !== stored) verdict.unshift('id_cleaned');
  return { ...place, kakao_place_id: kakaoId, distance_m: kakao ? distanceM(place, kakao) : null, verdict, kakao };
}

