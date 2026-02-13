'use client';

import { cn } from '@/lib/utils';

export const CURATION_LEVELS = [
  { value: 1, label: '눈도장', desc: '방문 확인', color: 'from-slate-50 to-slate-100 border-slate-200', activeColor: 'from-slate-100 to-slate-200 border-slate-400 ring-2 ring-slate-300', text: 'text-slate-600' },
  { value: 2, label: '추천픽', desc: '괜찮은 곳', color: 'from-blue-50 to-blue-100 border-blue-200', activeColor: 'from-blue-100 to-blue-200 border-blue-400 ring-2 ring-blue-300', text: 'text-blue-600' },
  { value: 3, label: '확신픽', desc: '자신있게 추천', color: 'from-violet-50 to-violet-100 border-violet-200', activeColor: 'from-violet-100 to-violet-200 border-violet-400 ring-2 ring-violet-300', text: 'text-violet-600' },
  { value: 4, label: '시그니처', desc: '꼭 가봐야 할', color: 'from-amber-50 to-amber-100 border-amber-200', activeColor: 'from-amber-100 to-amber-200 border-amber-400 ring-2 ring-amber-300', text: 'text-amber-600' },
  { value: 5, label: '아카이브', desc: '전설의 맛집', color: 'from-rose-50 to-rose-100 border-rose-200', activeColor: 'from-rose-100 to-rose-200 border-rose-400 ring-2 ring-rose-300', text: 'text-rose-600' },
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
            <span className={cn('text-[11px] font-semibold leading-tight text-center', level.text)}>
              쩝쩝박사
            </span>
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
  return found ? `쩝쩝박사 ${found.label}` : '';
}
