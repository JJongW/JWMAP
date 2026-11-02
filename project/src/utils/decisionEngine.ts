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
import { getConditionLabels, KIND_LABEL, type IntentConditions } from './intentChips';
import { findTermEvidence, termLabel } from './taxonomy';
import { judgeOpenAt } from './hours';

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
  /** 고른 조건이 모두 데이터로 확인됐는지. 미확인이 하나라도 있으면 false */
  confirmed: boolean;
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priorityFeature: PriorityFeature | null;
}

// ─────────────────────────────────────────────
// 3-1. 누구와·시간 조건 판정: 일치 / 불일치 / 미확인
// ─────────────────────────────────────────────

/** match: 데이터가 뒷받침함 · mismatch: 데이터가 반대를 말함 · unknown: 근거가 없음 (일치로 치지 않는다) */
export type MatchStatus = 'match' | 'mismatch' | 'unknown';

interface Judged {
  status: MatchStatus;
  /** 근거 (예: '#혼밥', '양식·퓨전'). 미확인·불일치면 null */
  evidence: string | null;
}

function judgeCompanion(location: Location, companion: Companion): Judged {
  const tag = findTag(location, getCompanionTagKeywords(companion));
  if (tag) return { status: 'match', evidence: `#${tag}` };
  // 둘이·여럿이인데 혼밥 위주 가게는 데이터가 반대를 말한다
  if (companion !== 'solo' && hasTagKeyword(location, ['혼밥', '혼자'])) return { status: 'mismatch', evidence: null };
  return { status: 'unknown', evidence: null };
}

/**
 * 시간 근거는 카카오맵 영업시간(과 늦은 밤의 심야 태그)으로만 판단한다.
 * 메뉴 분류(밥·면이면 점심)는 추정이라 근거로 쓰지 않는다. 볼거리는 근거 데이터가 없어 늘 미확인이다.
 */
function judgeTimeSlot(location: Location, timeSlot: TimeSlot, mode: ContentMode): Judged {
  if (mode !== 'food') return { status: 'unknown', evidence: null };
  if (timeSlot === 'late') {
    const lateTag = findTag(location, ['심야', '야식', '늦게']);
    if (lateTag) return { status: 'match', evidence: `#${lateTag}` };
  }
  const fit = judgeOpenAt(location.hours_text, timeSlot);
  if (fit === 'match') return { status: 'match', evidence: HOURS_SOURCE };
  return { status: fit, evidence: null };
}

/** 영업시간 근거의 출처. 카드에서 각주로 한 번만 밝힌다 */
export const HOURS_SOURCE = '카카오맵 영업시간';

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

  // ── 누구와·시간: 불일치면 빼고, 미확인이면 '일부 조건 미확인'으로 확인된 곳 뒤에 둔다 ──
  const judged = [
    companion ? judgeCompanion(location, companion) : null,
    timeSlot ? judgeTimeSlot(location, timeSlot, mode) : null,
  ].filter((item): item is Judged => item !== null);
  if (judged.some((item) => item.status === 'mismatch')) return null;
  const confirmed = judged.every((item) => item.status === 'match');

  if (companion && judged[0]?.status === 'match') {
    score += 30;
    addMatchedTag(matchedTags, getCompanionTagKeywords(companion)[0]);
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

  return { location, score, matchedTags, confirmed, companion, timeSlot, priorityFeature };
}

// ─────────────────────────────────────────────
// 5. 메인 결정 함수
// ─────────────────────────────────────────────

export interface DecisionResult {
  /**
   * 고른 조건이 모두 확인된 곳 수. 0이면 primary·secondary는 전부 '일부 조건 미확인' 후보라
   * 화면은 그 사실을 먼저 말하고, 사용자가 원할 때만 후보를 보여준다 (조건을 몰래 빼지 않는다)
   */
  confirmedCount: number;
  /** 미확인 조건이 있는 후보 수 (불일치는 처음부터 뺀다) */
  unconfirmedCount: number;
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

  // 상위 3개 선정 (최소 1개). 확인된 곳이 먼저, 미확인 후보는 그 뒤에
  const confirmedCount = scored.filter((item) => item.confirmed).length;
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

  return { confirmedCount, unconfirmedCount: scored.length - confirmedCount, primary, secondary, reasons, afterCafe };
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
    if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
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
  status: MatchStatus;
  /** 카드에 보여줄 문장. 일치면 '둘이 가기 좋아요', 미확인이면 '…확인되지 않았어요.' */
  text: string;
  /** 맞는 근거 (예: '#데이트', '카카오맵 영업시간'). 데이터로 확인 못 하면 null — 지어내지 않는다 */
  evidence: string | null;
}

function findTag(location: Location, keywords: string[]): string | null {
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return location.tags?.find((tag) => lowered.some((keyword) => tag.toLowerCase().includes(keyword))) ?? null;
}

const COMPANION_TEXT: Record<Companion, { match: string; unknown: string }> = {
  solo: { match: '혼자 가기 편해요', unknown: '혼자 방문이 편한지는 확인되지 않았어요.' },
  pair: { match: '둘이 가기 좋아요', unknown: '둘이 가기 좋은지는 확인되지 않았어요.' },
  group: { match: '여럿이 가기 좋아요', unknown: '여럿이 가기 좋은지는 확인되지 않았어요.' },
};

const FOOD_TIME_TEXT: Record<TimeSlot, { match: string; tag: string; unknown: string }> = {
  lunch: { match: '점심에 열어요', tag: '점심에 가기 좋아요', unknown: '점심 이용 여부는 확인되지 않았어요.' },
  dinner: { match: '저녁에 열어요', tag: '저녁에 가기 좋아요', unknown: '저녁 이용 여부는 확인되지 않았어요.' },
  late: { match: '밤 11시 넘어서도 열어요', tag: '늦은 밤에 가기 좋아요', unknown: '늦은 밤 영업 여부는 확인되지 않았어요.' },
};

const SPACE_TIME_UNKNOWN: Record<TimeSlot, string> = {
  lunch: '가볍게 둘러볼 만한지는 확인되지 않았어요.',
  dinner: '반나절 코스로 맞는지는 확인되지 않았어요.',
  late: '저녁에도 둘러볼 수 있는지는 확인되지 않았어요.',
};

function unknownText(label: string) {
  return `'${label}' 조건은 확인되지 않았어요.`;
}

/**
 * 고른 조건마다 이 장소에서 일치·미확인인지와 근거. 카드의 '선택 조건 확인'에 그대로 쓴다.
 * 지역·종류는 이미 필터로 걸렀으므로 일치로, 나머지는 데이터를 다시 본다.
 */
export function getConditionMatches(
  location: Location,
  conditions: IntentConditions,
  mode: ContentMode = 'food',
): ConditionMatch[] {
  const matches: ConditionMatch[] = [];
  const labels = getConditionLabels(mode);

  if (conditions.region) {
    matches.push({ label: conditions.region, status: 'match', text: conditions.region, evidence: null });
  }
  if (conditions.kind && mode === 'food') {
    const label = KIND_LABEL[conditions.kind];
    const fits = conditions.kind === 'cafe' ? isCafeLike(location) : !isCafeLike(location);
    matches.push({ label, status: fits ? 'match' : 'mismatch', text: label, evidence: null });
  }

  if (conditions.companion) {
    const judged = judgeCompanion(location, conditions.companion);
    const copy = COMPANION_TEXT[conditions.companion];
    matches.push({
      label: labels.companion[conditions.companion],
      status: judged.status,
      text: judged.status === 'match' ? copy.match : copy.unknown,
      evidence: judged.evidence,
    });
  }

  if (conditions.timeSlot) {
    const judged = judgeTimeSlot(location, conditions.timeSlot, mode);
    const copy = FOOD_TIME_TEXT[conditions.timeSlot];
    matches.push({
      label: labels.timeSlot[conditions.timeSlot],
      status: judged.status,
      text:
        judged.status !== 'match'
          ? mode === 'food' ? copy.unknown : SPACE_TIME_UNKNOWN[conditions.timeSlot]
          : judged.evidence === HOURS_SOURCE ? copy.match : copy.tag,
      evidence: judged.evidence,
    });
  }

  // 우선 조건·종류·이유·상황은 근거가 있는 곳만 후보에 남으므로, 여기서 근거가 없으면 미확인으로 둔다
  if (conditions.priority) {
    const tag = findTag(location, getPriorityTagKeywords(conditions.priority, mode));
    const label = labels.priority[conditions.priority];
    matches.push(
      tag
        ? { label, status: 'match', text: label, evidence: `#${tag}` }
        : { label, status: 'unknown', text: unknownText(label), evidence: null },
    );
  }

  const operatorText = getCuratorReason(location);
  for (const slug of [conditions.placeType, ...conditions.reasons, ...conditions.situations]) {
    if (!slug) continue;
    const label = termLabel(slug);
    const evidence = findTermEvidence(location, slug, operatorText);
    matches.push(
      evidence
        ? { label, status: 'match', text: label, evidence }
        : { label, status: 'unknown', text: unknownText(label), evidence: null },
    );
  }

  return matches;
}
