import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { TaskDecision } from '@/components/tasks/TaskDecision';
import { INTAKE_STATUS_LABEL, type IntakeStatus } from '@/lib/queries/intake';
import {
  HIDE_REASON_LABEL,
  TASK_COMMAND_LABEL,
  TASK_STATUS_LABEL,
  getOomapTasks,
  type OomapTask,
} from '@/lib/queries/tasks';
import { cn } from '@/lib/utils';

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_BADGE: Record<string, string> = {
  proposed: 'bg-orange-50 text-orange-600',
  debating: 'bg-orange-50 text-orange-600',
  approved: 'bg-sky-50 text-sky-700',
  executing: 'bg-sky-50 text-sky-700',
  done: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-600',
};

const BASIS_LABEL: Record<string, string> = {
  visited: '가봤음',
  friend: '지인 추천',
  research: '조사',
  wishlist: '가보고 싶음',
};

const formatTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function PlaceName({ task, id }: { task: OomapTask; id: string }) {
  const name = task.names[id];
  return (
    <Link href={`/places/${id}`} className="font-medium hover:text-orange-600 hover:underline">
      {name ?? id.slice(0, 8)}
    </Link>
  );
}

/** 작업이 바꿀 내용 */
function TaskDetail({ task }: { task: OomapTask }) {
  const p = task.command_params ?? {};

  if (task.command === 'oomap:intake_decide') {
    const items = Array.isArray(p.items) ? (p.items as Record<string, unknown>[]) : [];
    const list = (
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-medium">{task.names[str(item.intake_id)] ?? str(item.intake_id).slice(0, 8)}</span>
            <span className="text-muted-foreground">→</span>
            <span>{INTAKE_STATUS_LABEL[str(item.status) as IntakeStatus] ?? str(item.status)}</span>
            {str(item.place_id) && (
              <span className="text-muted-foreground">
                (연결: <PlaceName task={task} id={str(item.place_id)} />)
              </span>
            )}
            {str(item.mode) === 'attractions' && <span className="text-muted-foreground">볼거리</span>}
            {str(item.basis) && <span className="text-muted-foreground">근거: {str(item.basis)}</span>}
          </li>
        ))}
      </ul>
    );
    return items.length > 12 ? (
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{items.length}곳 펼쳐 보기</summary>
        <div className="mt-2">{list}</div>
      </details>
    ) : (
      list
    );
  }

  if (task.command === 'oomap:places_hide') {
    const ids = Array.isArray(p.ids) ? (p.ids as string[]) : [];
    return (
      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">
          사유: {HIDE_REASON_LABEL[str(p.reason)] ?? str(p.reason)} · 행은 남고 사이트·추천에서만 빠져요
        </p>
        <p className="flex flex-wrap gap-x-2 gap-y-1">
          {ids.map((id) => (
            <PlaceName key={id} task={task} id={id} />
          ))}
        </p>
      </div>
    );
  }

  if (task.command === 'oomap:recommendation_save') {
    return (
      <div className="space-y-1.5 text-xs">
        <p className="text-muted-foreground">
          <PlaceName task={task} id={str(p.place_id)} /> · {p.publish ? '바로 공개' : '초안으로 저장'} · 근거{' '}
          {BASIS_LABEL[str(p.basis)] ?? str(p.basis)}
        </p>
        <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed">{str(p.body)}</p>
        {str(p.fits_for) && <p className="text-muted-foreground">이럴 때: {str(p.fits_for)}</p>}
        {str(p.caveats) && <p className="text-muted-foreground">참고: {str(p.caveats)}</p>}
      </div>
    );
  }

  if (task.command === 'oomap:script') {
    return (
      <div className="space-y-1 text-xs">
        <p>
          <span className="font-mono">{str(p.script)}</span>
          <span className="text-muted-foreground"> · 미리 돌려 본 결과</span>
        </p>
        {task.description && (
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-3 text-[11px]">
            {task.description}
          </pre>
        )}
      </div>
    );
  }

  return task.description ? <p className="text-xs text-muted-foreground">{task.description}</p> : null;
}

/** 승인·실행 기록 */
function TaskOutcome({ task }: { task: OomapTask }) {
  const lines: string[] = [];
  if (task.approval) {
    const who = task.approval.approved_by.startsWith('admin:') ? '관리자 화면' : task.approval.approved_by;
    lines.push(
      `${task.approval.status === 'rejected' ? '거절' : '승인'} · ${who} · ${formatTime(task.approval.created_at)}${
        task.approval.comment ? ` · ${task.approval.comment}` : ''
      }`,
    );
  }
  if (task.status === 'approved') lines.push('Mac mini의 Claude Code에서 "실행해"라고 하면 task_run으로 실행돼요');
  if (task.log?.finished_at) lines.push(`실행 ${task.log.success ? '성공' : '실패'} · ${formatTime(task.log.finished_at)}`);
  const detail = task.error ?? task.log?.error ?? (task.status === 'done' ? task.result ?? task.log?.output : null);
  if (!lines.length && !detail) return null;
  return (
    <div className="space-y-1 border-t border-gray-100 pt-2 text-xs text-muted-foreground">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {detail && (
        <pre
          className={cn(
            'max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md p-2 text-[11px]',
            task.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-gray-50',
          )}
        >
          {detail}
        </pre>
      )}
    </div>
  );
}

export default async function TasksPage({ searchParams }: Props) {
  const params = await searchParams;
  const view = params.view === 'history' ? 'history' : 'pending';
  const supabase = await createServerSupabase();
  const { tasks, pendingCount, error } = await getOomapTasks(supabase, view);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">승인 대기</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Claude가 MCP로 제안한 운영 DB 작업이에요. 승인한 작업만 Mac mini에서 실행돼요. 거절하면 실행되지 않아요.
          </p>
        </div>

        <div className="flex w-fit items-center gap-0.5 rounded-lg border bg-gray-50 p-0.5">
          {(
            [
              ['pending', `승인 대기 ${pendingCount}`, '/tasks'],
              ['history', '지난 작업', '/tasks?view=history'],
            ] as const
          ).map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              className={cn(
                'h-7 rounded-md px-3 text-xs font-medium leading-7 transition-all',
                key === view ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {error && (
          <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs text-red-600">
            작업을 불러오지 못했어요: {error}
          </p>
        )}

        {!error && tasks.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
            {view === 'pending' ? '승인을 기다리는 작업이 없어요.' : '아직 지난 작업이 없어요.'}
          </div>
        )}

        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {TASK_COMMAND_LABEL[task.command] ?? task.command} · {formatTime(task.created_at)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{task.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {task.status !== 'proposed' && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[task.status])}>
                      {task.approval?.status === 'rejected' ? '거절됨' : TASK_STATUS_LABEL[task.status]}
                    </span>
                  )}
                  {task.status === 'proposed' && <TaskDecision taskId={task.id} />}
                </div>
              </div>
              <TaskDetail task={task} />
              <TaskOutcome task={task} />
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
