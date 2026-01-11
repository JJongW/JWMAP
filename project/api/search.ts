import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

// Types
interface LLMQuery {
  region?: string[];
  subRegion?: string[];
  category?: string[];
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
  model: 'gemini-1.5-flash',
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

Available categories (use exact strings):
- "한식", "중식", "일식", "라멘", "양식", "분식", "호프집", "칵테일바"
- "와인바", "아시안", "돈까스", "회", "피자", "베이커리", "카페", "카공카페", "버거"

Constraints you can detect:
- solo_ok: mentions eating alone, 혼밥, 혼술
- quiet: mentions quiet, 조용한, 분위기 좋은
- no_wait: mentions no waiting, 웨이팅 없는, 바로 입장
- price_level: 1=cheap, 2=moderate, 3=expensive, 4=very expensive

Output ONLY valid JSON matching this schema:
{
  "region": ["string array of matched regions"],
  "subRegion": ["optional finer locations like 한남동, 이태원역"],
  "category": ["string array of matched categories"],
  "keywords": ["extracted food types or dish names not in categories"],
  "constraints": {
    "solo_ok": boolean or null,
    "quiet": boolean or null,
    "no_wait": boolean or null,
    "price_level": number 1-4 or null
  },
  "sort": "relevance" or "rating"
}

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

// Get location IDs that match keywords via tags
async function getLocationIdsByTags(keywords: string[]): Promise<Set<string>> {
  const locationIds = new Set<string>();

  if (!keywords || keywords.length === 0) {
    return locationIds;
  }

  // Find tags matching keywords
  const { data: tags } = await supabase
    .from('tags')
    .select('id, name')
    .or(keywords.map((k) => `name.ilike.%${k}%`).join(','));

  if (!tags || tags.length === 0) {
    return locationIds;
  }

  const tagIds = tags.map((t: { id: string }) => t.id);

  // Find locations with these tags, ordered by weight
  const { data: locationTags } = await supabase
    .from('location_tags')
    .select('location_id, weight')
    .in('tag_id', tagIds)
    .order('weight', { ascending: false });

  if (locationTags) {
    locationTags.forEach((lt: { location_id: string }) => {
      locationIds.add(lt.location_id);
    });
  }

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

  // Filter by category
  if (query.category && query.category.length > 0) {
    dbQuery = dbQuery.in('category', query.category);
  }

  // Filter by price level
  if (query.constraints?.price_level) {
    dbQuery = dbQuery.lte('price_level', query.constraints.price_level);
  }

  // Execute query
  const { data, error } = await dbQuery.order('rating', { ascending: false }).limit(50);

  // Get tag-matched location IDs for keyword boosting
  const tagMatchedIds = await getLocationIdsByTags(query.keywords || []);

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
    imageUrl: item.image_url as string,
    eventTags: item.event_tags as string[] | undefined,
    visitDate: item.visit_date as string | undefined,
  }));

  // Filter by constraints (features)
  if (query.constraints) {
    results = results.filter((loc) => {
      if (query.constraints?.solo_ok && !loc.features?.solo_ok) {
        return false;
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
      // Or if matched by text search
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

  return results;
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
