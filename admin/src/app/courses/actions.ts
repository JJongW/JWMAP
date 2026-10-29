'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/** 코스 빌더에서 "가봤음"을 누른 장소: 방문 기록을 남기면 트리거가 가봤음으로 바꾸고 한줄느낌 초안을 공개한다 */
export async function confirmVisited(placeId: string): Promise<{ error: string | null }> {
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.from('visits').select('id').eq('place_id', placeId).limit(1);
  if (!existing?.length) {
    const { error } = await supabase.from('visits').insert({ place_id: placeId, source: 'operator', visited_on_precision: 'unknown' });
    if (error) return { error: error.message };
  }
  // 코스 빌더가 남긴 한줄느낌 초안을 '가본 곳' 추천으로 공개한다
  const { data: drafts } = await supabase
    .from('recommendations')
    .select('id')
    .eq('place_id', placeId)
    .eq('status', 'draft')
    .eq('source', 'operator')
    .order('created_at', { ascending: false })
    .limit(1);
  if (drafts?.[0]) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('recommendations')
      .update({ status: 'published', basis: 'visited', published_at: now, updated_at: now })
      .eq('id', drafts[0].id);
    if (error) return { error: error.message };
  }
  revalidatePath('/courses');
  return { error: null };
}
