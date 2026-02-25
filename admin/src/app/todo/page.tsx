import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  getChecklistRecords,
  getPastDays,
  getToday,
  TASK_LABELS,
  TASKS,
  type ChecklistRow,
  type TaskType,
} from '@/lib/queries/todo';
import { TaskButton } from './TaskButton';
import { ContributionGraph, type DayCell, type GraphRow } from './ContributionGraph';

const DAY_COUNT = 182; // 26주

// ── 통계 계산 ───────────────────────────────────────────────

interface TaskStats {
  completedDays: number;
  totalDays: number;
  currentStreak: number; // 오늘부터 거슬러 올라가는 연속 완료 일수
}

function computeStats(
  taskType: TaskType,
  days: string[], // 최신순
  doneSet: Set<string>,
): TaskStats {
  const completedDays = days.filter((d) => doneSet.has(d)).length;

  let currentStreak = 0;
  for (const day of days) {
    if (doneSet.has(day)) currentStreak++;
    else break;
  }

  return { completedDays, totalDays: days.length, currentStreak };
}

// ── 잔디 그리드 생성 ─────────────────────────────────────────

/** 날짜 문자열로부터 월요일 기준 요일 인덱스 반환 (0=Mon, 6=Sun) */
function dayOfWeekMon(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

/** 날짜 문자열로부터 N일 전 날짜 반환 */
function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildGrid(
  days: string[], // 최신순 182일
  doneSet: Set<string>,
): (DayCell | null)[][] {
  const today = days[0];
  const oldest = days[days.length - 1];

  // 가장 오래된 날짜가 속한 주의 월요일
  const dow = dayOfWeekMon(oldest);
  const startMonday = subDays(oldest, dow);

  const daySet = new Set(days);
  const grid: (DayCell | null)[][] = [];

  for (let w = 0; w < 26; w++) {
    const week: (DayCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(startMonday + 'T00:00:00Z');
      cur.setUTCDate(cur.getUTCDate() + w * 7 + d);
      const dateStr = cur.toISOString().slice(0, 10);

      if (dateStr > today || !daySet.has(dateStr)) {
        week.push(null);
      } else {
        week.push({ date: dateStr, completed: doneSet.has(dateStr) });
      }
    }
    grid.push(week);
  }

  return grid;
}

// ── 페이지 ──────────────────────────────────────────────────

export default async function TodoPage() {
  const today = getToday();
  const days = getPastDays(DAY_COUNT); // 최신순
  const records = await getChecklistRecords(days);

  // date → taskType → completed 맵
  const recordMap = new Map<string, Map<TaskType, boolean>>();
  for (const row of records as ChecklistRow[]) {
    if (!recordMap.has(row.date)) recordMap.set(row.date, new Map());
    recordMap.get(row.date)!.set(row.task_type, row.completed);
  }

  // 태스크별 완료 날짜 집합 + 통계 + 그리드
  const taskData = TASKS.map((task) => {
    const doneSet = new Set(days.filter((d) => recordMap.get(d)?.get(task) === true));
    const stats = computeStats(task, days, doneSet);
    const grid = buildGrid(days, doneSet);
    return { task, stats, grid };
  });

  const graphRows: GraphRow[] = taskData.map(({ task, grid }) => ({
    taskType: task,
    label: TASK_LABELS[task],
    grid,
  }));

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Daily Tasks</h1>

        {/* 오늘 체크리스트 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            오늘 ({today})
          </h2>
          <div className="flex flex-col gap-2">
            {TASKS.map((task) => (
              <TaskButton
                key={task}
                taskType={task}
                label={TASK_LABELS[task]}
                date={today}
                completed={recordMap.get(today)?.get(task) ?? false}
              />
            ))}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {taskData.map(({ task, stats }) => {
            const rate = Math.round((stats.completedDays / stats.totalDays) * 100);
            return (
              <div
                key={task}
                className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900"
              >
                <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {TASK_LABELS[task]}
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-sky-500">{rate}%</p>
                    <p className="text-xs text-slate-400">
                      {stats.completedDays}/{stats.totalDays}일 완료
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      🔥 {stats.currentStreak}일
                    </p>
                    <p className="text-xs text-slate-400">연속 완료</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 잔디 그래프 */}
        <ContributionGraph rows={graphRows} />
      </div>
    </AdminLayout>
  );
}
