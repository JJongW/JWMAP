/**
 * 카카오 장소 조회 공용 코드 (로그인 불필요)
 *   panel(id)          장소 상세 (영업 상태·주소·좌표·영업시간·가게 사진·리뷰)
 *   keywordSearch()    카카오 로컬 키워드 검색 (REST 키)
 *   checkOne(place)    DB 장소 하나를 카카오와 비교해 판정
 *   fullReviews(id)    카카오 리뷰 전부 + 블로그 글 본문 전체 (external_reviews에 넣을 원문)
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
/**
 * 짝 없는 서로게이트(반쪽 이모지)를 없앤다. 남기면 DB 저장 요청 JSON이 깨진다.
 * 리뷰는 원문 전체를 저장한다. max는 비정상적으로 긴 글만 막는 안전장치다.
 */
export const cleanText = (s, max = 50000) =>
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
    url: b.origin_url ?? b.outlink ?? b.url ?? null,
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
    // 카카오가 붙인 장소 키워드(예: 데이트코스, 혼밥)와 편의시설. 태그가 빈 곳을 채울 때 쓴다
    keywords: (p.place_add_info?.tags ?? []).filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()),
    facilities: p.place_add_info?.facilities ?? null,
    review_count: p.kakaomap_review?.score_set?.review_count ?? null,
    rating: p.kakaomap_review?.score_set?.average_score ?? null,
    reviews: reviews.slice(0, 8),
    blogs: blogs.slice(0, 5),
    store_photos: storePhotos.slice(0, 12),
    updated_at: s.meta?.updated_at ?? null,
  };
}

const KAKAO_HEADERS = { pf: 'web', Referer: 'https://place.map.kakao.com/', 'User-Agent': 'Mozilla/5.0' };
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

async function kakaoTab(url) {
  return withRetry(async () => {
    const res = await fetch(url, { headers: KAKAO_HEADERS });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`kakao tab ${res.status}`);
    return res.json();
  });
}

/** 카카오맵 리뷰를 추천순으로 전부(최대 max개). panel3은 3개만 주고 글도 잘린다 */
export async function kakaoReviewsAll(kakaoId, { max = 300, delay = 400 } = {}) {
  const out = [];
  let last = '';
  while (out.length < max) {
    const j = await kakaoTab(
      `https://place-api.map.kakao.com/places/tab/reviews/kakaomap/${kakaoId}?order=RECOMMENDED&only_photo_review=false${last ? `&previous_last_review_id=${last}` : ''}`,
    );
    const page = j?.reviews ?? [];
    for (const r of page) {
      const excerpt = cleanText(r.contents);
      if (excerpt) out.push({ id: String(r.review_id), excerpt, rating: r.star_rating ?? null, written_at: r.registered_at?.slice(0, 10) ?? null });
    }
    if (!page.length || !j.has_next) break;
    last = page[page.length - 1].review_id;
    await sleep(delay);
  }
  return out.slice(0, max);
}

/** 카카오가 모아 둔 블로그 글 목록(추천순, 최대 max개). contents는 앞부분 미리보기라 본문은 blogText()로 따로 받는다 */
export async function blogList(kakaoId, { max = 20, delay = 400 } = {}) {
  const out = [];
  for (let page = 1; out.length < max; page += 1) {
    const j = await kakaoTab(`https://place-api.map.kakao.com/places/tab/reviews/blog/${kakaoId}?order=RECOMMENDED&page=${page}`);
    const rows = j?.reviews ?? [];
    for (const b of rows) {
      out.push({ id: String(b.review_id), title: b.title ?? '', preview: b.contents ?? '', url: b.origin_url ?? null, written_at: b.registered_at?.slice(0, 10) ?? null });
    }
    if (rows.length < (j?.requested_page_size ?? 10)) break;
    await sleep(delay);
  }
  return out.slice(0, max);
}

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

/** HTML 조각 → 줄바꿈을 살린 글 */
export function htmlToText(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\u200b\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** 네이버 블로그 글 본문 전체. 네이버가 아니거나 못 읽으면 null */
export async function blogText(url) {
  const m = url?.match(/blog\.naver\.com\/([^/?#]+)\/(\d+)/) ?? url?.match(/blogId=([^&]+).*logNo=(\d+)/);
  if (!m) return null;
  try {
    return await withRetry(async () => {
      const res = await fetch(`https://m.blog.naver.com/PostView.naver?blogId=${m[1]}&logNo=${m[2]}`, { headers: { 'User-Agent': MOBILE_UA } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`naver blog ${res.status}`);
      const html = await res.text();
      // 스마트에디터 ONE 본문(se-main-container), 옛 에디터 본문(post-view / postViewArea)
      const start = ['se-main-container', 'id="postViewArea"', 'class="post_ct'].map((k) => html.indexOf(k)).find((i) => i >= 0);
      if (start == null) return null;
      const from = html.lastIndexOf('<', start);
      const endAt = ['<div class="post_footer', 'class="wrap_postdata', '<div id="post_footer'].map((k) => html.indexOf(k, start)).filter((i) => i > 0);
      const text = htmlToText(html.slice(from, endAt.length ? Math.min(...endAt) : start + 300000))
        .split('\n').filter((line) => !['이 블로그의 체크인', '이 장소의 다른 글', '지도 데이터', '© NAVER Corp.'].includes(line.trim())).join('\n');
      return text || null;
    });
  } catch {
    return null;
  }
}

/**
 * external_reviews에 넣을 원문 전체.
 *   reviews: 카카오맵 리뷰 전부 (글 전체)
 *   blogs:   블로그 글. 네이버 블로그는 제목 + 본문 전체, 다른 블로그는 제목 + 카카오 미리보기
 */
export async function fullReviews(kakaoId, { maxKakao = 300, maxBlogs = 20, delay = 600 } = {}) {
  const reviews = await kakaoReviewsAll(kakaoId, { max: maxKakao, delay });
  const blogs = [];
  for (const b of await blogList(kakaoId, { max: maxBlogs, delay })) {
    const body = await blogText(b.url);
    blogs.push({ id: b.id, url: b.url, written_at: b.written_at, full: Boolean(body), excerpt: cleanText([b.title, body ?? b.preview].filter(Boolean).join('\n\n')) });
    await sleep(delay);
  }
  return { reviews, blogs };
}

/** fullReviews/summarize 결과 → external_reviews 행. extra는 place_id·intake_id 등 */
export function reviewRows(k, extra, placeUrl) {
  return [
    ...(k?.reviews ?? []).map((v) => ({ ...extra, source: 'kakao', external_id: v.id, excerpt: cleanText(v.excerpt), rating: v.rating, written_at: v.written_at, source_url: placeUrl })),
    ...(k?.blogs ?? []).map((v) => ({ ...extra, source: 'blog', external_id: v.id, excerpt: cleanText(v.excerpt), rating: null, written_at: v.written_at, source_url: v.url })),
  ].filter((r) => r.excerpt);
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

