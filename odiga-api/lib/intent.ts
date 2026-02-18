import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { detectCurrentSeason } from './season';
import { getModeFromPeopleCount } from './scoringConfig';

export type ResponseType = 'single' | 'course';

export interface ParsedIntent {
  response_type: ResponseType;
  region: string | null;
  vibe: string[];
  activity_type: string | null;
  people_count: number | null;
  season: string | null;
  mode: string | null;
  special_context: string | null;
}

const CAFE_KEYWORDS = [
  '카페', '커피', '라떼', '아메리카노', '에스프레소', '카공', '브런치카페', '디카페인',
];
const FOOD_KEYWORDS = [
  '맛집', '밥', '식사', '먹', '점심', '저녁', '아침', '야식', '국밥', '라멘', '파스타',
  '고기', '회', '해장', '술안주', '브런치',
];
const ATTRACTION_KEYWORDS = [
  '볼거리', '구경', '전시', '미술관', '박물관', '산책', '공원', '야경', '명소', '갈만한곳',
  '가볼만한곳', '놀거리', '데이트코스',
];

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeActivityType(query: string, activityType: unknown): string {
  const merged = `${query} ${typeof activityType === 'string' ? activityType : ''}`.toLowerCase();
  if (hasAnyKeyword(merged, CAFE_KEYWORDS)) return '카페';
  if (hasAnyKeyword(merged, FOOD_KEYWORDS)) return '맛집';
  if (hasAnyKeyword(merged, ATTRACTION_KEYWORDS)) return '볼거리';
  return '볼거리';
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
  "special_context": string | null
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

Rules:
- "오늘 점심 뭐 먹을까?" → response_type: "single", activity_type: "맛집"
- "커피 마시고 싶다" → response_type: "single", activity_type: "카페"
- "어디 가볼만한 곳 있어?" → response_type: "single", activity_type: "볼거리"
- "강남 데이트 코스 짜줘" → response_type: "course"
- "라멘 맛집" → response_type: "single", activity_type: "면"
- "홍대 카페 투어" → response_type: "course", activity_type: "카페"
- "서울대입구역 맛집" → region: "구로/관악/동작"
- "압구정 카페" → region: "강남"
- "을지로 술집" → region: "종로/중구"
- If unclear, default to "single"
- activity_type must be normalized into one of: "맛집", "카페", "볼거리"
- Extract season from context (e.g. "벚꽃" → "봄", "눈" → "겨울")
- Infer mode from people_count if not explicit
- vibe should capture mood/atmosphere keywords
- The region field MUST be one of the valid region values listed above, or null. NEVER return a raw station/landmark name as region.
- Return null for fields you cannot determine
- Output ONLY JSON. No explanation.`;

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
  const defaultIntent: ParsedIntent = {
    response_type: 'single',
    region: null,
    vibe: [],
    activity_type: null,
    people_count: null,
    season: null,
    mode: null,
    special_context: null,
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
      return { intent: defaultIntent, parseErrors: ['llm_json_parse_failed'] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const responseType = parsed.response_type === 'course' ? 'course' : 'single';
    const intent: ParsedIntent = {
      response_type: responseType,
      region: typeof parsed.region === 'string' ? parsed.region : null,
      vibe: Array.isArray(parsed.vibe) ? parsed.vibe.filter((v: unknown) => typeof v === 'string') : [],
      activity_type: normalizeActivityType(query, parsed.activity_type),
      people_count: typeof parsed.people_count === 'number' ? parsed.people_count : null,
      season: typeof parsed.season === 'string' ? parsed.season : null,
      mode: typeof parsed.mode === 'string' ? parsed.mode : null,
      special_context: typeof parsed.special_context === 'string' ? parsed.special_context : null,
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
      intent: { ...defaultIntent, region: '서울' },
      parseErrors: ['llm_call_failed'],
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
  } else if (!result.region) {
    result.region = '서울';
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

  return result;
}
