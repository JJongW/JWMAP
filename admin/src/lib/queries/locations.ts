import type { SupabaseClient } from '@supabase/supabase-js';
import type { Location, LocationFilters } from '@/types';

export type LocationDomainTable = 'locations' | 'attractions';

// Use select('*') to avoid column name mismatches between environments
const LOCATION_COLUMNS = '*';

function mapRow(row: Record<string, unknown>): Location {
  let tags = row.tags ?? [];
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags as string); } catch { tags = []; }
  }
  if (!Array.isArray(tags)) tags = [];

  let eventTags = row.event_tags ?? [];
  if (typeof eventTags === 'string') {
    try { eventTags = JSON.parse(eventTags as string); } catch { eventTags = []; }
  }
  if (!Array.isArray(eventTags)) eventTags = [];

  return {
    id: row.id as string,
    name: row.name as string,
    region: (row.region ?? '') as string,
    sub_region: (row.sub_region ?? null) as string | null,
    category_main: (row.category_main ?? null) as string | null,
    category_sub: (row.category_sub ?? null) as string | null,
    lon: row.lon as number,
    lat: row.lat as number,
    address: (row.address ?? '') as string,
    memo: (row.memo ?? '') as string,
    short_desc: (row.short_desc ?? null) as string | null,
    rating: (row.rating ?? 0) as number,
    curation_level: (row.curation_level ?? null) as number | null,
    price_level: (row.price_level ?? null) as number | null,
    features: (row.features ?? {}) as Location['features'],
    tags: tags as string[],
    imageUrl: (row.imageUrl ?? row.image_url ?? '') as string,
    event_tags: eventTags as string[],
    naver_place_id: (row.naver_place_id ?? null) as string | null,
    kakao_place_id: (row.kakao_place_id ?? null) as string | null,
    visit_date: (row.visit_date ?? null) as string | null,
    curator_visited: (row.curator_visited ?? null) as boolean | null,
    created_at: (row.created_at ?? '') as string,
    region_id: (row.region_id ?? null) as string | null,
    category_id: (row.category_id ?? null) as string | null,
  };
}

export async function getLocations(
  supabase: SupabaseClient,
  filters: LocationFilters,
  table: LocationDomainTable = 'locations'
): Promise<{ data: Location[]; count: number }> {
  let query = supabase
    .from(table)
    .select(LOCATION_COLUMNS, { count: 'exact' });

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters.region) {
    query = query.eq('region', filters.region);
  }
  if (filters.category_main) {
    query = query.eq('category_main', filters.category_main);
  }
  if (filters.category_sub) {
    query = query.eq('category_sub', filters.category_sub);
  }
  if (filters.price_level) {
    query = query.eq('price_level', filters.price_level);
  }
  // has_image / has_tags filters omitted for now — column names vary per environment

  const from = (filters.page - 1) * filters.per_page;
  const to = from + filters.per_page - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return {
    data: ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRow),
    count: count ?? 0,
  };
}

export async function getLocationById(
  supabase: SupabaseClient,
  id: string,
  table: LocationDomainTable = 'locations'
): Promise<Location | null> {
  const { data, error } = await supabase
    .from(table)
    .select(LOCATION_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return mapRow(data as unknown as Record<string, unknown>);
}

export async function updateLocation(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<Location>,
  table: LocationDomainTable = 'locations'
): Promise<Location> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, location_tags: _lt, ...data } = payload;
  const { data: result, error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .select(LOCATION_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(result as unknown as Record<string, unknown>);
}

export async function createLocation(
  supabase: SupabaseClient,
  payload: Omit<Location, 'id' | 'created_at'>,
  table: LocationDomainTable = 'locations'
): Promise<Location> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { location_tags: _lt, ...data } = payload;
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select(LOCATION_COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(result as unknown as Record<string, unknown>);
}

export async function deleteLocation(
  supabase: SupabaseClient,
  id: string,
  table: LocationDomainTable = 'locations'
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
