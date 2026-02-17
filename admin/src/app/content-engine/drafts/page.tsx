import { getDrafts } from '@/lib/queries/content-engine';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DraftActions } from './DraftActions';
import Link from 'next/link';

const TIME_SLOT_LABEL: Record<string, string> = {
  morning: '🌅 오전',
  lunch: '☀️ 점심',
  evening: '🌙 저녁',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  approved: 'default',
  published: 'outline',
  rejected: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  approved: '승인됨',
  published: '발행됨',
  rejected: '반려',
};

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function DraftsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  const { drafts, total } = await getDrafts({ status, limit, offset });
  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">초안 관리</h1>
          <Link
            href="/content-engine"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← 콘텐츠 엔진
          </Link>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2">
          {[
            { label: '전체', value: undefined },
            { label: '검토 대기', value: 'draft' },
            { label: '승인됨', value: 'approved' },
            { label: '발행됨', value: 'published' },
            { label: '반려', value: 'rejected' },
          ].map((tab) => (
            <Link
              key={tab.label}
              href={`/content-engine/drafts${tab.value ? `?status=${tab.value}` : ''}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : !status && !tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* 초안 카드 목록 */}
        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              해당 조건의 초안이 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft) => (
              <Card key={draft.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{draft.report_date}</span>
                      <span className="text-sm">{TIME_SLOT_LABEL[draft.time_slot]}</span>
                    </div>
                    <Badge variant={STATUS_VARIANT[draft.status]}>
                      {STATUS_LABEL[draft.status]}
                    </Badge>
                  </div>

                  {/* 캡션 */}
                  <p className="flex-1 text-sm leading-relaxed text-foreground">
                    {draft.caption || '(캡션 없음)'}
                  </p>

                  {/* 해시태그 */}
                  {draft.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {draft.hashtags.slice(0, 6).map((tag) => (
                        <span key={tag} className="text-xs text-sky-600">
                          #{tag}
                        </span>
                      ))}
                      {draft.hashtags.length > 6 && (
                        <span className="text-xs text-muted-foreground">+{draft.hashtags.length - 6}</span>
                      )}
                    </div>
                  )}

                  {/* 참조 장소 */}
                  {draft.referenced_places.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📍 {draft.referenced_places.join(', ')}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <DraftActions id={draft.id} status={draft.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/content-engine/drafts?${status ? `status=${status}&` : ''}page=${p}`}
                className={`rounded px-3 py-1 text-sm ${
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
