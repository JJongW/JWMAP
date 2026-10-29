import type { SupabaseClient } from '@supabase/supabase-js';

export type ReviewKey = 'closed' | 'moved' | 'no_reason' | 'no_photo' | 'no_location' | 'untyped' | 'duplicates' | 'fact_conflicts' | 'draft_reasons';

export const REVIEW_TABS: { key: ReviewKey; label: string; desc: string }[] = [
  { key: 'closed', label: '폐업 의심', desc: '카카오에서 영업 중으로 안 나와요. 확인하고 숨기면 사이트에서 빠져요 (기록은 남아요).' },
  { key: 'moved', label: '위치 바뀜', desc: '카카오 위치와 150m 넘게 달라요. 이전했거나 좌표가 틀렸을 수 있어요.' },
  { key: 'no_reason', label: '가봤는데 추천 이유 없음', desc: '사이트에 "운영자 방문"만 나가요. 한 줄만 적어도 돼요.' },
  { key: 'draft_reasons', label: '공개 전 추천 문장', desc: '예전 한줄 설명·AI 초안. 맞으면 공개, 아니면 내려요.' },
  { key: 'no_photo', label: '가봤는데 대표 사진 없음', desc: '사진이 있으면 카드에 바로 보여요.' },
  { key: 'no_location', label: '지도 위치 없음', desc: '좌표가 없어 지도에 안 보여요.' },
  { key: 'untyped', label: '장소 종류 없음', desc: '검색 조건(장소 종류)에 안 걸려요.' },
  { key: 'duplicates', label: '중복 의심', desc: '카카오 ID나 이름·주소가 같은 장소예요.' },
  { key: 'fact_conflicts', label: '정보 충돌', desc: '같은 항목에 서로 다른 값이 있어요 (예: 주차 가능/불가).' },
];

export interface ReviewRow {
  id: string;
  name: string;
  note: string | null;
  ids?: string[];
  action?: 'hide';
}

interface PlaceRow {
  id: string;
  name: string;
  region: string | null;
  lat: number | null;
  image_url: string | null;
  visit_status: string;
  business_status: string | null;
  recommendations: { status: string; body: string; source: string }[];
}

async function allPlaces(supabase: SupabaseClient): Promise<PlaceRow[]> {
  const rows: PlaceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('places')
      .select('id, name, region, lat, image_url, visit_status, business_status, recommendations(status, body, source)')
      .neq('visit_status', 'hidden')
      .order('name')
      .range(from, from + 999);
    if (error) {
      console.warn('[review-needed] places 오류:', error);
      break;
    }
    rows.push(...((data ?? []) as PlaceRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** 탭별 개수와 고른 탭의 목록 */
export async function getReviewNeeded(
  supabase: SupabaseClient,
  key: ReviewKey,
): Promise<{ counts: Record<ReviewKey, number>; rows: ReviewRow[] }> {
  const [places, untyped, duplicates, conflicts] = await Promise.all([
    allPlaces(supabase),
    supabase.from('curation_review_untyped_places').select('id, name, category_main, category_sub'),
    supabase.from('curation_review_duplicates').select('matched_by, key, place_ids'),
    supabase.from('curation_review_fact_conflicts').select('place_id, field, values'),
  ]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const visited = places.filter((p) => p.visit_status === 'visited');

  const lists: Record<ReviewKey, ReviewRow[]> = {
    closed: places
      .filter((p) => p.business_status === 'closed_suspect' || p.business_status === 'closed')
      .map((p) => ({ id: p.id, name: p.name, note: `${p.region ?? ''} · ${p.visit_status === 'visited' ? '가봤음' : '후보'}`, action: 'hide' as const })),
    moved: places.filter((p) => p.business_status === 'moved').map((p) => ({ id: p.id, name: p.name, note: p.region })),
    no_reason: visited
      .filter((p) => !p.recommendations.some((r) => r.status === 'published'))
      .map((p) => ({ id: p.id, name: p.name, note: p.region })),
    draft_reasons: places
      .filter((p) => p.recommendations.some((r) => r.status === 'draft'))
      .map((p) => ({ id: p.id, name: p.name, note: p.recommendations.find((r) => r.status === 'draft')?.body ?? null })),
    no_photo: visited.filter((p) => !p.image_url).map((p) => ({ id: p.id, name: p.name, note: p.region })),
    no_location: places.filter((p) => p.lat == null).map((p) => ({ id: p.id, name: p.name, note: p.region })),
    untyped: (untyped.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      note: [r.category_main, r.category_sub].filter(Boolean).join(' · ') || '등록 분류 없음',
    })),
    duplicates: (duplicates.data ?? []).map((r) => ({
      id: r.place_ids[0],
      name: (r.place_ids as string[]).map((id) => byId.get(id)?.name ?? id.slice(0, 8)).join(' / '),
      note: r.matched_by === 'kakao_place_id' ? `카카오 ID ${r.key}` : `이름·주소 ${r.key}`,
      ids: r.place_ids,
    })),
    fact_conflicts: (conflicts.data ?? []).map((r) => ({
      id: r.place_id,
      name: byId.get(r.place_id)?.name ?? r.place_id,
      note: `${r.field}: ${(r.values as unknown[]).map((v) => JSON.stringify(v)).join(' vs ')}`,
    })),
  };

  const counts = Object.fromEntries(REVIEW_TABS.map((t) => [t.key, lists[t.key].length])) as Record<ReviewKey, number>;
  return { counts, rows: lists[key] };
}
