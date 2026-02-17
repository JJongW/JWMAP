'use server';

import { updateDraftStatus, updateDraftCaption } from '@/lib/queries/content-engine';
import { revalidatePath } from 'next/cache';

export async function approveDraft(id: string) {
  await updateDraftStatus(id, 'approved');
  revalidatePath('/content-engine');
  revalidatePath('/content-engine/drafts');
}

export async function publishDraft(id: string) {
  await updateDraftStatus(id, 'published');
  revalidatePath('/content-engine');
  revalidatePath('/content-engine/drafts');
}

export async function rejectDraft(id: string, note?: string) {
  await updateDraftStatus(id, 'rejected', note);
  revalidatePath('/content-engine');
  revalidatePath('/content-engine/drafts');
}

export async function editDraftCaption(id: string, caption: string) {
  await updateDraftCaption(id, caption);
  revalidatePath('/content-engine/drafts');
}
