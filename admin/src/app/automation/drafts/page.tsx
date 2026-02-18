import Link from 'next/link';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAutomationDrafts } from '@/lib/queries/automation';
import { DraftAutomationActions } from './DraftAutomationActions';

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: '오전',
  lunch: '점심',
  evening: '저녁',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  approved: 'default',
  published: 'outline',
  rejected: 'destructive',
};

export default async function AutomationDraftsPage() {
  const drafts = await getAutomationDrafts(60);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Automation · Drafts</h1>
          <Link href="/automation" className="text-sm text-muted-foreground hover:underline">
            ← Automation
          </Link>
        </div>

        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              generated_drafts 데이터가 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {drafts.map((draft) => (
              <Card key={draft.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {draft.report_date} · {draft.region || '미지정'}
                    </CardTitle>
                    <Badge variant={STATUS_VARIANT[draft.status] ?? 'secondary'}>
                      {draft.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 text-xs text-muted-foreground">
                    {TIME_SLOT_LABEL[draft.time_slot] ?? draft.time_slot}
                    {draft.scheduled_time && (
                      <span className="ml-2">
                        스케줄: {new Date(draft.scheduled_time).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-foreground">
                    {draft.caption.slice(0, 220)}
                    {draft.caption.length > 220 ? '…' : ''}
                  </p>

                  {draft.hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {draft.hashtags.slice(0, 8).map((tag) => (
                        <span key={tag} className="text-xs text-sky-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <DraftAutomationActions id={draft.id} scheduledTime={draft.scheduled_time} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
