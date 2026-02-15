import type { Features, Location } from '../types/location';

type Row = Record<string, unknown>;

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function mapRowToLocation(item: Row): Location {
  const categoryMain = (item.category_main || item.categoryMain) as Location['categoryMain'];
  const categorySub = (item.category_sub || item.categorySub) as Location['categorySub'];

  return {
    ...(item as unknown as Location),
    category: (categorySub || categoryMain || (item.category as string) || '') as string,
    imageUrl: (item.imageUrl ?? item.image_url ?? '') as string,
    eventTags: parseArray(item.event_tags ?? item.eventTags),
    tags: parseArray(item.tags),
    features: (item.features || {}) as Features,
    sub_region: item.sub_region as string | undefined,
    naver_place_id: item.naver_place_id as string | undefined,
    price_level: item.price_level as number | undefined,
    visit_date: item.visit_date as string | undefined,
    last_verified_at: item.last_verified_at as string | undefined,
    created_at: item.created_at as string | undefined,
    curation_level: item.curation_level as number | undefined,
    curator_visited: item.curator_visited as boolean | undefined,
    curator_visited_at: (item.visit_date as string | undefined) ?? (item.curator_visited_at as string | undefined),
    categoryMain,
    categorySub,
  };
}

function stripClientOnlyFields(payload: Row): Row {
  const {
    category: _category,
    disclosure: _disclosure,
    curator_visit_slot: _curator_visit_slot,
    ...rest
  } = payload;
  return rest;
}

export function mapLocationCreateToRow(location: Omit<Location, 'id'>): Row {
  const base = stripClientOnlyFields(location as unknown as Row);
  const row: Row = {
    ...base,
    event_tags: location.eventTags || [],
    tags: location.tags || [],
    category_main: location.categoryMain,
    category_sub: location.categorySub,
    features: location.features || {},
    curation_level: location.curation_level ?? undefined,
  };

  const imageUrl = trimOrUndefined(location.imageUrl);
  if (imageUrl) row.imageUrl = imageUrl;

  if (location.curator_visited_at) {
    row.visit_date = location.curator_visited_at;
  }
  if (location.curator_visited !== undefined) {
    row.curator_visited = location.curator_visited;
  }

  delete row.eventTags;
  delete row.categoryMain;
  delete row.categorySub;
  delete row.image_url;
  delete row.curator_visited_at;

  return row;
}

export function mapLocationUpdateToRow(location: Partial<Location>): Row {
  const base = stripClientOnlyFields(location as unknown as Row);
  const row: Row = { ...base };

  if (location.eventTags !== undefined) row.event_tags = location.eventTags;
  if (location.tags !== undefined) row.tags = location.tags;
  if (location.categoryMain !== undefined) row.category_main = location.categoryMain;
  if (location.categorySub !== undefined) row.category_sub = location.categorySub;
  if (location.curation_level !== undefined) row.curation_level = location.curation_level;
  if (location.curator_visited !== undefined) row.curator_visited = location.curator_visited;
  if (location.curator_visited_at !== undefined) row.visit_date = location.curator_visited_at;

  const imageUrl = trimOrUndefined(location.imageUrl);
  if (location.imageUrl !== undefined && imageUrl) row.imageUrl = imageUrl;

  delete row.eventTags;
  delete row.categoryMain;
  delete row.categorySub;
  delete row.curator_visited_at;
  delete row.image_url;

  return row;
}
