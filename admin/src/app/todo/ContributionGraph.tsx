'use client';

import type { TaskType } from '@/lib/queries/todo';

interface ContributionCell {
  weekStart: string;
  completed: boolean;
}

interface ContributionRow {
  taskType: TaskType;
  label: string;
  cells: ContributionCell[]; // 오래된 것이 [0], 최신이 [마지막]
}

interface ContributionGraphProps {
  rows: ContributionRow[];
}

/** YYYY-MM-DD → "M월 D주차" 형태 툴팁 */
function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day} 주`;
}

/** 월 레이블 위치 계산: 셀 인덱스 배열 → 월이 바뀌는 지점 반환 */
function getMonthLabels(cells: ContributionCell[]): { index: number; label: string }[] {
  const labels: { index: number; label: string }[] = [];
  let lastMonth = -1;
  cells.forEach((cell, i) => {
    const month = new Date(cell.weekStart + 'T00:00:00').getMonth();
    if (month !== lastMonth) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      labels.push({ index: i, label: monthNames[month] });
      lastMonth = month;
    }
  });
  return labels;
}

export function ContributionGraph({ rows }: ContributionGraphProps) {
  if (rows.length === 0) return null;

  const cellSize = 14;
  const cellGap = 3;
  const labelWidth = 140;
  const cellCount = rows[0].cells.length;
  const monthLabels = getMonthLabels(rows[0].cells);

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        26주 완료 기록
      </h2>

      {/* 월 레이블 */}
      <div className="mb-1 flex" style={{ paddingLeft: labelWidth }}>
        <div className="relative flex-1" style={{ height: 16 }}>
          {monthLabels.map(({ index, label }) => (
            <span
              key={index}
              className="absolute text-xs text-slate-400"
              style={{ left: index * (cellSize + cellGap) }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 태스크별 행 */}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.taskType} className="flex items-center">
            {/* 태스크명 */}
            <span
              className="shrink-0 text-xs text-slate-500 dark:text-slate-400"
              style={{ width: labelWidth }}
            >
              {row.label}
            </span>

            {/* 셀 그리드 */}
            <div className="flex gap-[3px]">
              {row.cells.map((cell) => (
                <div
                  key={cell.weekStart}
                  title={`${formatWeekLabel(cell.weekStart)} · ${cell.completed ? '완료' : '미완료'}`}
                  className={`h-[14px] w-[14px] rounded-sm transition-colors ${
                    cell.completed
                      ? 'bg-sky-500'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        <span>미완료</span>
        <div className="h-[14px] w-[14px] rounded-sm bg-slate-100 dark:bg-slate-800" />
        <div className="h-[14px] w-[14px] rounded-sm bg-sky-500" />
        <span>완료</span>
      </div>
    </div>
  );
}
