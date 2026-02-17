import { getContentEngineStats } from '@/lib/queries/content-engine';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle, Send, TrendingUp, MessageSquare, Bot } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

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

export default async function ContentEnginePage() {
  const stats = await getContentEngineStats();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">콘텐츠 엔진</h1>
          <div className="flex gap-2">
            <Link
              href="/content-engine/drafts"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" />
              초안 관리
            </Link>
            <Link
              href="/content-engine/trends"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <TrendingUp className="h-4 w-4" />
              트렌드 리포트
            </Link>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">전체 초안</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalDrafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">검토 대기</CardTitle>
              <Bot className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats.pendingDrafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">승인됨</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{stats.approvedDrafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">발행됨</CardTitle>
              <Send className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-sky-600">{stats.publishedDrafts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">트렌드 리포트</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalReports}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">수집된 SNS</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalSnsPosts}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 최근 초안 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">최근 생성된 초안</CardTitle>
              <Link href="/content-engine/drafts" className="text-xs text-muted-foreground hover:underline">
                전체 보기 →
              </Link>
            </CardHeader>
            <CardContent>
              {stats.recentDrafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 생성된 초안이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentDrafts.map((draft) => (
                    <div key={draft.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{draft.report_date}</span>
                          <span className="text-xs">{TIME_SLOT_LABEL[draft.time_slot] ?? draft.time_slot}</span>
                          <Badge variant={STATUS_VARIANT[draft.status] ?? 'secondary'}>
                            {STATUS_LABEL[draft.status] ?? draft.status}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-muted-foreground">{draft.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 최근 트렌드 리포트 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">최근 트렌드 리포트</CardTitle>
              <Link href="/content-engine/trends" className="text-xs text-muted-foreground hover:underline">
                전체 보기 →
              </Link>
            </CardHeader>
            <CardContent>
              {stats.recentReports.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 트렌드 리포트가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentReports.map((report) => (
                    <div key={report.report_date} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{report.report_date}</span>
                        <span className="ml-2 text-muted-foreground">{report.region}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {report.total_posts_analyzed}개 게시물 분석
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
