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

Rules:
- "오늘 점심 뭐 먹을까?" → response_type: "single", activity_type: "맛집"
- "커피 마시고 싶다" → response_type: "single", activity_type: "카페"
- "강남 데이트 코스 짜줘" → response_type: "course"
- "라멘 맛집" → response_type: "single", activity_type: "면"
- "홍대 카페 투어" → response_type: "course", activity_type: "카페"
- If unclear, default to "single"
- Extract season from context (e.g. "벚꽃" → "봄", "눈" → "겨울")
- Infer mode from people_count if not explicit
- vibe should capture mood/atmosphere keywords
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
      activity_type: typeof parsed.activity_type === 'string' ? parsed.activity_type : null,
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
