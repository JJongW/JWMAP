/**
 * decisionEngine.ts
 * 
 * 의사결정 엔진: 사용자의 3단계 선택(동행, 시간대, 우선 조건)을 기반으로
 * 기존 locations 데이터에서 최적의 장소 3곳을 결정론적으로 선정한다.
 * 
 * LLM은 사용하지 않으며, 모든 로직은 규칙 기반이다.
 * 
 * 매핑 로직:
 * - Companion → Features 필터 (solo_ok, date_ok, group_ok)
 * - TimeSlot → 카테고리/시간대 가중치 (점심: 밥/면, 저녁: 고기/해산물, 늦은밤: 술안주/카페)
 * - PriorityFeature → 필수 Features 조건
 */

import type { Location, Features, CategoryMain } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';

// ─────────────────────────────────────────────
// 1. Companion → Features 매핑
// ─────────────────────────────────────────────

/** 동행 유형에 따라 필수로 충족해야 할 feature 키를 반환 */
function getCompanionFeatureKeys(companion: Companion): (keyof Features)[] {
  switch (companion) {
    case 'solo':
      return ['solo_ok'];
    case 'pair':
      return ['date_ok'];
    case 'group':
      return ['group_ok'];
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
// 3. PriorityFeature → Features 키 매핑
// ─────────────────────────────────────────────

/** 우선 조건 → 실제 Features 키 매핑 (fast_serve는 wait_short로 대체) */
function getPriorityFeatureKey(priority: PriorityFeature): keyof Features | null {
  switch (priority) {
    case 'quiet':
      return 'quiet';
    case 'wait_short':
      return 'wait_short';
    case 'fast_serve':
      // "빨리 나오는 곳"은 wait_short와 유사하게 취급
      return 'wait_short';
    case 'date_ok':
      return 'date_ok';
    case 'solo_ok':
      return 'solo_ok';
    default:
      return null;
  }
}

// ─────────────────────────────────────────────
// 4. 스코어링 함수
// ─────────────────────────────────────────────

interface ScoredLocation {
  location: Location;
  score: number;
  /** 디버그/이유 텍스트 생성용: 어떤 조건에 매칭됐는지 */
  matchedFeatures: string[];
}

function scoreLocation(
  location: Location,
  companion: Companion,
  timeSlot: TimeSlot,
  priorityFeature: PriorityFeature,
): ScoredLocation | null {
  const features = location.features || {};
  const matchedFeatures: string[] = [];
  let score = 0;

  // ── 필수 조건 1: PriorityFeature 매칭 (필수) ──
  const priorityKey = getPriorityFeatureKey(priorityFeature);
  if (priorityKey) {
    if (!features[priorityKey]) {
      // 우선 조건을 만족하지 않으면 제외
      return null;
    }
    score += 100; // 필수 조건 충족 가산점
    matchedFeatures.push(priorityKey);
  }

  // ── 보너스: Companion Feature 매칭 ──
  const companionKeys = getCompanionFeatureKeys(companion);
  for (const key of companionKeys) {
    if (features[key]) {
      score += 30;
      matchedFeatures.push(key);
    }
  }

  // ── 보너스: TimeSlot 카테고리 가중치 ──
  const categoryMain = location.categoryMain as CategoryMain | undefined;
  if (categoryMain && categoryMain !== '전체') {
    const weight = TIME_CATEGORY_WEIGHT[timeSlot][categoryMain] ?? 1;
    score += weight * 10;
  }

  // ── 보너스: late_night 시간대 매칭 ──
  if (timeSlot === 'late' && features.late_night) {
    score += 20;
    matchedFeatures.push('late_night');
  }

  // ── 보너스: 추가 Features 호환성 ──
  const allFeatureKeys: (keyof Features)[] = [
    'solo_ok', 'quiet', 'wait_short', 'date_ok', 'group_ok',
    'parking', 'pet_friendly', 'reservation', 'late_night',
  ];
  for (const key of allFeatureKeys) {
    if (features[key] && !matchedFeatures.includes(key)) {
      score += 5;
    }
  }

  // ── 보너스: 평점 가중치 ──
  // 평점을 0~20점 범위로 정규화 (1~5 → 0~20)
  const rating = location.rating ?? 0;
  score += Math.round((rating / 5) * 20);

  return { location, score, matchedFeatures };
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
      ? locations.filter((loc) => loc.region === region)
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

/** Features 키 → 사용자 친화적 텍스트 */
const FEATURE_TEXT: Record<string, string> = {
  solo_ok: '혼자 와도 편하고',
  quiet: '조용한 분위기에서',
  wait_short: '줄 거의 없이 바로 들어갈 수 있고',
  date_ok: '분위기가 좋고',
  group_ok: '여럿이 와도 넉넉하고',
  parking: '주차도 편하고',
  pet_friendly: '반려동물도 함께할 수 있고',
  reservation: '예약도 가능하고',
  late_night: '늦은 시간에도 열려 있어요',
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

  // 매칭된 features 중 상위 2개를 조합
  const featureTexts = scored.matchedFeatures
    .filter(key => FEATURE_TEXT[key])
    .map(key => FEATURE_TEXT[key])
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
  const sf = secondary.features || {};
  const pf = primary.features || {};

  // 보조 장소에만 있는 특징 찾기
  const allKeys: (keyof Features)[] = [
    'quiet', 'wait_short', 'date_ok', 'solo_ok', 'group_ok',
    'parking', 'reservation', 'late_night', 'pet_friendly',
  ];

  for (const key of allKeys) {
    if (sf[key] && !pf[key]) {
      const diffTexts: Record<string, string> = {
        quiet: '여긴 조금 더 조용해요',
        wait_short: '여긴 웨이팅이 더 짧아요',
        date_ok: '여긴 분위기가 더 좋아요',
        solo_ok: '여긴 혼밥하기 더 편해요',
        group_ok: '여긴 단체석이 넉넉해요',
        parking: '여긴 주차가 편해요',
        reservation: '여긴 예약이 가능해요',
        late_night: '여긴 더 늦게까지 해요',
        pet_friendly: '여긴 반려동물도 환영해요',
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
