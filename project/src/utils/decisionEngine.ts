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
 * - PriorityFeature → 태그 근거 (의미가 직접 맞는 태그만. 간접 근거는 미확인)
 *
 * 대표 추천은 운영자가 직접 가 보고 추천 이유를 적은 곳 중 고른 조건이 모두 확인된 곳만 된다.
 * 그런 곳이 없으면 '일반 후보'(조건은 맞지만 운영자 이유가 없음)·'미확인 후보'를 사용자가 원할 때만 보여준다.
 */

import type { Location, CategoryMain, ContentMode } from '../types/location';
import { PROVINCES, inferProvinceFromRegion } from '../types/location';
import type { Companion, TimeSlot, PriorityFeature } from '../types/ui';
import { getCuratorReason, isCuratorVisited } from './curation';
import { getConditionLabels, KIND_LABEL, type IntentConditions } from './intentChips';
import { findTermEvidence, getTerm, termLabel } from './taxonomy';
import { regionLabel } from './displayText';
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
      // '분위기 좋은'은 분위기 근거이지 둘이 가기 좋다는 근거가 아니라서 데이트·소개팅 태그만 본다
      return ['데이트', '소개팅'];
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

/**
 * 우선 조건 → 의미가 직접 맞는 태그. 비슷해 보여도 다른 사실이면 근거로 쓰지 않는다
 * (예: '웨이팅 적음'은 줄이 짧다는 뜻이지 음식이 빨리 나온다는 뜻이 아니다. '회전초밥'의 '회전'도 아니다).
 * 맞는 태그가 데이터에 없는 조건은 비워 두고, 그 조건은 늘 '미확인'이 된다.
 */
const FOOD_PRIORITY_TAGS: Record<PriorityFeature, RegExp | null> = {
  quiet: /조용|차분/,
  wait_short: /웨이팅\s?(적음|없음)|대기\s?없음|바로\s?입장/,
  fast_serve: /빨리\s?나|빠른\s?(서빙|조리)|회전\s?빠름/,
  // '조용한 분위기'·'빈티지분위기'는 분위기의 종류일 뿐 분위기가 좋다는 말이 아니다
  date_ok: /^분위기$|분위기\s?좋은|데이트|소개팅/,
  solo_ok: /혼밥|혼자/,
};

/** 볼거리는 같은 조건 값을 다른 뜻으로 쓴다 (라벨: intentChips SPACE_PRIORITY_LABEL) */
const SPACE_PRIORITY_TAGS: Record<PriorityFeature, RegExp | null> = {
  quiet: /조용|차분|한적/,
  wait_short: /실내/,
  // 짧게 들르기·혼자 산책은 직접 말해 주는 태그가 없다 (소품샵·산책 태그는 간접 근거라 쓰지 않는다)
  fast_serve: null,
  date_ok: /포토|사진/,
  solo_ok: null,
};

function judgePriority(location: Location, priority: PriorityFeature, mode: ContentMode): Judged {
  const pattern = (mode === 'space' ? SPACE_PRIORITY_TAGS : FOOD_PRIORITY_TAGS)[priority];
  const tag = pattern ? location.tags?.find((value) => pattern.test(value.trim())) : undefined;
  return tag ? { status: 'match', evidence: `#${tag}` } : { status: 'unknown', evidence: null };
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
  /** 추천 / 일반 후보 / 미확인 후보 (rankLocations에서 채운다) */
  status: PlaceStatus;
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

  // ── 누구와·시간·우선 조건: 불일치면 빼고, 미확인이면 확인된 곳 뒤에 둔다 (조건을 몰래 빼지 않는다) ──
  const companionJudged = companion ? judgeCompanion(location, companion) : null;
  const priorityJudged = priorityFeature ? judgePriority(location, priorityFeature, mode) : null;
  const judged = [companionJudged, timeSlot ? judgeTimeSlot(location, timeSlot, mode) : null, priorityJudged].filter(
    (item): item is Judged => item !== null,
  );
  if (judged.some((item) => item.status === 'mismatch')) return null;

  if (priorityJudged?.status === 'match') {
    score += 100;
  }
  if (companion && companionJudged?.status === 'match') {
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

  return { location, score, matchedTags, status: 'recommended', companion, timeSlot, priorityFeature };
}

// ─────────────────────────────────────────────
// 5. 메인 결정 함수
// ─────────────────────────────────────────────

/**
 * 결과 카드·지도 라벨이 같은 말을 쓰도록 장소마다 하나의 상태로 정한다.
 * - recommended: 운영자가 직접 가 보고 추천 이유를 적었고, 고른 조건이 모두 데이터로 확인됨
 * - general: 고른 조건은 모두 확인됐지만 운영자 추천 이유가 없거나 직접 가 보지 않음
 * - unconfirmed: 고른 조건 중 확인되지 않은 것이 있음 (불일치는 처음부터 뺀다)
 */
export type PlaceStatus = 'recommended' | 'general' | 'unconfirmed';

export const PLACE_STATUS_LABEL: Record<PlaceStatus, string> = {
  recommended: '추천',
  general: '일반 후보',
  unconfirmed: '미확인 후보',
};

const STATUS_ORDER: Record<PlaceStatus, number> = { recommended: 0, general: 1, unconfirmed: 2 };

/** 운영자의 실제 경험이 있는 곳: 직접 방문 + 운영자가 적은 추천 이유 */
export function hasOperatorReason(location: Location): boolean {
  return isCuratorVisited(location) && Boolean(getCuratorReason(location));
}

export function getPlaceStatus(location: Location, conditions: IntentConditions, mode: ContentMode = 'food'): PlaceStatus {
  if (getConditionMatches(location, conditions, mode).some((match) => match.status !== 'match')) return 'unconfirmed';
  return hasOperatorReason(location) ? 'recommended' : 'general';
}

export interface DecisionResult {
  /**
   * 대표 추천이 될 수 있는 곳(recommended) 수. 0이면 primary·secondary는 전부 일반·미확인 후보라
   * 화면은 그 사실을 먼저 말하고, 사용자가 원할 때만 후보를 보여준다 (근거 없는 곳을 확정 추천하지 않는다)
   */
  confirmedCount: number;
  /** 조건은 모두 확인됐지만 운영자 추천 이유가 없는 후보 수 */
  generalCount: number;
  /** 확인되지 않은 조건이 있는 후보 수 */
  unconfirmedCount: number;
  /** 보여줄 곳(primary, secondary, afterCafe)의 상태 */
  statuses: Map<string, PlaceStatus>;
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
  const { region, kind } = conditions;
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

  const scored = rankLocations(candidates, conditions, mode);
  if (scored.length === 0) return null;

  // 상위 3개 선정 (최소 1개). 추천 → 일반 후보 → 미확인 후보 순
  const countOf = (status: PlaceStatus) => scored.filter((item) => item.status === status).length;
  const top = scored.slice(0, 3);
  const statuses = new Map(top.map((item) => [item.location.id, item.status]));
  const primary = top[0].location;
  const secondary = top.slice(1).map(s => s.location);

  const reasons = new Map<string, string>();
  for (const item of top) {
    reasons.set(item.location.id, getCuratorReason(item.location));
  }

  let afterCafe: Location | undefined;
  if (kind === null && candidates === meals && cafes.length > 0) {
    // 식후 카페도 고른 우선 조건이 확인된 곳만. 없으면 조건을 빼고 고르지 않고 칸을 비운다 (상태 배지는 카드에 그대로)
    const cafe = rankLocations(cafes, { ...conditions, timeSlot: null }, mode).find(
      (item) => !conditions.priority || judgePriority(item.location, conditions.priority, mode).status === 'match',
    );
    if (cafe) {
      afterCafe = cafe.location;
      statuses.set(cafe.location.id, cafe.status);
    }
  }

  return {
    confirmedCount: countOf('recommended'),
    generalCount: countOf('general'),
    unconfirmedCount: countOf('unconfirmed'),
    statuses,
    primary,
    secondary,
    reasons,
    afterCafe,
  };
}

function matchesTerms(location: Location, conditions: IntentConditions): boolean {
  const slugs = [conditions.placeType, ...conditions.reasons, ...conditions.situations].filter(
    (slug): slug is string => Boolean(slug),
  );
  const operatorText = getCuratorReason(location);
  return slugs.every((slug) => findTermEvidence(location, slug, operatorText) !== null);
}

/** 상태순(추천 → 일반 후보 → 미확인 후보), 같은 상태 안에서는 점수순 (동점이면 평점순). 불일치는 빠진다 */
function rankLocations(candidates: Location[], conditions: IntentConditions, mode: ContentMode = 'food'): ScoredLocation[] {
  const { companion, timeSlot, priority } = conditions;
  const scored = candidates
    .map((loc) => scoreLocation(loc, companion, timeSlot, priority, mode))
    .filter((item): item is ScoredLocation => item !== null)
    .map((item) => ({ ...item, status: getPlaceStatus(item.location, conditions, mode) }));
  return scored.sort((a, b) => {
    if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (b.score !== a.score) return b.score - a.score;
    return (b.location.rating ?? 0) - (a.location.rating ?? 0);
  });
}

// ─────────────────────────────────────────────
// 5-1. 고른 조건과 맞는 점 (결과 카드 설명용)
// ─────────────────────────────────────────────

export interface ConditionMatch {
  /** 조건 종류 이름 (예: '지역', '동행', '영업'). 카드에서 '동행: 둘이'처럼 앞에 붙인다 */
  title: string;
  /** 사용자가 고른 조건 이름 (예: '조용한 곳') */
  label: string;
  status: MatchStatus;
  /** 카드에 보여줄 문장. 일치면 '둘이 가기 좋아요', 미확인이면 '…확인되지 않았어요.' */
  text: string;
  /** 맞는 근거 (예: '#데이트', '카카오맵 영업시간'). 데이터로 확인 못 하면 null — 지어내지 않는다 */
  evidence: string | null;
  /** 근거 이름이 조건 이름과 다를 때 왜 맞는지 (예: '실내라 비를 피할 수 있어요') */
  note?: string;
}

function findTag(location: Location, keywords: string[]): string | null {
  const lowered = keywords.map((keyword) => keyword.toLowerCase());
  return location.tags?.find((tag) => lowered.some((keyword) => tag.toLowerCase().includes(keyword))) ?? null;
}

/** 일치일 때는 '둘이 가기 좋아요'처럼 단정하지 않고 조건 이름만 쓴다. 근거(태그)는 evidence로 따로 보여준다 */
const COMPANION_UNKNOWN: Record<Companion, string> = {
  solo: '혼자 방문이 편한지는 확인되지 않았어요.',
  pair: '둘이 가기 좋은지는 확인되지 않았어요.',
  group: '여럿이 가기 좋은지는 확인되지 않았어요.',
};

const FOOD_TIME_TEXT: Record<TimeSlot, { match: string; unknown: string }> = {
  lunch: { match: '점심에 열어요', unknown: '점심 이용 여부는 확인되지 않았어요.' },
  dinner: { match: '저녁에 열어요', unknown: '저녁 이용 여부는 확인되지 않았어요.' },
  late: { match: '밤 11시 넘어서도 열어요', unknown: '늦은 밤 영업 여부는 확인되지 않았어요.' },
};

const SPACE_TIME_UNKNOWN: Record<TimeSlot, string> = {
  lunch: '가볍게 둘러볼 만한지는 확인되지 않았어요.',
  dinner: '반나절 코스로 맞는지는 확인되지 않았어요.',
  late: '저녁에도 둘러볼 수 있는지는 확인되지 않았어요.',
};

const TERM_TITLE: Record<string, string> = { place_type: '장소 종류', reason: '이유', situation: '상황' };

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
    matches.push({ title: '지역', label: conditions.region, status: 'match', text: regionLabel(conditions.region), evidence: null });
  }
  if (conditions.kind && mode === 'food') {
    const label = KIND_LABEL[conditions.kind];
    const fits = conditions.kind === 'cafe' ? isCafeLike(location) : !isCafeLike(location);
    matches.push({ title: '종류', label, status: fits ? 'match' : 'mismatch', text: label, evidence: null });
  }

  if (conditions.companion) {
    const judged = judgeCompanion(location, conditions.companion);
    const label = labels.companion[conditions.companion];
    matches.push({
      title: '동행',
      label,
      status: judged.status,
      text: judged.status === 'match' ? label : COMPANION_UNKNOWN[conditions.companion],
      evidence: judged.evidence,
    });
  }

  if (conditions.timeSlot) {
    const judged = judgeTimeSlot(location, conditions.timeSlot, mode);
    const copy = FOOD_TIME_TEXT[conditions.timeSlot];
    matches.push({
      // 영업시간으로 확인했으면 '영업', 아니면 '시간'
      title: judged.evidence === HOURS_SOURCE ? '영업' : '시간',
      label: labels.timeSlot[conditions.timeSlot],
      status: judged.status,
      text:
        judged.status !== 'match'
          ? mode === 'food' ? copy.unknown : SPACE_TIME_UNKNOWN[conditions.timeSlot]
          : judged.evidence === HOURS_SOURCE ? copy.match : labels.timeSlot[conditions.timeSlot],
      evidence: judged.evidence,
    });
  }

  // 우선 조건: 의미가 직접 맞는 태그가 있을 때만 일치. 없으면 미확인 (비슷한 태그로 일치 처리하지 않는다)
  if (conditions.priority) {
    const judged = judgePriority(location, conditions.priority, mode);
    const label = labels.priority[conditions.priority];
    matches.push(
      judged.status === 'match'
        ? { title: '우선 조건', label, status: 'match', text: label, evidence: judged.evidence }
        : { title: '우선 조건', label, status: 'unknown', text: unknownText(label), evidence: null },
    );
  }

  const operatorText = getCuratorReason(location);
  for (const slug of [conditions.placeType, ...conditions.reasons, ...conditions.situations]) {
    if (!slug) continue;
    const label = termLabel(slug);
    const title = TERM_TITLE[getTerm(slug)?.kind ?? 'reason'];
    const evidence = findTermEvidence(location, slug, operatorText);
    // '실내' 태그로 '비 오는 날'을 확인한 것처럼 이름이 다른 근거는 왜 맞는지 덧붙인다
    const note = getTerm(slug)?.evidenceNote;
    matches.push(
      evidence
        ? { title, label, status: 'match', text: label, evidence, ...(note && !evidence.includes(label) ? { note } : {}) }
        : { title, label, status: 'unknown', text: unknownText(label), evidence: null },
    );
  }

  return matches;
}
