import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../lib/rateLimit';
import { setCORS, handlePreflight, validateMethod, safeError } from '../lib/security';
import { getSupabase } from '../lib/places';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (handlePreflight(req, res)) return;
  if (!validateMethod(req, res, 'GET')) return;

  const allowed = await checkRateLimit(req, res, 'stats');
  if (!allowed) return;

  try {
    const { data: logs, error } = await getSupabase()
      .from('odiga_search_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[odiga/stats] Supabase error:', error.message);
      return safeError(res, 500, 'Failed to fetch stats');
    }

    const entries = logs || [];
    const totalSearches = entries.length;

    if (totalSearches === 0) {
      return res.status(200).json({
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
      });
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
      const region = (entry.region as string) || '미지정';
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);

      const mode = (entry.mode as string) || '미지정';
      modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);

      const responseType = (entry.response_type as string) || 'single';
      responseTypeCounts.set(responseType, (responseTypeCounts.get(responseType) || 0) + 1);

      const activity = entry.activity_type as string;
      if (activity) {
        activityCounts.set(activity, (activityCounts.get(activity) || 0) + 1);
      }

      const vibes = entry.vibe as string[];
      if (vibes) {
        for (const v of vibes) {
          vibeCounts.set(v, (vibeCounts.get(v) || 0) + 1);
        }
      }

      const placeName = entry.selected_place_name as string;
      if (placeName) {
        placeCounts.set(placeName, (placeCounts.get(placeName) || 0) + 1);
      }

      const season = (entry.season as string) || '미지정';
      seasonCounts.set(season, (seasonCounts.get(season) || 0) + 1);

      const createdAt = new Date(entry.created_at as string);
      const hour = createdAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

      const dayOfWeek = createdAt.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendCount++;
      } else {
        weekdayCount++;
      }

      const errors = entry.parse_error_fields as string[];
      if (errors && errors.length > 0) {
        parseErrorCount++;
      }

      const regen = entry.regenerate_count as number;
      if (typeof regen === 'number') {
        totalRegenerate += regen;
      }

      const course = entry.selected_course as { totalDistance?: number } | null;
      if (course?.totalDistance) {
        totalDistance += course.totalDistance;
        distanceCount++;
      }
    }

    const toSorted = (map: Map<string, number>) =>
      [...map.entries()].map(([k, v]) => ({ key: k, count: v })).sort((a, b) => b.count - a.count);

    const stats: StatsResult = {
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

    return res.status(200).json(stats);
  } catch (error) {
    console.error('[odiga/stats] Error:', error instanceof Error ? error.message : error);
    return safeError(res, 500, 'Internal server error');
  }
}
