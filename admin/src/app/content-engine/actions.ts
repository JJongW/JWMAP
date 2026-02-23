'use server';

import {
  updateDraftStatus,
  updateDraftCaption,
  updateDraftSchedule,
  updatePlaceCandidateStatus,
} from '@/lib/queries/content-engine';
import { revalidatePath } from 'next/cache';

// ── Draft Actions ───────────────────────────────────────────

export async function approveDraft(id: string) {
  await updateDraftStatus(id, 'approved');
  revalidatePath('/content-engine');
}

export async function publishDraft(id: string) {
  await updateDraftStatus(id, 'published');
  revalidatePath('/content-engine');
}

export async function rejectDraft(id: string, note?: string) {
  await updateDraftStatus(id, 'rejected', note);
  revalidatePath('/content-engine');
}

export async function editDraftCaption(id: string, caption: string) {
  await updateDraftCaption(id, caption);
  revalidatePath('/content-engine');
}

export async function scheduleDraft(id: string, scheduledTime: string) {
  await updateDraftSchedule(id, scheduledTime);
  revalidatePath('/content-engine');
}

// ── Candidate Actions ───────────────────────────────────────

export async function approveCandidate(id: string) {
  await updatePlaceCandidateStatus(id, 'approved');
  revalidatePath('/content-engine');
}

export async function rejectCandidate(id: string) {
  await updatePlaceCandidateStatus(id, 'rejected');
  revalidatePath('/content-engine');
}
