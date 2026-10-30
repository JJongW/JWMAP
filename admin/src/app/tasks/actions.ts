'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/** Oomap 작업 승인·거절: 권한 확인과 기록은 DB 함수(admin_decide_task)가 한다. 실행은 Mac mini에서 task_run */
export async function decideTask(input: {
  taskId: string;
  approve: boolean;
  comment?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_decide_task', {
    p_task_id: input.taskId,
    p_approve: input.approve,
    p_comment: input.comment?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { error: null };
}
