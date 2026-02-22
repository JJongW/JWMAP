'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PERIODS = [
  { value: '1d', label: '오늘' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
];

const RESPONSE_TYPES = [
  { value: 'all', label: '전체' },
  { value: 'single', label: '장소 추천' },
  { value: 'course', label: '코스 추천' },
];

const ACTIVITY_TYPES = [
  { value: 'all', label: '전체' },
  { value: '맛집', label: '맛집' },
  { value: '카페', label: '카페' },
  { value: '볼거리', label: '볼거리' },
  { value: '기타', label: '기타' },
];

interface FilterBarProps {
  period: string;
  region: string | null;
  response_type: string;
  activity_type: string | null;
}

export function FilterBar({ period, region, response_type, activity_type }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-1 py-3 mb-5">
      {/* Period pills */}
      <div className="flex items-center rounded-lg border bg-gray-50 p-0.5 gap-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setParam('period', p.value)}
            className={cn(
              'h-7 rounded-md px-3 text-xs font-medium transition-all',
              period === p.value
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Select value={response_type} onValueChange={(v) => setParam('response_type', v)}>
        <SelectTrigger className="h-8 w-32 text-xs bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RESPONSE_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value} className="text-xs">
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={activity_type ?? 'all'}
        onValueChange={(v) => setParam('activity_type', v)}
      >
        <SelectTrigger className="h-8 w-28 text-xs bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTIVITY_TYPES.map((a) => (
            <SelectItem key={a.value} value={a.value} className="text-xs">
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {region && (
        <button
          onClick={() => setParam('region', '')}
          className="flex items-center gap-1 rounded-full border bg-orange-50 border-orange-200 px-2.5 py-1 text-xs text-orange-700 hover:bg-orange-100 transition-colors"
        >
          📍 {region}
          <span className="ml-0.5 opacity-60">✕</span>
        </button>
      )}

      <span className="ml-auto text-xs text-muted-foreground font-medium">Quality Console</span>
    </div>
  );
}
