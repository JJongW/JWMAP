'use client';

import type { TaskType } from '@/lib/queries/todo';

export interface DayCell {
  date: string;
  completed: boolean;
}

export interface GraphRow {
  taskType: TaskType;
  label: string;
  /** grid[weekIdx][dayIdx], weekIdx 0=가장 오래된 주, dayIdx 0=Mon~6=Sun */
  grid: (DayCell | null)[][];
}

interface ContributionGraphProps {
  rows: GraphRow[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;

function getMonthLabels(firstGrid: (DayCell | null)[][]): { weekIdx: number; label: string }[] {
  const labels: { weekIdx: number; label: string }[] = [];
  let lastMonth = -1;
  firstGrid.forEach((week, w) => {
    const first = week.find((c) => c !== null);
    if (first) {
      const month = new Date(first.date + 'T00:00:00').getMonth();
      if (month !== lastMonth) {
        labels.push({ weekIdx: w, label: MONTH_NAMES[month] });
        lastMonth = month;
      }
    }
  });
  return labels;
}

export function ContributionGraph({ rows }: ContributionGraphProps) {
  if (rows.length === 0) return null;

  const weekCount = rows[0].grid.length;
  const monthLabels = getMonthLabels(rows[0].grid);
  const LABEL_W = 132;

  return (
    <div className="overflow-x-auto rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        26주 완료 기록
      </h2>

      {/* 월 레이블 */}
      <div className="mb-1 flex" style={{ paddingLeft: LABEL_W }}>
        <div className="relative" style={{ width: weekCount * STEP, height: 14 }}>
          {monthLabels.map(({ weekIdx, label }) => (
            <span
              key={weekIdx}
              className="absolute text-[10px] text-slate-400"
              style={{ left: weekIdx * STEP }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 태스크별 행 */}
      <div className="flex flex-col gap-5">
        {rows.map((row) => (
          <div key={row.taskType}>
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {row.label}
            </p>
            <div className="flex gap-0">
              {/* 요일 레이블 */}
              <div
                className="mr-[6px] flex flex-col justify-between"
                style={{ height: 7 * STEP - GAP }}
              >
                {DAY_LABELS.map((d, i) => (
                  <span
                    key={i}
                    className="text-[9px] leading-none text-slate-300 dark:text-slate-600"
                    style={{ height: CELL, lineHeight: `${CELL}px` }}
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* 셀 그리드 */}
              <div className="flex gap-[2px]">
                {row.grid.map((week, w) => (
                  <div key={w} className="flex flex-col gap-[2px]">
                    {week.map((cell, d) =>
                      cell ? (
                        <div
                          key={d}
                          title={`${cell.date} · ${cell.completed ? '완료' : '미완료'}`}
                          className={`rounded-[2px] transition-colors ${
                            cell.completed
                              ? 'bg-sky-500'
                              : 'bg-slate-100 dark:bg-slate-800'
                          }`}
                          style={{ width: CELL, height: CELL }}
                        />
                      ) : (
                        <div key={d} style={{ width: CELL, height: CELL }} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <span>미완료</span>
        <div
          className="rounded-[2px] bg-slate-100 dark:bg-slate-800"
          style={{ width: CELL, height: CELL }}
        />
        <div className="rounded-[2px] bg-sky-500" style={{ width: CELL, height: CELL }} />
        <span>완료</span>
      </div>
    </div>
  );
}
