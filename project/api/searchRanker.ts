import type { LLMQuery, Location } from './searchTypes.js';
import type { SearchCandidate } from './searchRepository.js';

function locationMatchesKeyword(
  loc: { subRegion?: string; region?: string; province?: string; tags?: string[] },
  keyword: string
): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return false;
  const sub = (loc.subRegion || '').toLowerCase();
  const reg = (loc.region || '').toLowerCase();
  const prov = (loc.province || '').toLowerCase();
  if (sub.includes(kw) || reg.includes(kw) || prov.includes(kw)) return true;
  return (loc.tags || []).some((t) => String(t).toLowerCase().includes(kw));
}

export function applyLocationKeywordFilter(results: SearchCandidate[], locationKeywords?: string[]): SearchCandidate[] {
  if (!locationKeywords?.length) return results;
  const keywords = locationKeywords.filter((k) => typeof k === 'string' && k.trim());
  if (keywords.length === 0) return results;
  return results.filter((loc) => keywords.some((kw) => locationMatchesKeyword(loc, kw)));
}

export function applyConstraintFilter(
  results: SearchCandidate[],
  query: LLMQuery,
  tagMatchedIds: Set<string>
): SearchCandidate[] {
  if (!query.constraints) return results;
  return results.filter((loc) => {
    if (query.constraints?.solo_ok) {
      const hasSoloTag = loc.tags?.some((tag) => ['혼밥', '혼자', '혼술'].some((keyword) => tag.toLowerCase().includes(keyword.toLowerCase())));
      const hasSoloKeyword = query.keywords?.some((kw) => ['혼밥', '혼자', '혼술'].some((keyword) => kw.toLowerCase().includes(keyword.toLowerCase()))) && tagMatchedIds.has(loc.id);
      if (!hasSoloTag && !hasSoloKeyword) return false;
    }
    if (query.constraints?.quiet) {
      const hasQuietTag = loc.tags?.some((tag) => ['조용', '한적', '차분'].some((keyword) => tag.toLowerCase().includes(keyword)));
      if (!hasQuietTag) return false;
    }
    if (query.constraints?.no_wait) {
      const hasNoWaitTag = loc.tags?.some((tag) => ['웨이팅', '바로입장', '대기없'].some((keyword) => tag.toLowerCase().includes(keyword)));
      if (!hasNoWaitTag) return false;
    }
    return true;
  });
}

function sortByTagAndRating(results: Location[], tagMatchedIds: Set<string>) {
  results.sort((a, b) => {
    const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
    const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
    if (aTagMatch !== bTagMatch) return bTagMatch - aTagMatch;
    return (b.rating || 0) - (a.rating || 0);
  });
}

export function applyKeywordFilter(
  results: SearchCandidate[],
  query: LLMQuery,
  tagMatchedIds: Set<string>,
  hasLocationFilter: boolean
): SearchCandidate[] {
  if (!query.keywords?.length) return results;

  const generic = ['맛집', '추천', '알려줘', '보여줘', '어디', '어디서', '어디가', '가고 싶어', '먹고 싶어', '가볼 곳'];
  const keywordLower = query.keywords.map((k) => k.toLowerCase());
  const hasSpecific = keywordLower.some((kw) => !generic.some((g) => kw.includes(g) || g.includes(kw)));

  if (hasSpecific) {
    const filtered = results.filter((loc) => {
      if (tagMatchedIds.has(loc.id)) return true;
      const searchText = `${loc.name} ${loc.memo || ''} ${loc.shortDesc || ''}`.toLowerCase();
      return keywordLower.some((kw) => !generic.some((g) => kw.includes(g) || g.includes(kw)) && searchText.includes(kw));
    });
    if (filtered.length > 0 || !hasLocationFilter) results = filtered;
  }
  sortByTagAndRating(results, tagMatchedIds);
  return results;
}
