'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteReview(id: string): Promise<{ error: string | null }> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/reviews');
  return { error: null };
}
