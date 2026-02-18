'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { approveGeneratedDraft, deleteGeneratedDraft, scheduleGeneratedDraft } from '../actions';

interface DraftAutomationActionsProps {
  id: string;
  scheduledTime: string | null;
}

function toLocalDateTimeInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function DraftAutomationActions({ id, scheduledTime }: DraftAutomationActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [nextTime, setNextTime] = useState(toLocalDateTimeInputValue(scheduledTime));

  const onApprove = () => {
    startTransition(async () => {
      try {
        await approveGeneratedDraft(id);
        toast.success('초안을 승인했습니다.');
      } catch {
        toast.error('승인 처리 중 오류가 발생했습니다.');
      }
    });
  };

  const onSchedule = () => {
    if (!nextTime) {
      toast.error('스케줄 시간을 입력하세요.');
      return;
    }

    startTransition(async () => {
      try {
        await scheduleGeneratedDraft(id, nextTime);
        toast.success('스케줄이 저장되었습니다.');
      } catch {
        toast.error('스케줄 저장 중 오류가 발생했습니다.');
      }
    });
  };

  const onDelete = () => {
    startTransition(async () => {
      try {
        await deleteGeneratedDraft(id);
        toast.success('초안을 삭제했습니다.');
      } catch {
        toast.error('삭제 처리 중 오류가 발생했습니다.');
      }
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approve
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete} disabled={isPending}>
          Delete
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          type="datetime-local"
          value={nextTime}
          onChange={(e) => setNextTime(e.target.value)}
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={onSchedule} disabled={isPending}>
          Schedule
        </Button>
      </div>
    </div>
  );
}
