'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabase } from '@/lib/supabase/server';

async function updatePlaceCandidateStatus(id: string, status: 'approved' | 'rejected') {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('place_candidates')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function approvePlaceCandidate(id: string) {
  await updatePlaceCandidateStatus(id, 'approved');
  revalidatePath('/automation');
  revalidatePath('/automation/place-candidates');
}

export async function rejectPlaceCandidate(id: string) {
  await updatePlaceCandidateStatus(id, 'rejected');
  revalidatePath('/automation');
  revalidatePath('/automation/place-candidates');
}

export async function approveGeneratedDraft(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('generated_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/automation');
  revalidatePath('/automation/drafts');
}

export async function scheduleGeneratedDraft(id: string, scheduledTime: string) {
  if (!scheduledTime) {
    throw new Error('scheduledTime is required');
  }

  const iso = new Date(scheduledTime).toISOString();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('generated_drafts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      scheduled_time: iso,
    })
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/automation');
  revalidatePath('/automation/drafts');
}

export async function deleteGeneratedDraft(id: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('generated_drafts')
    .delete()
    .eq('id', id);

  if (error) throw error;
  revalidatePath('/automation');
  revalidatePath('/automation/drafts');
}
