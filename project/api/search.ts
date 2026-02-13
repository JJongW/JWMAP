import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

// ============================================
// Enhanced Search Types
// ============================================

// Search Intent Classification
type SearchIntent =
  | 'DISCOVER_RECOMMEND'    // 추천해줘, 맛집 알려줘
  | 'SEARCH_BY_FOOD'        // 라멘 먹고 싶어
  | 'SEARCH_BY_CATEGORY'    // 밥집, 면집
  | 'SEARCH_BY_REGION'      // 강남 맛집
  | 'SEARCH_BY_CONSTRAINTS' // 혼밥 가능한 곳
  | 'SEARCH_BY_CONTEXT'     // 데이트 장소
  | 'COMPARE_OPTIONS'       // A vs B
  | 'RANDOM_PICK'           // 아무거나, 랜덤
  | 'FIND_NEAR_ME'          // 근처 맛집
  | 'FIND_OPEN_NOW'         // 지금 열린 곳
  | 'FIND_LATE_NIGHT'       // 야식, 심야영업
  | 'FIND_BEST_FOR'         // ~하기 좋은 곳
  | 'ASK_DETAILS'           // ~가 어때?
  | 'ASK_SIMILAR_TO'        // ~랑 비슷한 곳
  | 'ASK_EXCLUDE'           // ~빼고
  | 'CLARIFY_QUERY';        // 불명확한 쿼리

// Time of day context
type TimeOfDay = '아침' | '점심' | '저녁' | '야식' | '심야' | '브런치';

// Visit context
type VisitContext =
  | '혼밥' | '혼술' | '데이트' | '접대' | '가족모임' | '친구모임'
  | '회식' | '소개팅' | '생일' | '기념일' | '카공' | '반려동물_동반';

// Search constraints
type SearchConstraint =
  | '웨이팅_없음' | '예약_가능' | '주차_가능' | '좌석_넉넉' | '오래_앉기'
  | '조용한' | '빠른_회전' | '가성비' | '비싼_곳_제외' | '체인점_제외'
  | '관광지_제외' | '비건' | '채식' | '매운맛' | '담백';

// Enhanced LLM Query Interface
interface EnhancedLLMQuery {
  intent: SearchIntent;
  slots: {
    location_keywords: string[];
    region: string | null;
    sub_region: string | null;
    place_name: string | null;
    category_main: string | null;
    category_sub: string | null;
    exclude_category_main: string[] | null;
    time_of_day: TimeOfDay | null;
    visit_context: VisitContext | null;
    constraints: SearchConstraint[];
    keywords: string[];
    count: number | null;
    open_now: boolean | null;
  };
}

// Search Actions for Frontend
interface SearchActions {
  mode: 'browse' | 'explore';
  should_show_map: boolean;
  result_limit: number;
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

// UI Hints for Frontend
interface UIHints {
  message_type: 'success' | 'no_results_soft' | 'need_clarification';
  message: string;
  suggestions?: string[];
}

// Legacy LLM Query (for backward compatibility)
interface LLMQuery {
  locationKeywords?: string[];
  region?: string[];
  subRegion?: string[];
  category?: string[]; // 레거시 호환
  categoryMain?: string[]; // 카테고리 대분류 (밥, 면, 국물, 고기, 해산물, 간편식, 양식, 디저트, 카페, 술안주)
  categorySub?: string[]; // 카테고리 소분류 (덮밥, 라멘, 회 등)
  excludeCategory?: string[]; // 제외할 카테고리 (예: ["카페"])
  excludeCategoryMain?: string[]; // 제외할 카테고리 대분류
  keywords?: string[];
  constraints?: {
    solo_ok?: boolean;
    quiet?: boolean;
    no_wait?: boolean;
    price_level?: number;
  };
  sort?: 'relevance' | 'rating';
}

interface TimingMetrics {
  llmMs: number;
  dbMs: number;
  totalMs: number;
}

interface Location {
  id: string;
  name: string;
  region: string;
  subRegion?: string;
  category: string;
  categoryMain?: string;
  categorySub?: string;
  tags?: string[];
  lon: number;
  lat: number;
  address: string;
  memo: string;
  shortDesc?: string;
  features?: Record<string, boolean>;
  rating: number;
  curationLevel?: number;
  priceLevel?: number;
  naverPlaceId?: string;
  kakaoPlaceId?: string;
  imageUrl: string;
  eventTags?: string[];
  visitDate?: string;
}

// Lazy Supabase init (env vars may not be available at module load on some runtimes)
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    const missing = [
      !url && 'SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY',
    ].filter(Boolean);
    throw new Error(`Missing env: ${missing.join(', ')}. Check Vercel Project Settings > Environment Variables.`);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  maxOutputTokens: 500,
  apiKey: process.env.GOOGLE_API_KEY || '',
});

// ============================================
// LLM Prompt for Query Parsing (Simplified)
// ============================================
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
  "tags": ["other keywords: 맛집, 혼밥, etc - NOT location terms"],
  "confidence": 0.0 to 1.0
}

=== EXAMPLES ===
"점심 뭐 먹지?" → {"intent": "DISCOVER_RECOMMEND", "location_keywords": [], "time_context": "lunch", "category_main": null, "category_sub": null, "tags": ["점심"], "confidence": 0.9}
"용산 맛집" → {"intent": "REGION_SEARCH", "location_keywords": ["용산"], "time_context": null, "category_main": null, "category_sub": null, "tags": ["맛집"], "confidence": 0.95}
"연희 카페" → {"intent": "REGION_SEARCH", "location_keywords": ["연희"], "time_context": null, "category_main": "카페", "category_sub": null, "tags": [], "confidence": 0.95}
"성수 맛집" → {"intent": "REGION_SEARCH", "location_keywords": ["성수"], "time_context": null, "category_main": null, "category_sub": null, "tags": ["맛집"], "confidence": 0.95}
"부산 해운대 횟집" → {"intent": "REGION_SEARCH", "location_keywords": ["부산", "해운대"], "time_context": null, "category_main": "해산물", "category_sub": "회", "tags": ["횟집"], "confidence": 0.92}
"국밥 먹고 싶어" → {"intent": "CATEGORY_SEARCH", "location_keywords": [], "time_context": null, "category_main": "국물", "category_sub": "국밥", "tags": ["국밥"], "confidence": 0.92}
"강남 라멘" → {"intent": "REGION_SEARCH", "location_keywords": ["강남"], "time_context": null, "category_main": "면", "category_sub": "라멘", "tags": ["라멘"], "confidence": 0.95}
"히코 어때?" → {"intent": "DIRECT_PLACE", "location_keywords": [], "time_context": null, "category_main": null, "category_sub": null, "tags": ["히코"], "confidence": 0.88}
"아무거나 추천" → {"intent": "RANDOM_SUGGEST", "location_keywords": [], "time_context": null, "category_main": null, "category_sub": null, "tags": [], "confidence": 0.85}
"용산 혼밥" → {"intent": "REGION_SEARCH", "location_keywords": ["용산"], "time_context": null, "category_main": null, "category_sub": null, "tags": ["혼밥", "맛집"], "confidence": 0.9}

Output ONLY valid JSON. No explanation.`;

// Sub-region mapping removed: search is now location-agnostic (raw keywords only)

// Category sub to main mapping
const CATEGORY_SUB_TO_MAIN: Record<string, string> = {
  '덮밥': '밥', '정식': '밥', '도시락': '밥', '백반': '밥', '돈까스': '밥', '한식': '밥', '카레': '밥',
  '라멘': '면', '국수': '면', '파스타': '면', '쌀국수': '면', '우동': '면', '냉면': '면', '소바': '면',
  '국밥': '국물', '찌개': '국물', '탕': '국물', '전골': '국물',
  '구이': '고기요리', '스테이크': '고기요리', '바비큐': '고기요리', '수육': '고기요리',
  '해산물요리': '해산물', '회': '해산물', '해물찜': '해산물', '해물탕': '해산물', '조개/굴': '해산물',
  '김밥': '간편식', '샌드위치': '간편식', '토스트': '간편식', '햄버거': '간편식', '타코': '간편식', '분식': '간편식',
  '베트남': '양식·퓨전', '아시안': '양식·퓨전', '인도': '양식·퓨전', '양식': '양식·퓨전', '중식': '양식·퓨전',
  '프랑스': '양식·퓨전', '피자': '양식·퓨전', '리조또': '양식·퓨전', '브런치': '양식·퓨전',
  '케이크': '디저트', '베이커리': '디저트', '도넛': '디저트', '아이스크림': '디저트',
  '커피': '카페', '차': '카페', '논커피': '카페', '와인바/바': '카페', '카공카페': '카페',
  '이자카야': '술안주', '포차': '술안주', '안주 전문': '술안주',
};

// New LLM output schema (flat)
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

// Map new intent → SearchIntent
const INTENT_MAP: Record<string, SearchIntent> = {
  DISCOVER_RECOMMEND: 'DISCOVER_RECOMMEND',
  REGION_SEARCH: 'SEARCH_BY_REGION',
  CATEGORY_SEARCH: 'SEARCH_BY_CATEGORY',
  DIRECT_PLACE: 'ASK_DETAILS',
  RANDOM_SUGGEST: 'RANDOM_PICK',
};

// Map time_context → time_of_day (Korean)
const TIME_CONTEXT_MAP: Record<string, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  late_night: '야식',
};

// ============================================
// Enhanced Query Parsing
// ============================================
interface ParseResult {
  enhanced: EnhancedLLMQuery;
  raw: Record<string, unknown>;
  confidence: number | null; // from LLM, null if missing/invalid
}
async function parseEnhancedQuery(text: string): Promise<ParseResult> {
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
    const messages = [new HumanMessage(combinedPrompt)];

    console.log('[search] Gemini invoke START', { queryLength: text?.length });
    const response = await llm.invoke(messages);
    console.log('[search] Gemini invoke DONE', { hasContent: !!response?.content });

    let content = typeof response.content === 'string'
      ? response.content
      : '';

    // Strip ```json and ``` fences (Gemini may return fenced output)
    content = content.trim();
    const jsonFence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
    const fenceMatch = content.match(jsonFence);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { enhanced: defaultQuery, raw: {}, confidence: null };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    // Parse confidence: use actual value, null if missing/invalid
    let confidence: number | null = null;
    const confVal = parsed.confidence;
    if (typeof confVal === 'number' && confVal >= 0 && confVal <= 1) {
      confidence = confVal;
    }

    // Parse new flat format
    const simple = parsed as Partial<SimpleLLMOutput>;
    const intent = INTENT_MAP[simple.intent as string] || 'CLARIFY_QUERY';
    const locationKeywords = Array.isArray(simple.location_keywords)
      ? simple.location_keywords.filter((k): k is string => typeof k === 'string')
      : [];
    const timeContext = simple.time_context as string;
    const timeOfDay = timeContext ? TIME_CONTEXT_MAP[timeContext] || null : null;
    const categoryMain = (simple.category_main as string) || null;
    const categorySub = (simple.category_sub as string) || null;
    const tags = Array.isArray(simple.tags) ? simple.tags : [];

    // DIRECT_PLACE: first tag is place_name
    const placeName = intent === 'ASK_DETAILS' && tags.length > 0 ? tags[0] : null;

    // "혼밥" in tags → visit_context + exclude cafe
    const hasHonbab = tags.some((t) => String(t).toLowerCase().includes('혼밥'));
    const visitContext = hasHonbab ? ('혼밥' as VisitContext) : null;
    const excludeCategory = hasHonbab ? ['카페'] : null;

    const enhanced: EnhancedLLMQuery = {
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
        constraints: [],
        keywords: tags,
        count: null,
        open_now: null,
      },
    };

    return { enhanced, raw: parsed, confidence };
  } catch (error) {
    console.error('LLM parsing error:', error);
    return { enhanced: defaultQuery, raw: {}, confidence: null };
  }
}

// Convert enhanced query to legacy LLMQuery for compatibility
function toLegacyQuery(enhanced: EnhancedLLMQuery, uiRegionHint?: string): LLMQuery {
  const legacy: LLMQuery = {
    keywords: enhanced.slots.keywords || [],
    sort: 'relevance',
  };

  // Location: use raw location_keywords (no hardcoded mapping)
  const locKw = enhanced.slots.location_keywords || [];
  if (locKw.length > 0) {
    legacy.locationKeywords = [...locKw];
  } else if (uiRegionHint && uiRegionHint !== '서울 전체') {
    // UI hint as fallback when no location in query
    legacy.locationKeywords = [uiRegionHint];
  }

  if (enhanced.slots.region) {
    legacy.region = [enhanced.slots.region];
  }
  if (enhanced.slots.sub_region) {
    legacy.subRegion = [enhanced.slots.sub_region];
  }
  if (enhanced.slots.category_main) {
    legacy.categoryMain = [enhanced.slots.category_main];
  }
  if (enhanced.slots.category_sub) {
    legacy.categorySub = [enhanced.slots.category_sub];
  }
  if (enhanced.slots.exclude_category_main) {
    legacy.excludeCategoryMain = enhanced.slots.exclude_category_main;
  }

  // Map constraints
  const constraints: LLMQuery['constraints'] = {};
  if (enhanced.slots.visit_context === '혼밥' || enhanced.slots.visit_context === '혼술') {
    constraints.solo_ok = true;
  }
  if (enhanced.slots.constraints.includes('조용한')) {
    constraints.quiet = true;
  }
  if (enhanced.slots.constraints.includes('웨이팅_없음')) {
    constraints.no_wait = true;
  }
  if (enhanced.slots.constraints.includes('가성비') || enhanced.slots.constraints.includes('비싼_곳_제외')) {
    constraints.price_level = 2;
  }
  if (Object.keys(constraints).length > 0) {
    legacy.constraints = constraints;
  }

  // Add place name to keywords if present
  if (enhanced.slots.place_name) {
    legacy.keywords = [...(legacy.keywords || []), enhanced.slots.place_name];
  }

  return legacy;
}

// Get location IDs that match keywords via tags (SQL array overlap, uses GIN index)
async function getLocationIdsByTags(keywords: string[]): Promise<Set<string>> {
  const locationIds = new Set<string>();
  const trimmed = keywords?.filter((k) => typeof k === 'string' && k.trim()) ?? [];
  if (trimmed.length === 0) return locationIds;

  const { data, error } = await getSupabase()
    .from('locations')
    .select('id')
    .overlaps('tags', trimmed);

  if (error) {
    console.error('getLocationIdsByTags overlap error:', error);
    return locationIds;
  }
  (data || []).forEach((r: { id: string }) => locationIds.add(r.id));
  return locationIds;
}

// Match location keyword against sub_region, region, province, tags (flexible, forgiving)
function locationMatchesKeyword(
  loc: { sub_region?: string; region?: string; province?: string; tags?: string[] },
  keyword: string
): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  const sub = (loc.sub_region || '').toLowerCase();
  const reg = (loc.region || '').toLowerCase();
  const prov = (loc.province || '').toLowerCase();
  if (sub.includes(kw) || reg.includes(kw) || prov.includes(kw)) return true;
  const tagList = loc.tags || [];
  return tagList.some((t) => String(t).toLowerCase().includes(kw));
}

// Search locations (uses locations_search view: popularity_score, trust_score, curator_visited for ranking)
async function searchLocations(query: LLMQuery): Promise<Location[]> {
  let dbQuery = getSupabase().from('locations_search').select('*');

  const hasKeywords = query.keywords && query.keywords.length > 0;
  const hasLocationKeywords = query.locationKeywords && query.locationKeywords.length > 0;

  // Legacy exact region filter (when region/subRegion passed for compatibility)
  if (query.region && query.region.length > 0) {
    const regions = query.region.filter((r) => r !== '서울 전체');
    if (regions.length > 0) {
      dbQuery = dbQuery.in('region', regions);
    }
  }
  if (query.subRegion && query.subRegion.length > 0) {
    dbQuery = dbQuery.in('sub_region', query.subRegion);
  }

  // Filter by category (레거시 호환)
  if (query.category && query.category.length > 0) {
    dbQuery = dbQuery.in('category', query.category);
  }

  // Filter by categoryMain (새 구조)
  if (query.categoryMain && query.categoryMain.length > 0) {
    dbQuery = dbQuery.in('category_main', query.categoryMain);
  }

  // Filter by categorySub (새 구조)
  if (query.categorySub && query.categorySub.length > 0) {
    dbQuery = dbQuery.in('category_sub', query.categorySub);
  }

  // Filter by price level
  if (query.constraints?.price_level) {
    dbQuery = dbQuery.lte('price_level', query.constraints.price_level);
  }

  // Execute: fetch more when filtering by location_keywords in memory (wider net)
  const limit = hasLocationKeywords ? 500 : (hasKeywords ? 200 : 100);
  const { data, error } = await dbQuery
    .order('curation_level', { ascending: false, nullsFirst: false })
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .order('trust_score', { ascending: false, nullsFirst: false })
    .order('curator_visited', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Supabase query error:', error);
    return [];
  }

  type LocWithProvince = Location & { province?: string };
  let results: LocWithProvince[] = (data || []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.name as string,
    region: item.region as string,
    subRegion: item.sub_region as string | undefined,
    province: item.province as string | undefined,
    category: item.category as string,
    lon: item.lon as number,
    lat: item.lat as number,
    address: item.address as string,
    memo: item.memo as string,
    shortDesc: item.short_desc as string | undefined,
    features: item.features as Record<string, boolean> | undefined,
    rating: item.rating as number,
    curationLevel: item.curation_level as number | undefined,
    priceLevel: item.price_level as number | undefined,
    naverPlaceId: item.naver_place_id as string | undefined,
    kakaoPlaceId: item.kakao_place_id as string | undefined,
    imageUrl: (item.image_url || item.imageUrl) as string,
    eventTags: (item.event_tags || item.eventTags) as string[] | undefined,
    visitDate: (item.visit_date || item.visitDate) as string | undefined,
    // 새 카테고리 구조 추가
    categoryMain: item.category_main as string | undefined,
    categorySub: item.category_sub as string | undefined,
    tags: item.tags as string[] | undefined,
  }));

  // Flexible location filter (sub_region, region, province, tags)
  if (hasLocationKeywords && query.locationKeywords) {
    const locKw = query.locationKeywords.filter((k) => typeof k === 'string' && k.trim());
    if (locKw.length > 0) {
      results = results.filter((loc) =>
        locKw.some((kw) => locationMatchesKeyword(loc, kw))
      );
    }
  }

  // 제외 카테고리 필터링
  if (query.excludeCategoryMain && query.excludeCategoryMain.length > 0) {
    results = results.filter((loc) => {
      const locCategoryMain = loc.categoryMain;
      return !locCategoryMain || !query.excludeCategoryMain?.includes(locCategoryMain);
    });
  }

  // Get tag-matched location IDs for keyword boosting
  const tagMatchedIds = await getLocationIdsByTags(query.keywords || []);

  // Constraints 필터링 (더 유연하게)
  if (query.constraints) {
    results = results.filter((loc) => {
      // solo_ok: 피쳐가 있거나, 혼밥 태그가 있거나, 키워드에 혼밥이 포함된 경우
      if (query.constraints?.solo_ok) {
        const hasSoloOkFeature = loc.features?.solo_ok === true;
        const hasSoloTag = loc.tags?.some(tag => 
          ['혼밥', '혼자', '혼술'].some(keyword => tag.toLowerCase().includes(keyword.toLowerCase()))
        );
        const hasSoloKeyword = query.keywords?.some(kw => 
          ['혼밥', '혼자', '혼술'].some(keyword => kw.toLowerCase().includes(keyword.toLowerCase()))
        ) && tagMatchedIds.has(loc.id);
        
        if (!hasSoloOkFeature && !hasSoloTag && !hasSoloKeyword) {
        return false;
        }
      }

      if (query.constraints?.quiet && !loc.features?.quiet) {
        return false;
      }

      if (query.constraints?.no_wait && !loc.features?.no_wait) {
        return false;
      }

      return true;
    });
  }

  // 일반적인 키워드 목록 (키워드 필터링에서 제외)
  const GENERIC_KEYWORDS = ['맛집', '추천', '알려줘', '보여줘', '어디', '어디서', '어디가', '가고 싶어', '먹고 싶어', '가볼 곳'];

  // Keyword matching: include tag matches OR text matches
  // 단, 일반적인 키워드는 필터링하지 않음 (region/category 필터만 적용)
  if (query.keywords && query.keywords.length > 0) {
    const keywordLower = query.keywords.map((k) => k.toLowerCase());
    
    // 일반적인 키워드만 있는 경우 키워드 필터링 건너뛰기
    const hasSpecificKeywords = keywordLower.some(kw => 
      !GENERIC_KEYWORDS.some(generic => kw.includes(generic) || generic.includes(kw))
    );
    
    if (hasSpecificKeywords) {
      // 구체적인 키워드가 있는 경우에만 키워드 필터링 적용
      const filteredResults = results.filter((loc) => {
      // Include if matched by tags
      if (tagMatchedIds.has(loc.id)) {
        return true;
      }
        // Or if matched by text search (name, memo, shortDesc)
      const searchText = `${loc.name} ${loc.memo || ''} ${loc.shortDesc || ''}`.toLowerCase();
        return keywordLower.some((kw) => {
          // 일반적인 키워드는 제외
          if (GENERIC_KEYWORDS.some(generic => kw.includes(generic) || generic.includes(kw))) {
            return false;
          }
          return searchText.includes(kw);
        });
      });

      // 키워드 매칭 결과가 없어도 region 필터는 절대 무시하지 않음
      // region 필터가 있으면 그대로 유지하고 키워드 필터만 제거
      const hasLocationFilter = hasLocationKeywords || (query.region && query.region.length > 0);
      if (filteredResults.length === 0 && hasLocationFilter) {
        // region 필터는 유지하고 키워드 필터만 제거 (이미 results에 region 필터가 적용됨)
        // results는 그대로 사용 (region 필터만 적용된 상태)
      } else {
        results = filteredResults;
      }

    // Boost tag-matched results to top
    results.sort((a, b) => {
      const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
      const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
      if (aTagMatch !== bTagMatch) {
        return bTagMatch - aTagMatch;
      }
      return (b.rating || 0) - (a.rating || 0);
    });
    } else {
      // 일반적인 키워드만 있는 경우 키워드 필터링 건너뛰고 region/category 필터만 적용
      // results는 이미 region/category 필터가 적용된 상태이므로 그대로 사용
      // 태그 매칭된 결과를 상단으로 정렬
      results.sort((a, b) => {
        const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
        const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
        if (aTagMatch !== bTagMatch) {
          return bTagMatch - aTagMatch;
        }
        return (b.rating || 0) - (a.rating || 0);
      });
    }
  }

  // Sort by rating if explicitly requested
  if (query.sort === 'rating') {
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // 최대 50개로 제한
  return results.slice(0, 50);
}

// ============================================
// Fallback Search Strategy (5 levels)
// ============================================

interface FallbackResult {
  places: Location[];
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

// Non-critical constraints that can be dropped first
const NON_CRITICAL_CONSTRAINTS: SearchConstraint[] = [
  '체인점_제외', '관광지_제외', '가성비', '비싼_곳_제외', '빠른_회전'
];

async function searchWithFallback(
  enhanced: EnhancedLLMQuery,
  originalText: string,
  uiRegion?: string
): Promise<FallbackResult> {
  const fallbackNotes: string[] = [];

  // Create working copy of slots
  const workingSlots = { ...enhanced.slots };

  // Only add original query to keywords for DIRECT_PLACE/ASK_DETAILS (place name search)
  // Do NOT add full sentences for DISCOVER_RECOMMEND etc. (keyword pollution)
  const trimmedText = originalText.trim();
  if (enhanced.intent === 'ASK_DETAILS' && trimmedText && !workingSlots.keywords.includes(trimmedText)) {
    workingSlots.keywords = [...workingSlots.keywords, trimmedText];
  }

  // UI region hint: use when no location_keywords in query
  if (workingSlots.location_keywords?.length === 0 && uiRegion && uiRegion !== '서울 전체') {
    workingSlots.location_keywords = [uiRegion];
  }

  // Level 0: Original query
  let legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
  let places = await searchLocations(legacyQuery);

  if (places.length > 0) {
    return {
      places,
      fallback_applied: false,
      fallback_notes: [],
      fallback_level: 0,
    };
  }

  // Level 1: Drop non-critical constraints
  if (workingSlots.constraints.length > 0) {
    const originalConstraints = [...workingSlots.constraints];
    workingSlots.constraints = workingSlots.constraints.filter(
      c => !NON_CRITICAL_CONSTRAINTS.includes(c)
    );
    if (workingSlots.constraints.length < originalConstraints.length) {
      fallbackNotes.push('일부 조건을 완화했어요');
      legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
      places = await searchLocations(legacyQuery);
      if (places.length > 0) {
        return {
          places,
          fallback_applied: true,
          fallback_notes: fallbackNotes,
          fallback_level: 1,
        };
      }
    }
  }

  // Level 2: Soften wait and other critical constraints
  if (workingSlots.constraints.includes('웨이팅_없음' as SearchConstraint)) {
    workingSlots.constraints = workingSlots.constraints.filter(c => c !== '웨이팅_없음');
    fallbackNotes.push('웨이팅 조건을 제외했어요');
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 2,
      };
    }
  }

  // Clear remaining constraints
  if (workingSlots.constraints.length > 0) {
    workingSlots.constraints = [];
    fallbackNotes.push('조건을 모두 완화했어요');
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 2,
      };
    }
  }

  // Level 3: Broaden category (category_sub → category_main)
  if (workingSlots.category_sub) {
    const categoryMain = CATEGORY_SUB_TO_MAIN[workingSlots.category_sub];
    if (categoryMain) {
      workingSlots.category_sub = null;
      workingSlots.category_main = categoryMain;
      fallbackNotes.push(`${enhanced.slots.category_sub} → ${categoryMain} 전체로 검색했어요`);
      legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
      places = await searchLocations(legacyQuery);
      if (places.length > 0) {
        return {
          places,
          fallback_applied: true,
          fallback_notes: fallbackNotes,
          fallback_level: 3,
        };
      }
    }
  }

  // Level 4: Gradually remove location keywords (one at a time, last first)
  let locKw = workingSlots.location_keywords || [];
  while (locKw.length > 1) {
    const reduced = locKw.slice(0, -1);
    workingSlots.location_keywords = reduced;
    const removed = locKw[locKw.length - 1];
    fallbackNotes.push(`"${removed}" 범위를 넓혔어요`);
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 4,
      };
    }
    locKw = reduced;
  }

  // Level 4b: Remove last location keyword (keep category)
  if (locKw.length > 0) {
    workingSlots.location_keywords = [];
    fallbackNotes.push('지역 조건을 제외하고 검색했어요');
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots }, uiRegion);
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 4,
      };
    }
  }

  // Level 5: Curated safe picks (top-rated diverse recommendations)
  workingSlots.category_main = null;
  workingSlots.category_sub = null;
  workingSlots.exclude_category_main = null;
  fallbackNotes.push('조건에 맞는 장소가 없어 인기 장소를 보여드려요');

  const { data: topRated } = await getSupabase()
    .from('locations')
    .select('*')
    .order('rating', { ascending: false })
    .limit(20);

  if (topRated && topRated.length > 0) {
    places = topRated.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      name: item.name as string,
      region: item.region as string,
      subRegion: item.sub_region as string | undefined,
      category: item.category as string,
      lon: item.lon as number,
      lat: item.lat as number,
      address: item.address as string,
      memo: item.memo as string,
      shortDesc: item.short_desc as string | undefined,
      features: item.features as Record<string, boolean> | undefined,
      rating: item.rating as number,
      curationLevel: item.curation_level as number | undefined,
      priceLevel: item.price_level as number | undefined,
      naverPlaceId: item.naver_place_id as string | undefined,
      kakaoPlaceId: item.kakao_place_id as string | undefined,
      imageUrl: (item.image_url || item.imageUrl) as string,
      eventTags: (item.event_tags || item.eventTags) as string[] | undefined,
      visitDate: (item.visit_date || item.visitDate) as string | undefined,
      categoryMain: item.category_main as string | undefined,
      categorySub: item.category_sub as string | undefined,
      tags: item.tags as string[] | undefined,
    }));

    return {
      places,
      fallback_applied: true,
      fallback_notes: fallbackNotes,
      fallback_level: 5,
    };
  }

  // No results at all
  return {
    places: [],
    fallback_applied: true,
    fallback_notes: fallbackNotes,
    fallback_level: 5,
  };
}

// Generate UI hints based on results and intent
function generateUIHints(
  enhanced: EnhancedLLMQuery,
  resultCount: number,
  fallbackApplied: boolean,
  fallbackNotes: string[]
): UIHints {
  if (resultCount === 0) {
    return {
      message_type: 'no_results_soft',
      message: '조건에 맞는 장소를 찾지 못했어요.',
      suggestions: [
        '다른 지역으로 검색해보세요',
        '조건을 줄여서 검색해보세요',
        '비슷한 카테고리로 검색해보세요',
      ],
    };
  }

  if (enhanced.intent === 'CLARIFY_QUERY') {
    return {
      message_type: 'need_clarification',
      message: '검색어가 명확하지 않아요.',
      suggestions: [
        '지역을 포함해서 검색해보세요 (예: 강남 라멘)',
        '음식 종류를 명시해보세요 (예: 혼밥 맛집)',
      ],
    };
  }

  if (fallbackApplied && fallbackNotes.length > 0) {
    return {
      message_type: 'success',
      message: fallbackNotes.join(' / '),
    };
  }

  return {
    message_type: 'success',
    message: `${resultCount}개의 장소를 찾았어요!`,
  };
}

// Generate search actions based on intent
function generateSearchActions(
  enhanced: EnhancedLLMQuery,
  resultCount: number,
  fallbackResult: FallbackResult
): SearchActions {
  let mode: 'browse' | 'explore' = 'browse';
  let shouldShowMap = true;
  let resultLimit = 50;

  // Adjust based on intent
  switch (enhanced.intent) {
    case 'ASK_DETAILS':
    case 'ASK_SIMILAR_TO':
      mode = 'explore';
      resultLimit = 10;
      break;
    case 'RANDOM_PICK':
      resultLimit = 5;
      break;
    case 'COMPARE_OPTIONS':
      resultLimit = 10;
      break;
    case 'FIND_NEAR_ME':
      shouldShowMap = true;
      resultLimit = 20;
      break;
    default:
      break;
  }

  return {
    mode,
    should_show_map: shouldShowMap,
    result_limit: resultLimit,
    fallback_applied: fallbackResult.fallback_applied,
    fallback_notes: fallbackResult.fallback_notes,
    fallback_level: fallbackResult.fallback_level,
  };
}

// STEP 2: Update search_logs after LLM parsing
// Dedicated columns for analytics; parsed JSONB stores ONLY raw LLM output
async function updateSearchLogParsed(
  searchLogId: string,
  enhanced: EnhancedLLMQuery,
  rawParsed: Record<string, unknown>,
  llmMs: number,
  confidence: number | null
): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {
      parsed: rawParsed, // ONLY raw LLM response, no duplicated semantic fields
      llm_ms: llmMs,
      parsed_intent: enhanced.intent,
      parsed_category_main: enhanced.slots.category_main ?? null,
      parsed_category_sub: enhanced.slots.category_sub ?? null,
      parsed_tags: enhanced.slots.keywords?.length ? enhanced.slots.keywords : null,
      parsed_confidence: confidence,
    };

    // @ts-expect-error - search_logs schema may not include all columns in generated types
    await getSupabase().from('search_logs').update(updatePayload).eq('id', searchLogId);

    console.log(`[search_logs] UPDATE parsed: ${searchLogId}`);
  } catch (err) {
    console.error(`[search_logs] UPDATE parsed error:`, err);
  }
}

// STEP 3 & 4: Update result_count and fallback (do not overwrite parsed/parsed_*)
async function updateSearchLogResult(
  searchLogId: string,
  resultCount: number,
  dbMs: number,
  totalMs: number,
  fallbackUsed: boolean,
  fallbackStep: number
): Promise<void> {
  try {
    // @ts-expect-error - search_logs schema may not include all columns in generated types
    await getSupabase().from('search_logs').update({
      result_count: resultCount,
      fallback_used: fallbackUsed,
      fallback_step: fallbackStep,
      db_ms: dbMs,
      total_ms: totalMs,
    }).eq('id', searchLogId);

    console.log(`[search_logs] UPDATE result: ${searchLogId}, count=${resultCount}, fallback=${fallbackUsed}`);
  } catch (err) {
    console.error(`[search_logs] UPDATE result error:`, err);
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const traceId = randomUUID();
  const startTime = Date.now();
  console.log(`[${traceId}] Handler START`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Trace-ID', traceId);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', traceId });
  }

  const { text, uiRegion, search_log_id } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" field', traceId });
  }

  const searchLogId = search_log_id && typeof search_log_id === 'string' ? search_log_id : null;
  console.log(`[${traceId}] Search request: "${text}"${uiRegion ? ` (UI region: ${uiRegion})` : ''}${searchLogId ? ` (search_log_id: ${searchLogId})` : ''}`);

  try {
    // 1. Parse query with enhanced LLM
    const llmStart = Date.now();
    const { enhanced, raw, confidence } = await parseEnhancedQuery(text);
    const llmMs = Date.now() - llmStart;
    console.log(`[${traceId}] LLM parsed in ${llmMs}ms:`, JSON.stringify(enhanced));

    // STEP 2: Update search_logs (parsed_* columns + parsed=raw only, llm_ms)
    if (searchLogId) {
      await updateSearchLogParsed(searchLogId, enhanced, raw, llmMs, confidence);
    }

    // 2. Search with fallback strategy
    const dbStart = Date.now();
    const fallbackResult = await searchWithFallback(enhanced, text, uiRegion);
    const dbMs = Date.now() - dbStart;
    console.log(`[${traceId}] Search with fallback in ${dbMs}ms: ${fallbackResult.places.length} results (level: ${fallbackResult.fallback_level})`);

    const totalMs = Date.now() - startTime;
    const timing: TimingMetrics = { llmMs, dbMs, totalMs };

    // STEP 3 & 4: Update result_count and fallback
    if (searchLogId) {
      await updateSearchLogResult(
        searchLogId,
        fallbackResult.places.length,
        dbMs,
        totalMs,
        fallbackResult.fallback_applied,
        fallbackResult.fallback_level
      );
    }

    // 3. Generate actions and UI hints
    const actions = generateSearchActions(enhanced, fallbackResult.places.length, fallbackResult);
    const uiHints = generateUIHints(
      enhanced,
      fallbackResult.places.length,
      fallbackResult.fallback_applied,
      fallbackResult.fallback_notes
    );

    // 4. Convert to legacy query for response
    const legacyQuery = toLegacyQuery(enhanced, uiRegion);

    // 5. Return enhanced response
    return res.status(200).json({
      // Core results
      places: fallbackResult.places,

      // Enhanced query info
      intent: enhanced.intent,
      slots: enhanced.slots,

      // Legacy query (for backward compatibility)
      query: legacyQuery,

      // Actions for frontend
      actions,

      // UI hints
      ui_hints: uiHints,

      // Metadata
      traceId,
      timing,
      search_log_id: searchLogId,
    });
  } catch (error) {
    const totalMs = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${traceId}] Search error after ${totalMs}ms:`, err.message, err.stack);
    return res.status(500).json({
      error: 'Internal server error',
      traceId,
      detail: err.message,
    });
  }
}
