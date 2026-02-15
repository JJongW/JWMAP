import type { LLMQuery, Location } from './searchTypes';

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

type GetSupabase = () => SupabaseLike;

export type SearchCandidate = Location & { province?: string };

export function mapDbRowToLocation(item: Record<string, unknown>): SearchCandidate {
  return {
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
    categoryMain: item.category_main as string | undefined,
    categorySub: item.category_sub as string | undefined,
    tags: item.tags as string[] | undefined,
  };
}

function buildSearchBaseQuery(getSupabase: GetSupabase, query: LLMQuery) {
  let dbQuery = getSupabase().from('locations_search').select('*');
  if (query.region && query.region.length > 0) {
    const regions = query.region.filter((r) => r !== '서울 전체');
    if (regions.length > 0) dbQuery = dbQuery.in('region', regions);
  }
  if (query.subRegion && query.subRegion.length > 0) dbQuery = dbQuery.in('sub_region', query.subRegion);
  if (query.category && query.category.length > 0) dbQuery = dbQuery.in('category', query.category);
  if (query.categoryMain && query.categoryMain.length > 0) dbQuery = dbQuery.in('category_main', query.categoryMain);
  if (query.categorySub && query.categorySub.length > 0) dbQuery = dbQuery.in('category_sub', query.categorySub);
  if (query.constraints?.price_level) dbQuery = dbQuery.lte('price_level', query.constraints.price_level);
  return dbQuery;
}

export async function fetchLocationsSearchRows(getSupabase: GetSupabase, query: LLMQuery): Promise<SearchCandidate[]> {
  const hasKeywords = query.keywords && query.keywords.length > 0;
  const hasLocationKeywords = query.locationKeywords && query.locationKeywords.length > 0;
  const limit = hasLocationKeywords ? 500 : (hasKeywords ? 200 : 100);

  const { data, error } = await buildSearchBaseQuery(getSupabase, query)
    .order('curation_level', { ascending: false, nullsFirst: false })
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .order('trust_score', { ascending: false, nullsFirst: false })
    .order('curator_visited', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Supabase query error:', error);
    return [];
  }

  return (data || []).map((item: Record<string, unknown>) => mapDbRowToLocation(item));
}

export async function fetchTagMatchedLocationIds(getSupabase: GetSupabase, keywords: string[]): Promise<Set<string>> {
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

  (data || []).forEach((row: { id: string }) => locationIds.add(row.id));
  return locationIds;
}

export async function fetchTopRatedLocations(getSupabase: GetSupabase): Promise<Location[]> {
  const { data } = await getSupabase()
    .from('locations')
    .select('*')
    .order('rating', { ascending: false })
    .limit(20);
  return (data || []).map((item: Record<string, unknown>) => mapDbRowToLocation(item));
}
