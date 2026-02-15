/**
 * Batch import attractions from place URLs or place names.
 *
 * Usage:
 *   node scripts/batch-import-places.mjs [path-to-list.txt]
 *   node scripts/batch-import-places.mjs   # reads from admin/scripts/place-urls.txt
 *
 * List format (한 줄에 하나):
 *   - 카카오 place URL: https://place.map.kakao.com/323413598
 *   - 네이버 place URL: https://map.naver.com/.../place/2042329763
 *   - 장소명만: 블루캐비넷출판사 (카카오 검색으로 자동 조회)
 *   - #으로 시작하는 줄: 주석(무시)
 *
 * Env: .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (필수)
 *   - KAKAO_REST_API_KEY 또는 NEXT_PUBLIC_KAKAO_REST_API_KEY (장소명 검색·카카오 좌표용)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const paths = [
    join(__dirname, '../.env.local'),
    join(process.cwd(), '.env.local'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    break;
  }
}

function extractMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']|content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2])?.trim() ?? null;
}

function extractTitle(html) {
  const og = extractMeta(html, 'og:title');
  if (og) return og.replace(/\s*[-|]\s*카카오맵.*$/i, '').replace(/\s*[-|]\s*네이버.*$/i, '').trim();
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.replace(/\s*[-|]\s*카카오맵.*$/i, '').replace(/\s*[-|]\s*네이버.*$/i, '').trim() ?? null;
}

const KAKAO_PLACE_RE = /place\.map\.kakao\.com\/(\d{4,})/i;
const NAVER_PLACE_RE = /\/place\/(\d{4,})/i;

function parseLine(line) {
  const l = line.trim();
  if (!l || l.startsWith('#')) return null;
  if (l.startsWith('http')) {
    if (KAKAO_PLACE_RE.test(l)) return { type: 'kakao', url: l, id: l.match(KAKAO_PLACE_RE)?.[1] };
    if (l.includes('naver') && NAVER_PLACE_RE.test(l)) return { type: 'naver', url: l, id: l.match(NAVER_PLACE_RE)?.[1] };
    return null;
  }
  return { type: 'name', query: l };
}

const DISTRICT_MAPS = {
  서울: {
    강남구: '강남', 서초구: '서초', 송파구: '잠실/송파/강동', 강동구: '잠실/송파/강동',
    영등포구: '영등포/여의도/강서', 강서구: '영등포/여의도/강서',
    광진구: '건대/성수/왕십리', 성동구: '건대/성수/왕십리',
    종로구: '종로/중구', 중구: '종로/중구',
    마포구: '홍대/합정/마포/연남', 용산구: '용산/이태원/한남',
    성북구: '성북/노원/중랑', 노원구: '성북/노원/중랑', 중랑구: '성북/노원/중랑',
    구로구: '구로/관악/동작', 관악구: '구로/관악/동작', 동작구: '구로/관악/동작',
    서대문구: '신촌/연희', 도봉구: '창동/도봉산', 동대문구: '회기/청량리',
    은평구: '연신내/구파발', 강북구: '미아/수유/북한산', 양천구: '목동/양천', 금천구: '금천/가산',
  },
  경기: {
    수원시: '수원', 성남시: '성남/분당', 고양시: '고양/일산', 용인시: '용인', 부천시: '부천',
    안양시: '안양/과천', 안산시: '안산', 화성시: '화성/동탄', 의정부시: '의정부', 파주시: '파주',
  },
};

function extractRegion(address) {
  if (!address) return { region: '서울', sub_region: null };
  let province = null;
  if (address.includes('서울')) province = '서울';
  else if (address.includes('경기')) province = '경기';
  else if (address.includes('인천')) province = '인천';
  else if (address.includes('부산')) province = '부산';
  if (!province) return { region: '서울', sub_region: null };
  const map = DISTRICT_MAPS[province];
  let region = '';
  if (map) {
    for (const [key, value] of Object.entries(map)) {
      if (address.includes(key)) { region = value; break; }
    }
  }
  const dongMatch = address.match(/\s([가-힣]+[동읍면리])\s?/);
  return { region: region || province, sub_region: dongMatch?.[1] ?? null };
}

function mapCategory(text) {
  const l = (text || '').toLowerCase();
  if (l.includes('공간대여') || l.includes('공원디파트먼트') || l.includes('복합문화')) return { main: '전시/문화', sub: '복합문화공간' };
  if (l.includes('미술관')) return { main: '전시/문화', sub: '미술관' };
  if (l.includes('박물관')) return { main: '전시/문화', sub: '박물관' };
  if (l.includes('전시') || l.includes('갤러리')) return { main: '전시/문화', sub: '전시관' };
  if (l.includes('소품') || l.includes('소품샵')) return { main: '쇼핑/소품', sub: '소품샵' };
  if (l.includes('편집샵')) return { main: '쇼핑/소품', sub: '편집샵' };
  if (l.includes('서점') || l.includes('출판사')) return { main: '쇼핑/소품', sub: '독립서점' };
  if (l.includes('문화')) return { main: '전시/문화', sub: '복합문화공간' };
  if ((l.includes('공원') || l.includes('정원')) && !l.includes('디파트먼트')) return { main: '공간/휴식', sub: '공원/정원' };
  if (l.includes('팝업')) return { main: '팝업/이벤트', sub: '브랜드 팝업' };
  return { main: '전시/문화', sub: null };
}

function extractAddressFromOg(og) {
  if (!og || !/(?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n]{10,}/.test(og)) return null;
  const m = og.match(/((?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n#]+)/);
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

function extractCoordsFromHtml(html) {
  const latM = html.match(/latitude%5E([\d.-]+)/i) ?? html.match(/latitude["']?\s*[=%^]\s*([\d.-]+)/i);
  const lonM = html.match(/longitude%5E([\d.-]+)/i) ?? html.match(/longitude["']?\s*[=%^]\s*([\d.-]+)/i);
  const lat = latM ? parseFloat(latM[1]) : undefined;
  const lon = lonM ? parseFloat(lonM[1]) : undefined;
  if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) return { lat, lon };
  return {};
}

async function fetchHtml(url, ua = 'JWMAP-BatchImport/1.0') {
  const res = await fetch(url, { headers: { 'User-Agent': ua }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function kakaoKeywordSearch(query, apiKey) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } }
  );
  const data = await res.json();
  const docs = data?.documents ?? [];
  return docs[0] ?? null;
}

async function resolveKakaoPlace(item, apiKey) {
  const html = await fetchHtml(item.url);
  const name = extractTitle(html);
  const ogDesc = extractMeta(html, 'og:description');
  const address = extractAddressFromOg(ogDesc);
  const { region, sub_region } = extractRegion(address);
  const { main: category_main, sub: category_sub } = mapCategory(name || ogDesc);

  let lat = 0, lon = 0;
  if (apiKey) {
    const doc = await kakaoKeywordSearch(name || item.id, apiKey);
    if (doc && doc.id === item.id) {
      lat = parseFloat(doc.y);
      lon = parseFloat(doc.x);
    } else if (doc) {
      lat = parseFloat(doc.y);
      lon = parseFloat(doc.x);
    }
  }

  return {
    name: name || `장소 ${item.id}`,
    address: address || '주소 미확인',
    region: region || '서울',
    sub_region,
    category_main: category_main || null,
    category_sub: category_sub || null,
    lat,
    lon,
    memo: `[배치 수집] ${item.url}`,
    short_desc: ogDesc?.slice(0, 200) || null,
    kakao_place_id: item.id,
    naver_place_id: null,
    imageUrl: extractMeta(html, 'og:image') || '',
  };
}

async function resolveNaverPlace(item) {
  const url = `https://m.place.naver.com/place/${item.id}`;
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
  const html = await fetchHtml(url, ua);

  const name = extractMeta(html, 'og:title') ?? extractTitle(html);
  const ogDesc = extractMeta(html, 'og:description');
  const address = extractAddressFromOg(ogDesc) ?? (html.match(/((?:서울|경기|인천|부산)[^<"']{8,80})/)?.[1]?.replace(/&amp;/g, '&').trim());
  const coords = extractCoordsFromHtml(html);
  const { region, sub_region } = extractRegion(address);
  const { main: category_main, sub: category_sub } = mapCategory(name || ogDesc);

  const phoneM = html.match(/tel:([0-9-]+)/) ?? html.match(/(\d{2,3}-\d{3,4}-\d{4})/);
  const memoLines = [`[배치 수집] ${url}`];
  if (phoneM?.[1]) memoLines.push(`전화: ${phoneM[1]}`);

  return {
    name: name || `장소 ${item.id}`,
    address: address || '주소 미확인',
    region: region || '서울',
    sub_region,
    category_main: category_main || null,
    category_sub: category_sub || null,
    lat: coords.lat ?? 0,
    lon: coords.lon ?? 0,
    memo: memoLines.join('\n'),
    short_desc: ogDesc?.replace(/#[\w가-힣_-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) || null,
    kakao_place_id: null,
    naver_place_id: item.id,
    imageUrl: extractMeta(html, 'og:image') || '',
  };
}

async function resolveByName(item, apiKey) {
  if (!apiKey) throw new Error('장소명 검색에는 KAKAO_REST_API_KEY가 필요합니다.');
  const doc = await kakaoKeywordSearch(item.query, apiKey);
  if (!doc) throw new Error('검색 결과 없음');

  const address = doc.road_address_name || doc.address_name;
  const { region, sub_region } = extractRegion(address);
  const { main: category_main, sub: category_sub } = mapCategory(doc.category_name || doc.category_group_name || '');

  return {
    name: doc.place_name,
    address: address || '주소 미확인',
    region: region || '서울',
    sub_region,
    category_main: category_main || null,
    category_sub: category_sub || null,
    lat: parseFloat(doc.y),
    lon: parseFloat(doc.x),
    memo: `[배치 수집] 카카오 검색: ${item.query}`,
    short_desc: null,
    kakao_place_id: doc.id,
    naver_place_id: null,
    imageUrl: '',
  };
}

async function run() {
  loadEnv();

  const listPath = process.argv[2] || join(__dirname, 'place-urls.txt');
  if (!existsSync(listPath)) {
    console.error(`파일을 찾을 수 없습니다: ${listPath}`);
    console.error('사용법: node scripts/batch-import-places.mjs [목록파일.txt]');
    console.error('목록 형식: 카카오/네이버 URL 또는 장소명 (한 줄에 하나)');
    process.exit(1);
  }

  const lines = readFileSync(listPath, 'utf8').split('\n');
  const items = lines.map(parseLine).filter(Boolean);

  if (items.length === 0) {
    console.error('유효한 URL 또는 장소명이 없습니다.');
    console.error('형식: https://place.map.kakao.com/123 또는 https://map.naver.com/.../place/123 또는 장소명');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('.env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.');
    process.exit(1);
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY ?? process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let ok = 0, fail = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = item.type === 'name' ? item.query : (item.id || item.url);
    process.stdout.write(`[${i + 1}/${items.length}] ${label} ... `);

    try {
      let data;
      if (item.type === 'kakao') data = await resolveKakaoPlace(item, kakaoKey);
      else if (item.type === 'naver') data = await resolveNaverPlace(item);
      else data = await resolveByName(item, kakaoKey);

      const payload = {
        ...data,
        rating: 0,
        curation_level: 1,
        features: {},
        tags: [],
        event_tags: [],
        curator_visited: false,
      };

      const { error } = await supabase.from('attractions').insert(payload).select('id').single();

      if (error) {
        if (error.code === '23505') console.log('이미 존재함');
        else { console.log('실패:', error.message); fail++; }
      } else {
        console.log('추가됨');
        ok++;
      }
    } catch (e) {
      console.log('오류:', e.message);
      fail++;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n완료: ${ok}개 추가, ${fail}개 실패`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
