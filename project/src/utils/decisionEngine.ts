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

import type { Location, CategoryMain, ContentMode } from '../types/location';
import { PROVINCES, inferProvinceFromRegion } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';
import { getCuratorReason, isCuratorVisited } from './curation';
import { getConditionLabels, type IntentConditions } from './intentChips';
import { findTermEvidence, termLabel } from './taxonomy';

// ─────────────────────────────────────────────
// 1. Companion → 태그 매핑
// ─────────────────────────────────────────────

/** 동행 유형에 따라 우선 매칭할 태그 키워드를 반환 */
function getCompanionTagKeywords(companion: Companion): string[] {
  switch (companion) {
    case 'solo':
      return ['혼밥', '혼자'];
    case 'pair':
      // '분위기'만으로는 '조용한 분위기'까지 걸려 둘이 근거로 잘못 쓰이므로 구체적인 태그만 본다
      return ['데이트', '소개팅', '분위기좋은', '분위기 좋은'];
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

/** 볼거리 우선 조건 → 볼거리 데이터에 실제로 있는 태그 키워드 (라벨: intentChips SPACE_PRIORITY_LABEL) */
const SPACE_PRIORITY_KEYWORDS: Record<PriorityFeature, string[]> = {
  quiet: ['조용', '차분', '한적'],
  wait_short: ['실내'],
  fast_serve: ['소품', '쇼룸', '서점'],
  date_ok: ['포토', '사진'],
  solo_ok: ['산책'],
};

/** 우선 조건 → 실제 태그 키워드 매핑. 볼거리는 같은 값이라도 뜻이 달라 키워드를 따로 쓴다 */
function getPriorityTagKeywords(priority: PriorityFeature, mode: ContentMode = 'food'): string[] {
  if (mode === 'space') return SPACE_PRIORITY_KEYWORDS[priority];
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
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priorityFeature: PriorityFeature | null;
}

function addMatchedTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) tags.push(tag);
}

function scoreLocation(
  location: Location,
  companion: Companion | null,
  timeSlot: TimeSlot | null,
  priorityFeature: PriorityFeature | null,
  mode: ContentMode = 'food',
): ScoredLocation | null {
  const matchedTags: string[] = [];
  let score = 0;

  const priorityKeywords = priorityFeature ? getPriorityTagKeywords(priorityFeature, mode) : [];
  if (priorityKeywords.length > 0 && !hasTagKeyword(location, priorityKeywords)) {
    return null;
  }
  if (priorityKeywords.length > 0) {
    score += 100; // 필수 조건 충족 가산점
    addMatchedTag(matchedTags, priorityKeywords[0]);
  }

  // ── 보너스: Companion 태그 매칭 ──
  const companionKeywords = companion ? getCompanionTagKeywords(companion) : [];
  if (hasTagKeyword(location, companionKeywords)) {
    score += 30;
    addMatchedTag(matchedTags, companionKeywords[0]);
  }

  // 둘이·여럿이인데 혼밥 위주 가게면 뒤로 민다 (혼밥 태그가 데이트·모임 후보로 섞이지 않게)
  if (companion && companion !== 'solo' && hasTagKeyword(location, ['혼밥', '혼자'])) {
    score -= 40;
  }

  // ── 보너스: 운영자가 직접 다녀온 곳을 먼저 (미방문 후보는 맞는 곳이 없을 때만 앞에 온다) ──
  if (isCuratorVisited(location)) {
    score += 50;
  }

  // ── 보너스: TimeSlot 카테고리 가중치 (맛집 카테고리 기준이라 볼거리에는 쓰지 않는다) ──
  const categoryMain = location.categoryMain as CategoryMain | undefined;
  if (mode === 'food' && timeSlot && categoryMain && categoryMain !== '전체') {
    const weight = TIME_CATEGORY_WEIGHT[timeSlot][categoryMain] ?? 1;
    score += weight * 10;
  }

  // ── 보너스: late_night 시간대 매칭 ──
  if (timeSlot === 'late' && hasTagKeyword(location, ['심야', '야식', '늦게'])) {
    score += 20;
    addMatchedTag(matchedTags, '심야');
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
      addMatchedTag(matchedTags, keyword);
    }
  }

  // ── 보너스: 평점 가중치 ──
  // 평점을 0~20점 범위로 정규화 (1~5 → 0~20)
  const rating = location.rating ?? 0;
  score += Math.round((rating / 5) * 20);

  return { location, score, matchedTags, companion, timeSlot, priorityFeature };
}

// ─────────────────────────────────────────────
// 5. 메인 결정 함수
// ─────────────────────────────────────────────

export interface DecisionResult {
  /** 1순위 추천 */
  primary: Location;
  /** 2~3순위 보조 추천 */
  secondary: Location[];
  /** 각 추천의 운영자 한 줄. 없으면 빈 문자열 — 이유 문장을 지어내지 않는다 */
  reasons: Map<string, string>;
  /** 식사 추천과 따로 보여줄 식후 카페 (밥집·카페를 따로 고르지 않았을 때만) */
  afterCafe?: Location;
}

/** 카페·디저트는 식사 후보와 섞이지 않도록 따로 본다 */
export function isCafeLike(location: Location): boolean {
  return location.categoryMain === '카페' || location.categoryMain === '디저트';
}

/**
 * 사용자 조건을 기반으로 최적의 장소 3곳을 선정한다.
 * 비어 있는 조건(null)은 점수에 반영하지 않는다.
 *
 * @returns 추천 결과 (3곳) 또는 null (결과 없음)
 */
export function decideLocations(
  locations: Location[],
  conditions: IntentConditions,
  mode: ContentMode = 'food',
): DecisionResult | null {
  const { region, companion, timeSlot, priority: priorityFeature, kind } = conditions;
  const regionMatched =
    region && region.trim()
      ? (PROVINCES as readonly string[]).includes(region)
        ? locations.filter((loc) => inferProvinceFromRegion(loc.region) === region || loc.province === region)
        : locations.filter((loc) => loc.region === region)
      : locations;
  // 장소 종류·추천하는 이유·상황은 근거가 있는 곳만 남긴다 (여러 개면 모두)
  const inRegion = regionMatched.filter((loc) => matchesTerms(loc, conditions));
  const meals = inRegion.filter((loc) => !isCafeLike(loc));
  const cafes = inRegion.filter(isCafeLike);
  // 종류를 안 골랐으면 식사 후보에서 카페를 빼고, 카페는 '식후 카페'로 따로 고른다.
  // 지역에 식사 후보가 없을 때만 카페를 메인으로 올린다.
  const candidates =
    kind === 'cafe' ? cafes
    : kind === 'meal' ? meals
    : meals.length > 0 ? meals : cafes;

  const scored = rankLocations(candidates, companion, timeSlot, priorityFeature, mode);
  if (scored.length === 0) return null;

  // 상위 3개 선정 (최소 1개)
  const top = scored.slice(0, 3);
  const primary = top[0].location;
  const secondary = top.slice(1).map(s => s.location);

  const reasons = new Map<string, string>();
  for (const item of top) {
    reasons.set(item.location.id, getCuratorReason(item.location));
  }

  let afterCafe: Location | undefined;
  if (kind === null && candidates === meals && cafes.length > 0) {
    // 식후 카페도 고른 우선 조건을 지키는 곳만. 없으면 조건을 빼고 고르지 않고 칸을 비운다
    afterCafe = rankLocations(cafes, companion, null, priorityFeature, mode)[0]?.location;
  }

  return { primary, secondary, reasons, afterCafe };
}

function matchesTerms(location: Location, conditions: IntentConditions): boolean {
  const slugs = [conditions.placeType, ...conditions.reasons, ...conditions.situations].filter(
    (slug): slug is string => Boolean(slug),
  );
  const operatorText = getCuratorReason(location);
  return slugs.every((slug) => findTermEvidence(location, slug, operatorText) !== null);
}

/** 점수순 정렬 (동점이면 평점순). 우선 조건을 못 지키는 곳은 빠진다 */
function rankLocations(
  candidates: Location[],
  companion: Companion | null,
  timeSlot: TimeSlot | null,
  priorityFeature: PriorityFeature | null,
  mode: ContentMode = 'food',
): ScoredLocation[] {
  const scored = candidates
    .map((loc) => scoreLocation(loc, companion, timeSlot, priorityFeature, mode))
    .filter((item): item is ScoredLocation => item !== null);
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.location.rating ?? 0) - (a.location.rating ?? 0);
  });
}

// ─────────────────────────────────────────────
// 5-1. 고른 조건과 맞는 점 (결과 카드 설명용)
// ─────────────────────────────────────────────

export interface ConditionMatch {
  /** 사용자가 고른 조건 이름 (예: '조용한 곳') */
  label: string;
  /** 맞는 근거. 데이터로 확인 못 하면 null — 지어내지 않는다 */
  evidence: string | null;
}

function findTag(location: Location, keywords: string[]): string | null {
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return location.tags?.find((tag) => lowered.some((keyword) => tag.toLowerCase().includes(keyword))) ?? null;
}

/** 누구와·시간·분위기 조건마다 이 장소가 왜 맞는지 근거를 찾는다 (지역·종류는 이미 필터로 걸러짐) */
export function getConditionMatches(
  location: Location,
  conditions: IntentConditions,
  mode: ContentMode = 'food',
): ConditionMatch[] {
  const matches: ConditionMatch[] = [];
  const labels = getConditionLabels(mode);

  if (conditions.companion) {
    const tag = findTag(location, getCompanionTagKeywords(conditions.companion));
    matches.push({ label: labels.companion[conditions.companion], evidence: tag ? `#${tag}` : null });
  }

  if (conditions.timeSlot) {
    // 시간 근거는 맛집 카테고리로만 판단할 수 있다. 볼거리는 근거 데이터가 없어 지어내지 않는다
    const categoryMain = mode === 'food' ? (location.categoryMain as CategoryMain | undefined) : undefined;
    const weight = categoryMain ? TIME_CATEGORY_WEIGHT[conditions.timeSlot][categoryMain] ?? 0 : 0;
    const lateTag = mode === 'food' && conditions.timeSlot === 'late' ? findTag(location, ['심야', '야식', '늦게']) : null;
    const timeLabel = labels.timeSlot[conditions.timeSlot];
    matches.push({
      label: timeLabel,
      evidence: lateTag
        ? `#${lateTag}`
        : weight >= 2 && categoryMain
          ? `${timeLabel}에 잘 맞는 ${categoryMain}`
          : null,
    });
  }

  if (conditions.priority) {
    const tag = findTag(location, getPriorityTagKeywords(conditions.priority, mode));
    matches.push({ label: labels.priority[conditions.priority], evidence: tag ? `#${tag}` : null });
  }

  const operatorText = getCuratorReason(location);
  for (const slug of [conditions.placeType, ...conditions.reasons, ...conditions.situations]) {
    if (!slug) continue;
    matches.push({ label: termLabel(slug), evidence: findTermEvidence(location, slug, operatorText) });
  }

  return matches;
}
