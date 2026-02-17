import { createServerSupabase } from '@/lib/supabase/server';

// ── 타입 정의 ──────────────────────────────────────────────

export interface GeneratedDraft {
  id: string;
  report_date: string;
  region: string;
  time_slot: 'morning' | 'lunch' | 'evening';
  scheduled_time: string | null;
  caption: string;
  hashtags: string[];
  referenced_places: string[];
  status: 'draft' | 'approved' | 'published' | 'rejected';
  editor_note: string;
  generated_at: string;
  approved_at: string | null;
  published_at: string | null;
}

export interface DailyTrendReport {
  id: string;
  report_date: string;
  region: string;
  total_posts_analyzed: number;
  places: PlaceTrend[];
  tone_analysis: ToneAnalysis;
  top_keywords: KeywordTrend[];
  platforms: { instagram: number; threads: number };
  created_at: string;
}

export interface PlaceTrend {
  name: string;
  category: string;
  mention_count: number;
  confidence: number;
}

export interface ToneAnalysis {
  dominant_tone: string;
  tone_distribution: Record<string, number>;
  trending_expressions: string[];
  emoji_trends: string[];
}

export interface KeywordTrend {
  keyword: string;
  count: number;
  related_hashtags: string[];
}

// ── 대시보드 통계 ──────────────────────────────────────────

export async function getContentEngineStats() {
  const supabase = await createServerSupabase();

  const [
    { count: totalDrafts },
    { count: pendingDrafts },
    { count: approvedDrafts },
    { count: publishedDrafts },
    { count: totalReports },
    { count: totalSnsPosts },
  ] = await Promise.all([
    supabase.from('generated_drafts').select('*', { count: 'exact', head: true }),
    supabase.from('generated_drafts').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('generated_drafts').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('generated_drafts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('daily_trend_reports').select('*', { count: 'exact', head: true }),
    supabase.from('raw_sns_posts').select('*', { count: 'exact', head: true }),
  ]);

  // 최근 7일 리포트
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentReports } = await supabase
    .from('daily_trend_reports')
    .select('report_date, region, total_posts_analyzed, created_at')
    .gte('report_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('report_date', { ascending: false })
    .limit(7);

  // 최근 초안 5개
  const { data: recentDrafts } = await supabase
    .from('generated_drafts')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(5);

  return {
    totalDrafts: totalDrafts ?? 0,
    pendingDrafts: pendingDrafts ?? 0,
    approvedDrafts: approvedDrafts ?? 0,
    publishedDrafts: publishedDrafts ?? 0,
    totalReports: totalReports ?? 0,
    totalSnsPosts: totalSnsPosts ?? 0,
    recentReports: (recentReports ?? []) as Pick<DailyTrendReport, 'report_date' | 'region' | 'total_posts_analyzed' | 'created_at'>[],
    recentDrafts: (recentDrafts ?? []) as GeneratedDraft[],
  };
}

// ── 초안 목록 ──────────────────────────────────────────────

export async function getDrafts(filters?: {
  status?: string;
  region?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createServerSupabase();
  const limit = filters?.limit ?? 30;
  const offset = filters?.offset ?? 0;

  let query = supabase
    .from('generated_drafts')
    .select('*', { count: 'exact' })
    .order('report_date', { ascending: false })
    .order('time_slot', { ascending: true })
    .range(offset, offset + limit - 1);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.region) {
    query = query.eq('region', filters.region);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('[content-engine] getDrafts error:', error.message);
    return { drafts: [], total: 0 };
  }

  return {
    drafts: (data ?? []) as GeneratedDraft[],
    total: count ?? 0,
  };
}

// ── 초안 상태 변경 ─────────────────────────────────────────

export async function updateDraftStatus(
  id: string,
  status: 'approved' | 'published' | 'rejected',
  editorNote?: string,
) {
  const supabase = await createServerSupabase();
  const updates: Record<string, unknown> = { status };

  if (status === 'approved') updates.approved_at = new Date().toISOString();
  if (status === 'published') updates.published_at = new Date().toISOString();
  if (editorNote !== undefined) updates.editor_note = editorNote;

  const { error } = await supabase
    .from('generated_drafts')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[content-engine] updateDraftStatus error:', error.message);
    throw error;
  }
}

// ── 초안 캡션 수정 ─────────────────────────────────────────

export async function updateDraftCaption(id: string, caption: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('generated_drafts')
    .update({ caption })
    .eq('id', id);

  if (error) {
    console.error('[content-engine] updateDraftCaption error:', error.message);
    throw error;
  }
}

// ── 트렌드 리포트 목록 ────────────────────────────────────

export async function getTrendReports(filters?: {
  region?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createServerSupabase();
  const limit = filters?.limit ?? 14;
  const offset = filters?.offset ?? 0;

  let query = supabase
    .from('daily_trend_reports')
    .select('*', { count: 'exact' })
    .order('report_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.region) {
    query = query.eq('region', filters.region);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error('[content-engine] getTrendReports error:', error.message);
    return { reports: [], total: 0 };
  }

  return {
    reports: (data ?? []) as DailyTrendReport[],
    total: count ?? 0,
  };
}

// ── 단일 트렌드 리포트 ────────────────────────────────────

export async function getTrendReport(id: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('daily_trend_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as DailyTrendReport;
}
