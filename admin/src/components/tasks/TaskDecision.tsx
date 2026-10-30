'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { decideTask } from '@/app/tasks/actions';

/** 승인 대기 작업: 승인 / 거절(사유 선택) */
export function TaskDecision({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');

  const run = (approve: boolean) =>
    startTransition(async () => {
      const { error } = await decideTask({ taskId, approve, comment: approve ? null : comment });
      if (error) toast.error(`저장 실패: ${error}`);
      else toast.success(approve ? '승인했어요. 1분 안에 실행돼요' : '거절했어요');
    });

  if (rejecting) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="거절 사유 (선택)"
          className="h-8 w-56 text-xs"
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(false)}
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          거절
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setRejecting(false)}>
          취소
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={isPending} onClick={() => run(true)} className="bg-orange-500 text-white hover:bg-orange-600">
        승인
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => setRejecting(true)}
        className="border-gray-200 hover:border-orange-300 hover:text-orange-600"
      >
        거절
      </Button>
    </div>
  );
}
