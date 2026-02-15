import { getSupabase } from './supabase.js';
import type { ParsedIntent } from '../flow/intent.js';

export interface LogSearchParams {
  rawQuery: string;
  intent: ParsedIntent;
  mode: string;
  parseErrors: string[];
  selectedCourse?: object;
  selectedPlaceId?: string;
  selectedPlaceName?: string;
  regenerateCount?: number;
}

export async function logSearch(params: LogSearchParams): Promise<void> {
  const entry = {
    raw_query: params.rawQuery,
    region: params.intent.region,
    vibe: params.intent.vibe,
    people_count: params.intent.people_count,
    mode: params.mode,
    season: params.intent.season,
    activity_type: params.intent.activity_type,
    response_type: params.intent.response_type,
    selected_course: params.selectedCourse || null,
    selected_place_id: params.selectedPlaceId || null,
    selected_place_name: params.selectedPlaceName || null,
    regenerate_count: params.regenerateCount || 0,
    parse_error_fields: params.parseErrors,
    created_at: new Date().toISOString(),
  };

  const { error } = await getSupabase().from('odiga_search_logs').insert(entry);

  if (error) {
    console.error('Failed to log search:', error.message);
  }
}

export interface StatsResult {
  totalSearches: number;
  topRegions: { region: string; count: number }[];
  modeDistribution: { mode: string; count: number }[];
  responseTypeDistribution: { type: string; count: number }[];
  topActivityTypes: { activity: string; count: number }[];
  topVibes: { vibe: string; count: number }[];
  topSelectedPlaces: { name: string; count: number }[];
  seasonDistribution: { season: string; count: number }[];
  hourDistribution: { hour: number; count: number }[];
  weekdayVsWeekend: { weekday: number; weekend: number };
  parseErrorRate: number;
  avgRegenerateCount: number;
  avgWalkingDistance: number;
}

export async function getStats(): Promise<StatsResult> {
  const { data: logs, error } = await getSupabase()
    .from('odiga_search_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Stats query failed: ${error.message}`);
  }

  const entries = logs || [];
  const totalSearches = entries.length;

  if (totalSearches === 0) {
    return {
      totalSearches: 0,
      topRegions: [],
      modeDistribution: [],
      responseTypeDistribution: [],
      topActivityTypes: [],
      topVibes: [],
      topSelectedPlaces: [],
      seasonDistribution: [],
      hourDistribution: [],
      weekdayVsWeekend: { weekday: 0, weekend: 0 },
      parseErrorRate: 0,
      avgRegenerateCount: 0,
      avgWalkingDistance: 0,
    };
  }

  const regionCounts = new Map<string, number>();
  const modeCounts = new Map<string, number>();
  const responseTypeCounts = new Map<string, number>();
  const activityCounts = new Map<string, number>();
  const vibeCounts = new Map<string, number>();
  const placeCounts = new Map<string, number>();
  const seasonCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  let weekdayCount = 0;
  let weekendCount = 0;
  let parseErrorCount = 0;
  let totalRegenerate = 0;
  let totalDistance = 0;
  let distanceCount = 0;

  for (const entry of entries) {
    // Region
    const region = (entry.region as string) || '미지정';
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);

    // Mode
    const mode = (entry.mode as string) || '미지정';
    modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);

    // Response type
    const responseType = (entry.response_type as string) || 'single';
    responseTypeCounts.set(responseType, (responseTypeCounts.get(responseType) || 0) + 1);

    // Activity type
    const activity = entry.activity_type as string;
    if (activity) {
      activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
    }

    // Vibes
    const vibes = entry.vibe as string[];
    if (vibes) {
      for (const v of vibes) {
        vibeCounts.set(v, (vibeCounts.get(v) || 0) + 1);
      }
    }

    // Selected place
    const placeName = entry.selected_place_name as string;
    if (placeName) {
      placeCounts.set(placeName, (placeCounts.get(placeName) || 0) + 1);
    }

    // Season
    const season = (entry.season as string) || '미지정';
    seasonCounts.set(season, (seasonCounts.get(season) || 0) + 1);

    // Time analysis
    const createdAt = new Date(entry.created_at as string);
    const hour = createdAt.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    const dayOfWeek = createdAt.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendCount++;
    } else {
      weekdayCount++;
    }

    // Parse errors
    const errors = entry.parse_error_fields as string[];
    if (errors && errors.length > 0) {
      parseErrorCount++;
    }

    // Regenerate count
    const regen = entry.regenerate_count as number;
    if (typeof regen === 'number') {
      totalRegenerate += regen;
    }

    // Walking distance
    const course = entry.selected_course as { totalDistance?: number } | null;
    if (course?.totalDistance) {
      totalDistance += course.totalDistance;
      distanceCount++;
    }
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()].map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count);

  return {
    totalSearches,
    topRegions: toSorted(regionCounts).slice(0, 5).map(({ key, count }) => ({ region: key, count })),
    modeDistribution: toSorted(modeCounts).map(({ key, count }) => ({ mode: key, count })),
    responseTypeDistribution: toSorted(responseTypeCounts).map(({ key, count }) => ({ type: key, count })),
    topActivityTypes: toSorted(activityCounts).slice(0, 5).map(({ key, count }) => ({ activity: key, count })),
    topVibes: toSorted(vibeCounts).slice(0, 10).map(({ key, count }) => ({ vibe: key, count })),
    topSelectedPlaces: toSorted(placeCounts).slice(0, 5).map(({ key, count }) => ({ name: key, count })),
    seasonDistribution: toSorted(seasonCounts).map(({ key, count }) => ({ season: key, count })),
    hourDistribution: [...hourCounts.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    weekdayVsWeekend: { weekday: weekdayCount, weekend: weekendCount },
    parseErrorRate: parseErrorCount / totalSearches,
    avgRegenerateCount: totalRegenerate / totalSearches,
    avgWalkingDistance: distanceCount > 0 ? totalDistance / distanceCount : 0,
  };
}
