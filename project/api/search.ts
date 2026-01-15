import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

// Types
interface LLMQuery {
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
  priceLevel?: number;
  naverPlaceId?: string;
  kakaoPlaceId?: string;
  imageUrl: string;
  eventTags?: string[];
  visitDate?: string;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  maxOutputTokens: 500,
  apiKey: process.env.GOOGLE_API_KEY || '',
});

// LLM prompt for query parsing
const SYSTEM_PROMPT = `You are a query parser for a Seoul restaurant discovery service.
Your job is to convert natural language Korean queries into structured JSON.

Available regions (use exact strings):
- "서울 전체" (all Seoul)
- "강남", "서초", "잠실/송파/강동", "영등포/여의도/강서", "건대/성수/왕십리"
- "종로/중구", "홍대/합정/마포/연남", "용산/이태원/한남", "성북/노원/중랑"
- "구로/관악/동작", "신촌/연희", "창동/도봉산", "회기/청량리", "강동/고덕"
- "연신내/구파발", "마곡/김포", "미아/수유/북한산", "목동/양천", "금천/가산"

카테고리 대분류 (categoryMain):
- "밥" (덮밥, 정식, 도시락, 백반, 돈까스, 한식, 카레)
- "면" (라멘, 국수, 파스타, 쌀국수, 우동, 냉면, 소바)
- "국물" (국밥, 찌개, 탕, 전골)
- "고기요리" (구이, 스테이크, 바비큐, 수육)
- "해산물" (해산물요리, 회, 해물찜, 해물탕, 조개/굴)
- "간편식" (김밥, 샌드위치, 토스트, 햄버거, 타코, 분식)
- "양식·퓨전" (베트남, 아시안, 인도, 양식, 중식, 프랑스, 파스타, 피자, 리조또, 브런치)
- "디저트" (케이크, 베이커리, 도넛, 아이스크림)
- "카페" (커피, 차, 논커피, 와인바/바, 카공카페)
- "술안주" (이자카야, 포차, 안주 전문)

카테고리 소분류 (categorySub):
- 밥: "덮밥", "정식", "도시락", "백반", "돈까스", "한식", "카레"
- 면: "라멘", "국수", "파스타", "쌀국수", "우동", "냉면", "소바"
- 국물: "국밥", "찌개", "탕", "전골"
- 고기요리: "구이", "스테이크", "바비큐", "수육"
- 해산물: "해산물요리", "회", "해물찜", "해물탕", "조개/굴"
- 간편식: "김밥", "샌드위치", "토스트", "햄버거", "타코", "분식"
- 양식·퓨전: "베트남", "아시안", "인도", "양식", "중식", "프랑스", "파스타", "피자", "리조또", "브런치"
- 디저트: "케이크", "베이커리", "도넛", "아이스크림"
- 카페: "커피", "차", "논커피", "와인바/바", "카공카페"
- 술안주: "이자카야", "포차", "안주 전문"

중요한 규칙:
1. "혼밥" 검색 시: solo_ok를 true로 설정하고, excludeCategoryMain에 ["카페"]를 추가 (카페 제외, 음식점만)
2. "맛집" 검색 시: 특정 카테고리 지정 없이 지역만 필터링
3. 카테고리 제외: "카페 제외", "술집 빼고" 같은 표현을 excludeCategoryMain에 반영
4. 키워드: 음식 이름, 태그로 사용될 수 있는 단어들을 keywords에 포함

한국어 자연스러운 표현 매핑:
- "밥집", "밥 먹을 곳", "밥 먹고 싶어", "밥 먹을래" → categoryMain: ["밥"]
- "면집", "면 먹을 곳", "면 먹고 싶어" → categoryMain: ["면"]
- "국물집", "국물 먹을 곳" → categoryMain: ["국물"]
- "고기집", "고기 먹을 곳", "고기 먹고 싶어" → categoryMain: ["고기요리"]
- "회집", "회 먹을 곳", "해산물 먹을 곳" → categoryMain: ["해산물"]
- "카페", "커피숍", "카페 가고 싶어" → categoryMain: ["카페"]
- "술집", "술 마실 곳", "안주 먹을 곳" → categoryMain: ["술안주"]
- "맛집" → 카테고리 지정 없이 지역만 필터링 (이미 규칙 2에 있음)
- "추천해줘", "추천", "알려줘", "보여줘", "어디가 좋아" → 무시 (의미 없는 표현)

Constraints you can detect:
- solo_ok: mentions eating alone, 혼밥, 혼술, 혼자 먹기
- quiet: mentions quiet, 조용한, 분위기 좋은
- no_wait: mentions no waiting, 웨이팅 없는, 바로 입장
- price_level: 1=cheap, 2=moderate, 3=expensive, 4=very expensive

Output ONLY valid JSON matching this schema:
{
  "region": ["string array of matched regions"],
  "subRegion": ["optional finer locations like 한남동, 이태원역"],
  "categoryMain": ["string array of category mains like 밥, 면, 카페"],
  "categorySub": ["string array of category subs like 라멘, 회"],
  "excludeCategoryMain": ["string array of category mains to exclude like 카페"],
  "keywords": ["extracted food types, dish names, or tags"],
  "constraints": {
    "solo_ok": boolean or null,
    "quiet": boolean or null,
    "no_wait": boolean or null,
    "price_level": number 1-4 or null
  },
  "sort": "relevance" or "rating"
}

Examples:
- "용산 맛집" → {"region": ["용산/이태원/한남"]}
- "용산 밥집 추천해줘" → {"region": ["용산/이태원/한남"], "categoryMain": ["밥"]}
- "용산 밥집" → {"region": ["용산/이태원/한남"], "categoryMain": ["밥"]}
- "용산 밥 먹을 곳" → {"region": ["용산/이태원/한남"], "categoryMain": ["밥"]}
- "용산 혼밥" → {"region": ["용산/이태원/한남"], "constraints": {"solo_ok": true}, "excludeCategoryMain": ["카페"]}
- "강남 라멘" → {"region": ["강남"], "categorySub": ["라멘"]}
- "강남 면집 추천" → {"region": ["강남"], "categoryMain": ["면"]}
- "홍대 카페 제외" → {"region": ["홍대/합정/마포/연남"], "excludeCategoryMain": ["카페"]}
- "용산 고기집 알려줘" → {"region": ["용산/이태원/한남"], "categoryMain": ["고기요리"]}

If a field is not mentioned, omit it or set to null. Never invent data.`;

// Parse query using LangChain
async function parseQuery(text: string): Promise<LLMQuery> {
  try {
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Parse this query: "${text}"`),
    ];

    const response = await llm.invoke(messages);

    const content = typeof response.content === 'string'
      ? response.content
      : '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }

    return JSON.parse(jsonMatch[0]) as LLMQuery;
  } catch (error) {
    console.error('LLM parsing error:', error);
    return {};
  }
}

// Get location IDs that match keywords via tags (locations.tags 배열 직접 검색)
async function getLocationIdsByTags(keywords: string[]): Promise<Set<string>> {
  const locationIds = new Set<string>();

  if (!keywords || keywords.length === 0) {
    return locationIds;
  }

  // locations 테이블의 tags 배열에서 직접 검색
  // Supabase는 배열 컬럼에서 ilike 검색을 지원하지 않으므로, 모든 locations를 가져와서 필터링
  const { data: allLocations } = await supabase
    .from('locations')
    .select('id, tags');

  if (!allLocations) {
    return locationIds;
  }

  // 키워드가 tags 배열에 포함된 location 찾기
  const keywordLower = keywords.map(k => k.toLowerCase());
  allLocations.forEach((loc: { id: string; tags: string[] | null }) => {
    if (!loc.tags || !Array.isArray(loc.tags)) return;
    
    const locTagsLower = loc.tags.map(t => t.toLowerCase());
    const matches = keywordLower.some(kw => 
      locTagsLower.some(tag => tag.includes(kw) || kw.includes(tag))
    );
    
    if (matches) {
      locationIds.add(loc.id);
    }
  });

  return locationIds;
}

// Search locations based on parsed query
async function searchLocations(query: LLMQuery): Promise<Location[]> {
  let dbQuery = supabase.from('locations').select('*');

  // Filter by region
  if (query.region && query.region.length > 0) {
    const regions = query.region.filter((r) => r !== '서울 전체');
    if (regions.length > 0) {
      dbQuery = dbQuery.in('region', regions);
    }
  }

  // Filter by sub_region
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

  // Execute query (제외 필터는 나중에 적용)
  const { data, error } = await dbQuery.order('rating', { ascending: false }).limit(100);

  if (error) {
    console.error('Supabase query error:', error);
    return [];
  }

  let results: Location[] = (data || []).map((item: Record<string, unknown>) => ({
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

  // Keyword matching: include tag matches OR text matches
  if (query.keywords && query.keywords.length > 0) {
    const keywordLower = query.keywords.map((k) => k.toLowerCase());
    results = results.filter((loc) => {
      // Include if matched by tags
      if (tagMatchedIds.has(loc.id)) {
        return true;
      }
      // Or if matched by text search (name, memo, shortDesc)
      const searchText = `${loc.name} ${loc.memo || ''} ${loc.shortDesc || ''}`.toLowerCase();
      return keywordLower.some((kw) => searchText.includes(kw));
    });

    // Boost tag-matched results to top
    results.sort((a, b) => {
      const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
      const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
      if (aTagMatch !== bTagMatch) {
        return bTagMatch - aTagMatch;
      }
      return (b.rating || 0) - (a.rating || 0);
    });
  }

  // Sort by rating if explicitly requested
  if (query.sort === 'rating') {
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // 최대 50개로 제한
  return results.slice(0, 50);
}

// Log search to database
async function logSearch(
  traceId: string,
  queryText: string,
  parsed: LLMQuery,
  resultCount: number,
  timing: TimingMetrics
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('search_logs')
      .insert({
        id: traceId,
        query: queryText,
        parsed: parsed,
        result_count: resultCount,
        llm_ms: timing.llmMs,
        db_ms: timing.dbMs,
        total_ms: timing.totalMs,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[${traceId}] Search log error:`, error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error(`[${traceId}] Search log exception:`, err);
    return null;
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const traceId = randomUUID();
  const startTime = Date.now();

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

  const { text } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" field', traceId });
  }

  console.log(`[${traceId}] Search request: "${text}"`);

  try {
    // 1. Parse query with LLM
    const llmStart = Date.now();
    const parsed = await parseQuery(text);
    const llmMs = Date.now() - llmStart;
    console.log(`[${traceId}] LLM parsed in ${llmMs}ms:`, JSON.stringify(parsed));

    // 2. Search locations
    const dbStart = Date.now();
    const places = await searchLocations(parsed);
    const dbMs = Date.now() - dbStart;
    console.log(`[${traceId}] DB search in ${dbMs}ms: ${places.length} results`);

    const totalMs = Date.now() - startTime;

    const timing: TimingMetrics = { llmMs, dbMs, totalMs };

    // 3. Log search (async, don't wait)
    logSearch(traceId, text, parsed, places.length, timing);

    // 4. Return results
    return res.status(200).json({
      places,
      query: parsed,
      traceId,
      timing,
    });
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error(`[${traceId}] Search error after ${totalMs}ms:`, error);
    return res.status(500).json({ error: 'Internal server error', traceId });
  }
}
