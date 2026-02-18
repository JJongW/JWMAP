/**
 * Batch import attractions from place URLs or place names.
 * 블로그 리뷰를 수집하고 Gemini로 요약하여 풍부한 장소 정보를 생성합니다.
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
 *   - GOOGLE_API_KEY (Gemini 블로그 요약용, 없으면 요약 생략)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ─── ENV ─── */

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

/* ─── HTML helpers ─── */

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

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─── URL parsing ─── */

const KAKAO_PLACE_RE = /place\.map\.kakao\.com\/(\d{4,})/i;
const NAVER_PLACE_RE = /\/place\/(\d{4,})/i;

function parseLine(line) {
  const l = line.trim();
  if (!l || l.startsWith('#')) return null;
  const urlMatch = l.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch?.[1]?.replace(/[,)\]]+$/, '') ?? null;
  // URL 앞에 있는 장소명 힌트 추출
  const nameHint = l.replace(/\s*https?:\/\/.*$/, '').trim() || null;
  if (url) {
    if (KAKAO_PLACE_RE.test(url)) return { type: 'kakao', url, id: url.match(KAKAO_PLACE_RE)?.[1], nameHint };
    if (url.includes('naver') && NAVER_PLACE_RE.test(url)) return { type: 'naver', url, id: url.match(NAVER_PLACE_RE)?.[1], nameHint };
  }
  const nameOnly = l.replace(/\s+https?:\/\/.*$/, '').trim() || l.trim();
  if (nameOnly) return { type: 'name', query: nameOnly };
  return null;
}

/* ─── Region / Category ─── */

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

/**
 * 카카오 API category_name 기반 세부 카테고리 매핑
 * 예: "관광 > 명소 > 궁/왕릉" → { main: '역사/유적', sub: '궁궐/왕릉' }
 */
function mapCategory(categoryName, placeName) {
  const c = (categoryName || '').toLowerCase();
  const n = (placeName || '').toLowerCase();

  // 카카오 category_name 기반 (> 구분)
  if (c.includes('궁') || c.includes('왕릉')) return { main: '역사/유적', sub: '궁궐/왕릉' };
  if (c.includes('사찰') || c.includes('사원')) return { main: '역사/유적', sub: '사찰' };
  if (c.includes('유적') || c.includes('문화재') || c.includes('역사')) return { main: '역사/유적', sub: '유적지' };
  if (c.includes('테마파크') || c.includes('놀이공원')) return { main: '체험/레저', sub: '테마파크' };
  if (c.includes('체험') || c.includes('공방')) return { main: '체험/레저', sub: '체험/공방' };
  if (c.includes('미술관')) return { main: '전시/문화', sub: '미술관' };
  if (c.includes('박물관')) return { main: '전시/문화', sub: '박물관' };
  if (c.includes('전시') || c.includes('갤러리')) return { main: '전시/문화', sub: '전시관' };
  if (c.includes('공연') || c.includes('극장') || c.includes('콘서트')) return { main: '전시/문화', sub: '공연장' };
  if (c.includes('식물원') || c.includes('온실') || c.includes('수목원')) return { main: '자연/공원', sub: '식물원/수목원' };
  if (c.includes('공원') || c.includes('정원') || c.includes('숲')) return { main: '자연/공원', sub: '공원/정원' };
  if (c.includes('산') || c.includes('등산')) return { main: '자연/공원', sub: '산/등산' };
  if (c.includes('해수욕') || c.includes('바다') || c.includes('해변')) return { main: '자연/공원', sub: '해변' };
  if (c.includes('호수') || c.includes('하천') || c.includes('강')) return { main: '자연/공원', sub: '호수/하천' };
  if (c.includes('시장') || c.includes('전통시장')) return { main: '쇼핑/소품', sub: '전통시장' };
  if (c.includes('소품') || c.includes('소품샵')) return { main: '쇼핑/소품', sub: '소품샵' };
  if (c.includes('편집샵')) return { main: '쇼핑/소품', sub: '편집샵' };
  if (c.includes('서점') || c.includes('출판')) return { main: '쇼핑/소품', sub: '독립서점' };
  if (c.includes('팝업')) return { main: '팝업/이벤트', sub: '브랜드 팝업' };
  if (c.includes('복합문화') || c.includes('문화공간') || c.includes('공간대여')) return { main: '전시/문화', sub: '복합문화공간' };
  if (c.includes('관광') || c.includes('명소')) return { main: '관광명소', sub: '명소' };

  // 장소명 기반 fallback
  if (n.includes('궁') || n.includes('왕릉')) return { main: '역사/유적', sub: '궁궐/왕릉' };
  if (n.includes('미술관')) return { main: '전시/문화', sub: '미술관' };
  if (n.includes('박물관')) return { main: '전시/문화', sub: '박물관' };
  if (n.includes('온실') || n.includes('식물원') || n.includes('수목원')) return { main: '자연/공원', sub: '식물원/수목원' };
  if (n.includes('공원') || n.includes('정원')) return { main: '자연/공원', sub: '공원/정원' };
  if (n.includes('전시') || n.includes('갤러리')) return { main: '전시/문화', sub: '전시관' };
  if (n.includes('서점') || n.includes('출판사')) return { main: '쇼핑/소품', sub: '독립서점' };

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

/* ─── Fetch helpers ─── */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHtml(url, ua = BROWSER_UA, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    } catch (e) {
      if (attempt < retries) {
        await sleep(2000 * attempt);
      } else {
        throw e;
      }
    }
  }
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

/* ─── Blog scraping + Gemini summary ─── */

async function searchNaverBlogs(placeName, count = 3) {
  const query = encodeURIComponent(`${placeName} 방문 후기`);
  const url = `https://search.naver.com/search.naver?where=blog&query=${query}&sm=tab_opt&nso=so%3Ar%2Cp%3A1y`;
  try {
    const html = await fetchHtml(url);
    // 블로그 링크 추출
    const linkRe = /href="(https?:\/\/blog\.naver\.com\/[^"]+)"/g;
    const links = [];
    let m;
    while ((m = linkRe.exec(html)) !== null && links.length < count) {
      links.push(m[1]);
    }
    return links;
  } catch {
    return [];
  }
}

async function fetchBlogText(url) {
  try {
    const html = await fetchHtml(url);
    // 네이버 블로그는 iframe 기반 — 포스트 ID 추출 후 직접 접근
    const logNoM = html.match(/logNo=(\d+)/);
    const blogIdM = url.match(/blog\.naver\.com\/([^/?]+)/);
    if (logNoM && blogIdM) {
      const postUrl = `https://blog.naver.com/PostView.naver?blogId=${blogIdM[1]}&logNo=${logNoM[1]}&redirect=Dlog`;
      const postHtml = await fetchHtml(postUrl);
      const text = stripHtml(postHtml);
      return text.slice(0, 3000);
    }
    return stripHtml(html).slice(0, 3000);
  } catch {
    return '';
  }
}

async function collectBlogReviews(placeName) {
  const blogUrls = await searchNaverBlogs(placeName);
  if (blogUrls.length === 0) return '';
  const texts = [];
  for (const url of blogUrls) {
    const text = await fetchBlogText(url);
    if (text.length > 100) texts.push(text);
    await new Promise(r => setTimeout(r, 300));
  }
  return texts.join('\n---\n');
}

async function summarizeWithGemini(placeName, address, blogContent, apiKey) {
  if (!apiKey || !blogContent) return null;

  const prompt = `당신은 장소 정보 큐레이터입니다. 아래 블로그 리뷰들을 참고하여 "${placeName}" (${address})에 대한 방문 가이드를 작성하세요.

반드시 아래 JSON 형식으로만 응답하세요. memo 필드는 각 항목을 실제 줄바꿈(\\n)으로 구분하고, 정보가 없는 항목은 생략하세요. "방문 가이드" 같은 제목 텍스트는 절대 추가하지 마세요:
{
  "short_desc": "이 장소를 한 문장으로 설명 (50자 이내)",
  "memo": "⏰ 운영시간: ...\\n💰 입장료: ...\\n🚗 주차: ...\\n🚇 위치/교통: ...\\n⭐ 특징: ...\\n💡 방문팁: ...",
  "tags": ["관련 태그 3-5개, 예: 데이트, 사진맛집, 무료입장, 주차가능 등"]
}

블로그 리뷰:
${blogContent.slice(0, 6000)}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // JSON 추출 (코드펜스 제거)
    const jsonStr = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.log(`  [Gemini 요약 실패: ${e.message}]`);
    return null;
  }
}

/* ─── Tag linking ─── */

// 태그 이름 → type 추론 (간단 룰)
function inferTagType(name) {
  const n = name.toLowerCase();
  if (['봄', '여름', '가을', '겨울', '야간', '새벽', '일출', '일몰'].some(k => n.includes(k))) return 'season';
  if (['데이트', '가족', '혼자', '친구', '연인', '아이'].some(k => n.includes(k))) return 'situation';
  if (['감성', '조용', '활기', '힐링', '아늑', '트렌디', '레트로', '모던'].some(k => n.includes(k))) return 'mood';
  return 'feature';
}

async function linkTags(supabase, attractionId, tagNames) {
  for (const name of tagNames) {
    // 1. tags 테이블에 upsert (name unique constraint 활용)
    const { data: tag, error: tagErr } = await supabase
      .from('tags')
      .upsert({ name, type: inferTagType(name), domain: 'space' }, { onConflict: 'name' })
      .select('id')
      .single();
    if (tagErr || !tag) continue;

    // 2. attraction_tags join 연결
    await supabase
      .from('attraction_tags')
      .upsert({ location_id: attractionId, tag_id: tag.id }, { onConflict: 'location_id,tag_id' });
  }
}

/* ─── Place resolvers ─── */

async function resolveKakaoPlace(item, kakaoKey, geminiKey) {
  const html = await fetchHtml(item.url);
  const name = item.nameHint || extractTitle(html);
  const ogDesc = extractMeta(html, 'og:description');
  const address = extractAddressFromOg(ogDesc);
  const { region, sub_region } = extractRegion(address);

  // 카카오 API에서 상세 카테고리 가져오기
  let lat = 0, lon = 0;
  let kakaoCategoryName = '';
  if (kakaoKey) {
    const doc = await kakaoKeywordSearch(name || item.id, kakaoKey);
    if (doc) {
      lat = parseFloat(doc.y);
      lon = parseFloat(doc.x);
      kakaoCategoryName = doc.category_name || '';
    }
  }

  const { main: category_main, sub: category_sub } = mapCategory(kakaoCategoryName, name);

  // 블로그 리뷰 수집 + Gemini 요약
  process.stdout.write('블로그 수집...');
  const blogContent = await collectBlogReviews(name);
  let enriched = null;
  if (blogContent) {
    process.stdout.write('요약...');
    enriched = await summarizeWithGemini(name, address, blogContent, geminiKey);
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
    memo: enriched?.memo || `${item.url}`,
    short_desc: enriched?.short_desc || ogDesc?.slice(0, 200) || null,
    kakao_place_id: item.id,
    naver_place_id: null,
    imageUrl: extractMeta(html, 'og:image') || '',
    _tags: enriched?.tags || [],
  };
}

async function resolveNaverPlace(item, kakaoKey, geminiKey) {
  const url = `https://m.place.naver.com/place/${item.id}`;
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
  const html = await fetchHtml(url, ua);

  const name = item.nameHint || extractMeta(html, 'og:title') || extractTitle(html);
  const ogDesc = extractMeta(html, 'og:description');
  const address = extractAddressFromOg(ogDesc) ?? (html.match(/((?:서울|경기|인천|부산)[^<"']{8,80})/)?.[1]?.replace(/&amp;/g, '&').trim());
  const coords = extractCoordsFromHtml(html);
  const { region, sub_region } = extractRegion(address);

  // 카카오 API로 카테고리 보완
  let kakaoCategoryName = '';
  if (kakaoKey && name) {
    const doc = await kakaoKeywordSearch(name, kakaoKey);
    if (doc) kakaoCategoryName = doc.category_name || '';
  }
  const { main: category_main, sub: category_sub } = mapCategory(kakaoCategoryName, name);

  // 블로그 리뷰 수집 + Gemini 요약
  process.stdout.write('블로그 수집...');
  const blogContent = await collectBlogReviews(name);
  let enriched = null;
  if (blogContent) {
    process.stdout.write('요약...');
    enriched = await summarizeWithGemini(name, address, blogContent, geminiKey);
  }

  return {
    name: name || `장소 ${item.id}`,
    address: address || '주소 미확인',
    region: region || '서울',
    sub_region,
    category_main: category_main || null,
    category_sub: category_sub || null,
    lat: coords.lat ?? 0,
    lon: coords.lon ?? 0,
    memo: enriched?.memo || `${url}`,
    short_desc: enriched?.short_desc || ogDesc?.replace(/#[\w가-힣_-]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200) || null,
    kakao_place_id: null,
    naver_place_id: item.id,
    imageUrl: extractMeta(html, 'og:image') || '',
    _tags: enriched?.tags || [],
  };
}

async function resolveByName(item, kakaoKey, geminiKey) {
  if (!kakaoKey) throw new Error('장소명 검색에는 KAKAO_REST_API_KEY가 필요합니다.');
  const doc = await kakaoKeywordSearch(item.query, kakaoKey);
  if (!doc) throw new Error('검색 결과 없음');

  const address = doc.road_address_name || doc.address_name;
  const { region, sub_region } = extractRegion(address);
  const { main: category_main, sub: category_sub } = mapCategory(doc.category_name || doc.category_group_name || '', doc.place_name);

  // 블로그 리뷰 수집 + Gemini 요약
  process.stdout.write('블로그 수집...');
  const blogContent = await collectBlogReviews(doc.place_name);
  let enriched = null;
  if (blogContent) {
    process.stdout.write('요약...');
    enriched = await summarizeWithGemini(doc.place_name, address, blogContent, geminiKey);
  }

  return {
    name: doc.place_name,
    address: address || '주소 미확인',
    region: region || '서울',
    sub_region,
    category_main: category_main || null,
    category_sub: category_sub || null,
    lat: parseFloat(doc.y),
    lon: parseFloat(doc.x),
    memo: enriched?.memo || `카카오 검색: ${item.query}`,
    short_desc: enriched?.short_desc || null,
    kakao_place_id: doc.id,
    naver_place_id: null,
    imageUrl: '',
    _tags: enriched?.tags || [],
  };
}

/* ─── Main ─── */

async function run() {
  loadEnv();

  const listPath = process.argv[2] || join(__dirname, 'place-urls.txt');
  if (!existsSync(listPath)) {
    console.error(`파일을 찾을 수 없습니다: ${listPath}`);
    console.error('사용법: node scripts/batch-import-places.mjs [목록파일.txt]');
    process.exit(1);
  }

  const lines = readFileSync(listPath, 'utf8').split('\n');
  const items = lines.map(parseLine).filter(Boolean);

  if (items.length === 0) {
    console.error('유효한 URL 또는 장소명이 없습니다.');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('.env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY를 설정하세요.');
    process.exit(1);
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY ?? process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;
  if (!geminiKey) console.log('⚠️  GOOGLE_API_KEY 없음 — 블로그 요약 건너뜀\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  let ok = 0, fail = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const label = item.type === 'name' ? item.query : (item.nameHint || item.id || item.url);
    process.stdout.write(`[${i + 1}/${items.length}] ${label} ... `);

    try {
      // 중복 체크 (kakao_place_id 기준)
      if (item.type === 'kakao' || item.type === 'naver') {
        const idCol = item.type === 'kakao' ? 'kakao_place_id' : 'naver_place_id';
        const { count } = await supabase.from('attractions').select('*', { count: 'exact', head: true }).eq(idCol, item.id);
        if (count > 0) { console.log('이미 존재함 (스킵)'); await sleep(500); continue; }
      }

      let data;
      if (item.type === 'kakao') data = await resolveKakaoPlace(item, kakaoKey, geminiKey);
      else if (item.type === 'naver') data = await resolveNaverPlace(item, kakaoKey, geminiKey);
      else data = await resolveByName(item, kakaoKey, geminiKey);

      const { _tags, ...dbData } = data;
      const payload = {
        ...dbData,
        rating: 0,
        curation_level: 1,
        tags: _tags.length > 0 ? _tags : [],
        event_tags: [],
        curator_visited: false,
      };

      const { data: inserted, error } = await supabase.from('attractions').insert(payload).select('id').single();

      if (error) {
        if (error.code === '23505') console.log('이미 존재함');
        else { console.log('실패:', error.message); fail++; }
      } else {
        // tags 테이블에 upsert 후 attraction_tags join 연결
        if (_tags.length > 0) {
          await linkTags(supabase, inserted.id, _tags);
        }
        console.log('추가됨');
        ok++;
      }
    } catch (e) {
      console.log('오류:', e.message);
      fail++;
    }

    await sleep(3000);
  }

  console.log(`\n완료: ${ok}개 추가, ${fail}개 실패`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
