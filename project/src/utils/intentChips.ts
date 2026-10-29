/**
 * intentChips.ts
 *
 * "종로에서 둘이 저녁, 조용한 곳" 같은 문장을 추천 조건(지역·누구와·시간·분위기·종류)으로 바꾼다.
 * 1차: 키워드 사전으로 바로 해석 (즉시·무료)
 * 2차: 하나도 못 잡으면 기존 /api/search(Gemini)의 slots를 같은 조건으로 매핑
 *
 * 갈아탈 신호: API 폴백 비율이 높아지면 사전을 넓히거나 API 우선으로 바꾼다.
 */

import type { Companion, PriorityFeature, TimeSlot } from '../types/ui';

export type PlaceKind = 'meal' | 'cafe';

export interface IntentConditions {
  region: string | null;
  companion: Companion | null;
  timeSlot: TimeSlot | null;
  priority: PriorityFeature | null;
  kind: PlaceKind | null;
}

export const EMPTY_CONDITIONS: IntentConditions = {
  region: null,
  companion: null,
  timeSlot: null,
  priority: null,
  kind: null,
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

export function hasAnyCondition(conditions: IntentConditions): boolean {
  return Object.values(conditions).some((value) => value !== null);
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
  ['wait_short', /웨이팅|줄 ?(안|없)|기다리|대기/],
  ['fast_serve', /빨리|빠르게|빠른|금방/],
  ['date_ok', /분위기|예쁜|감성/],
  ['solo_ok', /혼밥/],
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

export function parseIntentText(text: string, regions: string[]): IntentConditions {
  const normalized = text.trim();
  if (!normalized) return { ...EMPTY_CONDITIONS };

  // '혼밥 눈치 안 보이는'은 누구와(혼자)로 잡고, 분위기 칩은 명시적 우선 조건이 있을 때만 채운다
  const priority = firstMatch(normalized, PRIORITY_RULES.filter(([key]) => key !== 'solo_ok'));

  return {
    region: matchRegion(normalized, regions),
    companion: firstMatch(normalized, COMPANION_RULES),
    timeSlot: firstMatch(normalized, TIME_RULES),
    priority,
    kind: firstMatch(normalized, KIND_RULES),
  };
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
): Promise<{ conditions: IntentConditions; source: 'rules' | 'api' | 'none' }> {
  const ruled = parseIntentText(text, regions);
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
