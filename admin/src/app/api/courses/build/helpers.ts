import { createHash } from 'crypto';
import { ATTRACTION_CATEGORY_MAINS } from '@/lib/constants';

type DomainTable = 'locations' | 'attractions';
type TagType = 'mood' | 'feature' | 'situation' | 'season';

const CHAIN_KEYWORDS = ['스타벅스', '투썸', '메가커피', '이디야', '빽다방', '맘스터치', '버거킹', '맥도날드'];
const SITUATION_TAGS = ['데이트', '카공', '혼밥', '혼술', '가족모임', '친구모임', '산책', '드라이브'];
const MOOD_KEYWORDS = ['감성', '조용', '아늑', '빈티지', '모던', '힙', '고즈넉', '뷰맛집', '로컬', '활기'];

export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const int = Math.round(value);
  return Math.max(min, Math.min(max, int));
}

export function uniqueTags(tags: string[]): string[] {
  const normalized = tags
    .map((t) => t.trim().replace(/^#/, ''))
    .filter((t) => t.length > 1 && t.length <= 20);
  return [...new Set(normalized)].slice(0, 20);
}

export function inferTagType(tag: string): TagType {
  if (SITUATION_TAGS.includes(tag)) return 'situation';
  if (['봄', '여름', '가을', '겨울', '벚꽃', '단풍', '크리스마스'].includes(tag)) return 'season';
  if (MOOD_KEYWORDS.some((k) => tag.includes(k))) return 'mood';
  return 'feature';
}

export function isLikelyChain(name: string, note: string): boolean {
  const text = `${name} ${note}`.toLowerCase();
  return CHAIN_KEYWORDS.some((k) => text.includes(k.toLowerCase())) || text.includes('체인');
}

interface AiEnrichmentLike {
  curation_level: number | null;
  is_chain: boolean;
  waiting_hotspot: boolean;
}

export function enforceCurationRules(enriched: AiEnrichmentLike, name: string, note: string): number {
  let level = enriched.curation_level ?? 3;
  const chain = enriched.is_chain || isLikelyChain(name, note);
  const wait = enriched.waiting_hotspot || /웨이팅|줄\s?김|오픈런|대기/.test(note);
  const localPopular = /로컬|현지인|핫플|인기|성지/.test(note);

  if (chain) level = Math.min(level, 3);
  if (wait && localPopular) level = Math.max(level, 4);

  return Math.max(1, Math.min(5, level));
}

export function pickDomain(categoryMain: string | null): DomainTable {
  if (categoryMain && ATTRACTION_CATEGORY_MAINS.includes(categoryMain)) return 'attractions';
  return 'locations';
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function walkingDistanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const raw = haversineMeters(a.lat, a.lon, b.lat, b.lon);
  return Math.round(raw * 1.35);
}

export function buildCourseHash(placeIds: string[]): string {
  return createHash('sha256').update(placeIds.join('|')).digest('hex').slice(0, 16);
}

export function inferCategoryFromText(text: string): { category_main: string | null; category_sub: string | null } {
  const t = text.toLowerCase();

  // 전시/문화/공간
  if (/전시|갤러리|미술관|박물관|도서관|library|팝업|공원|산책|전망|포토스팟/.test(t)) {
    if (t.includes('도서관') || t.includes('library')) return { category_main: '전시/문화', category_sub: '도서관' };
    if (t.includes('공원') || t.includes('산책')) return { category_main: '공간/휴식', category_sub: '공원/정원' };
    if (t.includes('팝업')) return { category_main: '팝업/이벤트', category_sub: '브랜드 팝업' };
    if (t.includes('미술관')) return { category_main: '전시/문화', category_sub: '미술관' };
    return { category_main: '전시/문화', category_sub: '전시관' };
  }

  // 쇼핑
  if (/문구|팬시|stationery/.test(t)) return { category_main: '쇼핑/소품', category_sub: '문구점' };
  if (/편집샵|소품샵/.test(t)) return { category_main: '쇼핑/소품', category_sub: '편집샵' };
  if (/서점|독립서점/.test(t)) return { category_main: '쇼핑/소품', category_sub: '독립서점' };

  // 고기/구이
  if (/삼겹살|소고기|돼지고기|갈비|구이|바비큐|bbq|고깃집/.test(t)) return { category_main: '고기요리', category_sub: '구이' };
  if (/스테이크/.test(t)) return { category_main: '고기요리', category_sub: '스테이크' };

  // 해산물
  if (/회|해산물|해물|초밥|스시|굴|조개/.test(t)) return { category_main: '해산물', category_sub: '회' };

  // 면요리
  if (/라멘|라면|파스타|국수|냉면|우동|쌀국수/.test(t)) {
    if (t.includes('파스타')) return { category_main: '양식·퓨전', category_sub: '파스타' };
    return { category_main: '면', category_sub: '면요리' };
  }

  // 양식/브런치 (카페보다 먼저 체크 — 브런치를 카페로 잘못 분류 방지)
  if (/브런치|양식|레스토랑|restaurant|이탈리안|프렌치|파인다이닝|비스트로|다이닝/.test(t)) {
    if (t.includes('브런치')) return { category_main: '양식·퓨전', category_sub: '브런치' };
    if (t.includes('이탈리안') || t.includes('파스타')) return { category_main: '양식·퓨전', category_sub: '파스타' };
    if (t.includes('프렌치') || t.includes('프랑스')) return { category_main: '양식·퓨전', category_sub: '프랑스' };
    return { category_main: '양식·퓨전', category_sub: '양식' };
  }

  // 한식
  if (/한식|백반|정식|한정식|국밥|찌개|된장|비빔밥/.test(t)) return { category_main: '밥', category_sub: '한식' };

  // 술집
  if (/이자카야|와인바|포차|호프|안주|칵테일바/.test(t)) {
    if (t.includes('이자카야')) return { category_main: '술안주', category_sub: '이자카야' };
    if (t.includes('와인')) return { category_main: '카페', category_sub: '와인바/바' };
    return { category_main: '술안주', category_sub: '안주 전문' };
  }

  // 디저트/베이커리 (카페 전에 체크)
  if (/디저트|베이커리|빵집|케이크|도넛|마카롱|아이스크림/.test(t)) {
    if (t.includes('케이크')) return { category_main: '디저트', category_sub: '케이크' };
    return { category_main: '디저트', category_sub: '베이커리' };
  }

  // 카페 (마지막 — 브런치/양식 분류 후 진입)
  if (/카페|커피|라떼|카공/.test(t)) {
    if (t.includes('카공')) return { category_main: '카페', category_sub: '카공카페' };
    return { category_main: '카페', category_sub: '커피' };
  }

  return { category_main: null, category_sub: null };
}

export function parseJsonChunk(text: string): Record<string, unknown> | null {
  const chunk = text.match(/\{[\s\S]*\}/)?.[0];
  if (!chunk) return null;
  try {
    return JSON.parse(chunk) as Record<string, unknown>;
  } catch {
    return null;
  }
}
