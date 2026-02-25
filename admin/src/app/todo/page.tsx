import { AdminLayout } from '@/components/layout/AdminLayout';
import {
  getChecklistRecords,
  getPastWeeks,
  getWeekStart,
  TASK_LABELS,
  TASKS,
  type ChecklistRow,
  type TaskType,
} from '@/lib/queries/todo';
import { TaskButton } from './TaskButton';
import { ContributionGraph } from './ContributionGraph';

const WEEK_COUNT = 26;

interface TaskStats {
  completedWeeks: number;
  totalWeeks: number;
  currentStreak: number;
}

function computeStats(
  taskType: TaskType,
  weeks: string[], // 최신순
  recordMap: Map<string, Map<TaskType, boolean>>,
): TaskStats {
  const completedWeeks = weeks.filter((w) => recordMap.get(w)?.get(taskType) ?? false).length;

  let currentStreak = 0;
  for (const week of weeks) {
    if (recordMap.get(week)?.get(taskType)) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { completedWeeks, totalWeeks: weeks.length, currentStreak };
}

export default async function TodoPage() {
  const weeks = getPastWeeks(WEEK_COUNT); // 최신순 (weeks[0] = 이번 주)
  const currentWeek = weeks[0];
  const records = await getChecklistRecords(weeks);

  // week_start → taskType → completed 맵
  const recordMap = new Map<string, Map<TaskType, boolean>>();
  for (const row of records as ChecklistRow[]) {
    if (!recordMap.has(row.week_start)) {
      recordMap.set(row.week_start, new Map());
    }
    recordMap.get(row.week_start)!.set(row.task_type, row.completed);
  }

  // 태스크별 통계
  const statsMap = new Map<TaskType, TaskStats>();
  for (const task of TASKS) {
    statsMap.set(task, computeStats(task, weeks, recordMap));
  }

  // 잔디 그래프용 데이터 (오래된 것이 앞)
  const reversedWeeks = [...weeks].reverse();
  const graphRows = TASKS.map((task) => ({
    taskType: task,
    label: TASK_LABELS[task],
    cells: reversedWeeks.map((week) => ({
      weekStart: week,
      completed: recordMap.get(week)?.get(task) ?? false,
    })),
  }));

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Weekly Tasks</h1>

        {/* 이번 주 체크리스트 */}
        <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            이번 주 ({currentWeek})
          </h2>
          <div className="flex flex-col gap-2">
            {TASKS.map((task) => (
              <TaskButton
                key={task}
                taskType={task}
                label={TASK_LABELS[task]}
                weekStart={currentWeek}
                completed={recordMap.get(currentWeek)?.get(task) ?? false}
              />
            ))}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {TASKS.map((task) => {
            const stats = statsMap.get(task)!;
            const rate = Math.round((stats.completedWeeks / stats.totalWeeks) * 100);
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
                      {stats.completedWeeks}/{stats.totalWeeks}주 완료
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      🔥 {stats.currentStreak}주
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
