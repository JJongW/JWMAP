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
  week_start: string; // YYYY-MM-DD
  completed: boolean;
  completed_at: string | null;
}

/** 주어진 날짜가 속한 주의 월요일을 YYYY-MM-DD로 반환 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // 월요일로 이동
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** 최근 N주의 week_start 배열을 최신순으로 반환 */
export function getPastWeeks(count: number): string[] {
  const weeks: string[] = [];
  const today = new Date();
  const currentMonday = getWeekStart(today);

  for (let i = 0; i < count; i++) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

/** 특정 week_start 목록에 대한 체크리스트 레코드 조회 */
export async function getChecklistRecords(weekStarts: string[]): Promise<ChecklistRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('weekly_checklist')
    .select('id, task_type, week_start, completed, completed_at')
    .in('week_start', weekStarts)
    .order('week_start', { ascending: false });

  if (error) {
    console.error('[Todo] Failed to fetch checklist records:', error.message);
    return [];
  }
  return (data ?? []) as ChecklistRow[];
}

/** 완료 상태 upsert (task_type + week_start 기준) */
export async function upsertChecklist(
  taskType: TaskType,
  weekStart: string,
  completed: boolean,
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('weekly_checklist').upsert(
    {
      task_type: taskType,
      week_start: weekStart,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: 'task_type,week_start' },
  );

  if (error) {
    console.error('[Todo] Failed to upsert checklist:', error.message);
    throw error;
  }
}
