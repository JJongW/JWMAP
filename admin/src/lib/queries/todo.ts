import { createServerSupabase } from '@/lib/supabase/server';

export type TaskType = 'threads' | 'movie_review' | 'odiga_tistory';

export const TASK_LABELS: Record<TaskType, string> = {
  threads: 'Threads 업로드',
  movie_review: '영화리뷰 업로드',
  odiga_tistory: '오늘오디가 티스토리',
};

export const TASKS: TaskType[] = ['threads', 'movie_review', 'odiga_tistory'];

export interface ChecklistRow {
  id: string;
  task_type: TaskType;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completed_at: string | null;
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function getToday(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 최근 N일의 날짜 배열을 최신순으로 반환 */
export function getPastDays(count: number): string[] {
  const today = getToday();
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** 특정 날짜 목록에 대한 체크리스트 레코드 조회 */
export async function getChecklistRecords(dates: string[]): Promise<ChecklistRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('daily_checklist')
    .select('id, task_type, date, completed, completed_at')
    .in('date', dates)
    .order('date', { ascending: false });

  if (error) {
    console.error('[Todo] Failed to fetch checklist records:', error.message);
    return [];
  }
  return (data ?? []) as ChecklistRow[];
}

/** 완료 상태 upsert (task_type + date 기준) */
export async function upsertChecklist(
  taskType: TaskType,
  date: string,
  completed: boolean,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('daily_checklist').upsert(
    {
      task_type: taskType,
      date,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: 'task_type,date' },
  );

  if (error) {
    console.error('[Todo] Failed to upsert checklist:', error.message);
    throw error;
  }
}
