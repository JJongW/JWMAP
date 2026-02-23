'use client';

import { useTransition } from 'react';
import { approveCandidate, rejectCandidate } from './actions';

interface CandidateActionsProps {
  id: string;
}

export function CandidateActions({ id }: CandidateActionsProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => startTransition(() => approveCandidate(id))}
        className="flex-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        승인
      </button>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => rejectCandidate(id))}
        className="flex-1 rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        반려
      </button>
    </div>
  );
}
