'use client';

import { cn } from '@/lib/utils';

export const CURATION_LEVELS = [
  // desc: 사용자 화면에 보이는 것. 배지는 '제가 직접 가본 곳'일 때만 붙는다 (project/src/utils/curation.ts getRecommendBadge)
  { value: 1, label: '가볍게', desc: '배지 없음', color: 'from-slate-50 to-slate-100 border-slate-200', activeColor: 'from-slate-100 to-slate-200 border-slate-400 ring-2 ring-slate-300', text: 'text-slate-600' },
  { value: 2, label: '괜찮음', desc: '배지 없음', color: 'from-blue-50 to-blue-100 border-blue-200', activeColor: 'from-blue-100 to-blue-200 border-blue-400 ring-2 ring-blue-300', text: 'text-blue-600' },
  { value: 3, label: '운영자 추천', desc: "'운영자 추천' 배지", color: 'from-violet-50 to-violet-100 border-violet-200', activeColor: 'from-violet-100 to-violet-200 border-violet-400 ring-2 ring-violet-300', text: 'text-violet-600' },
  { value: 4, label: '대표픽', desc: "'대표픽' 배지", color: 'from-amber-50 to-amber-100 border-amber-200', activeColor: 'from-amber-100 to-amber-200 border-amber-400 ring-2 ring-amber-300', text: 'text-amber-600' },
  { value: 5, label: '대표픽 중 최고', desc: "'대표픽' 배지", color: 'from-rose-50 to-rose-100 border-rose-200', activeColor: 'from-rose-100 to-rose-200 border-rose-400 ring-2 ring-rose-300', text: 'text-rose-600' },
] as const;

interface CurationLevelSelectorProps {
  value: number | null;
  onChange: (value: number) => void;
}

export function CurationLevelSelector({ value, onChange }: CurationLevelSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {CURATION_LEVELS.map((level) => {
        const isActive = value === level.value;
        return (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-xl border px-2 py-3 bg-gradient-to-b transition-all duration-200 cursor-pointer',
              isActive ? level.activeColor : level.color,
              isActive ? 'scale-[1.02] shadow-sm' : 'hover:scale-[1.01] hover:shadow-sm opacity-70 hover:opacity-100'
            )}
          >
            <span className={cn('text-xs font-bold', level.text)}>Lv.{level.value}</span>
            <span className={cn('text-[11px] font-bold leading-tight', level.text)}>
              {level.label}
            </span>
            <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">
              {level.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function getCurationLabel(level: number): string {
  const found = CURATION_LEVELS.find((l) => l.value === level);
  return found ? `Lv.${found.value} ${found.label}` : '';
}
