import type { LLMQuery, Location } from './searchTypes';

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => QueryLike;
  };
};

type QueryLike = {
  in: (column: string, values: string[]) => QueryLike;
  lte: (column: string, value: number) => QueryLike;
  overlaps: (column: string, values: string[]) => Promise<{ data: { id: string }[] | null; error: unknown }>;
  order: (column: string, options: { ascending: boolean; nullsFirst: boolean }) => QueryLike;
  limit: (count: number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>;
};

type GetSupabase = () => SupabaseLike;

export type SearchCandidate = Location & { province?: string };

export function mapDbRowToLocation(item: Record<string, unknown>): SearchCandidate {
  const rowTags = Array.isArray(item.tags) ? (item.tags as string[]) : [];
  const mergedTags = [...new Set(rowTags)];

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
    tags: mergedTags,
    contentType: (item.content_type as 'food' | 'space' | undefined) || 'food',
  };
}

function buildSearchBaseQuery(getSupabase: GetSupabase, table: string, query: LLMQuery) {
  let dbQuery = getSupabase().from(table).select('*');
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

  const fetchFromTable = async (table: string): Promise<SearchCandidate[]> => {
    const { data, error } = await buildSearchBaseQuery(getSupabase, table, query)
      .order('curation_level', { ascending: false, nullsFirst: false })
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('trust_score', { ascending: false, nullsFirst: false })
      .order('curator_visited', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) {
      console.error(`[search] Supabase query error (${table}):`, error);
      return [];
    }
    return (data || []).map((item: Record<string, unknown>) =>
      mapDbRowToLocation({ ...item, content_type: table === 'attractions_search' ? 'space' : 'food' })
    );
  };

  const [foodRows, spaceRows] = await Promise.all([
    fetchFromTable('locations_search'),
    fetchFromTable('attractions_search'),
  ]);

  const dedup = new Map<string, SearchCandidate>();
  for (const item of [...foodRows, ...spaceRows]) {
    if (!dedup.has(item.id)) dedup.set(item.id, item);
  }
  return [...dedup.values()];
}

export async function fetchTagMatchedLocationIds(getSupabase: GetSupabase, keywords: string[]): Promise<Set<string>> {
  const locationIds = new Set<string>();
  const trimmed = keywords?.filter((k) => typeof k === 'string' && k.trim()) ?? [];
  if (trimmed.length === 0) return locationIds;

  const read = async (table: 'locations' | 'attractions') => {
    const { data, error } = await getSupabase()
      .from(table)
      .select('id')
      .overlaps('tags', trimmed);
    if (error) {
      console.error(`[search] getLocationIdsByTags overlap error (${table}):`, error);
      return;
    }
    (data || []).forEach((row: { id: string }) => locationIds.add(row.id));
  };

  await Promise.all([read('locations'), read('attractions')]);
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
