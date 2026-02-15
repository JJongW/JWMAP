import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tag, TagType, LocationTag } from '@/types';
import type { LocationDomainTable } from './locations';

function getTagJoinTable(domain: LocationDomainTable): 'location_tags' | 'attraction_tags' {
  return domain === 'attractions' ? 'attraction_tags' : 'location_tags';
}

export async function createTag(
  supabase: SupabaseClient,
  name: string,
  type: TagType = 'feature'
): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ name: name.trim(), type })
    .select()
    .single();
  if (error) throw error;
  return data as Tag;
}

const sortByNameKo = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'ko-KR');

export async function getTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*');

  if (error) throw error;
  const tags = (data ?? []) as Tag[];
  return tags.sort(sortByNameKo);
}

export async function getTagsByType(
  supabase: SupabaseClient,
  type: TagType
): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('type', type);

  if (error) throw error;
  const tags = (data ?? []) as Tag[];
  return tags.sort(sortByNameKo);
}

export async function getLocationTags(
  supabase: SupabaseClient,
  locationId: string,
  domain: LocationDomainTable = 'locations'
): Promise<LocationTag[]> {
  const joinTable = getTagJoinTable(domain);
  const { data, error } = await supabase
    .from(joinTable)
    .select('*, tag:tags(*)')
    .eq('location_id', locationId);

  if (error) throw error;
  return (data ?? []) as LocationTag[];
}

export async function setLocationTags(
  supabase: SupabaseClient,
  locationId: string,
  tagIds: string[],
  domain: LocationDomainTable = 'locations'
): Promise<void> {
  const joinTable = getTagJoinTable(domain);
  // Delete existing
  const { error: delError } = await supabase
    .from(joinTable)
    .delete()
    .eq('location_id', locationId);
  if (delError) throw delError;

  // Insert new
  if (tagIds.length > 0) {
    const rows = tagIds.map((tag_id) => ({ location_id: locationId, tag_id }));
    const { error: insError } = await supabase
      .from(joinTable)
      .insert(rows);
    if (insError) throw insError;
  }
}

/** 여러 장소의 location_tags를 한 번에 조회 */
export async function getLocationTagsForLocations(
  supabase: SupabaseClient,
  locationIds: string[],
  domain: LocationDomainTable = 'locations'
): Promise<Map<string, LocationTag[]>> {
  if (locationIds.length === 0) return new Map();
  const joinTable = getTagJoinTable(domain);

  const { data, error } = await supabase
    .from(joinTable)
    .select('*, tag:tags(*)')
    .in('location_id', locationIds);

  if (error) throw error;

  const map = new Map<string, LocationTag[]>();
  for (const row of data ?? []) {
    const locId = (row as { location_id: string }).location_id;
    if (!map.has(locId)) map.set(locId, []);
    map.get(locId)!.push(row as unknown as LocationTag);
  }
  return map;
}

/**
 * location_tags 업데이트 + locations.tags 동기화 (프로젝트 호환)
 */
export async function updateLocationTags(
  supabase: SupabaseClient,
  locationId: string,
  tagIds: string[],
  domain: LocationDomainTable = 'locations'
): Promise<void> {
  await setLocationTags(supabase, locationId, tagIds, domain);

  // locations.tags 동기화 (프로젝트가 locations.tags 사용)
  const domainTable = domain === 'attractions' ? 'attractions' : 'locations';
  if (tagIds.length === 0) {
    await supabase.from(domainTable).update({ tags: [] }).eq('id', locationId);
  } else {
    const { data: tagRows } = await supabase
      .from('tags')
      .select('name')
      .in('id', tagIds);
    const tagNames = (tagRows ?? [])
      .map((r) => (r as { name: string }).name)
      .sort((a, b) => a.localeCompare(b, 'ko-KR'));
    await supabase.from(domainTable).update({ tags: tagNames }).eq('id', locationId);
  }
}
