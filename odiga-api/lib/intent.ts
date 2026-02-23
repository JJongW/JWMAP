import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { detectCurrentSeason } from './season';
import { getModeFromPeopleCount } from './scoringConfig';

export type ResponseType = 'single' | 'course';
export type NoisePreference = 'quiet' | 'balanced' | 'lively' | 'unknown';
export type BudgetSensitivity = 'tight' | 'moderate' | 'flexible' | 'unknown';
export type WalkingPreference = 'short' | 'moderate' | 'relaxed' | 'unknown';

export interface ParsedIntent {
  response_type: ResponseType;
  region: string | null;
  vibe: string[];
  activity_type: string | null;
  people_count: number | null;
  season: string | null;
  mode: string | null;
  special_context: string | null;
  noise_preference: NoisePreference;
  budget_sensitivity: BudgetSensitivity;
  walking_preference: WalkingPreference;
}

const CAFE_KEYWORDS = [
  '카페', '커피', '라떼', '아메리카노', '에스프레소', '카공', '브런치카페', '디카페인',
];
const FOOD_KEYWORDS = [
  '맛집', '밥', '식사', '먹', '점심', '저녁', '아침', '야식', '국밥', '라멘', '파스타',
  '고기', '회', '해장', '술안주', '브런치', '디저트', '찜닭', '회식',
];
const ATTRACTION_KEYWORDS = [
  '볼거리', '구경', '전시', '미술관', '박물관', '산책', '공원', '야경', '명소',
  '가볼만한곳', '놀거리', '데이트코스', '여행', '공연', '전시회',
];

const NOISE_KEYWORDS = {
  quiet: ['조용', '한적', '고요', '말 없는', '시끌'],
  lively: ['시끌', '붐비', '인파', '활기', '웅장', '핫', '번잡'],
};
const BUDGET_KEYWORDS = {
  tight: ['저렴', '싼', '가성비', '간단히', '적게', '알뜰', '비싸지 않'],
  moderate: ['적당', '무난', '보통', '적당히'],
  flexible: ['프리미엄', '고급', '잘 먹', '특별히', '호화', '럭셔리'],
};
const WALKING_KEYWORDS = {
  short: ['가깝', '짧', '도보 10', '근처', '인근'],
  relaxed: ['천천히', '여유', '걷기', '산책', '버스', '택시', '차 타'],
};

const VALID_NOISE: NoisePreference[] = ['quiet', 'balanced', 'lively', 'unknown'];
const VALID_BUDGET: BudgetSensitivity[] = ['tight', 'moderate', 'flexible', 'unknown'];
const VALID_WALKING: WalkingPreference[] = ['short', 'moderate', 'relaxed', 'unknown'];

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeActivityType(query: string, activityType: unknown, responseType: ResponseType): string | null {
  const merged = `${query} ${typeof activityType === 'string' ? activityType : ''}`.toLowerCase();
  if (hasAnyKeyword(merged, CAFE_KEYWORDS)) return '카페';
  if (hasAnyKeyword(merged, FOOD_KEYWORDS)) return '맛집';
  if (hasAnyKeyword(merged, ATTRACTION_KEYWORDS)) return '볼거리';
  // Course mode without an explicit activity focus → return null so queryPlaces
  // returns all place types (맛집, 카페, 볼거리) for diverse course building.
  if (responseType === 'course') return null;
  return '볼거리';
}

function clampNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T {
  const candidate = toStringOrNull(value)?.toLowerCase() as T | undefined;
  if (candidate && allowed.includes(candidate)) return candidate;
  return (allowed[allowed.length - 1] as T);
}

function inferResponseType(input: string, parsedType: unknown): ResponseType {
  if (parsedType === 'course') return 'course';
  if (parsedType === 'single') return 'single';

  const lowered = input.toLowerCase();
  const courseSignals = ['코스', '코스로', '투어', '동선', '한바퀴', '코스짜', '코스 짜'];
  return hasAnyKeyword(lowered, courseSignals) ? 'course' : 'single';
}

function inferNoisePreference(query: string, value: unknown): NoisePreference {
  if (typeof value === 'string') {
    const normalized = normalizeEnum(value as NoisePreference, VALID_NOISE);
    if (normalized !== 'unknown') return normalized;
  }
  if (hasAnyKeyword(query, NOISE_KEYWORDS.quiet)) return 'quiet';
  if (hasAnyKeyword(query, NOISE_KEYWORDS.lively)) return 'lively';
  return 'balanced';
}

function inferBudgetSensitivity(query: string, value: unknown): BudgetSensitivity {
  if (typeof value === 'string') {
    const normalized = normalizeEnum(value as BudgetSensitivity, VALID_BUDGET);
    if (normalized !== 'unknown') return normalized;
  }
  if (hasAnyKeyword(query, BUDGET_KEYWORDS.tight)) return 'tight';
  if (hasAnyKeyword(query, BUDGET_KEYWORDS.flexible)) return 'flexible';
  if (hasAnyKeyword(query, BUDGET_KEYWORDS.moderate)) return 'moderate';
  return 'unknown';
}

function inferWalkingPreference(query: string, value: unknown): WalkingPreference {
  if (typeof value === 'string') {
    const normalized = normalizeEnum(value as WalkingPreference, VALID_WALKING);
    if (normalized !== 'unknown') return normalized;
  }
  if (hasAnyKeyword(query, WALKING_KEYWORDS.short)) return 'short';
  if (hasAnyKeyword(query, WALKING_KEYWORDS.relaxed)) return 'relaxed';
  return 'moderate';
}

const SYSTEM_PROMPT = `You are a Korean place recommendation intent parser.

Given a user query in Korean, extract structured intent.
The user might want:
- A single place recommendation (맛집, 카페, 술집, 디저트 등)
- A multi-stop course/route (코스, 투어, 데이트코스 등)

Return ONLY valid JSON with this exact schema:
{
  "response_type": "single" | "course",
  "region": string | null,
  "vibe": string[],
  "activity_type": string | null,
  "people_count": number | null,
  "season": string | null,
  "mode": string | null,
  "special_context": string | null,
  "noise_preference": "quiet" | "balanced" | "lively" | "unknown",
  "budget_sensitivity": "tight" | "moderate" | "flexible" | "unknown",
  "walking_preference": "short" | "moderate" | "relaxed" | "unknown"
}

## Valid region values

The "region" field MUST be one of these exact values, or null:

서울 regions: 강남, 서초, 잠실/송파/강동, 영등포/여의도/강서, 건대/성수/왕십리, 종로/중구, 홍대/합정/마포/연남, 용산/이태원/한남, 성북/노원/중랑, 구로/관악/동작, 신촌/연희, 창동/도봉산, 회기/청량리, 강동/고덕, 연신내/구파발, 마곡/김포, 미아/수유/북한산, 목동/양천, 금천/가산
경기 regions: 수원, 성남/분당, 고양/일산, 용인, 부천, 안양/과천, 안산, 화성/동탄, 평택, 의정부, 파주, 김포, 광명, 광주, 하남, 시흥, 군포/의왕, 오산, 이천, 안성, 양평/여주, 구리/남양주, 포천/동두천, 양주, 가평, 연천
인천 regions: 부평, 송도/연수, 계양, 남동구, 서구/검단, 중구/동구, 강화/옹진
부산 regions: 서면, 해운대, 광안리/수영, 센텀시티, 남포동/중앙동, 동래/온천장, 사상/덕천, 기장, 사하/다대포, 연산/토곡
Province-level values (use when query is broad): 서울, 경기, 인천, 부산, 대구, 대전, 광주, 울산, 세종, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주

## Station/Landmark → region mapping

When the user mentions a station name, neighborhood, or landmark, map it to the correct region value above:
- 서울대입구역, 서울대입구, 신림, 신림역, 봉천, 낙성대, 사당, 이수, 노량진 → "구로/관악/동작"
- 압구정, 선릉, 역삼, 삼성, 논현, 학동, 선정릉, 청담, 도산, 가로수길, 코엑스, 봉은사 → "강남"
- 교대, 방배, 서래마을, 양재, 반포, 고속터미널, 내방 → "서초"
- 을지로, 명동, 광화문, 경복궁, 북촌, 서촌, 익선동, 동대문, 안국, 인사동, 충무로, 시청, 을지로3가, 을지로4가 → "종로/중구"
- 뚝섬, 왕십리, 성수, 건대, 건국대, 서울숲, 행당 → "건대/성수/왕십리"
- 여의나루, 여의도, 영등포, 당산, 목동, 마곡, 발산, 우장산, 김포공항, 가양, 양천 → "영등포/여의도/강서"
- 홍대, 합정, 상수, 망원, 연남, 연남동, 마포, 공덕, 애오개 → "홍대/합정/마포/연남"
- 이태원, 한남, 한남동, 용산, 해방촌, 경리단길, 녹사평, 효창 → "용산/이태원/한남"
- 잠실, 송파, 강동, 천호, 올림픽공원, 석촌, 방이, 문정, 가든파이브 → "잠실/송파/강동"
- 신촌, 이대, 연희, 연희동, 서강 → "신촌/연희"
- 성북, 노원, 중랑, 혜화, 대학로, 한성대, 길음, 상계 → "성북/노원/중랑"
- 구로, 구로디지털단지, 가산, 가산디지털단지, 금천 → "금천/가산" or "구로/관악/동작"
- 회기, 청량리, 외대, 경희대 → "회기/청량리"
- 창동, 도봉산, 쌍문 → "창동/도봉산"
- 연신내, 불광, 구파발 → "연신내/구파발"
- 미아, 수유, 북한산 → "미아/수유/북한산"

If the user mentions "서울" broadly without a specific area, set region to "서울".
If you cannot map a place name to any region, set region to null.

New preference dimensions:
- noise_preference: quiet(조용), balanced(보통), lively(활기), unknown
- budget_sensitivity: tight(저렴), moderate(무난), flexible(넓게)
- walking_preference: short(가깝게), moderate(보통), relaxed(여유 있게 걷기)

Rules:
- "오늘 점심 뭐 먹을까?" → response_type: "single", activity_type: "맛집"
- "커피 마시고 싶다" → response_type: "single", activity_type: "카페"
- "어디 가볼만한 곳 있어?" → response_type: "single", activity_type: "볼거리"
- "강남 데이트 코스 짜줘" → response_type: "course", activity_type: null, people_count: 2
- "홍대 데이트 코스" → response_type: "course", activity_type: null, people_count: 2
- "라멘 맛집" → response_type: "single", activity_type: "면"
- "홍대 카페 투어" → response_type: "course", activity_type: "카페"
- "성수 맛집 코스" → response_type: "course", activity_type: "맛집"
- "서울대입구역 맛집" → region: "구로/관악/동작"
- "압구정 카페" → region: "강남"
- "을지로 술집" → region: "종로/중구"
- If unclear, default to "single"
- activity_type must be one of: "맛집", "카페", "볼거리", or null
- For course mode without a specific activity focus (e.g. 데이트 코스, 산책 코스), set activity_type to null
- Extract season from context (e.g. "벚꽃" → "봄", "눈" → "겨울")
- Infer mode from people_count if not explicit
- vibe should capture mood/atmosphere keywords
- The region field MUST be one of the valid region values listed above, or null. NEVER return a raw station/landmark name as region.
- Return null for fields you cannot determine
- Output ONLY JSON. No explanation.

## people_count extraction rules

Extract people_count from these Korean expressions:
- "혼자", "혼밥", "혼술", "나 혼자" → 1
- "데이트", "둘이", "둘이서", "커플", "애인이랑", "남자친구랑", "여자친구랑" → 2
- "셋이", "세명", "3명", "친구 둘" → 3
- "넷이", "네명", "4명" → 4
- "다섯명", "5명" → 5
- "N명" pattern → extract the number N
- If not mentioned, return null`;

function getLLM(): ChatGoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GOOGLE_API_KEY');
  }
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    maxOutputTokens: 300,
    apiKey,
  });
}

export interface IntentResult {
  intent: ParsedIntent;
  parseErrors: string[];
}

export async function parseIntent(query: string): Promise<IntentResult> {
  const normalizedQuery = query.toLowerCase();
  const defaultIntent: ParsedIntent = {
    response_type: 'single',
    region: null,
    vibe: [],
    activity_type: null,
    people_count: null,
    season: null,
    mode: null,
    special_context: null,
    noise_preference: inferNoisePreference(normalizedQuery, null),
    budget_sensitivity: inferBudgetSensitivity(normalizedQuery, null),
    walking_preference: inferWalkingPreference(normalizedQuery, null),
  };

  try {
    const llm = getLLM();
    const combinedPrompt = `${SYSTEM_PROMPT}\n\n---\n\nParse this query: "${query}"`;
    const response = await llm.invoke([new HumanMessage(combinedPrompt)]);

    let content = typeof response.content === 'string' ? response.content : '';
    content = content.trim();

    const fenceMatch = content.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        intent: defaultIntent,
        parseErrors: ['llm_json_parse_failed', 'region'],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const responseType = inferResponseType(query, parsed.response_type);
    const intent: ParsedIntent = {
      response_type: responseType,
      region: toStringOrNull(parsed.region),
      vibe: toStringArray(parsed.vibe),
      activity_type: normalizeActivityType(query, parsed.activity_type, responseType),
      people_count: clampNumber(parsed.people_count),
      season: toStringOrNull(parsed.season),
      mode: toStringOrNull(parsed.mode),
      special_context: toStringOrNull(parsed.special_context),
      noise_preference: inferNoisePreference(normalizedQuery, parsed.noise_preference),
      budget_sensitivity: inferBudgetSensitivity(normalizedQuery, parsed.budget_sensitivity),
      walking_preference: inferWalkingPreference(normalizedQuery, parsed.walking_preference),
    };

    const parseErrors: string[] = [];
    if (!intent.region) parseErrors.push('region');
    if (!intent.people_count && intent.response_type === 'course') {
      parseErrors.push('people_count');
    }

    return { intent, parseErrors };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Intent parsing failed:', msg);
    return {
      intent: {
        ...defaultIntent,
        response_type: 'single',
        region: null,
        noise_preference: inferNoisePreference(normalizedQuery, null),
        budget_sensitivity: inferBudgetSensitivity(normalizedQuery, null),
        walking_preference: inferWalkingPreference(normalizedQuery, null),
      },
      parseErrors: ['llm_call_failed', 'region'],
    };
  }
}

/**
 * Apply server-side defaults (no interactive prompts).
 * Client can override region/people_count via request body.
 */
export function applyServerDefaults(
  intent: ParsedIntent,
  overrides: {
    region?: string | null;
    people_count?: number | null;
    mode?: string | null;
    response_type?: ResponseType | null;
  },
): ParsedIntent {
  const result = { ...intent };

  if (overrides.region) {
    result.region = overrides.region;
  }

  if (overrides.response_type) {
    result.response_type = overrides.response_type;
  }

  if (overrides.people_count) {
    result.people_count = overrides.people_count;
  }

  if (result.response_type === 'course') {
    if (!result.people_count) result.people_count = 2;
    if (!result.mode) {
      result.mode = overrides.mode || getModeFromPeopleCount(result.people_count);
    }
  } else {
    if (!result.people_count) result.people_count = 1;
    if (!result.mode) result.mode = overrides.mode || 'solo';
  }

  if (!result.season) {
    result.season = detectCurrentSeason();
  }

  if (!result.noise_preference) result.noise_preference = 'unknown';
  if (!result.budget_sensitivity) result.budget_sensitivity = 'unknown';
  if (!result.walking_preference) result.walking_preference = 'moderate';

  return result;
}
