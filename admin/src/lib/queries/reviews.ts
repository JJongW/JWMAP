import type { SupabaseClient } from '@supabase/supabase-js';

export interface Review {
  id: string;
  location_id: string;
  location_name?: string;
  user_display_name: string;
  one_liner: string;
  visit_type: 'first' | 'repeat' | 'regular';
  tags: string[];
  created_at: string;
}

export async function getReviews(
  supabase: SupabaseClient,
  filters: { page?: number; per_page?: number; location_id?: string }
): Promise<{ data: Review[]; count: number }> {
  const page = filters.page ?? 1;
  const perPage = filters.per_page ?? 30;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('reviews')
    .select(
      `id, location_id, user_display_name, one_liner, visit_type, tags, created_at,
       locations(name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.location_id) {
    query = query.eq('location_id', filters.location_id);
  }

  const { data, error, count } = await query;

  if (error) {
    console.warn('[getReviews] 쿼리 오류:', error);
    return { data: [], count: 0 };
  }

  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    locations?: { name: string } | null;
  })[];

  return {
    data: rows.map((row) => ({
      id: row.id as string,
      location_id: row.location_id as string,
      location_name: (row.locations as { name?: string } | null)?.name ?? '',
      user_display_name: (row.user_display_name ?? '익명') as string,
      one_liner: (row.one_liner ?? '') as string,
      visit_type: (row.visit_type ?? 'first') as Review['visit_type'],
      tags: (Array.isArray(row.tags) ? row.tags : []) as string[],
      created_at: (row.created_at ?? '') as string,
    })),
    count: count ?? 0,
  };
}
