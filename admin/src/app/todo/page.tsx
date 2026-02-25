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
import { ContributionGraph } from './ContributionGraph';

const DAY_COUNT = 182; // 26주

// ── 연속 streak 계산 ─────────────────────────────────────────

function computeStreak(days: string[], doneSet: Set<string>): number {
  let streak = 0;
  for (const day of days) {
    if (doneSet.has(day)) streak++;
    else break;
  }
  return streak;
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

  // 태스크별 완료 날짜 집합 + streak
  const taskData = TASKS.map((task) => {
    const doneSet = new Set(days.filter((d) => recordMap.get(d)?.get(task) === true));
    const streak = computeStreak(days, doneSet);
    return { task, doneSet, streak };
  });

  // 통합 히트맵용: 날짜별 완료 태스크 수 (0~3)
  const completionCountMap = new Map<string, number>();
  for (const day of days) {
    let count = 0;
    for (const task of TASKS) {
      if (recordMap.get(day)?.get(task) === true) count++;
    }
    completionCountMap.set(day, count);
  }

  // 이번 주 현황: 최근 7일 (오래된 순)
  const weekDays = days.slice(0, 7).reverse();

  return (
    <AdminLayout>
      <div className="space-y-5 p-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Daily Tasks</h1>

        {/* 오늘 체크리스트 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            오늘 — {today}
          </h2>
          <div className="grid grid-cols-3 gap-3">
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

        {/* 이번 주 현황 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            이번 주 현황
          </h2>
          <div className="flex flex-col gap-3">
            {taskData.map(({ task, doneSet, streak }) => (
              <div key={task} className="flex items-center gap-4">
                {/* 태스크명 */}
                <span className="w-40 shrink-0 text-sm text-slate-600 dark:text-slate-300">
                  {TASK_LABELS[task]}
                </span>
                {/* streak */}
                <span className="w-14 shrink-0 text-sm font-semibold text-orange-500">
                  {streak > 0 ? `🔥 ${streak}일` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                </span>
                {/* 7일 dots */}
                <div className="flex gap-1.5">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      title={day}
                      className={`h-4 w-4 rounded-full ${
                        doneSet.has(day)
                          ? 'bg-sky-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* 7일 날짜 레이블 */}
          <div className="mt-2 flex gap-1.5" style={{ paddingLeft: '14.5rem' }}>
            {weekDays.map((day) => (
              <span
                key={day}
                className={`w-4 text-center text-[9px] text-slate-400 dark:text-slate-500 ${
                  day === today ? 'font-bold text-sky-500' : ''
                }`}
              >
                {new Date(day + 'T00:00:00Z').getUTCDate()}
              </span>
            ))}
          </div>
        </div>

        {/* 26주 기록 */}
        <ContributionGraph data={completionCountMap} days={days} />
      </div>
    </AdminLayout>
  );
}
