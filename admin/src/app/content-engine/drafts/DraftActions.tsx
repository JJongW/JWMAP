'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { approveDraft, publishDraft, rejectDraft } from '../actions';
import { toast } from 'sonner';
import { CheckCircle, Send, X, Loader2 } from 'lucide-react';

interface DraftActionsProps {
  id: string;
  status: string;
}

export function DraftActions({ id, status }: DraftActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approveDraft(id);
        toast.success('초안이 승인되었습니다');
      } catch {
        toast.error('승인 처리 중 오류가 발생했습니다');
      }
    });
  };

  const handlePublish = () => {
    startTransition(async () => {
      try {
        await publishDraft(id);
        toast.success('콘텐츠가 발행되었습니다');
      } catch {
        toast.error('발행 처리 중 오류가 발생했습니다');
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      try {
        await rejectDraft(id);
        toast.success('초안이 반려되었습니다');
      } catch {
        toast.error('반려 처리 중 오류가 발생했습니다');
      }
    });
  };

  if (status === 'published') {
    return <p className="text-xs text-muted-foreground">발행 완료</p>;
  }

  return (
    <div className="flex gap-2 border-t pt-3">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {status === 'draft' && (
        <>
          <Button size="sm" variant="default" onClick={handleApprove} disabled={isPending}>
            <CheckCircle className="mr-1 h-3 w-3" />
            승인
          </Button>
          <Button size="sm" variant="destructive" onClick={handleReject} disabled={isPending}>
            <X className="mr-1 h-3 w-3" />
            반려
          </Button>
        </>
      )}

      {status === 'approved' && (
        <Button size="sm" variant="default" onClick={handlePublish} disabled={isPending}>
          <Send className="mr-1 h-3 w-3" />
          발행
        </Button>
      )}

      {status === 'rejected' && (
        <Button size="sm" variant="outline" onClick={handleApprove} disabled={isPending}>
          <CheckCircle className="mr-1 h-3 w-3" />
          재승인
        </Button>
      )}
    </div>
  );
}
