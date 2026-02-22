import { createServerSupabase } from '@/lib/supabase/server';
import type {
  QualityFilters,
  QualityData,
  OQSMetrics,
  FirstMatchMetrics,
  TrustMetrics,
  IntentRow,
  CourseMetrics,
  FrictionMetrics,
  DBPressureRow,
  AlertItem,
} from '@/types/odiga-quality';

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

export function buildDateRange(period: QualityFilters['period']): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const days = period === '1d' ? 1 : period === '7d' ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

function previousRange(period: QualityFilters['period']): { from: string; to: string } {
  const days = period === '1d' ? 1 : period === '7d' ? 7 : 30;
  const now = new Date();
  const to = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const from = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

function dateKey(iso: string): string {
  return iso.split('T')[0];
}

// ---------------------------------------------------------------------------
// Computation helpers
// ---------------------------------------------------------------------------

type LogRow = {
  created_at: string;
  region: string | null;
  response_type: string | null;
  activity_type: string | null;
  selected_place_id: string | null;
  selected_course: unknown;
  regenerate_count: number | null;
  parse_error_fields: string[] | null;
  user_feedbacks: string[] | null;
};

function hasSelection(row: LogRow): boolean {
  return row.selected_place_id !== null || row.selected_course !== null;
}

function hasFeedback(row: LogRow): boolean {
  return Array.isArray(row.user_feedbacks) && row.user_feedbacks.length > 0;
}

function computeOQS(
  fmq: number,
  selectionRate: number,
  frictionScore: number,
  courseCompletion: number,
): number {
  const raw = fmq * 0.35 + selectionRate * 0.30 + (100 - frictionScore) * 0.20 + courseCompletion * 0.15;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

function intentStatus(fmq: number, saveRate: number): IntentRow['status'] {
  if (fmq >= 70 && saveRate >= 30) return 'healthy';
  if (fmq >= 50 || saveRate >= 20) return 'watch';
  return 'needs_improvement';
}

function pressureStatus(score: number): DBPressureRow['status'] {
  if (score >= 4) return 'critical';
  if (score >= 2) return 'warn';
  return 'ok';
}

function generateAlerts(data: {
  fmq: number;
  selectionRate: number;
  prevSelectionRate: number;
  parseErrorRate: number;
  dbPressure: DBPressureRow[];
}): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (data.fmq < 60) {
    alerts.push({
      type: 'error',
      message: `FMQ ${data.fmq.toFixed(1)}% — 첫 추천 만족도가 낮습니다`,
      metric: 'FMQ',
      value: data.fmq,
      threshold: 60,
    });
  }

  const selectionDrop = data.prevSelectionRate - data.selectionRate;
  if (selectionDrop > 10) {
    alerts.push({
      type: 'warn',
      message: `선택률 ${selectionDrop.toFixed(1)}% 하락 (이전 기간 대비)`,
      metric: 'SelectionRate',
      value: data.selectionRate,
      threshold: data.prevSelectionRate - 10,
    });
  }

  if (data.parseErrorRate > 20) {
    alerts.push({
      type: 'warn',
      message: `파싱 오류율 ${data.parseErrorRate.toFixed(1)}% — 인텐트 파싱 품질 점검 필요`,
      metric: 'ParseErrorRate',
      value: data.parseErrorRate,
      threshold: 20,
    });
  }

  for (const row of data.dbPressure) {
    if (row.status === 'critical') {
      alerts.push({
        type: 'warn',
        message: `${row.region} 지역 DB 압력 ${row.pressureScore.toFixed(1)}x — 장소 데이터 부족`,
        metric: 'DBPressure',
        value: row.pressureScore,
        threshold: 4,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function parseFilters(params: Record<string, string | undefined>): QualityFilters {
  const period = (['1d', '7d', '30d'] as const).includes(params.period as QualityFilters['period'])
    ? (params.period as QualityFilters['period'])
    : '7d';

  const response_type = (['all', 'single', 'course'] as const).includes(
    params.response_type as QualityFilters['response_type'],
  )
    ? (params.response_type as QualityFilters['response_type'])
    : 'all';

  return {
    period,
    region: params.region ?? null,
    response_type,
    activity_type: params.activity_type ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

export async function getQualityData(filters: QualityFilters): Promise<QualityData> {
  const supabase = await createServerSupabase();
  const dateRange = buildDateRange(filters.period);
  const prevRange = previousRange(filters.period);

  // Build base query for current period
  function buildLogQuery(from: string, to: string) {
    let q = supabase
      .from('odiga_search_logs')
      .select(
        'created_at, region, response_type, activity_type, selected_place_id, selected_course, regenerate_count, parse_error_fields, user_feedbacks',
      )
      .gte('created_at', from)
      .lte('created_at', to);

    if (filters.region) q = q.eq('region', filters.region);
    if (filters.response_type !== 'all') q = q.eq('response_type', filters.response_type);
    if (filters.activity_type) q = q.eq('activity_type', filters.activity_type);

    return q;
  }

  const [
    { data: currentLogs },
    { data: prevLogs },
    { data: savedCoursesRaw },
    { data: locationRegions },
    { data: attractionRegions },
  ] = await Promise.all([
    buildLogQuery(dateRange.from, dateRange.to),
    buildLogQuery(prevRange.from, prevRange.to),
    supabase
      .from('odiga_saved_courses')
      .select('created_at, region')
      .gte('created_at', dateRange.from)
      .lte('created_at', dateRange.to),
    supabase.from('locations').select('region'),
    supabase.from('attractions').select('region'),
  ]);

  const logs: LogRow[] = (currentLogs ?? []) as LogRow[];
  const prevLogRows: LogRow[] = (prevLogs ?? []) as LogRow[];
  const total = logs.length;
  const prevTotal = prevLogRows.length;

  // ---------------------------------------------------------------------------
  // First Match Quality
  // ---------------------------------------------------------------------------
  const zeroReroll = logs.filter((r) => (r.regenerate_count ?? 0) === 0).length;
  const oneReroll = logs.filter((r) => (r.regenerate_count ?? 0) === 1).length;
  const twoPlus = logs.filter((r) => (r.regenerate_count ?? 0) >= 2).length;
  const totalRerolls = logs.reduce((s, r) => s + (r.regenerate_count ?? 0), 0);

  const zeroRerollRate = total > 0 ? (zeroReroll / total) * 100 : 0;
  const firstSelectRate = total > 0 ? (logs.filter(hasSelection).length / total) * 100 : 0;
  const avgRerollCount = total > 0 ? totalRerolls / total : 0;

  const firstMatch: FirstMatchMetrics = {
    zeroRerollRate,
    firstSelectRate,
    avgRerollCount,
    distribution: { zero: zeroReroll, one: oneReroll, twoPlus },
  };

  // ---------------------------------------------------------------------------
  // Trust & Engagement
  // ---------------------------------------------------------------------------
  const selectedCount = logs.filter(hasSelection).length;
  const engagedCount = logs.filter(hasFeedback).length;
  const courseTotal = logs.filter((r) => r.response_type === 'course').length;
  const courseSelected = logs.filter(
    (r) => r.response_type === 'course' && r.selected_course !== null,
  ).length;

  const saveRate = total > 0 ? (selectedCount / total) * 100 : 0;
  const engagementRate = total > 0 ? (engagedCount / total) * 100 : 0;
  const courseCompletionRate = courseTotal > 0 ? (courseSelected / courseTotal) * 100 : 0;

  const trust: TrustMetrics = { saveRate, engagementRate, courseCompletionRate };

  // ---------------------------------------------------------------------------
  // Friction
  // ---------------------------------------------------------------------------
  const regionMissingCount = logs.filter((r) => !r.region).length;
  const noSelectionCount = logs.filter((r) => !hasSelection(r)).length;
  const parseErrCount = logs.filter(
    (r) => Array.isArray(r.parse_error_fields) && r.parse_error_fields.length > 0,
  ).length;

  const regionMissingRate = total > 0 ? (regionMissingCount / total) * 100 : 0;
  const noSelectionRate = total > 0 ? (noSelectionCount / total) * 100 : 0;
  const parseErrorRate = total > 0 ? (parseErrCount / total) * 100 : 0;

  // Parse error field breakdown
  const fieldMap = new Map<string, number>();
  for (const row of logs) {
    for (const field of row.parse_error_fields ?? []) {
      fieldMap.set(field, (fieldMap.get(field) ?? 0) + 1);
    }
  }
  const parseErrorBreakdown = Array.from(fieldMap.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const frictionScore = (parseErrorRate + regionMissingRate) / 2;
  const friction: FrictionMetrics = {
    regionMissingRate,
    noSelectionRate,
    parseErrorRate,
    parseErrorBreakdown,
  };

  // ---------------------------------------------------------------------------
  // OQS
  // ---------------------------------------------------------------------------
  const fmq = zeroRerollRate;
  const oqsScore = computeOQS(fmq, saveRate, frictionScore, courseCompletionRate);

  // Previous period OQS for delta
  const prevSelected = prevLogRows.filter(hasSelection).length;
  const prevSaveRate = prevTotal > 0 ? (prevSelected / prevTotal) * 100 : 0;
  const prevZeroReroll = prevLogRows.filter((r) => (r.regenerate_count ?? 0) === 0).length;
  const prevFmq = prevTotal > 0 ? (prevZeroReroll / prevTotal) * 100 : 0;
  const prevRegionMissing = prevLogRows.filter((r) => !r.region).length;
  const prevParseErr = prevLogRows.filter(
    (r) => Array.isArray(r.parse_error_fields) && r.parse_error_fields.length > 0,
  ).length;
  const prevFriction =
    prevTotal > 0
      ? ((prevRegionMissing / prevTotal) * 100 + (prevParseErr / prevTotal) * 100) / 2
      : 0;
  const prevCourseTotal = prevLogRows.filter((r) => r.response_type === 'course').length;
  const prevCourseSelected = prevLogRows.filter(
    (r) => r.response_type === 'course' && r.selected_course !== null,
  ).length;
  const prevCourseCompletion = prevCourseTotal > 0 ? (prevCourseSelected / prevCourseTotal) * 100 : 0;
  const prevOqs = computeOQS(prevFmq, prevSaveRate, prevFriction, prevCourseCompletion);

  const oqs: OQSMetrics = {
    oqs: oqsScore,
    delta: oqsScore - prevOqs,
    fmq,
    trustIndex: saveRate,
    courseCompletion: courseCompletionRate,
    frictionScore,
  };

  // ---------------------------------------------------------------------------
  // Intent breakdown (by activity_type)
  // ---------------------------------------------------------------------------
  const intentMap = new Map<
    string,
    { total: number; zeroReroll: number; selected: number; rerolls: number }
  >();

  for (const row of logs) {
    const intent = row.activity_type ?? '기타';
    if (!intentMap.has(intent)) {
      intentMap.set(intent, { total: 0, zeroReroll: 0, selected: 0, rerolls: 0 });
    }
    const bucket = intentMap.get(intent)!;
    bucket.total += 1;
    if ((row.regenerate_count ?? 0) === 0) bucket.zeroReroll += 1;
    if (hasSelection(row)) bucket.selected += 1;
    bucket.rerolls += row.regenerate_count ?? 0;
  }

  const intents: IntentRow[] = Array.from(intentMap.entries())
    .map(([intent, bucket]) => {
      const intentFmq = bucket.total > 0 ? (bucket.zeroReroll / bucket.total) * 100 : 0;
      const intentSaveRate = bucket.total > 0 ? (bucket.selected / bucket.total) * 100 : 0;
      const intentRerollRate = bucket.total > 0 ? (bucket.rerolls / bucket.total) * 100 : 0;
      return {
        intent,
        requestCount: bucket.total,
        fmq: Math.round(intentFmq),
        saveRate: Math.round(intentSaveRate),
        rerollRate: Math.round(intentRerollRate),
        status: intentStatus(intentFmq, intentSaveRate),
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount);

  // ---------------------------------------------------------------------------
  // Course Quality
  // ---------------------------------------------------------------------------
  const courseLogs = logs.filter((r) => r.response_type === 'course');
  const courseSelectRate = courseTotal > 0 ? (courseSelected / courseTotal) * 100 : 0;
  const savedCoursesCount = (savedCoursesRaw ?? []).length;
  const courseSaveRate = courseTotal > 0 ? (savedCoursesCount / courseTotal) * 100 : 0;
  const courseRerolls = courseLogs.reduce((s, r) => s + (r.regenerate_count ?? 0), 0);
  const courseAvgReroll = courseTotal > 0 ? courseRerolls / courseTotal : 0;

  // Daily selection trend
  const trendMap = new Map<string, { total: number; selected: number }>();
  for (const row of courseLogs) {
    const d = dateKey(row.created_at);
    if (!trendMap.has(d)) trendMap.set(d, { total: 0, selected: 0 });
    const bucket = trendMap.get(d)!;
    bucket.total += 1;
    if (row.selected_course !== null) bucket.selected += 1;
  }
  const selectionTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      rate: bucket.total > 0 ? Math.round((bucket.selected / bucket.total) * 100) : 0,
    }));

  const course: CourseMetrics = {
    requestCount: courseTotal,
    selectionRate: courseSelectRate,
    saveRate: courseSaveRate,
    avgReroll: courseAvgReroll,
    selectionTrend,
  };

  // ---------------------------------------------------------------------------
  // DB Pressure
  // ---------------------------------------------------------------------------
  const regionRequestMap = new Map<string, number>();
  for (const row of logs) {
    const r = row.region || '미지정';
    regionRequestMap.set(r, (regionRequestMap.get(r) ?? 0) + 1);
  }

  const placeRegionMap = new Map<string, number>();
  for (const loc of locationRegions ?? []) {
    const r = (loc as { region?: string }).region || '미지정';
    placeRegionMap.set(r, (placeRegionMap.get(r) ?? 0) + 1);
  }
  for (const attr of attractionRegions ?? []) {
    const r = (attr as { region?: string }).region || '미지정';
    placeRegionMap.set(r, (placeRegionMap.get(r) ?? 0) + 1);
  }

  const dbPressure: DBPressureRow[] = Array.from(regionRequestMap.entries())
    .map(([region, requestCount]) => {
      const placeCount = placeRegionMap.get(region) ?? 0;
      const pressureScore = placeCount > 0 ? requestCount / placeCount : requestCount;
      return {
        region,
        requestCount,
        placeCount,
        pressureScore: Math.round(pressureScore * 10) / 10,
        status: pressureStatus(pressureScore),
      };
    })
    .sort((a, b) => b.pressureScore - a.pressureScore)
    .slice(0, 15);

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------
  const alerts: AlertItem[] = generateAlerts({
    fmq,
    selectionRate: saveRate,
    prevSelectionRate: prevSaveRate,
    parseErrorRate,
    dbPressure,
  });

  return {
    oqs,
    firstMatch,
    trust,
    intents,
    course,
    friction,
    dbPressure,
    alerts,
    totalSearches: total,
    dateRange,
  };
}
