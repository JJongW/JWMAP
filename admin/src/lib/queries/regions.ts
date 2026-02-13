import type { SupabaseClient } from '@supabase/supabase-js';
import type { Region } from '@/types';

export async function getRegions(supabase: SupabaseClient): Promise<Region[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) throw error;
  return (data ?? []) as Region[];
}

export async function getRegionsByParent(
  supabase: SupabaseClient,
  parentId?: string | null
): Promise<Region[]> {
  let query = supabase.from('regions').select('*');

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data, error } = await query.order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as Region[];
}
