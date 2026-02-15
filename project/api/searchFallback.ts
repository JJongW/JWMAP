import type { EnhancedLLMQuery, FallbackResult, LLMQuery, Location, SearchConstraint } from './searchTypes';

type LegacyQueryBuilder = (enhanced: EnhancedLLMQuery, uiRegion?: string) => LLMQuery;
type SearchExecutor = (query: LLMQuery) => Promise<Location[]>;
type TopRatedFetcher = () => Promise<Location[]>;

interface RunFallbackSearchDeps {
  toLegacyQuery: LegacyQueryBuilder;
  searchLocations: SearchExecutor;
  categorySubToMain: Record<string, string>;
  fetchTopRated: TopRatedFetcher;
}

const NON_CRITICAL_CONSTRAINTS: SearchConstraint[] = [
  '체인점_제외', '관광지_제외', '가성비', '비싼_곳_제외', '빠른_회전',
];

async function executeSearchWithSlots(
  enhanced: EnhancedLLMQuery,
  slots: EnhancedLLMQuery['slots'],
  uiRegion: string | undefined,
  deps: RunFallbackSearchDeps
) {
  const legacyQuery = deps.toLegacyQuery({ ...enhanced, slots }, uiRegion);
  const places = await deps.searchLocations(legacyQuery);
  return places;
}

async function tryLevel1RelaxNonCritical(
  enhanced: EnhancedLLMQuery,
  workingSlots: EnhancedLLMQuery['slots'],
  fallbackNotes: string[],
  uiRegion: string | undefined,
  deps: RunFallbackSearchDeps
): Promise<Location[] | null> {
  if (workingSlots.constraints.length === 0) return null;
  const originalConstraints = [...workingSlots.constraints];
  workingSlots.constraints = workingSlots.constraints.filter((c) => !NON_CRITICAL_CONSTRAINTS.includes(c));
  if (workingSlots.constraints.length >= originalConstraints.length) return null;
  fallbackNotes.push('일부 조건을 완화했어요');
  const places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
  return places.length > 0 ? places : null;
}

async function tryLevel2RelaxStrictConstraints(
  enhanced: EnhancedLLMQuery,
  workingSlots: EnhancedLLMQuery['slots'],
  fallbackNotes: string[],
  uiRegion: string | undefined,
  deps: RunFallbackSearchDeps
): Promise<Location[] | null> {
  if (workingSlots.constraints.includes('웨이팅_없음' as SearchConstraint)) {
    workingSlots.constraints = workingSlots.constraints.filter((c) => c !== '웨이팅_없음');
    fallbackNotes.push('웨이팅 조건을 제외했어요');
    const places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
    if (places.length > 0) return places;
  }
  if (workingSlots.constraints.length > 0) {
    workingSlots.constraints = [];
    fallbackNotes.push('조건을 모두 완화했어요');
    const places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
    if (places.length > 0) return places;
  }
  return null;
}

export async function runFallbackSearch(
  enhanced: EnhancedLLMQuery,
  originalText: string,
  uiRegion: string | undefined,
  deps: RunFallbackSearchDeps
): Promise<FallbackResult> {
  const fallbackNotes: string[] = [];
  const workingSlots = { ...enhanced.slots };

  const trimmedText = originalText.trim();
  if (enhanced.intent === 'ASK_DETAILS' && trimmedText && !workingSlots.keywords.includes(trimmedText)) {
    workingSlots.keywords = [...workingSlots.keywords, trimmedText];
  }

  if (workingSlots.location_keywords?.length === 0 && uiRegion && uiRegion !== '서울 전체') {
    workingSlots.location_keywords = [uiRegion];
  }

  let places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
  if (places.length > 0) {
    return { places, fallback_applied: false, fallback_notes: [], fallback_level: 0 };
  }

  const level1 = await tryLevel1RelaxNonCritical(enhanced, workingSlots, fallbackNotes, uiRegion, deps);
  if (level1) return { places: level1, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 1 };

  const level2 = await tryLevel2RelaxStrictConstraints(enhanced, workingSlots, fallbackNotes, uiRegion, deps);
  if (level2) return { places: level2, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 2 };

  if (workingSlots.category_sub) {
    const categoryMain = deps.categorySubToMain[workingSlots.category_sub];
    if (categoryMain) {
      workingSlots.category_sub = null;
      workingSlots.category_main = categoryMain;
      fallbackNotes.push(`${enhanced.slots.category_sub} → ${categoryMain} 전체로 검색했어요`);
      places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
      if (places.length > 0) {
        return { places, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 3 };
      }
    }
  }

  let locKw = workingSlots.location_keywords || [];
  while (locKw.length > 1) {
    const reduced = locKw.slice(0, -1);
    workingSlots.location_keywords = reduced;
    const removed = locKw[locKw.length - 1];
    fallbackNotes.push(`"${removed}" 범위를 넓혔어요`);
    places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
    if (places.length > 0) {
      return { places, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 4 };
    }
    locKw = reduced;
  }

  if (locKw.length > 0) {
    workingSlots.location_keywords = [];
    fallbackNotes.push('지역 조건을 제외하고 검색했어요');
    places = await executeSearchWithSlots(enhanced, workingSlots, uiRegion, deps);
    if (places.length > 0) {
      return { places, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 4 };
    }
  }

  fallbackNotes.push('조건에 맞는 장소가 없어 인기 장소를 보여드려요');
  places = await deps.fetchTopRated();
  if (places.length > 0) {
    return { places, fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 5 };
  }

  return { places: [], fallback_applied: true, fallback_notes: fallbackNotes, fallback_level: 5 };
}
