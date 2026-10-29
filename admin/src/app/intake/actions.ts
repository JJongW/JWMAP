'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { IntakeDecision } from '@/lib/queries/intake';

/** 검토 결정: 장소 연결·생성, 방문 기록, 사진 연결은 DB 함수(admin_decide_intake)가 한 번에 한다 */
export async function decideIntake(input: {
  intakeId: string;
  status: IntakeDecision;
  placeId?: string | null;
  mode?: 'locations' | 'attractions';
  basis?: string | null;
}): Promise<{ placeId: string | null; error: string | null }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_decide_intake', {
    p_intake_id: input.intakeId,
    p_status: input.status,
    p_place_id: input.placeId ?? null,
    p_legacy_table: input.mode ?? 'locations',
    p_basis: input.basis?.trim() || null,
  });
  if (error) return { placeId: null, error: error.message };
  revalidatePath('/intake');
  return { placeId: (data as string | null) ?? null, error: null };
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
