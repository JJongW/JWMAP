import type { SupabaseClient } from '@supabase/supabase-js';

export type IntakeStatus = 'pending' | 'visited' | 'recommend_unvisited' | 'later' | 'excluded';
export type IntakeDecision = Exclude<IntakeStatus, 'pending'>;

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  pending: '검토 전',
  visited: '가봤음',
  recommend_unvisited: '안 가봤지만 추천',
  later: '나중에 갈 곳',
  excluded: '제외',
};

export const INTAKE_SOURCE_LABEL: Record<string, string> = {
  odiga_vault: '내 사진 폴더',
  kakao_saved: '카카오 저장',
  naver_saved: '네이버 저장',
  instagram: '인스타그램',
  manual: '직접 추가',
};

export const PHOTO_SOURCE_LABEL: Record<string, string> = {
  own: '직접 찍음',
  official: '가게 공식',
  web: '웹',
};

export interface IntakePhoto {
  id: string;
  source: string;
  url: string | null;
  local_path: string | null;
  taken_at: string | null;
  status: string;
  is_cover: boolean;
}

export interface IntakeReview {
  id: string;
  source: string;
  source_url: string | null;
  excerpt: string;
  rating: number | null;
}

export interface IntakeItem {
  id: string;
  source: string;
  source_key: string;
  name: string;
  province: string | null;
  region_hint: string | null;
  category_hint: string | null;
  address: string | null;
  kakao_place_id: string | null;
  matched_place_id: string | null;
  match_note: string | null;
  suggested_status: IntakeDecision | null;
  status: IntakeStatus;
  unvisited_basis: string | null;
  place_id: string | null;
  raw: { first_taken_at?: string | null; photo_count?: number; matched_visit_status?: string | null; memo?: string | null; folder?: string };
  collected_at: string;
  matched_place: { id: string; name: string; region: string | null; visit_status: string } | null;
  photos: IntakePhoto[];
  reviews: IntakeReview[];
}

const INTAKE_COLUMNS = `id, source, source_key, name, province, region_hint, category_hint, address, kakao_place_id,
  matched_place_id, match_note, suggested_status, status, unvisited_basis, place_id, raw, collected_at,
  matched_place:places!place_intake_matched_place_id_fkey(id, name, region, visit_status),
  photos:place_photos(id, source, url, local_path, taken_at, status, is_cover),
  reviews:external_reviews(id, source, source_url, excerpt, rating)`;

/** 검토함: 먼저 들어온 순서대로. 테이블이 없으면(021 전) 빈 목록 */
export async function getIntakeQueue(
  supabase: SupabaseClient,
  filters: { status?: IntakeStatus; source?: string; folder?: string; page?: number; per_page?: number },
): Promise<{ data: IntakeItem[]; count: number }> {
  const perPage = filters.per_page ?? 20;
  const from = ((filters.page ?? 1) - 1) * perPage;
  let query = supabase
    .from('place_intake')
    .select(INTAKE_COLUMNS, { count: 'exact' })
    .eq('status', filters.status ?? 'pending');
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.folder) query = query.filter('raw->folders', 'cs', JSON.stringify([filters.folder]));
  const { data, error, count } = await query
    .order('collected_at', { ascending: true })
    .order('source_key', { ascending: true })
    .range(from, from + perPage - 1);

  if (error) {
    console.warn('[getIntakeQueue] 쿼리 오류:', error);
    return { data: [], count: 0 };
  }
  return { data: (data ?? []) as unknown as IntakeItem[], count: count ?? 0 };
}

export async function getIntakeCounts(supabase: SupabaseClient): Promise<Record<IntakeStatus, number>> {
  const statuses = Object.keys(INTAKE_STATUS_LABEL) as IntakeStatus[];
  const entries = await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from('place_intake')
        .select('id', { count: 'exact', head: true })
        .eq('status', status);
      return [status, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<IntakeStatus, number>;
}

/** 검토 전 장소의 출처·카카오 폴더별 개수 (필터 칩용) */
export async function getIntakeGroups(
  supabase: SupabaseClient,
  status: IntakeStatus,
): Promise<{ sources: Record<string, number>; folders: Record<string, number> }> {
  const sources: Record<string, number> = {};
  const folders: Record<string, number> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('place_intake')
      .select('source, folders:raw->folders')
      .eq('status', status)
      .range(from, from + 999);
    if (error || !data) break;
    for (const row of data as { source: string; folders: string[] | null }[]) {
      sources[row.source] = (sources[row.source] ?? 0) + 1;
      for (const folder of row.folders ?? []) folders[folder] = (folders[folder] ?? 0) + 1;
    }
    if (data.length < 1000) break;
  }
  return { sources, folders };
}
