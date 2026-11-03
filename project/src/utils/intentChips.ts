/**
 * intentChips.ts
 *
 * "종로에서 둘이 저녁, 조용한 곳" 같은 문장을 추천 조건(지역·누구와·시간·분위기·종류)으로 바꾼다.
 * 1차: 키워드 사전으로 바로 해석 (즉시·무료)
 * 2차: 하나도 못 잡으면 기존 /api/search(Gemini)의 slots를 같은 조건으로 매핑
 *
 * 갈아탈 신호: API 폴백 비율이 높아지면 사전을 넓히거나 API 우선으로 바꾼다.
 */

import { PROVINCES, type ContentMode } from '../types/location';
import type { Companion, PriorityFeature, TimeSlot } from '../types/ui';
import { findTermsInText, getTerm, TAXONOMY, termLabel } from './taxonomy';

export type PlaceKind = 'meal' | 'cafe';

export interface IntentConditions {
  region: string | null;
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priority: PriorityFeature | null;
  kind: PlaceKind | null;
  /** 장소 종류 (taxonomy place_type slug). 미술관·공원처럼 밥집/카페 밖의 종류 */
  placeType: string | null;
  /** 추천하는 이유 (taxonomy reason slug). 여러 개면 모두 맞아야 한다 */
  reasons: string[];
  /** 이런 때 잘 맞아요 (taxonomy situation slug). 여러 개면 모두 맞아야 한다 */
  situations: string[];
}

export const EMPTY_CONDITIONS: IntentConditions = {
  region: null,
  companion: null,
  timeSlot: null,
  priority: null,
  kind: null,
  placeType: null,
  reasons: [],
  situations: [],
};

export const COMPANION_LABEL: Record<Companion, string> = { solo: '혼자', pair: '둘이', group: '여럿이' };
export const TIME_SLOT_LABEL: Record<TimeSlot, string> = { lunch: '점심', dinner: '저녁', late: '늦은 밤' };
export const PRIORITY_LABEL: Record<PriorityFeature, string> = {
  quiet: '조용한 곳',
  wait_short: '줄 안 서는 곳',
  fast_serve: '빨리 나오는 곳',
  date_ok: '분위기 좋은 곳',
  solo_ok: '혼밥 편한 곳',
};
export const KIND_LABEL: Record<PlaceKind, string> = { meal: '밥집', cafe: '카페' };

/** 볼거리는 같은 조건 값을 쓰되 이름만 다르다 (예: lunch = '가볍게', wait_short = '실내 위주') */
export const SPACE_TIME_SLOT_LABEL: Record<TimeSlot, string> = { lunch: '가볍게', dinner: '반나절', late: '저녁에도' };
export const SPACE_PRIORITY_LABEL: Record<PriorityFeature, string> = {
  quiet: '조용히 보기',
  wait_short: '실내 위주',
  fast_serve: '짧게 들르기',
  date_ok: '사진 남기기',
  solo_ok: '혼자 산책',
};

export interface ConditionLabels {
  companion: Record<Companion, string>;
  timeSlot: Record<TimeSlot, string>;
  priority: Record<PriorityFeature, string>;
}

/** 질문 화면·결과 칩·추천 근거가 모두 이 라벨을 써야 고른 말과 보이는 말이 같다 */
export function getConditionLabels(mode: ContentMode = 'food'): ConditionLabels {
  return mode === 'space'
    ? { companion: COMPANION_LABEL, timeSlot: SPACE_TIME_SLOT_LABEL, priority: SPACE_PRIORITY_LABEL }
    : { companion: COMPANION_LABEL, timeSlot: TIME_SLOT_LABEL, priority: PRIORITY_LABEL };
}

export function hasAnyCondition(conditions: IntentConditions): boolean {
  return Object.values(conditions).some((value) => (Array.isArray(value) ? value.length > 0 : value !== null));
}

/** 장소 종류·이유·상황을 보면 어느 데이터(맛집/볼거리)에서 찾아야 하는지. 정할 수 없으면 null */
export function inferConditionMode(conditions: IntentConditions): ContentMode | null {
  const placeTypeMode = conditions.placeType ? getTerm(conditions.placeType)?.mode : undefined;
  if (placeTypeMode === 'food' || placeTypeMode === 'space') return placeTypeMode;
  if (conditions.kind) return 'food';
  const modes = [conditions.placeType, ...conditions.reasons, ...conditions.situations]
    .map((slug) => (slug ? getTerm(slug)?.mode : undefined))
    .filter((mode): mode is ContentMode => mode === 'food' || mode === 'space');
  if (modes.length === 0) return null;
  // 이유·상황이 한쪽 데이터로만 모일 때만 정한다
  return modes.every((mode) => mode === modes[0]) ? modes[0] : null;
}

// ─────────────────────────────────────────────
// 1차: 규칙 기반
// ─────────────────────────────────────────────

const COMPANION_RULES: [Companion, RegExp][] = [
  ['solo', /혼자|혼밥|혼술|나\s?홀로|1명|한 ?명/],
  ['pair', /둘이|둘서|두 ?명|2명|데이트|연인|커플|여자친구|남자친구|여친|남친|소개팅/],
  ['group', /여럿|여러 ?명|친구들|모임|회식|단체|가족|[3-9]명|세 ?명|네 ?명/],
];

const TIME_RULES: [TimeSlot, RegExp][] = [
  ['late', /늦은|야식|심야|새벽|밤|2차|술/],
  ['lunch', /점심|낮|브런치|아침/],
  ['dinner', /저녁|디너/],
];

const PRIORITY_RULES: [PriorityFeature, RegExp][] = [
  ['quiet', /조용|차분|한적/],
  ['wait_short', /웨이팅|줄 ?(안|없)( ?서는)?|기다리|대기/],
  ['fast_serve', /빨리|빠르게|빠른|금방/],
  ['date_ok', /분위기|예쁜|감성/],
  ['solo_ok', /혼밥/],
];

/**
 * 볼거리는 같은 조건 값을 다른 말로 쓴다 (SPACE_*_LABEL). 볼거리에서 찾을 때는 이 말로 읽어야
 * '실내'처럼 볼거리 조건인 말을 '못 읽었다'고 하거나, 결과 칩 문장을 다시 읽을 때 다른 조건이 되지 않는다.
 */
const SPACE_TIME_RULES: [TimeSlot, RegExp][] = [
  ['late', /저녁|늦게|밤/],
  ['lunch', /가볍게|잠깐/],
  ['dinner', /반나절|오래/],
];

const SPACE_PRIORITY_RULES: [PriorityFeature, RegExp][] = [
  ['quiet', /조용|차분|한적/],
  ['wait_short', /실내/],
  ['fast_serve', /짧게 ?들르/],
  ['date_ok', /사진 ?남기/],
  ['solo_ok', /혼자 ?산책/],
];

const KIND_RULES: [PlaceKind, RegExp][] = [
  ['cafe', /카페|커피|디저트|빵집|베이커리/],
  ['meal', /밥집|밥|식사|맛집|먹을/],
];

function firstMatch<T>(text: string, rules: [T, RegExp][]): T | null {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/**
 * 지역은 실제 데이터의 region 이름('종로/중구', '건대/성수/왕십리' 등)을 '/'로 나눈 별칭으로 찾는다.
 * regions는 장소 수가 많은 순으로 넘기면 '마포'처럼 겹치는 별칭이 큰 지역으로 간다.
 */
export function matchRegion(text: string, regions: string[]): string | null {
  let best: { region: string; length: number } | null = null;
  for (const region of regions) {
    const aliases = [region, ...region.split('/')].map((alias) => alias.trim()).filter((alias) => alias.length >= 2);
    for (const alias of aliases) {
      if (text.includes(alias) && (!best || alias.length > best.length)) {
        best = { region, length: alias.length };
      }
    }
  }
  return best?.region ?? null;
}

/** 데이터 지역에 없으면 시/도 이름으로 ('제주 혼밥' → '제주'). 그 시/도에 장소가 없으면 결과 없음으로 보여준다 */
function matchProvince(text: string): string | null {
  return PROVINCES.find((province) => text.includes(province)) ?? null;
}

// 조건과 상관없는 말 (못 읽었다고 알리지 않는다)
const FILLER = /^(곳|데|집|되는|되고|좋은|괜찮은|맛있는|있는|만한|갈|가기|가고|가볼|하기|할|먹기|먹고|추천|추천해줘|알려줘|찾아줘|어디|오늘|지금|싶어|싶은|싶다|근처|쪽|좀|같이|그리고|랑|하고|또는|맛집)$/;
const JOSA = /(에서|으로|이랑|하고|로|에|이|가|은|는|을|를|랑|도|의)$/;

/** 맛집/볼거리에 따라 읽는 말이 다른 규칙 */
function rulesFor(mode: ContentMode) {
  return {
    time: mode === 'space' ? SPACE_TIME_RULES : TIME_RULES,
    priority: mode === 'space' ? SPACE_PRIORITY_RULES : PRIORITY_RULES,
  };
}

/** 장소 종류·이유·상황으로 이 문장을 볼거리와 맛집 중 어디서 찾을지. 정할 수 없으면 지금 보는 쪽 */
function modeOfText(text: string, mode: ContentMode): ContentMode {
  return (
    inferConditionMode({
      ...EMPTY_CONDITIONS,
      kind: firstMatch(text, KIND_RULES),
      placeType: findTermsInText(text, 'place_type')[0] ?? null,
      reasons: findTermsInText(text, 'reason'),
      situations: findTermsInText(text, 'situation'),
    }) ?? mode
  );
}

/**
 * 문장에서 조건으로 읽지 못한 낱말. 결과 화면에서 "이건 반영 못 했어요"로 알린다.
 * '비 오는 날'처럼 여러 낱말에 걸친 말은 구절째 읽은 것으로 친다 ('오는'만 따로 못 읽었다고 하지 않는다).
 */
export function unreadWords(text: string, regions: string[], mode: ContentMode = 'food'): string[] {
  const { time, priority } = rulesFor(modeOfText(text, mode));
  const rules = [...COMPANION_RULES, ...time, ...priority, ...KIND_RULES].map(([, pattern]) => pattern);
  const termPatterns = TAXONOMY.flatMap((term) => (term.query ? [term.query] : []));
  // 여러 낱말에 걸쳐 읽힌 구절의 위치
  const spans: [number, number][] = [];
  for (const pattern of [...rules, ...termPatterns]) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      if (match[0].trim()) spans.push([match.index ?? 0, (match.index ?? 0) + match[0].length]);
    }
  }
  const inReadSpan = (start: number, end: number) => spans.some(([from, to]) => from < end && start < to);
  const read = (word: string) =>
    FILLER.test(word) ||
    rules.some((pattern) => pattern.test(word)) ||
    matchRegion(word, regions) !== null ||
    matchProvince(word) !== null ||
    (['place_type', 'reason', 'situation'] as const).some((kind) => findTermsInText(word, kind).length > 0);
  const words = [...text.matchAll(/[^\s,.!?·~]+/g)]
    .map((match) => ({ word: match[0], start: match.index ?? 0 }))
    .filter(({ word }) => word.length >= 2);
  const unread = words
    .filter(({ word, start }) => !inReadSpan(start, start + word.length) && !read(word) && !read(word.replace(JOSA, '')))
    .map(({ word }) => word);
  return [...new Set(unread.map((word) => (word.replace(JOSA, '').length >= 2 ? word.replace(JOSA, '') : word)))];
}

/** mode: 지금 보고 있는 데이터. 문장에 장소 종류가 있으면 그쪽(예: 전시 → 볼거리) 말로 읽는다 */
export function parseIntentText(text: string, regions: string[], mode: ContentMode = 'food'): IntentConditions {
  const normalized = text.trim();
  if (!normalized) return { ...EMPTY_CONDITIONS };
  const rules = rulesFor(modeOfText(normalized, mode));

  // '혼밥 눈치 안 보이는'은 누구와(혼자)로 잡고, 분위기 칩은 명시적 우선 조건이 있을 때만 채운다
  const priority = firstMatch(normalized, rules.priority.filter(([key]) => mode === 'space' || key !== 'solo_ok'));

  return {
    region: matchRegion(normalized, regions) ?? matchProvince(normalized),
    companion: firstMatch(normalized, COMPANION_RULES),
    timeSlot: firstMatch(normalized, rules.time),
    priority,
    kind: firstMatch(normalized, KIND_RULES),
    placeType: findTermsInText(normalized, 'place_type')[0] ?? null,
    reasons: findTermsInText(normalized, 'reason'),
    situations: findTermsInText(normalized, 'situation'),
  };
}

// ─────────────────────────────────────────────
// 문장 ↔ 조건 칩 맞추기
// ─────────────────────────────────────────────

/** 지역 이름 중 문장에 적었을 때 같은 지역으로 다시 읽히는 가장 짧은 말 ('용산/이태원/한남' → '용산') */
function regionWord(region: string, regions: string[]): string {
  const alias = region.split('/').map((part) => part.trim()).find((part) => part.length >= 2);
  return alias && (matchRegion(alias, regions) ?? matchProvince(alias)) === region ? alias : region;
}

/**
 * 지금 조건을 입력창에 넣을 문장으로. 결과 화면에서 칩을 고치면 이 문장으로 바꿔 둬서
 * '조건 수정'으로 돌아갔을 때 지운 조건이 문장에 남아 다시 살아나지 않게 한다.
 */
export function conditionsToText(conditions: IntentConditions, regions: string[], mode: ContentMode = 'food'): string {
  const labels = getConditionLabels(mode);
  const parts = [
    conditions.region ? regionWord(conditions.region, regions) : null,
    conditions.companion ? labels.companion[conditions.companion] : null,
    conditions.timeSlot ? labels.timeSlot[conditions.timeSlot] : null,
    conditions.placeType ? termLabel(conditions.placeType) : null,
    ...conditions.situations.map(termLabel),
    ...conditions.reasons.map(termLabel),
    conditions.kind && mode === 'food' ? KIND_LABEL[conditions.kind] : null,
    conditions.priority ? labels.priority[conditions.priority] : null,
  ];
  return parts.filter(Boolean).join(' ');
}

/**
 * 조건 수정 화면에서 문장을 고쳤을 때: 고친 부분만 조건에 반영한다.
 * before는 고치기 전 문장을 읽은 조건, after는 고친 문장을 읽은 조건, current는 지금 적용 중인 조건.
 * 문장에서 바뀌지 않은 항목은 지금 조건 그대로 (칩으로 고른 것이 사라지거나, 지운 것이 되살아나지 않는다).
 */
export function applyTextEdit(current: IntentConditions, before: IntentConditions, after: IntentConditions): IntentConditions {
  const next: IntentConditions = { ...current, reasons: [...current.reasons], situations: [...current.situations] };
  for (const key of ['region', 'companion', 'timeSlot', 'priority', 'kind', 'placeType'] as const) {
    if (before[key] !== after[key]) (next as unknown as Record<string, unknown>)[key] = after[key];
  }
  for (const key of ['reasons', 'situations'] as const) {
    const removed = before[key].filter((slug) => !after[key].includes(slug));
    const added = after[key].filter((slug) => !before[key].includes(slug));
    next[key] = [...next[key].filter((slug) => !removed.includes(slug)), ...added.filter((slug) => !next[key].includes(slug))];
  }
  return next;
}

// ─────────────────────────────────────────────
// 2차: /api/search slots 매핑
// ─────────────────────────────────────────────

export interface SearchSlotsLike {
  region?: string | null;
  sub_region?: string | null;
  category_main?: string | null;
  time_of_day?: string | null;
  visit_context?: string | null;
  constraints?: string[] | null;
}

export function mapSearchSlots(slots: SearchSlotsLike, regions: string[]): IntentConditions {
  const regionText = [slots.region, slots.sub_region].filter(Boolean).join(' ');
  const context = slots.visit_context ?? '';
  const constraints = slots.constraints ?? [];

  const companion: Companion | null =
    /혼밥|혼술/.test(context) ? 'solo'
    : /데이트|소개팅|기념일/.test(context) ? 'pair'
    : /모임|회식|가족|생일/.test(context) ? 'group'
    : null;

  const time = slots.time_of_day ?? '';
  const timeSlot: TimeSlot | null =
    /야식|심야/.test(time) ? 'late'
    : /점심|아침|브런치/.test(time) ? 'lunch'
    : /저녁/.test(time) ? 'dinner'
    : null;

  const priority: PriorityFeature | null =
    constraints.includes('조용한') ? 'quiet'
    : constraints.includes('웨이팅_없음') ? 'wait_short'
    : constraints.includes('빠른_회전') ? 'fast_serve'
    : null;

  const kind: PlaceKind | null =
    slots.category_main === '카페' || slots.category_main === '디저트' || context === '카공' ? 'cafe'
    : slots.category_main ? 'meal'
    : null;

  return {
    ...EMPTY_CONDITIONS,
    region: regionText ? matchRegion(regionText, regions) : null,
    companion,
    timeSlot,
    priority,
    kind,
  };
}

/**
 * 규칙으로 하나도 못 잡으면 /api/search를 부른다.
 * API가 없거나(로컬 vite) 실패하면 빈 조건을 돌려주고, 화면은 "조건을 직접 골라주세요"로 안내한다.
 */
export async function resolveIntent(
  text: string,
  regions: string[],
  fetcher: typeof fetch = fetch,
  mode: ContentMode = 'food',
): Promise<{ conditions: IntentConditions; source: 'rules' | 'api' | 'none' }> {
  const ruled = parseIntentText(text, regions, mode);
  if (hasAnyCondition(ruled) || !text.trim()) {
    return { conditions: ruled, source: hasAnyCondition(ruled) ? 'rules' : 'none' };
  }

  try {
    const response = await fetcher('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`search ${response.status}`);
    const data = (await response.json()) as { slots?: SearchSlotsLike };
    const mapped = data.slots ? mapSearchSlots(data.slots, regions) : { ...EMPTY_CONDITIONS };
    return { conditions: mapped, source: hasAnyCondition(mapped) ? 'api' : 'none' };
  } catch {
    return { conditions: { ...EMPTY_CONDITIONS }, source: 'none' };
  }
}
