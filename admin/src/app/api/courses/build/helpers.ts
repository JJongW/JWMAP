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

  if (/전시|갤러리|미술관|박물관|도서관|library|팝업|공원|산책|전망|포토스팟/.test(t)) {
    if (t.includes('도서관') || t.includes('library')) return { category_main: '전시/문화', category_sub: '도서관' };
    if (t.includes('공원') || t.includes('산책')) return { category_main: '공간/휴식', category_sub: '공원/정원' };
    if (t.includes('팝업')) return { category_main: '팝업/이벤트', category_sub: '브랜드 팝업' };
    if (t.includes('미술관')) return { category_main: '전시/문화', category_sub: '미술관' };
    return { category_main: '전시/문화', category_sub: '전시관' };
  }

  if (/문구|팬시|stationery/.test(t)) {
    return { category_main: '쇼핑/소품', category_sub: '문구점' };
  }

  if (/카페|커피|라떼|디저트|베이커리|카공/.test(t)) {
    if (t.includes('카공')) return { category_main: '카페', category_sub: '카공카페' };
    if (t.includes('디저트') || t.includes('베이커리')) return { category_main: '디저트', category_sub: '베이커리' };
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
