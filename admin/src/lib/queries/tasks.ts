import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Oomap MCP가 만든 작업(agent_tasks, command = 'oomap:*').
 * 읽기는 028의 admin 읽기 정책, 승인·거절은 admin_decide_task로만 한다.
 */
export type TaskStatus = 'proposed' | 'debating' | 'approved' | 'executing' | 'done' | 'failed';

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  proposed: '승인 대기',
  debating: '검토 중',
  approved: '승인됨 · 실행 전',
  executing: '실행 중',
  done: '완료',
  failed: '거절·실패',
};

export const TASK_COMMAND_LABEL: Record<string, string> = {
  'oomap:intake_decide': '검토함 결정',
  'oomap:places_hide': '장소 숨기기',
  'oomap:recommendation_save': '추천 문장',
  'oomap:script': '수집·정리 스크립트',
};

export const HIDE_REASON_LABEL: Record<string, string> = {
  closed: '폐업',
  duplicate: '중복',
  not_a_place: '장소 아님',
  other: '기타',
};

export interface TaskLog {
  started_at: string | null;
  finished_at: string | null;
  success: boolean | null;
  output: string | null;
  error: string | null;
}

export interface OomapTask {
  id: string;
  title: string;
  description: string | null;
  command: string;
  command_params: Record<string, unknown> | null;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  approval: { status: string; approved_by: string; comment: string | null; created_at: string } | null;
  log: TaskLog | null;
  /** command_params에 나오는 검토함·장소 id → 이름 */
  names: Record<string, string>;
}

const asArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** 작업이 가리키는 검토함·장소 id */
function referencedIds(params: Record<string, unknown> | null) {
  const intake: string[] = [];
  const place: string[] = [];
  if (!params) return { intake, place };
  for (const item of asArray(params.items)) {
    if (typeof item.intake_id === 'string') intake.push(item.intake_id);
    if (typeof item.place_id === 'string') place.push(item.place_id);
  }
  if (Array.isArray(params.ids)) place.push(...params.ids.filter((x): x is string => typeof x === 'string'));
  if (typeof params.place_id === 'string') place.push(params.place_id);
  return { intake, place };
}

export async function getOomapTasks(
  supabase: SupabaseClient,
  view: 'pending' | 'history',
): Promise<{ tasks: OomapTask[]; pendingCount: number; error: string | null }> {
  let query = supabase
    .from('agent_tasks')
    .select('id, title, description, command, command_params, status, result, error, created_at, updated_at')
    .like('command', 'oomap:%')
    .order('created_at', { ascending: view === 'pending' })
    .limit(view === 'pending' ? 100 : 50);
  query = view === 'pending' ? query.eq('status', 'proposed') : query.neq('status', 'proposed');

  const [{ data, error }, pending] = await Promise.all([
    query,
    supabase.from('agent_tasks').select('id', { count: 'exact', head: true }).like('command', 'oomap:%').eq('status', 'proposed'),
  ]);
  if (error) return { tasks: [], pendingCount: 0, error: error.message };
  const rows = (data ?? []) as Omit<OomapTask, 'approval' | 'log' | 'names'>[];
  if (!rows.length) return { tasks: [], pendingCount: pending.count ?? 0, error: null };

  const ids = rows.map((r) => r.id);
  const refs = rows.map((r) => referencedIds(r.command_params));
  const intakeIds = [...new Set(refs.flatMap((r) => r.intake))];
  const placeIds = [...new Set(refs.flatMap((r) => r.place))];

  const [approvals, logs, intakes, places] = await Promise.all([
    supabase.from('task_approvals').select('task_id, status, approved_by, comment, created_at').in('task_id', ids),
    supabase
      .from('execution_logs')
      .select('task_id, started_at, finished_at, success, output, error')
      .in('task_id', ids)
      .order('started_at', { ascending: false }),
    intakeIds.length ? supabase.from('place_intake').select('id, name').in('id', intakeIds) : Promise.resolve({ data: [] }),
    placeIds.length ? supabase.from('places').select('id, name').in('id', placeIds) : Promise.resolve({ data: [] }),
  ]);

  const names: Record<string, string> = {};
  for (const r of [...(intakes.data ?? []), ...(places.data ?? [])] as { id: string; name: string }[]) names[r.id] = r.name;
  const approvalBy = new Map((approvals.data ?? []).map((a) => [a.task_id as string, a]));
  const logBy = new Map<string, TaskLog>();
  for (const l of (logs.data ?? []) as (TaskLog & { task_id: string })[]) if (!logBy.has(l.task_id)) logBy.set(l.task_id, l);

  return {
    tasks: rows.map((r, i) => {
      const a = approvalBy.get(r.id);
      const own = [...refs[i].intake, ...refs[i].place];
      return {
        ...r,
        approval: a ? { status: a.status, approved_by: a.approved_by, comment: a.comment, created_at: a.created_at } : null,
        log: logBy.get(r.id) ?? null,
        names: Object.fromEntries(own.filter((id) => names[id]).map((id) => [id, names[id]])),
      };
    }),
    pendingCount: pending.count ?? 0,
    error: null,
  };
}
