import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { runFallbackSearch } from './searchFallback';
import { generateSearchActions, generateUIHints } from './searchPresentation';
import { parseEnhancedQuery, toLegacyQuery } from './searchParser';
import { updateSearchLogParsed, updateSearchLogResult } from './searchLogging';
import {
  fetchLocationsSearchRows,
  fetchTagMatchedLocationIds,
  fetchTopRatedLocations as fetchTopRatedFromRepo,
} from './searchRepository';
import {
  applyConstraintFilter,
  applyKeywordFilter,
  applyLocationKeywordFilter,
} from './searchRanker';
import type {
  EnhancedLLMQuery,
  FallbackResult,
  LLMQuery,
  Location,
  TimingMetrics,
} from './searchTypes';

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

// Sub-region mapping removed: search is now location-agnostic (raw keywords only)

// Search locations (uses locations_search view: popularity_score, trust_score, curator_visited for ranking)
async function searchLocations(query: LLMQuery): Promise<Location[]> {
  const hasLocationKeywords = query.locationKeywords && query.locationKeywords.length > 0;
  let results = await fetchLocationsSearchRows(getSupabase, query);
  results = applyLocationKeywordFilter(results, query.locationKeywords);

  if (query.excludeCategoryMain?.length) {
    results = results.filter((loc) => !loc.categoryMain || !query.excludeCategoryMain?.includes(loc.categoryMain));
  }

  const tagMatchedIds = await fetchTagMatchedLocationIds(getSupabase, query.keywords || []);
  results = applyConstraintFilter(results, query, tagMatchedIds);
  const hasLocationFilter = hasLocationKeywords || !!(query.region && query.region.length > 0);
  results = applyKeywordFilter(results, query, tagMatchedIds, hasLocationFilter);

  if (query.sort === 'rating') {
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  return results.slice(0, 50);
}

// ============================================
// Fallback Search Strategy (5 levels)
// ============================================

async function fetchTopRatedLocationsForFallback(): Promise<Location[]> {
  return fetchTopRatedFromRepo(getSupabase);
}

async function searchWithFallback(
  enhanced: EnhancedLLMQuery,
  originalText: string,
  uiRegion?: string
): Promise<FallbackResult> {
  return runFallbackSearch(enhanced, originalText, uiRegion, {
    toLegacyQuery,
    searchLocations,
    categorySubToMain: CATEGORY_SUB_TO_MAIN,
    fetchTopRated: fetchTopRatedLocationsForFallback,
  });
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
      await updateSearchLogParsed(getSupabase, searchLogId, enhanced, raw, llmMs, confidence);
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
        getSupabase,
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
