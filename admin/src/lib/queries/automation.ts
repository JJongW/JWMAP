import { createServerSupabase } from '@/lib/supabase/server';

export interface AutomationTrendReport {
  id: string;
  report_date: string;
  region: string;
  places: unknown;
  top_keywords: unknown;
  tone_analysis: unknown;
  platforms: unknown;
  competitor_engagement_summary?: unknown;
  total_posts_analyzed?: number;
}

export interface PlaceCandidate {
  id: string;
  place_name: string;
  mention_count: number;
  confidence_score: number;
  region: string;
  category: string;
  status: string;
  source_date: string;
}

export interface AutomationDraft {
  id: string;
  report_date: string;
  region: string;
  time_slot: 'morning' | 'lunch' | 'evening';
  scheduled_time: string | null;
  caption: string;
  hashtags: string[];
  status: 'draft' | 'approved' | 'published' | 'rejected';
  generated_at: string;
}

export async function getAutomationTrendReports(limit: number = 20): Promise<AutomationTrendReport[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('daily_trend_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[automation] getAutomationTrendReports:', error.message);
    return [];
  }

  return (data ?? []) as AutomationTrendReport[];
}

export async function getPendingPlaceCandidates(limit: number = 100): Promise<PlaceCandidate[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('place_candidates')
    .select('*')
    .eq('status', 'pending')
    .order('confidence', { ascending: false })
    .order('mention_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[automation] getPendingPlaceCandidates:', error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    place_name: (row.name ?? '') as string,
    mention_count: (row.mention_count ?? 0) as number,
    confidence_score: (row.confidence ?? 0) as number,
    region: (row.region ?? '') as string,
    category: (row.category ?? 'other') as string,
    status: (row.status ?? 'pending') as string,
    source_date: (row.source_date ?? '') as string,
  }));
}

export async function getAutomationDrafts(limit: number = 50): Promise<AutomationDraft[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('generated_drafts')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[automation] getAutomationDrafts:', error.message);
    return [];
  }

  return (data ?? []) as AutomationDraft[];
}

export async function getAutomationStats() {
  const supabase = await createServerSupabase();
  const [
    { count: trendReportCount },
    { count: pendingCandidateCount },
    { count: draftCount },
  ] = await Promise.all([
    supabase.from('daily_trend_reports').select('*', { count: 'exact', head: true }),
    supabase.from('place_candidates').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('generated_drafts').select('*', { count: 'exact', head: true }),
  ]);

  return {
    trendReportCount: trendReportCount ?? 0,
    pendingCandidateCount: pendingCandidateCount ?? 0,
    draftCount: draftCount ?? 0,
  };
}
