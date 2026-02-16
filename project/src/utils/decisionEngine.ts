/**
 * decisionEngine.ts
 * 
 * 의사결정 엔진: 사용자의 3단계 선택(동행, 시간대, 우선 조건)을 기반으로
 * 기존 locations 데이터에서 최적의 장소 3곳을 결정론적으로 선정한다.
 * 
 * LLM은 사용하지 않으며, 모든 로직은 규칙 기반이다.
 * 
 * 매핑 로직:
 * - Companion → 태그 필터 (혼밥, 데이트, 모임)
 * - TimeSlot → 카테고리/시간대 가중치 (점심: 밥/면, 저녁: 고기/해산물, 늦은밤: 술안주/카페)
 * - PriorityFeature → 필수 태그 조건
 */

import type { Location, CategoryMain } from '../types/location';
import { PROVINCES, inferProvinceFromRegion } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';

// ─────────────────────────────────────────────
// 1. Companion → 태그 매핑
// ─────────────────────────────────────────────

/** 동행 유형에 따라 우선 매칭할 태그 키워드를 반환 */
function getCompanionTagKeywords(companion: Companion): string[] {
  switch (companion) {
    case 'solo':
      return ['혼밥', '혼자'];
    case 'pair':
      return ['데이트', '분위기'];
    case 'group':
      return ['모임', '단체', '회식'];
  }
}

// ─────────────────────────────────────────────
// 2. TimeSlot → 카테고리 선호도 가중치
// ─────────────────────────────────────────────

/** 시간대별 카테고리 가중치. 높을수록 해당 시간대에 어울림 */
const TIME_CATEGORY_WEIGHT: Record<TimeSlot, Partial<Record<CategoryMain, number>>> = {
  lunch: {
    '밥': 3,
    '면': 3,
    '국물': 2,
    '간편식': 2,
    '양식·퓨전': 2,
    '고기요리': 1,
    '해산물': 1,
    '디저트': 1,
    '카페': 1,
    '술안주': 0,
  },
  dinner: {
    '고기요리': 3,
    '해산물': 3,
    '양식·퓨전': 3,
    '국물': 2,
    '밥': 2,
    '면': 2,
    '술안주': 2,
    '디저트': 1,
    '카페': 1,
    '간편식': 1,
  },
  late: {
    '술안주': 3,
    '카페': 2,
    '면': 2,
    '국물': 2,
    '간편식': 2,
    '고기요리': 1,
    '밥': 1,
    '양식·퓨전': 1,
    '해산물': 0,
    '디저트': 1,
  },
};

// ─────────────────────────────────────────────
// 3. PriorityFeature → 태그 키워드 매핑
// ─────────────────────────────────────────────

/** 우선 조건 → 실제 태그 키워드 매핑 */
function getPriorityTagKeywords(priority: PriorityFeature): string[] {
  switch (priority) {
    case 'quiet':
      return ['조용', '차분'];
    case 'wait_short':
      return ['웨이팅 적음', '대기 없음', '바로입장'];
    case 'fast_serve':
      return ['빠른', '웨이팅 적음', '회전 빠름'];
    case 'date_ok':
      return ['데이트', '분위기'];
    case 'solo_ok':
      return ['혼밥', '혼자'];
    default:
      return [];
  }
}

function hasTagKeyword(location: Location, keywords: string[]): boolean {
  const tags = location.tags || [];
  if (tags.length === 0 || keywords.length === 0) return false;
  const lowerTags = tags.map((tag) => tag.toLowerCase());
  return keywords.some((keyword) => lowerTags.some((tag) => tag.includes(keyword.toLowerCase())));
}

// ─────────────────────────────────────────────
// 4. 스코어링 함수
// ─────────────────────────────────────────────

interface ScoredLocation {
  location: Location;
  score: number;
  matchedTags: string[];
}

function scoreLocation(
  location: Location,
  companion: Companion,
  timeSlot: TimeSlot,
  priorityFeature: PriorityFeature,
): ScoredLocation | null {
  const matchedTags: string[] = [];
  let score = 0;

  const priorityKeywords = getPriorityTagKeywords(priorityFeature);
  if (priorityKeywords.length > 0 && !hasTagKeyword(location, priorityKeywords)) {
    return null;
  }
  if (priorityKeywords.length > 0) {
    score += 100; // 필수 조건 충족 가산점
    matchedTags.push(priorityKeywords[0]);
  }

  // ── 보너스: Companion 태그 매칭 ──
  const companionKeywords = getCompanionTagKeywords(companion);
  if (hasTagKeyword(location, companionKeywords)) {
    score += 30;
    matchedTags.push(companionKeywords[0]);
  }

  // ── 보너스: TimeSlot 카테고리 가중치 ──
  const categoryMain = location.categoryMain as CategoryMain | undefined;
  if (categoryMain && categoryMain !== '전체') {
    const weight = TIME_CATEGORY_WEIGHT[timeSlot][categoryMain] ?? 1;
    score += weight * 10;
  }

  // ── 보너스: late_night 시간대 매칭 ──
  if (timeSlot === 'late' && hasTagKeyword(location, ['심야', '야식', '늦게'])) {
    score += 20;
    matchedTags.push('심야');
  }

  // ── 보너스: 추가 태그 호환성 ──
  const bonusKeywords = [
    '벚꽃',
    '산책',
    '야경',
    '포토스팟',
    '조용',
    '가성비',
    '브런치',
    '전시',
  ];
  for (const keyword of bonusKeywords) {
    if (hasTagKeyword(location, [keyword]) && !matchedTags.includes(keyword)) {
      score += 5;
      matchedTags.push(keyword);
    }
  }

  // ── 보너스: 평점 가중치 ──
  // 평점을 0~20점 범위로 정규화 (1~5 → 0~20)
  const rating = location.rating ?? 0;
  score += Math.round((rating / 5) * 20);

  return { location, score, matchedTags };
}

// ─────────────────────────────────────────────
// 5. 메인 결정 함수
// ─────────────────────────────────────────────

export interface DecisionResult {
  /** 1순위 추천 */
  primary: Location;
  /** 2~3순위 보조 추천 */
  secondary: Location[];
  /** 각 추천에 대한 이유 텍스트 */
  reasons: Map<string, string>;
}

/**
 * 사용자 입력을 기반으로 최적의 장소 3곳을 선정한다.
 *
 * @param locations - 전체 장소 데이터
 * @param companion - 동행 유형
 * @param timeSlot - 시간대
 * @param priorityFeature - 우선 조건
 * @param region - 지역 필터 (null이면 전체)
 * @returns 추천 결과 (3곳) 또는 null (결과 없음)
 */
export function decideLocations(
  locations: Location[],
  companion: Companion,
  timeSlot: TimeSlot,
  priorityFeature: PriorityFeature,
  region?: string | null,
): DecisionResult | null {
  const candidates =
    region && region.trim()
      ? (PROVINCES as readonly string[]).includes(region)
        ? locations.filter((loc) => inferProvinceFromRegion(loc.region) === region || loc.province === region)
        : locations.filter((loc) => loc.region === region)
      : locations;

  const scored: ScoredLocation[] = [];
  for (const loc of candidates) {
    const result = scoreLocation(loc, companion, timeSlot, priorityFeature);
    if (result) {
      scored.push(result);
    }
  }

  if (scored.length === 0) return null;

  // 스코어 내림차순 정렬 → 동점이면 평점 내림차순
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.location.rating ?? 0) - (a.location.rating ?? 0);
  });

  // 상위 3개 선정 (최소 1개)
  const top = scored.slice(0, 3);
  const primary = top[0].location;
  const secondary = top.slice(1).map(s => s.location);

  // 이유 텍스트 생성
  const reasons = new Map<string, string>();
  for (const item of top) {
    reasons.set(item.location.id, generateReason(item, companion, timeSlot));
  }

  return { primary, secondary, reasons };
}

// ─────────────────────────────────────────────
// 6. 이유 텍스트 생성
// ─────────────────────────────────────────────

/** 태그 키워드 → 사용자 친화적 텍스트 */
const TAG_TEXT: Record<string, string> = {
  혼밥: '혼자 와도 편하고',
  데이트: '데이트하기 좋고',
  모임: '여럿이 오기 좋고',
  조용: '조용한 분위기에서',
  심야: '늦은 시간에도 열려 있고',
  벚꽃: '계절감이 좋아서',
  산책: '걷기 좋은 동선이 있고',
  야경: '야경이 매력적이고',
  포토스팟: '사진 찍기 좋고',
};

const TIME_TEXT: Record<TimeSlot, string> = {
  lunch: '점심시간',
  dinner: '저녁시간',
  late: '이 시간대',
};

function generateReason(
  scored: ScoredLocation,
  _companion: Companion,
  timeSlot: TimeSlot,
): string {
  const loc = scored.location;

  // short_desc가 있으면 활용
  if (loc.short_desc) {
    return loc.short_desc;
  }

  const featureTexts = scored.matchedTags
    .filter(key => TAG_TEXT[key])
    .map(key => TAG_TEXT[key])
    .slice(0, 2);

  if (featureTexts.length >= 2) {
    return `${featureTexts[0]}, ${TIME_TEXT[timeSlot]}에 ${featureTexts[1].replace('요', '')}요.`;
  }

  if (featureTexts.length === 1) {
    return `${featureTexts[0]}, ${TIME_TEXT[timeSlot]}에 가기 딱 좋아요.`;
  }

  // fallback
  return `${TIME_TEXT[timeSlot]}에 가기 좋은 곳이에요.`;
}

// ─────────────────────────────────────────────
// 7. 보조 추천 차별화 텍스트
// ─────────────────────────────────────────────

/**
 * 보조 추천 장소에 대해 1순위와 차별화되는 포인트를 한 줄로 설명
 */
export function getDifferentiator(
  secondary: Location,
  primary: Location,
): string {
  const secondaryTags = secondary.tags || [];
  const primaryTags = new Set(primary.tags || []);
  const allKeys = [
    '조용',
    '웨이팅',
    '데이트',
    '혼밥',
    '모임',
    '주차',
    '예약',
    '심야',
    '반려동물',
  ];

  for (const key of allKeys) {
    const hasSecondary = secondaryTags.some((tag) => tag.includes(key));
    const hasPrimary = [...primaryTags].some((tag) => tag.includes(key));
    if (hasSecondary && !hasPrimary) {
      const diffTexts: Record<string, string> = {
        조용: '여긴 조금 더 조용해요',
        웨이팅: '여긴 웨이팅이 더 짧아요',
        데이트: '여긴 분위기가 더 좋아요',
        혼밥: '여긴 혼밥하기 더 편해요',
        모임: '여긴 모임에 더 잘 맞아요',
        주차: '여긴 주차가 편해요',
        예약: '여긴 예약이 가능해요',
        심야: '여긴 더 늦게까지 해요',
        반려동물: '여긴 반려동물도 환영해요',
      };
      return diffTexts[key] || '';
    }
  }

  // 평점 비교
  if ((secondary.rating ?? 0) > (primary.rating ?? 0)) {
    return '여긴 평점이 조금 더 높아요';
  }

  // short_desc fallback
  if (secondary.short_desc) {
    return secondary.short_desc;
  }

  return '이곳도 좋은 선택이에요';
}
