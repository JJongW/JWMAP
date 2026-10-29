'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/** 폐업 확인한 장소 숨기기: 사이트 검색 뷰에서 빠지고 행·기록은 남는다 */
export async function hidePlaces(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('places')
    .update({ visit_status: 'hidden', business_status: 'closed', updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) return { error: error.message };
  revalidatePath('/locations/incomplete');
  return { error: null };
}

/** 아직 영업 중이라고 확인: 폐업 의심에서 뺀다 */
export async function markOpen(ids: string[]): Promise<{ error: string | null }> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('places')
    .update({ business_status: 'open', business_checked_at: new Date().toISOString() })
    .in('id', ids);
  if (error) return { error: error.message };
  revalidatePath('/locations/incomplete');
  return { error: null };
}
