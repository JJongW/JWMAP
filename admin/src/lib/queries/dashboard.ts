import { createServerSupabase } from '@/lib/supabase/server';

export async function getDashboardData() {
  const supabase = await createServerSupabase();

  const [
    { count: total },
    { data: locations },
    { data: recentUpdates },
  ] = await Promise.all([
    supabase.from('locations').select('*', { count: 'exact', head: true }),
    supabase.from('locations').select('*'),
    supabase.from('locations').select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const allLocations = (locations ?? []) as Record<string, unknown>[];
  const noTagsCount = allLocations.filter((l) => {
    const tags = l.tags;
    return !tags || (Array.isArray(tags) && tags.length === 0);
  }).length;
  const noImageCount = allLocations.filter((l) => {
    const img = (l.imageUrl ?? l.image_url ?? '') as string;
    return !img || img === '';
  }).length;

  // Region distribution
  const regionMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const r = (l.region as string) || '미지정';
    regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
  });
  const byRegion = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category distribution
  const catMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const c = (l.category_main as string) || '미지정';
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  });
  const byCategory = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: total ?? 0,
    noTagsCount,
    noImageCount,
    byRegion,
    byCategory,
    recentUpdates: (recentUpdates ?? []) as Record<string, unknown>[],
  };
}
