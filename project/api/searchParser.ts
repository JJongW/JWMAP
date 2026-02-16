import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import type { EnhancedLLMQuery, LLMQuery, SearchIntent, TimeOfDay, VisitContext } from './searchTypes';
import {
  inferConstraintFlagsFromKeywords,
  sanitizeTagNames,
} from './tagIntelligence';

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  maxOutputTokens: 500,
  apiKey: process.env.GOOGLE_API_KEY || '',
});

const SYSTEM_PROMPT = `You are a query interpreter for a personal restaurant map service.

Your task:
- Convert the user's search query into structured search conditions.
- Do NOT recommend places.
- Do NOT invent restaurants.
- Only extract intent and filters.

Rules:
- If information is missing, return null.
- Return ONLY valid JSON.
- Be conservative and realistic.

=== INTENT (choose ONE) ===
- DISCOVER_RECOMMEND: e.g. "점심 뭐 먹지?", "맛집 추천해줘"
- REGION_SEARCH: e.g. "용산 맛집", "강남 맛집"
- CATEGORY_SEARCH: e.g. "국밥 먹고 싶어", "라멘"
- DIRECT_PLACE: e.g. "히코 어때?", "○○ 어디야?"
- RANDOM_SUGGEST: e.g. "아무거나 추천", "랜덤"

=== TIME_CONTEXT ===
- breakfast, lunch, dinner, late_night

=== LOCATION_KEYWORDS (raw terms as user spoke - NO mapping) ===
Extract location/area terms exactly as the user said. Examples:
- "연희 카페" → ["연희"]
- "성수 맛집" → ["성수"]
- "부산 해운대 횟집" → ["부산", "해운대"]
- "강남 라멘" → ["강남"]
- "사당 근처" → ["사당"]
Do NOT map to canonical regions. Return empty array if no location mentioned.

=== CATEGORY_MAIN ===
밥, 면, 국물, 고기요리, 해산물, 간편식, 양식·퓨전, 디저트, 카페, 술안주

=== OUTPUT (exact schema) ===
{
  "intent": "DISCOVER_RECOMMEND" | "REGION_SEARCH" | "CATEGORY_SEARCH" | "DIRECT_PLACE" | "RANDOM_SUGGEST",
  "location_keywords": ["raw location terms as user spoke"],
  "time_context": "breakfast" | "lunch" | "dinner" | "late_night" | null,
  "category_main": "one of above or null",
  "category_sub": "e.g. 라멘, 국밥, 카공카페 or null",
  "tags": ["search tags only. include themes like 벚꽃/데이트코스/야경 if relevant. NOT location terms"],
  "confidence": 0.0 to 1.0
}

Output ONLY valid JSON. No explanation.`;

interface SimpleLLMOutput {
  intent: 'DISCOVER_RECOMMEND' | 'REGION_SEARCH' | 'CATEGORY_SEARCH' | 'DIRECT_PLACE' | 'RANDOM_SUGGEST';
  location_keywords?: string[];
  region?: string | null;
  time_context: 'breakfast' | 'lunch' | 'dinner' | 'late_night' | null;
  category_main: string | null;
  category_sub: string | null;
  tags: string[];
  confidence: number;
}

const INTENT_MAP: Record<string, SearchIntent> = {
  DISCOVER_RECOMMEND: 'DISCOVER_RECOMMEND',
  REGION_SEARCH: 'SEARCH_BY_REGION',
  CATEGORY_SEARCH: 'SEARCH_BY_CATEGORY',
  DIRECT_PLACE: 'ASK_DETAILS',
  RANDOM_SUGGEST: 'RANDOM_PICK',
};

const TIME_CONTEXT_MAP: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  late_night: '야식',
};

export interface ParseResult {
  enhanced: EnhancedLLMQuery;
  raw: Record<string, unknown>;
  confidence: number | null;
}

export async function parseEnhancedQuery(text: string): Promise<ParseResult> {
  const defaultQuery: EnhancedLLMQuery = {
    intent: 'CLARIFY_QUERY',
    slots: {
      location_keywords: [],
      region: null,
      sub_region: null,
      place_name: null,
      category_main: null,
      category_sub: null,
      exclude_category_main: null,
      time_of_day: null,
      visit_context: null,
      constraints: [],
      keywords: [],
      count: null,
      open_now: null,
    },
  };

  try {
    const combinedPrompt = `${SYSTEM_PROMPT}\n\n---\n\nParse this query: "${text}"`;
    const response = await llm.invoke([new HumanMessage(combinedPrompt)]);
    let content = typeof response.content === 'string' ? response.content : '';
    content = content.trim();

    const jsonFence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
    const fenceMatch = content.match(jsonFence);
    if (fenceMatch) content = fenceMatch[1].trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { enhanced: defaultQuery, raw: {}, confidence: null };

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const confVal = parsed.confidence;
    const confidence = typeof confVal === 'number' && confVal >= 0 && confVal <= 1 ? confVal : null;

    const simple = parsed as Partial<SimpleLLMOutput>;
    const intent = INTENT_MAP[simple.intent as string] || 'CLARIFY_QUERY';
    const locationKeywords = Array.isArray(simple.location_keywords)
      ? simple.location_keywords
          .filter((k): k is string => typeof k === 'string')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const timeContext = simple.time_context as string;
    const timeOfDay = timeContext ? TIME_CONTEXT_MAP[timeContext] || null : null;
    const categoryMain = (simple.category_main as string) || null;
    const categorySub = (simple.category_sub as string) || null;
    const tags = sanitizeTagNames(Array.isArray(simple.tags) ? simple.tags : [], { max: 10 });
    const textLower = text.toLowerCase();
    const explicitCourseTags = [
      textLower.includes('코스') ? '코스' : '',
      textLower.includes('데이트') ? '데이트' : '',
      textLower.includes('벚꽃') ? '벚꽃' : '',
    ].filter(Boolean);
    const mergedTags = sanitizeTagNames([...tags, ...explicitCourseTags], { max: 12 });
    const placeName = intent === 'ASK_DETAILS' && mergedTags.length > 0 ? mergedTags[0] : null;
    const inferred = inferConstraintFlagsFromKeywords(mergedTags);
    const hasHonbab = inferred.solo_ok === true;
    const visitContext = hasHonbab ? ('혼밥' as VisitContext) : null;
    const excludeCategory = hasHonbab ? ['카페'] : null;
    const inferredConstraints = [
      inferred.quiet ? '조용한' : null,
      inferred.no_wait ? '웨이팅_없음' : null,
    ].filter((item): item is '조용한' | '웨이팅_없음' => Boolean(item));

    return {
      enhanced: {
        intent,
        slots: {
          location_keywords: locationKeywords,
          region: null,
          sub_region: null,
          place_name: placeName,
          category_main: categoryMain,
          category_sub: categorySub,
          exclude_category_main: excludeCategory,
          time_of_day: timeOfDay as TimeOfDay | null,
          visit_context: visitContext,
          constraints: inferredConstraints,
          keywords: mergedTags,
          count: null,
          open_now: null,
        },
      },
      raw: parsed,
      confidence,
    };
  } catch (error) {
    console.error('LLM parsing error:', error);
    return { enhanced: defaultQuery, raw: {}, confidence: null };
  }
}

export function toLegacyQuery(enhanced: EnhancedLLMQuery, uiRegionHint?: string): LLMQuery {
  const legacy: LLMQuery = {
    keywords: enhanced.slots.keywords || [],
    sort: 'relevance',
  };

  const locKw = enhanced.slots.location_keywords || [];
  if (locKw.length > 0) {
    legacy.locationKeywords = [...locKw];
  } else if (uiRegionHint && uiRegionHint !== '서울 전체') {
    legacy.locationKeywords = [uiRegionHint];
  }

  if (enhanced.slots.region) legacy.region = [enhanced.slots.region];
  if (enhanced.slots.sub_region) legacy.subRegion = [enhanced.slots.sub_region];
  if (enhanced.slots.category_main) legacy.categoryMain = [enhanced.slots.category_main];
  if (enhanced.slots.category_sub) legacy.categorySub = [enhanced.slots.category_sub];
  if (enhanced.slots.exclude_category_main) legacy.excludeCategoryMain = enhanced.slots.exclude_category_main;

  const constraints: LLMQuery['constraints'] = {};
  if (enhanced.slots.visit_context === '혼밥' || enhanced.slots.visit_context === '혼술') constraints.solo_ok = true;
  if (enhanced.slots.constraints.includes('조용한')) constraints.quiet = true;
  if (enhanced.slots.constraints.includes('웨이팅_없음')) constraints.no_wait = true;
  if (enhanced.slots.constraints.includes('가성비') || enhanced.slots.constraints.includes('비싼_곳_제외')) {
    constraints.price_level = 2;
  }
  if (Object.keys(constraints).length > 0) legacy.constraints = constraints;

  if (enhanced.slots.place_name) {
    legacy.keywords = [...(legacy.keywords || []), enhanced.slots.place_name];
  }

  return legacy;
}
