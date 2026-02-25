'use client';

export interface ContributionGraphProps {
  /** date (YYYY-MM-DD) → 완료된 태스크 수 (0~3) */
  data: Map<string, number>;
  /** 최신순 날짜 배열 (182일) */
  days: string[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;

/** date → 요일 인덱스 (0=Mon, 6=Sun) */
function dayOfWeekMon(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

/** N일 뺀 날짜 */
function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** 완료 수 → Tailwind 색상 클래스 */
function cellColor(count: number): string {
  switch (count) {
    case 1: return 'bg-sky-200 dark:bg-sky-900';
    case 2: return 'bg-sky-400';
    case 3: return 'bg-sky-500';
    default: return 'bg-slate-100 dark:bg-slate-800';
  }
}

export function ContributionGraph({ data, days }: ContributionGraphProps) {
  if (days.length === 0) return null;

  const today = days[0];
  const oldest = days[days.length - 1];
  const daySet = new Set(days);

  // 가장 오래된 날짜가 속한 주의 월요일
  const dow = dayOfWeekMon(oldest);
  const startMonday = subDays(oldest, dow);

  // 26열(주) × 7행(요일) 그리드
  const WEEKS = 26;
  const grid: { date: string; count: number; inRange: boolean }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: { date: string; count: number; inRange: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(startMonday + 'T00:00:00Z');
      cur.setUTCDate(cur.getUTCDate() + w * 7 + d);
      const dateStr = cur.toISOString().slice(0, 10);
      week.push({
        date: dateStr,
        count: data.get(dateStr) ?? 0,
        inRange: dateStr <= today && daySet.has(dateStr),
      });
    }
    grid.push(week);
  }

  // 월 레이블 (겹침 방지: 최소 4주 간격)
  const monthLabels: { weekIdx: number; label: string }[] = [];
  let lastLabelWeek = -5;
  for (let w = 0; w < WEEKS; w++) {
    const first = grid[w].find((c) => c.inRange);
    if (first && w - lastLabelWeek >= 4) {
      const month = new Date(first.date + 'T00:00:00Z').getUTCMonth();
      const prevLabel = monthLabels[monthLabels.length - 1];
      if (!prevLabel || MONTH_NAMES[month] !== prevLabel.label) {
        monthLabels.push({ weekIdx: w, label: MONTH_NAMES[month] });
        lastLabelWeek = w;
      }
    }
  }

  const gridWidth = WEEKS * STEP - GAP;

  return (
    <div className="overflow-x-auto rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
      <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
        26주 기록
      </h2>

      <div className="flex gap-3">
        {/* 요일 레이블 */}
        <div className="flex shrink-0 flex-col" style={{ paddingTop: 18, gap: GAP }}>
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[10px] leading-none text-slate-400 dark:text-slate-500"
              style={{ height: CELL, lineHeight: `${CELL}px` }}
            >
              {label}
            </div>
          ))}
        </div>

        <div>
          {/* 월 레이블 */}
          <div className="relative mb-1" style={{ width: gridWidth, height: 16 }}>
            {monthLabels.map(({ weekIdx, label }) => (
              <span
                key={weekIdx}
                className="absolute text-[10px] text-slate-400 dark:text-slate-500"
                style={{ left: weekIdx * STEP }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* 셀 그리드 */}
          <div className="flex" style={{ gap: GAP }}>
            {grid.map((week, w) => (
              <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                {week.map((cell, d) => (
                  <div
                    key={d}
                    title={
                      cell.inRange
                        ? `${cell.date} · ${cell.count}/3 완료`
                        : undefined
                    }
                    className={`rounded-[3px] transition-colors ${
                      cell.inRange ? cellColor(cell.count) : 'bg-transparent'
                    }`}
                    style={{ width: CELL, height: CELL }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
        <span>Less</span>
        {([0, 1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={`rounded-[3px] ${cellColor(n)}`}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        <span>More</span>
        <span className="ml-3 text-slate-300 dark:text-slate-600">|</span>
        <span className="ml-1">색상 = 당일 완료한 태스크 수 (최대 3개)</span>
      </div>
    </div>
  );
}
