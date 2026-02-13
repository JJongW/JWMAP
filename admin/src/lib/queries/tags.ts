import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tag, TagType, LocationTag } from '@/types';

export async function getTags(supabase: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('type')
    .order('sort_order')
    .order('name');

  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function getTagsByType(
  supabase: SupabaseClient,
  type: TagType
): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('type', type)
    .order('sort_order')
    .order('name');

  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function getLocationTags(
  supabase: SupabaseClient,
  locationId: string
): Promise<LocationTag[]> {
  const { data, error } = await supabase
    .from('location_tags')
    .select('*, tag:tags(*)')
    .eq('location_id', locationId);

  if (error) throw error;
  return (data ?? []) as LocationTag[];
}

export async function setLocationTags(
  supabase: SupabaseClient,
  locationId: string,
  tagIds: string[]
): Promise<void> {
  // Delete existing
  const { error: delError } = await supabase
    .from('location_tags')
    .delete()
    .eq('location_id', locationId);
  if (delError) throw delError;

  // Insert new
  if (tagIds.length > 0) {
    const rows = tagIds.map((tag_id) => ({ location_id: locationId, tag_id }));
    const { error: insError } = await supabase
      .from('location_tags')
      .insert(rows);
    if (insError) throw insError;
  }
}
