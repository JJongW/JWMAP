import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/types';

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getCategoriesByParent(
  supabase: SupabaseClient,
  parentId?: string | null
): Promise<Category[]> {
  let query = supabase.from('categories').select('*');

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data, error } = await query.order('sort_order').order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}
