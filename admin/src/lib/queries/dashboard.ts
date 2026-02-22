import { createServerSupabase } from '@/lib/supabase/server';

interface RegionStat {
  region: string;
  count: number;
}

interface CategoryStat {
  category: string;
  count: number;
}

interface ActivityPoint {
  date: string;
  label: string;
  webSearches: number;
  clicks: number;
  odigaSearches: number;
  total: number;
}

interface ActivityTypeStat {
  activity: string;
  count: number;
}

interface ResponseTypeStat {
  type: string;
  count: number;
}

function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${month}/${day}`;
}

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildLastNDays(days: number): string[] {
  const result: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    result.push(dateKey(d));
  }

  return result;
}

async function safeFetchRows<T extends Record<string, unknown>>(
  table: string,
  columns: string,
  fromIso: string,
): Promise<T[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as unknown as T[];
}

async function safeCount(table: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) return 0;
  return count ?? 0;
}

export async function getDashboardData() {
  const supabase = await createServerSupabase();

  const [
    { count: total },
    { data: locations },
    { data: recentUpdates },
    { data: attractions },
  ] = await Promise.all([
    supabase.from('locations').select('*', { count: 'exact', head: true }),
    supabase.from('locations').select('*'),
    supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('attractions').select('tags'),
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

  const allAttractions = (attractions ?? []) as Record<string, unknown>[];
  const attractionsTotal = allAttractions.length;
  const attractionsNoTagsCount = allAttractions.filter((a) => {
    const tags = a.tags;
    return !tags || (Array.isArray(tags) && tags.length === 0);
  }).length;

  const regionMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const r = (l.region as string) || '미지정';
    regionMap.set(r, (regionMap.get(r) ?? 0) + 1);
  });

  const byRegion: RegionStat[] = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const catMap = new Map<string, number>();
  allLocations.forEach((l) => {
    const c = (l.category_main as string) || '미지정';
    catMap.set(c, (catMap.get(c) ?? 0) + 1);
  });

  const byCategory: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const dayKeys = buildLastNDays(14);
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 13);
  const fromIso = fromDate.toISOString();

  const [searchLogs, clickLogs, odigaLogs, savedCourseCount] = await Promise.all([
    safeFetchRows<{ created_at?: string }>('search_logs', 'created_at', fromIso),
    safeFetchRows<{ created_at?: string }>('click_logs', 'created_at', fromIso),
    safeFetchRows<{ created_at?: string; activity_type?: string; response_type?: string }>(
      'odiga_search_logs',
      'created_at, activity_type, response_type',
      fromIso,
    ),
    safeCount('odiga_saved_courses'),
  ]);

  const pointMap = new Map<string, ActivityPoint>(
    dayKeys.map((date) => [
      date,
      {
        date,
        label: formatDayLabel(date),
        webSearches: 0,
        clicks: 0,
        odigaSearches: 0,
        total: 0,
      },
    ]),
  );

  for (const row of searchLogs) {
    if (!row.created_at) continue;
    const d = dateKey(new Date(row.created_at));
    const point = pointMap.get(d);
    if (!point) continue;
    point.webSearches += 1;
    point.total += 1;
  }

  for (const row of clickLogs) {
    if (!row.created_at) continue;
    const d = dateKey(new Date(row.created_at));
    const point = pointMap.get(d);
    if (!point) continue;
    point.clicks += 1;
    point.total += 1;
  }

  const odigaActivityMap = new Map<string, number>();
  const responseTypeMap = new Map<string, number>();

  for (const row of odigaLogs) {
    if (!row.created_at) continue;

    const d = dateKey(new Date(row.created_at));
    const point = pointMap.get(d);
    if (point) {
      point.odigaSearches += 1;
      point.total += 1;
    }

    const activity = row.activity_type || '기타';
    odigaActivityMap.set(activity, (odigaActivityMap.get(activity) ?? 0) + 1);

    const responseType = row.response_type || 'single';
    responseTypeMap.set(responseType, (responseTypeMap.get(responseType) ?? 0) + 1);
  }

  const activitySeries = dayKeys
    .map((date) => pointMap.get(date))
    .filter((point): point is ActivityPoint => Boolean(point));

  const topOdigaActivities: ActivityTypeStat[] = Array.from(odigaActivityMap.entries())
    .map(([activity, count]) => ({ activity, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const odigaResponseTypes: ResponseTypeStat[] = Array.from(responseTypeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: total ?? 0,
    noTagsCount,
    noImageCount,
    attractionsTotal,
    attractionsNoTagsCount,
    byRegion,
    byCategory,
    recentUpdates: (recentUpdates ?? []) as Record<string, unknown>[],
    activitySeries,
    activityTotals: {
      webSearches: searchLogs.length,
      clicks: clickLogs.length,
      odigaSearches: odigaLogs.length,
      savedCourses: savedCourseCount,
    },
    topOdigaActivities,
    odigaResponseTypes,
  };
}
