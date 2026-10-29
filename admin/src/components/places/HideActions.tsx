'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { hidePlaces, markOpen } from '@/app/locations/incomplete/actions';

/** 폐업 의심 장소: 숨기기 / 영업 중 맞음 */
export function HideActions({ ids, label = '숨기기' }: { ids: string[]; label?: string }) {
  const [isPending, startTransition] = useTransition();
  const run = (op: () => Promise<{ error: string | null }>, done: string) =>
    startTransition(async () => {
      const { error } = await op();
      if (error) toast.error(`저장 실패: ${error}`);
      else toast.success(done);
    });
  return (
    <span className="flex gap-1 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => hidePlaces(ids), `${ids.length}곳을 숨겼어요`)}
        className="rounded-md px-2 py-1 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
      >
        {label}
      </button>
      {ids.length === 1 && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => markOpen(ids), '영업 중으로 표시했어요')}
          className="rounded-md px-2 py-1 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
        >
          영업 중 맞음
        </button>
      )}
    </span>
  );
}
