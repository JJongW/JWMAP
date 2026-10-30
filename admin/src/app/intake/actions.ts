'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { IntakeDecision } from '@/lib/queries/intake';

/** 안 가봤지만 추천의 근거 문구 → recommendations.basis */
function recommendationBasis(status: IntakeDecision, basis: string | null | undefined) {
  if (status === 'visited') return 'visited';
  if (basis?.includes('지인')) return 'friend';
  if (basis?.includes('가보고 싶')) return 'wishlist';
  return 'research';
}

/**
 * 검토 결정: 장소 연결·생성, 방문 기록, 사진 연결은 DB 함수(admin_decide_intake)가 한 번에 한다.
 * 가봤음·안 가봤지만 추천이면 이어서
 *   - 추천 문장을 '초안'으로 저장한다 (공개는 장소 화면에서 운영자가 확인한 뒤)
 *   - 올라가 있는 사진을 사이트에 쓸 사진으로 고르고, 대표 사진이 없으면 첫 장을 대표로
 * 이 두 단계가 실패해도 결정은 그대로 두고 warning으로 알린다.
 */
export async function decideIntake(input: {
  intakeId: string;
  status: IntakeDecision;
  placeId?: string | null;
  mode?: 'locations' | 'attractions';
  basis?: string | null;
  recommendation?: { body: string; fitsFor?: string | null; edited: boolean } | null;
  applyPhotos?: boolean;
}): Promise<{ placeId: string | null; error: string | null; warning: string | null }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_decide_intake', {
    p_intake_id: input.intakeId,
    p_status: input.status,
    p_place_id: input.placeId ?? null,
    p_legacy_table: input.mode ?? 'locations',
    p_basis: input.basis?.trim() || null,
  });
  if (error) return { placeId: null, error: error.message, warning: null };
  const placeId = (data as string | null) ?? null;
  const warnings: string[] = [];

  const body = input.recommendation?.body.trim();
  if (placeId && body && (input.status === 'visited' || input.status === 'recommend_unvisited')) {
    const { data: same } = await supabase.from('recommendations').select('id').eq('place_id', placeId).eq('body', body).limit(1);
    if (!same?.length) {
      const { error: recError } = await supabase.from('recommendations').insert({
        place_id: placeId,
        body,
        fits_for: input.recommendation?.fitsFor?.trim() || null,
        status: 'draft',
        source: input.recommendation?.edited ? 'operator' : 'ai_draft',
        basis: recommendationBasis(input.status, input.basis),
      });
      if (recError) warnings.push(`추천 문장 저장 실패: ${recError.message}`);
    }
  }

  if (placeId && input.applyPhotos && (input.status === 'visited' || input.status === 'recommend_unvisited')) {
    const { data: photos, error: photoError } = await supabase
      .from('place_photos')
      .update({ status: 'selected' })
      .eq('intake_id', input.intakeId)
      .eq('status', 'suggested')
      .not('url', 'is', null)
      .select('id, sort_order, created_at');
    if (photoError) warnings.push(`사진 저장 실패: ${photoError.message}`);
    else if (photos?.length) {
      const { count } = await supabase
        .from('place_photos')
        .select('id', { count: 'exact', head: true })
        .eq('place_id', placeId)
        .eq('is_cover', true);
      if (!count) {
        const first = [...photos].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))[0];
        const { error: coverError } = await supabase.from('place_photos').update({ is_cover: true }).eq('id', first.id);
        if (coverError) warnings.push(`대표 사진 저장 실패: ${coverError.message}`);
      }
    }
  }

  revalidatePath('/intake');
  return { placeId, error: null, warning: warnings.length ? warnings.join(' · ') : null };
}

/** 사진 고르기: 대표 사진은 장소당 하나 (선택하면 기존 대표는 해제) */
export async function setPhotoStatus(input: {
  photoId: string;
  status: 'selected' | 'rejected' | 'suggested';
  cover?: boolean;
  placeId?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createServerSupabase();
  if (input.cover && input.placeId) {
    const { error } = await supabase
      .from('place_photos')
      .update({ is_cover: false })
      .eq('place_id', input.placeId)
      .eq('is_cover', true);
    if (error) return { error: error.message };
  }
  const { error } = await supabase
    .from('place_photos')
    .update({ status: input.status, ...(input.cover !== undefined ? { is_cover: input.cover } : {}) })
    .eq('id', input.photoId);
  if (error) return { error: error.message };
  revalidatePath('/intake');
  return { error: null };
}

/** 같은 이름이 여러 곳일 때 연결할 장소 찾기 */
export async function searchPlaces(
  query: string,
): Promise<{ id: string; name: string; region: string | null; address: string | null; visit_status: string }[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('places')
    .select('id, name, region, address, visit_status')
    .ilike('name', `%${q}%`)
    .limit(10);
  return data ?? [];
}
