'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type Result = { error: string | null };

async function run(placeId: string, op: (supabase: Awaited<ReturnType<typeof createServerSupabase>>) => PromiseLike<{ error: { message: string } | null }>): Promise<Result> {
  const supabase = await createServerSupabase();
  const { error } = await op(supabase);
  if (error) return { error: error.message };
  revalidatePath(`/places/${placeId}`);
  revalidatePath('/locations');
  revalidatePath('/attractions');
  return { error: null };
}

/** 장소 기본 정보 (트리거가 사이트용 예전 테이블에도 반영한다) */
export async function updatePlace(
  placeId: string,
  patch: Partial<{
    name: string;
    address: string | null;
    region: string | null;
    sub_region: string | null;
    category_main: string | null;
    category_sub: string | null;
    curation_level: number | null;
    price_level: number | null;
    visit_status: 'visited' | 'candidate' | 'hidden';
    kakao_place_id: string | null;
    naver_place_id: string | null;
  }>,
): Promise<Result> {
  return run(placeId, (s) => s.from('places').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', placeId));
}

export async function addVisit(
  placeId: string,
  visit: { visited_on: string | null; time_slot?: string | null; companions?: string | null; experience_note?: string | null },
): Promise<Result> {
  return run(placeId, (s) =>
    s.from('visits').insert({
      place_id: placeId,
      visited_on: visit.visited_on || null,
      visited_on_precision: visit.visited_on ? 'day' : 'unknown',
      time_slot: visit.time_slot || null,
      companions: visit.companions || null,
      experience_note: visit.experience_note || null,
      source: 'operator',
    }),
  );
}

export async function deleteVisit(placeId: string, visitId: string): Promise<Result> {
  return run(placeId, (s) => s.from('visits').delete().eq('id', visitId).eq('place_id', placeId));
}

/** 추천 문장 저장. 공개하면 사이트의 "추천하는 이유"가 된다 */
export async function saveRecommendation(
  placeId: string,
  rec: { id?: string; body: string; fits_for?: string | null; caveats?: string | null; basis: string; publish: boolean },
): Promise<Result> {
  const now = new Date().toISOString();
  const row = {
    place_id: placeId,
    body: rec.body.trim(),
    fits_for: rec.fits_for?.trim() || null,
    caveats: rec.caveats?.trim() || null,
    basis: rec.basis,
    status: rec.publish ? 'published' : 'draft',
    updated_at: now,
    ...(rec.publish ? { published_at: now } : {}),
  };
  if (!row.body) return { error: '추천 문장을 적어주세요' };
  return run(placeId, (s) =>
    rec.id
      ? s.from('recommendations').update(row).eq('id', rec.id)
      : s.from('recommendations').insert({ ...row, source: 'operator' }),
  );
}

export async function setRecommendationStatus(placeId: string, id: string, status: 'published' | 'hidden' | 'draft'): Promise<Result> {
  const now = new Date().toISOString();
  return run(placeId, (s) =>
    s
      .from('recommendations')
      .update({ status, updated_at: now, ...(status === 'published' ? { published_at: now } : {}) })
      .eq('id', id),
  );
}

/** 분류: 제안된 것을 확인/거절하거나 운영자가 직접 붙인다 */
export async function setPlaceTerm(placeId: string, termId: string, status: 'confirmed' | 'rejected'): Promise<Result> {
  return run(placeId, (s) =>
    s.from('place_terms').upsert(
      { place_id: placeId, term_id: termId, status, source: 'operator', reviewed_at: new Date().toISOString() },
      { onConflict: 'place_id,term_id', ignoreDuplicates: false },
    ),
  );
}

export async function setFactStatus(placeId: string, factId: string, status: 'verified' | 'outdated'): Promise<Result> {
  return run(placeId, (s) =>
    s.from('place_facts').update({ status, checked_at: new Date().toISOString() }).eq('id', factId),
  );
}

export async function setPhoto(
  placeId: string,
  photoId: string,
  patch: { status?: 'selected' | 'rejected' | 'suggested'; is_cover?: boolean },
): Promise<Result> {
  const supabase = await createServerSupabase();
  if (patch.is_cover) {
    const { error } = await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', placeId).eq('is_cover', true);
    if (error) return { error: error.message };
  }
  return run(placeId, (s) =>
    s.from('place_photos').update({ ...patch, ...(patch.is_cover ? { status: 'selected' } : {}) }).eq('id', photoId),
  );
}

/** 사진 추가 (직접 올리거나 가게 공식 이미지 주소). 출처를 함께 남긴다 */
export async function addPhoto(
  placeId: string,
  photo: { url: string; source: 'own' | 'official' | 'web'; source_url?: string | null; cover: boolean },
): Promise<Result> {
  const supabase = await createServerSupabase();
  if (photo.cover) {
    const { error } = await supabase.from('place_photos').update({ is_cover: false }).eq('place_id', placeId).eq('is_cover', true);
    if (error) return { error: error.message };
  }
  return run(placeId, (s) =>
    s.from('place_photos').insert({
      place_id: placeId,
      url: photo.url,
      source: photo.source,
      source_url: photo.source_url?.trim() || null,
      status: 'selected',
      is_cover: photo.cover,
    }),
  );
}
