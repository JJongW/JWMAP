'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { approvePlaceCandidate, rejectPlaceCandidate } from '../actions';

interface CandidateActionsProps {
  id: string;
}

export function CandidateActions({ id }: CandidateActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approvePlaceCandidate(id);
        toast.success('후보가 승인되었습니다.');
      } catch {
        toast.error('승인 처리 중 오류가 발생했습니다.');
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      try {
        await rejectPlaceCandidate(id);
        toast.success('후보가 반려되었습니다.');
      } catch {
        toast.error('반려 처리 중 오류가 발생했습니다.');
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
        Reject
      </Button>
    </div>
  );
}
