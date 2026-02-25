'use server';

import { revalidatePath } from 'next/cache';
import { upsertChecklist, type TaskType } from '@/lib/queries/todo';

export async function toggleTask(
  taskType: TaskType,
  date: string,
  currentlyCompleted: boolean,
): Promise<void> {
  await upsertChecklist(taskType, date, !currentlyCompleted);
  revalidatePath('/todo');
}
