export interface QualityFilters {
  period: '1d' | '7d' | '30d';
  region: string | null;
  response_type: 'all' | 'single' | 'course';
  activity_type: string | null;
}

export interface OQSMetrics {
  oqs: number;
  delta: number;
  fmq: number;
  trustIndex: number;
  courseCompletion: number;
  frictionScore: number;
}

export interface RerollDistribution {
  zero: number;
  one: number;
  twoPlus: number;
}

export interface FirstMatchMetrics {
  zeroRerollRate: number;
  firstSelectRate: number;
  avgRerollCount: number;
  distribution: RerollDistribution;
}

export interface TrustMetrics {
  saveRate: number;
  engagementRate: number;
  courseCompletionRate: number;
}

export interface IntentRow {
  intent: string;
  requestCount: number;
  fmq: number;
  saveRate: number;
  rerollRate: number;
  status: 'healthy' | 'watch' | 'needs_improvement';
}

export interface CourseMetrics {
  requestCount: number;
  selectionRate: number;
  saveRate: number;
  avgReroll: number;
  selectionTrend: { date: string; rate: number }[];
}

export interface FrictionMetrics {
  regionMissingRate: number;
  noSelectionRate: number;
  parseErrorRate: number;
  parseErrorBreakdown: { field: string; count: number }[];
}

export interface DBPressureRow {
  region: string;
  requestCount: number;
  placeCount: number;
  pressureScore: number;
  status: 'ok' | 'warn' | 'critical';
}

export interface AlertItem {
  type: 'error' | 'warn';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

export interface QualityData {
  oqs: OQSMetrics;
  firstMatch: FirstMatchMetrics;
  trust: TrustMetrics;
  intents: IntentRow[];
  course: CourseMetrics;
  friction: FrictionMetrics;
  dbPressure: DBPressureRow[];
  alerts: AlertItem[];
  totalSearches: number;
  dateRange: { from: string; to: string };
}
