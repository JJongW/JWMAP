/**
 * Batch import attractions from Kakao Place URLs.
 *
 * Usage:
 *   node scripts/batch-import-places.mjs [path-to-urls.txt]
 *   node scripts/batch-import-places.mjs   # reads from admin/scripts/place-urls.txt
 *
 * URL file format: one place URL per line (e.g. https://place.map.kakao.com/323413598)
 *
 * Env: Loads .env.local for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
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
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  return html.match(re)?.[1]?.trim() ?? null;
}

function extractTitle(html) {
  const og = extractMeta(html, 'og:title');
  if (og) return og.replace(/\s*[-|]\s*카카오맵.*$/i, '').trim();
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.replace(/\s*[-|]\s*카카오맵.*$/i, '').trim() ?? null;
}

function extractPlaceId(url) {
  const m = String(url).match(/place\.map\.kakao\.com\/(\d{4,})/i);
  return m?.[1] ?? null;
}

function extractAddress(html) {
  const og = extractMeta(html, 'og:description');
  if (og && /(?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n]{10,}/.test(og)) {
    const addr = og.match(/((?:서울|경기|인천|부산|대구|대전|광주|울산|세종|제주)[^\n]+)/)?.[1];
    if (addr) return addr.replace(/\s+/g, ' ').trim();
  }
  return null;
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
      if (address.includes(key)) {
        region = value;
        break;
      }
    }
  }
  const dongMatch = address.match(/\s([가-힣]+[동읍면리])\s?/);
  const sub_region = dongMatch?.[1] ?? null;
  return { region: region || province, sub_region };
}

function mapCategory(titleOrDesc) {
  const t = titleOrDesc || '';
  const l = t.toLowerCase();
  // 공간대여, 공원디파트먼트(브랜드) 등 → 복합문화공간 (공원 매칭보다 우선)
  if (l.includes('공간대여') || l.includes('공원디파트먼트') || l.includes('복합문화')) {
    return { main: '전시/문화', sub: '복합문화공간' };
  }
  if (l.includes('미술관')) return { main: '전시/문화', sub: '미술관' };
  if (l.includes('박물관')) return { main: '전시/문화', sub: '박물관' };
  if (l.includes('전시') || l.includes('갤러리')) return { main: '전시/문화', sub: '전시관' };
  if (l.includes('소품') || l.includes('소품샵')) return { main: '쇼핑/소품', sub: '소품샵' };
  if (l.includes('편집샵')) return { main: '쇼핑/소품', sub: '편집샵' };
  if (l.includes('서점')) return { main: '쇼핑/소품', sub: '독립서점' };
  if (l.includes('문화')) return { main: '전시/문화', sub: '복합문화공간' };
  // 공원/정원: 브랜드명(공원디파트먼트) 제외, 실제 공원·정원만
  if ((l.includes('공원') || l.includes('정원')) && !l.includes('디파트먼트')) {
    return { main: '공간/휴식', sub: '공원/정원' };
  }
  if (l.includes('팝업')) return { main: '팝업/이벤트', sub: '브랜드 팝업' };
  return { main: '전시/문화', sub: null };
}

async function fetchPlace(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'JWMAP-BatchImport/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function run() {
  loadEnv();

  const urlPath = process.argv[2] || join(__dirname, 'place-urls.txt');
  if (!existsSync(urlPath)) {
    console.error(`파일을 찾을 수 없습니다: ${urlPath}`);
    console.error('사용법: node scripts/batch-import-places.mjs [urls.txt]');
    process.exit(1);
  }

  const urlList = readFileSync(urlPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.startsWith('http') && l.includes('place.map.kakao.com'));

  if (urlList.length === 0) {
    console.error('place.map.kakao.com URL이 없습니다.');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('.env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i];
    const placeId = extractPlaceId(url);
    process.stdout.write(`[${i + 1}/${urlList.length}] ${placeId || url} ... `);

    try {
      const html = await fetchPlace(url);
      const name = extractTitle(html);
      const address = extractAddress(html);
      const { region, sub_region } = address ? extractRegion(address) : { region: '서울', sub_region: null };
      const { main: category_main, sub: category_sub } = mapCategory(name || extractMeta(html, 'og:description'));

      if (!name) {
        console.log('이름 추출 실패, 건너뜀');
        fail++;
        continue;
      }

      const payload = {
        name,
        address: address || '주소 미확인',
        region: region || '서울',
        sub_region,
        category_main: category_main || null,
        category_sub: category_sub || null,
        lon: 0,
        lat: 0,
        memo: `[배치 수집] ${url}`,
        short_desc: extractMeta(html, 'og:description')?.slice(0, 200) || null,
        rating: 0,
        curation_level: 1,
        features: {},
        tags: [],
        imageUrl: '',
        event_tags: [],
        kakao_place_id: placeId,
        naver_place_id: null,
        curator_visited: false,
      };

      const { error } = await supabase.from('attractions').insert(payload).select('id').single();

      if (error) {
        if (error.code === '23505') {
          console.log('이미 존재함 (중복)');
        } else {
          console.log('실패:', error.message);
          fail++;
        }
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
