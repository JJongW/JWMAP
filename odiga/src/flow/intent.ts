import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';

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
  "response_type": "single" | "course",  // "single" = 장소 하나 추천, "course" = 여러 장소 코스
  "region": string | null,               // 지역 (e.g. "홍대", "강남", "을지로")
  "vibe": string[],                      // 분위기 키워드 (e.g. ["감성", "레트로", "조용한"])
  "activity_type": string | null,        // 카테고리 (e.g. "카페", "맛집", "밥", "면", "술안주", "디저트", "산책")
  "people_count": number | null,         // 인원수
  "season": string | null,               // 계절 ("봄", "여름", "가을", "겨울") or null
  "mode": string | null,                 // 모드 ("solo", "date", "group", "party") or null
  "special_context": string | null       // 특수 맥락 (e.g. "생일", "기념일", "소개팅", "점심", "저녁")
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
    throw new Error('Missing GOOGLE_API_KEY in environment.');
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

    // Strip ```json fences
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

    if (!intent.region) {
      parseErrors.push('region');
    }
    // people_count는 single 모드에서는 필수가 아님
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
        region: process.env.DEFAULT_REGION || '서울',
      },
      parseErrors: ['llm_call_failed'],
    };
  }
}
