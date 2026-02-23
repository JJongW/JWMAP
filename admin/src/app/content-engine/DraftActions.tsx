'use client';

import { useState, useTransition } from 'react';
import { approveDraft, rejectDraft, publishDraft, scheduleDraft } from './actions';

interface DraftActionsProps {
  id: string;
  status: 'draft' | 'approved' | 'published' | 'rejected';
}

export function DraftActions({ id, status }: DraftActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [scheduleTime, setScheduleTime] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  if (status === 'published') {
    return <p className="text-xs text-muted-foreground">발행 완료</p>;
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      {status === 'draft' && (
        <div className="flex gap-2">
          <button
            disabled={isPending}
            onClick={() => startTransition(() => approveDraft(id))}
            className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            승인
          </button>
          <button
            disabled={isPending}
            onClick={() => startTransition(() => rejectDraft(id))}
            className="flex-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            반려
          </button>
        </div>
      )}

      {status === 'approved' && (
        <>
          <div className="flex gap-2">
            <button
              disabled={isPending}
              onClick={() => startTransition(() => publishDraft(id))}
              className="flex-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              발행
            </button>
            <button
              disabled={isPending}
              onClick={() => setShowSchedule((v) => !v)}
              className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              스케줄
            </button>
          </div>
          {showSchedule && (
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="flex-1 rounded-md border px-2 py-1 text-xs"
              />
              <button
                disabled={isPending || !scheduleTime}
                onClick={() =>
                  startTransition(() => {
                    scheduleDraft(id, new Date(scheduleTime).toISOString());
                    setShowSchedule(false);
                  })
                }
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                확인
              </button>
            </div>
          )}
        </>
      )}

      {status === 'rejected' && (
        <button
          disabled={isPending}
          onClick={() => startTransition(() => approveDraft(id))}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          재승인
        </button>
      )}
    </div>
  );
}
